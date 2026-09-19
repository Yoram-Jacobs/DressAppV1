/**
 * apps/mobile/src/theme/tokens.ts
 *
 * DressApp design tokens — bridged from apps/web/src/index.css CSS variables.
 * Single source of truth for all React Native style values.
 */

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------
export const lightColors = {
  background:    '#F7F7F2',
  foreground:    '#000000',
  card:          '#FFFFFF',
  cardForeground:'#000000',
  primary:       '#1F5C45',
  primaryFg:     '#FFFFFF',
  secondary:     '#F5EEE9',
  secondaryFg:   '#000000',
  muted:         'hsl(240, 5%, 94%)',
  mutedFg:       '#666666',
  accent:        '#1F5C45',   // signature emerald green
  accentFg:      '#FFFFFF',
  brand:         '#1F5C45',   // brand forest green
  brandFg:       '#FFFFFF',
  accentGreen:   'hsl(142, 71%, 45%)',
  accentLilac:   'hsl(270, 60%, 90%)',
  destructive:   'hsl(0, 72%, 52%)',
  destructiveFg: '#FFFFFF',
  border:        '#E5E7EB',
  input:         '#E5E7EB',
  ring:          '#1F5C45',
  persimmon:     'hsl(18, 78%, 56%)',
  seaGlass:      'hsl(170, 30%, 80%)',
  sand:          '#F5EEE9',
  sidebar:       '#F7F7F2',
  sidebarBorder: '#E5E7EB',
  textMuted:     '#666666',
  cardOffWhite:  '#F5F2EB',
  itemCardBg:    '#FFFFFF',
  primaryBrand:  '#1F5C45',
  primaryHover:  '#174533',
  lightBg:       '#F7F7F2',
  accentBeige:   '#F5EEE9',
  darkBrand:     '#000000',
  textBrand:     '#666666',
  primaryShadow: 'rgba(31, 92, 69, 0.06)',
  yellowColor:   '#FAD459',
  yellowShadow:  'rgba(250, 212, 89, 0.26)',
  yellowBorder:  '#FFE48F',
  glassBg:       'rgba(255, 255, 255, 0.85)',
  glassBorder:   'rgba(255, 255, 255, 0.5)',
} as const;

export const darkColors = {
  background:    '#101612',
  foreground:    '#FFFFFF',
  card:          '#18221C',
  cardForeground:'#FFFFFF',
  primary:       '#1F5C45',
  primaryFg:     '#FFFFFF',
  secondary:     '#241F1C',
  secondaryFg:   '#D0D0D0',
  muted:         '#1F2923',
  mutedFg:       '#9CA3AF',
  accent:        '#2B7659',
  accentFg:      '#FFFFFF',
  brand:         '#1F5C45',
  brandFg:       '#FFFFFF',
  accentGreen:   'hsl(142, 60%, 40%)',
  accentLilac:   'hsl(270, 40%, 25%)',
  destructive:   'hsl(0, 70%, 45%)',
  destructiveFg: '#FFFFFF',
  border:        '#2A3830',
  input:         '#2A3830',
  ring:          '#2B7659',
  persimmon:     'hsl(18, 75%, 52%)',
  seaGlass:      'hsl(170, 25%, 35%)',
  sand:          '#241F1C',
  sidebar:       '#101612',
  sidebarBorder: '#2A3830',
  textMuted:     '#9CA3AF',
  cardOffWhite:  '#1F2923',
  itemCardBg:    '#18221C',
  primaryBrand:  '#1F5C45',
  primaryHover:  '#2B7659',
  lightBg:       '#101612',
  accentBeige:   '#241F1C',
  darkBrand:     '#FFFFFF',
  textBrand:     '#D0D0D0',
  primaryShadow: 'rgba(31, 92, 69, 0.12)',
  yellowColor:   '#FAD459',
  yellowShadow:  'rgba(250, 212, 89, 0.26)',
  yellowBorder:  '#FFE48F',
  glassBg:       'rgba(24, 34, 28, 0.85)',
  glassBorder:   'rgba(255, 255, 255, 0.1)',
} as const;

export interface FontTokens {
  readonly display: string;
  readonly displayItalic: string;
  readonly displayBold: string;
  readonly body: string;
  readonly bodyMedium: string;
  readonly bodySemiBold: string;
  readonly bodyBold: string;
  readonly bodyExtraBold: string;
}

export const latinFonts: FontTokens = {
  display:         'PlusJakartaSans_700Bold',
  displayItalic:   'PlusJakartaSans_500Medium_Italic',
  displayBold:     'PlusJakartaSans_800ExtraBold',
  body:            'PlusJakartaSans_400Regular',
  bodyMedium:      'PlusJakartaSans_500Medium',
  bodySemiBold:    'PlusJakartaSans_600SemiBold',
  bodyBold:        'PlusJakartaSans_700Bold',
  bodyExtraBold:   'PlusJakartaSans_800ExtraBold',
};

export const hebrewFonts: FontTokens = {
  display:         'Heebo_700Bold',
  displayItalic:   'Heebo_500Medium',
  displayBold:     'Heebo_800ExtraBold',
  body:            'Heebo_400Regular',
  bodyMedium:      'Heebo_500Medium',
  bodySemiBold:    'Heebo_600SemiBold',
  bodyBold:        'Heebo_700Bold',
  bodyExtraBold:   'Heebo_800ExtraBold',
};

export const arabicFonts: FontTokens = {
  display:         'Cairo_700Bold',
  displayItalic:   'Cairo_600SemiBold',
  displayBold:     'Cairo_700Bold',
  body:            'Cairo_400Regular',
  bodyMedium:      'Cairo_600SemiBold',
  bodySemiBold:    'Cairo_600SemiBold',
  bodyBold:        'Cairo_700Bold',
  bodyExtraBold:   'Cairo_700Bold',
};

export function getLanguageFonts(lang: string = 'en'): FontTokens {
  const code = (lang || 'en').toLowerCase().split('-')[0];
  if (code === 'he' || code === 'iw') return hebrewFonts;
  if (code === 'ar') return arabicFonts;
  return latinFonts;
}

export const fonts: FontTokens = latinFonts;

export const fontSizes = {
  xs:   11,
  sm:   13,
  base: 15,
  md:   16,
  lg:   18,
  xl:   20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
  '5xl': 48,
} as const;

export const lineHeights = {
  tight:   1.2,
  snug:    1.35,
  normal:  1.5,
  relaxed: 1.625,
} as const;

// ---------------------------------------------------------------------------
// Spacing
// ---------------------------------------------------------------------------
export const spacing = {
  0:  0,
  0.5: 2,
  1:  4,
  1.5: 6,
  2:  8,
  2.5: 10,
  3:  12,
  3.5: 14,
  4:  16,
  5:  20,
  6:  24,
  7:  28,
  8:  32,
  9:  36,
  10: 40,
  12: 48,
  14: 56,
  16: 64,
  20: 80,
  24: 96,
  // Named aliases for semantic use (spacing.sm, spacing.md, etc.)
  xs:  4,   // spacing[1]
  sm:  8,   // spacing[2]
  md:  16,  // spacing[4]
  lg:  24,  // spacing[6]
  xl:  32,  // spacing[8]
  '2xl': 48, // spacing[12]
} as const;

// ---------------------------------------------------------------------------
// Border radii
// ---------------------------------------------------------------------------
export const radii = {
  none: 0,
  sm:   8,
  md:   10,
  lg:   20,
  xl:   24,
  '2xl': 28,
  '3xl': 32,
  full: 9999,
} as const;

// ---------------------------------------------------------------------------
// Shadows
// ---------------------------------------------------------------------------
export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
  },
} as const;

// ---------------------------------------------------------------------------
// Animation durations (ms) — mirrors tailwind.config.js transitionDuration
// ---------------------------------------------------------------------------
export const duration = {
  fast:   150,
  normal: 200,
  slow:   300,
  xslow:  500,
} as const;
