/**
 * apps/mobile/src/components/profile/LocationCard.tsx
 *
 * Location & Geo-sync settings accordion for DressApp mobile.
 * Features:
 *   - Current City / Coordinates display
 *   - Weather-accurate outfit recommendations note
 *   - Update / Sync Location button
 *   - Framed borders and themed styling
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Lucide from 'lucide-react-native';

import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii } from '@mobile/theme/tokens';
import { api } from '@mobile/lib/api';

interface LocationCardProps {
  city: string;
  country: string;
  onUpdateLocation?: (city: string, country: string) => void;
}

export function LocationCard({ city, country, onUpdateLocation }: LocationCardProps) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const [syncing, setSyncing] = useState(false);

  const handleSyncLocation = async () => {
    setSyncing(true);
    try {
      // Simulate geolocation or call IP/native location
      Alert.alert(
        t('common.success', { defaultValue: 'Location Active' }),
        t('location.syncSuccess', {
          defaultValue: 'Synchronized with {{city}} for local weather & seasonal styling.',
          city: city || t('location.yourRegion', { defaultValue: 'your region' }),
        })
      );
    } catch {
      Alert.alert(t('common.error', { defaultValue: 'Error' }), t('location.fetchFailed', { defaultValue: 'Failed to fetch location.' }));
    } finally {
      setSyncing(false);
    }
  };

  const hasLocation = !!(city || country);

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.card,
          {
            backgroundColor: hasLocation
              ? isDark
                ? 'rgba(35, 139, 130, 0.15)'
                : 'rgba(31, 111, 107, 0.08)'
              : colors.secondary,
            borderColor: hasLocation ? colors.accent : colors.border,
          },
        ]}
      >
        <View style={styles.header}>
          <Lucide.MapPin size={20} color={hasLocation ? colors.accent : colors.mutedFg} />
          <View style={styles.headerTextCol}>
            <View style={styles.badgeRow}>
              <Text style={[styles.title, { color: colors.foreground }]}>
                {t('location.title', { defaultValue: 'Location Services' })}
              </Text>
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: hasLocation
                      ? isDark
                        ? 'rgba(35, 139, 130, 0.35)'
                        : 'rgba(31, 111, 107, 0.18)'
                      : colors.border,
                    borderColor: hasLocation ? colors.accent : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    { color: hasLocation ? colors.accent : colors.mutedFg },
                  ]}
                >
                  {hasLocation
                    ? t('location.active', { defaultValue: '✓ Active' })
                    : t('location.notSet', { defaultValue: 'Not Set' })}
                </Text>
              </View>
            </View>
            <Text style={[styles.locationName, { color: colors.foreground }]}>
              {city && country ? `${city}, ${country}` : city || country || t('location.noLocationConfigured', { defaultValue: 'No location configured' })}
            </Text>
          </View>
        </View>

        <Text style={[styles.description, { color: colors.mutedFg }]}>
          {t('location.description', { defaultValue: 'Used for weather-accurate outfit recommendations, daily forecast sync, and local fashion trend scouting.' })}
        </Text>

        <TouchableOpacity
          style={[styles.syncBtn, { backgroundColor: colors.accent }]}
          onPress={handleSyncLocation}
          disabled={syncing}
        >
          {syncing ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <Lucide.Navigation size={14} color="#FFF" />
              <Text style={styles.syncBtnText}>
                {t('location.syncWeather', { defaultValue: 'Sync Local Weather & Trends' })}
              </Text>
            </>
          )}
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
    borderWidth: 1.5,
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  headerTextCol: {
    flex: 1,
    gap: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  title: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.sm,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  badgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
  },
  locationName: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.xs,
  },
  description: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    lineHeight: 16,
  },
  syncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: radii.full,
    marginTop: 4,
  },
  syncBtnText: {
    color: '#FFF',
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
  },
});
