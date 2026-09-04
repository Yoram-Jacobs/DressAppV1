/**
 * apps/mobile/src/components/profile/DeveloperPanel.tsx
 *
 * Developer diagnostics, cache purging & API info.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Lucide from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii } from '@mobile/theme/tokens';

export function DeveloperPanel() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const handleClearCache = async () => {
    Alert.alert(
      t('profile.clearCache', { defaultValue: 'Purge Local Cache' }),
      t('profile.confirmClearCache', { defaultValue: 'This will reset image cache and local taxonomy lookup cache.' }),
      [
        { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
        {
          text: t('common.clear', { defaultValue: 'Clear' }),
          style: 'destructive',
          onPress: async () => {
            try {
              const keys = await AsyncStorage.getAllKeys();
              const nonAuthKeys = keys.filter(
                (k) => !k.includes('token') && !k.includes('user')
              );
              await AsyncStorage.multiRemove(nonAuthKeys);
              Alert.alert(t('common.success', { defaultValue: 'Success' }), t('profile.cachePurged', { defaultValue: 'Cache purged.' }));
            } catch (e) {
              Alert.alert(t('common.error', { defaultValue: 'Error' }), t('profile.clearCacheFailed', { defaultValue: 'Failed to clear cache.' }));
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.card, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, { color: colors.mutedFg }]}>
            {t('profile.devEnvironment', { defaultValue: 'Environment' })}:
          </Text>
          <Text style={[styles.infoValue, { color: colors.foreground }]}>
            {t('profile.devProduction', { defaultValue: 'Production (EAS)' })}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, { color: colors.mutedFg }]}>
            {t('profile.devAppVersion', { defaultValue: 'App Version' })}:
          </Text>
          <Text style={[styles.infoValue, { color: colors.foreground }]}>1.0.0 (Build 42)</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, { color: colors.mutedFg }]}>
            {t('profile.devApiHost', { defaultValue: 'API Host' })}:
          </Text>
          <Text style={[styles.infoValue, { color: colors.foreground }]}>https://dressapp.co</Text>
        </View>

        <TouchableOpacity
          style={[styles.clearBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={handleClearCache}
        >
          <Lucide.Trash2 size={14} color="#EF4444" />
          <Text style={[styles.clearBtnText, { color: '#EF4444' }]}>
            {t('profile.clearCacheBtn', { defaultValue: 'Purge Local App Cache' })}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  card: {
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
  },
  infoValue: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.xs,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    marginTop: spacing.xs,
  },
  clearBtnText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.xs,
  },
});
