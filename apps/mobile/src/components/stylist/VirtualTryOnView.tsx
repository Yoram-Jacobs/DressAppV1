/**
 * apps/mobile/src/components/stylist/VirtualTryOnView.tsx
 *
 * Full-featured Virtual Fitting Room with live garment layering on SVG Avatar,
 * Outfit Header (Back, Share, Delete), Editable Name, Harmonious Palette card,
 * and Pieces / Metrics segmented tabs.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Share,
  TextInput,
  Modal,
  I18nManager,
} from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import * as Lucide from 'lucide-react-native';

import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii, shadows } from '@mobile/theme/tokens';
import { DynamicAvatarSvg } from '@mobile/components/DynamicAvatarSvg';
import { HarmonyBadge } from '@mobile/components/stylist/HarmonyBadge';
import { api } from '@mobile/lib/api';
import { useClosetStore, closetStore } from '@mobile/lib/stores/closetStore';

export interface TryOnItem {
  id: string;
  closet_item_id?: string;
  name?: string;
  role?: string;
  category?: string;
  sub_category?: string;
  color?: string;
  image_url?: string;
  thumbnail_data_url?: string;
}

interface VirtualTryOnViewProps {
  activeOutfit?: TryOnItem[];
  outfitData?: any;
  onBack?: () => void;
  onOpenAvatarSettings?: () => void;
  onDeleteSuccess?: () => void;
}

const resolveSlot = (role?: string, category?: string, name?: string, closetItem?: any): string => {
  const cCat = (closetItem?.category || '').toLowerCase().trim();
  const cSub = (closetItem?.sub_category || closetItem?.subcategory || closetItem?.item_type || '').toLowerCase().trim();
  const r = (role || category || '').toLowerCase().trim().replace(/[\s_-]+/g, '_');
  const n = `${name || ''} ${closetItem?.name || ''} ${closetItem?.title || ''}`.toLowerCase().trim();

  // 1. Footwear / Shoes (Checked first so shoes/sneakers are never mistaken for tops or accessories)
  if (
    cCat.includes('footwear') || cCat.includes('shoe') || cSub.includes('shoe') || cSub.includes('sneaker') ||
    r.includes('shoe') || r.includes('footwear') || r.includes('sneaker') || r.includes('boot') || r.includes('sandal') || r.includes('heel') ||
    n.includes('shoes') || n.includes('sneakers') || n.includes('boots') || n.includes('sandals') || n.includes('heels') ||
    n.includes('נעליים') || n.includes('סניקרס') || n.includes('סנדלים') || n.includes('מגפיים') || n.includes('עקבים') || n.includes('כפכפים') ||
    n.includes('حذاء') || n.includes('أحذية') || n.includes('صندل') || n.includes('بوت')
  ) {
    return 'shoes';
  }

  // 2. Headwear
  if (
    cCat.includes('headwear') || cCat.includes('hat') || cSub.includes('hat') || cSub.includes('cap') ||
    r.includes('headwear') || r.includes('hat') || r.includes('cap') || r.includes('beanie') ||
    n.includes('hat') || n.includes('cap') || n.includes('beanie') || n.includes('bandana') || n.includes('beret') ||
    n.includes('כובע') || n.includes('בנדנה') || n.includes('קסקט') || n.includes('קובע') || n.includes('ברט') || n.includes('قبعة')
  ) {
    return 'headwear';
  }

  // 3. Glasses / Eyewear
  if (
    cCat.includes('glasses') || cCat.includes('eyewear') || cSub.includes('glasses') ||
    r.includes('glass') || r.includes('sunglass') || r.includes('eyewear') ||
    n.includes('glasses') || n.includes('sunglasses') || n.includes('משקפיים') || n.includes('משקפי שמש') || n.includes('نظارات')
  ) {
    return 'glasses';
  }

  // 4. Dress / One-piece
  if (
    cCat.includes('dress') || cCat.includes('gown') || cCat.includes('jumpsuit') || cSub.includes('dress') ||
    r.includes('dress') || r.includes('gown') || r.includes('jumpsuit') ||
    n.includes('dress') || n.includes('gown') || n.includes('jumpsuit') || n.includes('שמלה') || n.includes('אוברול') || n.includes('סרבל') || n.includes('فستان')
  ) {
    return 'dress';
  }

  // 5. Outerwear / Jackets / Hoodies
  if (
    cCat.includes('outerwear') || cCat.includes('jacket') || cCat.includes('coat') || cSub.includes('jacket') || cSub.includes('coat') ||
    r.includes('outerwear') || r.includes('jacket') || r.includes('coat') || r.includes('blazer') || r.includes('hoodie') || r.includes('cardigan') ||
    n.includes('jacket') || n.includes('coat') || n.includes('blazer') || n.includes('hoodie') || n.includes('cardigan') ||
    n.includes('מעיל') || n.includes('ז\'קט') || n.includes('ג\'קט') || n.includes('בלייזר') || n.includes('קרדיגן') || n.includes('סווטשירט') ||
    n.includes('سترة') || n.includes('معطف') || n.includes('جاكيت')
  ) {
    return 'outerwear';
  }

  // 6. Bottoms / Pants / Shorts / Skirts
  if (
    cCat.includes('bottom') || cCat.includes('pant') || cCat.includes('short') || cSub.includes('pant') || cSub.includes('short') || cSub.includes('skirt') || cSub.includes('jean') ||
    r.includes('bottom') || r.includes('pant') || r.includes('short') || r.includes('jean') || r.includes('skirt') || r.includes('trouser') ||
    n.includes('pants') || n.includes('shorts') || n.includes('jeans') || n.includes('skirt') || n.includes('trousers') || n.includes('cargo') ||
    n.includes('מכנסיים') || n.includes('שורטס') || n.includes('חצאית') || n.includes('ברמודה') || n.includes('ג\'ינס') || n.includes('טייץ') ||
    n.includes('بنطال') || n.includes('سروال') || n.includes('تنورة') || n.includes('شورت')
  ) {
    return 'bottom';
  }

  // 7. Belt
  if (cCat.includes('belt') || cSub.includes('belt') || r.includes('belt') || n.includes('belt') || n.includes('חגורה') || n.includes('חגורת') || n.includes('حزام')) {
    return 'belt';
  }

  // 8. Bag
  if (
    cCat.includes('bag') || cSub.includes('bag') || cSub.includes('tote') || cSub.includes('purse') ||
    r.includes('bag') || r.includes('purse') || r.includes('backpack') ||
    n.includes('bag') || n.includes('purse') || n.includes('backpack') || n.includes('tote') || n.includes('clutch') ||
    n.includes('תיק') || n.includes('תרמיל') || n.includes('ארנק') || n.includes('حقيبة')
  ) {
    return 'bag';
  }

  // 9. Tops
  if (
    cCat.includes('top') || cCat.includes('shirt') || cSub.includes('shirt') || cSub.includes('tee') || cSub.includes('top') ||
    r.includes('top') || r.includes('shirt') || r.includes('tee') || r.includes('blouse') || r.includes('polo') ||
    n.includes('shirt') || n.includes('tee') || n.includes('t-shirt') || n.includes('top') || n.includes('polo') || n.includes('blouse') || n.includes('tank') ||
    n.includes('חולצה') || n.includes('טי שירט') || n.includes('גופייה') || n.includes('פולו') || n.includes('סוודר') || n.includes('قميص') || n.includes('تي شيرت')
  ) {
    return 'top';
  }

  return 'accessory';
};

function extractColorFromGarment(g: any, closetItem?: any): string {
  // 1. Direct color on closetItem
  if (typeof closetItem?.color === 'string' && closetItem.color.trim()) return closetItem.color.trim();

  // 2. Colors array on closetItem
  if (Array.isArray(closetItem?.colors) && closetItem.colors.length > 0) {
    const first = closetItem.colors[0];
    const cName = typeof first === 'string' ? first : first?.name;
    if (cName && cName.trim()) return cName.trim();
  }

  // 3. Direct color on garment
  if (typeof g?.color === 'string' && g.color.trim() && g.color.toLowerCase() !== 'black') return g.color.trim();

  // 4. Colors array on garment
  if (Array.isArray(g?.colors) && g.colors.length > 0) {
    const first = g.colors[0];
    const cName = typeof first === 'string' ? first : first?.name;
    if (cName && cName.trim()) return cName.trim();
  }

  // 5. Inferred from title/name/caption
  const text = `${g?.name || ''} ${g?.title || ''} ${closetItem?.name || ''} ${closetItem?.title || ''} ${closetItem?.caption || ''} ${closetItem?.description || ''}`.toLowerCase();
  if (text.includes('khaki') || text.includes('chaki')) return 'Khaki';
  if (text.includes('navy blue') || text.includes('navy')) return 'Navy';
  if (text.includes('olive green') || text.includes('olive')) return 'Olive';
  if (text.includes('dark green') || text.includes('forest green')) return 'Dark Green';
  if (text.includes('light blue') || text.includes('sky blue')) return 'Light Blue';
  if (text.includes('denim')) return 'Denim';
  if (text.includes('blue')) return 'Blue';
  if (text.includes('green')) return 'Green';
  if (text.includes('red') || text.includes('crimson') || text.includes('maroon')) return 'Red';
  if (text.includes('white') || text.includes('off-white') || text.includes('cream')) return 'White';
  if (text.includes('charcoal')) return 'Charcoal';
  if (text.includes('grey') || text.includes('gray')) return 'Grey';
  if (text.includes('brown') || text.includes('tan')) return 'Brown';
  if (text.includes('beige')) return 'Beige';
  if (text.includes('yellow') || text.includes('mustard')) return 'Yellow';
  if (text.includes('orange') || text.includes('rust')) return 'Orange';
  if (text.includes('pink') || text.includes('rose')) return 'Pink';
  if (text.includes('purple') || text.includes('violet')) return 'Purple';
  if (text.includes('black')) return 'Black';

  if (typeof g?.color === 'string' && g.color.trim()) return g.color.trim();

  return 'Neutral';
}

function extractSubcategoryName(g: any, closetItem?: any, t?: any): string {
  const sub = closetItem?.sub_category || closetItem?.subcategory || g?.sub_category || g?.subcategory || closetItem?.item_type;
  if (sub && typeof sub === 'string' && sub.trim()) {
    return sub.trim();
  }

  const name = closetItem?.name || closetItem?.title || g?.name || g?.title;
  if (name && typeof name === 'string' && name.trim() && !name.toLowerCase().includes('garment')) {
    return name.trim();
  }

  const role = closetItem?.category || g?.role || g?.category || 'Garment';
  return role;
}

export function VirtualTryOnView({
  activeOutfit = [],
  outfitData,
  onBack,
  onOpenAvatarSettings,
  onDeleteSuccess,
}: VirtualTryOnViewProps) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const navigation = useNavigation<any>();
  const isRtl = I18nManager.isRTL;

  const [currentName, setCurrentName] = useState<string>(
    outfitData?.name || (outfitData?.created_at ? new Date(outfitData.created_at).toLocaleDateString() : 'Look')
  );
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameInput, setEditNameInput] = useState('');

  const [subTab, setSubTab] = useState<'pieces' | 'metrics'>('pieces');

  const [avatarParams, setAvatarParams] = useState<any>({
    gender: 'male',
    skinTone: '#C68642',
    height: 170,
    chest: 90,
    waist: 72,
    hip: 96,
    shoulders: 40,
    armLength: 60,
    inseam: 78,
  });

  const [visibleLayers, setVisibleLayers] = useState<Record<string, boolean>>({
    headwear: true,
    glasses: true,
    top: true,
    bottom: true,
    shoes: true,
    outerwear: true,
    dress: true,
    belt: true,
    accessory: true,
    bag: true,
  });

  useEffect(() => {
    (async () => {
      try {
        const res = await api.getAvatarParams().catch(() => null);
        if (res) {
          setAvatarParams((prev: any) => ({ ...prev, ...res }));
        }
      } catch {
        // Keep defaults
      }
    })();
  }, []);

  const { items: closetItems } = useClosetStore();

  const garmentList = useMemo(() => {
    const raw = activeOutfit.length > 0
      ? activeOutfit
      : (outfitData?.garments || outfitData?.items || []);

    const allStoreItems = closetItems && closetItems.length > 0 ? closetItems : (closetStore.getSnapshot().items || []);

    if (raw.length === 0) {
      return [
        { id: '1', role: 'Top', name: 'Graphic T-Shirt', category: 'Top', sub_category: 'T-Shirt', color: 'Dark Green' },
        { id: '2', role: 'Bottom', name: 'Cargo Shorts', category: 'Bottom', sub_category: 'Cargo Shorts', color: 'Khaki' },
        { id: '3', role: 'Footwear', name: 'Classic Sneakers', category: 'Footwear', sub_category: 'Sneakers', color: 'White' },
      ];
    }

    return raw.map((g: any, idx: number) => {
      const targetId = g.closet_item_id || g.id;
      const closetItem = allStoreItems.find(
        (it: any) => it && (
          it.id === targetId ||
          it._id === targetId ||
          (g.closet_item_id && (it.id === g.closet_item_id || it._id === g.closet_item_id)) ||
          (g.id && (it.id === g.id || it._id === g.id))
        )
      );

      const color = extractColorFromGarment(g, closetItem);
      const subCategory = extractSubcategoryName(g, closetItem, t);
      const cAny = closetItem as any;
      const imageUrl =
        closetItem?.clean_image_url ||
        g.clean_image_url ||
        cAny?.reconstructed_image_url ||
        cAny?.cutout_url ||
        closetItem?.thumbnail_data_url ||
        g.thumbnail_data_url ||
        cAny?.image_data_url ||
        g.image_data_url ||
        cAny?.segmented_image_url ||
        g.segmented_image_url ||
        closetItem?.image_url ||
        g.image_url ||
        cAny?.original_image_url;


      return {
        id: targetId || `item_${idx}`,
        closet_item_id: closetItem?.id || targetId,
        name: subCategory,
        sub_category: subCategory,
        role: g.role || closetItem?.category || g.category || 'Top',
        category: closetItem?.category || g.category || g.role || 'Top',
        color,
        image_url: imageUrl,
      };
    });
  }, [activeOutfit, outfitData, closetItems, t]);

  const garmentsMap = useMemo(() => {
    const map: Record<string, TryOnItem> = {};
    garmentList.forEach((g: TryOnItem) => {
      const targetId = g.closet_item_id || g.id;
      const closetItem: any = closetItems.find(
        (it: any) => it && (it.id === targetId || it._id === targetId || String(it.id) === String(targetId))
      );
      const slot = resolveSlot(g.role, g.category, g.name, closetItem);
      map[slot] = g;
    });
    return map;
  }, [garmentList, closetItems]);

  const paletteColors = useMemo(() => {
    return garmentList.map((g: TryOnItem) => ({
      name: g.color || 'Neutral',
    }));
  }, [garmentList]);

  const toggleLayer = (slot: string) => {
    setVisibleLayers((prev) => ({ ...prev, [slot]: !prev[slot] }));
  };

  const handleOpenItemDetail = (item: TryOnItem) => {
    const targetId = item.closet_item_id || item.id;
    if (targetId) {
      navigation.navigate('ItemDetail', { itemId: targetId });
    }
  };

  const handleShare = async () => {
    try {
      const piecesNames = garmentList.map((g: TryOnItem) => `• ${g.name}`).join('\n');
      await Share.share({
        message: `${currentName}\n\n${t('stylist.outfitPieces', { defaultValue: 'Outfit Pieces' })}:\n${piecesNames}\n\nCurated with DressApp`,
      });
    } catch (err) {
      console.warn('Share error:', err);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      t('common.delete', { defaultValue: 'Delete Outfit' }),
      t('outfits.confirmDelete', { defaultValue: 'Are you sure you want to delete this outfit look?' }),
      [
        { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
        {
          text: t('common.delete', { defaultValue: 'Delete' }),
          style: 'destructive',
          onPress: async () => {
            try {
              if (outfitData?.id) {
                await api.deleteSavedOutfit(outfitData.id).catch(() => null);
              }
              if (onDeleteSuccess) {
                onDeleteSuccess();
              } else if (onBack) {
                onBack();
              }
            } catch (err) {
              console.error('Failed to delete outfit:', err);
            }
          },
        },
      ]
    );
  };

  const handleSaveRename = async () => {
    if (!editNameInput.trim()) return;
    const newName = editNameInput.trim();
    setCurrentName(newName);
    setIsEditingName(false);
    try {
      if (outfitData?.id) {
        await api.updateSavedOutfit(outfitData.id, { name: newName }).catch(() => null);
      }
    } catch (err) {
      console.warn('Rename error:', err);
    }
  };

  const formattedDate = useMemo(() => {
    const rawDate = outfitData?.created_at || outfitData?.date || outfitData?.usage?.date;
    if (!rawDate) {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} · ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
    }
    try {
      const d = new Date(rawDate);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} · ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
    } catch {
      return String(rawDate);
    }
  }, [outfitData]);

  const styleOccasion = outfitData?.occasion || outfitData?.style || 'Casual';
  const timesWorn = outfitData?.times_worn ?? 1;
  const totalValue = (outfitData?.total_value || 0).toFixed(2);
  const overallGrade = outfitData?.matching_grade || 88;

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      {/* ── Main Fitting Card ──────────────────────────────────────────────── */}
      <View style={[styles.mainCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        
        {/* Top Actions: Back / Share / Delete */}
        <View style={styles.topActionsRow}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
            onPress={onBack}
            activeOpacity={0.8}
          >
            <Lucide.ArrowLeft size={16} color={colors.foreground} />
            <Text style={[styles.actionBtnText, { color: colors.foreground }]}>
              {t('common.back', { defaultValue: 'Back' })}
            </Text>
          </TouchableOpacity>

          <View style={styles.rightActions}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
              onPress={handleShare}
              activeOpacity={0.8}
            >
              <Lucide.Share2 size={15} color={colors.foreground} />
              <Text style={[styles.actionBtnText, { color: colors.foreground }]}>
                {t('common.share', { defaultValue: 'Share' })}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.deleteBtn, { backgroundColor: '#ef4444' }]}
              onPress={handleDelete}
              activeOpacity={0.8}
            >
              <Lucide.Trash2 size={15} color="#FFF" />
              <Text style={styles.deleteBtnText}>
                {t('common.delete', { defaultValue: 'Delete' })}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Visual Fitting Stage (Avatar + Garments Overlays) ─────────────── */}
        <View style={[styles.stageBox, { backgroundColor: isDark ? '#18181b' : '#f4f4f5' }]}>
          <View style={styles.avatarViewport}>
            <DynamicAvatarSvg
              height={avatarParams.height || 170}
              shoulders={avatarParams.shoulders || 40}
              chest={avatarParams.chest || 90}
              waist={avatarParams.waist || 72}
              hip={avatarParams.hip || 96}
              armLength={avatarParams.armLength || 60}
              inseam={avatarParams.inseam || 78}
              skinColor={avatarParams.skinTone || avatarParams.skinColor || '#C68642'}
              gender={avatarParams.gender || 'male'}
              width={220}
              showGuideLines={false}
            />

            {/* ── Garment Layer Overlays ─────────────────────────────────── */}
            {garmentsMap.headwear?.image_url && visibleLayers.headwear !== false && (
              <View style={styles.garmentHeadwear} pointerEvents="none">
                <Image source={{ uri: garmentsMap.headwear.image_url }} style={styles.garmentImg} resizeMode="contain" />
              </View>
            )}

            {garmentsMap.glasses?.image_url && visibleLayers.glasses !== false && (
              <View style={styles.garmentGlasses} pointerEvents="none">
                <Image source={{ uri: garmentsMap.glasses.image_url }} style={styles.garmentImg} resizeMode="contain" />
              </View>
            )}

            {garmentsMap.dress?.image_url && visibleLayers.dress !== false ? (
              <View style={styles.garmentDress} pointerEvents="none">
                <Image source={{ uri: garmentsMap.dress.image_url }} style={styles.garmentImg} resizeMode="contain" />
              </View>
            ) : (
              <>
                {garmentsMap.top?.image_url && visibleLayers.top !== false && (
                  <View style={styles.garmentTop} pointerEvents="none">
                    <Image source={{ uri: garmentsMap.top.image_url }} style={styles.garmentImg} resizeMode="contain" />
                  </View>
                )}

                {garmentsMap.bottom?.image_url && visibleLayers.bottom !== false && (
                  <View style={styles.garmentBottom} pointerEvents="none">
                    <Image source={{ uri: garmentsMap.bottom.image_url }} style={styles.garmentImg} resizeMode="contain" />
                  </View>
                )}
              </>
            )}

            {garmentsMap.belt?.image_url && visibleLayers.belt !== false && (
              <View style={styles.garmentBelt} pointerEvents="none">
                <Image source={{ uri: garmentsMap.belt.image_url }} style={styles.garmentImg} resizeMode="contain" />
              </View>
            )}

            {garmentsMap.outerwear?.image_url && visibleLayers.outerwear !== false && (
              <View style={styles.garmentOuterwear} pointerEvents="none">
                <Image source={{ uri: garmentsMap.outerwear.image_url }} style={styles.garmentImg} resizeMode="contain" />
              </View>
            )}

            {garmentsMap.shoes?.image_url && visibleLayers.shoes !== false && (
              <View style={styles.garmentShoes} pointerEvents="none">
                <Image source={{ uri: garmentsMap.shoes.image_url }} style={styles.garmentImg} resizeMode="contain" />
              </View>
            )}

            {garmentsMap.accessory?.image_url && visibleLayers.accessory !== false && (
              <View style={styles.garmentAccessory} pointerEvents="none">
                <Image source={{ uri: garmentsMap.accessory.image_url }} style={styles.garmentImg} resizeMode="contain" />
              </View>
            )}

            {garmentsMap.bag?.image_url && visibleLayers.bag !== false && (
              <View style={styles.garmentBag} pointerEvents="none">
                <Image source={{ uri: garmentsMap.bag.image_url }} style={styles.garmentImg} resizeMode="contain" />
              </View>
            )}
          </View>
        </View>

        {/* ── Outfit Title & Edit Pencil ───────────────────────────────────── */}
        <View style={styles.titleRow}>
          <Text style={[styles.outfitNameText, { color: colors.foreground }]}>
            {currentName}
          </Text>
          <TouchableOpacity
            style={styles.pencilBtn}
            onPress={() => {
              setEditNameInput(currentName);
              setIsEditingName(true);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Lucide.Pencil size={18} color={colors.mutedFg} />
          </TouchableOpacity>
        </View>

        {/* ── Harmonious Palette Banner ────────────────────────────────────── */}
        <HarmonyBadge colors={paletteColors} />

        {/* ── Occasion & Date Metadata ─────────────────────────────────────── */}
        <View style={styles.metaCol}>
          <Text style={[styles.occasionLabel, { color: colors.mutedFg }]}>
            {styleOccasion}
          </Text>
          <View style={styles.dateRow}>
            <Lucide.Calendar size={14} color={colors.mutedFg} />
            <Text style={[styles.dateText, { color: colors.mutedFg }]}>
              {formattedDate}
            </Text>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {/* ── Segmented Control: Pieces vs Metrics ─────────────────────────── */}
        <View style={[styles.segmentedWrap, { backgroundColor: colors.secondary }]}>
          <TouchableOpacity
            style={[styles.segmentBtn, subTab === 'pieces' && [styles.segmentBtnActive, { backgroundColor: colors.card }]]}
            onPress={() => setSubTab('pieces')}
            activeOpacity={0.8}
          >
            <Text style={[styles.segmentText, { color: subTab === 'pieces' ? colors.foreground : colors.mutedFg }]}>
              {t('outfits.piecesTab', { defaultValue: 'Pieces' })}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentBtn, subTab === 'metrics' && [styles.segmentBtnActive, { backgroundColor: colors.card }]]}
            onPress={() => setSubTab('metrics')}
            activeOpacity={0.8}
          >
            <Text style={[styles.segmentText, { color: subTab === 'metrics' ? colors.foreground : colors.mutedFg }]}>
              {t('outfits.metricsTab', { defaultValue: `Metrics=${overallGrade}%` })}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── SUBTAB 1: PIECES LIST ────────────────────────────────────────── */}
        {subTab === 'pieces' && (
          <View style={styles.piecesContainer}>
            <Text style={[styles.sectionHeading, { color: colors.foreground }]}>
              {t('stylist.fittingLayers', { defaultValue: 'Outfit Fitting Layers' })}
            </Text>

            <View style={styles.layersList}>
              {garmentList.map((g: TryOnItem, idx: number) => {
                const targetId = g.closet_item_id || g.id;
                const closetItem: any = closetItems.find(
                  (it: any) => it && (it.id === targetId || it._id === targetId || String(it.id) === String(targetId))
                );
                const slot = resolveSlot(g.role, g.category, g.name, closetItem);
                const isVisible = visibleLayers[slot] !== false;

                return (
                  <View
                    key={idx}
                    style={[
                      styles.layerRow,
                      {
                        backgroundColor: colors.secondary,
                        borderColor: isVisible ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    {/* Left: Thumbnail opens ItemDetail */}
                    <TouchableOpacity
                      style={[styles.layerIconBox, { backgroundColor: colors.card }]}
                      onPress={() => handleOpenItemDetail(g)}
                      activeOpacity={0.7}
                    >
                      {g.image_url ? (
                        <Image source={{ uri: g.image_url }} style={styles.layerThumb} resizeMode="contain" />
                      ) : (
                        <Lucide.Shirt size={20} color={colors.mutedFg} />
                      )}
                    </TouchableOpacity>

                    {/* Middle: Title & Subcategory opens ItemDetail */}
                    <TouchableOpacity
                      style={styles.layerInfoCol}
                      onPress={() => handleOpenItemDetail(g)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.layerRole, { color: colors.accent }]}>
                        {t(`taxonomy.categories.${slot}`, { defaultValue: g.role || slot }).toUpperCase()}
                      </Text>
                      <Text style={[styles.layerName, { color: colors.foreground }]} numberOfLines={1}>
                        {g.name}
                      </Text>
                    </TouchableOpacity>

                    {/* Right: Toggle visibility */}
                    <TouchableOpacity
                      style={[styles.layerTogglePill, { backgroundColor: isVisible ? colors.primary : colors.card }]}
                      onPress={() => toggleLayer(slot)}
                      activeOpacity={0.8}
                    >
                      <Lucide.Eye size={13} color={isVisible ? '#FFF' : colors.mutedFg} />
                      <Text style={[styles.layerToggleText, { color: isVisible ? '#FFF' : colors.mutedFg }]}>
                        {isVisible ? t('stylist.fitted', { defaultValue: 'Fitted' }) : t('stylist.hidden', { defaultValue: 'Hidden' })}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* ── SUBTAB 2: METRICS BREAKDOWN ──────────────────────────────────── */}
        {subTab === 'metrics' && (
          <View style={styles.metricsContainer}>
            {/* 3-Column Summary Stats Box */}
            <View style={[styles.statsBox, { backgroundColor: colors.secondary, borderColor: colors.border, flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
              <View style={styles.statCol}>
                <Text style={[styles.statLabel, { color: colors.mutedFg }]}>
                  {t('outfits.style', { defaultValue: 'Style' }).toUpperCase()}
                </Text>
                <Text style={[styles.statVal, { color: colors.foreground }]}>{styleOccasion}</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
              <View style={styles.statCol}>
                <Text style={[styles.statLabel, { color: colors.mutedFg }]}>
                  {t('outfits.timesWorn', { defaultValue: 'Times Worn' }).toUpperCase()}
                </Text>
                <Text style={[styles.statVal, { color: colors.foreground }]}>{timesWorn}</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
              <View style={styles.statCol}>
                <Text style={[styles.statLabel, { color: colors.mutedFg }]}>
                  {t('outfits.totalValue', { defaultValue: 'Total Value' }).toUpperCase()}
                </Text>
                <Text style={[styles.statVal, { color: colors.foreground }]}>${totalValue}</Text>
              </View>
            </View>

            {/* Metric Progress Bars */}
            <View style={styles.metricBarsWrap}>
              <View style={styles.metricItem}>
                <View style={[styles.metricRow, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
                  <Text style={[styles.metricName, { color: colors.foreground }]}>
                    {t('stylist.colorMatching', { defaultValue: 'Color Matching' })}
                  </Text>
                  <Text style={styles.metricPct}>98%</Text>
                </View>
                <View style={[styles.barTrack, { backgroundColor: isDark ? '#27272a' : '#e4e4e7' }]}>
                  <View style={[styles.barFill, { width: '98%' }]} />
                </View>
              </View>

              <View style={styles.metricItem}>
                <View style={[styles.metricRow, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
                  <Text style={[styles.metricName, { color: colors.foreground }]}>
                    {t('stylist.patternMatching', { defaultValue: 'Pattern Matching' })}
                  </Text>
                  <Text style={styles.metricPct}>95%</Text>
                </View>
                <View style={[styles.barTrack, { backgroundColor: isDark ? '#27272a' : '#e4e4e7' }]}>
                  <View style={[styles.barFill, { width: '95%' }]} />
                </View>
              </View>

              <View style={styles.metricItem}>
                <View style={[styles.metricRow, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
                  <Text style={[styles.metricName, { color: colors.foreground }]}>
                    {t('stylist.bodyFitting', { defaultValue: 'Body Fitting' })}
                  </Text>
                  <Text style={styles.metricPct}>85%</Text>
                </View>
                <View style={[styles.barTrack, { backgroundColor: isDark ? '#27272a' : '#e4e4e7' }]}>
                  <View style={[styles.barFill, { width: '85%' }]} />
                </View>
              </View>

              <View style={styles.metricItem}>
                <View style={[styles.metricRow, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
                  <Text style={[styles.metricName, { color: colors.foreground }]}>
                    {t('stylist.weatherSuitability', { defaultValue: 'Weather Suitability' })}
                  </Text>
                  <Text style={styles.metricPct}>90%</Text>
                </View>
                <View style={[styles.barTrack, { backgroundColor: isDark ? '#27272a' : '#e4e4e7' }]}>
                  <View style={[styles.barFill, { width: '90%' }]} />
                </View>
              </View>

              <View style={styles.metricItem}>
                <View style={[styles.metricRow, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
                  <Text style={[styles.metricName, { color: colors.foreground }]}>
                    {t('stylist.occasionAlignment', { defaultValue: 'Occasion Alignment' })}
                  </Text>
                  <Text style={styles.metricPct}>92%</Text>
                </View>
                <View style={[styles.barTrack, { backgroundColor: isDark ? '#27272a' : '#e4e4e7' }]}>
                  <View style={[styles.barFill, { width: '92%' }]} />
                </View>
              </View>
            </View>
          </View>
        )}

      </View>

      {/* ── Edit Name Modal ────────────────────────────────────────────────── */}
      <Modal visible={isEditingName} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              {t('outfits.editName', { defaultValue: 'Edit Outfit Name' })}
            </Text>
            <TextInput
              style={[styles.modalInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              value={editNameInput}
              onChangeText={setEditNameInput}
              placeholder={t('outfits.namePlaceholder', { defaultValue: 'Outfit name' })}
              placeholderTextColor={colors.mutedFg}
              autoFocus
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.secondary }]}
                onPress={() => setIsEditingName(false)}
              >
                <Text style={[styles.modalBtnText, { color: colors.foreground }]}>
                  {t('common.cancel', { defaultValue: 'Cancel' })}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.primary }]}
                onPress={handleSaveRename}
              >
                <Text style={[styles.modalBtnText, { color: '#FFF' }]}>
                  {t('common.save', { defaultValue: 'Save' })}
                </Text>
              </TouchableOpacity>
            </View>
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
  mainCard: {
    borderRadius: radii['2xl'],
    padding: spacing.lg,
    borderWidth: 1,
    gap: spacing.md,
    ...shadows.sm,
  },
  topActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  actionBtnText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.xs,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.full,
  },
  deleteBtnText: {
    color: '#FFF',
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.xs,
  },
  stageBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    borderRadius: radii['2xl'],
    marginVertical: spacing.sm,
    direction: 'ltr',
  },
  avatarViewport: {
    width: 240,
    height: 450,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    direction: 'ltr',
  },
  garmentImg: {
    width: '100%',
    height: '100%',
  },
  garmentHeadwear: {
    position: 'absolute',
    top: 5,
    left: 80,
    width: 80,
    height: 80,
    zIndex: 30,
    direction: 'ltr',
  },
  garmentGlasses: {
    position: 'absolute',
    top: 48,
    left: 96,
    width: 48,
    height: 22,
    zIndex: 28,
    direction: 'ltr',
  },
  garmentDress: {
    position: 'absolute',
    top: 68,
    left: 20,
    width: 200,
    height: 260,
    zIndex: 20,
    direction: 'ltr',
  },
  garmentTop: {
    position: 'absolute',
    top: 66,
    left: 25,
    width: 190,
    height: 160,
    zIndex: 20,
    direction: 'ltr',
  },
  garmentBottom: {
    position: 'absolute',
    top: 170,
    left: 45,
    width: 150,
    height: 180,
    zIndex: 10,
    direction: 'ltr',
  },
  garmentBelt: {
    position: 'absolute',
    top: 168,
    left: 60,
    width: 120,
    height: 24,
    zIndex: 21,
    direction: 'ltr',
  },
  garmentOuterwear: {
    position: 'absolute',
    top: 64,
    left: 15,
    width: 210,
    height: 180,
    zIndex: 22,
    direction: 'ltr',
  },
  garmentShoes: {
    position: 'absolute',
    bottom: 2,
    left: 35,
    width: 170,
    height: 75,
    zIndex: 15,
    direction: 'ltr',
  },
  garmentAccessory: {
    position: 'absolute',
    top: 68,
    left: 85,
    width: 70,
    height: 70,
    zIndex: 25,
    direction: 'ltr',
  },
  garmentBag: {
    position: 'absolute',
    top: 175,
    left: 145,
    width: 85,
    height: 95,
    zIndex: 25,
    direction: 'ltr',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  outfitNameText: {
    fontFamily: fonts.displayBold,
    fontSize: fontSizes['2xl'],
    letterSpacing: -0.5,
  },
  pencilBtn: {
    padding: spacing.xs,
  },
  metaCol: {
    gap: 4,
  },
  occasionLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
  },
  divider: {
    height: 1,
    width: '100%',
    marginVertical: spacing.xs,
  },
  segmentedWrap: {
    flexDirection: 'row',
    borderRadius: radii.full,
    padding: 3,
    maxWidth: 260,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: spacing.xs + 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.full,
  },
  segmentBtnActive: {
    ...shadows.sm,
  },
  segmentText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
  },
  piecesContainer: {
    gap: spacing.sm,
  },
  sectionHeading: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  layersList: {
    gap: spacing.sm,
  },
  layerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.sm,
  },
  layerIconBox: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  layerThumb: {
    width: '100%',
    height: '100%',
  },
  layerInfoCol: {
    flex: 1,
    gap: 2,
  },
  layerRole: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  layerName: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
  },
  layerTogglePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  layerToggleText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.xs,
  },
  metricsContainer: {
    gap: spacing.md,
  },
  statsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: radii.xl,
    borderWidth: 1,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  statVal: {
    fontFamily: fonts.displayBold,
    fontSize: fontSizes.sm,
  },
  statDivider: {
    width: 1,
    height: 28,
  },
  metricBarsWrap: {
    gap: spacing.sm,
  },
  metricItem: {
    gap: 4,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricName: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.xs,
  },
  metricPct: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
    color: '#10b981',
  },
  barTrack: {
    height: 8,
    borderRadius: radii.full,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: '#10b981',
    borderRadius: radii.full,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    width: '100%',
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    gap: spacing.md,
    ...shadows.lg,
  },
  modalTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.base,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  modalBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
  },
  modalBtnText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.sm,
  },
});
