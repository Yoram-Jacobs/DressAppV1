/**
 * apps/mobile/src/components/profile/CampaignNotificationsSection.tsx
 *
 * Campaign Notifications accordion section for DressApp mobile.
 * Features:
 *   - Notification Frequency: Instant, Daily, Weekly (framed chips)
 *   - Max Distance Radius: 5km, 10km, 25km, 50km (framed chips)
 *   - Notification toggle channels (Local Fashion, Sale Alerts, New Expert Near Me, Sustainable Fashion, Luxury Promos)
 *   - Framed borders selection feedback throughout
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Switch,
  StyleSheet,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii } from '@mobile/theme/tokens';

const FREQUENCIES = [
  { id: 'instant', label: 'Instant' },
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
];

const DISTANCES = [
  { id: '5', label: '5 km' },
  { id: '10', label: '10 km' },
  { id: '25', label: '25 km' },
  { id: '50', label: '50 km' },
];

const CHANNELS = [
  { key: 'local_fashion_push', labelKey: 'localFashionPush', defaultLabel: 'Local Fashion Alerts' },
  { key: 'sale_alerts', labelKey: 'saleAlerts', defaultLabel: 'Brand Sale & Discount Alerts' },
  { key: 'new_expert_near_me', labelKey: 'newExpertNearMe', defaultLabel: 'New Stylists & Experts Nearby' },
  { key: 'sustainable_fashion', labelKey: 'sustainableFashion', defaultLabel: 'Sustainable & Vintage Drops' },
  { key: 'luxury_promos', labelKey: 'luxuryPromos', defaultLabel: 'Luxury Fashion Promotions' },
];

interface CampaignProps {
  frequency: string;
  setFrequency: (val: string) => void;
  maxDistance: string;
  setMaxDistance: (val: string) => void;
  channels: Record<string, boolean>;
  toggleChannel: (key: string) => void;
}

export function CampaignNotificationsSection({
  frequency = 'daily',
  setFrequency,
  maxDistance = '25',
  setMaxDistance,
  channels = {},
  toggleChannel,
}: CampaignProps) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();

  return (
    <View style={styles.container}>
      {/* Frequency Chips */}
      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.foreground }]}>
          {t('campaigns.notifications.frequencyLabel', { defaultValue: 'Alert Frequency' })}
        </Text>
        <View style={styles.chipsContainer}>
          {FREQUENCIES.map((f) => {
            const isSelected = (frequency || '').toLowerCase() === f.id.toLowerCase();
            return (
              <TouchableOpacity
                key={f.id}
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
                onPress={() => setFrequency(f.id)}
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
                  {t(`campaigns.notifications.freq_${f.id}`, { defaultValue: f.label })}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Max Distance Radius */}
      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.foreground }]}>
          {t('campaigns.notifications.distanceLabel', { defaultValue: 'Maximum Discovery Radius' })}
        </Text>
        <View style={styles.chipsContainer}>
          {DISTANCES.map((d) => {
            const isSelected = String(maxDistance) === d.id;
            return (
              <TouchableOpacity
                key={d.id}
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
                onPress={() => setMaxDistance(d.id)}
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
                  {t(`campaigns.notifications.dist_${d.id}`, { defaultValue: d.label })}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Notification Channel Switches */}
      <View style={styles.channelsList}>
        {CHANNELS.map((ch) => {
          const isEnabled = channels[ch.key] ?? true;
          return (
            <View
              key={ch.key}
              style={[styles.channelItem, { backgroundColor: colors.secondary, borderColor: colors.border }]}
            >
              <Text style={[styles.channelLabel, { color: colors.foreground }]}>
                {t(`campaigns.notifications.${ch.labelKey}`, { defaultValue: ch.defaultLabel })}
              </Text>
              <Switch
                value={isEnabled}
                onValueChange={() => toggleChannel(ch.key)}
                trackColor={{ false: colors.border, true: colors.accent }}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  field: {
    gap: spacing.xs,
  },
  label: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
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
  channelsList: {
    gap: spacing.xs,
    marginTop: 4,
  },
  channelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  channelLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.xs,
    flex: 1,
    paddingRight: spacing.sm,
  },
});
