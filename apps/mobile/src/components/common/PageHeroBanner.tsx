/**
 * apps/mobile/src/components/common/PageHeroBanner.tsx
 *
 * Editorial Page Hero Banner — 100% visual parity with apps/web/src/components/ui/PageHeroBanner.jsx.
 * Displays evocative backdrop imagery with an editorial dark gradient wash, supporting RTL mirroring.
 */

import React from 'react';
import { View, StyleSheet, I18nManager, StyleProp, ViewStyle, ImageSourcePropType, Platform } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface PageHeroBannerProps {
  image?: ImageSourcePropType | string | number | null;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  minHeight?: number;
}

export function PageHeroBanner({
  image,
  children,
  style,
  minHeight = 160,
}: PageHeroBannerProps) {
  const isRtl = I18nManager.isRTL;
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? 8 : 4);
  const resolvedSource = typeof image === 'string' ? { uri: image } : image;

  return (
    <View style={[styles.container, { minHeight: minHeight + topPadding }, style]}>
      {/* Background image */}
      {resolvedSource ? (
        <Image
          source={resolvedSource}
          style={[styles.bgImage, isRtl && styles.rtlFlip]}
          contentFit="cover"
          transition={300}
        />
      ) : (
        <View style={[styles.bgImage, { backgroundColor: '#101612' }]} />
      )}

      {/* Dark gradient wash: #080b09 (dark forest/black) -> rgba(16, 22, 18, 0.45) -> rgba(16, 22, 18, 0.08) */}
      <View style={[styles.gradientLayer, isRtl && styles.rtlFlip]} pointerEvents="none">
        <Svg width="100%" height="100%" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="heroGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor="#080B09" stopOpacity="0.95" />
              <Stop offset="45%" stopColor="#101612" stopOpacity="0.85" />
              <Stop offset="75%" stopColor="#101612" stopOpacity="0.5" />
              <Stop offset="100%" stopColor="#101612" stopOpacity="0.15" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#heroGradient)" />
        </Svg>
      </View>

      {/* Content */}
      <View style={[styles.content, { paddingTop: topPadding }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
    width: '100%',
    backgroundColor: '#080B09',
  },
  bgImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  rtlFlip: {
    transform: [{ scaleX: -1 }],
  },
  gradientLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  content: {
    position: 'relative',
    zIndex: 2,
    width: '100%',
  },
});

export default PageHeroBanner;
