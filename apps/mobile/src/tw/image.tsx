/**
 * apps/mobile/src/tw/image.tsx
 *
 * CSS-wrapped Image component.
 */

import { useCssElement } from 'react-native-css';
import React from 'react';
import { StyleSheet } from 'react-native';
import { Image as ExpoImage, ImageProps as ExpoImageProps } from 'expo-image';

export type ImageProps = ExpoImageProps & {
  className?: string;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'repeat' | 'center';
};

function CSSImage(props: any) {
  const { objectFit, objectPosition, ...style } =
    StyleSheet.flatten(props.style) || {};

  // Map legacy resizeMode or CSS objectFit to expo-image contentFit
  let fit = props.contentFit || objectFit;
  if (!fit && props.resizeMode) {
    if (props.resizeMode === 'stretch') fit = 'fill';
    else if (props.resizeMode === 'center') fit = 'none';
    else fit = props.resizeMode;
  }

  return (
    <ExpoImage
      cachePolicy="memory-disk"
      transition={150}
      {...props}
      contentFit={fit || 'cover'}
      source={
        typeof props.source === 'string' ? { uri: props.source } : props.source
      }
      style={style}
    />
  );
}

export const Image = (props: ImageProps) => {
  return useCssElement(CSSImage, props, { className: 'style' });
};

Image.displayName = 'CSS(Image)';
