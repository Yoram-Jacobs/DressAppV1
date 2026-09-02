/**
 * apps/mobile/src/components/OutfitCompletionSheet.tsx
 *
 * Bottom sheet modal for completing an outfit around 1..N selected closet garments.
 * Parity with apps/web/src/components/OutfitCompletionSheet.jsx.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import * as Lucide from 'lucide-react-native';

import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii } from '@mobile/theme/tokens';
import { api } from '@mobile/lib/api';

interface OutfitCompletionSheetProps {
  open: boolean;
  onClose: () => void;
  anchorIds?: string[];
  anchorsHint?: any[];
  onSelectLook?: (look: any) => void;
}

export function OutfitCompletionSheet({
  open,
  onClose,
  anchorIds = [],
  anchorsHint = [],
  onSelectLook,
}: OutfitCompletionSheetProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const [loading, setLoading] = useState(false);
  const [completionData, setCompletionData] = useState<any>(null);

  useEffect(() => {
    if (!open || !anchorIds.length) return;
    setLoading(true);
    (async () => {
      try {
        const res = await (api as any).completeOutfit?.({
          item_ids: anchorIds,
        }).catch(() => null);

        if (res) {
          setCompletionData(res);
        }
      } catch (e) {
        console.warn('Outfit completion failed:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, anchorIds]);

  if (!open) return null;

  return (
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <View style={styles.headerTitleRow}>
            <Lucide.Sparkles size={20} color={colors.accent} />
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>
              {t('closet.completeOutfit', { defaultValue: 'Complete Outfit' })}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.secondary }]}>
            <Lucide.X size={18} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Selected Anchor Items */}
          <Text style={[styles.sectionTitle, { color: colors.mutedFg }]}>
            {t('closet.anchorItems', { defaultValue: 'Selected Anchor Pieces' })}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.anchorRow}>
            {anchorsHint.map((item, i) => (
              <View key={item.id || i} style={[styles.anchorCard, { borderColor: colors.border }]}>
                {item.thumbnail_data_url || item.image_url ? (
                  <Image
                    source={{ uri: item.thumbnail_data_url || item.image_url }}
                    style={[styles.anchorImg, { backgroundColor: colors.cardOffWhite }]}
                    resizeMode="contain"
                  />
                ) : (
                  <View style={[styles.anchorImg, styles.anchorPlaceholder, { backgroundColor: colors.cardOffWhite }]}>
                    <Text style={{ color: colors.mutedFg, fontSize: 10 }}>{item.category || 'Piece'}</Text>
                  </View>
                )}
                <Text style={[styles.anchorName, { color: colors.foreground }]} numberOfLines={1}>
                  {item.name || item.title || 'Item'}
                </Text>
              </View>
            ))}
          </ScrollView>

          {loading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={[styles.loadingText, { color: colors.mutedFg }]}>
                {t('stylist.matchingOutfits', { defaultValue: 'Finding harmonic matches in your closet…' })}
              </Text>
            </View>
          ) : completionData?.completions ? (
            <View style={styles.resultsContainer}>
              <Text style={[styles.sectionTitle, { color: colors.mutedFg }]}>
                {t('stylist.recommendedMatches', { defaultValue: 'Stylist Recommendations' })}
              </Text>

              {completionData.completions.map((comp: any, idx: number) => (
                <View
                  key={idx}
                  style={[styles.compCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <View style={styles.compHeader}>
                    <Text style={[styles.compTitle, { color: colors.foreground }]}>
                      {comp.title || `Look Option ${idx + 1}`}
                    </Text>
                    {comp.harmony_score ? (
                      <View style={[styles.scoreBadge, { backgroundColor: colors.secondary }]}>
                        <Text style={[styles.scoreText, { color: colors.accent }]}>
                          ★ {Math.round(comp.harmony_score * 100)}%
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {comp.rationale ? (
                    <Text style={[styles.rationale, { color: colors.mutedFg }]}>
                      {comp.rationale}
                    </Text>
                  ) : null}

                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.matchItemsRow}>
                    {(comp.items || []).map((mItem: any, mIdx: number) => (
                      <View key={mItem.id || mIdx} style={styles.matchItemCard}>
                        {mItem.thumbnail_data_url || mItem.image_url ? (
                          <Image
                            source={{ uri: mItem.thumbnail_data_url || mItem.image_url }}
                            style={[styles.matchItemImg, { backgroundColor: colors.cardOffWhite }]}
                            resizeMode="contain"
                          />
                        ) : null}
                        <Text style={[styles.matchItemName, { color: colors.foreground }]} numberOfLines={1}>
                          {mItem.name || mItem.title || 'Garment'}
                        </Text>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.centerBox}>
              <Text style={[styles.loadingText, { color: colors.mutedFg }]}>
                {t('stylist.readyToMatch', { defaultValue: 'Ready to find matching looks for these pieces.' })}
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  headerTitle: {
    fontFamily: fonts.displayBold,
    fontSize: fontSizes.lg,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    padding: spacing[4],
    paddingBottom: spacing[10],
  },
  sectionTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing[2],
  },
  anchorRow: {
    gap: spacing[2],
    marginBottom: spacing[4],
  },
  anchorCard: {
    width: 72,
    alignItems: 'center',
  },
  anchorImg: {
    width: 72,
    height: 72,
    borderRadius: radii.lg,
  },
  anchorPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  anchorName: {
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
    marginTop: 4,
  },
  centerBox: {
    paddingVertical: spacing[8],
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
  },
  loadingText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
  },
  resultsContainer: {
    gap: spacing[3],
  },
  compCard: {
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: spacing[4],
    gap: spacing[2],
  },
  compHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  compTitle: {
    fontFamily: fonts.displayBold,
    fontSize: fontSizes.base,
  },
  scoreBadge: {
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  scoreText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
  },
  rationale: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    lineHeight: fontSizes.xs * 1.4,
  },
  matchItemsRow: {
    gap: spacing[2],
    marginTop: spacing[2],
  },
  matchItemCard: {
    width: 60,
    alignItems: 'center',
  },
  matchItemImg: {
    width: 60,
    height: 60,
    borderRadius: radii.md,
  },
  matchItemName: {
    fontFamily: fonts.body,
    fontSize: 9,
    marginTop: 2,
  },
});
