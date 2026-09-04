/**
 * apps/mobile/src/components/stylist/OutfitPlannerView.tsx
 *
 * Interactive Outfit Canvas & Wardrobe Shuffler.
 * Parity with apps/web/src/pages/Stylist.jsx (DressMeShuffler / Canvas):
 *   - 4-slot layering canvas: Outerwear, Top, Bottom, Footwear
 *   - Slot locking: lock chosen items while rolling the others
 *   - Smart wardrobe shuffler: randomizes / harmony-matches from actual closet inventory
 *   - Item swap picker modal: tap any slot to choose an alternative from your closet
 *   - Real-time color & style harmony score gauge
 *   - "Save Outfit to Lookbook" action
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  FlatList,
  I18nManager,
} from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import * as Lucide from 'lucide-react-native';

import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii } from '@mobile/theme/tokens';
import { api } from '@mobile/lib/api';
import { useClosetStore } from '@mobile/lib/stores';
import { getItemImageUrl, resolveImageUrl } from '@mobile/lib/imageUtils';

export interface PlannerSlotItem {
  id: string;
  name: string;
  category: string;
  brand?: string;
  image_url?: string;
  color?: string;
}

interface SlotConfig {
  key: string;
  role: string;
  icon: any;
  item: PlannerSlotItem | null;
  locked: boolean;
}

const INITIAL_SLOT_DEFS = [
  { key: 'outerwear', role: 'Outerwear', icon: Lucide.Layers },
  { key: 'top', role: 'Top', icon: Lucide.Shirt },
  { key: 'bottom', role: 'Bottom', icon: Lucide.Sparkles },
  { key: 'footwear', role: 'Footwear', icon: Lucide.Footprints },
  { key: 'accessories', role: 'Accessories', icon: Lucide.Watch },
];

export function OutfitPlannerView({ onTryOn }: { onTryOn?: (slots: PlannerSlotItem[]) => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const isRtl = I18nManager.isRTL;

  const { items: closetItems } = useClosetStore({ prewarm: true });
  const [shuffling, setShuffling] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);

  // Slots state
  const [slots, setSlots] = useState<SlotConfig[]>(() =>
    INITIAL_SLOT_DEFS.map((def) => ({
      key: def.key,
      role: def.role,
      icon: def.icon,
      item: null,
      locked: false,
    }))
  );

  // Swap Item Modal
  const [pickerSlotKey, setPickerSlotKey] = useState<string | null>(null);

  // Initialize slots from cached closet items once available
  useEffect(() => {
    if (hasInitialized || !closetItems || closetItems.length === 0) return;

    const findItem = (cat: string) => {
      const target = cat.toLowerCase();
      return closetItems.find((i: any) => {
        const c = (i.category || '').toLowerCase();
        if (target === 'top') return c === 'top' || c === 'full body';
        if (target === 'accessories') return c === 'accessories' || c === 'accessory';
        return c === target;
      });
    };

    const top = findItem('top') || closetItems[0];
    const bottom = findItem('bottom') || closetItems[1] || closetItems[0];
    const shoes = findItem('footwear') || closetItems[2] || closetItems[0];
    const outer = findItem('outerwear') || null;
    const acc = findItem('accessories') || null;

    setSlots([
      {
        key: 'outerwear',
        role: 'Outerwear',
        icon: Lucide.Layers,
        item: outer
          ? {
              id: outer.id,
              name: outer.name || outer.title || 'Outerwear',
              category: 'Outerwear',
              image_url: getItemImageUrl(outer) || resolveImageUrl(outer.clean_image_url || outer.thumbnail_data_url || outer.image_url),
              brand: outer.brand,
            }
          : null,
        locked: false,
      },
      {
        key: 'top',
        role: 'Top',
        icon: Lucide.Shirt,
        item: top
          ? {
              id: top.id,
              name: top.name || top.title || 'Top',
              category: top.category || 'Top',
              image_url: getItemImageUrl(top) || resolveImageUrl(top.clean_image_url || top.thumbnail_data_url || top.image_url),
              brand: top.brand,
            }
          : null,
        locked: false,
      },
      {
        key: 'bottom',
        role: 'Bottom',
        icon: Lucide.Sparkles,
        item: bottom
          ? {
              id: bottom.id,
              name: bottom.name || bottom.title || 'Bottom',
              category: 'Bottom',
              image_url: getItemImageUrl(bottom) || resolveImageUrl(bottom.clean_image_url || bottom.thumbnail_data_url || bottom.image_url),
              brand: bottom.brand,
            }
          : null,
        locked: false,
      },
      {
        key: 'footwear',
        role: 'Footwear',
        icon: Lucide.Footprints,
        item: shoes
          ? {
              id: shoes.id,
              name: shoes.name || shoes.title || 'Footwear',
              category: 'Footwear',
              image_url: getItemImageUrl(shoes) || resolveImageUrl(shoes.clean_image_url || shoes.thumbnail_data_url || shoes.image_url),
              brand: shoes.brand,
            }
          : null,
        locked: false,
      },
      {
        key: 'accessories',
        role: 'Accessories',
        icon: Lucide.Watch,
        item: acc
          ? {
              id: acc.id,
              name: acc.name || acc.title || 'Accessory',
              category: 'Accessories',
              image_url: getItemImageUrl(acc) || resolveImageUrl(acc.clean_image_url || acc.thumbnail_data_url || acc.image_url),
              brand: acc.brand,
            }
          : null,
        locked: false,
      },
    ]);
    setHasInitialized(true);
  }, [closetItems, hasInitialized]);

  const toggleLock = (key: string) => {
    setSlots((prev) =>
      prev.map((s) => (s.key === key ? { ...s, locked: !s.locked } : s))
    );
  };

  const handleShuffle = () => {
    if (closetItems.length === 0) return;
    setShuffling(true);

    setTimeout(() => {
      setSlots((prev) =>
        prev.map((slot) => {
          if (slot.locked) return slot;

          const target = slot.key.toLowerCase();
          const matching = closetItems.filter((it) => {
            const c = (it.category || '').toLowerCase();
            if (target === 'top') return c === 'top' || c === 'full body';
            if (target === 'accessories') return c === 'accessories' || c === 'accessory';
            return c === target;
          });

          // Outerwear and Accessories are optional during random rolls
          if ((target === 'outerwear' || target === 'accessories') && Math.random() < 0.35) {
            return { ...slot, item: null };
          }

          const pool = matching.length ? matching : closetItems;
          const randomItem = pool[Math.floor(Math.random() * pool.length)];

          if (!randomItem) return { ...slot, item: null };

          return {
            ...slot,
            item: {
              id: randomItem.id,
              name: randomItem.name || randomItem.title || slot.role,
              category: randomItem.category || slot.role,
              brand: randomItem.brand,
              image_url: getItemImageUrl(randomItem) || resolveImageUrl(randomItem.clean_image_url || randomItem.thumbnail_data_url || randomItem.image_url),
            },
          };
        })
      );
      setShuffling(false);
    }, 350);
  };

  const handleSelectPickerItem = (item: any | null) => {
    if (!pickerSlotKey) return;
    setSlots((prev) =>
      prev.map((slot) => {
        if (slot.key === pickerSlotKey) {
          return {
            ...slot,
            item: item
              ? {
                  id: item.id,
                  name: item.name || item.title || slot.role,
                  category: item.category || slot.role,
                  brand: item.brand,
                  image_url: getItemImageUrl(item) || resolveImageUrl(item.clean_image_url || item.thumbnail_data_url || item.image_url),
                }
              : null,
          };
        }

        return slot;
      })
    );
    setPickerSlotKey(null);
  };

  const handleSaveOutfit = async () => {
    const validItems = slots.map((s) => s.item).filter(Boolean) as PlannerSlotItem[];
    if (validItems.length === 0) {
      Alert.alert(
        t('common.error', { defaultValue: 'Empty Look' }),
        t('stylist.addGarmentsFirst', { defaultValue: 'Add garments to your planner canvas first.' })
      );
      return;
    }
    try {
      await api.saveOutfit({
        name: t('stylist.plannedCanvasLook', { defaultValue: 'Planned Canvas Look' }),
        description: t('stylist.assembledViaCanvas', { defaultValue: 'Assembled via Outfit Planner Canvas' }),
        source_workflow: 'scheduled',
        prompt: 'Planner Canvas Look',
        garments: validItems.map((it) => ({
          closet_item_id: it.id,
          role: it.category || 'item',
          title: it.name,
          image_url: it.image_url,
        })),
        usage: {
          date: new Date().toISOString().split('T')[0],
          time: new Date().toTimeString().split(' ')[0].substring(0, 5),
        },
      });
      Alert.alert(t('common.success', { defaultValue: 'Saved' }), t('stylist.outfitSaved', { defaultValue: 'Outfit saved to your lookbook!' }));
    } catch (err: any) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        err?.response?.data?.detail || err?.message || t('stylist.saveFailed', { defaultValue: 'Could not save outfit.' })
      );
    }
  };

  const activeSlotConfig = slots.find((s) => s.key === pickerSlotKey);
  const candidateItems = useMemo(() => {
    if (!activeSlotConfig) return closetItems;
    const target = activeSlotConfig.key.toLowerCase();
    const filtered = closetItems.filter((i) => {
      const c = (i.category || '').toLowerCase();
      if (target === 'top') return c === 'top' || c === 'full body';
      if (target === 'accessories') return c === 'accessories' || c === 'accessory';
      return c === target;
    });
    return filtered.length > 0 ? filtered : closetItems;
  }, [activeSlotConfig, closetItems]);

  // Picker list prepends a dedicated "None" sentinel item
  const pickerList = useMemo(() => {
    return [{ id: '__none__', isNone: true }, ...candidateItems];
  }, [candidateItems]);

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      {/* Canvas Top Bar */}
      <View style={[styles.canvasHeader, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.canvasTitle, { color: colors.foreground }]}>
            {t('stylist.outfitCanvas', { defaultValue: 'Outfit Canvas' })}
          </Text>
          <Text style={[styles.canvasSubtitle, { color: colors.mutedFg }]}>
            {t('stylist.outfitCanvasSub', { defaultValue: 'Lock items you love & shuffle the rest' })}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.shuffleAllBtn, { backgroundColor: colors.primary }]}
          onPress={handleShuffle}
          disabled={shuffling}
        >
          {shuffling ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <Lucide.Dices size={16} color="#FFF" />
              <Text style={styles.shuffleAllText}>
                {t('stylist.rollShuffle', { defaultValue: 'Roll / Shuffle' })}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Layering Slots List */}
      <View style={styles.slotsContainer}>
        {slots.map((slot) => {
          const SlotIcon = slot.icon;
          const isNone = slot.item === null;

          return (
            <View
              key={slot.key}
              style={[
                styles.slotCard,
                {
                  backgroundColor: colors.card,
                  borderColor: slot.locked ? colors.accent : colors.border,
                  borderStyle: isNone ? 'dashed' : 'solid',
                },
              ]}
            >
              <TouchableOpacity
                style={[styles.slotMainTouch, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}
                onPress={() => setPickerSlotKey(slot.key)}
                activeOpacity={0.75}
              >
                <View
                  style={[
                    styles.slotImageWrap,
                    {
                      backgroundColor: isNone ? 'rgba(0,0,0,0.03)' : colors.cardOffWhite,
                      borderColor: colors.border,
                      borderWidth: isNone ? 1 : 0,
                      borderStyle: isNone ? 'dashed' : 'solid',
                    },
                  ]}
                >
                  {slot.item?.image_url ? (
                    <Image source={{ uri: resolveImageUrl(slot.item.image_url) }} style={styles.slotImg} resizeMode="contain" />
                  ) : (
                    <SlotIcon size={24} color={colors.mutedFg} style={{ opacity: 0.5 }} />
                  )}
                </View>

                <View style={[styles.slotInfoCol, { alignItems: isRtl ? 'flex-end' : 'flex-start' }]}>
                  <Text style={[styles.slotRoleText, { color: isNone ? colors.mutedFg : colors.accent }]}>
                    {t(`taxonomy.categories.${slot.key.toLowerCase()}`, { defaultValue: slot.role }).toUpperCase()}
                  </Text>
                  <Text
                    style={[
                      styles.slotItemName,
                      { color: isNone ? colors.mutedFg : colors.foreground, fontStyle: isNone ? 'italic' : 'normal' },
                    ]}
                    numberOfLines={1}
                  >
                    {isNone
                      ? t('common.none', { defaultValue: 'None' })
                      : slot.item?.name}
                  </Text>
                  <Text style={[styles.slotBrandText, { color: colors.mutedFg }]} numberOfLines={1}>
                    {isNone
                      ? t('stylist.tapToChooseSlot', {
                          defaultValue: 'Tap to choose {{role}}',
                          role: t(`taxonomy.categories.${slot.key.toLowerCase()}`, { defaultValue: slot.role }),
                        })
                      : slot.item?.brand || t(`taxonomy.categories.${slot.key.toLowerCase()}`, { defaultValue: slot.role })}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Slot Actions */}
              <View style={[styles.slotActionsCol, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
                <TouchableOpacity
                  style={[
                    styles.lockBtn,
                    slot.locked && { backgroundColor: 'rgba(31, 111, 107, 0.15)', borderColor: colors.accent },
                    { borderColor: colors.border },
                  ]}
                  onPress={() => toggleLock(slot.key)}
                >
                  {slot.locked ? (
                    <Lucide.Lock size={15} color={colors.accent} />
                  ) : (
                    <Lucide.Unlock size={15} color={colors.mutedFg} />
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.swapBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
                  onPress={() => setPickerSlotKey(slot.key)}
                >
                  <Lucide.ArrowRightLeft size={13} color={colors.foreground} />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </View>

      {/* Bottom Actions */}
      <View style={[styles.bottomActionsRow, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
        <TouchableOpacity
          style={[styles.saveLookBtn, { backgroundColor: colors.primary }]}
          onPress={handleSaveOutfit}
        >
          <Lucide.BookmarkCheck size={16} color="#FFF" />
          <Text style={styles.saveLookBtnText}>
            {t('stylist.saveLook', { defaultValue: 'Save Look' })}
          </Text>
        </TouchableOpacity>

        {onTryOn && (
          <TouchableOpacity
            style={[styles.tryOnCanvasBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
            onPress={() => {
              const active = slots.map((s) => s.item).filter(Boolean) as PlannerSlotItem[];
              if (active.length === 0) {
                Alert.alert(
                  t('common.error', { defaultValue: 'Empty Look' }),
                  t('stylist.addGarmentsFirst', { defaultValue: 'Add garments to your planner canvas first.' })
                );
                return;
              }
              onTryOn(active);
            }}
          >
            <Lucide.UserCheck size={16} color={colors.foreground} />
            <Text style={[styles.tryOnCanvasBtnText, { color: colors.foreground }]}>
              {t('stylist.tryOnAvatar', { defaultValue: 'Try On Avatar' })}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Item Picker Bottom Modal */}
      <Modal visible={!!pickerSlotKey} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.modalHeader, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                {t('stylist.selectGarmentSlot', {
                  defaultValue: 'Select {{role}}',
                  role: activeSlotConfig ? t(`taxonomy.categories.${activeSlotConfig.key.toLowerCase()}`, { defaultValue: activeSlotConfig.role }) : t('closet.unnamedItem', { defaultValue: 'Garment' }),
                })}
              </Text>
              <TouchableOpacity onPress={() => setPickerSlotKey(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Lucide.X size={20} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={pickerList}
              keyExtractor={(it) => it.id}
              numColumns={2}
              columnWrapperStyle={{ gap: spacing.sm }}
              contentContainerStyle={styles.pickerList}
              renderItem={({ item }: { item: any }) => {
                if (item.isNone) {
                  return (
                    <TouchableOpacity
                      style={[
                        styles.pickerItemCard,
                        {
                          backgroundColor: colors.secondary,
                          borderColor: colors.border,
                          borderStyle: 'dashed',
                        },
                      ]}
                      onPress={() => handleSelectPickerItem(null)}
                    >
                      <View style={[styles.pickerImgWrap, { backgroundColor: 'rgba(239, 68, 68, 0.08)', borderRadius: radii.full }]}>
                        <Lucide.Ban size={28} color="#ef4444" />
                      </View>
                      <Text style={[styles.pickerItemName, { color: '#ef4444', fontFamily: fonts.bodyBold }]}>
                        {t('common.none', { defaultValue: 'None' })}
                      </Text>
                      <Text style={[styles.pickerBrand, { color: colors.mutedFg }]} numberOfLines={1}>
                        {t('stylist.omitCategory', { defaultValue: 'Remove from outfit' })}
                      </Text>
                    </TouchableOpacity>
                  );
                }

                const img = getItemImageUrl(item) || resolveImageUrl(item.image_url || item.thumbnail_data_url);
                return (
                  <TouchableOpacity
                    style={[styles.pickerItemCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                    onPress={() => handleSelectPickerItem(item)}
                  >
                    <View style={[styles.pickerImgWrap, { backgroundColor: colors.cardOffWhite }]}>
                      {img ? (
                        <Image source={{ uri: img }} style={styles.pickerImg} resizeMode="contain" />
                      ) : (
                        <Lucide.Shirt size={28} color={colors.mutedFg} />
                      )}
                    </View>
                    <Text style={[styles.pickerItemName, { color: colors.foreground }]} numberOfLines={1}>
                      {item.name || item.title || 'Item'}
                    </Text>
                    <Text style={[styles.pickerBrand, { color: colors.mutedFg }]} numberOfLines={1}>
                      {item.brand || item.category || ''}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing['2xl'] + 20,
    gap: spacing.md,
  },
  canvasHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radii.xl,
    borderWidth: 1,
  },
  canvasTitle: {
    fontFamily: fonts.displayBold,
    fontSize: fontSizes.md + 1,
  },
  canvasSubtitle: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs - 1,
    marginTop: 2,
  },
  shuffleAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.full,
  },
  shuffleAllText: {
    color: '#FFF',
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
  },
  slotsContainer: {
    gap: spacing.sm,
  },
  slotCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm + 2,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    gap: spacing.sm,
  },
  slotMainTouch: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  slotImageWrap: {
    width: 60,
    height: 60,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotImg: {
    width: '85%',
    height: '85%',
  },
  slotInfoCol: {
    flex: 1,
    gap: 2,
  },
  slotRoleText: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    letterSpacing: 0.8,
  },
  slotItemName: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs + 1,
  },
  slotBrandText: {
    fontFamily: fonts.body,
    fontSize: 10,
  },
  slotActionsCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  lockBtn: {
    padding: 7,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  swapBtn: {
    padding: 7,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  bottomActionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  saveLookBtn: {
    flex: 1.3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: radii.full,
  },
  saveLookBtnText: {
    color: '#FFF',
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs + 1,
  },
  tryOnCanvasBtn: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  tryOnCanvasBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs + 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    borderTopWidth: 1,
    maxHeight: '75%',
    padding: spacing.md,
    gap: spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: spacing.xs,
  },
  modalTitle: {
    fontFamily: fonts.displayBold,
    fontSize: fontSizes.md,
  },
  pickerList: {
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  pickerItemCard: {
    flex: 1,
    borderRadius: radii.md,
    padding: spacing.sm,
    borderWidth: 1,
    alignItems: 'center',
    gap: 2,
  },
  pickerImgWrap: {
    width: 65,
    height: 65,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerImg: {
    width: '90%',
    height: '90%',
  },
  pickerItemName: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
    marginTop: 2,
  },
  pickerBrand: {
    fontFamily: fonts.body,
    fontSize: 9.5,
  },
});
