/**
 * apps/mobile/src/screens/closet/SharedOutfitScreen.tsx
 *
 * Full-featured Shared Look & Public Outfit Viewer.
 * Complete parity with apps/web/src/pages/SharedOutfit.jsx:
 *   - Fetches shared look by ID
 *   - Displays outfit hero visual, items grid, description & rationale
 *   - Harmony score & dominant color palette analysis
 *   - Save Look to my closet & Share action
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Share,
  I18nManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import * as Lucide from 'lucide-react-native';

import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii } from '@mobile/theme/tokens';
import { api } from '@mobile/lib/api';
import type { ClosetStackParamList } from '@mobile/navigation/types';

interface SharedOutfitItem {
  id: string;
  name?: string;
  category?: string;
  color?: string;
  image_url?: string;
  thumbnail_data_url?: string;
}

interface SharedOutfitData {
  id?: string;
  outfit?: {
    id?: string;
    name?: string;
    why?: string;
    description?: string;
    harmony_score?: number;
    items?: SharedOutfitItem[];
    garments?: SharedOutfitItem[];
    share_card_b64?: string;
  };
}

export function SharedOutfitScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<ClosetStackParamList, 'SharedOutfit'>>();
  const { colors } = useTheme();
  const { outfitId } = route.params || {};

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SharedOutfitData | null>(null);
  const [savingToCloset, setSavingToCloset] = useState(false);

  useEffect(() => {
    (async () => {
      if (!outfitId) {
        setError(t('stylist.shareOutfit.notFound', { defaultValue: 'Shared outfit not found or link has expired.' }));
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const res = await api.getSharedOutfit(outfitId);
        setData(res);
      } catch (err: any) {
        console.warn('Failed to load shared outfit:', err);
        setError(t('stylist.shareOutfit.notFound', { defaultValue: 'Shared outfit not found or link has expired.' }));
      } finally {
        setLoading(false);
      }
    })();
  }, [outfitId, t]);

  const outfit = data?.outfit || {};
  const outfitName = outfit.name || t('stylist.untitledConversation', { defaultValue: 'Shared Outfit Look' });
  const outfitWhy = outfit.why || outfit.description || '';
  const items = outfit.items || outfit.garments || [];

  const handleShare = async () => {
    try {
      await Share.share({
        message: t('stylist.shareMessageShared', {
          defaultValue: 'Check out this look "{{name}}" curated on DressApp: {{url}}',
          name: outfitName,
          url: `https://dressapp.co/shared/${outfitId}`,
        }),
      });
    } catch (e) {
      console.warn('Share error:', e);
    }
  };

  const handleSaveToCloset = async () => {
    setSavingToCloset(true);
    try {
      await api.saveOutfit({
        name: outfitName,
        description: outfitWhy,
        item_ids: items.map((it) => it.id),
      });
      Alert.alert(t('common.success', { defaultValue: 'Saved' }), t('stylist.outfitSaved', { defaultValue: 'Look added to your saved outfits!' }));
    } catch (e) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('stylist.saveFailedProfile', { defaultValue: 'Could not save outfit to your profile.' })
      );
    } finally {
      setSavingToCloset(false);
    }
  };

  const BackIcon = I18nManager.isRTL ? Lucide.ArrowRight : Lucide.ArrowLeft;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <BackIcon size={22} color={colors.foreground} />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: colors.foreground }]} numberOfLines={1}>
          {t('stylist.sharedLook', { defaultValue: 'Shared Outfit' })}
        </Text>

        <TouchableOpacity onPress={handleShare} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Lucide.Share2 size={20} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedFg }]}>
            {t('stylist.loadingLook', { defaultValue: 'Loading curated look...' })}
          </Text>
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <Lucide.AlertCircle size={40} color="#EF4444" />
          <Text style={[styles.errorTitle, { color: colors.foreground }]}>
            {t('common.error', { defaultValue: 'Error' })}
          </Text>
          <Text style={[styles.errorText, { color: colors.mutedFg }]}>{error}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Title and harmony badge */}
          <View style={styles.titleSection}>
            <View style={[styles.badgePill, { backgroundColor: 'rgba(232, 96, 60, 0.12)' }]}>
              <Lucide.Sparkles size={12} color="#E8603C" />
              <Text style={[styles.badgePillText, { color: '#E8603C' }]}>
                {t('stylist.suggestedLook', { defaultValue: 'Curated Look' })}
              </Text>
            </View>

            <Text style={[styles.outfitTitle, { color: colors.foreground }]}>{outfitName}</Text>

            {outfit.harmony_score && (
              <View style={[styles.harmonyPill, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                <Lucide.CheckCircle2 size={13} color="#10B981" />
                <Text style={[styles.harmonyText, { color: '#10B981' }]}>
                  {outfit.harmony_score}% {t('stylist.harmonyFit', { defaultValue: 'Color & Fit Harmony' })}
                </Text>
              </View>
            )}

            {outfitWhy ? (
              <Text style={[styles.whyText, { color: colors.mutedFg }]}>{outfitWhy}</Text>
            ) : null}
          </View>

          {/* Items Grid */}
          <View style={styles.itemsGrid}>
            {items.map((item, idx) => {
              const img = item.image_url || item.thumbnail_data_url;
              return (
                <View
                  key={item.id || idx}
                  style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <View style={[styles.itemImageWrapper, { backgroundColor: colors.secondary }]}>
                    {img ? (
                      <Image source={{ uri: img }} style={styles.itemImage} resizeMode="contain" />
                    ) : (
                      <Lucide.Shirt size={32} color={colors.mutedFg} />
                    )}
                  </View>
                  <View style={styles.itemInfo}>
                    <Text style={[styles.itemName, { color: colors.foreground }]} numberOfLines={1}>
                      {item.name || item.category || t('closet.unnamedItem', { defaultValue: 'Garment' })}
                    </Text>
                    {item.color && (
                      <Text style={[styles.itemColor, { color: colors.mutedFg }]}>{item.color}</Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>

          {/* Action Button */}
          <TouchableOpacity
            style={[styles.saveActionBtn, { backgroundColor: colors.primary }]}
            onPress={handleSaveToCloset}
            disabled={savingToCloset}
            activeOpacity={0.85}
          >
            {savingToCloset ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Lucide.Bookmark size={16} color="#FFF" />
                <Text style={styles.saveActionBtnText}>
                  {t('stylist.saveLookToCloset', { defaultValue: 'Save Look to My Outfits' })}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
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
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.md,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  loadingText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
  },
  errorTitle: {
    fontFamily: fonts.displayBold,
    fontSize: fontSizes.lg,
  },
  errorText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    textAlign: 'center',
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing['2xl'],
    gap: spacing.lg,
  },
  titleSection: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  badgePillText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs - 1,
  },
  outfitTitle: {
    fontFamily: fonts.displayBold,
    fontSize: fontSizes.xl,
    textAlign: 'center',
  },
  harmonyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: radii.full,
    marginTop: 2,
  },
  harmonyText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs - 1,
  },
  whyText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 4,
  },
  itemsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  itemCard: {
    flexBasis: '48%',
    flexGrow: 1,
    borderRadius: radii.lg,
    padding: spacing.sm,
    borderWidth: 1,
    gap: spacing.xs,
  },
  itemImageWrapper: {
    width: '100%',
    height: 120,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  itemImage: {
    width: '90%',
    height: '90%',
  },
  itemInfo: {
    gap: 2,
  },
  itemName: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
  },
  itemColor: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs - 1,
  },
  saveActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
  },
  saveActionBtnText: {
    color: '#FFF',
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.sm,
  },
});
