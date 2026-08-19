/**
 * apps/mobile/src/screens/market/ListingDetailScreen.tsx
 *
 * Core loop: api.getListing(id) → show image, title, price, type, description.
 * Buy (sale), propose swap, or claim donation button based on listing_type.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, Image, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, I18nManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii } from '@mobile/theme/tokens';
import { api } from '@mobile/lib/api';
import type { MarketStackParamList } from '@mobile/navigation/types';

type ListingDetailNavProp = NativeStackNavigationProp<MarketStackParamList, 'ListingDetail'>;
type ListingDetailRouteProp = RouteProp<MarketStackParamList, 'ListingDetail'>;

interface Listing {
  id: string;
  title?: string;
  description?: string;
  price_cents?: number;
  currency?: string;
  listing_type?: 'sale' | 'swap' | 'donate';
  image_url?: string;
  brand?: string;
  size?: string;
  condition?: string;
  seller?: { name?: string };
}

export function ListingDetailScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<ListingDetailNavProp>();
  const route = useRoute<ListingDetailRouteProp>();
  const { colors } = useTheme();
  const { listingId } = route.params;

  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setListing(await api.getListing(listingId)); }
    catch { /* handled below */ } finally { setLoading(false); }
  }, [listingId]);

  useEffect(() => { load(); }, [load]);

  const handleAction = async () => {
    if (!listing) return;
    setActing(true);
    try {
      if (listing.listing_type === 'sale') {
        const order = await api.listingBuyCreate(listing.id);
        // Navigate to transaction landing with the order/transaction ID
        const txId = order?.transaction_id ?? order?.id ?? listing.id;
        navigation.navigate('TransactionLanding', { transactionId: txId });
      } else if (listing.listing_type === 'donate') {
        const result = await api.claimDonation(listing.id, 0);
        const txId = result?.transaction_id ?? result?.id ?? listing.id;
        navigation.navigate('TransactionLanding', { transactionId: txId });
      } else {
        // swap — show simple placeholder alert; full swap flow is out of scope for core loop
        Alert.alert(t('market.swapTitle', 'Propose a swap'), t('market.swapInfo', 'Swap flow coming soon — use the web app for now.'));
      }
    } catch (err: unknown) {
      Alert.alert(t('common.error', 'Error'), (err as { response?: { data?: { detail?: string } }; message?: string })?.response?.data?.detail ?? (err as { message?: string })?.message ?? 'Action failed');
    } finally { setActing(false); }
  };

  const s = makeStyles(colors);
  const isRtl = I18nManager.isRTL;

  if (loading) return <SafeAreaView style={[s.root, s.center]}><ActivityIndicator color={colors.accent} size="large" /></SafeAreaView>;
  if (!listing) return <SafeAreaView style={[s.root, s.center]}><Text style={s.errorText}>{t('common.notFound', 'Not found')}</Text></SafeAreaView>;

  const priceLabel = listing.listing_type === 'donate'
    ? t('market.free', 'Free to claim')
    : listing.listing_type === 'swap'
      ? t('market.swapLabel', 'Propose a swap')
      : listing.price_cents != null
        ? `${(listing.price_cents / 100).toFixed(2)} ${listing.currency ?? '€'}`
        : '—';

  const ctaLabel = listing.listing_type === 'donate'
    ? t('market.claimDonate', 'Claim for free')
    : listing.listing_type === 'swap'
      ? t('market.proposeSwap', 'Propose swap')
      : t('market.buy', 'Buy now');

  return (
    <SafeAreaView style={s.root} edges={['bottom']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {listing.image_url
          ? <Image source={{ uri: listing.image_url }} style={s.heroImage} resizeMode="contain" />
          : <View style={[s.heroImage, s.heroPlaceholder]}><Text style={{ fontSize: 80 }}>🛍</Text></View>}

        <View style={s.body}>
          <Text style={s.title}>{listing.title ?? '—'}</Text>
          <Text style={s.price}>{priceLabel}</Text>

          <View style={[s.metaRow, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
            {listing.brand ? <Text style={s.metaBadge}>{listing.brand}</Text> : null}
            {listing.size ? <Text style={s.metaBadge}>{listing.size}</Text> : null}
            {listing.condition ? <Text style={s.metaBadge}>{listing.condition}</Text> : null}
          </View>

          {listing.description ? <Text style={s.description}>{listing.description}</Text> : null}
          {listing.seller?.name ? <Text style={s.seller}>{t('market.seller', 'Seller')}: {listing.seller.name}</Text> : null}
        </View>
      </ScrollView>

      <View style={s.footer}>
        <TouchableOpacity style={[s.cta, acting && s.ctaDisabled]} onPress={handleAction} disabled={acting}>
          {acting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.ctaText}>{ctaLabel}</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function makeStyles(c: ReturnType<typeof import('@mobile/theme').useTheme>['colors']) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    center: { alignItems: 'center', justifyContent: 'center' },
    heroImage: { width: '100%', aspectRatio: 1, backgroundColor: c.muted },
    heroPlaceholder: { alignItems: 'center', justifyContent: 'center' },
    body: { padding: spacing[5], gap: spacing[3] },
    title: { fontFamily: fonts.display, fontSize: fontSizes['2xl'], color: c.foreground },
    price: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xl, color: c.accent },
    metaRow: { gap: spacing[2], flexWrap: 'wrap' },
    metaBadge: { backgroundColor: c.muted, paddingHorizontal: spacing[2], paddingVertical: 3, borderRadius: radii.sm, fontFamily: fonts.body, fontSize: fontSizes.xs, color: c.mutedFg },
    description: { fontFamily: fonts.body, fontSize: fontSizes.base, color: c.foreground, lineHeight: 24 },
    seller: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: c.mutedFg },
    footer: { padding: spacing[5], borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.background },
    cta: { backgroundColor: c.foreground, borderRadius: radii.md, paddingVertical: spacing[4], alignItems: 'center' },
    ctaDisabled: { opacity: 0.6 },
    ctaText: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.base, color: c.background },
    errorText: { fontFamily: fonts.body, fontSize: fontSizes.base, color: c.destructive },
  });
}
