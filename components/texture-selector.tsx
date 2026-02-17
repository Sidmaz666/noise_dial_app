import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import type { ThemeColors } from '@/constants/themes';

const { width } = Dimensions.get('window');
const MAX_WIDTH = 400;
const CARD_GAP = 12;

export type TextureType = 'SMOOTH' | 'DISTANT' | 'GRAINY' | 'GLITCHY';

interface TextureSelectorProps {
  selectedTexture: TextureType;
  onTextureChange: (texture: TextureType) => void;
  theme: ThemeColors;
}

const textures: { 
  type: TextureType; 
  icon: keyof typeof MaterialIcons.glyphMap; 
  label: string 
}[] = [
  { type: 'SMOOTH', icon: 'blur-on', label: 'SMOOTH' },
  { type: 'DISTANT', icon: 'radio-button-unchecked', label: 'DISTANT' },
  { type: 'GRAINY', icon: 'grain', label: 'GRAINY' },
  { type: 'GLITCHY', icon: 'bug-report', label: 'GLITCHY' },
];

export const TextureSelector: React.FC<TextureSelectorProps> = ({
  selectedTexture,
  onTextureChange,
  theme,
}) => {
  const selectedTextureData = textures.find(t => t.type === selectedTexture);

  // Calculate card width for 2x2 grid
  // Account for container padding (16px each side = 32px total)
  const containerPadding = 32;
  const maxUsableWidth = Math.min(width - 48 - containerPadding, MAX_WIDTH - containerPadding);
  const cardWidth = (maxUsableWidth - CARD_GAP) / 2;
  const cardHeight = 70; // Fixed height for compact cards

  return (
    <View style={styles.container}>
      {/* 2x2 Grid Container */}
      <View style={styles.gridContainer}>
        {textures.map((texture, index) => {
          const isActive = selectedTexture === texture.type;
          return (
            <TouchableOpacity
              key={texture.type}
              style={[
                styles.card,
                { 
                  width: cardWidth,
                  height: cardHeight,
                  marginBottom: index < 2 ? CARD_GAP : 0,
                  backgroundColor: isActive ? theme.cardBackgroundActive : theme.cardBackground,
                  borderColor: isActive ? theme.cardBorderActive : theme.cardBorder,
                  borderWidth: isActive ? 2 : 1,
                },
              ]}
              onPress={() => onTextureChange(texture.type)}
              activeOpacity={0.7}>
              <View style={styles.cardContent}>
                {/* Icon on top */}
                <View style={styles.iconWrapper}>
                  <MaterialIcons
                    name={texture.icon}
                    size={20}
                    color={isActive ? theme.accent : theme.textSecondary}
                  />
                </View>
                {/* Text on bottom */}
                <Text
                  style={[
                    styles.cardText,
                    { color: isActive ? theme.accent : theme.textSecondary },
                  ]}>
                  {texture.label}
                </Text>
              </View>
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
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  gridContainer: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
    // backgroundColor and borderColor set dynamically via theme
  },
  cardContent: {
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  iconWrapper: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardText: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
    // color set dynamically via theme
  },
});
