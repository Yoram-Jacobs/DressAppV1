/**
 * apps/mobile/src/components/WorkProgressFloater.tsx
 *
 * Floating glassmorphic pill indicating active background AI segmentation & batch processing.
 * Parity with apps/web/src/components/WorkProgressFloater.jsx.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Lucide from 'lucide-react-native';

import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii } from '@mobile/theme/tokens';
import { useWorkStore } from '@mobile/lib/stores/workStore';

export function WorkProgressFloater() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { jobs, activeCount, completedCount } = useWorkStore();

  const [linger, setLinger] = useState(false);
  const active = activeCount > 0;

  useEffect(() => {
    if (active) {
      setLinger(true);
      return undefined;
    }
    const timer = setTimeout(() => setLinger(false), 2000);
    return () => clearTimeout(timer);
  }, [active]);

  if (!active && !linger) return null;

  const total = activeCount + completedCount;
  const pct = total > 0 ? Math.min(100, Math.round((completedCount / total) * 100)) : 0;

  const label =
    total > 0
      ? t('floater.analyzing', {
          defaultValue: 'Analysing {{n}}/{{m}} items',
          n: completedCount,
          m: total,
        })
      : t('floater.analyzingPhotos', {
          defaultValue: 'Analysing item…',
          count: activeCount,
        });

  return (
    <View style={styles.floaterWrapper} pointerEvents="none">
      <View
        style={[
          styles.pill,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        {active ? (
          <View style={styles.row}>
            <Lucide.Sparkles size={16} color={colors.accent} />
            <Text style={[styles.label, { color: colors.foreground }]} numberOfLines={1}>
              {label}
            </Text>
          </View>
        ) : (
          <View style={styles.row}>
            <Lucide.CheckCircle2 size={16} color="#10b981" />
            <Text style={[styles.label, { color: colors.foreground }]}>
              {t('floater.done', { defaultValue: 'All done' })}
            </Text>
          </View>
        )}

        {total > 0 && active ? (
          <View style={[styles.progressBarBg, { backgroundColor: colors.muted }]}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${Math.max(5, pct)}%`, backgroundColor: colors.accent },
              ]}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  floaterWrapper: {
    position: 'absolute',
    bottom: 80,
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 999,
  },
  pill: {
    width: '100%',
    maxWidth: 320,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius: radii.xl,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
    gap: spacing[2],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  label: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.xs,
    flex: 1,
  },
  progressBarBg: {
    height: 4,
    borderRadius: radii.full,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: radii.full,
  },
});
