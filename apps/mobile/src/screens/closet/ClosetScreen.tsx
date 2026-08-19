/**
 * apps/mobile/src/screens/closet/ClosetScreen.tsx
 *
 * Closet — main grid view.
 * Ports the core loop of apps/web/src/pages/Closet.jsx:
 *   - fetch closet items via api.listCloset()
 *   - 2-column FlatList grid
 *   - category filter chips (horizontal scroll)
 *   - pull-to-refresh
 *   - tap item → ItemDetail, FAB → ClosetAdd
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ScrollView,
  Image,
  ActivityIndicator,
  I18nManager,
  Pressable,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii } from '@mobile/theme/tokens';
import { api } from '@mobile/lib/api';
import type { ClosetStackParamList } from '@mobile/navigation/types';

type ClosetNavProp = NativeStackNavigationProp<ClosetStackParamList, 'Closet'>;

// ── Types ──────────────────────────────────────────────────────────────────
interface ClosetItem {
  id: string;
  name: string;
  category?: string;
  color?: string;
  brand?: string;
  thumbnail_data_url?: string;
  image_url?: string;
}

const ALL_CATEGORY = '__all__';

// ── Component ──────────────────────────────────────────────────────────────
export function ClosetScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<ClosetNavProp>();
  const { colors } = useTheme();

  const [items, setItems] = useState<ClosetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>(ALL_CATEGORY);

  // Derive category list from items
  const categories = [
    ALL_CATEGORY,
    ...Array.from(new Set(items.map((i) => i.category).filter(Boolean) as string[])).sort(),
  ];

  const filteredItems =
    activeCategory === ALL_CATEGORY
      ? items
      : items.filter((i) => i.category === activeCategory);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const data = await api.listCloset();
      // Backend returns { items: [...] } or direct array
      const list: ClosetItem[] = Array.isArray(data) ? data : (data?.items ?? []);
      setItems(list);
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? 'Failed to load closet';
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load(true);
  }, [load]);

  const s = makeStyles(colors);

  // ── Render helpers ────────────────────────────────────────────────────────
  const renderItem = ({ item }: { item: ClosetItem }) => (
    <TouchableOpacity
      style={s.card}
      activeOpacity={0.75}
      onPress={() => navigation.navigate('ItemDetail', { itemId: item.id })}
      accessibilityRole="button"
      accessibilityLabel={item.name}
    >
      <View style={s.imageWrap}>
        {item.thumbnail_data_url || item.image_url ? (
          <Image
            source={{ uri: item.thumbnail_data_url ?? item.image_url }}
            style={s.image}
            resizeMode="cover"
          />
        ) : (
          <View style={[s.image, s.imagePlaceholder]}>
            <Text style={s.imagePlaceholderText}>👕</Text>
          </View>
        )}
      </View>
      <View style={s.cardInfo}>
        <Text style={s.cardName} numberOfLines={1}>{item.name || t('closet.unnamedItem', 'Unnamed item')}</Text>
        {item.brand ? <Text style={s.cardMeta} numberOfLines={1}>{item.brand}</Text> : null}
      </View>
    </TouchableOpacity>
  );

  const renderFilterChip = (cat: string) => (
    <TouchableOpacity
      key={cat}
      style={[s.chip, activeCategory === cat && s.chipActive]}
      onPress={() => setActiveCategory(cat)}
      accessibilityRole="button"
    >
      <Text style={[s.chipText, activeCategory === cat && s.chipTextActive]}>
        {cat === ALL_CATEGORY ? t('closet.filterAll', 'All') : cat}
      </Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={[s.root, s.centered]}>
        <ActivityIndicator color={colors.accent} size="large" />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[s.root, s.centered]}>
        <Text style={s.errorText}>{error}</Text>
        <TouchableOpacity style={s.retryBtn} onPress={() => load()}>
          <Text style={s.retryBtnText}>{t('common.retry', 'Retry')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>{t('closet.title', 'My Closet')}</Text>
          <Text style={s.headerCount}>{items.length} {t('closet.items', 'items')}</Text>
        </View>
        <TouchableOpacity
          style={s.dppBtn}
          onPress={() => navigation.navigate('DppScanner')}
          accessibilityRole="button"
          accessibilityLabel={t('dpp.scanBtn', 'Lucide.Scan product passport')}
        >
          <Text style={s.dppBtnText}>{'📛 ' + t('dpp.scanBtn', 'Lucide.Scan DPP')}</Text>
        </TouchableOpacity>
      </View>

      {/* Category filter chips */}
      {categories.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.chipsRow}
          style={s.chipsScroll}
        >
          {categories.map(renderFilterChip)}
        </ScrollView>
      )}

      {/* Item grid */}
      {filteredItems.length === 0 ? (
        <View style={s.emptyContainer}>
          <Text style={s.emptyText}>
            {activeCategory === ALL_CATEGORY
              ? t('closet.empty', 'Your closet is empty.\nAdd your first item!')
              : t('closet.emptyCategory', 'No items in this category.')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={s.row}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accent}
            />
          }
        />
      )}

      {/* Floating Add Button */}
      <Pressable
        style={({ pressed }) => [s.fab, pressed && { opacity: 0.85 }]}
        onPress={() => navigation.navigate('ClosetAdd', { source: 'manual' })}
        accessibilityRole="button"
        accessibilityLabel={t('closet.addItem', 'Add item')}
      >
        <Text style={s.fabIcon}>＋</Text>
      </Pressable>
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
function makeStyles(colors: ReturnType<typeof import('@mobile/theme').useTheme>['colors']) {
  const isRtl = I18nManager.isRTL;
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    centered: { alignItems: 'center', justifyContent: 'center' },
    header: {
      flexDirection: isRtl ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing[5],
      paddingTop: spacing[4],
      paddingBottom: spacing[2],
    },
    headerTitle: {
      fontFamily: fonts.display,
      fontSize: fontSizes['2xl'],
      color: colors.foreground,
    },
    headerCount: {
      fontFamily: fonts.body,
      fontSize: fontSizes.sm,
      color: colors.mutedFg,
    },
    dppBtn: {
      backgroundColor: colors.muted,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[2],
      borderRadius: radii.lg,
    },
    dppBtnText: {
      fontFamily: fonts.bodyMedium,
      fontSize: fontSizes.xs,
      color: colors.foreground,
    },
    chipsScroll: { flexGrow: 0 },
    chipsRow: {
      paddingHorizontal: spacing[5],
      paddingBottom: spacing[3],
      gap: spacing[2],
      flexDirection: isRtl ? 'row-reverse' : 'row',
    },
    chip: {
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[1],
      borderRadius: radii.xl,
      backgroundColor: colors.muted,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chipActive: {
      backgroundColor: colors.foreground,
      borderColor: colors.foreground,
    },
    chipText: {
      fontFamily: fonts.bodyMedium,
      fontSize: fontSizes.xs,
      color: colors.mutedFg,
    },
    chipTextActive: { color: colors.background },
    row: { gap: spacing[3], paddingHorizontal: spacing[5] },
    listContent: { paddingBottom: spacing[24] },
    card: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: radii.lg,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
    },
    imageWrap: { width: '100%', aspectRatio: 3 / 4 },
    image: { width: '100%', height: '100%' },
    imagePlaceholder: {
      backgroundColor: colors.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    imagePlaceholderText: { fontSize: 40 },
    cardInfo: { padding: spacing[2] },
    cardName: {
      fontFamily: fonts.bodyMedium,
      fontSize: fontSizes.sm,
      color: colors.foreground,
    },
    cardMeta: {
      fontFamily: fonts.body,
      fontSize: fontSizes.xs,
      color: colors.mutedFg,
      marginTop: 2,
    },
    fab: {
      position: 'absolute',
      bottom: spacing[8],
      [isRtl ? 'left' : 'right']: spacing[5],
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.foreground,
      alignItems: 'center',
      justifyContent: 'center',
      ...Platform.select({
        ios: { shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
        android: { elevation: 6 },
      }),
    },
    fabIcon: { fontSize: 28, color: colors.background, lineHeight: 32 },
    emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[8] },
    emptyText: {
      fontFamily: fonts.body,
      fontSize: fontSizes.base,
      color: colors.mutedFg,
      textAlign: 'center',
      lineHeight: 24,
    },
    errorText: {
      fontFamily: fonts.body,
      fontSize: fontSizes.base,
      color: colors.destructive,
      textAlign: 'center',
      marginBottom: spacing[4],
    },
    retryBtn: {
      paddingHorizontal: spacing[5],
      paddingVertical: spacing[3],
      backgroundColor: colors.foreground,
      borderRadius: radii.md,
    },
    retryBtnText: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.background },
  });
}
