/**
 * apps/mobile/src/components/stylist/HarmonyBadge.tsx
 *
 * Colour Harmony Score Card (F1) — 100% Parity with apps/web/src/components/stylist/HarmonyBadge.jsx.
 *
 * Computes a harmony verdict from the dominant colours of an outfit's items
 * entirely client-side (zero extra API calls). Algorithm:
 *
 *   1. Resolve each named colour → approximate HSL hue (via a curated lookup
 *      table that covers every colour name Gemini 2.5 Flash emits).
 *   2. Collect the dominant colour of each item (colors[0].name, pct > 0).
 *   3. Compute all pairwise hue distances (shortest arc on the colour wheel).
 *   4. Classify:
 *        HARMONIOUS  — max pairwise distance < 60°  (analogous / monochromatic)
 *        CLASHING    — any pairwise distance > 150°  (complementary gone wrong,
 *                      or highly discordant triad)
 *        NEUTRAL     — everything in between (triadic, split-complementary,
 *                      warm-neutral combos)
 *   5. Achromatic anchors (white / black / grey / beige / cream / navy) are
 *      excluded from the hue calculation — they never clash.
 */

import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, I18nManager } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fonts, fontSizes, spacing, radii } from '@mobile/theme/tokens';
import { useTheme } from '@mobile/theme';
import { labelForColor } from '@mobile/lib/taxonomy';

// ---------------------------------------------------------------------------
// Colour name → HSL hue lookup (0..360). Only hue matters for harmony.
// Achromatic colours map to null (excluded from arc distance calculation).
// ---------------------------------------------------------------------------
const HUE_MAP: Record<string, number | null> = {
  // Reds
  red: 0, scarlet: 5, crimson: 348, coral: 16, tomato: 9, vermilion: 9,
  // Oranges
  orange: 30, amber: 38, apricot: 25, peach: 28, tangerine: 20, burnt_orange: 18,
  'burnt orange': 18,
  // Yellows
  yellow: 55, gold: 45, lemon: 57, mustard: 46, ochre: 40, khaki: 56, chaki: 56,
  'mustard yellow': 46,
  // Greens
  green: 120, lime: 100, olive: 78, sage: 80, mint: 150, emerald: 145,
  forest: 130, 'forest green': 130, teal: 180, turquoise: 174, jade: 135,
  avocado: 90, 'olive green': 78, 'sage green': 80, 'mint green': 150,
  'hunter green': 132, 'dark green': 135,
  // Blues
  blue: 220, navy: 240, 'navy blue': 240, 'navy_blue': 240, cobalt: 215, royal: 225, 'royal blue': 225,
  sky: 200, 'sky blue': 200, baby: 205, 'baby blue': 205, cornflower: 219,
  cerulean: 207, indigo: 250, periwinkle: 230, denim: 218, steel: 207,
  'steel blue': 207, 'powder blue': 204, 'dark blue': 240, 'light blue': 205,
  // Purples
  purple: 270, violet: 280, lavender: 270, lilac: 272, mauve: 300,
  plum: 290, magenta: 300, fuchsia: 300, orchid: 302, grape: 285,
  eggplant: 282, wisteria: 265,
  // Pinks
  pink: 340, rose: 350, blush: 345, hot_pink: 330, 'hot pink': 330,
  salmon: 15, dusty_rose: 348, 'dusty rose': 348, 'bubblegum pink': 342,
  // Browns
  brown: 25, tan: 35, caramel: 33, chocolate: 20, rust: 12, sienna: 15,
  terracotta: 14, chestnut: 17, cinnamon: 22, coffee: 22, mocha: 21,
  'burnt sienna': 15,
  // Achromatics → null (excluded)
  white: null, black: null, grey: null, gray: null, silver: null,
  beige: null, cream: null, ivory: null, off_white: null, 'off-white': null,
  'off white': null, ecru: null, linen: null, nude: null, nude_pink: null,
  'nude pink': null, oatmeal: null, champagne: null, blond: null,
  charcoal: null, 'dark grey': null, 'dark gray': null, 'light grey': null, 'light gray': null,
};

/** Resolve a colour name to its hue (0..360) or null for achromatic. */
function resolveHue(name?: string): number | null {
  if (!name) return null;
  const key = name.toLowerCase().trim().replace(/[_s]+/g, ' ');
  if (key in HUE_MAP) return HUE_MAP[key];
  for (const [k, h] of Object.entries(HUE_MAP)) {
    if (key.includes(k)) return h;
  }
  return null;
}

/** Shortest arc between two hues on the colour wheel (0..180). */
function hueDist(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

// ---------------------------------------------------------------------------
// Harmony classification
// ---------------------------------------------------------------------------
export const VERDICT = {
  harmonious: 'harmonious',
  neutral: 'neutral',
  clashing: 'clashing',
} as const;

export function computeHarmony(colorNames: string[]) {
  if (!colorNames || colorNames.length === 0) return null;

  // Extract chromatic hues only
  const chromatic = colorNames
    .map((n) => ({ name: n, hue: resolveHue(n) }))
    .filter((c): c is { name: string; hue: number } => c.hue !== null);

  if (chromatic.length === 0) {
    // All neutrals — inherently harmonious
    return {
      verdict: VERDICT.harmonious,
      reason: 'stylist.harmonyScore.reason.allNeutral',
      palette: colorNames.map((n) => ({ name: n, hue: null })),
    };
  }

  // Compute pairwise distances
  let maxDist = 0;
  let minDist = Infinity;
  const hues = chromatic.map((c) => c.hue);
  for (let i = 0; i < hues.length; i++) {
    for (let j = i + 1; j < hues.length; j++) {
      const d = hueDist(hues[i], hues[j]);
      if (d > maxDist) maxDist = d;
      if (d < minDist) minDist = d;
    }
  }
  if (hues.length === 1) {
    maxDist = 0;
    minDist = 0;
  }

  let verdict: 'harmonious' | 'neutral' | 'clashing';
  let reason: string;
  if (maxDist < 60) {
    verdict = VERDICT.harmonious;
    reason = maxDist === 0
      ? 'stylist.harmonyScore.reason.monochromatic'
      : 'stylist.harmonyScore.reason.analogous';
  } else if (maxDist > 150) {
    verdict = VERDICT.clashing;
    reason = 'stylist.harmonyScore.reason.clashing';
  } else {
    verdict = VERDICT.neutral;
    reason = 'stylist.harmonyScore.reason.balanced';
  }

  return {
    verdict,
    reason,
    maxDist: Math.round(maxDist),
    palette: colorNames.map((n) => ({ name: n, hue: resolveHue(n) })),
  };
}

// Visual color resolution for swatches
const EXACT_HEX_MAP: Record<string, string> = {
  black: '#111827',
  white: '#ffffff',
  grey: '#6b7280',
  gray: '#6b7280',
  'dark grey': '#374151',
  'dark gray': '#374151',
  'light grey': '#e5e7eb',
  'light gray': '#e5e7eb',
  silver: '#cbd5e1',
  beige: '#f5f5dc',
  cream: '#fef08a',
  ivory: '#fffff0',
  'off white': '#fafaf9',
  'off-white': '#fafaf9',
  ecru: '#f5f5dc',
  linen: '#f7f7f7',
  nude: '#fed7aa',
  oatmeal: '#e2e8f0',
  champagne: '#fde047',
  navy: '#1e3a8a',
  'navy blue': '#1e3a8a',
  charcoal: '#1f2937',
  khaki: '#c3b091',
  chaki: '#c3b091',
  green: '#22c55e',
  olive: '#556b2f',
  'olive green': '#556b2f',
  'dark green': '#1b4332',
  red: '#ef4444',
  pink: '#ec4899',
  purple: '#a855f7',
  brown: '#8b4513',
  tan: '#d2b48c',
  yellow: '#eab308',
  orange: '#f97316',
  blue: '#3b82f6',
  'light blue': '#93c5fd',
  denim: '#224263',
};

function getVisualColor(colorName?: string): string {
  if (!colorName) return '#d1d5db';
  const c = colorName.toLowerCase().trim().replace(/[_s]+/g, ' ');

  if (c in EXACT_HEX_MAP) return EXACT_HEX_MAP[c];

  const lookupKey = c.replace(' ', '_');
  const hue = HUE_MAP[lookupKey] ?? HUE_MAP[c] ?? null;
  if (hue !== null) {
    return `hsl(${hue}, 65%, 52%)`;
  }

  return '#6b7280';
}

function translateColorName(colorName: string, t: any): string {
  if (!colorName) return '';
  const name = colorName.toLowerCase().trim();
  const separators = [
    { regex: /\s+&\s+/, joiner: ' & ' },
    { regex: /\s+and\s+/, joiner: ' & ' },
    { regex: /\s*\/\s*/, joiner: ' / ' },
    { regex: /\s*-\s*/, joiner: ' - ' },
  ];

  for (const sep of separators) {
    if (sep.regex.test(name)) {
      const parts = colorName.split(sep.regex);
      const translatedParts = parts.map((part) => labelForColor(part.trim(), t));
      return translatedParts.join(sep.joiner);
    }
  }

  return labelForColor(colorName, t);
}

interface HarmonyBadgeProps {
  colors: Array<{ name: string; hex?: string } | string>;
}

export function HarmonyBadge({ colors }: HarmonyBadgeProps) {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const [expanded, setExpanded] = useState(true);

  const colorNames = useMemo(() => {
    return (colors || [])
      .map((c) => (typeof c === 'string' ? c : c?.name))
      .filter((n): n is string => Boolean(n));
  }, [colors]);

  const harmony = useMemo(() => computeHarmony(colorNames), [colorNames]);

  if (!harmony || colorNames.length === 0) return null;

  const isHarmonious = harmony.verdict === 'harmonious';
  const isClashing = harmony.verdict === 'clashing';

  // Config matching web VERDICT_CONFIG
  const badgeBg = isHarmonious
    ? (isDark ? 'rgba(16, 185, 129, 0.18)' : '#ecfdf5')
    : isClashing
    ? (isDark ? 'rgba(244, 63, 94, 0.18)' : '#fff1f2')
    : (isDark ? 'rgba(245, 158, 11, 0.18)' : '#fefce8');

  const badgeBorder = isHarmonious
    ? (isDark ? '#059669' : '#a7f3d0')
    : isClashing
    ? (isDark ? '#e11d48' : '#fecdd3')
    : (isDark ? '#d97706' : '#fde68a');

  const textColor = isHarmonious
    ? (isDark ? '#6ee7b7' : '#047857')
    : isClashing
    ? (isDark ? '#fda4af' : '#be123c')
    : (isDark ? '#fcd34d' : '#b45309');

  const dotColor = isHarmonious
    ? '#10b981'
    : isClashing
    ? '#f43f5e'
    : '#f59e0b';

  const icon = isHarmonious ? '✦' : isClashing ? '⚡' : '∿';

  const label = t(`stylist.harmonyScore.${harmony.verdict}`, {
    defaultValue: isHarmonious
      ? 'Harmonious palette'
      : isClashing
      ? 'Contrasting palette'
      : 'Balanced palette',
  });

  const reasonText = t(harmony.reason, {
    defaultValue: isHarmonious
      ? 'These colours work together beautifully.'
      : isClashing
      ? 'These colours create a bold contrast — intentional or risky.'
      : 'A balanced palette with complementary tones.',
  });

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.pillBtn, { backgroundColor: badgeBg, borderColor: badgeBorder }]}
        onPress={() => setExpanded((v) => !v)}
        activeOpacity={0.8}
      >
        <View style={[styles.dot, { backgroundColor: dotColor }]} />
        <Text style={[styles.iconText, { color: textColor }]}>{icon}</Text>
        <Text style={[styles.pillLabel, { color: textColor }]}>{label}</Text>
        <Text style={[styles.arrowText, { color: textColor }]}>{expanded ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {expanded && (
        <View style={[styles.expandedBox, { backgroundColor: badgeBg, borderColor: badgeBorder }]}>
          <View style={styles.swatchRow}>
            {harmony.palette.map((c, i) => {
              const bg = getVisualColor(c.name);
              const displayName = translateColorName(c.name, t);
              return (
                <View key={`${c.name}-${i}`} style={styles.swatchItem}>
                  <View style={[styles.swatchCircle, { backgroundColor: bg }]} />
                  <Text style={[styles.swatchName, { color: textColor }]}>
                    {displayName}
                  </Text>
                </View>
              );
            })}
          </View>
          <Text style={[styles.reasonText, { color: textColor }]}>
            {reasonText}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing[2],
  },
  pillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderRadius: radii.full,
    borderWidth: 1,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  iconText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  pillLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
  },
  arrowText: {
    fontSize: 10,
    marginLeft: 2,
    opacity: 0.7,
  },
  expandedBox: {
    marginTop: spacing[1.5],
    padding: spacing[3],
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing[2],
  },
  swatchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
  },
  swatchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  swatchCircle: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.15)',
  },
  swatchName: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.xs,
    textTransform: 'capitalize',
  },
  reasonText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    lineHeight: 17,
  },
});

export default HarmonyBadge;
