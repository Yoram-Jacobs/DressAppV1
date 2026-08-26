/**
 * apps/mobile/src/tw/image.tsx
 *
 * CSS-wrapped Image component.
 */

import { useCssElement } from 'react-native-css';
import React from 'react';
import { StyleSheet, Image as RNImage, ImageProps as RNImageProps } from 'react-native';

export type ImageProps = RNImageProps & {
  className?: string;
  contentFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
};

function CSSImage(props: any) {
  const { objectFit, objectPosition, ...style } =
    StyleSheet.flatten(props.style) || {};

  return (
    <RNImage
      {...props}
      resizeMode={props.contentFit || objectFit || props.resizeMode || 'cover'}
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
