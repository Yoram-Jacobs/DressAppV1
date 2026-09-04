/**
 * apps/mobile/src/components/profile/ShoppingAssistant.tsx
 *
 * AI Shopping Assistant, Budget & Retail Brand Preferences.
 */

import React from 'react';
import { View, Text, StyleSheet, TextInput, Switch, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Lucide from 'lucide-react-native';
import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii } from '@mobile/theme/tokens';

interface ShoppingAssistantProps {
  shoppingAssistantEnabled: boolean;
  setShoppingAssistantEnabled: (val: boolean) => void;
  monthlyBudget: string;
  setMonthlyBudget: (val: string) => void;
  preferredStores: string[];
  setPreferredStores: (val: string[]) => void;
  storeInput: string;
  setStoreInput: (val: string) => void;
  sustainableOnly: boolean;
  setSustainableOnly: (val: boolean) => void;
}

export function ShoppingAssistant({
  shoppingAssistantEnabled,
  setShoppingAssistantEnabled,
  monthlyBudget,
  setMonthlyBudget,
  preferredStores,
  setPreferredStores,
  storeInput,
  setStoreInput,
  sustainableOnly,
  setSustainableOnly,
}: ShoppingAssistantProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const handleAddStore = () => {
    const trimmed = storeInput.trim();
    if (trimmed && !preferredStores.includes(trimmed)) {
      setPreferredStores([...preferredStores, trimmed]);
      setStoreInput('');
    }
  };

  const handleRemoveStore = (name: string) => {
    setPreferredStores(preferredStores.filter((s) => s !== name));
  };

  return (
    <View style={styles.container}>
      {/* Enable Assistant switch */}
      <View style={[styles.switchRow, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
        <View style={styles.switchLabelContainer}>
          <Lucide.ShoppingBag size={20} color={shoppingAssistantEnabled ? colors.accent : colors.mutedFg} />
          <View style={styles.switchTexts}>
            <Text style={[styles.switchTitle, { color: colors.foreground }]}>
              {t('profile.shoppingAssistant', { defaultValue: 'AI Shopping & Gap Finder' })}
            </Text>
            <Text style={[styles.switchSubtitle, { color: colors.mutedFg }]}>
              {t('profile.shoppingAssistantDesc', {
                defaultValue: 'Analyzes gaps in your wardrobe and recommends high-ROI pieces.',
              })}
            </Text>
          </View>
        </View>
        <Switch
          value={shoppingAssistantEnabled}
          onValueChange={setShoppingAssistantEnabled}
          trackColor={{ false: colors.muted, true: colors.accent }}
        />
      </View>

      {shoppingAssistantEnabled && (
        <>
          {/* Monthly Budget */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.foreground }]}>
              {t('profile.monthlyBudget', { defaultValue: 'Target Monthly Clothing Budget ($ USD)' })}
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
              value={monthlyBudget}
              onChangeText={setMonthlyBudget}
              keyboardType="numeric"
              placeholder="250"
              placeholderTextColor={colors.mutedFg}
            />
          </View>

          {/* Sustainable filter */}
          <View style={styles.toggleRow}>
            <View style={styles.toggleTextCol}>
              <Text style={[styles.toggleTitle, { color: colors.foreground }]}>
                {t('profile.sustainableFocus', { defaultValue: 'Prioritize Sustainable Brands' })}
              </Text>
              <Text style={[styles.toggleSubtitle, { color: colors.mutedFg }]}>
                {t('profile.sustainableFocusDesc', {
                  defaultValue: 'Filter suggestions for verified eco-friendly, circular, and fair-trade fashion.',
                })}
              </Text>
            </View>
            <Switch
              value={sustainableOnly}
              onValueChange={setSustainableOnly}
              trackColor={{ false: colors.muted, true: colors.accent }}
            />
          </View>

          {/* Preferred Stores */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.foreground }]}>
              {t('profile.favoriteStores', { defaultValue: 'Favorite Stores & Brands' })}
            </Text>
            <View style={styles.storeInputRow}>
              <TextInput
                style={[
                  styles.storeInput,
                  { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border },
                ]}
                value={storeInput}
                onChangeText={setStoreInput}
                placeholder={t('profile.favoriteStoresPlaceholder', { defaultValue: 'e.g. Zara, COS, Arket, Acne Studios' })}
                placeholderTextColor={colors.mutedFg}
                onSubmitEditing={handleAddStore}
              />
              <TouchableOpacity
                style={[styles.addStoreBtn, { backgroundColor: colors.primary }]}
                onPress={handleAddStore}
              >
                <Lucide.Plus size={16} color="#FFF" />
              </TouchableOpacity>
            </View>

            {preferredStores.length > 0 && (
              <View style={styles.storeChipsRow}>
                {preferredStores.map((store) => (
                  <View
                    key={store}
                    style={[styles.storeChip, { backgroundColor: colors.secondary, borderColor: colors.border }]}
                  >
                    <Text style={[styles.storeChipText, { color: colors.foreground }]}>{store}</Text>
                    <TouchableOpacity onPress={() => handleRemoveStore(store)}>
                      <Lucide.X size={13} color={colors.mutedFg} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  switchLabelContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    flex: 1,
    paddingRight: spacing.sm,
  },
  switchTexts: {
    flex: 1,
  },
  switchTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.sm,
    marginBottom: 2,
  },
  switchSubtitle: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    lineHeight: 16,
  },
  field: {
    gap: 4,
  },
  label: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.xs,
  },
  input: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  toggleTextCol: {
    flex: 1,
    paddingRight: spacing.md,
  },
  toggleTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.xs + 1,
    marginBottom: 2,
  },
  toggleSubtitle: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs - 1,
    lineHeight: 16,
  },
  storeInputRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: 2,
  },
  storeInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
  },
  addStoreBtn: {
    width: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
  },
  storeChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  storeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  storeChipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.xs,
  },
});
