/**
 * apps/mobile/src/components/common/ScrollToTopFloater.tsx
 *
 * Fast Scroll-to-Top Floating Action Button (FAB).
 * Appears when the user scrolls down beyond a threshold,
 * providing instant one-tap smooth scrolling back to top.
 *
 * Matches DressApp design system:
 *   - Circular purple FAB (tokens.lightColors.brand / tokens.darkColors.brand)
 *   - White ArrowUp icon
 *   - Editorial elevation and shadow
 *   - Smooth animated scroll to top
 */

import React from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Lucide from 'lucide-react-native';

import { useTheme } from '@mobile/theme';

export interface ScrollToTopFloaterProps {
  /** Whether the button is visible (typically scrollY > 200/250) */
  visible: boolean;
  /** Action executed when tapped — e.g. ref.current?.scrollToOffset({ offset: 0, animated: true }) */
  onPress?: () => void;
  /** Optional scroll reference (FlatList or ScrollView) for automatic scrolling */
  scrollRef?: React.RefObject<any>;
  /** Distance from the bottom of the container (default: 20) */
  bottom?: number;
  /** Distance from the right edge of the container (default: 20) */
  right?: number;
  /** Distance from the left edge of the container (optional override) */
  left?: number;
  /** Custom size of the circular button (default: 44) */
  size?: number;
  /** Optional container style override */
  style?: StyleProp<ViewStyle>;
}

export function ScrollToTopFloater({
  visible,
  onPress,
  scrollRef,
  bottom = 20,
  right = 20,
  left,
  size = 44,
  style,
}: ScrollToTopFloaterProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  if (!visible) return null;

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else if (scrollRef?.current) {
      if (typeof scrollRef.current.scrollToOffset === 'function') {
        scrollRef.current.scrollToOffset({ offset: 0, animated: true });
      } else if (typeof scrollRef.current.scrollTo === 'function') {
        scrollRef.current.scrollTo({ y: 0, animated: true });
      }
    }
  };

  const dynamicStyle: ViewStyle = {
    bottom,
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: colors.brand || '#9333ea',
  };

  if (left !== undefined) {
    dynamicStyle.left = left;
  } else {
    dynamicStyle.right = right;
  }

  return (
    <TouchableOpacity
      style={[styles.btn, dynamicStyle, style]}
      onPress={handlePress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={t('common.scrollToTop', { defaultValue: 'Scroll to top' })}
    >
      <Lucide.ArrowUp size={20} color="#FFFFFF" strokeWidth={2.5} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
});
