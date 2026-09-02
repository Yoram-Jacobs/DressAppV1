/**
 * apps/mobile/src/components/AdTicker.tsx
 *
 * Horizontal running ad & local campaign ticker strip for DressApp mobile.
 * Parity with apps/web/src/components/AdTicker.jsx.
 */

import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  I18nManager,
} from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import * as Lucide from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';

import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii } from '@mobile/theme/tokens';
import { api, campaignApi } from '@mobile/lib/api';

interface AdTickerProps {
  placement?: string;
  limit?: number;
  style?: any;
}

export function AdTicker({ placement = 'footer', limit = 6, style }: AdTickerProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<any>();

  const [ads, setAds] = useState<any[]>([]);
  const [idx, setIdx] = useState(0);
  const trackedRef = useRef(new Set<string>());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [adsRes, campaignsRes] = await Promise.allSettled([
          (api as any).adTicker?.({ limit }).catch(() => ({ items: [] })),
          (campaignApi as any).getCampaignFeed?.({ ticker: true, limit: 4 }).catch(() => ({ items: [] })),
        ]);

        if (cancelled) return;

        const adItems = adsRes.status === 'fulfilled' ? adsRes.value?.items || [] : [];
        const campaignItems = campaignsRes.status === 'fulfilled' ? campaignsRes.value?.items || [] : [];

        const normalisedCampaigns = campaignItems.map((c: any) => ({
          id: `campaign::${c.id}`,
          _campaignId: c.id,
          _isCampaign: true,
          creative: {
            headline: c.title,
            body: c.business_name,
            image_url: c.cover_image_url || null,
            cta_label: c.discount_pct ? `${c.discount_pct}% OFF` : null,
            cta_url: `dressapp://campaigns/${c.id}`,
          },
        }));

        const merged: any[] = [];
        const maxLen = Math.max(adItems.length, normalisedCampaigns.length);
        for (let i = 0; i < maxLen; i++) {
          if (i < adItems.length) merged.push(adItems[i]);
          if (i < normalisedCampaigns.length) merged.push(normalisedCampaigns[i]);
        }

        setAds(merged.slice(0, limit * 2));
      } catch {
        if (!cancelled) setAds([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [limit]);

  // Auto-rotate every 5s
  useEffect(() => {
    if (ads.length <= 1) return;
    const interval = setInterval(() => {
      setIdx((prev) => (prev + 1) % ads.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [ads.length]);

  // Impression tracking
  useEffect(() => {
    const current = ads[idx];
    if (!current?.id || trackedRef.current.has(current.id)) return;
    trackedRef.current.add(current.id);
    if (current._isCampaign) {
      (campaignApi as any).trackCampaignView?.(current._campaignId).catch(() => {});
    } else {
      (api as any).trackAdImpression?.(current.id).catch(() => {});
    }
  }, [ads, idx]);

  const current = useMemo(() => ads[idx] || null, [ads, idx]);

  if (!ads.length || !current) return null;

  const creative = current.creative || {};

  const handlePress = () => {
    if (current._isCampaign && current._campaignId) {
      try {
        navigation.navigate('MeTab', {
          screen: 'CampaignDetail',
          params: { campaignId: current._campaignId },
        });
      } catch {
        // ignore
      }
    } else if (creative.cta_url) {
      Linking.openURL(creative.cta_url).catch(() => {});
      (api as any).trackAdClick?.(current.id).catch(() => {});
    }
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.card, borderTopColor: colors.border, borderBottomColor: colors.border },
        style,
      ]}
      testID={`ad-ticker-${placement}`}
    >
      <View style={styles.content}>
        <View style={styles.badgeRow}>
          <Lucide.Megaphone size={12} color={colors.accent} />
          <Text style={[styles.badgeText, { color: colors.mutedFg }]}>
            {current._isCampaign
              ? t('campaigns.card.limitedTime', { defaultValue: 'OFFER' })
              : t('ticker.label', { defaultValue: 'SPONSORED' })}
          </Text>
        </View>

        <TouchableOpacity
          onPress={handlePress}
          activeOpacity={0.8}
          style={styles.adContent}
        >
          {creative.image_url ? (
            <Image source={{ uri: creative.image_url }} style={styles.adImg} />
          ) : null}
          <Text style={[styles.adHeadline, { color: colors.foreground }]} numberOfLines={1}>
            {creative.headline}
          </Text>
          {creative.cta_label ? (
            <Text style={[styles.adCta, { color: colors.accent }]}>
              {creative.cta_label} →
            </Text>
          ) : null}
        </TouchableOpacity>

        {ads.length > 1 ? (
          <View style={styles.dotsRow}>
            {ads.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  { backgroundColor: i === idx ? colors.accent : colors.border },
                ]}
              />
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[4],
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  badgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  adContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginHorizontal: spacing[2],
  },
  adImg: {
    width: 20,
    height: 20,
    borderRadius: radii.full,
  },
  adHeadline: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.xs,
    flex: 1,
  },
  adCta: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
});
