/**
 * apps/mobile/src/components/profile/InviteFriendsSection.tsx
 *
 * Invite Friends accordion section for DressApp mobile.
 * Features:
 *   - Native Share trigger (WhatsApp, iMessage, SMS, Mail)
 *   - Copy referral link
 *   - Bonus credit incentive description
 *   - Framed borders and themed styling
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Share,
  Alert,
  Linking,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Lucide from 'lucide-react-native';

import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii } from '@mobile/theme/tokens';

export const GOOGLE_PLAY_BASE_URL = 'https://play.google.com/store/apps/details?id=com.project.dressapp';

export function getGooglePlayAffiliateUrl(userId?: string) {
  if (!userId) return GOOGLE_PLAY_BASE_URL;
  return `${GOOGLE_PLAY_BASE_URL}&referrer=${encodeURIComponent(`ref=${userId}`)}`;
}

interface InviteProps {
  userId?: string;
}

export function InviteFriendsSection({ userId }: InviteProps) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<'web' | 'playstore'>('web');

  const webInviteUrl = userId
    ? `https://dressapp.co/?ref=${userId}`
    : 'https://dressapp.co/?ref=invite';

  const playStoreInviteUrl = getGooglePlayAffiliateUrl(userId);
  const activeUrl = activeTab === 'web' ? webInviteUrl : playStoreInviteUrl;

  const handleShareWeb = async () => {
    try {
      const shareMessage = `${t('profile.inviteShareMessage', {
        defaultValue: "I'm using DressApp to organize my closet and style outfits with AI! Join here:",
      })} ${webInviteUrl}\n\nGet DressApp on Google Play: ${playStoreInviteUrl}`;
      await Share.share({
        title: t('profile.inviteSubject', { defaultValue: 'Join me on DressApp' }),
        message: shareMessage,
        url: webInviteUrl,
      });
    } catch {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('profile.shareFailed', { defaultValue: 'Failed to share invite link.' })
      );
    }
  };

  const handleShareGooglePlay = async () => {
    try {
      const shareMessage = `${t('profile.invitePlayStoreMessage', {
        defaultValue: "I'm using DressApp to organize my closet and style outfits with AI! Get it on Google Play:",
      })} ${playStoreInviteUrl}`;
      await Share.share({
        title: t('profile.inviteSubject', { defaultValue: 'Join me on DressApp' }),
        message: shareMessage,
        url: playStoreInviteUrl,
      });
    } catch {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('profile.shareFailed', { defaultValue: 'Failed to share invite link.' })
      );
    }
  };

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.card,
          {
            backgroundColor: isDark
              ? 'rgba(35, 139, 130, 0.15)'
              : 'rgba(31, 111, 107, 0.08)',
            borderColor: colors.accent,
          },
        ]}
      >
        <View style={styles.header}>
          <Lucide.Users size={22} color={colors.accent} />
          <View style={styles.headerTextCol}>
            <Text style={[styles.title, { color: colors.foreground }]}>
              {t('profile.inviteTitle', { defaultValue: 'Invite Friends & Stylists' })}
            </Text>
            <Text style={[styles.sub, { color: colors.mutedFg }]}>
              {t('profile.inviteBody', {
                defaultValue: 'Share your personal referral link to invite friends. You both receive bonus AI credits!',
              })}
            </Text>
          </View>
        </View>

        {/* Link Type Selector */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[
              styles.tabPill,
              activeTab === 'web' && { backgroundColor: colors.accent, borderColor: colors.accent },
              activeTab !== 'web' && {
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                borderColor: colors.border,
              },
            ]}
            onPress={() => setActiveTab('web')}
            activeOpacity={0.75}
          >
            <Lucide.Globe size={13} color={activeTab === 'web' ? '#FFF' : colors.mutedFg} />
            <Text
              style={[
                styles.tabPillText,
                { color: activeTab === 'web' ? '#FFF' : colors.mutedFg },
              ]}
            >
              {t('profile.inviteWebTab', { defaultValue: 'Web Link' })}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabPill,
              activeTab === 'playstore' && { backgroundColor: colors.accent, borderColor: colors.accent },
              activeTab !== 'playstore' && {
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                borderColor: colors.border,
              },
            ]}
            onPress={() => setActiveTab('playstore')}
            activeOpacity={0.75}
          >
            <Lucide.Smartphone size={13} color={activeTab === 'playstore' ? '#FFF' : colors.mutedFg} />
            <Text
              style={[
                styles.tabPillText,
                { color: activeTab === 'playstore' ? '#FFF' : colors.mutedFg },
              ]}
            >
              {t('profile.invitePlayStoreTab', { defaultValue: 'Google Play Link' })}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Active Affiliate Link Box */}
        <View style={[styles.urlBox, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <Text style={[styles.urlText, { color: colors.foreground }]} numberOfLines={1}>
            {activeUrl}
          </Text>
        </View>

        {/* Share Buttons */}
        <TouchableOpacity
          style={[styles.shareBtn, { backgroundColor: colors.accent }]}
          onPress={handleShareWeb}
          activeOpacity={0.85}
        >
          <Lucide.Share2 size={15} color="#FFF" />
          <Text style={styles.shareBtnText}>
            {t('profile.shareLink', { defaultValue: 'Share Invite Link' })}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.playStoreBtn,
            {
              borderColor: colors.accent,
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
            },
          ]}
          onPress={handleShareGooglePlay}
          activeOpacity={0.75}
        >
          <Lucide.Share2 size={14} color={colors.accent} />
          <Text style={[styles.playStoreBtnText, { color: colors.accent }]}>
            {t('profile.shareGooglePlay', { defaultValue: 'Share Google Play Link' })}
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
  title: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.sm,
  },
  sub: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    lineHeight: 16,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  tabPillText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
  },
  urlBox: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  urlText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.xs,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: radii.full,
  },
  shareBtnText: {
    color: '#FFF',
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
  },
  playStoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  playStoreBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
  },
});

