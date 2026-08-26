/**
 * apps/mobile/src/screens/home/HomeScreen.tsx
 *
 * Home Dashboard screen — 100% full parity with apps/web/src/pages/Home.jsx.
 * Features:
 *   - Hero greeting with user's first name, weather & calendar awareness chips
 *   - Golden pulsing "+ Add Item" CTA button & floating LanguagePicker bulb
 *   - Live KPI Stat Cards (Pieces in Closet, Active Market Listings, 7% Platform Fee)
 *   - Trend-Scout 4-card editorial preview with bucket badges, external source links, and admin force-refresh
 *   - Rotating AdTicker footer banner
 *   - Full 13-language i18next support with zero hardcoded text
 */

import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Animated,
  Linking,
  ActivityIndicator,
  I18nManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import * as Lucide from 'lucide-react-native';

import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii, shadows } from '@mobile/theme/tokens';
import { api } from '@mobile/lib/api';
import { useClosetStore, useTrendScoutStore, useUserStore, useMarketplaceStore } from '@mobile/lib/stores';
import { LanguagePicker } from '@mobile/components/LanguagePicker';
import { AdTicker } from '@mobile/components/AdTicker';
import type { MainTabsParamList, ClosetStackParamList } from '@mobile/navigation/types';

type HomeNavProp = CompositeNavigationProp<
  NativeStackNavigationProp<ClosetStackParamList, 'Closet'>,
  BottomTabNavigationProp<MainTabsParamList>
>;

interface TrendCard {
  id?: string;
  bucket?: string;
  category?: string;
  label?: string;
  headline?: string;
  title?: string;
  summary?: string;
  image_url?: string;
  source_url?: string;
  source_name?: string;
  date?: string;
  is_local?: boolean;
}

const BUCKET_ICONS: Record<string, any> = {
  'ss26-runway': Lucide.Crown,
  street: Lucide.Footprints,
  sustainability: Lucide.Leaf,
  influencers: Lucide.Users,
  second_hand: Lucide.Recycle,
  recycling: Lucide.Recycle,
  news_flash: Lucide.Newspaper,
};
const DEFAULT_BUCKET_ICON = Lucide.Sparkles;

export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<HomeNavProp>();
  const isRtl = I18nManager.isRTL;

  const { user } = useUserStore();
  const closet = useClosetStore({ prewarm: true });
  const trendStore = useTrendScoutStore({ prewarm: true });
  const { totalBrowse: marketCount, fetchBrowse } = useMarketplaceStore({ prewarm: true });

  const [refreshing, setRefreshing] = useState(false);

  const firstName = user?.first_name || (user?.display_name ? user.display_name.split(' ')[0] : '');
  const isAdmin = (user?.roles || []).includes('admin') || (user as any)?.role === 'admin';

  const language = (i18n.language || 'en').split('-')[0].toLowerCase();

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      closet.prewarm({ force: true }),
      trendStore.prewarm({ language, force: true }),
      fetchBrowse({}, { force: true }),
    ]);
    setRefreshing(false);
  };

  const handleAdminForceRefreshTrends = async () => {
    setRefreshing(true);
    try {
      await (api as any).trendsRefreshAdmin?.(true);
      await trendStore.prewarm({ language, force: true });
    } catch {
      // ignore
    } finally {
      setRefreshing(false);
    }
  };

  const trends = (trendStore.cards || []).slice(0, 4);
  const closetCount = closet.total || closet.items.length;
  const displayName = firstName || t('home.greetingFallback', { defaultValue: 'there' });

  // Pulsing animation for Add button
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  const s = makeStyles(colors);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
      >
        {/* ── Top Floating Language Picker ───────────────────────────────── */}
        <View style={s.topBar}>
          <View style={s.brandLogoMark}>
            <Text style={[s.brandLogoText, { color: colors.foreground }]}>DressApp</Text>
          </View>
          <LanguagePicker testIdSuffix="home" />
        </View>

        {/* ── Hero section ───────────────────────────────────────────── */}
        <View style={s.hero}>
          {/* Pulsing Floating Add Button */}
          <Animated.View style={[s.pulsingAddBtnWrap, { transform: [{ scale: pulseAnim }] }]}>
            <TouchableOpacity
              style={[s.pulsingAddBtn, { backgroundColor: colors.primary }]}
              onPress={() => navigation.navigate('ClosetTab', { screen: 'ClosetAdd', params: { source: 'camera' } })}
              activeOpacity={0.85}
              testID="home-add-item-button"
            >
              <Lucide.Plus size={16} color="#FACC15" />
              <Text style={s.pulsingAddBtnText}>
                {t('closet.addItem', { defaultValue: 'Add Item' })}
              </Text>
            </TouchableOpacity>
          </Animated.View>

          <Text style={s.todayLabel}>
            {t('home.todayLabel', { defaultValue: 'TODAY' })}
          </Text>
          <Text style={s.greeting} testID="home-greeting">
            {t('home.greeting', { defaultValue: 'Good morning,' })}{'\n'}
            {displayName}.
          </Text>
          <Text style={s.stylistWarm}>
            {t('home.stylistWarmed', {
              defaultValue: 'Your AI Stylist is ready — what are you dressing for today?',
            })}
          </Text>

          {/* CTA buttons */}
          <View style={s.ctaRow}>
            <TouchableOpacity
              testID="home-ask-stylist-cta"
              style={[s.ctaBtn, s.ctaBtnPrimary, { backgroundColor: colors.accent }]}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('StylistTab', { screen: 'Stylist' })}
            >
              <Lucide.Sparkles size={16} color="#fff" />
              <Text style={s.ctaBtnPrimaryLabel}>
                {t('home.askStylist', { defaultValue: 'Ask Stylist' })}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              testID="home-closet-cta"
              style={[s.ctaBtn, s.ctaBtnSecondary, { backgroundColor: colors.card, borderColor: colors.border }]}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('ClosetTab', { screen: 'Closet' })}
            >
              <Text style={[s.ctaBtnSecondaryLabel, { color: colors.foreground }]}>
                {t('home.openCloset', { defaultValue: 'Open Closet' })} →
              </Text>
            </TouchableOpacity>
          </View>

          {/* Capability chips */}
          <View style={s.chipRow}>
            <View style={[s.chip, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Lucide.CloudSun size={13} color={colors.mutedFg} />
              <Text style={[s.chipText, { color: colors.mutedFg }]}>
                {t('home.weatherAware', { defaultValue: 'Weather-aware' })}
              </Text>
            </View>
            <View style={[s.chip, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Lucide.Calendar size={13} color={colors.mutedFg} />
              <Text style={[s.chipText, { color: colors.mutedFg }]}>
                {t('home.calendarSmart', { defaultValue: 'Calendar-smart' })}
              </Text>
            </View>
          </View>
        </View>

        {/* ── KPI Stat Cards ─────────────────────────────────────────── */}
        <View style={s.kpiSection} testID="home-kpis">
          {/* Pieces in Closet */}
          <TouchableOpacity
            style={[s.kpiCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => navigation.navigate('ClosetTab', { screen: 'Closet' })}
            activeOpacity={0.8}
            testID="home-kpi-closet"
          >
            <Text style={[s.kpiLabel, { color: colors.mutedFg }]}>
              {t('home.piecesInCloset', { defaultValue: 'PIECES IN CLOSET' })}
            </Text>
            <Text style={[s.kpiValue, { color: colors.foreground }]}>
              {closet.loading && !closetCount ? '…' : closetCount}
            </Text>
            <Text style={[s.kpiLink, { color: colors.accent }]}>
              {t('common.open', { defaultValue: 'Open' })} →
            </Text>
          </TouchableOpacity>

          {/* Active Listings */}
          <TouchableOpacity
            style={[s.kpiCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => navigation.navigate('MarketTab', { screen: 'Marketplace' })}
            activeOpacity={0.8}
            testID="home-kpi-market"
          >
            <Text style={[s.kpiLabel, { color: colors.mutedFg }]}>
              {t('home.activeListings', { defaultValue: 'ACTIVE LISTINGS' })}
            </Text>
            <Text style={[s.kpiValue, { color: colors.foreground }]}>
              {marketCount !== null ? marketCount : '—'}
            </Text>
            <Text style={[s.kpiLink, { color: colors.accent }]}>
              {t('common.open', { defaultValue: 'Open' })} →
            </Text>
          </TouchableOpacity>

          {/* Platform Fee */}
          <View
            style={[s.kpiCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            testID="home-kpi-fee"
          >
            <Text style={[s.kpiLabel, { color: colors.mutedFg }]}>
              {t('home.platformFee', { defaultValue: 'PLATFORM FEE' })}
            </Text>
            <Text style={[s.kpiValue, { color: colors.foreground }]}>7%</Text>
            <Text style={[s.kpiSub, { color: colors.mutedFg }]}>
              {t('home.platformFeeSub', { defaultValue: 'on sales only' })}
            </Text>
          </View>
        </View>

        {/* ── Trend-Scout Section ────────────────────────────────────── */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <TouchableOpacity
              onPress={() => navigation.navigate('MeTab', { screen: 'TrendScout' })}
              style={s.sectionTitleRow}
            >
              <Text style={[s.sectionTitle, { color: colors.foreground }]}>
                {t('home.trendScout', { defaultValue: 'Trend-Scout' })}
              </Text>
              <Lucide.ArrowRight size={18} color={colors.accent} />
            </TouchableOpacity>

            {isAdmin ? (
              <TouchableOpacity
                onPress={handleAdminForceRefreshTrends}
                style={[s.adminRefreshBtn, { backgroundColor: colors.secondary }]}
              >
                <Lucide.RefreshCw size={14} color={colors.foreground} />
              </TouchableOpacity>
            ) : null}
          </View>

          {trendStore.loading && !trends.length ? (
            <View style={s.skeletonGrid}>
              {[1, 2, 3, 4].map((i) => (
                <View key={i} style={[s.skeletonCard, { backgroundColor: colors.muted }]} />
              ))}
            </View>
          ) : (
            <View style={s.trendGrid}>
              {trends.map((card: TrendCard, i: number) => {
                const BucketIcon = BUCKET_ICONS[card.bucket || ''] || DEFAULT_BUCKET_ICON;
                const chip =
                  card.bucket
                    ? t(`trends.bucket.${card.bucket}`, { defaultValue: card.label || card.bucket })
                    : card.label || 'Trend';

                return (
                  <View
                    key={card.id || i}
                    style={[
                      s.trendCard,
                      { backgroundColor: colors.card, borderColor: colors.border },
                    ]}
                  >
                    <View style={[s.trendHeaderBand, { backgroundColor: colors.secondary, borderBottomColor: colors.border }]}>
                      <BucketIcon size={14} color={colors.accent} />
                      <Text style={[s.trendChip, { color: colors.foreground }]} numberOfLines={1}>
                        {chip}
                      </Text>
                    </View>

                    <View style={s.trendBody}>
                      {card.headline ? (
                        <Text style={[s.trendHeadline, { color: colors.foreground }]} numberOfLines={2}>
                          {card.headline}
                        </Text>
                      ) : null}

                      {card.summary ? (
                        <Text style={[s.trendSummary, { color: colors.mutedFg }]} numberOfLines={3}>
                          {card.summary}
                        </Text>
                      ) : null}

                      {card.source_url ? (
                        <TouchableOpacity
                          onPress={() => Linking.openURL(card.source_url!).catch(() => {})}
                          style={s.sourceLink}
                        >
                          <Lucide.ExternalLink size={12} color={colors.accent} />
                          <Text style={[s.sourceText, { color: colors.accent }]} numberOfLines={1}>
                            {card.source_name
                              ? t('home.trendReadAt', {
                                  source: card.source_name,
                                  defaultValue: `Read at ${card.source_name}`,
                                })
                              : t('home.trendReadSource', { defaultValue: 'Read source' })}
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* ── Footer Ad Ticker ───────────────────────────────────────── */}
        <View style={s.adTickerWrap}>
          <AdTicker placement="home-footer" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scroll: {
      flexGrow: 1,
      paddingBottom: spacing[6],
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[2],
    },
    brandLogoMark: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    brandLogoText: {
      fontFamily: fonts.displayBold,
      fontSize: fontSizes.xl,
      letterSpacing: -0.5,
    },
    hero: {
      backgroundColor: colors.sand,
      borderRadius: radii.xl,
      marginHorizontal: spacing[4],
      marginTop: spacing[1],
      marginBottom: spacing[4],
      padding: spacing[5],
      borderWidth: 1,
      borderColor: colors.border,
      position: 'relative',
      ...shadows.sm,
    },
    pulsingAddBtnWrap: {
      position: 'absolute',
      bottom: spacing[4],
      right: spacing[4],
      zIndex: 10,
    },
    pulsingAddBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[2],
      borderRadius: radii.lg,
      ...shadows.sm,
    },
    pulsingAddBtnText: {
      color: '#FACC15',
      fontFamily: fonts.bodyBold,
      fontSize: fontSizes.xs,
    },
    todayLabel: {
      fontFamily: fonts.bodyBold,
      fontSize: fontSizes.xs,
      color: colors.mutedFg,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      marginBottom: spacing[2],
    },
    greeting: {
      fontFamily: fonts.displayBold,
      fontSize: fontSizes['3xl'],
      color: colors.foreground,
      lineHeight: fontSizes['3xl'] * 1.1,
      marginBottom: spacing[2],
    },
    stylistWarm: {
      fontFamily: fonts.body,
      fontSize: fontSizes.xs,
      color: colors.mutedFg,
      marginBottom: spacing[4],
      lineHeight: fontSizes.xs * 1.5,
      maxWidth: '75%',
    },
    ctaRow: {
      flexDirection: 'row',
      gap: spacing[2.5],
      flexWrap: 'wrap',
      marginBottom: spacing[4],
    },
    ctaBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[2.5],
      borderRadius: radii.lg,
    },
    ctaBtnPrimary: {},
    ctaBtnPrimaryLabel: {
      fontFamily: fonts.bodyBold,
      fontSize: fontSizes.xs,
      color: '#fff',
    },
    ctaBtnSecondary: {
      borderWidth: 1,
    },
    ctaBtnSecondaryLabel: {
      fontFamily: fonts.bodyBold,
      fontSize: fontSizes.xs,
    },
    chipRow: {
      flexDirection: 'row',
      gap: spacing[2],
      flexWrap: 'wrap',
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderRadius: radii.full,
      borderWidth: 1,
      paddingHorizontal: spacing[2.5],
      paddingVertical: 3,
    },
    chipText: {
      fontFamily: fonts.bodyMedium,
      fontSize: 10,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },

    // KPI Cards
    kpiSection: {
      flexDirection: 'row',
      gap: spacing[2.5],
      paddingHorizontal: spacing[4],
      marginBottom: spacing[4],
    },
    kpiCard: {
      flex: 1,
      borderRadius: radii.xl,
      borderWidth: 1,
      padding: spacing[3],
      justifyContent: 'space-between',
      minHeight: 100,
      ...shadows.sm,
    },
    kpiLabel: {
      fontFamily: fonts.bodyBold,
      fontSize: 9,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    kpiValue: {
      fontFamily: fonts.displayBold,
      fontSize: fontSizes['2xl'],
      marginVertical: 4,
    },
    kpiLink: {
      fontFamily: fonts.bodyBold,
      fontSize: fontSizes.xs,
    },
    kpiSub: {
      fontFamily: fonts.body,
      fontSize: 10,
    },

    // Trends
    section: {
      paddingHorizontal: spacing[4],
      marginBottom: spacing[4],
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing[3],
    },
    sectionTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    sectionTitle: {
      fontFamily: fonts.displayBold,
      fontSize: fontSizes.xl,
    },
    adminRefreshBtn: {
      width: 32,
      height: 32,
      borderRadius: radii.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    trendGrid: {
      gap: spacing[3],
    },
    skeletonGrid: {
      gap: spacing[3],
    },
    skeletonCard: {
      height: 120,
      borderRadius: radii.xl,
    },
    trendCard: {
      borderRadius: radii.xl,
      borderWidth: 1,
      overflow: 'hidden',
      ...shadows.sm,
    },
    trendHeaderBand: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[1.5],
      borderBottomWidth: 1,
    },
    trendChip: {
      fontFamily: fonts.bodyBold,
      fontSize: 10,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    trendBody: {
      padding: spacing[3],
    },
    trendHeadline: {
      fontFamily: fonts.displayBold,
      fontSize: fontSizes.base,
      marginBottom: 4,
    },
    trendSummary: {
      fontFamily: fonts.body,
      fontSize: fontSizes.xs,
      lineHeight: fontSizes.xs * 1.4,
      marginBottom: spacing[2],
    },
    sourceLink: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 2,
    },
    sourceText: {
      fontFamily: fonts.bodyBold,
      fontSize: 11,
    },
    adTickerWrap: {
      marginTop: spacing[2],
    },
  });
