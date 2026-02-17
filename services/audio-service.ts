import type { SoundType } from '@/components/sound-selector';
import type { TextureType } from '@/components/texture-selector';
import { Asset } from 'expo-asset';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { Platform } from 'react-native';

export interface AudioConfig {
  intensity: number; // 0-100
  texture: TextureType;
  soundType: SoundType;
}

class AudioService {
  private audioContext: AudioContext | null = null;
  private audioNodes: AudioNode[] = []; // Track all audio nodes for cleanup
  private gainNode: GainNode | null = null;
  private isPlaying = false;
  private currentConfig: AudioConfig | null = null;
  private animationFrameId: number | null = null;
  private dropIntervalId: NodeJS.Timeout | null = null;
  private expoAudioPlayer: AudioPlayer | null = null; // For native platforms
  private isWeb = Platform.OS === 'web';
  
  // Sample buffers cache (for Web Audio API) - key: "soundType_texture"
  private sampleBuffers: Map<string, AudioBuffer> = new Map();
  
  // Sample asset paths - texture-specific
    private readonly samplePaths: Record<SoundType, Record<TextureType, any>> = {
    RAIN: {
      SMOOTH: require('@/assets/sounds/smooth_rain.mp3'),
      DISTANT: require('@/assets/sounds/distant_rain.mp3'),
      GRAINY: require('@/assets/sounds/grainy_rain.mp3'),
      GLITCHY: require('@/assets/sounds/glitchy_rain.mp3'),
    },
    CAFÉ: {
      SMOOTH: require('@/assets/sounds/smooth_cafe.mp3'),
      DISTANT: require('@/assets/sounds/cafe_distant.mp3'),
      GRAINY: require('@/assets/sounds/grainy_cafe.mp3'),
      GLITCHY: require('@/assets/sounds/glitchy_cafe.mp3'),
    },
    WIND: {
      SMOOTH: require('@/assets/sounds/smooth_wind.mp3'),
      DISTANT: require('@/assets/sounds/distant_wind.mp3'),
      GRAINY: require('@/assets/sounds/grainy_wind.mp3'),
      GLITCHY: require('@/assets/sounds/glitchy_wind.mp3'),
    },
    NOISE: {
      // NOISE is generated procedurally, so these won't be used
      SMOOTH: null,
      DISTANT: null,
      GRAINY: null,
      GLITCHY: null,
    },
  };

  /**
   * Trim audio buffer to create seamless loop
   * Removes first and last 0.05 seconds to avoid clicks/pops
   */
  private trimBufferForSeamlessLoop(buffer: AudioBuffer): AudioBuffer {
    if (!this.audioContext) return buffer;

    const sampleRate = buffer.sampleRate;
    const trimStartSamples = Math.floor(sampleRate * 0.05); // 0.05 seconds from start
    const trimEndSamples = Math.floor(sampleRate * 0.05); // 0.05 seconds from end
    const originalLength = buffer.length;
    const newLength = originalLength - trimStartSamples - trimEndSamples;

    // Ensure we have enough samples to trim
    if (newLength <= 0 || newLength < sampleRate * 0.1) {
      console.warn('Buffer too short to trim, using original');
      return buffer;
    }

    // Create new buffer with trimmed length
    const trimmedBuffer = this.audioContext.createBuffer(
      buffer.numberOfChannels,
      newLength,
      sampleRate
    );

    // Copy trimmed data from each channel
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const originalData = buffer.getChannelData(channel);
      const trimmedData = trimmedBuffer.getChannelData(channel);
      
      // Copy from trimStartSamples to (originalLength - trimEndSamples)
      for (let i = 0; i < newLength; i++) {
        trimmedData[i] = originalData[trimStartSamples + i];
      }
    }

    return trimmedBuffer;
  }

  /**
   * Load audio sample for a sound type and texture
   * Caches the buffer for reuse
   */
  private async loadSample(soundType: SoundType, texture: TextureType): Promise<AudioBuffer | null> {
    // NOISE is generated procedurally, not from samples
    if (soundType === 'NOISE') {
      return null;
    }

    const cacheKey = `${soundType}_${texture}`;
    
    // Return cached buffer if available
    if (this.sampleBuffers.has(cacheKey)) {
      return this.sampleBuffers.get(cacheKey)!;
    }

    try {
      const assetPath = this.samplePaths[soundType][texture];
      if (!assetPath) {
        console.error(`No sample path for ${soundType} - ${texture}`);
        return null;
      }
      
      if (this.isWeb) {
        // For web: fetch and decode audio
        const asset = Asset.fromModule(assetPath);
        await asset.downloadAsync();
        
        const response = await fetch(asset.uri || asset.localUri || '');
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await this.audioContext!.decodeAudioData(arrayBuffer);
        
        // Trim buffer for seamless looping (remove first and last 0.05 seconds)
        const trimmedBuffer = this.trimBufferForSeamlessLoop(audioBuffer);
        
        this.sampleBuffers.set(cacheKey, trimmedBuffer);
        return trimmedBuffer;
      } else {
        // For native: we'll use expo-audio directly, so we don't need to decode here
        // Just return a placeholder - the native path will handle playback
        return null;
      }
    } catch (error) {
      console.error(`Error loading sample for ${soundType} - ${texture}:`, error);
      throw error;
    }
  }

  /**
   * Generate realistic audio based on sound type, intensity, and texture
   * Uses sample-based audio with real-time processing
   */
  async startAudio(config: AudioConfig): Promise<void> {
    await this.stopAudio();
    this.currentConfig = config;

    try {
      // Check if Web Audio API is available (web or React Native with polyfill)
      const hasWebAudio = typeof AudioContext !== 'undefined' || 
                         typeof (window as any)?.webkitAudioContext !== 'undefined' ||
                         (typeof global !== 'undefined' && (global as any).AudioContext);
      
      if (hasWebAudio) {
        // Use Web Audio API (web or React Native with support)
        const AudioContextClass = AudioContext || 
                                 (window as any)?.webkitAudioContext ||
                                 (global as any)?.AudioContext;
        
        if (AudioContextClass) {
          this.audioContext = new AudioContextClass();
          
          // Resume context if suspended (required for user interaction)
          if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
          }
          
          // Handle page visibility for web - resume audio when tab becomes visible
          if (this.isWeb && typeof document !== 'undefined') {
            this.setupPageVisibilityHandling();
          }
          
          await this.playSampleWithProcessing(config);
          return;
        }
      }
      
      // Fallback: For native platforms, use expo-audio with sample files
      if (!this.isWeb) {
        await this.playNativeSample(config);
        return;
      }
      
      // If we get here, Web Audio API is not available
      console.warn('Web Audio API not available. Audio will not play.');
      this.isPlaying = true;
    } catch (error) {
      console.error('Error starting audio:', error);
      // Still mark as playing for UI feedback
      this.isPlaying = true;
      throw error;
    }
  }

  /**
   * Setup page visibility handling for web to ensure audio continues in background
   */
  private setupPageVisibilityHandling(): void {
    if (!this.isWeb || typeof document === 'undefined') return;

    const handleVisibilityChange = async () => {
      if (!this.audioContext) return;

      if (document.hidden) {
        // Page is hidden - audio should continue playing (browser handles this)
        // But ensure context stays active
        if (this.audioContext.state === 'suspended') {
          try {
            await this.audioContext.resume();
          } catch (error) {
            console.warn('Could not resume audio context on visibility change:', error);
          }
        }
      } else {
        // Page is visible again - ensure audio context is running
        if (this.audioContext.state === 'suspended') {
          try {
            await this.audioContext.resume();
          } catch (error) {
            console.warn('Could not resume audio context when page visible:', error);
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Store handler for cleanup
    (this as any)._visibilityHandler = handleVisibilityChange;
  }

  /**
   * Play sample with real-time processing (Web Audio API)
   */
  private async playSampleWithProcessing(config: AudioConfig): Promise<void> {
    if (!this.audioContext) return;

    const { intensity, texture, soundType } = config;
    const intensityParams = this.getIntensityParams(intensity);

    // For NOISE, use procedural generation
    if (soundType === 'NOISE') {
      await this.generateNoiseSoundProcedural(texture, intensityParams);
      return;
    }

    // Load texture-specific sample
    const sampleBuffer = await this.loadSample(soundType, texture);
    if (!sampleBuffer) {
      console.error('Failed to load sample');
      return;
    }

    // Create main gain node for volume control
    this.gainNode = this.audioContext.createGain();
    this.gainNode.gain.value = intensityParams.volume;
    this.gainNode.connect(this.audioContext.destination);
    this.audioNodes.push(this.gainNode);

    // Create buffer source and loop
    const source = this.audioContext.createBufferSource();
    source.buffer = sampleBuffer;
    source.loop = true; // Ensure looping
    // Start from beginning (buffer is already trimmed for seamless loop)
    source.start(0, 0);
    this.audioNodes.push(source);

    // Apply texture-based processing (minimal since samples are already texture-specific)
    const processedNode = this.applyTextureProcessing(
      source,
      texture,
      intensityParams,
      soundType
    );

    // Connect to main gain
    processedNode.connect(this.gainNode);
    this.audioNodes.push(processedNode);

    this.isPlaying = true;
  }

  /**
   * Generate NOISE sound procedurally (not from samples)
   */
  private async generateNoiseSoundProcedural(
    texture: TextureType,
    intensityParams: ReturnType<typeof this.getIntensityParams>
  ): Promise<void> {
    if (!this.audioContext) return;

    // Use existing procedural noise generation
    const sourceNode = this.generateNoiseSound(texture, intensityParams);

    // Create main gain node for volume control
    this.gainNode = this.audioContext.createGain();
    this.gainNode.gain.value = intensityParams.volume;
    this.gainNode.connect(this.audioContext.destination);
    this.audioNodes.push(this.gainNode);

    // Connect noise source to gain
    sourceNode.connect(this.gainNode);
    this.audioNodes.push(sourceNode);

    this.isPlaying = true;
  }

  /**
   * Apply texture-based processing to audio node
   * Since samples are already texture-specific, we apply minimal processing
   * mainly for intensity-based adjustments
   */
  private applyTextureProcessing(
    sourceNode: AudioNode,
    texture: TextureType,
    intensityParams: ReturnType<typeof this.getIntensityParams>,
    soundType?: SoundType
  ): AudioNode {
    if (!this.audioContext) return sourceNode;

    let currentNode: AudioNode = sourceNode;

    // Apply intensity-based brightness control (low-pass filter)
    const lowPass = this.audioContext.createBiquadFilter();
    lowPass.type = 'lowpass';
    // Base cutoff varies by texture - samples are already filtered, so we just adjust brightness
    const baseCutoff = this.getTextureCutoff(texture, 12000, 8000);
    lowPass.frequency.value = baseCutoff * intensityParams.brightness;
    lowPass.Q.value = texture === 'GRAINY' ? 1.5 : 1;
    currentNode.connect(lowPass);
    currentNode = lowPass;
    this.audioNodes.push(lowPass);

    // Subtle LFO modulation for GLITCHY texture to add variation
    if (texture === 'GLITCHY' && soundType !== 'RAIN') {
      const lfo = this.audioContext.createOscillator();
      lfo.type = 'sawtooth';
      lfo.frequency.value = 0.2 * (0.5 + intensityParams.activityRate * 0.5);
      lfo.start();
      this.audioNodes.push(lfo);

      const lfoGain = this.audioContext.createGain();
      lfoGain.gain.value = 0.05 * (0.5 + intensityParams.modulationDepth);
      lfo.connect(lfoGain);
      this.audioNodes.push(lfoGain);

      const modulationGain = this.audioContext.createGain();
      modulationGain.gain.value = 1;
      lfoGain.connect(modulationGain.gain);
      currentNode.connect(modulationGain);
      currentNode = modulationGain;
      this.audioNodes.push(modulationGain);
    }

    return currentNode;
  }

  /**
   * Play sample on native platforms using expo-audio
   */
  private async playNativeSample(config: AudioConfig): Promise<void> {
    try {
      const { intensity, texture, soundType } = config;
      const intensityParams = this.getIntensityParams(intensity);

      // For NOISE, use procedural generation (fallback to generateNativeAudio)
      if (soundType === 'NOISE') {
        await this.generateNativeAudio(config);
        return;
      }

      // Load texture-specific asset
      const assetPath = this.samplePaths[soundType][texture];
      if (!assetPath) {
        console.error(`No sample path for ${soundType} - ${texture}`);
        this.isPlaying = true;
        return;
      }

      const asset = Asset.fromModule(assetPath);
      await asset.downloadAsync();

      // Create audio player with sample
      const uri = asset.localUri || asset.uri;
      if (!uri) {
        console.error('No URI for audio asset');
        this.isPlaying = true;
        return;
      }

      try {
        const player = createAudioPlayer(uri, {
          updateInterval: 100,
          keepAudioSessionActive: true, // Keep audio session active for background playback
        });
        player.loop = true; // Ensure looping
        player.volume = intensityParams.volume;
        player.play();
        
        this.expoAudioPlayer = player;
        this.isPlaying = true;
      } catch (error) {
        console.error('Error creating native audio player:', error);
        this.isPlaying = true;
      }
    } catch (error) {
      console.error('Error playing native sample:', error);
      this.isPlaying = true;
    }
  }

  /**
   * Generate audio for native platforms using expo-audio
   * Creates a longer audio buffer and loops it
   * @deprecated - Use playNativeSample instead
   */
  private async generateNativeAudio(config: AudioConfig): Promise<void> {
    try {
      // Generate a 5-second audio buffer
      const duration = 5; // seconds
      const sampleRate = 44100;
      const frameCount = sampleRate * duration;
      
      // Create audio buffer
      const buffer = new Float32Array(frameCount);
      
      // Generate noise based on sound type
      const { intensity, texture, soundType } = config;
      const intensityParams = this.getIntensityParams(intensity);
      
      // Generate noise data
      let noiseType: 'white' | 'pink' | 'brown' = 'pink';
      if (soundType === 'CAFÉ') noiseType = 'brown';
      else if (soundType === 'WIND' || soundType === 'NOISE') noiseType = 'white';
      
      // Generate noise samples
      if (noiseType === 'white') {
        for (let i = 0; i < frameCount; i++) {
          buffer[i] = (Math.random() * 2 - 1) * intensityParams.volume * 0.3;
        }
      } else if (noiseType === 'pink') {
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < frameCount; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          b3 = 0.86650 * b3 + white * 0.3104856;
          b4 = 0.55000 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.0168980;
          buffer[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11 * intensityParams.volume * 0.3;
          b6 = white * 0.115926;
        }
      } else if (noiseType === 'brown') {
        let lastOut = 0;
        for (let i = 0; i < frameCount; i++) {
          const white = Math.random() * 2 - 1;
          buffer[i] = ((lastOut + (0.02 * white)) / 1.02) * 3.5 * intensityParams.volume * 0.3;
          lastOut = buffer[i] / (3.5 * intensityParams.volume * 0.3);
        }
      }
      
      // Apply texture-based filtering
      if (soundType === 'NOISE') {
        // Texture-based filtering for NOISE
        if (texture === 'SMOOTH') {
          // Low-pass filter for smooth noise
          let lastSample = 0;
          for (let i = 0; i < frameCount; i++) {
            buffer[i] = lastSample * 0.85 + buffer[i] * 0.15;
            lastSample = buffer[i];
          }
        } else if (texture === 'DISTANT') {
          // Heavy low-pass for distant effect
          let lastSample = 0;
          for (let i = 0; i < frameCount; i++) {
            buffer[i] = lastSample * 0.95 + buffer[i] * 0.05;
            lastSample = buffer[i];
          }
        } else if (texture === 'GRAINY') {
          // Band-pass effect for grainy texture
          let lastSample = 0;
          let lastLastSample = 0;
          for (let i = 0; i < frameCount; i++) {
            // Simple band-pass approximation
            const filtered = buffer[i] - lastSample * 0.7 - lastLastSample * 0.2;
            lastLastSample = lastSample;
            lastSample = buffer[i];
            buffer[i] = filtered * 1.2;
          }
        } else if (texture === 'GLITCHY') {
          // Add variation for glitchy texture
          for (let i = 0; i < frameCount; i += 100) {
            const variation = 0.7 + Math.random() * 0.6;
            for (let j = 0; j < 100 && i + j < frameCount; j++) {
              buffer[i + j] *= variation;
            }
          }
        }
      } else if (soundType === 'RAIN') {
        // Simple high-pass: remove DC and low frequencies
        let lastSample = 0;
        for (let i = 0; i < frameCount; i++) {
          const filtered = buffer[i] - lastSample * 0.95;
          lastSample = buffer[i];
          buffer[i] = filtered;
        }
      } else if (soundType === 'CAFÉ') {
        // Simple low-pass: smooth the signal
        let lastSample = 0;
        for (let i = 0; i < frameCount; i++) {
          buffer[i] = lastSample * 0.9 + buffer[i] * 0.1;
          lastSample = buffer[i];
        }
      }
      
      // Convert Float32Array to base64 WAV for expo-audio
      const wavData = this.float32ArrayToWav(buffer, sampleRate);
      
      // For native platforms, we need to use a blob URL or file
      // Since expo-audio supports base64 data URIs, let's try that first
      const dataUri = `data:audio/wav;base64,${wavData}`;
      
      try {
        // Create and play audio with expo-audio
        const player = createAudioPlayer(dataUri, {
          updateInterval: 100,
          keepAudioSessionActive: true, // Keep audio session active for background playback
        });
        player.loop = true;
        player.volume = intensityParams.volume;
        player.play();
        
        this.expoAudioPlayer = player;
        this.isPlaying = true;
      } catch (error) {
        console.error('Error creating native audio player:', error);
        // Fallback: Try without data URI prefix
        try {
          const player = createAudioPlayer(wavData, {
            updateInterval: 100,
            keepAudioSessionActive: true, // Keep audio session active for background playback
          });
          player.loop = true;
          player.volume = intensityParams.volume;
          player.play();
          this.expoAudioPlayer = player;
          this.isPlaying = true;
        } catch (fallbackError) {
          console.error('Error with fallback audio player:', fallbackError);
          this.isPlaying = true; // Still mark as playing for UI
        }
      }
      this.isPlaying = true;
    } catch (error) {
      console.error('Error generating native audio:', error);
      this.isPlaying = true; // Still mark as playing for UI
    }
  }

  /**
   * Convert Float32Array to WAV format (base64)
   */
  private float32ArrayToWav(buffer: Float32Array, sampleRate: number): string {
    const length = buffer.length;
    const arrayBuffer = new ArrayBuffer(44 + length * 2);
    const view = new DataView(arrayBuffer);
    
    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length * 2, true);
    
    // Convert float samples to 16-bit PCM
    let offset = 44;
    for (let i = 0; i < length; i++) {
      const sample = Math.max(-1, Math.min(1, buffer[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }
    
    // Convert to base64
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Generate realistic procedural audio
   */
  private async generateRealisticAudio(config: AudioConfig): Promise<void> {
    if (!this.audioContext) return;

    const { intensity, texture, soundType } = config;
    
    // Calculate multi-parameter intensity values
    const intensityParams = this.getIntensityParams(intensity);

    // Create main gain node for volume control (logarithmic curve)
    this.gainNode = this.audioContext.createGain();
    this.gainNode.gain.value = intensityParams.volume;
    this.gainNode.connect(this.audioContext.destination);
    this.audioNodes.push(this.gainNode);

    // Generate sound based on type (pass intensity params)
    let sourceNode: AudioNode;

    switch (soundType) {
      case 'RAIN':
        sourceNode = this.generateRainSound(texture, intensityParams);
        break;
      case 'CAFÉ':
        sourceNode = this.generateCafeSound(texture, intensityParams);
        break;
      case 'WIND':
        sourceNode = this.generateWindSound(texture, intensityParams);
        break;
      case 'NOISE':
        sourceNode = this.generateNoiseSound(texture, intensityParams);
        break;
      default:
        sourceNode = this.generateNoiseSound(texture, intensityParams);
    }

    // Connect to main gain and output
    sourceNode.connect(this.gainNode);
    this.audioNodes.push(sourceNode);

    this.isPlaying = true;
  }

  /**
   * Calculate multi-parameter intensity values
   * Intensity affects volume, density, frequency range, modulation, brightness, and activity rate
   */
  private getIntensityParams(intensity: number): {
    volume: number;
    density: number;
    frequencyRange: number;
    modulationDepth: number;
    brightness: number;
    activityRate: number;
  } {
    const normalized = intensity / 100;
    
    return {
      // Volume with logarithmic curve for natural perception
      volume: Math.pow(normalized, 0.7),
      
      // Density (0-1) - how much activity is happening
      density: normalized,
      
      // Frequency range multiplier (0.5x to 1.0x)
      frequencyRange: 0.5 + (normalized * 0.5),
      
      // Modulation depth (0 to 0.8)
      modulationDepth: normalized * 0.8,
      
      // Brightness - filter cutoff multiplier (0.6x to 1.0x)
      brightness: 0.6 + (normalized * 0.4),
      
      // Activity rate - for drops, gusts, etc. (0.3x to 1.0x)
      activityRate: 0.3 + (normalized * 0.7),
    };
  }

  /**
   * Create noise buffer (white, pink, or brown)
   */
  private createNoiseBuffer(
    type: 'white' | 'pink' | 'brown',
    duration: number = 2,
    sampleRate: number
  ): AudioBuffer {
    const frameCount = sampleRate * duration;
    const buffer = this.audioContext!.createBuffer(1, frameCount, sampleRate);
    const data = buffer.getChannelData(0);
    
    if (type === 'white') {
      // Pure white noise - flat frequency spectrum
      for (let i = 0; i < frameCount; i++) {
        data[i] = Math.random() * 2 - 1;
      }
    } else if (type === 'pink') {
      // Pink noise: -3dB per octave (sounds more natural)
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < frameCount; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
        data[i] *= 0.11; // Adjust gain
        b6 = white * 0.115926;
      }
    } else if (type === 'brown') {
      // Brown noise: -6dB per octave (warmer, lower frequencies)
      let lastOut = 0;
      for (let i = 0; i < frameCount; i++) {
        const white = Math.random() * 2 - 1;
        data[i] = (lastOut + (0.02 * white)) / 1.02;
        lastOut = data[i];
        data[i] *= 3.5; // Adjust gain
      }
    }
    
    return buffer;
  }

  /**
   * Generate RAIN sound: filtered pink noise with randomized drop events
   * Intensity affects: drop frequency, drop intensity, number of layers, filter brightness
   */
  private generateRainSound(
    texture: TextureType,
    intensityParams: ReturnType<typeof this.getIntensityParams>
  ): AudioNode {
    // Create pink noise buffer (sounds more natural than white)
    const noiseBuffer = this.createNoiseBuffer('pink', 2, this.audioContext!.sampleRate);
    const source = this.audioContext!.createBufferSource();
    source.buffer = noiseBuffer;
    source.loop = true;
    source.start();
    this.audioNodes.push(source);

    // High-pass filter for water texture (removes low rumble)
    const highPass = this.audioContext!.createBiquadFilter();
    highPass.type = 'highpass';
    highPass.frequency.value = texture === 'DISTANT' ? 150 : 200;
    highPass.Q.value = 1;
    source.connect(highPass);
    this.audioNodes.push(highPass);

    // Low-pass filter for distance effect - brightness scales with intensity
    const lowPass = this.audioContext!.createBiquadFilter();
    lowPass.type = 'lowpass';
    const baseCutoff = this.getTextureCutoff(texture, 3000, 1500);
    lowPass.frequency.value = baseCutoff * intensityParams.brightness;
    lowPass.Q.value = 1;
    highPass.connect(lowPass);
    this.audioNodes.push(lowPass);

    // Create multiple rain layers at higher intensity
    const layerCount = 1 + Math.floor(intensityParams.density * 3); // 1-4 layers
    const layerMixer = this.audioContext!.createGain();
    layerMixer.gain.value = 1 / layerCount; // Normalize for multiple layers
    
    // Create layers
    for (let i = 0; i < layerCount; i++) {
      const layerGain = this.audioContext!.createGain();
      layerGain.gain.value = 1;
      
      // Slight frequency variation per layer
      const layerFilter = this.audioContext!.createBiquadFilter();
      layerFilter.type = 'lowpass';
      layerFilter.frequency.value = lowPass.frequency.value * (0.9 + (i * 0.05));
      layerFilter.Q.value = 1;
      
      lowPass.connect(layerFilter);
      layerFilter.connect(layerGain);
      layerGain.connect(layerMixer);
      this.audioNodes.push(layerFilter, layerGain);
    }

    // Drop modulation gain (for randomized drop events)
    const dropGain = this.audioContext!.createGain();
    dropGain.gain.value = 1;
    layerMixer.connect(dropGain);
    this.audioNodes.push(layerMixer, dropGain);

    // Create drop events (rain drops) - frequency scales with intensity
    this.createDropModulation(dropGain, texture, intensityParams);

    return dropGain;
  }

  /**
   * Generate CAFÉ sound: brown noise with subtle LFO modulation
   * Intensity affects: number of activity layers, LFO speed, modulation depth
   */
  private generateCafeSound(
    texture: TextureType,
    intensityParams: ReturnType<typeof this.getIntensityParams>
  ): AudioNode {
    // Create brown noise (warm, low-frequency emphasis)
    const noiseBuffer = this.createNoiseBuffer('brown', 2, this.audioContext!.sampleRate);
    const source = this.audioContext!.createBufferSource();
    source.buffer = noiseBuffer;
    source.loop = true;
    source.start();
    this.audioNodes.push(source);

    // Low-pass filter for warmth - brightness scales with intensity
    const lowPass = this.audioContext!.createBiquadFilter();
    lowPass.type = 'lowpass';
    const baseCutoff = this.getTextureCutoff(texture, 1500, 800);
    lowPass.frequency.value = baseCutoff * intensityParams.brightness;
    lowPass.Q.value = 0.7;
    source.connect(lowPass);
    this.audioNodes.push(lowPass);

    // Create multiple activity layers at higher intensity
    const layerCount = 1 + Math.floor(intensityParams.density * 4); // 1-5 layers
    const layerMixer = this.audioContext!.createGain();
    layerMixer.gain.value = 1 / layerCount;

    // Create layers with slight variations
    for (let i = 0; i < layerCount; i++) {
      const layerFilter = this.audioContext!.createBiquadFilter();
      layerFilter.type = 'lowpass';
      layerFilter.frequency.value = lowPass.frequency.value * (0.95 + (i * 0.02));
      layerFilter.Q.value = 0.7;
      
      // Subtle LFO for movement (speed increases with intensity)
      const lfo = this.audioContext!.createOscillator();
      lfo.type = texture === 'GLITCHY' ? 'sawtooth' : 'sine';
      const baseLfoSpeed = texture === 'GLITCHY' ? 0.3 : 
                          texture === 'SMOOTH' ? 0.3 : 0.5;
      lfo.frequency.value = baseLfoSpeed * (0.5 + intensityParams.activityRate * 0.5);
      lfo.start();
      this.audioNodes.push(lfo);

      const lfoGain = this.audioContext!.createGain();
      const baseModulation = texture === 'SMOOTH' ? 0.05 : 
                            texture === 'GLITCHY' ? 0.15 : 0.1;
      lfoGain.gain.value = baseModulation * (0.5 + intensityParams.modulationDepth);
      lfo.connect(lfoGain);
      this.audioNodes.push(lfoGain);

      // Modulation gain for this layer
      const modulationGain = this.audioContext!.createGain();
      modulationGain.gain.value = 1;
      lfoGain.connect(modulationGain.gain);
      
      lowPass.connect(layerFilter);
      layerFilter.connect(modulationGain);
      modulationGain.connect(layerMixer);
      this.audioNodes.push(layerFilter, modulationGain);
    }

    this.audioNodes.push(layerMixer);
    return layerMixer;
  }

  /**
   * Generate WIND sound: filtered white noise with low-frequency gust modulation
   * Intensity affects: gust frequency, gust strength, frequency spread
   */
  private generateWindSound(
    texture: TextureType,
    intensityParams: ReturnType<typeof this.getIntensityParams>
  ): AudioNode {
    // Create white noise
    const noiseBuffer = this.createNoiseBuffer('white', 2, this.audioContext!.sampleRate);
    const source = this.audioContext!.createBufferSource();
    source.buffer = noiseBuffer;
    source.loop = true;
    source.start();
    this.audioNodes.push(source);

    // Band-pass filter for air movement - frequency range scales with intensity
    const bandPass = this.audioContext!.createBiquadFilter();
    bandPass.type = 'bandpass';
    const baseFreq = texture === 'DISTANT' ? 300 : 500;
    bandPass.frequency.value = baseFreq * intensityParams.frequencyRange;
    bandPass.Q.value = texture === 'GRAINY' ? 2.0 : 1.5;
    source.connect(bandPass);
    this.audioNodes.push(bandPass);

    // Create multiple wind layers at higher intensity
    const layerCount = 1 + Math.floor(intensityParams.density * 2); // 1-3 layers
    const layerMixer = this.audioContext!.createGain();
    layerMixer.gain.value = 1 / layerCount;

    for (let i = 0; i < layerCount; i++) {
      const layerFilter = this.audioContext!.createBiquadFilter();
      layerFilter.type = 'bandpass';
      layerFilter.frequency.value = bandPass.frequency.value * (0.9 + (i * 0.1));
      layerFilter.Q.value = bandPass.Q.value;

      // Low-frequency modulation for gusts - frequency increases with intensity
      const gustLFO = this.audioContext!.createOscillator();
      gustLFO.type = texture === 'GLITCHY' ? 'sawtooth' : 'sine';
      const baseGustSpeed = texture === 'SMOOTH' ? 0.1 : 
                            texture === 'GLITCHY' ? 0.4 : 0.3;
      gustLFO.frequency.value = baseGustSpeed * (0.5 + intensityParams.activityRate * 0.5);
      gustLFO.start();
      this.audioNodes.push(gustLFO);

      const gustGain = this.audioContext!.createGain();
      const baseGustStrength = texture === 'DISTANT' ? 0.3 : 
                               texture === 'GLITCHY' ? 0.6 : 0.5;
      gustGain.gain.value = baseGustStrength * (0.5 + intensityParams.modulationDepth);
      gustLFO.connect(gustGain);
      this.audioNodes.push(gustGain);

      // Gust modulation gain for this layer
      const gustModulation = this.audioContext!.createGain();
      gustModulation.gain.value = 1;
      gustGain.connect(gustModulation.gain);
      
      bandPass.connect(layerFilter);
      layerFilter.connect(gustModulation);
      gustModulation.connect(layerMixer);
      this.audioNodes.push(layerFilter, gustModulation);
    }

    this.audioNodes.push(layerMixer);
    return layerMixer;
  }

  /**
   * Generate NOISE sound: texture-based noise type selection
   * Intensity affects: frequency layers, spectral density, brightness
   */
  private generateNoiseSound(
    texture: TextureType,
    intensityParams: ReturnType<typeof this.getIntensityParams>
  ): AudioNode {
    // Select noise type based on texture
    const noiseType = texture === 'SMOOTH' ? 'pink' : 
                      texture === 'DISTANT' ? 'brown' : 'white';
    
    const noiseBuffer = this.createNoiseBuffer(noiseType, 2, this.audioContext!.sampleRate);
    const source = this.audioContext!.createBufferSource();
    source.buffer = noiseBuffer;
    source.loop = true;
    source.start();
    this.audioNodes.push(source);

    // Create multiple frequency layers at higher intensity
    const layerCount = 1 + Math.floor(intensityParams.density * 3); // 1-4 layers
    const layerMixer = this.audioContext!.createGain();
    layerMixer.gain.value = 1 / layerCount;

    for (let i = 0; i < layerCount; i++) {
      let layerSource: AudioBufferSourceNode;
      
      // Vary noise type slightly per layer for texture
      if (i === 0) {
        layerSource = source; // Use main source for first layer
      } else {
        const layerBuffer = this.createNoiseBuffer(noiseType, 2, this.audioContext!.sampleRate);
        layerSource = this.audioContext!.createBufferSource();
        layerSource.buffer = layerBuffer;
        layerSource.loop = true;
        layerSource.start();
        this.audioNodes.push(layerSource);
      }

      // Optional filtering - brightness scales with intensity
      if (texture === 'DISTANT' || intensityParams.brightness < 1) {
        const lowPass = this.audioContext!.createBiquadFilter();
        lowPass.type = 'lowpass';
        const cutoff = texture === 'DISTANT' ? 2000 : 8000;
        lowPass.frequency.value = cutoff * intensityParams.brightness;
        lowPass.Q.value = 1;
        layerSource.connect(lowPass);
        this.audioNodes.push(lowPass);
        
        // For GLITCHY, add variation
        if (texture === 'GLITCHY') {
          const glitchGain = this.audioContext!.createGain();
          glitchGain.gain.value = 1;
          
          // Random gain variations - more frequent at higher intensity
          const glitchInterval = setInterval(() => {
            if (!this.isPlaying) {
              clearInterval(glitchInterval);
              return;
            }
            const now = this.audioContext!.currentTime;
            const variation = 0.7 + Math.random() * 0.6; // 0.7 to 1.3
            glitchGain.gain.setValueAtTime(variation, now);
          }, (200 + Math.random() * 300) / intensityParams.activityRate); // Faster at higher intensity
          
          lowPass.connect(glitchGain);
          glitchGain.connect(layerMixer);
          this.audioNodes.push(glitchGain);
        } else {
          lowPass.connect(layerMixer);
        }
      } else if (texture === 'GLITCHY') {
        const glitchGain = this.audioContext!.createGain();
        glitchGain.gain.value = 1;
        
        const glitchInterval = setInterval(() => {
          if (!this.isPlaying) {
            clearInterval(glitchInterval);
            return;
          }
          const now = this.audioContext!.currentTime;
          const variation = 0.7 + Math.random() * 0.6;
          glitchGain.gain.setValueAtTime(variation, now);
        }, (200 + Math.random() * 300) / intensityParams.activityRate);
        
        layerSource.connect(glitchGain);
        glitchGain.connect(layerMixer);
        this.audioNodes.push(glitchGain);
      } else {
        layerSource.connect(layerMixer);
      }
    }

    this.audioNodes.push(layerMixer);
    return layerMixer;
  }

  /**
   * Get filter cutoff frequency based on texture
   */
  private getTextureCutoff(
    texture: TextureType, 
    smoothValue: number, 
    distantValue: number
  ): number {
    switch (texture) {
      case 'SMOOTH':
        return smoothValue;
      case 'DISTANT':
        return distantValue;
      case 'GRAINY':
        return smoothValue * 0.8; // Slightly lower for texture
      case 'GLITCHY':
        // Dynamic - varies over time
        return smoothValue * (0.8 + Math.random() * 0.4); // 0.8x to 1.2x
      default:
        return smoothValue;
    }
  }

  /**
   * Create drop modulation for rain (randomized drop events)
   * Intensity affects: drop frequency and drop intensity
   */
  private createDropModulation(
    gainNode: GainNode, 
    texture: TextureType,
    intensityParams: ReturnType<typeof this.getIntensityParams>
  ): void {
    // Clear any existing interval
    if (this.dropIntervalId) {
      clearInterval(this.dropIntervalId);
    }

    const getInterval = () => {
      // Base intervals vary by texture
      let baseMin: number, baseMax: number;
      if (texture === 'GLITCHY') {
        baseMin = 100;
        baseMax = 500;
      } else if (texture === 'SMOOTH') {
        baseMin = 300;
        baseMax = 500;
      } else if (texture === 'DISTANT') {
        baseMin = 400;
        baseMax = 700;
      } else {
        baseMin = 200;
        baseMax = 450;
      }
      
      // Scale interval based on intensity (higher intensity = faster drops)
      // At 0%: full interval, at 100%: 30% of interval (much faster)
      const minInterval = baseMin * (0.3 + (1 - intensityParams.activityRate) * 0.7);
      const maxInterval = baseMax * (0.3 + (1 - intensityParams.activityRate) * 0.7);
      
      return Math.random() * (maxInterval - minInterval) + minInterval;
    };

    const scheduleDrop = () => {
      if (!this.isPlaying || !this.audioContext) {
        return;
      }

      const now = this.audioContext.currentTime;
      
      // Drop intensity scales with overall intensity
      // At low intensity: subtle drops (0.85-1.0)
      // At high intensity: strong drops (0.5-1.0)
      const baseDropIntensity = texture === 'GLITCHY' ? 
        0.5 + Math.random() * 0.5 : // 0.5-1.0
        0.7 + Math.random() * 0.3;  // 0.7-1.0
      
      // Scale based on intensity (more intense drops at higher intensity)
      const dropIntensity = 1 - ((1 - baseDropIntensity) * (0.3 + intensityParams.density * 0.7));

      // Create drop envelope (quick dip and recovery)
      gainNode.gain.setValueAtTime(1, now);
      gainNode.gain.exponentialRampToValueAtTime(dropIntensity, now + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(1, now + 0.15);
    };

    // Schedule first drop
    scheduleDrop();
    
    // Schedule recurring drops
    const scheduleNext = () => {
      if (!this.isPlaying) return;
      const nextInterval = getInterval();
      this.dropIntervalId = setTimeout(() => {
        scheduleDrop();
        scheduleNext();
      }, nextInterval) as unknown as NodeJS.Timeout;
    };

    scheduleNext();
  }

  async updateVolume(intensity: number): Promise<void> {
    // Use logarithmic volume curve for natural perception
    const intensityParams = this.getIntensityParams(intensity);
    const volume = intensityParams.volume;
    
    // Update Web Audio API gain node (web)
    if (this.gainNode && this.audioContext) {
      this.gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
    }
    
    // Update expo-audio player volume (native)
    if (this.expoAudioPlayer) {
      try {
        this.expoAudioPlayer.volume = volume;
      } catch (error) {
        console.error('Error updating native audio volume:', error);
      }
    }
    
    // Update current config
    if (this.currentConfig) {
      this.currentConfig.intensity = intensity;
    }
    
    // Note: For full intensity parameter updates (density, brightness, etc.),
    // we would need to restart the audio. For now, we update volume in real-time
    // which provides smooth control. Full parameter updates happen on texture/sound change.
  }

  async updateTexture(texture: TextureType): Promise<void> {
    if (this.currentConfig && this.isPlaying) {
      this.currentConfig.texture = texture;
      // Restart audio with new texture
      await this.startAudio(this.currentConfig);
    }
  }

  async updateSoundType(soundType: SoundType): Promise<void> {
    if (this.currentConfig && this.isPlaying) {
      this.currentConfig.soundType = soundType;
      // Restart audio with new sound type
      await this.startAudio(this.currentConfig);
    }
  }

  async stopAudio(): Promise<void> {
    // Clear drop interval
    if (this.dropIntervalId) {
      clearInterval(this.dropIntervalId);
      this.dropIntervalId = null;
    }

    // Remove page visibility handler (web)
    if (this.isWeb && typeof document !== 'undefined' && (this as any)._visibilityHandler) {
      document.removeEventListener('visibilitychange', (this as any)._visibilityHandler);
      (this as any)._visibilityHandler = null;
    }

    // Stop expo-audio player (native)
    if (this.expoAudioPlayer) {
      try {
        this.expoAudioPlayer.pause();
        this.expoAudioPlayer.replace(null); // Clear source
      } catch (error) {
        // Player might already be stopped
      }
      this.expoAudioPlayer = null;
    }

    // Stop all audio nodes (web)
    this.audioNodes.forEach((node) => {
      try {
        if (node instanceof AudioBufferSourceNode) {
          node.stop();
          node.disconnect();
        } else if (node instanceof OscillatorNode) {
          node.stop();
          node.disconnect();
        } else {
          node.disconnect();
        }
      } catch (error) {
        // Node might already be stopped/disconnected
      }
    });
    this.audioNodes = [];

    // Close audio context (web)
    if (this.audioContext && this.audioContext.state !== 'closed') {
      await this.audioContext.close();
      this.audioContext = null;
    }

    // Cancel animation frame if any
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    this.gainNode = null;
    this.isPlaying = false;
  }

  getIsPlaying(): boolean {
    return this.isPlaying;
  }
}

export const audioService = new AudioService();
