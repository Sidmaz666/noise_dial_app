import type { ThemeColors } from '@/constants/themes';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useRef } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

const { width } = Dimensions.get('window');
const DIAL_SIZE = Math.min(width * 0.75, 320);
const KNOB_SIZE = DIAL_SIZE * 0.7;
const CIRCLE_RADIUS = (DIAL_SIZE - 32) / 2;
const MAX_ROTATION = 360; // Full circle starting from bottom

// Create animated Circle component for react-native-svg
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface NoiseDialProps {
  intensity: number;
  onIntensityChange: (value: number) => void;
  hasTimer?: boolean;
  timeRemaining?: number | null;
  theme: ThemeColors;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

export const NoiseDial: React.FC<NoiseDialProps> = ({ 
  intensity, 
  onIntensityChange,
  hasTimer = false,
  timeRemaining = null,
  theme,
  onDragStart,
  onDragEnd,
}) => {
  // Format time remaining as MM:SS or H:MM:SS
  const formatTime = (seconds: number | null): string => {
    if (seconds === null || seconds === undefined) return '';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Rotation value: 0-360 degrees for 0-100% intensity
  const rotation = useSharedValue((intensity / 100) * MAX_ROTATION);
  const startRotation = useSharedValue(0);
  const lastAngle = useSharedValue(0);
  const isDragging = useSharedValue(false);
  const lastIntensityRef = useRef(intensity);
  const containerRef = useRef<View>(null);
  const cumulativeDelta = useSharedValue(0); 
  const lastDelta = useSharedValue(0); 

  // Sync rotation with intensity changes (only if not being dragged)
  React.useEffect(() => {
    if (isDragging.value) return;
    lastIntensityRef.current = intensity;
    
    const timer = setTimeout(() => {
      try {
        rotation.value = withSpring((intensity / 100) * MAX_ROTATION, { 
          damping: 15, 
          stiffness: 100 
        });
      } catch (error) {
        console.error('Error updating rotation:', error);
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [intensity]);

  // Pulsing animation for timer mode
  const pulseOpacity = useSharedValue(hasTimer ? 1 : 0);
  
  React.useEffect(() => {
    try {
      if (hasTimer) {
        pulseOpacity.value = withRepeat(
          withTiming(0.3, { duration: 1500 }),
          -1,
          true
        );
      } else {
        pulseOpacity.value = withTiming(1, { duration: 300 });
      }
    } catch (error) {
      console.error('Error updating pulse opacity:', error);
    }
  }, [hasTimer]);

  const updateIntensity = useCallback(
    (value: number, shouldHaptic: boolean = false) => {
      const roundedValue = Math.round(value);
      if (roundedValue !== lastIntensityRef.current) {
        onIntensityChange(roundedValue);
        lastIntensityRef.current = roundedValue;
        if (shouldHaptic && (roundedValue % 25 === 0 || roundedValue === 0 || roundedValue === 100)) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      }
    },
    [onIntensityChange]
  );

  // Gesture logic: Start at Bottom (90 degrees / PI/2)
  const panGesture = Gesture.Pan()
    .onStart((e) => {
      'worklet';
      isDragging.value = true;
      startRotation.value = rotation.value;
      cumulativeDelta.value = 0;
      lastDelta.value = 0;
      if (onDragStart) {
        runOnJS(onDragStart)();
      }
      const centerX = DIAL_SIZE / 2;
      const centerY = DIAL_SIZE / 2;
      const x = e.x - centerX;
      const y = e.y - centerY;
      
      const initialAngle = Math.atan2(y, x);
      // Normalized: 0 at Bottom (PI/2), increasing clockwise
      let normalizedAngle = initialAngle - Math.PI / 2;
      if (normalizedAngle < 0) normalizedAngle += 2 * Math.PI;
      
      lastAngle.value = normalizedAngle;
    })
    .onUpdate((e) => {
      'worklet';
      const centerX = DIAL_SIZE / 2;
      const centerY = DIAL_SIZE / 2;
      const x = e.x - centerX;
      const y = e.y - centerY;
      const distance = Math.sqrt(x * x + y * y);
      
      if (distance > 10 && distance < DIAL_SIZE / 2 + 30) {
        const currentAngle = Math.atan2(y, x);
        // Normalize to Bottom Start
        let normalizedCurrentAngle = currentAngle - Math.PI / 2;
        if (normalizedCurrentAngle < 0) normalizedCurrentAngle += 2 * Math.PI;
        
        let deltaAngle = normalizedCurrentAngle - lastAngle.value;
        
        if (Math.abs(deltaAngle) > Math.PI) {
          if (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI;
          else if (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI;
        }
        
        const deltaDegrees = deltaAngle * (180 / Math.PI);
        const MIN_DELTA_THRESHOLD = 0.5;
        if (Math.abs(deltaDegrees) < MIN_DELTA_THRESHOLD) return;
        
        const SMOOTHING_FACTOR = 0.7;
        const smoothedDelta = lastDelta.value * (1 - SMOOTHING_FACTOR) + deltaDegrees * SMOOTHING_FACTOR;
        
        cumulativeDelta.value += smoothedDelta;
        let newRotation = startRotation.value + cumulativeDelta.value;
        
        // Clamp 0-360
        if (newRotation < 0) {
          newRotation = 0;
          cumulativeDelta.value = -startRotation.value;
        } else if (newRotation > MAX_ROTATION) {
          newRotation = MAX_ROTATION;
          cumulativeDelta.value = MAX_ROTATION - startRotation.value;
        }
        
        rotation.value = newRotation;
        lastAngle.value = normalizedCurrentAngle;
        lastDelta.value = smoothedDelta;
        
        const normalizedAngle = Math.max(0, Math.min(MAX_ROTATION, newRotation));
        const newIntensity = (normalizedAngle / MAX_ROTATION) * 100;
        runOnJS(updateIntensity)(newIntensity, false);
      }
    })
    .onEnd(() => {
      'worklet';
      isDragging.value = false;
      const finalIntensity = Math.round((rotation.value / MAX_ROTATION) * 100);
      runOnJS(updateIntensity)(finalIntensity, true);
      if (onDragEnd) {
        runOnJS(onDragEnd)();
      }
      rotation.value = withSpring(rotation.value, { 
        damping: 15, 
        stiffness: 100 
      });
    })
    .minDistance(5);

  // Knob rotation: 0 deg = Bottom (matches Marker position)
  const dialStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${rotation.value}deg` }],
    };
  });

  const circumference = 2 * Math.PI * CIRCLE_RADIUS;
  const glowPulse = useSharedValue(1);
  
  React.useEffect(() => {
    glowPulse.value = withRepeat(
      withTiming(0.4, { duration: 2000 }),
      -1,
      true
    );
  }, []);

  const progressArcProps1 = useAnimatedProps(() => {
    const progress = Math.max(0, Math.min(1, rotation.value / MAX_ROTATION));
    const strokeDashoffset = circumference * (1 - progress);
    const baseOpacity = hasTimer ? pulseOpacity.value * 0.4 : 0.4;
    const animatedOpacity = baseOpacity * (0.6 + glowPulse.value * 0.4);
    
    return {
      strokeDashoffset: strokeDashoffset,
      opacity: animatedOpacity,
    };
  });

  const progressArcProps2 = useAnimatedProps(() => {
    const progress = Math.max(0, Math.min(1, rotation.value / MAX_ROTATION));
    const strokeDashoffset = circumference * (1 - progress);
    const baseOpacity = hasTimer ? pulseOpacity.value * 0.7 : 0.7;
    const animatedOpacity = baseOpacity * (0.7 + glowPulse.value * 0.3);
    
    return {
      strokeDashoffset: strokeDashoffset,
      opacity: animatedOpacity,
    };
  });

  const progressArcProps3 = useAnimatedProps(() => {
    const progress = Math.max(0, Math.min(1, rotation.value / MAX_ROTATION));
    const strokeDashoffset = circumference * (1 - progress);
    const animatedOpacity = 0.8 + glowPulse.value * 0.2;
    
    return {
      strokeDashoffset: strokeDashoffset,
      opacity: animatedOpacity,
    };
  });

  return (
    <View style={styles.container} ref={containerRef}>
      <GestureDetector gesture={panGesture}>
        <Animated.View style={styles.dialContainer}>
          <View style={[
            styles.dialOuter,
            {
              backgroundColor: theme.dialBackground,
              borderColor: theme.dialRing,
            },
          ]}>
            <Svg width={DIAL_SIZE} height={DIAL_SIZE} style={styles.progressRing}>
              <Circle
                cx={DIAL_SIZE / 2}
                cy={DIAL_SIZE / 2}
                r={CIRCLE_RADIUS}
                fill="transparent"
                stroke={theme.dialRing}
                strokeWidth={1}
              />
              
              {/* Start at 90 degrees (Bottom Middle) */}
              <AnimatedCircle
                cx={DIAL_SIZE / 2}
                cy={DIAL_SIZE / 2}
                r={CIRCLE_RADIUS}
                fill="transparent"
                stroke={theme.accent}
                strokeWidth={8}
                strokeDasharray={circumference}
                strokeLinecap="round"
                transform={`rotate(90 ${DIAL_SIZE / 2} ${DIAL_SIZE / 2})`}
                animatedProps={progressArcProps1}
              />
              <AnimatedCircle
                cx={DIAL_SIZE / 2}
                cy={DIAL_SIZE / 2}
                r={CIRCLE_RADIUS}
                fill="transparent"
                stroke={theme.accentLight}
                strokeWidth={6}
                strokeDasharray={circumference}
                strokeLinecap="round"
                transform={`rotate(90 ${DIAL_SIZE / 2} ${DIAL_SIZE / 2})`}
                animatedProps={progressArcProps2}
              />
              <AnimatedCircle
                cx={DIAL_SIZE / 2}
                cy={DIAL_SIZE / 2}
                r={CIRCLE_RADIUS}
                fill="transparent"
                stroke={theme.accent}
                strokeWidth={5}
                strokeDasharray={circumference}
                strokeLinecap="round"
                transform={`rotate(90 ${DIAL_SIZE / 2} ${DIAL_SIZE / 2})`}
                animatedProps={progressArcProps3}
              />
            </Svg>
            
            {hasTimer && timeRemaining !== null && timeRemaining > 0 ? (
              <View style={styles.timerContainer}>
                <Text style={[styles.timerText, { color: theme.accent }]}>
                  {formatTime(timeRemaining)}
                  {timeRemaining >= 3600 && <Text style={{fontSize: 16, fontWeight: '400'}}> HR</Text>}
                </Text>
              </View>
            ) : null}
            
            <Animated.View style={[
              styles.knob,
              dialStyle,
              {
                backgroundColor: theme.dialKnob,
                borderColor: theme.dialRing,
              },
            ]}>
               <View style={[
                 styles.triangle,
                 { borderTopColor: theme.accent } // Pointing DOWN (Outwards)
               ]} />
            </Animated.View>
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: DIAL_SIZE,
    height: DIAL_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dialContainer: {
    width: DIAL_SIZE,
    height: DIAL_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dialOuter: {
    width: DIAL_SIZE,
    height: DIAL_SIZE,
    borderRadius: DIAL_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 25,
    elevation: 10,
    borderWidth: 1,
  },
  progressRing: {
    position: 'absolute',
  },
  knob: {
    width: KNOB_SIZE,
    height: KNOB_SIZE,
    borderRadius: KNOB_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 15, height: 15 },
    shadowOpacity: 1,
    shadowRadius: 30,
    elevation: 15,
    borderWidth: 1,
  },
  triangle: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 12, // Points DOWN (Outwards)
    borderBottomWidth: 0,
    position: 'absolute',
    bottom: 10, // Inside the knob at bottom
  },
  timerContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    width: KNOB_SIZE,
    height: KNOB_SIZE,
    zIndex: 5,
  },
  timerText: {
    fontSize: 36,
    fontWeight: '300',
    letterSpacing: 2,
    textAlign: 'center',
  },
});
