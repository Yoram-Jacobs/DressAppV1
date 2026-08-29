/**
 * apps/mobile/src/components/common/LoadingVideo.tsx
 *
 * Dedicated video loading animation component playing loading.mp4 on repeat (looping).
 */

import React, { useState } from 'react';
import { View, StyleSheet, Text, ActivityIndicator } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing } from '@mobile/theme/tokens';
import { useTranslation } from 'react-i18next';

interface LoadingVideoProps {
  message?: string | null;
  size?: number;
}

export function LoadingVideo({ message, size = 220 }: LoadingVideoProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [videoError, setVideoError] = useState(false);

  return (
    <View style={styles.container}>
      <View style={[styles.videoWrapper, { width: size, height: size }]}>
        {!videoError ? (
          <Video
            source={require('../../../assets/loading.mp4')}
            rate={1.0}
            volume={0.0}
            isMuted={true}
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay
            isLooping
            style={styles.video}
            onError={() => setVideoError(true)}
          />
        ) : (
          <ActivityIndicator size="large" color={colors.accent} />
        )}
      </View>
      {message !== null && (
        <Text style={[styles.message, { color: colors.mutedFg }]}>
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
  },
  videoWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  message: {
    marginTop: spacing[3],
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
    textAlign: 'center',
  },
});
