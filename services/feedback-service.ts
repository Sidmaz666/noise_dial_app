import * as Haptics from 'expo-haptics';
import { createAudioPlayer } from 'expo-audio';

class FeedbackService {
  // Pre-generated short WAV buffers (base64)
  private CLICK_LOW: string = ''; // The unified sound for buttons
  private CHIME_DOWN: string = '';
  private DIAL_TOUCH: string = '';
  private DIAL_RELEASE: string = '';

  constructor() {
    // Unified "Thud" sound (Low pitch, 40% vol) for all buttons
    this.CLICK_LOW = this.generateBeep(440, 0.05, 0.4);  
    
    // Other sounds kept distinct for specific actions
    this.CHIME_DOWN = this.generateChime(false, 0.5);    // Stop/Timer Off
    this.DIAL_TOUCH = this.generateBeep(220, 0.03, 0.4); // Dial Touch
    this.DIAL_RELEASE = this.generateBeep(330, 0.03, 0.4); // Dial Release
  }

  // --- WAV Generation Helpers ---

  private generateBeep(freq: number, duration: number, volume: number = 0.5): string {
    const sampleRate = 44100;
    const numSamples = Math.floor(sampleRate * duration);
    const dataSize = numSamples; // 8-bit mono
    const fileSize = 36 + dataSize;

    const buffer = new Uint8Array(44 + dataSize);
    const view = new DataView(buffer.buffer);

    // RIFF Header
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, fileSize, true);
    this.writeString(view, 8, 'WAVE');
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate, true); 
    view.setUint16(32, 1, true); 
    view.setUint16(34, 8, true); 

    this.writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    // Data
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const val = Math.sin(2 * Math.PI * freq * t);
      const envelope = 1 - (i / numSamples);
      buffer[44 + i] = Math.floor(((val * volume * envelope + 1) / 2) * 255);
    }

    return this.toBase64(buffer);
  }

  private generateChime(up: boolean, volume: number = 0.5): string {
    const sampleRate = 44100;
    const duration = 0.15;
    const numSamples = Math.floor(sampleRate * duration);
    const dataSize = numSamples;
    const buffer = new Uint8Array(44 + dataSize);
    const view = new DataView(buffer.buffer);

    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    this.writeString(view, 8, 'WAVE');
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate, true);
    view.setUint16(32, 1, true);
    view.setUint16(34, 8, true);
    this.writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    const startFreq = up ? 440 : 880;
    const endFreq = up ? 880 : 440;

    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const progress = i / numSamples;
      const currentFreq = startFreq + (endFreq - startFreq) * progress;
      const val = Math.sin(2 * Math.PI * currentFreq * t);
      const envelope = 1 - Math.pow(progress, 2); 
      buffer[44 + i] = Math.floor(((val * volume * envelope + 1) / 2) * 255);
    }

    return this.toBase64(buffer);
  }

  private writeString(view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  private toBase64(buffer: Uint8Array): string {
    let binary = '';
    const len = buffer.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(buffer[i]);
    }
    return btoa(binary);
  }

  // --- Public API ---

  async trigger(type: 'texture' | 'sound' | 'play' | 'stop' | 'timer' | 'timer_off' | 'dial_touch' | 'dial_release') {
    try {
      let b64 = '';
      
      switch (type) {
        case 'texture':
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          b64 = this.CLICK_LOW; // Unified sound
          break;
        case 'sound':
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          b64 = this.CLICK_LOW; // Unified sound
          break;
        case 'play':
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          b64 = this.CLICK_LOW; // Unified sound (was CHIME_UP)
          break;
        case 'timer':
          await Haptics.selectionAsync();
          b64 = this.CLICK_LOW; // Unified sound (was CHIME_UP)
          break;
        // Keep unique sounds for stopping/off events? User said "play and timer button".
        // Usually "off" or "stop" might warrant a different feedback, but user implies BUTTON presses.
        // The "timer_off" event is auto-triggered, so maybe keep CHIME_DOWN for that?
        // User said: "use that sound effect for the play and timer button and for the texture cards".
        // I will interpret this as BUTTON interactions.
        // Stop button (Play button in stop mode) -> CLICK_LOW.
        case 'stop':
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          b64 = this.CLICK_LOW; // Unified sound
          break;
        case 'timer_off':
          // Auto-off event (not a button press) -> Keep distinct or unify?
          // Let's keep distinct CHIME_DOWN for auto-events to distinguish from user action.
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          b64 = this.CHIME_DOWN; 
          break;
        case 'dial_touch':
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          b64 = this.DIAL_TOUCH;
          break;
        case 'dial_release':
           await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
           b64 = this.DIAL_RELEASE;
           break;
      }

      if (b64) {
        const uri = `data:audio/wav;base64,${b64}`;
        try {
            const player = createAudioPlayer(uri);
            player.play();
        } catch (e) {
            console.warn('Failed to play feedback sound', e);
        }
      }
    } catch (error) {
      console.warn('Feedback error:', error);
    }
  }
}

export const feedbackService = new FeedbackService();
