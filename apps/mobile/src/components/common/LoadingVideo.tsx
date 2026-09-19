/**
 * apps/mobile/src/components/common/LoadingVideo.tsx
 *
 * Polished luxury loading component for closet & outfit operations.
 * Uses native Animated pulse and ActivityIndicator in brand forest emerald (#1F5C45).
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Text, ActivityIndicator, Animated } from 'react-native';
import * as Lucide from 'lucide-react-native';
import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii } from '@mobile/theme/tokens';
import { useTranslation } from 'react-i18next';

interface LoadingVideoProps {
  message?: string | null;
  size?: number;
}

export function LoadingVideo({ message, size = 120 }: LoadingVideoProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.bubbleWrapper,
          {
            width: size,
            height: size,
            backgroundColor: colors.secondary || '#F5EEE9',
            borderColor: colors.border,
            transform: [{ scale: pulseAnim }],
          },
        ]}
      >
        <View style={styles.iconCircle}>
          <Lucide.Sparkles size={28} color={colors.accent || '#1F5C45'} />
        </View>
        <ActivityIndicator
          size="small"
          color={colors.accent || '#1F5C45'}
          style={styles.spinner}
        />
      </Animated.View>

      {message !== null && (
        <Text style={[styles.message, { color: colors.foreground }]}>
          {message || t('closet.loadingWardrobe', { defaultValue: 'Loading your wardrobe…' })}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[6],
    minHeight: 240,
  },
  bubbleWrapper: {
    borderRadius: radii.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1F5C45',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  iconCircle: {
    marginBottom: spacing[1],
  },
  spinner: {
    marginTop: spacing[1],
  },
  message: {
    marginTop: spacing[4],
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
    textAlign: 'center',
  },
});

export default LoadingVideo;
