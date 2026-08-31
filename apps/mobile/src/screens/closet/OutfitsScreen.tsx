/**
 * apps/mobile/src/screens/closet/OutfitsScreen.tsx
 *
 * Full-featured Saved Outfits & Lookbook Studio.
 * Complete parity with apps/web/src/pages/Closet.jsx & Stylist.jsx:
 *   - Correctly resolves garments from backend `item.garments ?? item.items`
 *   - Collage preview of look garments
 *   - Expanded canvas with item roles (Top, Bottom, Footwear, Accessory)
 *   - "Try on Avatar" & "Share Look" integrations
 *   - Full RTL and i18n support
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
  ScrollView,
  I18nManager,
  Share,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as Lucide from 'lucide-react-native';

import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii } from '@mobile/theme/tokens';
import { useOutfitStore } from '@mobile/lib/stores';
import { LoadingVideo } from '@mobile/components/common/LoadingVideo';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { StylistStackParamList } from '@mobile/navigation/types';

export interface SavedOutfitItem {
  id?: string;
  closet_item_id?: string;
  title?: string;
  name?: string;
  role?: string;
  category?: string;
  sub_category?: string;
  image_url?: string;
  thumbnail_data_url?: string;
  color?: string;
  colors?: any[];
  [key: string]: any;
}

export type OutfitGarment = SavedOutfitItem;

export interface SavedOutfit {
  id: string;
  _id?: string;
  user_id?: string;
  name?: string;
  title?: string;
  description?: string;
  occasion?: string;
  style?: string;
  matching_grade?: number;
  harmony_grade?: number;
  total_value?: number;
  times_worn?: number;
  date?: string;
  created_at?: string;
  usage?: {
    date?: string;
    time?: string;
    times_worn?: number;
    event_name?: string;
    [key: string]: any;
  };
  garments?: SavedOutfitItem[];
  items?: SavedOutfitItem[];
  palette?: Array<{ name: string; hex?: string }>;
  [key: string]: any;
}

export function OutfitsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<StylistStackParamList>>();
  const isRtl = I18nManager.isRTL;

  const { items: outfits, loading, prewarm, deleteSavedOutfit } = useOutfitStore({ prewarm: true });
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await prewarm({ force: true });
    } finally {
      setRefreshing(false);
    }
  }, [prewarm]);

  const handleDelete = (outfit: SavedOutfit) => {
    Alert.alert(
      t('outfits.deleteTitle', { defaultValue: 'Delete Outfit' }),
      t('outfits.deleteMessage', { defaultValue: 'Remove this look from your saved collection?' }),
      [
        { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
        {
          text: t('common.delete', { defaultValue: 'Delete' }),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteSavedOutfit(outfit.id);
            } catch (err: any) {
              Alert.alert(t('common.error', { defaultValue: 'Error' }), err?.message ?? 'Failed to delete outfit');
            }
          },
        },
      ]
    );
  };

  const handleShare = async (outfit: SavedOutfit) => {
    try {
      const shareUrl = `https://dressapp.co/share/outfit/${outfit.id}`;
      await Share.share({
        title: outfit.name || t('outfits.defaultLookName', { defaultValue: 'DressApp Look' }),
        message: t('outfits.shareMessage', {
          defaultValue: 'Check out my outfit on DressApp: {{name}}! {{url}}',
          name: outfit.name || t('outfits.defaultLookName', { defaultValue: 'Styled Look' }),
          url: shareUrl,
        }),
        url: shareUrl,
      });
    } catch {
      // Ignore
    }
  };

  const renderOutfit = ({ item }: { item: SavedOutfit }) => {
    const isExpanded = expanded === item.id;

    // Resolve garments from backend structure
    const rawGarments = item.garments ?? item.items ?? [];
    const garments: OutfitGarment[] = rawGarments.map((g: any) => ({
      id: g.closet_item_id || g.id || String(Math.random()),
      name: g.title || g.name || g.role || 'Garment',
      role: g.role || g.category,
      image_url: g.clean_image_url || g.image_url || g.thumbnail_data_url || g.cutout_url || g.segmented_image_url,

    }));

    const piecesCount = garments.length;
    const displayName =
      item.name || item.usage?.event_name || (item.created_at ? new Date(item.created_at).toLocaleDateString() : t('outfits.defaultLookName', { defaultValue: 'Saved Look' }));

    return (
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {/* Card Header */}
        <TouchableOpacity
          style={styles.cardHeader}
          onPress={() => setExpanded(isExpanded ? null : item.id)}
          activeOpacity={0.8}
        >
          {/* Garments Preview Thumbnails Grid */}
          <View style={[styles.thumbCollage, { backgroundColor: colors.cardOffWhite }]}>
            {garments.length > 0 ? (
              <View style={styles.collageGrid}>
                {garments.slice(0, 4).map((g, idx) => (
                  <View key={idx} style={styles.collageItem}>
                    {g.image_url ? (
                      <Image source={{ uri: g.image_url }} style={styles.collageImg} resizeMode="contain" />
                    ) : (
                      <Lucide.Shirt size={14} color={colors.mutedFg} />
                    )}
                  </View>
                ))}
              </View>
            ) : (
              <Lucide.Sparkles size={24} color={colors.accent} />
            )}
          </View>

          {/* Meta Info */}
          <View style={styles.cardMeta}>
            <Text style={[styles.outfitName, { color: colors.foreground }]} numberOfLines={1}>
              {displayName}
            </Text>
            <View style={styles.badgeRow}>
              {item.occasion ? (
                <View style={[styles.occasionBadge, { backgroundColor: 'rgba(31, 111, 107, 0.12)' }]}>
                  <Text style={[styles.occasionText, { color: colors.accent }]} numberOfLines={1}>
                    {item.occasion}
                  </Text>
                </View>
              ) : null}
              <Text style={[styles.piecesText, { color: colors.mutedFg }]}>
                {piecesCount} {t('outfits.pieces', { defaultValue: 'pieces' })}
              </Text>
            </View>
            {item.usage?.date && (
              <Text style={[styles.dateText, { color: colors.mutedFg }]}>
                📅 {item.usage.date} {item.usage.time ? `• ${item.usage.time}` : ''}
              </Text>
            )}
          </View>

          {/* Action Icons */}
          <View style={styles.cardHeaderActions}>
            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={() => handleDelete(item)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Lucide.Trash2 size={16} color={colors.mutedFg} />
            </TouchableOpacity>

            <Lucide.ChevronDown
              size={18}
              color={colors.mutedFg}
              style={{ transform: [{ rotate: isExpanded ? '180deg' : '0deg' }] }}
            />
          </View>
        </TouchableOpacity>

        {/* Expanded Garments Canvas Strip */}
        {isExpanded && (
          <View style={[styles.expandedSection, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
            <Text style={[styles.expandedTitle, { color: colors.foreground }]}>
              {t('outfits.lookGarments', { defaultValue: 'Garments in this Look' })}
            </Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.garmentsScroll}>
              {garments.map((g, idx) => (
                <View
                  key={idx}
                  style={[styles.garmentPillCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <View style={[styles.garmentImageWrap, { backgroundColor: colors.cardOffWhite }]}>
                    {g.image_url ? (
                      <Image source={{ uri: g.image_url }} style={styles.garmentImage} resizeMode="contain" />
                    ) : (
                      <Lucide.Shirt size={22} color={colors.mutedFg} />
                    )}
                  </View>
                  <Text style={[styles.garmentName, { color: colors.foreground }]} numberOfLines={1}>
                    {g.name}
                  </Text>
                  {g.role ? (
                    <Text style={[styles.garmentRole, { color: colors.accent }]} numberOfLines={1}>
                      {g.role}
                    </Text>
                  ) : null}
                </View>
              ))}
            </ScrollView>

            {/* Quick Actions */}
            <View style={styles.quickActionsRow}>
              <TouchableOpacity
                style={[styles.tryOnBtn, { backgroundColor: colors.primary }]}
                onPress={() => {
                  (navigation as any).navigate('Stylist', {
                    tab: 'tryon',
                    outfit: item,
                    previousScreen: 'Outfits',
                    fromScreen: 'Outfits',
                    previousTab: 'daily',
                  });
                }}
              >
                <Lucide.UserCheck size={14} color="#FFF" />
                <Text style={styles.tryOnBtnText}>{t('outfits.tryOnAvatar', { defaultValue: 'Try on Avatar' })}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.shareBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
                onPress={() => handleShare(item)}
              >
                <Lucide.Share2 size={14} color={colors.foreground} />
                <Text style={[styles.shareBtnText, { color: colors.foreground }]}>{t('common.share', { defaultValue: 'Share' })}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  };

  const BackIcon = isRtl ? Lucide.ArrowRight : Lucide.ArrowLeft;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Top Bar */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <BackIcon size={20} color={colors.foreground} />
          </TouchableOpacity>
          <View>
            <Text style={[styles.headerSuper, { color: colors.accent }]}>
              {t('outfits.lookbook', { defaultValue: 'LOOKBOOK' })}
            </Text>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>
              {t('outfits.title', { defaultValue: 'Saved Outfits' })}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.avatarBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
          onPress={() => navigation.navigate('Avatar')}
        >
          <Lucide.User size={14} color={colors.foreground} />
          <Text style={[styles.avatarBtnText, { color: colors.foreground }]}>
            {t('outfits.avatarBtn', { defaultValue: 'Avatar' })}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Outfits List */}
      {loading ? (
        <LoadingVideo message={t('outfits.loading', { defaultValue: 'Loading saved looks...' })} />
      ) : outfits.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Lucide.Sparkles size={48} color={colors.mutedFg} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            {t('outfits.noOutfits', { defaultValue: 'No Saved Outfits Yet' })}
          </Text>
          <Text style={[styles.emptyDesc, { color: colors.mutedFg }]}>
            {t('outfits.emptyDesc', {
              defaultValue: 'Ask the AI Stylist to generate new looks or compose them from your closet items.',
            })}
          </Text>
          <TouchableOpacity
            style={[styles.createFirstBtn, { backgroundColor: colors.primary }]}
            onPress={() => navigation.navigate('Stylist')}
          >
            <Lucide.Sparkles size={16} color="#FFF" />
            <Text style={styles.createFirstBtnText}>
              {t('outfits.openStylist', { defaultValue: 'Open AI Stylist' })}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={outfits}
          renderItem={renderOutfit}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  backBtn: {
    padding: 4,
  },
  headerSuper: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    letterSpacing: 1.2,
  },
  headerTitle: {
    fontFamily: fonts.displayBold,
    fontSize: fontSizes.lg,
  },
  avatarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  avatarBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs - 1,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing['2xl'] + 20,
    gap: spacing.sm + 2,
  },
  card: {
    borderRadius: radii.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  thumbCollage: {
    width: 64,
    height: 64,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  collageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
    height: '100%',
  },
  collageItem: {
    width: '50%',
    height: '50%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  collageImg: {
    width: '100%',
    height: '100%',
  },
  cardMeta: {
    flex: 1,
    gap: 3,
  },
  outfitName: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.sm + 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  occasionBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  occasionText: {
    fontFamily: fonts.bodyBold,
    fontSize: 9.5,
  },
  piecesText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs - 1,
  },
  dateText: {
    fontFamily: fonts.body,
    fontSize: 10,
  },
  cardHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBtn: {
    padding: 6,
  },
  expandedSection: {
    borderTopWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  expandedTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs + 1,
  },
  garmentsScroll: {
    gap: spacing.sm,
    paddingVertical: 4,
  },
  garmentPillCard: {
    width: 90,
    borderRadius: radii.lg,
    padding: 6,
    borderWidth: 1,
    alignItems: 'center',
    gap: 2,
  },
  garmentImageWrap: {
    width: 76,
    height: 76,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  garmentImage: {
    width: '85%',
    height: '85%',
  },
  garmentName: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    marginTop: 2,
    textAlign: 'center',
  },
  garmentRole: {
    fontFamily: fonts.body,
    fontSize: 9,
    textAlign: 'center',
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  tryOnBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: radii.full,
  },
  tryOnBtnText: {
    color: '#FFF',
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
  },
  shareBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  shareBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.xs,
  },
  emptyTitle: {
    fontFamily: fonts.displayBold,
    fontSize: fontSizes.md + 1,
    marginTop: spacing.xs,
  },
  emptyDesc: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
  createFirstBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    marginTop: spacing.md,
  },
  createFirstBtnText: {
    color: '#FFF',
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.sm,
  },
});
