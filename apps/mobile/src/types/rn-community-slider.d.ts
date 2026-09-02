/**
 * apps/mobile/src/types/@react-native-community/slider.d.ts
 * Ambient stub for @react-native-community/slider.
 * Superseded after npm install.
 */
declare module '@react-native-community/slider' {
  import type React from 'react';
  import type { StyleProp, ViewStyle } from 'react-native';

  export interface SliderProps {
    style?: StyleProp<ViewStyle>;
    value?: number;
    minimumValue?: number;
    maximumValue?: number;
    step?: number;
    minimumTrackTintColor?: string;
    maximumTrackTintColor?: string;
    thumbTintColor?: string;
    onValueChange?: (value: number) => void;
    onSlidingComplete?: (value: number) => void;
    disabled?: boolean;
    testID?: string;
  }

  const Slider: React.FC<SliderProps>;
  export default Slider;
}

