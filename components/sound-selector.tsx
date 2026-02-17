import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import type { ThemeColors } from '@/constants/themes';

const { width } = Dimensions.get('window');
const MAX_WIDTH = 400;

export type SoundType = 'RAIN' | 'CAFÉ' | 'WIND' | 'NOISE';

interface SoundSelectorProps {
  selectedSound: SoundType;
  onSoundChange: (sound: SoundType) => void;
  theme: ThemeColors;
}

const sounds: { type: SoundType; icon: keyof typeof MaterialIcons.glyphMap; label: string }[] = [
  { type: 'RAIN', icon: 'water-drop', label: 'RAIN' },
  { type: 'CAFÉ', icon: 'local-cafe', label: 'CAFÉ' },
  { type: 'WIND', icon: 'air', label: 'WIND' },
  { type: 'NOISE', icon: 'graphic-eq', label: 'NOISE' },
];

export const SoundSelector: React.FC<SoundSelectorProps> = ({
  selectedSound,
  onSoundChange,
  theme,
}) => {
  return (
    <View style={styles.container}>
      <View style={[
        styles.pill,
        {
          backgroundColor: theme.buttonBackground,
          borderColor: theme.buttonBorder,
        },
      ]}>
        {sounds.map((sound) => {
          const isActive = selectedSound === sound.type;
          return (
            <TouchableOpacity
              key={sound.type}
              style={[
                styles.button,
                isActive && {
                  backgroundColor: theme.buttonBackgroundActive,
                  shadowColor: theme.accent,
                },
              ]}
              onPress={() => onSoundChange(sound.type)}
              activeOpacity={0.8}>
              <MaterialIcons
                name={sound.icon}
                size={20}
                color={isActive ? '#ffffff' : theme.textSecondary}
              />
              <Text
                style={[
                  styles.buttonText,
                  { color: isActive ? '#ffffff' : theme.textSecondary },
                ]}>
                {sound.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: MAX_WIDTH,
    paddingHorizontal: 24,
    alignItems: 'center',
    alignSelf: 'center',
  },
  pill: {
    flexDirection: 'row',
    borderRadius: 9999,
    padding: 6,
    gap: 6,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
    width: '100%',
    // backgroundColor and borderColor set dynamically via theme
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  buttonActive: {
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
    // backgroundColor and shadowColor set dynamically via theme
  },
  buttonText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    // color set dynamically via theme
  },
});
