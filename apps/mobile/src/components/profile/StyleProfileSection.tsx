/**
 * apps/mobile/src/components/profile/StyleProfileSection.tsx
 *
 * Fashion Aesthetics, Fit preferences, and Style Archetype profile section.
 */

import React from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Lucide from 'lucide-react-native';
import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii } from '@mobile/theme/tokens';

interface StyleProfileProps {
  selectedAesthetics: string[];
  toggleAesthetic: (val: string) => void;
  fitPreference: string;
  setFitPreference: (val: string) => void;
  colorsToAvoid: string[];
  setColorsToAvoid: (val: string[]) => void;
  avoidInput: string;
  setAvoidInput: (val: string) => void;
  preferredDressCode: string;
  setPreferredDressCode: (val: string) => void;
}

const AESTHETIC_OPTIONS = [
  'Minimalist',
  'Streetwear',
  'Old Money',
  'Classic Chic',
  'Bohemian',
  'Casual Smart',
  'Parisian',
  'Scandinavian',
  'Y2K & Retro',
  'Avant-Garde',
  'Athleisure',
  'Quiet Luxury',
];

const FIT_OPTIONS = ['Oversized', 'Relaxed', 'Regular', 'Slim / Tailored', 'Skinny'];

const DRESS_CODES = ['Casual', 'Smart Casual', 'Business Casual', 'Cocktail', 'Formal', 'Street'];

export function StyleProfileSection({
  selectedAesthetics,
  toggleAesthetic,
  fitPreference,
  setFitPreference,
  colorsToAvoid,
  setColorsToAvoid,
  avoidInput,
  setAvoidInput,
  preferredDressCode,
  setPreferredDressCode,
}: StyleProfileProps) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();

  const handleAddAvoidColor = () => {
    const trimmed = avoidInput.trim();
    if (trimmed && !colorsToAvoid.includes(trimmed)) {
      setColorsToAvoid([...colorsToAvoid, trimmed]);
      setAvoidInput('');
    }
  };

  const handleRemoveAvoidColor = (colorName: string) => {
    setColorsToAvoid(colorsToAvoid.filter((c) => c !== colorName));
  };

  return (
    <View style={styles.container}>
      {/* Aesthetics */}
      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.foreground }]}>
          {t('profile.styleAesthetics', { defaultValue: 'Your Favorite Fashion Aesthetics & Vibes' })}
        </Text>
        <Text style={[styles.hint, { color: colors.mutedFg }]}>
          {t('profile.aestheticsHint', { defaultValue: 'Select styles that resonate with you to guide the AI Stylist.' })}
        </Text>
        <View style={styles.chipsContainer}>
          {AESTHETIC_OPTIONS.map((style) => {
            const isSelected = selectedAesthetics.includes(style);
            return (
              <TouchableOpacity
                key={style}
                style={[
                  styles.chip,
                  {
                    backgroundColor: isSelected
                      ? isDark
                        ? 'rgba(35, 139, 130, 0.22)'
                        : 'rgba(31, 111, 107, 0.12)'
                      : colors.secondary,
                    borderColor: isSelected ? colors.accent : colors.border,
                    borderWidth: isSelected ? 2 : 1,
                  },
                ]}
                onPress={() => toggleAesthetic(style)}
              >
                {isSelected && <Lucide.Sparkles size={11} color={colors.accent} style={{ marginRight: 4 }} />}
                <Text
                  style={[
                    styles.chipText,
                    {
                      color: isSelected ? colors.foreground : colors.mutedFg,
                      fontFamily: isSelected ? fonts.bodyBold : fonts.bodyMedium,
                    },
                  ]}
                >
                  {style}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Fit Preference */}
      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.foreground }]}>
          {t('profile.fitPreference', { defaultValue: 'Preferred Clothing Silhouette / Fit' })}
        </Text>
        <View style={styles.chipsContainer}>
          {FIT_OPTIONS.map((fit) => {
            const isSelected = fitPreference === fit;
            return (
              <TouchableOpacity
                key={fit}
                style={[
                  styles.chip,
                  {
                    backgroundColor: isSelected
                      ? isDark
                        ? 'rgba(35, 139, 130, 0.22)'
                        : 'rgba(31, 111, 107, 0.12)'
                      : colors.secondary,
                    borderColor: isSelected ? colors.accent : colors.border,
                    borderWidth: isSelected ? 2 : 1,
                  },
                ]}
                onPress={() => setFitPreference(fit)}
              >
                <Text
                  style={[
                    styles.chipText,
                    {
                      color: isSelected ? colors.foreground : colors.mutedFg,
                      fontFamily: isSelected ? fonts.bodyBold : fonts.bodyMedium,
                    },
                  ]}
                >
                  {fit}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Preferred Dress Code */}
      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.foreground }]}>
          {t('profile.defaultDressCode', { defaultValue: 'Default Daily Dress Code' })}
        </Text>
        <View style={styles.chipsContainer}>
          {DRESS_CODES.map((dc) => {
            const isSelected = preferredDressCode === dc;
            return (
              <TouchableOpacity
                key={dc}
                style={[
                  styles.chip,
                  {
                    backgroundColor: isSelected
                      ? isDark
                        ? 'rgba(35, 139, 130, 0.22)'
                        : 'rgba(31, 111, 107, 0.12)'
                      : colors.secondary,
                    borderColor: isSelected ? colors.accent : colors.border,
                    borderWidth: isSelected ? 2 : 1,
                  },
                ]}
                onPress={() => setPreferredDressCode(dc)}
              >
                <Text
                  style={[
                    styles.chipText,
                    {
                      color: isSelected ? colors.foreground : colors.mutedFg,
                      fontFamily: isSelected ? fonts.bodyBold : fonts.bodyMedium,
                    },
                  ]}
                >
                  {dc}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Colors to Avoid */}
      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.foreground }]}>
          {t('profile.colorsToAvoid', { defaultValue: 'Colors to Avoid' })}
        </Text>
        <View style={styles.avoidInputRow}>
          <TextInput
            style={[
              styles.avoidInput,
              { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border },
            ]}
            value={avoidInput}
            onChangeText={setAvoidInput}
            placeholder={t('profile.addColorPlaceholder', { defaultValue: 'e.g. Neon Yellow, Orange' })}
            placeholderTextColor={colors.mutedFg}
            onSubmitEditing={handleAddAvoidColor}
          />
          <TouchableOpacity
            style={[styles.addAvoidBtn, { backgroundColor: colors.primary }]}
            onPress={handleAddAvoidColor}
          >
            <Lucide.Plus size={16} color="#FFF" />
          </TouchableOpacity>
        </View>

        {colorsToAvoid.length > 0 && (
          <View style={styles.avoidChipsRow}>
            {colorsToAvoid.map((col) => (
              <View
                key={col}
                style={[styles.avoidChip, { backgroundColor: 'rgba(239, 68, 68, 0.12)', borderColor: 'rgba(239, 68, 68, 0.3)' }]}
              >
                <Text style={[styles.avoidChipText, { color: '#EF4444' }]}>{col}</Text>
                <TouchableOpacity onPress={() => handleRemoveAvoidColor(col)}>
                  <Lucide.X size={13} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
  },
  field: {
    gap: 4,
  },
  label: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
  },
  hint: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs - 1,
    lineHeight: 16,
    marginBottom: 4,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  chipText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.xs,
  },
  avoidInputRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: 2,
  },
  avoidInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
  },
  addAvoidBtn: {
    width: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
  },
  avoidChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  avoidChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  avoidChipText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.xs,
  },
});
