/**
 * apps/mobile/src/components/profile/HairSection.tsx
 *
 * Hair characteristics accordion section for DressApp mobile.
 * Features:
 *   - Hair Length: Short, Medium, Long (framed chips)
 *   - Hair Type: Straight, Wavy, Curly, Coily (framed chips)
 *   - Hair Color & Style text inputs
 *   - Framed borders selection feedback
 */

import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii } from '@mobile/theme/tokens';

const HAIR_LENGTHS = ['short', 'medium', 'long'];
const HAIR_TYPES = ['straight', 'wavy', 'curly', 'coily'];

interface HairSectionProps {
  hairLength: string;
  setHairLength: (val: string) => void;
  hairType: string;
  setHairType: (val: string) => void;
  hairColor: string;
  setHairColor: (val: string) => void;
  hairStyle: string;
  setHairStyle: (val: string) => void;
}

export function HairSection({
  hairLength,
  setHairLength,
  hairType,
  setHairType,
  hairColor,
  setHairColor,
  hairStyle,
  setHairStyle,
}: HairSectionProps) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();

  return (
    <View style={styles.container}>
      {/* Hair Length */}
      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.foreground }]}>
          {t('profile.hairFields.length', { defaultValue: 'Hair Length' })}
        </Text>
        <View style={styles.chipsContainer}>
          {HAIR_LENGTHS.map((len) => {
            const isSelected = (hairLength || '').toLowerCase() === len.toLowerCase();
            return (
              <TouchableOpacity
                key={len}
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
                onPress={() => setHairLength(len)}
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
                  {t(`profile.hairFields.length_${len}`, { defaultValue: len.charAt(0).toUpperCase() + len.slice(1) })}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Hair Type */}
      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.foreground }]}>
          {t('profile.hairFields.type', { defaultValue: 'Hair Type' })}
        </Text>
        <View style={styles.chipsContainer}>
          {HAIR_TYPES.map((type) => {
            const isSelected = (hairType || '').toLowerCase() === type.toLowerCase();
            return (
              <TouchableOpacity
                key={type}
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
                onPress={() => setHairType(type)}
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
                  {t(`profile.hairFields.type_${type}`, { defaultValue: type.charAt(0).toUpperCase() + type.slice(1) })}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Hair Color & Hair Style Inputs */}
      <View style={styles.row}>
        <View style={styles.halfField}>
          <Text style={[styles.label, { color: colors.foreground }]}>
            {t('profile.hairFields.color', { defaultValue: 'Hair Color' })}
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
            value={hairColor}
            onChangeText={setHairColor}
            placeholder={t('profile.hairColorPlaceholder', { defaultValue: 'e.g. Dark Brown, Blonde' })}
            placeholderTextColor={colors.mutedFg}
          />
        </View>
        <View style={styles.halfField}>
          <Text style={[styles.label, { color: colors.foreground }]}>
            {t('profile.hairFields.style', { defaultValue: 'Hair Style' })}
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
            value={hairStyle}
            onChangeText={setHairStyle}
            placeholder={t('profile.hairStylePlaceholder', { defaultValue: 'e.g. Layered Bob, Buzz' })}
            placeholderTextColor={colors.mutedFg}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  halfField: {
    flex: 1,
    gap: 4,
  },
  field: {
    gap: 4,
  },
  label: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
  },
  input: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    fontSize: fontSizes.sm,
    fontFamily: fonts.body,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radii.full,
  },
  chipText: {
    fontSize: fontSizes.xs,
  },
});
