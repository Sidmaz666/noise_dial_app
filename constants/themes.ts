import type { SoundType } from '@/components/sound-selector';

export type ColorScheme = 'light' | 'dark';

export interface ThemeColors {
  // Background
  backgroundGradient: [string, string]; // [start, end] for LinearGradient
  background: string;
  
  // Accent colors
  accent: string;
  accentLight: string; // Lighter variant for glows
  accentDark: string; // Darker variant
  
  // Text colors
  textPrimary: string;
  textSecondary: string;
  
  // UI elements
  cardBackground: string;
  cardBackgroundActive: string;
  cardBorder: string;
  cardBorderActive: string;
  
  // Dial colors
  dialRing: string;
  dialBackground: string;
  dialKnob: string;
  
  // Button colors
  buttonBackground: string;
  buttonBackgroundActive: string;
  buttonBorder: string;
  buttonBorderActive: string;
}

export interface Theme {
  light: ThemeColors;
  dark: ThemeColors;
}

const themes: Record<SoundType, Theme> = {
  RAIN: {
    light: {
      backgroundGradient: ['#f0fdf4', '#dcfce7'],
      background: '#f0fdf4',
      accent: '#16a34a',
      accentLight: '#4ade80',
      accentDark: '#15803d',
      textPrimary: '#0d1b0f',
      textSecondary: 'rgba(13, 27, 15, 0.6)',
      cardBackground: 'rgba(255, 255, 255, 0.7)',
      cardBackgroundActive: 'rgba(22, 163, 74, 0.2)',
      cardBorder: 'rgba(13, 27, 15, 0.2)',
      cardBorderActive: '#16a34a',
      dialRing: 'rgba(22, 163, 74, 0.15)',
      dialBackground: '#ffffff',
      dialKnob: '#f0fdf4',
      buttonBackground: 'rgba(255, 255, 255, 0.6)',
      buttonBackgroundActive: '#16a34a',
      buttonBorder: 'rgba(13, 27, 15, 0.2)',
      buttonBorderActive: '#16a34a',
    },
    dark: {
      backgroundGradient: ['#0d1b0f', '#051408'],
      background: '#0d1b0f',
      accent: '#4ade80',
      accentLight: '#86efac',
      accentDark: '#22c55e',
      textPrimary: '#f0fdf4',
      textSecondary: 'rgba(240, 253, 244, 0.6)',
      cardBackground: 'rgba(255, 255, 255, 0.05)',
      cardBackgroundActive: 'rgba(74, 222, 128, 0.15)',
      cardBorder: 'rgba(255, 255, 255, 0.1)',
      cardBorderActive: '#4ade80',
      dialRing: 'rgba(74, 222, 128, 0.1)',
      dialBackground: '#111',
      dialKnob: '#1a1a1a',
      buttonBackground: 'rgba(0, 0, 0, 0.4)',
      buttonBackgroundActive: '#4ade80',
      buttonBorder: 'rgba(255, 255, 255, 0.1)',
      buttonBorderActive: '#4ade80',
    },
  },
  'CAFÉ': {
    light: {
      backgroundGradient: ['#f5ebe0', '#ede0d4'],
      background: '#f5ebe0',
      accent: '#8b6914',
      accentLight: '#d4a574',
      accentDark: '#6b4e0f',
      textPrimary: '#2c1810',
      textSecondary: 'rgba(44, 24, 16, 0.6)',
      cardBackground: 'rgba(255, 255, 255, 0.7)',
      cardBackgroundActive: 'rgba(139, 105, 20, 0.2)',
      cardBorder: 'rgba(44, 24, 16, 0.2)',
      cardBorderActive: '#8b6914',
      dialRing: 'rgba(139, 105, 20, 0.15)',
      dialBackground: '#ffffff',
      dialKnob: '#f5ebe0',
      buttonBackground: 'rgba(255, 255, 255, 0.6)',
      buttonBackgroundActive: '#8b6914',
      buttonBorder: 'rgba(44, 24, 16, 0.2)',
      buttonBorderActive: '#8b6914',
    },
    dark: {
      backgroundGradient: ['#2c1810', '#1a0f08'],
      background: '#2c1810',
      accent: '#d4a574',
      accentLight: '#e6c99f',
      accentDark: '#b8945f',
      textPrimary: '#fff8f0',
      textSecondary: 'rgba(255, 248, 240, 0.6)',
      cardBackground: 'rgba(255, 255, 255, 0.05)',
      cardBackgroundActive: 'rgba(212, 165, 116, 0.15)',
      cardBorder: 'rgba(255, 255, 255, 0.1)',
      cardBorderActive: '#d4a574',
      dialRing: 'rgba(212, 165, 116, 0.1)',
      dialBackground: '#111',
      dialKnob: '#1a1a1a',
      buttonBackground: 'rgba(0, 0, 0, 0.4)',
      buttonBackgroundActive: '#d4a574',
      buttonBorder: 'rgba(255, 255, 255, 0.1)',
      buttonBorderActive: '#d4a574',
    },
  },
  WIND: {
    light: {
      backgroundGradient: ['#e0f2f1', '#b2dfdb'],
      background: '#e0f2f1',
      accent: '#00796b',
      accentLight: '#64b5f6',
      accentDark: '#00695c',
      textPrimary: '#1a2332',
      textSecondary: 'rgba(26, 35, 50, 0.6)',
      cardBackground: 'rgba(255, 255, 255, 0.7)',
      cardBackgroundActive: 'rgba(0, 121, 107, 0.2)',
      cardBorder: 'rgba(26, 35, 50, 0.2)',
      cardBorderActive: '#00796b',
      dialRing: 'rgba(0, 121, 107, 0.15)',
      dialBackground: '#ffffff',
      dialKnob: '#e0f2f1',
      buttonBackground: 'rgba(255, 255, 255, 0.6)',
      buttonBackgroundActive: '#00796b',
      buttonBorder: 'rgba(26, 35, 50, 0.2)',
      buttonBorderActive: '#00796b',
    },
    dark: {
      backgroundGradient: ['#1a2332', '#0f1419'],
      background: '#1a2332',
      accent: '#64b5f6',
      accentLight: '#90caf9',
      accentDark: '#42a5f5',
      textPrimary: '#e1f5fe',
      textSecondary: 'rgba(225, 245, 254, 0.6)',
      cardBackground: 'rgba(255, 255, 255, 0.05)',
      cardBackgroundActive: 'rgba(100, 181, 246, 0.15)',
      cardBorder: 'rgba(255, 255, 255, 0.1)',
      cardBorderActive: '#64b5f6',
      dialRing: 'rgba(100, 181, 246, 0.1)',
      dialBackground: '#111',
      dialKnob: '#1a1a1a',
      buttonBackground: 'rgba(0, 0, 0, 0.4)',
      buttonBackgroundActive: '#64b5f6',
      buttonBorder: 'rgba(255, 255, 255, 0.1)',
      buttonBorderActive: '#64b5f6',
    },
  },
  NOISE: {
    light: {
      backgroundGradient: ['#f5f5f5', '#e0e0e0'],
      background: '#f5f5f5',
      accent: '#9c27b0',
      accentLight: '#d919e6',
      accentDark: '#7b1fa2',
      textPrimary: '#1a1a1a',
      textSecondary: 'rgba(26, 26, 26, 0.6)',
      cardBackground: 'rgba(255, 255, 255, 0.7)',
      cardBackgroundActive: 'rgba(156, 39, 176, 0.2)',
      cardBorder: 'rgba(26, 26, 26, 0.2)',
      cardBorderActive: '#9c27b0',
      dialRing: 'rgba(156, 39, 176, 0.15)',
      dialBackground: '#ffffff',
      dialKnob: '#f5f5f5',
      buttonBackground: 'rgba(255, 255, 255, 0.6)',
      buttonBackgroundActive: '#9c27b0',
      buttonBorder: 'rgba(26, 26, 26, 0.2)',
      buttonBorderActive: '#9c27b0',
    },
    dark: {
      backgroundGradient: ['#0f172a', '#020617'],
      background: '#0f172a',
      accent: '#d919e6',
      accentLight: '#e91e63',
      accentDark: '#b71c1c',
      textPrimary: '#ffffff',
      textSecondary: 'rgba(255, 255, 255, 0.5)',
      cardBackground: 'rgba(255, 255, 255, 0.05)',
      cardBackgroundActive: 'rgba(217, 25, 230, 0.15)',
      cardBorder: 'rgba(255, 255, 255, 0.1)',
      cardBorderActive: '#d919e6',
      dialRing: 'rgba(217, 25, 230, 0.1)',
      dialBackground: '#111',
      dialKnob: '#1a1a1a',
      buttonBackground: 'rgba(0, 0, 0, 0.4)',
      buttonBackgroundActive: '#d919e6',
      buttonBorder: 'rgba(255, 255, 255, 0.1)',
      buttonBorderActive: '#d919e6',
    },
  },
};

export function getTheme(soundType: SoundType, colorScheme: ColorScheme = 'dark'): ThemeColors {
  return themes[soundType][colorScheme];
}

export function useTheme(soundType: SoundType, colorScheme?: ColorScheme): ThemeColors {
  const scheme = colorScheme || 'dark';
  return getTheme(soundType, scheme);
}
