/**
 * apps/mobile/src/components/WeightedList.tsx
 *
 * Editable percentage list of materials/colors with live validation.
 * Parity with apps/web/src/components/WeightedList.jsx.
 */

import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Lucide from 'lucide-react-native';

import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii } from '@mobile/theme/tokens';

export interface WeightedItem {
  name: string;
  pct: number | null;
}

interface WeightedListProps {
  label?: string;
  labelKey?: string;
  items: WeightedItem[];
  onChange: (items: WeightedItem[]) => void;
  placeholder?: string;
  disabled?: boolean;
  testid?: string;
}

export function WeightedList({
  label,
  labelKey,
  items,
  onChange,
  placeholder,
  disabled,
  testid,
}: WeightedListProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const safe = Array.isArray(items) ? items : [];
  const sum = safe.reduce((s, it) => s + (Number(it.pct) || 0), 0);

  const update = (i: number, patch: Partial<WeightedItem>) => {
    onChange(safe.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  };

  const remove = (i: number) => {
    onChange(safe.filter((_, j) => j !== i));
  };

  const add = () => {
    onChange([...safe, { name: '', pct: 0 }]);
  };

  const heading = labelKey ? t(labelKey, { defaultValue: label || '' }) : label;

  const sumColor =
    sum === 100 ? '#10b981' : sum > 100 ? '#ef4444' : colors.mutedFg;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={[styles.heading, { color: colors.mutedFg }]}>{heading}</Text>
        <Text style={[styles.sumBadge, { color: sumColor }]}>{sum}%</Text>
      </View>

      <View style={styles.list}>
        {safe.map((it, i) => (
          <View key={i} style={styles.row}>
            <TextInput
              style={[
                styles.nameInput,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  color: colors.foreground,
                },
              ]}
              value={it.name || ''}
              onChangeText={(text) => update(i, { name: text })}
              placeholder={placeholder || t('common.name', { defaultValue: 'Name' })}
              placeholderTextColor={colors.mutedFg}
              editable={!disabled}
            />

            <TextInput
              style={[
                styles.pctInput,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  color: colors.foreground,
                },
              ]}
              value={it.pct != null ? String(it.pct) : ''}
              onChangeText={(text) => {
                const num = text === '' ? null : Math.max(0, Math.min(100, Number(text) || 0));
                update(i, { pct: num });
              }}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={colors.mutedFg}
              editable={!disabled}
            />

            <Text style={[styles.pctSymbol, { color: colors.mutedFg }]}>%</Text>

            <TouchableOpacity
              onPress={() => remove(i)}
              disabled={disabled}
              style={[styles.removeBtn, { backgroundColor: colors.secondary }]}
            >
              <Lucide.Trash2 size={14} color="#ef4444" />
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity
          onPress={add}
          disabled={disabled}
          style={[styles.addBtn, { borderColor: colors.border }]}
        >
          <Lucide.Plus size={14} color={colors.accent} />
          <Text style={[styles.addBtnText, { color: colors.accent }]}>
            {t('addItem.addAction', { defaultValue: 'Add entry' })}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing[2],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[2],
  },
  heading: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sumBadge: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
  },
  list: {
    gap: spacing[2],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  nameInput: {
    flex: 1,
    height: 38,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing[3],
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
  },
  pctInput: {
    width: 60,
    height: 38,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing[2],
    textAlign: 'center',
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.sm,
  },
  pctSymbol: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
  },
  removeBtn: {
    width: 38,
    height: 38,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 36,
    borderRadius: radii.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    gap: spacing[2],
    marginTop: 4,
  },
  addBtnText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.xs,
  },
});
