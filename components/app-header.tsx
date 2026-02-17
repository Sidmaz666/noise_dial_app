import type { ThemeColors } from '@/constants/themes';
import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface AppHeaderProps {
  isPlaying?: boolean;
  onPlayPress?: () => void;
  onTimerPress?: () => void;
  timerMinutes?: number | null;
  timeRemaining?: number | null;
  theme: ThemeColors;
}

export const AppHeader: React.FC<AppHeaderProps> = ({ 
  isPlaying = false, 
  onPlayPress, 
  onTimerPress,
  timerMinutes,
  timeRemaining,
  theme,
}) => {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[
          styles.button,
          { 
            backgroundColor: theme.buttonBackground,
            borderColor: theme.buttonBorder,
          },
          isPlaying && {
            borderColor: theme.accent,
            backgroundColor: theme.buttonBackgroundActive,
          },
        ]}
        onPress={onPlayPress}
        activeOpacity={0.7}>
        <MaterialIcons 
          name={isPlaying ? "pause" : "play-arrow"} 
          size={24} 
          color={isPlaying ? '#ffffff' : theme.textSecondary} 
        />
      </TouchableOpacity>
      
      <View style={styles.centerContainer}>
        <Text style={[styles.title, { color: theme.textSecondary }]}>NOISE DIAL</Text>
      </View>
      
      <TouchableOpacity
        style={[
          styles.button,
          { 
            backgroundColor: theme.buttonBackground,
            borderColor: theme.buttonBorder,
          },
          timerMinutes !== null && {
            borderColor: theme.accent,
            backgroundColor: theme.buttonBackgroundActive,
          },
        ]}
        onPress={onTimerPress}
        activeOpacity={0.7}>
        <MaterialIcons 
          name="timer" 
          size={20} 
          color={timerMinutes !== null ? '#ffffff' : theme.textSecondary} 
        />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingTop: 48,
    paddingBottom: 12, // Reduced bottom padding to bring intensity closer
    paddingHorizontal: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  centerContainer: {
    alignItems: 'center',
    flex: 1,
  },
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonActive: {
    // Styles applied inline with theme colors
  },
  title: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 9.6,
    textTransform: 'uppercase',
  },
});
