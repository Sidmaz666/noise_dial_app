import { AppHeader } from '@/components/app-header';
import { NoiseDial } from '@/components/noise-dial';
import type { SoundType } from '@/components/sound-selector';
import { SoundSelector } from '@/components/sound-selector';
import { SoundBackground } from '@/components/SoundBackground';
import type { TextureType } from '@/components/texture-selector';
import { TextureSelector } from '@/components/texture-selector';
import { useTheme, type ColorScheme } from '@/constants/themes';
import { audioService } from '@/services/audio-service';
import { feedbackService } from '@/services/feedback-service';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function NoiseDialScreen() {
  const [intensity, setIntensity] = useState(50);
  const [texture, setTexture] = useState<TextureType>('DISTANT');
  const [soundType, setSoundType] = useState<SoundType>('RAIN');
  const [isPlaying, setIsPlaying] = useState(false);
  const [timerMinutes, setTimerMinutes] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [currentTip, setCurrentTip] = useState<string>('');
  const tipIndexRef = React.useRef(0);
  
  // Get color scheme and theme
  const systemColorScheme = useColorScheme();
  const colorScheme: ColorScheme = systemColorScheme || 'dark';
  const theme = useTheme(soundType, colorScheme);

  useEffect(() => {
    return () => {
      audioService.stopAudio();
    };
  }, []);

  useEffect(() => {
    if (isPlaying) {
      audioService.updateVolume(intensity);
    }
  }, [intensity, isPlaying]);

  useEffect(() => {
    if (isPlaying) {
      audioService.startAudio({ intensity, texture, soundType });
    }
  }, [texture, soundType, isPlaying]);

  // Timer countdown
  useEffect(() => {
    if (timeRemaining !== null && timeRemaining > 0 && isPlaying) {
      const timer = setTimeout(() => {
        setTimeRemaining((prev) => {
          if (prev !== null && prev > 0) {
            return prev - 1;
          }
          return prev;
        });
      }, 1000);
      return () => clearTimeout(timer);
    } else if (timeRemaining === 0 && isPlaying) {
      // Timer reached 0 - stop audio
      audioService.stopAudio();
      setIsPlaying(false);
      setTimeRemaining(null);
      setTimerMinutes(null);
      feedbackService.trigger('stop');
    }
  }, [timeRemaining, isPlaying]);

  const handleIntensityChange = useCallback((value: number) => {
    setIntensity(Math.round(value));
    // Haptic feedback removed from here - too frequent during dragging
  }, []);

  const handleDragStart = useCallback(() => {
    setIsDragging(true);
    // Show first tip immediately
    setCurrentTip(tips[0]);
    feedbackService.trigger('dial_touch');
  }, []);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    setCurrentTip('');
    feedbackService.trigger('dial_release');
  }, []);

  // Tips for dial interaction - updated to reflect smooth dragging
  const tips = [
    'Drag the knob to adjust intensity',
    'Swipe up or down to change value',
    'Drag smoothly for precise control',
    'Rotate clockwise to increase',
  ];

  // Rotate tips while dragging
  useEffect(() => {
    if (!isDragging) {
      setCurrentTip('');
      tipIndexRef.current = 0;
      return;
    }

    // Show first tip immediately
    tipIndexRef.current = 0;
    setCurrentTip(tips[0]);

    const interval = setInterval(() => {
      tipIndexRef.current = (tipIndexRef.current + 1) % tips.length;
      setCurrentTip(tips[tipIndexRef.current]);
    }, 2000); // Change tip every 2 seconds

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDragging]);

  const handleTextureChange = useCallback((newTexture: TextureType) => {
    setTexture(newTexture);
    feedbackService.trigger('texture');
  }, []);

  const handleSoundChange = useCallback((newSound: SoundType) => {
    setSoundType(newSound);
    feedbackService.trigger('sound');
  }, []);

  const handlePlayPress = useCallback(async () => {
    if (isPlaying) {
      await audioService.stopAudio();
      setIsPlaying(false);
      setTimeRemaining(null);
      feedbackService.trigger('stop');
    } else {
      try {
        await audioService.startAudio({ intensity, texture, soundType });
        setIsPlaying(true);
        feedbackService.trigger('play');
        
        if (timerMinutes !== null) {
          setTimeRemaining(timerMinutes * 60);
        }
      } catch (error) {
        console.error('Error starting audio:', error);
        setIsPlaying(true);
      }
    }
  }, [isPlaying, intensity, texture, soundType, timerMinutes]);

  const handleTimerPress = useCallback(() => {
    
    // Timer options: 5min, 15min, 30min, 60min, 90min (1.5h), 120min (2h), 150min (2.5h), 180min (3h), 210min (3.5h), 240min (4h)
    const timerOptions = [5, 15, 30, 60, 90, 120, 150, 180, 210, 240];
    
    if (timerMinutes === null) {
      // Start with 5 minutes
      setTimerMinutes(5);
      setTimeRemaining(5 * 60);
      feedbackService.trigger('timer');
    } else {
      // Find current index and move to next
      const currentIndex = timerOptions.indexOf(timerMinutes);
      if (currentIndex !== -1 && currentIndex < timerOptions.length - 1) {
        // Move to next option
        const nextMinutes = timerOptions[currentIndex + 1];
        setTimerMinutes(nextMinutes);
        setTimeRemaining(nextMinutes * 60);
        feedbackService.trigger('timer');
      } else {
        // Reset to null (turn off timer)
        setTimerMinutes(null);
        setTimeRemaining(null);
        feedbackService.trigger('timer_off');
      }
    }
  }, [timerMinutes]);

  return (
    <LinearGradient
      colors={theme.backgroundGradient}
      style={styles.container}>
      {/* Per-sound-mode animated background */}
      <SoundBackground soundType={soundType} theme={theme} intensity={intensity} />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {/* Header */}
        <AppHeader 
          isPlaying={isPlaying} 
          onPlayPress={handlePlayPress} 
          onTimerPress={handleTimerPress}
          timerMinutes={timerMinutes}
          timeRemaining={timeRemaining}
          theme={theme}
        />
        
        {/* Intensity Display - Right after header */}
        <View style={styles.intensityContainer}>
          <Text style={[styles.intensityValue, { color: theme.textPrimary }]}>{intensity}%</Text>
          <Text 
            style={[styles.intensityLabel, { color: theme.textSecondary }]}
            numberOfLines={2}
            adjustsFontSizeToFit={true}
            minimumFontScale={0.8}>
            {isDragging && currentTip ? currentTip : 'INTENSITY'}
          </Text>
        </View>
        
        {/* Main Content - No ScrollView, everything fits on one page */}
        <View style={styles.mainContent}>

          {/* Dial */}
          <View style={styles.dialContainer}>
            <NoiseDial 
              intensity={intensity} 
              onIntensityChange={handleIntensityChange}
              hasTimer={timerMinutes !== null && timeRemaining !== null && timeRemaining > 0}
              timeRemaining={timeRemaining}
              theme={theme}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            />
          </View>

          {/* Texture Selector - Compact 2x2 Grid */}
          <View style={styles.textureContainer}>
            <TextureSelector
              selectedTexture={texture}
              onTextureChange={handleTextureChange}
              theme={theme}
            />
          </View>
        </View>

        {/* Sound Selector - Fixed at bottom */}
        <View style={styles.soundSelectorContainer}>
          <SoundSelector 
            selectedSound={soundType} 
            onSoundChange={handleSoundChange}
            theme={theme}
          />
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  mainContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  intensityContainer: {
    alignItems: 'center',
    marginTop: 8, // Minimal gap from header
    paddingBottom: 35, // Reduced gap before dial
    paddingHorizontal: 24, // Prevent overflow
    width: '100%',
  },
  intensityValue: {
    fontSize: 64,
    fontWeight: '200',
    letterSpacing: -2,
    textAlign: 'center',
  },
  intensityLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5, // Reduced letter spacing to prevent overflow
    textTransform: 'uppercase',
    marginTop: 8,
    textAlign: 'center',
    maxWidth: '90%', // Prevent overflow
    paddingHorizontal: 16,
  },
  dialContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    minHeight: 200,
    marginBottom: 40,
    marginTop: 0, // No top margin, spacing handled by intensityContainer
  },
  textureContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 8,
    marginTop: 20,
  },
  soundSelectorContainer: {
    width: '100%',
    paddingBottom: 16,
    paddingTop: 8,
    alignItems: 'center',
  },
});
