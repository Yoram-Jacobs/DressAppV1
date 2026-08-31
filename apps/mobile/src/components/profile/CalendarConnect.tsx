/**
 * apps/mobile/src/components/profile/CalendarConnect.tsx
 *
 * Google Calendar sync accordion section for DressApp mobile.
 * Features:
 *   - Shows connected / disconnected status badge
 *   - Google account display
 *   - Connect / Disconnect action buttons
 *   - Framed borders and themed styling
 */

import React, { useState, useEffect } from 'react';
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
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii } from '@mobile/theme/tokens';
import { api } from '@mobile/lib/api';

export function CalendarConnect() {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ connected: boolean; google_email?: string | null }>({
    connected: false,
  });

  const checkStatus = async () => {
    try {
      const s = await api.calendarStatus();
      setStatus(s || { connected: false });
    } catch {
      setStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  const handleConnect = async () => {
    setBusy(true);
    try {
      const res = await api.googleOAuthStart();
      if (!res?.authorization_url) {
        throw new Error('No authorization URL returned');
      }

      const returnUrl = Linking.createURL('auth/callback');
      const result = await WebBrowser.openAuthSessionAsync(
        res.authorization_url,
        returnUrl
      );

      if (result.type === 'success') {
        Alert.alert(t('common.success', { defaultValue: 'Success' }), t('calendar.connectedSuccess', { defaultValue: 'Google Calendar connected!' }));
        await checkStatus();
      }
    } catch (err: any) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        err?.message || t('calendar.connectFailedGeneric', { defaultValue: 'Failed to connect Google Calendar.' })
      );
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    setBusy(true);
    try {
      await api.googleOAuthDisconnect();
      setStatus({ connected: false, google_email: null });
      Alert.alert(t('common.success', { defaultValue: 'Success' }), t('calendar.disconnectedSuccess', { defaultValue: 'Google Calendar disconnected.' }));
    } catch {
      Alert.alert(t('common.error', { defaultValue: 'Error' }), t('calendar.disconnectFailed', { defaultValue: 'Failed to disconnect calendar.' }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.statusCard,
          {
            backgroundColor: status.connected
              ? isDark
                ? 'rgba(35, 139, 130, 0.15)'
                : 'rgba(31, 111, 107, 0.08)'
              : colors.secondary,
            borderColor: status.connected ? colors.accent : colors.border,
          },
        ]}
      >
        <View style={styles.statusHeader}>
          <Lucide.Calendar
            size={20}
            color={status.connected ? colors.accent : colors.mutedFg}
          />
          <View style={styles.statusTextCol}>
            <View style={styles.badgeRow}>
              <Text style={[styles.statusTitle, { color: colors.foreground }]}>
                {t('calendar.title', { defaultValue: 'Google Calendar' })}
              </Text>
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: status.connected
                      ? isDark
                        ? 'rgba(35, 139, 130, 0.35)'
                        : 'rgba(31, 111, 107, 0.18)'
                      : colors.border,
                    borderColor: status.connected ? colors.accent : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    { color: status.connected ? colors.accent : colors.mutedFg },
                  ]}
                >
                  {loading
                    ? t('common.checking', { defaultValue: 'Checking...' })
                    : status.connected
                    ? t('calendar.connectedBadge', { defaultValue: '✓ Connected' })
                    : t('calendar.notConnected', { defaultValue: 'Not Connected' })}
                </Text>
              </View>
            </View>
            {status.connected && status.google_email && (
              <Text style={[styles.emailText, { color: colors.mutedFg }]}>
                {t('calendar.signedInAs', { defaultValue: 'Signed in as' })} {status.google_email}
              </Text>
            )}
          </View>
        </View>

        <Text style={[styles.description, { color: colors.mutedFg }]}>
          {t('calendar.offlineHint', { defaultValue: 'Connect your Google account to automatically export styled outfits as calendar events.' })}
        </Text>

        <View style={styles.actionRow}>
          {status.connected ? (
            <TouchableOpacity
              style={[styles.disconnectBtn, { borderColor: colors.border }]}
              onPress={handleDisconnect}
              disabled={busy}
            >
              <Lucide.Unlink size={15} color={colors.foreground} />
              <Text style={[styles.disconnectBtnText, { color: colors.foreground }]}>
                {t('calendar.disconnect', { defaultValue: 'Disconnect Calendar' })}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.connectBtn, { backgroundColor: colors.accent }]}
              onPress={handleConnect}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Lucide.Link size={15} color="#FFF" />
                  <Text style={styles.connectBtnText}>
                    {t('calendar.connect', { defaultValue: 'Connect Google Calendar' })}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  statusCard: {
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    gap: spacing.sm,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  statusTextCol: {
    flex: 1,
    gap: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  statusTitle: {
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
  emailText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
  },
  description: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    lineHeight: 16,
  },
  actionRow: {
    marginTop: 4,
  },
  connectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: radii.full,
  },
  connectBtnText: {
    color: '#FFF',
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
  },
  disconnectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  disconnectBtnText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.xs,
  },
});
