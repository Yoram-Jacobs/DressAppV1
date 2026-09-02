/**
 * apps/mobile/src/tw/animated.tsx
 *
 * CSS-wrapped Animated components.
 */

import { View as TWView, Text as TWText } from './index';
import RNAnimated from 'react-native-reanimated';

export const Animated = {
  ...RNAnimated,
  View: RNAnimated.createAnimatedComponent(TWView),
  Text: RNAnimated.createAnimatedComponent(TWText),
};
