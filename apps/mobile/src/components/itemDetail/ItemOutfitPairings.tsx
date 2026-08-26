/**
 * apps/mobile/src/components/itemDetail/ItemOutfitPairings.tsx
 *
 * Smart Outfit Pairings & Looks Generator.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Lucide from 'lucide-react-native';
import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii } from '@mobile/theme/tokens';

export interface PairedOutfit {
  id?: string;
  name?: string;
  occasion?: string;
  harmony_score?: number;
  items?: Array<{
    id: string;
    name?: string;
    image_url?: string;
    thumbnail_data_url?: string;
    category?: string;
  }>;
}

interface ItemOutfitPairingsProps {
  loading: boolean;
  onGeneratePress: () => void;
  outfits: PairedOutfit[];
  onOutfitPress?: (outfit: PairedOutfit) => void;
}

export function ItemOutfitPairings({
  loading,
  onGeneratePress,
  outfits,
  onOutfitPress,
}: ItemOutfitPairingsProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Lucide.Shirt size={18} color={colors.accent} />
          <Text style={[styles.title, { color: colors.foreground }]}>
            {t('itemDetail.outfitPairingsTitle', { defaultValue: 'Smart Outfit Combinations' })}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.generateBtn, { backgroundColor: colors.primary }]}
          onPress={onGeneratePress}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <Lucide.Wand2 size={13} color="#FFF" />
              <Text style={styles.generateBtnText}>
                {t('itemDetail.generateLooks', { defaultValue: 'Generate Looks' })}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <Text style={[styles.desc, { color: colors.mutedFg }]}>
        {t('itemDetail.outfitPairingsDesc', {
          defaultValue: 'Discover how this item pairs with the rest of your closet for different occasions.',
        })}
      </Text>

      {outfits.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.outfitsScroll}>
          {outfits.map((outfit, index) => (
            <TouchableOpacity
              key={outfit.id || index}
              style={[styles.outfitCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}
              onPress={() => onOutfitPress?.(outfit)}
              activeOpacity={0.8}
            >
              <View style={styles.outfitHeader}>
                <Text style={[styles.outfitName, { color: colors.foreground }]} numberOfLines={1}>
                  {outfit.name || t('stylist.lookNumber', { defaultValue: 'Look #{{num}}', num: index + 1 })}
                </Text>
                {outfit.harmony_score && (
                  <View style={[styles.scoreBadge, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                    <Text style={[styles.scoreText, { color: '#10B981' }]}>
                      {outfit.harmony_score}%
                    </Text>
                  </View>
                )}
              </View>

              {/* Items Thumbnails row */}
              <View style={styles.thumbsRow}>
                {(outfit.items || []).slice(0, 4).map((it, idx) => {
                  const src = it.image_url || it.thumbnail_data_url;
                  return (
                    <View key={it.id || idx} style={[styles.thumbBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      {src ? (
                        <Image source={{ uri: src }} style={styles.thumbImage} resizeMode="contain" />
                      ) : (
                        <Lucide.Shirt size={14} color={colors.mutedFg} />
                      )}
                    </View>
                  );
                })}
              </View>

              {outfit.occasion && (
                <Text style={[styles.occasionText, { color: colors.mutedFg }]}>
                  {outfit.occasion}
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : (
        !loading && (
          <TouchableOpacity
            style={[styles.emptyPrompt, { backgroundColor: colors.secondary }]}
            onPress={onGeneratePress}
          >
            <Lucide.Sparkles size={16} color={colors.accent} />
            <Text style={[styles.emptyPromptText, { color: colors.foreground }]}>
              {t('itemDetail.clickToGeneratePairings', {
                defaultValue: 'Tap "Generate Looks" to pair with your wardrobe.',
              })}
            </Text>
          </TouchableOpacity>
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.xl,
    padding: spacing.md,
    borderWidth: 1,
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  title: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.sm,
  },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: radii.md,
  },
  generateBtnText: {
    color: '#FFF',
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
  },
  desc: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    lineHeight: 16,
  },
  outfitsScroll: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  outfitCard: {
    width: 170,
    borderRadius: radii.lg,
    padding: spacing.sm,
    borderWidth: 1,
    gap: spacing.xs,
  },
  outfitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  outfitName: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
    flex: 1,
    marginRight: 4,
  },
  scoreBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  scoreText: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
  },
  thumbsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  thumbBox: {
    width: 34,
    height: 34,
    borderRadius: radii.sm,
    borderWidth: 0.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  occasionText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs - 2,
  },
  emptyPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: spacing.md,
    borderRadius: radii.lg,
  },
  emptyPromptText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.xs,
  },
});
