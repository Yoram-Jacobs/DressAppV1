/**
 * HarmonyBadge — Colour Harmony Score Card (F1)
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
 *
 * Props:
 *   colors  — flat array of { name: string, hex?: string }[] collected from
 *             every item in the outfit (dominant colour per item).
 */
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { labelForColor } from '@/lib/taxonomy';

// ---------------------------------------------------------------------------
// Colour name → HSL hue lookup (0..360). Only hue matters for harmony.
// Achromatic colours map to null (excluded from arc distance calculation).
// ---------------------------------------------------------------------------
const HUE_MAP = {
  // Reds
  red: 0, scarlet: 5, crimson: 348, coral: 16, tomato: 9, vermilion: 9,
  // Oranges
  orange: 30, amber: 38, apricot: 25, peach: 28, tangerine: 20, burnt_orange: 18,
  'burnt orange': 18,
  // Yellows
  yellow: 55, gold: 45, lemon: 57, mustard: 46, ochre: 40, khaki: 56,
  'mustard yellow': 46,
  // Greens
  green: 120, lime: 100, olive: 78, sage: 80, mint: 150, emerald: 145,
  forest: 130, 'forest green': 130, teal: 180, turquoise: 174, jade: 135,
  avocado: 90, 'olive green': 78, 'sage green': 80, 'mint green': 150,
  'hunter green': 132,
  // Blues
  blue: 220, navy: 240, cobalt: 215, royal: 225, 'royal blue': 225,
  sky: 200, 'sky blue': 200, baby: 205, 'baby blue': 205, cornflower: 219,
  cerulean: 207, indigo: 250, periwinkle: 230, denim: 218, steel: 207,
  'steel blue': 207, 'powder blue': 204,
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
};

/** Resolve a colour name to its hue (0..360) or null for achromatic. */
function resolveHue(name) {
  if (!name) return null;
  const key = name.toLowerCase().trim().replace(/[_\s]+/g, ' ');
  // Exact match
  if (key in HUE_MAP) return HUE_MAP[key];
  // Substring match (e.g. "light dusty rose" → "dusty rose")
  for (const [k, h] of Object.entries(HUE_MAP)) {
    if (key.includes(k)) return h;
  }
  return null; // Unknown — treat as achromatic (safe default)
}

/** Shortest arc between two hues on the colour wheel (0..180). */
function hueDist(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

// ---------------------------------------------------------------------------
// Harmony classification
// ---------------------------------------------------------------------------
const VERDICT = {
  harmonious: 'harmonious',
  neutral: 'neutral',
  clashing: 'clashing',
};

/**
 * Returns { verdict, reason, palette: [{name, hue}] }
 * from a flat array of dominant colour names.
 */
export function computeHarmony(colorNames) {
  if (!colorNames || colorNames.length === 0) return null;

  // Extract chromatic hues only
  const chromatic = colorNames
    .map((n) => ({ name: n, hue: resolveHue(n) }))
    .filter((c) => c.hue !== null);

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
  if (hues.length === 1) { maxDist = 0; minDist = 0; }

  let verdict, reason;
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

// ---------------------------------------------------------------------------
// Gradient & icon config per verdict
// ---------------------------------------------------------------------------
const VERDICT_CONFIG = {
  harmonious: {
    gradient: 'from-emerald-400 to-teal-400',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    border: 'border-emerald-200 dark:border-emerald-800/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    icon: '✦',
    labelKey: 'stylist.harmonyScore.harmonious',
  },
  neutral: {
    gradient: 'from-amber-400 to-yellow-400',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-800/40',
    text: 'text-amber-700 dark:text-amber-300',
    icon: '∿',
    labelKey: 'stylist.harmonyScore.neutral',
  },
  clashing: {
    gradient: 'from-rose-400 to-pink-500',
    bg: 'bg-rose-50 dark:bg-rose-950/30',
    border: 'border-rose-200 dark:border-rose-800/40',
    text: 'text-rose-700 dark:text-rose-300',
    icon: '⚡',
    labelKey: 'stylist.harmonyScore.clashing',
  },
};

// Resolve named color to visual Hex/HSL values, splitting and rendering linear gradients for multi-color values
function getCssBackground(colorName) {
  if (!colorName) return '#d1d5db';
  
  const name = colorName.toLowerCase().trim();
  
  const getSingleColor = (color) => {
    const c = color.trim().replace(/[\s_\-]+/g, ' ');
    
    // Direct hue HSL lookup if matching
    const lookupKey = c.replace(' ', '_');
    const hue = HUE_MAP[lookupKey] ?? HUE_MAP[c] ?? null;
    if (hue !== null) {
      return `hsl(${hue}, 65%, 52%)`;
    }
    
    const exactMap = {
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
      charcoal: '#1f2937',
    };
    
    if (c in exactMap) return exactMap[c];
    
    // Fallback checks
    if (c.includes('dark')) {
      const sub = c.replace('dark', '').trim();
      if (sub in exactMap) return exactMap[sub];
    }
    if (c.includes('light')) {
      const sub = c.replace('light', '').trim();
      if (sub in exactMap) return exactMap[sub];
    }
    
    return c;
  };
  
  const separators = [/\s+&\s+/, /\s+and\s+/, /\s*\/\s*/, /\s*-\s*/];
  let parts = [name];
  for (const sep of separators) {
    if (sep.test(name)) {
      parts = name.split(sep);
      break;
    }
  }
  
  if (parts.length > 1) {
    const cssColors = parts.map(getSingleColor);
    const gradientParts = cssColors.map((color, index) => {
      const startPct = Math.round((index / cssColors.length) * 100);
      const endPct = Math.round(((index + 1) / cssColors.length) * 100);
      return `${color} ${startPct}%, ${color} ${endPct}%`;
    });
    return `linear-gradient(135deg, ${gradientParts.join(', ')})`;
  }
  
  return getSingleColor(name);
}

// Localize color name using existing taxonomy module, handling compound colors
function translateColorName(colorName, t) {
  if (!colorName) return '';
  
  const name = colorName.toLowerCase().trim();
  
  const separators = [
    { regex: /\s+&\s+/, joiner: ' & ' },
    { regex: /\s+and\s+/, joiner: ' & ' },
    { regex: /\s*\/\s*/, joiner: ' / ' },
    { regex: /\s*-\s*/, joiner: ' - ' }
  ];
  
  for (const sep of separators) {
    if (sep.regex.test(name)) {
      const parts = colorName.split(sep.regex);
      const translatedParts = parts.map(part => labelForColor(part.trim(), t));
      return translatedParts.join(sep.joiner);
    }
  }
  
  return labelForColor(colorName, t);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
/**
 * @param {{ colors: {name: string, hue?: number|null}[] }} props
 *   colors — array of dominant colour objects, one per outfit item.
 *   Pass the output of the parent's color-collection loop.
 */
export function HarmonyBadge({ colors }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const harmony = useMemo(
    () => computeHarmony(colors?.map((c) => c.name).filter(Boolean)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [colors?.map((c) => c.name).join('|')]
  );

  if (!harmony) return null;

  const cfg = VERDICT_CONFIG[harmony.verdict];

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="mt-2"
    >
      {/* Pill button */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold',
          'border transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]',
          cfg.bg, cfg.border, cfg.text
        )}
        data-testid="harmony-badge"
        aria-expanded={expanded}
        aria-label={t(cfg.labelKey, { defaultValue: harmony.verdict })}
      >
        {/* Animated gradient dot */}
        <span
          className={cn(
            'w-2 h-2 rounded-full bg-gradient-to-br flex-shrink-0',
            cfg.gradient
          )}
          aria-hidden="true"
        />
        <span className="mr-0.5" aria-hidden="true">{cfg.icon}</span>
        {t(cfg.labelKey, { defaultValue: harmony.verdict })}
        <span className="opacity-60 text-[10px] ms-0.5">{expanded ? '▲' : '▼'}</span>
      </button>

      {/* Expanded panel — palette + reasoning */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            key="harmony-expand"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div
              className={cn(
                'mt-1.5 rounded-xl border p-3 space-y-2',
                cfg.bg, cfg.border
              )}
            >
              {/* Colour swatches */}
              {harmony.palette?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {harmony.palette.map((c, i) => {
                    const bg = getCssBackground(c.name);
                    const displayName = translateColorName(c.name, t);
                    return (
                      <div
                        key={`${c.name}-${i}`}
                        className="flex items-center gap-1"
                        title={displayName}
                      >
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-black/10 flex-shrink-0"
                          style={{
                            background: bg,
                          }}
                          aria-hidden="true"
                        />
                        <span className={cn('text-[10px] capitalize', cfg.text)}>
                          {displayName}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Reasoning string */}
              <p className={cn('text-[11px] leading-snug', cfg.text)}>
                {t(harmony.reason, {
                  defaultValue: harmony.verdict === 'harmonious'
                    ? 'These colours work together beautifully.'
                    : harmony.verdict === 'clashing'
                    ? 'These colours create a bold contrast — intentional or risky.'
                    : 'A balanced palette with complementary tones.',
                })}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default HarmonyBadge;
