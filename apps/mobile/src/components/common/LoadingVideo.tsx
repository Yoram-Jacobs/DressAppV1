/**
 * apps/mobile/src/components/common/LoadingVideo.tsx
 *
 * Dedicated video loading animation component playing loading.mp4 on repeat (looping).
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, ActivityIndicator } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Asset } from 'expo-asset';
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
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [videoError, setVideoError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const asset = Asset.fromModule(require('../../../assets/loading.mp4'));
        if (!asset.localUri) {
          await asset.downloadAsync();
        }
        if (isMounted) {
          setVideoUri(asset.localUri || asset.uri);
        }
      } catch (e) {
        console.warn('Failed to load loading.mp4 asset:', e);
        if (isMounted) setVideoError(true);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const player = useVideoPlayer(videoUri, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  return (
    <View style={styles.container}>
      <View style={[styles.videoWrapper, { width: size, height: size }]}>
        {videoUri && !videoError && player ? (
          <VideoView
            player={player}
            contentFit="contain"
            nativeControls={false}
            style={styles.video}
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
