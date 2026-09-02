/**
 * apps/mobile/src/components/profile/PayoutsSection.tsx
 *
 * Payout (PayPal) accordion section for DressApp mobile.
 * Features:
 *   - PayPal receiver email input
 *   - Description for marketplace sales & stylist consulting earnings
 *   - Framed borders and themed styling
 */

import React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Lucide from 'lucide-react-native';

import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii } from '@mobile/theme/tokens';

interface PayoutsSectionProps {
  paypalEmail: string;
  setPaypalEmail: (val: string) => void;
}

export function PayoutsSection({ paypalEmail, setPaypalEmail }: PayoutsSectionProps) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();

  const isLinked = !!paypalEmail.trim();

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.infoBox,
          {
            backgroundColor: isLinked
              ? isDark
                ? 'rgba(35, 139, 130, 0.15)'
                : 'rgba(31, 111, 107, 0.08)'
              : colors.secondary,
            borderColor: isLinked ? colors.accent : colors.border,
          },
        ]}
      >
        <View style={styles.headerRow}>
          <Lucide.CreditCard size={18} color={isLinked ? colors.accent : colors.mutedFg} />
          <Text style={[styles.infoTitle, { color: colors.foreground }]}>
            {t('profile.payouts.sectionTitle', { defaultValue: 'Payout Accounts (PayPal)' })}
          </Text>
          {isLinked && (
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: isDark ? 'rgba(35, 139, 130, 0.35)' : 'rgba(31, 111, 107, 0.18)',
                  borderColor: colors.accent,
                },
              ]}
            >
              <Text style={[styles.badgeText, { color: colors.accent }]}>
                {t('profile.payouts.linked', { defaultValue: 'Linked' })}
              </Text>
            </View>
          )}
        </View>

        <Text style={[styles.infoText, { color: colors.mutedFg }]}>
          {t('profile.payouts.description', { defaultValue: 'Provide your verified PayPal address to receive payouts from marketplace sales and styling consultations.' })}
        </Text>
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.foreground }]}>
          {t('profile.payouts.paypalEmail', { defaultValue: 'PayPal Receiver Email' })}
        </Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
          value={paypalEmail}
          onChangeText={setPaypalEmail}
          placeholder="payouts@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          placeholderTextColor={colors.mutedFg}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  infoBox: {
    padding: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  infoTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
    flex: 1,
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  badgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
  },
  infoText: {
    fontFamily: fonts.body,
    fontSize: 10.5,
    lineHeight: 15,
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
});
