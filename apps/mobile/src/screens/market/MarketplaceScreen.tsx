/**
 * apps/mobile/src/screens/market/MarketplaceScreen.tsx
 *
 * Marketplace — browse swap/sell/donate listings.
 * Core loop: api.listListings() → FlatList grid, filter by type, tap → ListingDetail.
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, Image, ActivityIndicator, I18nManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii } from '@mobile/theme/tokens';
import { api } from '@mobile/lib/api';
import type { MarketStackParamList } from '@mobile/navigation/types';

type MarketNavProp = NativeStackNavigationProp<MarketStackParamList, 'Marketplace'>;

interface Listing {
  id: string;
  title?: string;
  price_cents?: number;
  currency?: string;
  listing_type?: 'sale' | 'swap' | 'donate';
  image_url?: string;
  thumbnail_data_url?: string;
  brand?: string;
  size?: string;
}

const TYPES = ['all', 'sale', 'swap', 'donate'] as const;

export function MarketplaceScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<MarketNavProp>();
  const { colors } = useTheme();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeType, setActiveType] = useState<string>('all');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params = activeType !== 'all' ? { listing_type: activeType } : {};
      const data = await api.listListings(params);
      setListings(Array.isArray(data) ? data : (data?.listings ?? []));
    } catch { /* silent */ } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [activeType]);

  useEffect(() => { load(); }, [load]);

  const s = makeStyles(colors);
  const isRtl = I18nManager.isRTL;

  const renderItem = ({ item }: { item: Listing }) => {
    const thumb = item.thumbnail_data_url ?? item.image_url;
    const priceLabel = item.listing_type === 'donate'
      ? t('market.free', 'Free')
      : item.listing_type === 'swap'
        ? t('market.swap', 'Swap')
        : item.price_cents != null
          ? `${(item.price_cents / 100).toFixed(2)} ${item.currency ?? '€'}`
          : '—';

    return (
      <TouchableOpacity
        style={s.card}
        onPress={() => navigation.navigate('ListingDetail', { listingId: item.id })}
        activeOpacity={0.78}
      >
        <View style={s.cardImg}>
          {thumb
            ? <Image source={{ uri: thumb }} style={s.img} resizeMode="cover" />
            : <View style={[s.img, s.imgPlaceholder]}><Text style={{ fontSize: 32 }}>🛍</Text></View>}
        </View>
        <View style={s.cardBody}>
          <Text style={s.cardTitle} numberOfLines={2}>{item.title ?? '—'}</Text>
          {item.brand ? <Text style={s.cardMeta}>{item.brand}{item.size ? ` · ${item.size}` : ''}</Text> : null}
          <Text style={s.priceLabel}>{priceLabel}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <View style={[s.header, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
        <Text style={s.headerTitle}>{t('market.title', 'Marketplace')}</Text>
        <TouchableOpacity onPress={() => navigation.navigate('CreateListing')} style={s.addBtn}>
          <Text style={s.addBtnText}>＋ {t('market.sell', 'Sell')}</Text>
        </TouchableOpacity>
      </View>
      {/* Type filter */}
      <View style={[s.filters, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
        {TYPES.map((type) => (
          <TouchableOpacity key={type} style={[s.chip, activeType === type && s.chipActive]} onPress={() => setActiveType(type)}>
            <Text style={[s.chipText, activeType === type && s.chipTextActive]}>
              {type === 'all' ? t('closet.filterAll', 'All') : t(`market.${type}`, type)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {loading
        ? <View style={s.center}><ActivityIndicator color={colors.accent} size="large" /></View>
        : <FlatList
            data={listings}
            renderItem={renderItem}
            keyExtractor={(i) => i.id}
            numColumns={2}
            columnWrapperStyle={s.row}
            contentContainerStyle={s.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={colors.accent} />}
            ListEmptyComponent={<View style={s.center}><Text style={s.emptyText}>{t('market.empty', 'No listings yet.')}</Text></View>}
          />}
    </SafeAreaView>
  );
}

function makeStyles(c: ReturnType<typeof import('@mobile/theme').useTheme>['colors']) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[8] },
    header: { alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[5], paddingVertical: spacing[3] },
    headerTitle: { fontFamily: fonts.display, fontSize: fontSizes['2xl'], color: c.foreground },
    addBtn: { backgroundColor: c.foreground, paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radii.lg },
    addBtnText: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: c.background },
    filters: { gap: spacing[2], paddingHorizontal: spacing[5], paddingBottom: spacing[3] },
    chip: { paddingHorizontal: spacing[3], paddingVertical: spacing[1], borderRadius: radii.xl, backgroundColor: c.muted, borderWidth: 1, borderColor: c.border },
    chipActive: { backgroundColor: c.foreground, borderColor: c.foreground },
    chipText: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.xs, color: c.mutedFg },
    chipTextActive: { color: c.background },
    list: { padding: spacing[4], paddingBottom: spacing[24] },
    row: { gap: spacing[3] },
    card: { flex: 1, backgroundColor: c.card, borderRadius: radii.lg, overflow: 'hidden', borderWidth: 1, borderColor: c.border },
    cardImg: { width: '100%', aspectRatio: 3 / 4 },
    img: { width: '100%', height: '100%' },
    imgPlaceholder: { backgroundColor: c.muted, alignItems: 'center', justifyContent: 'center' },
    cardBody: { padding: spacing[2], gap: 2 },
    cardTitle: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: c.foreground },
    cardMeta: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: c.mutedFg },
    priceLabel: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: c.accent },
    emptyText: { fontFamily: fonts.body, fontSize: fontSizes.base, color: c.mutedFg, textAlign: 'center' },
  });
}
