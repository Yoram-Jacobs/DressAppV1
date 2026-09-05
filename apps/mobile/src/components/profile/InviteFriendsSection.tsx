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
} from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Lucide from 'lucide-react-native';

import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii } from '@mobile/theme/tokens';

export const GOOGLE_PLAY_URL = 'https://play.google.com/store/apps/details?id=com.project.dressapp';

interface InviteProps {
  userId?: string;
}

export function InviteFriendsSection({ userId }: InviteProps) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();

  const inviteUrl = userId
    ? `https://dressapp.co/?ref=${userId}`
    : 'https://dressapp.co/?ref=invite';

  const handleShare = async () => {
    try {
      const shareMessage = `${t('profile.inviteShareMessage', { defaultValue: "I'm using DressApp to organize my closet and style outfits with AI! Join here:" })} ${inviteUrl}\n\nGet DressApp on Google Play: ${GOOGLE_PLAY_URL}`;
      await Share.share({
        title: t('profile.inviteSubject', { defaultValue: 'Join me on DressApp' }),
        message: shareMessage,
        url: inviteUrl,
      });
    } catch {
      Alert.alert(t('common.error', { defaultValue: 'Error' }), t('profile.shareFailed', { defaultValue: 'Failed to share invite link.' }));
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
              {t('profile.inviteBody', { defaultValue: 'Share your personal referral link to invite friends. You both receive bonus AI credits!' })}
            </Text>
          </View>
        </View>

        <View style={[styles.urlBox, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <Text style={[styles.urlText, { color: colors.foreground }]} numberOfLines={1}>
            {inviteUrl}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.shareBtn, { backgroundColor: colors.accent }]}
          onPress={handleShare}
          activeOpacity={0.85}
        >
          <Lucide.Share2 size={15} color="#FFF" />
          <Text style={styles.shareBtnText}>
            {t('profile.shareLink', { defaultValue: 'Share Invite Link' })}
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
});
