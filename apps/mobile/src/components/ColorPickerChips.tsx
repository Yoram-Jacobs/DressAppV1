/**
 * apps/mobile/src/components/ColorPickerChips.tsx
 *
 * Multi-select color chip picker for mobile.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, I18nManager } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii } from '@mobile/theme/tokens';
import { COLOR_OPTIONS, labelForColor } from '@mobile/lib/taxonomy';

interface ColorPickerChipsProps {
  selectedColors?: string[];
  selectedColor?: string;
  onChange?: (colors: string[]) => void;
  onSelectColor?: (color: string) => void;
}

export function ColorPickerChips({
  selectedColors = [],
  selectedColor,
  onChange,
  onSelectColor,
}: ColorPickerChipsProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const isRtl = I18nManager.isRTL;

  const currentSelection = selectedColor ? [selectedColor] : selectedColors;

  const toggleColor = (colorName: string) => {
    if (onSelectColor) {
      onSelectColor(colorName);
    } else if (onChange) {
      if (currentSelection.includes(colorName)) {
        onChange(currentSelection.filter((c) => c !== colorName));
      } else {
        onChange([...currentSelection, colorName]);
      }
    }
  };

  const s = makeStyles(colors);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[s.container, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}
    >
      {COLOR_OPTIONS.map((c) => {
        const isSelected = currentSelection.includes(c.name);
        const translatedName = labelForColor(c.name, t) || c.name;
        return (
          <TouchableOpacity
            key={c.name}
            style={[
              s.chip,
              isSelected && s.selectedChip,
            ]}
            onPress={() => toggleColor(c.name)}
            activeOpacity={0.7}
          >
            <View style={[s.swatch, { backgroundColor: c.hex }]} />
            <Text style={[s.chipText, isSelected && s.selectedChipText]}>
              {translatedName}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const makeStyles = (c: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    container: {
      gap: spacing[2],
      paddingVertical: spacing[1],
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[2],
      borderRadius: radii.xl,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.card,
    },
    selectedChip: {
      borderColor: c.foreground,
      backgroundColor: c.accent,
    },
    swatch: {
      width: 14,
      height: 14,
      borderRadius: 7,
      borderWidth: 1,
      borderColor: 'rgba(0,0,0,0.15)',
    },
    chipText: {
      fontFamily: fonts.body,
      fontSize: fontSizes.xs,
      color: c.foreground,
    },
    selectedChipText: {
      color: '#FFFFFF',
      fontFamily: fonts.bodyMedium,
    },
  });
