/**
 * apps/mobile/src/screens/closet/OutfitsScreen.tsx
 *
 * Saved Outfits — lists outfits saved by the AI Stylist.
 * Core loop:
 *   - api.listSavedOutfits() → render grid of outfit cards
 *   - tap → show outfit items detail (inline expand)
 *   - swipe/long-press → delete via api.deleteSavedOutfit(id)
 *   - pull-to-refresh
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Image,
  ActivityIndicator,
  Alert,
  ScrollView,
  I18nManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii } from '@mobile/theme/tokens';
import { api } from '@mobile/lib/api';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { StylistStackParamList } from '@mobile/navigation/types';

// ── Types ──────────────────────────────────────────────────────────────────
interface OutfitItem {
  id: string;
  name?: string;
  image_url?: string;
  thumbnail_data_url?: string;
  category?: string;
}

interface SavedOutfit {
  id: string;
  name?: string;
  occasion?: string;
  created_at?: string;
  items?: OutfitItem[];
  cover_image_url?: string;
}

// ── Component ──────────────────────────────────────────────────────────────
export function OutfitsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<StylistStackParamList>>();
  const isRtlLayout = I18nManager.isRTL;

  const [outfits, setOutfits] = useState<SavedOutfit[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const data = await api.listSavedOutfits();
      const list: SavedOutfit[] = Array.isArray(data) ? data : (data?.outfits ?? []);
      setOutfits(list);
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? 'Failed to load outfits');
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

  const handleDelete = (outfit: SavedOutfit) => {
    Alert.alert(
      t('outfits.deleteTitle', 'Delete outfit'),
      t('outfits.deleteMessage', 'Remove this outfit from your saved collection?'),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('common.delete', 'Delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteSavedOutfit(outfit.id);
              setOutfits((prev) => prev.filter((o) => o.id !== outfit.id));
            } catch (err: unknown) {
              Alert.alert(t('common.error', 'Error'), (err as { message?: string })?.message ?? 'Failed to delete outfit');
            }
          },
        },
      ],
    );
  };



  const s = makeStyles(colors);

  const renderOutfit = ({ item }: { item: SavedOutfit }) => {
    const isExpanded = expanded === item.id;
    const cover = item.cover_image_url ?? item.items?.[0]?.image_url ?? item.items?.[0]?.thumbnail_data_url;

    return (
      <View style={s.card}>
        {/* Card header — tap to expand */}
        <TouchableOpacity
          style={[s.cardHeader, { flexDirection: isRtlLayout ? 'row-reverse' : 'row' }]}
          onPress={() => setExpanded(isExpanded ? null : item.id)}
          activeOpacity={0.8}
        >
          {cover ? (
            <Image source={{ uri: cover }} style={s.coverThumb} resizeMode="cover" />
          ) : (
            <View style={[s.coverThumb, s.coverPlaceholder]}>
              <Text style={{ fontSize: 22 }}>👗</Text>
            </View>
          )}
          <View style={s.cardMeta}>
            <Text style={s.outfitName} numberOfLines={1}>
              {item.name ?? t('outfits.unnamedOutfit', 'Saved outfit')}
            </Text>
            {item.occasion ? (
              <Text style={s.outfitOccasion}>{item.occasion}</Text>
            ) : null}
            <Text style={s.outfitItemCount}>
              {item.items?.length ?? 0} {t('outfits.pieces', 'pieces')}
            </Text>
          </View>
          <View style={s.cardActions}>
            <TouchableOpacity
              style={s.deleteBtn}
              onPress={() => handleDelete(item)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={s.deleteBtnText}>🗑</Text>
            </TouchableOpacity>
            <Text style={s.chevron}>{isExpanded ? '▲' : '▼'}</Text>
          </View>
        </TouchableOpacity>

        {/* Expanded items strip */}
        {isExpanded && item.items && item.items.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.itemsStrip}
          >
            {item.items.map((piece) => {
              const thumb = piece.thumbnail_data_url ?? piece.image_url;
              return (
                <View key={piece.id} style={s.pieceCard}>
                  {thumb ? (
                    <Image source={{ uri: thumb }} style={s.pieceImage} resizeMode="cover" />
                  ) : (
                    <View style={[s.pieceImage, s.piecePlaceholder]}>
                      <Text style={{ fontSize: 18 }}>👕</Text>
                    </View>
                  )}
                  <Text style={s.pieceName} numberOfLines={2}>
                    {piece.name ?? piece.category ?? '—'}
                  </Text>
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>
    );
  };

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
      <View style={[s.header, { flexDirection: isRtlLayout ? 'row-reverse' : 'row' }]}>
        <View>
          <Text style={s.headerTitle}>{t('outfits.title', 'Saved Outfits')}</Text>
          <Text style={s.headerCount}>{outfits.length} {t('outfits.saved', 'saved')}</Text>
        </View>
        <TouchableOpacity
          style={[s.avatarBtn, { backgroundColor: colors.muted }]}
          onPress={() => navigation.navigate('Avatar')}
          activeOpacity={0.8}
        >
          <Text style={s.avatarBtnText}>🧍 {t('outfits.myAvatar', 'My Avatar')}</Text>
        </TouchableOpacity>
      </View>

      {outfits.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>✨</Text>
          <Text style={s.emptyTitle}>{t('outfits.emptyTitle', 'No saved outfits yet')}</Text>
          <Text style={s.emptySub}>
            {t('outfits.emptySub', "Ask The Stylist Brain to build outfits and they'll appear here.")}
          </Text>
        </View>
      ) : (
        <FlatList
          data={outfits}
          renderItem={renderOutfit}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
          }
        />
      )}
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
function makeStyles(colors: ReturnType<typeof import('@mobile/theme').useTheme>['colors']) {
  const isRtl = I18nManager.isRTL;
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    header: {
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing[5],
      paddingTop: spacing[4],
      paddingBottom: spacing[2],
    },
    headerTitle: { fontFamily: fonts.display, fontSize: fontSizes['2xl'], color: colors.foreground },
    headerCount: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.mutedFg },
    list: { padding: spacing[4], gap: spacing[3] },
    card: {
      backgroundColor: colors.card,
      borderRadius: radii.xl,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardHeader: { alignItems: 'center', gap: spacing[3], padding: spacing[3] },
    coverThumb: { width: 56, height: 56, borderRadius: radii.md, overflow: 'hidden' },
    coverPlaceholder: { backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
    cardMeta: { flex: 1, gap: 2 },
    outfitName: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.base, color: colors.foreground },
    outfitOccasion: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.accent },
    outfitItemCount: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.mutedFg },
    cardActions: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
    deleteBtn: { padding: spacing[1] },
    deleteBtnText: { fontSize: 18 },
    chevron: { fontSize: 12, color: colors.mutedFg },
    itemsStrip: { paddingHorizontal: spacing[3], paddingBottom: spacing[3], gap: spacing[3] },
    pieceCard: { width: 80, alignItems: 'center', gap: spacing[1] },
    pieceImage: { width: 80, height: 100, borderRadius: radii.md, overflow: 'hidden' },
    piecePlaceholder: { backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
    pieceName: {
      fontFamily: fonts.body,
      fontSize: fontSizes.xs,
      color: colors.mutedFg,
      textAlign: 'center',
    },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[8], gap: spacing[3] },
    emptyIcon: { fontSize: 56 },
    emptyTitle: { fontFamily: fonts.display, fontSize: fontSizes.xl, color: colors.foreground, textAlign: 'center' },
    emptySub: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.mutedFg, textAlign: 'center', lineHeight: 22 },
    errorText: { fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.destructive, marginBottom: spacing[4] },
    retryBtn: { paddingHorizontal: spacing[5], paddingVertical: spacing[3], backgroundColor: colors.foreground, borderRadius: radii.md },
    retryBtnText: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.background },
    avatarBtn: { paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radii.lg },
    avatarBtnText: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.foreground },
  });
}
