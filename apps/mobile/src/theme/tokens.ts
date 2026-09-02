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
  background:    'hsl(40, 20%, 98%)',
  foreground:    'hsl(240, 10%, 12%)',
  card:          'hsl(0, 0%, 100%)',
  cardForeground:'hsl(240, 10%, 12%)',
  primary:       'hsl(240, 10%, 12%)',
  primaryFg:     'hsl(40, 20%, 98%)',
  secondary:     'hsl(40, 15%, 93%)',
  secondaryFg:   'hsl(240, 10%, 25%)',
  muted:         'hsl(240, 5%, 94%)',
  mutedFg:       'hsl(240, 5%, 45%)',
  accent:        'hsl(174, 44%, 33%)',   // ocean-teal
  accentFg:      'hsl(0, 0%, 100%)',
  brand:         'hsl(271, 81%, 56%)',   // brand purple
  brandFg:       'hsl(0, 0%, 100%)',
  accentGreen:   'hsl(142, 71%, 45%)',
  accentLilac:   'hsl(270, 60%, 90%)',
  destructive:   'hsl(0, 72%, 52%)',
  destructiveFg: 'hsl(0, 0%, 100%)',
  border:        'hsl(240, 6%, 90%)',
  input:         'hsl(240, 6%, 90%)',
  ring:          'hsl(271, 81%, 56%)',
  persimmon:     'hsl(18, 78%, 56%)',
  seaGlass:      'hsl(170, 30%, 80%)',
  sand:          'hsl(40, 20%, 90%)',
  sidebar:       'hsl(40, 20%, 97%)',
  sidebarBorder: 'hsl(240, 6%, 88%)',
  textMuted:     'hsl(240, 5%, 45%)',  // alias for mutedFg
  cardOffWhite:  '#F5F2EB',            // DressApp's signature off-white garment backdrop
  itemCardBg:    '#F5F2EB',            // default items card background across app
} as const;

export const darkColors = {
  background:    'hsl(240, 10%, 8%)',
  foreground:    'hsl(40, 20%, 98%)',
  card:          'hsl(240, 8%, 11%)',
  cardForeground:'hsl(40, 20%, 98%)',
  primary:       'hsl(40, 20%, 98%)',
  primaryFg:     'hsl(240, 10%, 12%)',
  secondary:     'hsl(240, 8%, 16%)',
  secondaryFg:   'hsl(40, 20%, 85%)',
  muted:         'hsl(240, 8%, 16%)',
  mutedFg:       'hsl(240, 5%, 60%)',
  accent:        'hsl(174, 46%, 38%)',
  accentFg:      'hsl(0, 0%, 100%)',
  brand:         'hsl(271, 85%, 62%)',
  brandFg:       'hsl(0, 0%, 100%)',
  accentGreen:   'hsl(142, 60%, 40%)',
  accentLilac:   'hsl(270, 40%, 25%)',
  destructive:   'hsl(0, 70%, 45%)',
  destructiveFg: 'hsl(0, 0%, 100%)',
  border:        'hsl(240, 8%, 18%)',
  input:         'hsl(240, 8%, 18%)',
  ring:          'hsl(271, 85%, 62%)',
  persimmon:     'hsl(18, 75%, 52%)',
  seaGlass:      'hsl(170, 25%, 35%)',
  sand:          'hsl(40, 15%, 20%)',
  sidebar:       'hsl(240, 10%, 10%)',
  sidebarBorder: 'hsl(240, 8%, 16%)',
  textMuted:     'hsl(240, 5%, 60%)',
  cardOffWhite:  '#F5F2EB',            // DressApp's signature off-white garment backdrop
  itemCardBg:    '#F5F2EB',            // default items card background across app
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
  display:         'PlayfairDisplay_400Regular',
  displayItalic:   'PlayfairDisplay_400Regular_Italic',
  displayBold:     'PlayfairDisplay_700Bold',
  body:            'Manrope_400Regular',
  bodyMedium:      'Manrope_500Medium',
  bodySemiBold:    'Manrope_600SemiBold',
  bodyBold:        'Manrope_700Bold',
  bodyExtraBold:   'Manrope_800ExtraBold',
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
