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
  BackHandler,
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
import { toCountryCode } from '@mobile/lib/country';
import { ScrollToTopFloater } from '@mobile/components/common/ScrollToTopFloater';
import { TrendScoutSettingsModal } from '@mobile/components/trends/TrendScoutSettingsModal';

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
  date?: string;
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
  const { colors } = useTheme();
  const BucketIcon = BUCKET_ICONS[canonicalBucket] || Lucide.Sparkles;
  const isBroken = !imageUrl || !imageUrl.startsWith('http') || imageUrl.includes('ynet-pic1.ynet.co.il') || imageUrl.includes('example.com') || imageUrl.includes('photo-1617127365659-c47fa864d8bc');

  if (error || isBroken) {
    return (
      <View
        style={[
          styles.cardImg,
          styles.placeholderImg,
          { backgroundColor: colors.secondary || '#f1f5f9' },
        ]}
      >
        <BucketIcon size={40} color={colors.primary || '#6366f1'} />
      </View>
    );
  }

  return (
    <Image
      source={{ uri: imageUrl }}
      style={styles.cardImg}
      contentFit="cover"
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
  const [settingsOpen, setSettingsOpen] = useState(false);
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

  const BackIcon = I18nManager.isRTL ? Lucide.ArrowRight : Lucide.ArrowLeft;

  const handleBack = useCallback(() => {
    const can = navigation.canGoBack();
    console.log('[TrendScout] handleBack called, canGoBack:', can);
    try {
      if (can) {
        navigation.goBack();
      } else {
        navigation.navigate('Profile');
      }
    } catch (err) {
      console.warn('[TrendScout] handleBack error:', err);
      try {
        navigation.navigate('Profile');
      } catch {
        // no-op
      }
    }
  }, [navigation]);

  useEffect(() => {
    console.log('[TrendScout] Registering BackHandler');
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      console.log('[TrendScout] hardwareBackPress fired');
      handleBack();
      return true;
    });
    return () => {
      console.log('[TrendScout] Unregistering BackHandler');
      sub.remove();
    };
  }, [handleBack]);

  const country = toCountryCode(user?.address?.country_code || (user as any)?.country_code || (user as any)?.country);
  const language = (i18n.language || 'en').split('-')[0].toLowerCase();

  const { cards: items, loading, prewarm } = useTrendScoutStore({ prewarm: false });

  const userTier = ((user?.subscription?.is_active && user?.subscription?.tier) || user?.subscription_tier || 'free').toLowerCase();
  const isPaying = (user?.subscription?.is_active && userTier !== 'free') || userTier === 'manager' || userTier === 'professional' || userTier === 'pro';

  const onRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      try {
        await api.trendsRunNowDev(true, selectedGender, country);
      } catch (runErr) {
        console.warn('[TrendScout] trendsRunNowDev warning:', runErr);
      }
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

            {item.date ? (
              <View style={[styles.genderBadge, { backgroundColor: colors.secondary }]}>
                <Text style={[styles.genderBadgeText, { color: colors.mutedFg }]}>
                  {item.date}
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
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backBtn}
          accessibilityLabel="Back"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <BackIcon size={20} color={colors.foreground} />
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

        <TouchableOpacity
          style={[styles.refreshBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
          onPress={() => setSettingsOpen(true)}
          accessibilityLabel={t('trends.personalizationSettings', { defaultValue: 'Personalization Settings' })}
          accessibilityRole="button"
          activeOpacity={0.7}
        >
          <Lucide.Settings size={18} color={colors.foreground} />
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
          ListEmptyComponent={
            !loading ? (
              <View style={styles.emptyContainer}>
                <Lucide.Sparkles size={44} color={colors.accent} />
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                  {t('trends.noTrendsTitle', { defaultValue: 'No Trends Found' })}
                </Text>
                <Text style={[styles.emptyDesc, { color: colors.mutedFg }]}>
                  {t('trends.noTrendsDesc', {
                    defaultValue: "We couldn't find any active trend cards for this filter. Check back later or trigger a live refresh.",
                  })}
                </Text>
                <TouchableOpacity
                  style={[styles.emptyRefreshBtn, { backgroundColor: colors.primary }]}
                  onPress={onRefresh}
                  disabled={refreshing}
                  accessibilityRole="button"
                >
                  <Text style={[styles.emptyRefreshBtnText, { color: colors.primaryFg }]}>
                    {refreshing ? t('common.loading', { defaultValue: 'Refreshing...' }) : t('stylist.refreshScout', { defaultValue: 'Refresh Feed' })}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null
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

      {/* ── Trend Scout Personalization Settings Modal ─────────────── */}
      <TrendScoutSettingsModal
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onRefreshTriggered={async () => {
          await prewarm({ language, country, gender: selectedGender, force: true });
        }}
        selectedGender={selectedGender}
        country={country}
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
    textAlign: I18nManager.isRTL ? 'right' : 'left',
    writingDirection: I18nManager.isRTL ? 'rtl' : 'ltr',
  },
  desc: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    lineHeight: fontSizes.xs * 1.4,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
    writingDirection: I18nManager.isRTL ? 'rtl' : 'ltr',
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
    textAlign: I18nManager.isRTL ? 'right' : 'left',
    writingDirection: I18nManager.isRTL ? 'rtl' : 'ltr',
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
  emptyContainer: {
    padding: spacing[8],
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[3],
    marginTop: spacing[8],
  },
  emptyTitle: {
    fontFamily: fonts.displayBold,
    fontSize: fontSizes.lg,
    textAlign: 'center',
  },
  emptyDesc: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    lineHeight: fontSizes.sm * 1.4,
    textAlign: 'center',
    maxWidth: 280,
  },
  emptyRefreshBtn: {
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[2.5],
    borderRadius: radii.lg,
    marginTop: spacing[2],
  },
  emptyRefreshBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
  },
});
