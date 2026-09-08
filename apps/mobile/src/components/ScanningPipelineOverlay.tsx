/**
 * apps/mobile/src/components/ScanningPipelineOverlay.tsx
 *
 * Animated AI-scanning progress indicator.
 * Ports apps/web/src/components/ScanningPipeline.jsx to React Native.
 *
 * Usage:
 *   <ScanningPipelineOverlay visible={isScanning} variant="block" />
 *
 * variant="block"  → centered full overlay (used during camera scan processing)
 * variant="inline" → slim one-liner status bar (used inside form during upload)
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii } from '@mobile/theme/tokens';

interface Props {
  visible?: boolean;
  variant?: 'block' | 'inline';
}

const STEP_ICONS = ['🔍', '🎨', '👕', '✨', '🪄'];

export function ScanningPipelineOverlay({ visible = true, variant = 'block' }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const steps = [
    t('scanning.bounds', { defaultValue: 'Detecting Garment Bounds…' }),
    t('scanning.colors', { defaultValue: 'Extracting Color Palette…' }),
    t('scanning.silhouette', { defaultValue: 'Analyzing Silhouette…' }),
    t('scanning.materials', { defaultValue: 'Inferring Fabric Materials…' }),
    t('scanning.tags', { defaultValue: 'Generating Stylist Tags…' }),
  ];

  const [idx, setIdx] = useState(0);
  const fadeAnim = React.useRef(new Animated.Value(1)).current;
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  // Step cycling — 1500 ms per step (matches web)
  useEffect(() => {
    if (!visible) return;
    const timer = setInterval(() => {
      // Fade out → update → fade in
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true, easing: Easing.out(Easing.ease) }).start(() => {
        setIdx((prev) => (prev + 1) % steps.length);
        Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true, easing: Easing.in(Easing.ease) }).start();
      });
    }, 1500);
    return () => clearInterval(timer);
  }, [visible, steps.length, fadeAnim]);

  // Icon pulse loop
  useEffect(() => {
    if (!visible) return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.18, duration: 700, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(pulseAnim, { toValue: 0.85, duration: 700, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [visible, pulseAnim]);

  if (!visible) return null;

  if (variant === 'inline') {
    return (
      <View style={[inlineS.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Animated.Text style={[inlineS.icon, { transform: [{ scale: pulseAnim }], color: colors.accent }]}>
          {STEP_ICONS[idx]}
        </Animated.Text>
        <Animated.Text style={[inlineS.label, { opacity: fadeAnim, color: colors.foreground }]}>
          {steps[idx]}
        </Animated.Text>
      </View>
    );
  }

  return (
    <View style={[blockS.root, { backgroundColor: colors.background + 'E8' }]}>
      <Animated.Text style={[blockS.icon, { transform: [{ scale: pulseAnim }] }]}>
        {STEP_ICONS[idx]}
      </Animated.Text>
      <Animated.Text style={[blockS.label, { opacity: fadeAnim, color: colors.accent }]}>
        {steps[idx]}
      </Animated.Text>
      <Text style={[blockS.sub, { color: colors.mutedFg }]}>
        {t('scanning.sub', { defaultValue: 'AI analysis in progress…' })}
      </Text>
    </View>
  );
}

const blockS = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[3],
    zIndex: 100,
  },
  icon: { fontSize: 64 },
  label: {
    fontFamily: fonts.display,
    fontSize: fontSizes.xl,
    textAlign: 'center',
    paddingHorizontal: spacing[6],
  },
  sub: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
  },
});

const inlineS = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    padding: spacing[2],
    borderRadius: radii.md,
    borderWidth: 1,
  },
  icon: { fontSize: 16 },
  label: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, flex: 1 },
});
