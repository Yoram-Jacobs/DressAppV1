/**
 * apps/mobile/src/screens/me/TrendScoutScreen.tsx
 *
 * Full-featured Trend-Scout & Local Fashion News Radar — 100% parity with Web.
 * Features:
 *   - Available for paying tiers (Manager & Professional) with localized news
 *   - Gender-sensitive ecosystem (Men's & Women's Fashion Buckets)
 *   - Bucket filter tabs: All, Local News, Runway, Street Style, Sustainability, Influencers, Vintage, Care & Repairs
 *   - External editorial source links and authentic high-res imagery with robust error fallbacks
 *   - 13-language i18next support with zero hardcoded text
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Linking,
  ScrollView,
  I18nManager,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import * as Lucide from 'lucide-react-native';

import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii, shadows } from '@mobile/theme/tokens';
import { useTrendScoutStore, useUserStore } from '@mobile/lib/stores';
import { api } from '@mobile/lib/api';
import { ScrollToTopFloater } from '@mobile/components/common/ScrollToTopFloater';

interface TrendItem {
  id?: string;
  bucket?: string;
  category?: string;
  label?: string;
  tag?: string;
  title?: string;
  headline?: string;
  description?: string;
  summary?: string;
  image_url?: string;
  source_url?: string;
  source_name?: string;
  gender?: string;
  is_local?: boolean;
  city?: string;
  country?: string;
}

const BUCKET_ICONS: Record<string, any> = {
  local: Lucide.Newspaper,
  runway: Lucide.Crown,
  street: Lucide.Footprints,
  sustainability: Lucide.Leaf,
  influencers: Lucide.Users,
  vintage: Lucide.Recycle,
  maintenance_repairs: Lucide.Wrench,
  'ss26-runway': Lucide.Crown,
  second_hand: Lucide.Recycle,
  recycling: Lucide.Wrench,
  news_flash: Lucide.Newspaper,
};

const BUCKETS = [
  { id: 'all', labelKey: 'trends.all', fallback: 'All News' },
  { id: 'local', labelKey: 'trends.bucket.local', fallback: '📍 Local News' },
  { id: 'runway', labelKey: 'trends.bucket.runway', fallback: 'Runway' },
  { id: 'street', labelKey: 'trends.bucket.street', fallback: 'Street Style' },
  { id: 'sustainability', labelKey: 'trends.bucket.sustainability', fallback: 'Sustainability' },
  { id: 'influencers', labelKey: 'trends.bucket.influencers', fallback: 'Influencers' },
  { id: 'vintage', labelKey: 'trends.bucket.vintage', fallback: 'Vintage / Archival' },
  { id: 'maintenance_repairs', labelKey: 'trends.bucket.maintenance_repairs', fallback: 'Care & Repairs' },
] as const;

const DEFAULT_MOBILE_IMAGES: Record<string, string> = {
  'local-male': 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=800&q=80',
  'runway-male': 'https://images.unsplash.com/photo-1516257984-b1b4d707412e?auto=format&fit=crop&w=800&q=80',
  'street-male': 'https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?auto=format&fit=crop&w=800&q=80',
  'sustainability-male': 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=800&q=80',
  'influencers-male': 'https://images.unsplash.com/photo-1617127365659-c47fa864d8bc?auto=format&fit=crop&w=800&q=80',
  'vintage-male': 'https://www.heddels.com/wp-content/uploads/2022/08/wide-leg-raw-denim-jeans-a-buyers-guide-443x296.jpg',
  'maintenance_repairs-male': 'https://images.unsplash.com/photo-1581044777550-4cfa60707c03?auto=format&fit=crop&w=800&q=80',

  'local-female': 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=800&q=80',
  'runway-female': 'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=800&q=80',
  'street-female': 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=800&q=80',
  'sustainability-female': 'https://images.unsplash.com/photo-1544441893-675973e31985?auto=format&fit=crop&w=800&q=80',
  'influencers-female': 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80',
  'vintage-female': 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&w=800&q=80',
  'maintenance_repairs-female': 'https://images.unsplash.com/photo-1520006403909-838d6b92c22e?auto=format&fit=crop&w=800&q=80',
};

function TrendCardImage({
  imageUrl,
  canonicalBucket,
  gender,
  headline,
}: {
  imageUrl?: string;
  canonicalBucket: string;
  gender: string;
  headline?: string;
}) {
  const [error, setError] = useState(false);
  const g = gender === 'male' ? 'male' : 'female';
  const fallbackUrl = DEFAULT_MOBILE_IMAGES[`${canonicalBucket}-${g}`] || DEFAULT_MOBILE_IMAGES[`local-${g}`];
  const uri = (!error && imageUrl && imageUrl.startsWith('http')) ? imageUrl : fallbackUrl;

  return (
    <Image
      source={{ uri }}
      style={styles.cardImg}
      resizeMode="cover"
      onError={() => setError(true)}
      accessibilityLabel={headline || 'Fashion Trend'}
    />
  );
}

export function TrendScoutScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<any>();

  const { user } = useUserStore();
  const userSex = (user?.sex || user?.gender || 'female').toLowerCase();
  const [selectedGender, setSelectedGender] = useState<'male' | 'female'>(userSex === 'male' ? 'male' : 'female');
  const [refreshing, setRefreshing] = useState(false);
  const [activeBucket, setActiveBucket] = useState<string>('all');

  // Fast Scroll to Top floater state
  const flatListRef = useRef<FlatList>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const handleScroll = (e: any) => {
    const y = e?.nativeEvent?.contentOffset?.y ?? 0;
    if (y > 250 && !showScrollTop) {
      setShowScrollTop(true);
    } else if (y <= 250 && showScrollTop) {
      setShowScrollTop(false);
    }
  };

  const country = (user?.address?.country_code || (user as any)?.country || 'IL').toString().toUpperCase();
  const language = (i18n.language || 'en').split('-')[0].toLowerCase();

  const { cards: items, loading, prewarm } = useTrendScoutStore({ prewarm: true });

  const userTier = ((user?.subscription?.is_active && user?.subscription?.tier) || user?.subscription_tier || 'free').toLowerCase();
  const isPaying = (user?.subscription?.is_active && userTier !== 'free') || userTier === 'manager' || userTier === 'professional' || userTier === 'pro';

  const onRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await api.trendsRunNowDev(true, selectedGender, country);
      await prewarm({ language, country, gender: selectedGender, force: true });
    } catch {
      await prewarm({ language, country, gender: selectedGender, force: true });
    } finally {
      setRefreshing(false);
    }
  }, [prewarm, language, country, selectedGender, refreshing]);

  useEffect(() => {
    prewarm({ language, country, gender: selectedGender });
  }, [selectedGender, prewarm, language, country]);

  const filteredItems = items.filter((it) => {
    if (it.gender && it.gender !== selectedGender) return false;
    if (activeBucket === 'all') return true;
    if (activeBucket === 'local') return it.bucket === 'local' || it.bucket === 'news_flash' || it.is_local || it.city || it.country;
    if (activeBucket === 'runway') return it.bucket === 'runway' || it.bucket === 'ss26-runway';
    if (activeBucket === 'vintage') return it.bucket === 'vintage' || it.bucket === 'second_hand';
    if (activeBucket === 'maintenance_repairs') return it.bucket === 'maintenance_repairs' || it.bucket === 'recycling';
    return it.bucket === activeBucket || (it.category || '').toLowerCase().includes(activeBucket);
  });

  const displayItems = isPaying ? filteredItems : filteredItems.slice(0, 2);

  const renderItem = ({ item }: { item: TrendItem }) => {
    const title = item.headline || item.title || 'Fashion Trend';
    const summary = item.summary || item.description || '';
    const canonicalBucket = item.bucket === 'ss26-runway' ? 'runway'
      : item.bucket === 'second_hand' ? 'vintage'
      : item.bucket === 'recycling' ? 'maintenance_repairs'
      : item.bucket === 'news_flash' ? 'local'
      : (item.bucket || 'local');

    const BucketIcon = BUCKET_ICONS[canonicalBucket] || Lucide.Sparkles;
    const g = (item.gender || selectedGender).toLowerCase();

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        activeOpacity={0.88}
        onPress={() => item.source_url && Linking.openURL(item.source_url).catch(() => {})}
        accessibilityRole="button"
        accessibilityLabel={title}
      >
        <TrendCardImage
          imageUrl={item.image_url}
          canonicalBucket={canonicalBucket}
          gender={g}
          headline={title}
        />

        <View style={styles.cardBody}>
          <View style={styles.badgeRow}>
            <View style={[styles.categoryPill, { backgroundColor: colors.secondary }]}>
              <BucketIcon size={12} color={colors.accent} />
              <Text style={[styles.category, { color: colors.foreground }]}>
                {t(`trends.bucket.${canonicalBucket}`, { defaultValue: item.label || canonicalBucket })}
              </Text>
            </View>

            {item.is_local || item.city || canonicalBucket === 'local' ? (
              <View style={[styles.localBadge, { backgroundColor: 'rgba(234, 88, 12, 0.12)' }]}>
                <Lucide.MapPin size={10} color="#ea580c" />
                <Text style={styles.localBadgeText}>
                  {item.city || item.country || (country === 'IL' ? t('trends.israelAnchor', { defaultValue: 'Israel 🇮🇱' }) : country)}
                </Text>
              </View>
            ) : null}

            {item.gender ? (
              <View style={[styles.genderBadge, { backgroundColor: colors.secondary }]}>
                <Text style={[styles.genderBadgeText, { color: colors.mutedFg }]}>
                  {item.gender === 'male' ? t('trends.men', { defaultValue: 'Men' }) : t('trends.women', { defaultValue: 'Women' })}
                </Text>
              </View>
            ) : null}
          </View>

          <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={2}>
            {title}
          </Text>

          {summary ? (
            <Text style={[styles.desc, { color: colors.mutedFg }]} numberOfLines={3}>
              {summary}
            </Text>
          ) : null}

          {item.source_url ? (
            <View style={styles.sourceRow}>
              <Lucide.ExternalLink size={12} color={colors.accent} />
              <Text style={[styles.sourceText, { color: colors.accent }]} numberOfLines={1}>
                {item.source_name
                  ? t('home.trendReadAt', { source: item.source_name, defaultValue: `Read at ${item.source_name}` })
                  : t('home.trendReadSource', { defaultValue: 'Read source' })}
              </Text>
            </View>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={['top']}>
      {/* ── Top Bar ─────────────────────────────────────────────────── */}
      <View style={[styles.topBar, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityLabel="Back">
          <Lucide.ArrowLeft size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.topTitle, { color: colors.foreground }]}>
          {t('trends.title', { defaultValue: 'Trend Scout' })}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      {/* ── Gender Toggle & Refresh Bar ─────────────────────────────── */}
      <View style={[styles.genderBar, { borderBottomColor: colors.border }]}>
        <View style={[styles.genderPillsContainer, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <TouchableOpacity
            style={[
              styles.genderPill,
              selectedGender === 'female' && { backgroundColor: colors.primary, borderColor: colors.primary },
            ]}
            onPress={() => setSelectedGender('female')}
          >
            <Text
              style={[
                styles.genderText,
                { color: selectedGender === 'female' ? colors.primaryFg : colors.mutedFg },
              ]}
            >
              {t('trends.womensFashion', { defaultValue: "Women's Fashion" })}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.genderPill,
              selectedGender === 'male' && { backgroundColor: colors.primary, borderColor: colors.primary },
            ]}
            onPress={() => setSelectedGender('male')}
          >
            <Text
              style={[
                styles.genderText,
                { color: selectedGender === 'male' ? colors.primaryFg : colors.mutedFg },
              ]}
            >
              {t('trends.mensFashion', { defaultValue: "Men's Fashion" })}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.refreshBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
          onPress={onRefresh}
          disabled={refreshing}
          accessibilityLabel={t('stylist.refreshScout', { defaultValue: 'Refresh Trends' })}
          accessibilityRole="button"
          activeOpacity={0.7}
        >
          {refreshing ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Lucide.RotateCw size={18} color={colors.foreground} />
          )}
        </TouchableOpacity>
      </View>

      {/* ── Bucket Filter Pills ──────────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.bucketScroll}
        style={[styles.bucketBar, { borderBottomColor: colors.border }]}
      >
        {BUCKETS.map((b) => {
          const isSelected = activeBucket === b.id;
          return (
            <TouchableOpacity
              key={b.id}
              style={[
                styles.bucketPill,
                {
                  backgroundColor: isSelected ? colors.primary : colors.card,
                  borderColor: isSelected ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setActiveBucket(b.id)}
            >
              <Text
                style={[
                  styles.bucketPillText,
                  { color: isSelected ? colors.primaryFg : colors.foreground },
                ]}
              >
                {t(b.labelKey, { defaultValue: b.fallback })}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={displayItems}
          renderItem={renderItem}
          keyExtractor={(it, idx) => it.id || String(idx)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accent}
            />
          }
          ListFooterComponent={
            !isPaying ? (
              <View style={[styles.paywallCard, { backgroundColor: colors.card, borderColor: colors.accent }]}>
                <Lucide.Lock size={24} color={colors.accent} />
                <Text style={[styles.paywallTitle, { color: colors.foreground }]}>
                  {t('trends.paywallTitle', { defaultValue: 'Unlock Local Fashion Radar' })}
                </Text>
                <Text style={[styles.paywallDesc, { color: colors.mutedFg }]}>
                  {t('trends.paywallDesc', {
                    defaultValue: 'Full editorial fashion radar and localized street style feeds are exclusive to Manager & Professional tiers.',
                  })}
                </Text>
                <TouchableOpacity
                  style={[styles.upgradeBtn, { backgroundColor: colors.accent }]}
                  onPress={() => navigation.navigate('Pricing')}
                >
                  <Text style={styles.upgradeBtnText}>
                    {t('pricing.upgradeManager', { defaultValue: 'Upgrade to Manager' })}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null
          }
        />
      )}

      {/* ── Fast Scroll To Top Floater ─────────────────────────────── */}
      <ScrollToTopFloater
        visible={showScrollTop}
        onPress={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true })}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    fontFamily: fonts.displayBold,
    fontSize: fontSizes.lg,
  },
  genderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    gap: spacing[2],
    borderBottomWidth: 1,
  },
  genderPillsContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 3,
    borderRadius: radii.xl,
    borderWidth: 1,
  },
  genderPill: {
    flex: 1,
    paddingVertical: spacing[2],
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  genderText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
  },
  refreshBtn: {
    width: 42,
    height: 42,
    borderRadius: radii.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  bucketBar: {
    minHeight: 52,
    borderBottomWidth: 1,
  },
  bucketScroll: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    gap: spacing[2],
    alignItems: 'center',
  },
  bucketPill: {
    paddingHorizontal: spacing[3.5],
    paddingVertical: spacing[2],
    borderRadius: radii.full,
    borderWidth: 1,
  },
  bucketPillText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    padding: spacing[4],
    paddingBottom: spacing[12],
    gap: spacing[4],
  },
  card: {
    borderRadius: radii.xl,
    overflow: 'hidden',
    borderWidth: 1,
    ...shadows.sm,
  },
  cardImg: {
    width: '100%',
    height: 190,
  },
  placeholderImg: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    padding: spacing[4],
    gap: spacing[1.5],
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing[2],
    paddingVertical: 3,
    borderRadius: radii.md,
  },
  genderBadge: {
    paddingHorizontal: spacing[2],
    paddingVertical: 3,
    borderRadius: radii.md,
  },
  genderBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    textTransform: 'uppercase',
  },
  localBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing[2],
    paddingVertical: 3,
    borderRadius: radii.md,
  },
  localBadgeText: {
    color: '#ea580c',
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    textTransform: 'uppercase',
  },
  category: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  title: {
    fontFamily: fonts.displayBold,
    fontSize: fontSizes.base,
    lineHeight: fontSizes.base * 1.3,
  },
  desc: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    lineHeight: fontSizes.xs * 1.4,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing[1],
  },
  sourceText: {
    fontFamily: fonts.body,
    fontSize: 11,
  },
  paywallCard: {
    padding: spacing[5],
    borderRadius: radii.xl,
    borderWidth: 2,
    alignItems: 'center',
    gap: spacing[2.5],
    marginTop: spacing[3],
    ...shadows.sm,
  },
  paywallTitle: {
    fontFamily: fonts.displayBold,
    fontSize: fontSizes.base,
    textAlign: 'center',
  },
  paywallDesc: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    lineHeight: fontSizes.xs * 1.4,
    textAlign: 'center',
  },
  upgradeBtn: {
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[2.5],
    borderRadius: radii.lg,
    marginTop: spacing[1],
  },
  upgradeBtnText: {
    color: '#fff',
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
  },
});
