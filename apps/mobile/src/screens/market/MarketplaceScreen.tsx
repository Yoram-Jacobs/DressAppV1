/**
 * apps/mobile/src/screens/market/MarketplaceScreen.tsx
 *
 * Full-featured Marketplace Screen with 1:1 parity to apps/web/src/pages/Marketplace.jsx:
 *   - 3 Primary Tabs: Browse / My Listings / Orders & Transactions
 *   - Intent Modes: All, For Sale, Swap, Donate, Rent, Retail
 *   - Category Filters: All, Top, Bottom, Full Body, Outerwear, Footwear, Accessories
 *   - Search & Radius filters
 *   - Instant in-memory caching via useMarketplaceStore
 *   - Action to create listing from closet items
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  I18nManager,
  TextInput,
  ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import * as Lucide from 'lucide-react-native';

import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii } from '@mobile/theme/tokens';
import { useMarketplaceStore, ListingItem, TransactionItem } from '@mobile/lib/stores/marketplaceStore';
import { labelForCategory, labelForIntent, labelForCondition } from '@mobile/lib/taxonomy';
import { HelpFloater } from '@mobile/components/help';
import type { MarketStackParamList } from '@mobile/navigation/types';

type MarketNavProp = NativeStackNavigationProp<MarketStackParamList, 'Marketplace'>;

const INTENT_MODES = [
  { id: 'all', labelKey: 'closet.filterAll', fallback: 'All' },
  { id: 'for_sale', labelKey: 'taxonomy.intent.for_sale', fallback: 'For Sale' },
  { id: 'swap', labelKey: 'taxonomy.intent.swap', fallback: 'Swap' },
  { id: 'donate', labelKey: 'taxonomy.intent.donate', fallback: 'Donate' },
  { id: 'rent', labelKey: 'taxonomy.intent.rent', fallback: 'Rent' },
  { id: 'Retail', labelKey: 'taxonomy.source.retail', fallback: 'Retail' },
] as const;

const CATEGORY_TABS = [
  'all',
  'Top',
  'Bottom',
  'Full Body',
  'Outerwear',
  'Footwear',
  'Accessories',
] as const;

function matchesCategory(itemCat?: string, filterCat?: string): boolean {
  if (!filterCat || filterCat === 'all') return true;
  if (!itemCat) return false;
  const ic = itemCat.toLowerCase().trim();
  const fc = filterCat.toLowerCase().trim();
  if (ic === fc) return true;
  if (fc === 'accessories' && (ic.includes('accessor') || ic.includes('bag') || ic.includes('hat') || ic.includes('belt') || ic.includes('jewel') || ic.includes('scarf'))) return true;
  if (fc === 'full body' && (ic.includes('dress') || ic.includes('jumpsuit') || ic.includes('suit') || ic.includes('body') || ic.includes('romper') || ic.includes('full'))) return true;
  if (fc === 'top' && (ic.includes('top') || ic.includes('shirt') || ic.includes('tee') || ic.includes('sweater') || ic.includes('blouse') || ic.includes('hoodie') || ic.includes('tank'))) return true;
  if (fc === 'bottom' && (ic.includes('bottom') || ic.includes('pant') || ic.includes('jean') || ic.includes('short') || ic.includes('skirt') || ic.includes('trouser') || ic.includes('legging'))) return true;
  if (fc === 'outerwear' && (ic.includes('outer') || ic.includes('jacket') || ic.includes('coat') || ic.includes('blazer') || ic.includes('parka') || ic.includes('cardigan'))) return true;
  if (fc === 'footwear' && (ic.includes('foot') || ic.includes('shoe') || ic.includes('sneaker') || ic.includes('boot') || ic.includes('sandal') || ic.includes('heel') || ic.includes('flat'))) return true;
  return ic.includes(fc) || fc.includes(ic);
}

export function MarketplaceScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<MarketNavProp>();
  const { colors, isDark } = useTheme();
  const isRtl = I18nManager.isRTL;

  const [activeMainTab, setActiveMainTab] = useState<'browse' | 'my_listings' | 'transactions'>('browse');
  const [activeIntent, setActiveIntent] = useState<string>('all');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const {
    browseItems,
    myListings,
    transactions,
    loading,
    fetchBrowse,
    fetchMyListings,
    fetchTransactions,
  } = useMarketplaceStore();

  const loadData = useCallback(async (force = false) => {
    if (activeMainTab === 'browse') {
      if (force || browseItems.length === 0) {
        await fetchBrowse();
      }
    } else if (activeMainTab === 'my_listings') {
      if (force || myListings.length === 0) {
        await fetchMyListings();
      }
    } else if (activeMainTab === 'transactions') {
      if (force || transactions.length === 0) {
        await fetchTransactions();
      }
    }
  }, [activeMainTab, browseItems.length, myListings.length, transactions.length, fetchBrowse, fetchMyListings, fetchTransactions]);

  useEffect(() => {
    loadData();
  }, [activeMainTab]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData(true);
    setRefreshing(false);
  }, [loadData]);

  // Filtered browse list with instant 0ms client-side filtering
  const filteredBrowse = useMemo(() => {
    let list = browseItems;

    // Filter by Intent / Mode
    if (activeIntent !== 'all') {
      if (activeIntent === 'Retail') {
        list = list.filter((it: any) => it.source === 'Retail' || it.is_retail);
      } else if (activeIntent === 'for_sale') {
        list = list.filter((it: any) => (it.listing_type === 'sale' || it.listing_type === 'sell' || it.mode === 'sell' || it.mode === 'sale') && (it.price_cents > 0 || it.financial_metadata?.list_price_cents > 0));
      } else if (activeIntent === 'swap') {
        list = list.filter((it: any) => it.listing_type === 'swap' || it.mode === 'swap');
      } else if (activeIntent === 'donate') {
        list = list.filter((it: any) => it.listing_type === 'donate' || it.mode === 'donate' || it.price_cents === 0 || it.financial_metadata?.list_price_cents === 0);
      } else if (activeIntent === 'rent') {
        list = list.filter((it: any) => it.listing_type === 'rent' || it.mode === 'rent');
      }
    }

    // Filter by Category
    if (activeCategory !== 'all') {
      list = list.filter((it) => matchesCategory(it.category, activeCategory));
    }

    // Filter by Search text
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (it) =>
          it.title?.toLowerCase().includes(q) ||
          it.brand?.toLowerCase().includes(q) ||
          it.category?.toLowerCase().includes(q) ||
          it.description?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [browseItems, activeIntent, activeCategory, searchQuery]);

  const s = makeStyles(colors);

  const renderListingCard = ({ item }: { item: any }) => {
    const thumb =
      item.clean_image_url ||
      item.reconstructed_image_url ||
      (Array.isArray(item.images) && item.images[0]) ||
      item.thumbnail_data_url ||
      item.image_url;

    const isFree = item.listing_type === 'donate' || item.price_cents === 0;
    const isSwap = item.listing_type === 'swap';

    let priceTag = '—';
    if (isFree) {
      priceTag = t('market.free', { defaultValue: 'Free' });
    } else if (isSwap) {
      priceTag = t('market.swap', { defaultValue: 'Swap' });
    } else if (typeof item.price_cents === 'number' && !isNaN(item.price_cents)) {
      priceTag = `${(item.price_cents / 100).toFixed(2)} ${item.currency || '€'}`;
    }

    return (
      <TouchableOpacity
        style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => navigation.navigate('ListingDetail', { listingId: item.id })}
        activeOpacity={0.8}
      >
        <View style={[s.cardImageWrap, { backgroundColor: colors.cardOffWhite }]}>
          {thumb ? (
            <Image
              source={{ uri: thumb }}
              style={s.cardImage}
              resizeMode="contain"
            />
          ) : (
            <Lucide.ShoppingBag size={32} color={colors.mutedFg} />
          )}

          {/* Type Badge */}
          <View
            style={[
              s.typeBadge,
              {
                backgroundColor: isFree
                  ? 'rgba(16, 185, 129, 0.9)'
                  : isSwap
                  ? 'rgba(139, 92, 246, 0.9)'
                  : 'rgba(35, 139, 130, 0.9)',
              },
            ]}
          >
            <Text style={s.typeBadgeText}>
              {labelForIntent(item.listing_type, t) || item.listing_type || 'Sale'}
            </Text>
          </View>
        </View>

        <View style={s.cardInfo}>
          <Text style={[s.cardTitle, { color: colors.foreground }]} numberOfLines={1}>
            {item.title || t('market.garment', { defaultValue: 'Garment' })}
          </Text>

          <View style={s.cardMetaRow}>
            {item.brand ? (
              <Text style={[s.cardBrand, { color: colors.mutedFg }]} numberOfLines={1}>
                {item.brand}
              </Text>
            ) : null}
            {item.size ? (
              <Text style={[s.cardSize, { color: colors.mutedFg }]}>• {item.size}</Text>
            ) : null}
          </View>

          <Text style={[s.priceText, { color: colors.primary }]}>{priceTag}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderTransactionCard = ({ item }: { item: TransactionItem }) => (
    <View style={[s.txCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={s.txHeader}>
        <Text style={[s.txTitle, { color: colors.foreground }]}>{item.title}</Text>
        <View style={[s.statusPill, { backgroundColor: colors.secondary }]}>
          <Text style={[s.statusText, { color: colors.primary }]}>{item.status}</Text>
        </View>
      </View>
      <View style={s.txFooter}>
        <Text style={[s.txRole, { color: colors.mutedFg }]}>
          {item.role === 'buyer'
            ? t('market.buying', { defaultValue: 'Purchase' })
            : t('market.selling', { defaultValue: 'Sale' })}
        </Text>
        <Text style={[s.txAmount, { color: colors.foreground }]}>
          {item.amount_cents != null ? (item.amount_cents / 100).toFixed(2) : '0.00'} {item.currency || 'USD'}
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[s.root, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Top Header */}
      <View style={[s.header, { borderBottomColor: colors.border }]}>
        <View>
          <Text style={[s.preTitle, { color: colors.mutedFg }]}>
            {t('market.title', { defaultValue: 'Marketplace' })}
          </Text>
          <Text style={[s.headerTitle, { color: colors.foreground }]}>
            {t('market.hero', { defaultValue: 'Swap & Shop' })}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <HelpFloater screenTopic="marketplace" />
          <TouchableOpacity
            style={[s.createBtn, { backgroundColor: colors.primary }]}
            onPress={() => navigation.navigate('CreateListing')}
            activeOpacity={0.8}
          >
            <Lucide.Plus size={16} color="#FFF" />
            <Text style={s.createBtnText}>{t('market.sell', { defaultValue: 'List Item' })}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Tabs (Browse / My Listings / Transactions) */}
      <View style={[s.mainTabs, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[s.mainTabBtn, activeMainTab === 'browse' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
          onPress={() => setActiveMainTab('browse')}
        >
          <Lucide.Store size={16} color={activeMainTab === 'browse' ? colors.primary : colors.mutedFg} />
          <Text style={[s.mainTabLabel, { color: activeMainTab === 'browse' ? colors.primary : colors.mutedFg }]}>
            {t('market.browse', { defaultValue: 'Browse' })}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.mainTabBtn, activeMainTab === 'my_listings' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
          onPress={() => setActiveMainTab('my_listings')}
        >
          <Lucide.Tag size={16} color={activeMainTab === 'my_listings' ? colors.primary : colors.mutedFg} />
          <Text style={[s.mainTabLabel, { color: activeMainTab === 'my_listings' ? colors.primary : colors.mutedFg }]}>
            {t('market.myListings', { defaultValue: 'My Listings' })}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.mainTabBtn, activeMainTab === 'transactions' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
          onPress={() => setActiveMainTab('transactions')}
        >
          <Lucide.Receipt size={16} color={activeMainTab === 'transactions' ? colors.primary : colors.mutedFg} />
          <Text style={[s.mainTabLabel, { color: activeMainTab === 'transactions' ? colors.primary : colors.mutedFg }]}>
            {t('market.orders', { defaultValue: 'Orders' })}
          </Text>
        </TouchableOpacity>
      </View>

      {activeMainTab === 'browse' ? (
        <>
          {/* Search Bar */}
          <View style={[s.searchRow, { borderBottomColor: colors.border }]}>
            <View style={[s.searchBox, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <Lucide.Search size={16} color={colors.mutedFg} />
              <TextInput
                style={[s.searchInput, { color: colors.foreground }]}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder={t('market.searchPlaceholder', { defaultValue: 'Search listings, brands, styles…' })}
                placeholderTextColor={colors.mutedFg}
              />
              {searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Lucide.X size={16} color={colors.mutedFg} />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          {/* Mode / Intent Filter Chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={s.filterScrollView}
            contentContainerStyle={s.filterRow}
          >
            {INTENT_MODES.map((mode) => {
              const isSelected = activeIntent === mode.id;
              return (
                <TouchableOpacity
                  key={mode.id}
                  style={[
                    s.filterChip,
                    { backgroundColor: isSelected ? colors.primary : colors.card, borderColor: isSelected ? colors.primary : colors.border },
                  ]}
                  onPress={() => setActiveIntent(mode.id)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      s.filterChipText,
                      { color: isSelected ? '#FFF' : colors.mutedFg },
                    ]}
                  >
                    {t(mode.labelKey, { defaultValue: mode.fallback })}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Category Chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={s.categoryScrollView}
            contentContainerStyle={s.categoryRow}
          >
            {CATEGORY_TABS.map((cat) => {
              const isSelected = activeCategory === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  style={[
                    s.catChip,
                    { backgroundColor: isSelected ? 'rgba(35, 139, 130, 0.15)' : colors.secondary, borderColor: isSelected ? colors.primary : 'transparent' },
                  ]}
                  onPress={() => setActiveCategory(cat)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      s.catChipText,
                      { color: isSelected ? colors.primary : colors.mutedFg },
                    ]}
                  >
                    {cat === 'all' ? t('closet.filterAll', { defaultValue: 'All Categories' }) : labelForCategory(cat, t) || cat}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Listings Grid */}
          {loading && browseItems.length === 0 ? (
            <View style={s.center}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <FlatList
              key="market_browse_grid_2col"
              data={filteredBrowse}
              renderItem={renderListingCard}
              keyExtractor={(item, index) => item.id || `browse_${index}`}
              numColumns={2}
              columnWrapperStyle={s.gridRow}
              contentContainerStyle={s.listContent}
              initialNumToRender={8}
              maxToRenderPerBatch={8}
              windowSize={5}
              removeClippedSubviews={true}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
              }
              ListEmptyComponent={
                <View style={s.emptyState}>
                  <Lucide.Store size={48} color={colors.mutedFg} />
                  <Text style={[s.emptyTitle, { color: colors.foreground }]}>
                    {t('market.noListings', { defaultValue: 'No listings found' })}
                  </Text>
                  <Text style={[s.emptyDesc, { color: colors.mutedFg }]}>
                    {t('market.noListingsDesc', { defaultValue: 'Try changing your search or category filters.' })}
                  </Text>
                </View>
              }
            />
          )}
        </>
      ) : activeMainTab === 'my_listings' ? (
        <FlatList
          key="market_my_grid_2col"
          data={myListings}
          renderItem={renderListingCard}
          keyExtractor={(item, index) => item.id || `my_${index}`}
          numColumns={2}
          columnWrapperStyle={s.gridRow}
          contentContainerStyle={s.listContent}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={5}
          removeClippedSubviews={true}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <View style={s.emptyState}>
              <Lucide.Tag size={48} color={colors.mutedFg} />
              <Text style={[s.emptyTitle, { color: colors.foreground }]}>
                {t('market.noMyListings', { defaultValue: 'You have no active listings' })}
              </Text>
              <TouchableOpacity
                style={[s.createBtn, { backgroundColor: colors.primary, marginTop: 12 }]}
                onPress={() => navigation.navigate('CreateListing')}
              >
                <Text style={s.createBtnText}>{t('market.createFirst', { defaultValue: 'Create a Listing' })}</Text>
              </TouchableOpacity>
            </View>
          }
        />
      ) : (
        <FlatList
          data={transactions}
          renderItem={renderTransactionCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <View style={s.emptyState}>
              <Lucide.Receipt size={48} color={colors.mutedFg} />
              <Text style={[s.emptyTitle, { color: colors.foreground }]}>
                {t('market.noTransactions', { defaultValue: 'No orders yet' })}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

function makeStyles(c: any) {
  return StyleSheet.create({
    root: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[3],
      borderBottomWidth: 1,
    },
    preTitle: {
      fontFamily: fonts.bodyMedium,
      fontSize: fontSizes.xs,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    headerTitle: {
      fontFamily: fonts.display,
      fontSize: fontSizes['2xl'],
      fontWeight: '700',
    },
    createBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[2],
      borderRadius: radii.full,
    },
    createBtnText: {
      fontFamily: fonts.bodySemiBold,
      fontSize: fontSizes.sm,
      color: '#FFF',
    },
    mainTabs: {
      flexDirection: 'row',
      borderBottomWidth: 1,
    },
    mainTabBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: spacing[3],
    },
    mainTabLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: fontSizes.sm,
    },
    searchRow: {
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[2],
    },
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[2],
      borderRadius: radii.xl,
      borderWidth: 1,
    },
    searchInput: {
      flex: 1,
      fontFamily: fonts.body,
      fontSize: fontSizes.sm,
      padding: 0,
    },
    filterScrollView: {
      flexGrow: 0,
      height: 48,
      marginVertical: 2,
    },
    filterRow: {
      alignItems: 'center',
      paddingHorizontal: spacing[4],
      gap: 8,
    },
    filterChip: {
      height: 36,
      paddingHorizontal: 14,
      borderRadius: radii.full,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    filterChipText: {
      fontFamily: fonts.bodySemiBold,
      fontSize: fontSizes.sm,
      includeFontPadding: false,
      textAlignVertical: 'center',
    },
    categoryScrollView: {
      flexGrow: 0,
      height: 44,
      marginBottom: 4,
    },
    categoryRow: {
      alignItems: 'center',
      paddingHorizontal: spacing[4],
      gap: 8,
    },
    catChip: {
      height: 32,
      paddingHorizontal: 12,
      borderRadius: radii.md,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    catChipText: {
      fontFamily: fonts.bodyMedium,
      fontSize: fontSizes.xs,
      includeFontPadding: false,
      textAlignVertical: 'center',
    },
    listContent: {
      padding: spacing[4],
      paddingBottom: spacing[24],
      gap: spacing[3],
    },
    gridRow: {
      gap: spacing[3],
    },
    card: {
      flex: 1,
      borderRadius: radii.xl,
      overflow: 'hidden',
      borderWidth: 1,
    },
    cardImageWrap: {
      width: '100%',
      aspectRatio: 3 / 4,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    cardImage: {
      width: '90%',
      height: '90%',
    },
    typeBadge: {
      position: 'absolute',
      top: 8,
      right: 8,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: radii.sm,
    },
    typeBadgeText: {
      color: '#FFF',
      fontFamily: fonts.bodyBold,
      fontSize: 10,
      textTransform: 'uppercase',
    },
    cardInfo: {
      padding: spacing[3],
      gap: 3,
    },
    cardTitle: {
      fontFamily: fonts.bodySemiBold,
      fontSize: fontSizes.sm,
    },
    cardMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    cardBrand: {
      fontFamily: fonts.body,
      fontSize: fontSizes.xs,
    },
    cardSize: {
      fontFamily: fonts.body,
      fontSize: fontSizes.xs,
    },
    priceText: {
      fontFamily: fonts.bodyBold,
      fontSize: fontSizes.base,
      marginTop: 2,
    },
    txCard: {
      padding: spacing[4],
      borderRadius: radii.xl,
      borderWidth: 1,
      gap: spacing[2],
    },
    txHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    txTitle: {
      fontFamily: fonts.bodySemiBold,
      fontSize: fontSizes.base,
    },
    statusPill: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: radii.full,
    },
    statusText: {
      fontFamily: fonts.bodyBold,
      fontSize: fontSizes.xs,
      textTransform: 'uppercase',
    },
    txFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    txRole: {
      fontFamily: fonts.body,
      fontSize: fontSizes.xs,
    },
    txAmount: {
      fontFamily: fonts.bodyBold,
      fontSize: fontSizes.base,
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing[12],
      gap: spacing[2],
    },
    emptyTitle: {
      fontFamily: fonts.bodyBold,
      fontSize: fontSizes.lg,
    },
    emptyDesc: {
      fontFamily: fonts.body,
      fontSize: fontSizes.sm,
      textAlign: 'center',
      maxWidth: 260,
    },
  });
}
