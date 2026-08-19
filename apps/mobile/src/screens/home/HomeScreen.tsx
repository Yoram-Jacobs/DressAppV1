/**
 * apps/mobile/src/screens/home/HomeScreen.tsx
 *
 * Main — Home / Dashboard screen.
 *
 * Ports the core of apps/web/src/pages/Home.jsx to React Native.
 *
 * ── What's ported ─────────────────────────────────────────────────────────
 *  • Hero greeting with the user's first name
 *  • "Ask Stylist" CTA  → navigates to StylistTab
 *  • "Open Closet" CTA  → navigates to ClosetTab
 *  • Trend-Scout preview feed (4 cards, with skeleton loading state)
 *    — calls api.fashionScoutFeed() directly (avoids the unported trendScoutStore)
 *
 * ── What's intentionally omitted ─────────────────────────────────────────
 *  • KPI stat chips (closetStore / marketplace count) — unported stores
 *  • AdTicker — unported component
 *  • Admin refresh button — admin-only feature
 *  • framer-motion animations — replaced with RN's Animated API (kept minimal)
 *
 * ── Navigation types ──────────────────────────────────────────────────────
 *  HomeScreen lives inside the ClosetTab stack but acts as the root "home"
 *  tab for the MainTabs navigator. We use CompositeNavigationProp so we
 *  can navigate to both sibling stacks (StylistTab, ClosetTab).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Animated,
  Linking,
} from 'react-native';
import { ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii, shadows } from '@mobile/theme/tokens';
import { api } from '@mobile/lib/api';
import type { MainTabsParamList, ClosetStackParamList } from '@mobile/navigation/types';

// ── Navigation prop type ──────────────────────────────────────────────────────
// HomeScreen sits in ClosetStack's root, so we need a composite type to reach
// sibling tabs (StylistTab).
type HomeNavProp = CompositeNavigationProp<
  NativeStackNavigationProp<ClosetStackParamList, 'Closet'>,
  BottomTabNavigationProp<MainTabsParamList>
>;

// ── Trend card type (mirrors API shape) ───────────────────────────────────────
interface TrendCard {
  id?: string;
  bucket?: string;
  label?: string;
  headline?: string;
  summary?: string;
  source_url?: string;
  source_name?: string;
  date?: string;
}

// ── Bucket emoji map (replaces web's lucide icon set) ────────────────────────
const BUCKET_EMOJI: Record<string, string> = {
  'ss26-runway':  '👑',
  street:         '👟',
  sustainability: '🌿',
  influencers:    '✨',
  second_hand:    '♻️',
  recycling:      '♻️',
  news_flash:     '📰',
};
const DEFAULT_EMOJI = '✨';

// ── Skeleton card count ───────────────────────────────────────────────────────
const SKELETON_COUNT = 4;

export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const navigation  = useNavigation<HomeNavProp>();
  const { colors }  = useTheme();

  // ── State ──────────────────────────────────────────────────────────────────
  const [trends, setTrends]       = useState<TrendCard[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // ── Derive first name from stored user (best effort via userStore) ─────────
  // We read the token-decoded user lazily; if unavailable we show a generic
  // greeting. A dedicated useUser() hook (not yet ported) would be cleaner.
  const [firstName, setFirstName] = useState<string>('');

  useEffect(() => {
    // The mobile api.ts userStore.get() returns null synchronously (by design),
    // so we optimistically leave firstName empty and rely on the greeting
    // fallback from i18n. If a /me endpoint is later added to the mobile
    // api adapter, replace this block with that call.
    setFirstName('');
  }, []);

  // ── Fetch trend cards ──────────────────────────────────────────────────────
  const language = i18n.language.split('-')[0].toLowerCase();

  const fetchTrends = useCallback(
    async (force = false) => {
      try {
        const { data } = await api.fashionScoutFeed(12, { language, force });
        const cards: TrendCard[] = Array.isArray(data?.cards)
          ? (data.cards as TrendCard[]).slice(0, 4)
          : [];
        setTrends(cards.length > 0 ? cards : []);
      } catch {
        // On error keep whatever was previously loaded (or empty array).
        setTrends((prev) => prev ?? []);
      }
    },
    [language],
  );

  useEffect(() => {
    fetchTrends();
  }, [fetchTrends]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTrends(true);
    setRefreshing(false);
  };

  // ── Animated fade-in for trend cards ──────────────────────────────────────
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (trends !== null) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [trends, fadeAnim]);

  const s = makeStyles(colors);
  const displayName = firstName || t('home.greetingFallback', 'there');

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
        {/* ── Hero section ───────────────────────────────────────────── */}
        <View style={s.hero}>
          <Text style={s.todayLabel}>
            {t('home.todayLabel', 'TODAY')}
          </Text>
          <Text
            style={s.greeting}
            testID="home-greeting"
            accessibilityRole="header"
          >
            {t('home.greeting', 'Good morning,')}{'\n'}
            {displayName}.
          </Text>
          <Text style={s.stylistWarm}>
            {t('home.stylistWarmed', 'Your AI Stylist is ready — what are you dressing for today?')}
          </Text>

          {/* ── CTA buttons ──────────────────────────────────────────── */}
          <View style={s.ctaRow}>
            <TouchableOpacity
              testID="home-ask-stylist-cta"
              style={[s.ctaBtn, s.ctaBtnPrimary]}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('StylistTab', { screen: 'Stylist' })}
              accessibilityRole="button"
            >
              <Text style={s.ctaSparkle}>✦ </Text>
              <Text style={s.ctaBtnPrimaryLabel}>
                {t('home.askStylist', 'Ask Stylist')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              testID="home-closet-cta"
              style={[s.ctaBtn, s.ctaBtnSecondary]}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('ClosetTab', { screen: 'Closet' })}
              accessibilityRole="button"
            >
              <Text style={s.ctaBtnSecondaryLabel}>
                {t('home.openCloset', 'Open Closet')} →
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── Capability chips ─────────────────────────────────────── */}
          <View style={s.chipRow}>
            <View style={s.chip}>
              <Text style={s.chipText}>
                🌤  {t('home.weatherAware', 'Weather-aware')}
              </Text>
            </View>
            <View style={s.chip}>
              <Text style={s.chipText}>
                📅  {t('home.calendarSmart', 'Calendar-smart')}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Trend-Scout section ────────────────────────────────────── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>
            {t('home.trendScout', 'Trend-Scout')}
          </Text>

          {trends === null ? (
            // ── Skeleton loading ────────────────────────────────────────
            <View style={s.skeletonGrid}>
              {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
                <View key={i} style={s.skeletonCard} />
              ))}
            </View>
          ) : (
            // ── Trend cards ─────────────────────────────────────────────
            <Animated.View style={[s.trendGrid, { opacity: fadeAnim }]}>
              {trends.length === 0 ? (
                <Text style={s.emptyText}>
                  {t('home.noTrends', 'No trends today — pull to refresh.')}
                </Text>
              ) : (
                trends.map((card, i) => {
                  const chip = card.label ?? card.bucket ?? '';
                  const headline = card.headline ?? '';
                  const body = card.summary ?? '';
                  const emoji = BUCKET_EMOJI[card.bucket ?? ''] ?? DEFAULT_EMOJI;
                  const key = card.id ?? `${chip}-${i}`;

                  return (
                    <TrendCardItem
                      key={key}
                      emoji={emoji}
                      chip={chip}
                      headline={headline}
                      body={body}
                      sourceUrl={card.source_url}
                      sourceName={card.source_name}
                      colors={colors}
                      t={t}
                      testID="home-trend-scout-card"
                    />
                  );
                })
              )}
            </Animated.View>
          )}
        </View>

        {/* ── Bottom padding ─────────────────────────────────────────── */}
        <View style={s.bottomPad} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── TrendCardItem sub-component ───────────────────────────────────────────────
interface TrendCardItemProps {
  emoji: string;
  chip: string;
  headline: string;
  body: string;
  sourceUrl?: string;
  sourceName?: string;
  colors: ReturnType<typeof useTheme>['colors'];
  t: ReturnType<typeof useTranslation>['t'];
  testID?: string;
}

function TrendCardItem({
  emoji,
  chip,
  headline,
  body,
  sourceUrl,
  sourceName,
  colors,
  t,
  testID,
}: TrendCardItemProps) {
  const s = makeTrendCardStyles(colors);

  const handleSourcePress = () => {
    if (sourceUrl) Linking.openURL(sourceUrl).catch(() => null);
  };

  return (
    <View style={s.card} testID={testID}>
      {/* Card header band */}
      <View style={s.headerBand} testID="home-trend-scout-card-header">
        <Text style={s.headerEmoji}>{emoji}</Text>
        {chip ? <Text style={s.chipLabel} numberOfLines={1}>{chip}</Text> : null}
      </View>

      {/* Card body */}
      <View style={s.body}>
        {headline ? (
          <Text style={s.headline} numberOfLines={3}>{headline}</Text>
        ) : null}
        {body ? (
          <Text style={s.bodyText} numberOfLines={4}>{body}</Text>
        ) : null}
        {sourceUrl ? (
          <TouchableOpacity
            onPress={handleSourcePress}
            accessibilityRole="link"
            testID="home-trend-scout-card-source"
            style={s.sourceBtn}
          >
            <Text style={s.sourceText} numberOfLines={1}>
              🔗{' '}
              {sourceName
                ? t('home.trendReadAt', { source: sourceName, defaultValue: `Read at ${sourceName}` })
                : t('home.trendReadSource', 'Read source')}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const makeStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scroll: {
      flexGrow: 1,
      paddingBottom: spacing[4],
    },

    // Hero
    hero: {
      backgroundColor: colors.sand,
      borderRadius: radii.xl,
      margin: spacing[4],
      padding: spacing[6],
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.sm,
    },
    todayLabel: {
      fontFamily: fonts.bodySemiBold,
      fontSize: fontSizes.xs,
      color: colors.mutedFg,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      marginBottom: spacing[2],
    },
    greeting: {
      fontFamily: fonts.displayBold,
      fontSize: fontSizes['4xl'],
      color: colors.foreground,
      lineHeight: fontSizes['4xl'] * 1.05,
      marginBottom: spacing[3],
    },
    stylistWarm: {
      fontFamily: fonts.body,
      fontSize: fontSizes.sm,
      color: colors.mutedFg,
      marginBottom: spacing[6],
      lineHeight: fontSizes.sm * 1.6,
    },

    // CTA row
    ctaRow: {
      flexDirection: 'row',
      gap: spacing[3],
      flexWrap: 'wrap',
      marginBottom: spacing[5],
    },
    ctaBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing[5],
      paddingVertical: spacing[3],
      borderRadius: radii.md,
    },
    ctaBtnPrimary: {
      backgroundColor: colors.primary,
    },
    ctaBtnPrimaryLabel: {
      fontFamily: fonts.bodySemiBold,
      fontSize: fontSizes.base,
      color: colors.primaryFg,
    },
    ctaSparkle: {
      color: '#FACC15', // amber-400
      fontSize: fontSizes.base,
    },
    ctaBtnSecondary: {
      backgroundColor: colors.secondary,
      borderWidth: 1,
      borderColor: colors.border,
    },
    ctaBtnSecondaryLabel: {
      fontFamily: fonts.bodySemiBold,
      fontSize: fontSizes.base,
      color: colors.secondaryFg,
    },

    // Chips
    chipRow: {
      flexDirection: 'row',
      gap: spacing[2],
      flexWrap: 'wrap',
    },
    chip: {
      backgroundColor: colors.card,
      borderRadius: radii.full,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[1],
    },
    chipText: {
      fontFamily: fonts.body,
      fontSize: fontSizes.xs,
      color: colors.mutedFg,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },

    // Trend section
    section: {
      paddingHorizontal: spacing[4],
      marginTop: spacing[4],
    },
    sectionTitle: {
      fontFamily: fonts.displayBold,
      fontSize: fontSizes['2xl'],
      color: colors.foreground,
      marginBottom: spacing[4],
    },
    trendGrid: {
      gap: spacing[3],
    },
    skeletonGrid: {
      gap: spacing[3],
    },
    skeletonCard: {
      height: 140,
      backgroundColor: colors.muted,
      borderRadius: radii.lg,
    },
    emptyText: {
      fontFamily: fonts.body,
      fontSize: fontSizes.sm,
      color: colors.mutedFg,
      textAlign: 'center',
      paddingVertical: spacing[6],
    },

    bottomPad: {
      height: spacing[10],
    },
  });

const makeTrendCardStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      ...shadows.sm,
    },
    headerBand: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[2],
      backgroundColor: colors.secondary,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerEmoji: {
      fontSize: fontSizes.base,
    },
    chipLabel: {
      fontFamily: fonts.bodySemiBold,
      fontSize: fontSizes.xs,
      color: colors.foreground,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      flex: 1,
    },
    body: {
      padding: spacing[4],
    },
    headline: {
      fontFamily: fonts.displayBold,
      fontSize: fontSizes.lg,
      color: colors.foreground,
      lineHeight: fontSizes.lg * 1.25,
      marginBottom: spacing[2],
    },
    bodyText: {
      fontFamily: fonts.body,
      fontSize: fontSizes.sm,
      color: colors.mutedFg,
      lineHeight: fontSizes.sm * 1.6,
    },
    sourceBtn: {
      marginTop: spacing[3],
    },
    sourceText: {
      fontFamily: fonts.bodySemiBold,
      fontSize: fontSizes.xs,
      color: colors.accent,
    },
  });
