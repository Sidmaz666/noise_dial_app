import type { ThemeColors } from '@/constants/themes';
import React, { useEffect, useMemo } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import type { SoundType } from './sound-selector';

const { width, height } = Dimensions.get('window');

// Create Animated Path for SVG
const AnimatedPath = Animated.createAnimatedComponent(Path);

interface SoundBackgroundProps {
  soundType: SoundType;
  theme: ThemeColors;
  intensity: number; // 0–100
}

// --- Particle Components ---

// RAIN: Thick Slanted Bars (Wireframe Style)
// Motion: Top-Right to Bottom-Left
const RainParticle = React.memo(({ index, theme, intensitySv }: { index: number; theme: ThemeColors; intensitySv: SharedValue<number> }) => {
  const progress = useSharedValue(0);
  // Start X: distributed across width + extra for diagonal travel
  // We want them to fall from Top-Right area towards Bottom-Left.
  // X range: -width * 0.5 to width * 1.5
  const startX = useMemo(() => Math.random() * width * 2 - width * 0.5, []);
  
  const delay = useMemo(() => Math.random() * 2000, []);
  // Slower, heavier feel
  const duration = useMemo(() => 1200 + Math.random() * 800, []);
  
  // Thick bars: width 6-10, length 60-100
  const barWidth = useMemo(() => 6 + Math.random() * 4, []);
  const barLength = useMemo(() => 60 + Math.random() * 60, []);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, {
          duration: duration,
          easing: Easing.linear,
        }),
        -1,
        false
      )
    );
    return () => cancelAnimation(progress);
  }, [delay, duration]);

  const style = useAnimatedStyle(() => {
    // Top-Right to Bottom-Left trajectory
    // Move Left (-X) and Down (+Y)
    const translateX = -progress.value * (height * 0.6); // Move left significant amount
    const translateY = progress.value * (height + 200);   // Move down full height
    
    const intensityFactor = intensitySv.value / 100;
    
    return {
      transform: [
        { translateX: startX + translateX },
        { translateY: -150 + translateY },
        { rotate: '25deg' }, // Slant matching trajectory
      ],
      width: barWidth,
      height: barLength,
      borderRadius: barWidth / 2, // Rounded caps like wireframe
      // Reduced opacity as requested (80% of previous or general low)
      // Wireframe shows solid shapes but let's keep them semi-transparent
      opacity: (progress.value < 0.1 ? progress.value * 8 : 1) * (0.12 + intensityFactor * 0.4) * 0.8,
    };
  });

  return (
    <Animated.View
      style={[
        styles.rainParticle,
        { backgroundColor: theme.accentLight, borderColor: theme.accent, borderWidth: 1 }, // Added border for "wireframe" feel? Or just filled bar. User sketch shows outlined/filled bars. Let's do filled with border.
        style,
      ]}
    />
  );
});

// WIND: Smooth Sine Waves (SVG Paths)
const WindWave = React.memo(({ index, theme, intensitySv }: { index: number; theme: ThemeColors; intensitySv: SharedValue<number> }) => {
  const progress = useSharedValue(0);
  const startY = useMemo(() => height * 0.1 + Math.random() * height * 0.8, []);
  const delay = useMemo(() => Math.random() * 3000, []);
  const duration = useMemo(() => 4000 + Math.random() * 2000, []); // Slow flowing
  const scale = useMemo(() => 0.8 + Math.random() * 0.6, []);
  const waveWidth = 300; // Width of the SVG wave
  
  useEffect(() => {
    progress.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, {
          duration: duration,
          easing: Easing.linear,
        }),
        -1,
        false
      )
    );
    return () => cancelAnimation(progress);
  }, [delay, duration]);

  const animatedProps = useAnimatedStyle(() => {
    const intensityFactor = intensitySv.value / 100;
    // Move Right to Left
    const translateX = (width + 200) - (progress.value * (width + 500));
    
    return {
      transform: [
        { translateX },
        { translateY: startY },
        { scale: scale * (0.8 + intensityFactor * 0.4) }
      ],
      opacity: (1 - Math.pow(Math.abs(progress.value - 0.5) * 2, 2)) * (0.3 + intensityFactor * 0.5) * 0.8,
    };
  });

  // SVG Path for a nice sine wave
  // M 0 25 Q 75 0 150 25 T 300 25
  const pathData = `M 0 30 Q 75 0 150 30 T 300 30`;

  return (
    <Animated.View style={[styles.windContainer, animatedProps]}>
      <Svg width={waveWidth} height={60} viewBox="0 0 300 60">
        <Path
          d={pathData}
          stroke={theme.accentLight}
          strokeWidth={3}
          fill="none"
          strokeLinecap="round"
        />
      </Svg>
    </Animated.View>
  );
});

// CAFE: Rising Steam/Smoke - Dissolving
const SteamParticle = React.memo(({ index, theme, intensitySv }: { index: number; theme: ThemeColors; intensitySv: SharedValue<number> }) => {
  const progress = useSharedValue(0);
  const startX = useMemo(() => Math.random() * width, []);
  const delay = useMemo(() => Math.random() * 5000, []);
  const duration = useMemo(() => 5000 + Math.random() * 4000, []);
  const size = useMemo(() => 60 + Math.random() * 80, []);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, {
          duration: duration,
          easing: Easing.out(Easing.quad),
        }),
        -1,
        false
      )
    );
    return () => cancelAnimation(progress);
  }, [delay, duration]);

  const style = useAnimatedStyle(() => {
    const intensityFactor = intensitySv.value / 100;
    const translateY = height - (progress.value * (height * 0.5 + intensityFactor * 150)); 
    const scale = 0.4 + progress.value * 1.2;
    const wobble = Math.sin(progress.value * Math.PI * 2) * (30 + intensityFactor * 20);

    return {
      transform: [
        { translateX: startX + wobble },
        { translateY },
        { scale },
      ],
      opacity: (progress.value < 0.2 ? progress.value * 5 : (1 - progress.value)) * (0.1 + intensityFactor * 0.1) * 0.8,
    };
  });

  return (
    <Animated.View
      style={[
        styles.steamParticle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: theme.accent, 
        },
        style,
      ]}
    />
  );
});

// NOISE: Chromatic Glitch (Red/Blue/Green offsets)
const NoiseParticle = React.memo(({ index, theme, intensitySv }: { index: number; theme: ThemeColors; intensitySv: SharedValue<number> }) => {
  const opacity = useSharedValue(0);
  const randomX = useMemo(() => Math.random() * width, []);
  const randomY = useMemo(() => Math.random() * height, []);
  const w = useMemo(() => 10 + Math.random() * 80, []);
  const h = useMemo(() => 2 + Math.random() * 4, []);
  
  const glitchColor = useMemo(() => {
    const r = Math.random();
    if (r > 0.8) return '#ff0044'; 
    if (r > 0.6) return '#00ccff';
    return null; 
  }, []);

  useEffect(() => {
    const runFlicker = () => {
       const nextDelay = Math.random() * 500;
       const nextDuration = 30 + Math.random() * 80;
       const nextOpacity = Math.random() > 0.6 ? Math.random() * 0.5 : 0;
       
       opacity.value = withDelay(nextDelay, withTiming(nextOpacity, { duration: nextDuration }, (finished) => {
         if (finished) {
           runOnJS(runFlicker)();
         }
       }));
    };
    runFlicker();
    return () => cancelAnimation(opacity);
  }, []);

  const style = useAnimatedStyle(() => {
     const intensityFactor = intensitySv.value / 100;
     return {
        opacity: opacity.value * (0.4 + intensityFactor * 0.6) * 0.8,
        transform: [
            { translateX: randomX },
            { translateY: randomY },
            { scaleX: 1 + Math.random() * intensityFactor * 2 },
        ]
     };
  });

  return (
    <Animated.View
      style={[
        styles.noiseParticle,
        {
          width: w,
          height: h,
          backgroundColor: glitchColor || (index % 2 === 0 ? theme.accent : theme.textSecondary),
        },
        style,
      ]}
    />
  );
});

export const SoundBackground: React.FC<SoundBackgroundProps> = ({
  soundType,
  theme,
  intensity,
}) => {
  const intensitySv = useSharedValue(intensity);

  useEffect(() => {
    intensitySv.value = intensity;
  }, [intensity]);

  const particles = useMemo(() => {
    switch (soundType) {
      case 'RAIN':
        // Fewer, thicker bars
        return Array.from({ length: 30 }).map((_, i) => (
          <RainParticle key={`rain-${i}`} index={i} theme={theme} intensitySv={intensitySv} />
        ));
      case 'WIND':
        // Sine waves
        return Array.from({ length: 12 }).map((_, i) => (
          <WindWave key={`wind-${i}`} index={i} theme={theme} intensitySv={intensitySv} />
        ));
      case 'CAFÉ':
         return Array.from({ length: 15 }).map((_, i) => (
            <SteamParticle key={`cafe-${i}`} index={i} theme={theme} intensitySv={intensitySv} />
         ));
      case 'NOISE':
         return Array.from({ length: 60 }).map((_, i) => (
            <NoiseParticle key={`noise-${i}`} index={i} theme={theme} intensitySv={intensitySv} />
         ));
      default:
        return null;
    }
  }, [soundType, theme]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
       {particles}
    </View>
  );
};

const styles = StyleSheet.create({
  rainParticle: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  windContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  steamParticle: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  noiseParticle: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});
