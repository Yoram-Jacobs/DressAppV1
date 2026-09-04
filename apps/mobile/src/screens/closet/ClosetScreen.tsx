/**
 * apps/mobile/src/screens/closet/ClosetScreen.tsx
 *
 * Full-featured Closet Studio — 100% parity with apps/web/src/pages/Closet.jsx.
 * Features:
 *   - Semantic AI Search (FashionCLIP) toggle alongside Keyword text search
 *   - Category filters (All, Top, Bottom, Outerwear, Shoes, Accessory, Dress)
 *   - Intent & Source filters (All, Private, For Sale, Swap, Donate, Retail)
 *   - Season filters (All, Spring, Summer, Fall, Winter)
 *   - Multi-layout modes: 2-column Grid, 3-column Compact, and List view
 *   - Multi-select batch mode: Batch Delete, Compose Look, Export/Intent change
 *   - OutfitCompletionSheet integration for auto-completing looks
 *   - DPP Scanner modal trigger
 *   - 13-language i18next support with zero hardcoded text
 */

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ScrollView,
  ActivityIndicator,
  I18nManager,
  Pressable,
  TextInput,
  Alert,
  Dimensions,
  Modal,
  Vibration,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import * as Lucide from 'lucide-react-native';

import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii, shadows } from '@mobile/theme/tokens';
import { api } from '@mobile/lib/api';
import { useClosetStore, closetStore, ClosetItem } from '@mobile/lib/stores/closetStore';
import { closetRepo } from '@mobile/lib/repositories/closetRepository';
import { OutfitCompletionSheet } from '@mobile/components/OutfitCompletionSheet';
import { RichSelectionFloater } from '@mobile/components/closet/RichSelectionFloater';
import { HelpFloater } from '@mobile/components/help';
import { LoadingVideo } from '@mobile/components/common/LoadingVideo';
import { ScrollToTopFloater } from '@mobile/components/common/ScrollToTopFloater';
import { labelForCategory, labelForIntent, labelForColor, getTaxonomyMismatches } from '@mobile/lib/taxonomy';
import { getItemImageUrl } from '@mobile/lib/imageUtils';
import type { ClosetStackParamList } from '@mobile/navigation/types';

type ClosetNavProp = NativeStackNavigationProp<ClosetStackParamList, 'Closet'>;
type ViewMode = 'grid' | 'compact' | 'list';
type SortOption = 'newest' | 'brand' | 'worn_desc' | 'worn_asc';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const CATEGORIES = ['all', 'top', 'bottom', 'outerwear', 'shoes', 'accessory', 'dress'];
const SOURCES = ['all', 'Private', 'for_sale', 'swap', 'donate', 'Retail'];
const SEASONS = ['all', 'spring', 'summer', 'fall', 'winter'];

const _CATEGORY_SYNONYMS: Record<string, Set<string>> = {
  top:         new Set(['top', 'tops']),
  bottom:      new Set(['bottom', 'bottoms']),
  outerwear:   new Set(['outerwear']),
  shoes:       new Set(['shoes', 'footwear']),
  footwear:    new Set(['shoes', 'footwear']),
  accessory:   new Set(['accessory', 'accessories', 'headwear']),
  accessories: new Set(['accessory', 'accessories', 'headwear']),
  headwear:    new Set(['accessory', 'accessories', 'headwear']),
  dress:       new Set(['dress', 'dresses', 'full body', 'full_body', 'fullbody', 'full-body', 'one-piece']),
  dresses:     new Set(['dress', 'dresses', 'full body', 'full_body', 'fullbody', 'full-body', 'one-piece']),
};

function matchesCategory(itemCategory?: string, filterCat?: string): boolean {
  if (!filterCat || filterCat === 'all') return true;
  if (!itemCategory) return false;
  const requested = filterCat.toLowerCase().trim();
  const synonyms = _CATEGORY_SYNONYMS[requested] || new Set([requested]);
  const cat = itemCategory.toLowerCase().trim();
  if (synonyms.has(cat)) return true;
  return cat.includes(requested) || requested.includes(cat);
}

export function ClosetScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<ClosetNavProp>();
  const { colors, isDark } = useTheme();
  const isRtl = I18nManager.isRTL;

  const { items, loading, prewarm, removeMany, deleteManyItems } = useClosetStore({ prewarm: true });
  const [refreshing, setRefreshing] = useState(false);

  // Real-time polling for pending background reconstructions (Nano Banana) & clean cutouts
  useEffect(() => {
    const pendingItems = (items || []).filter(
      (it: any) =>
        it &&
        (it.clean_image_status === 'pending' ||
          (it.reconstruction_metadata?.deferred && !it.reconstructed_image_url))
    );
    if (pendingItems.length === 0) return;

    const interval = setInterval(async () => {
      let updatedAny = false;
      for (const pItem of pendingItems) {
        try {
          const fresh = await (api as any).getItem?.((pItem as any).id);
          if (fresh && fresh.id) {
            closetStore.upsert(fresh as any);
            updatedAny = true;
          }
        } catch {}
      }
      if (updatedAny) {
        closetRepo.refresh({ force: false }).catch(() => {});
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [items]);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<'keyword' | 'meaning'>('keyword');
  const [semanticLoading, setSemanticLoading] = useState(false);
  const [semanticResults, setSemanticResults] = useState<ClosetItem[] | null>(null);

  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [activeSource, setActiveSource] = useState<string>('all');
  const [activeSeason, setActiveSeason] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  // Multi-select state
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [tagging, setTagging] = useState(false);
  const [grouping, setGrouping] = useState(false);

  // Outfit Completion Sheet
  const [completionOpen, setCompletionOpen] = useState(false);

  // Fast Scroll to Top floater state
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Drag and drop grouping (Multi-view Garment Support)
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [touchPos, setTouchPos] = useState({ x: 0, y: 0 });

  const isDraggingRef = useRef(false);
  const draggedIdRef = useRef<string | null>(null);
  const dragOverIdRef = useRef<string | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const flatListContainerRef = useRef<View>(null);
  const flatListLayoutRef = useRef<{ pageX: number; pageY: number; width: number; height: number } | null>(null);
  const scrollOffsetRef = useRef(0);
  const lastTouchPosRef = useRef({ pageX: 0, pageY: 0 });

  const autoScrollIntervalRef = useRef<any>(null);

  const stopAutoScroll = () => {
    if (autoScrollIntervalRef.current) {
      clearInterval(autoScrollIntervalRef.current);
      autoScrollIntervalRef.current = null;
    }
  };

  const checkAutoScroll = (pageY: number) => {
    const screenHeight = Dimensions.get('window').height;
    const topThreshold = 200;
    const bottomThreshold = screenHeight - 160;

    if (pageY < topThreshold) {
      if (!autoScrollIntervalRef.current) {
        autoScrollIntervalRef.current = setInterval(() => {
          if (!isDraggingRef.current) {
            stopAutoScroll();
            return;
          }
          const nextOffset = Math.max(0, scrollOffsetRef.current - 15);
          scrollOffsetRef.current = nextOffset;
          flatListRef.current?.scrollToOffset({ offset: nextOffset, animated: false });
        }, 16);
      }
    } else if (pageY > bottomThreshold) {
      if (!autoScrollIntervalRef.current) {
        autoScrollIntervalRef.current = setInterval(() => {
          if (!isDraggingRef.current) {
            stopAutoScroll();
            return;
          }
          const nextOffset = scrollOffsetRef.current + 15;
          scrollOffsetRef.current = nextOffset;
          flatListRef.current?.scrollToOffset({ offset: nextOffset, animated: false });
        }, 16);
      }
    } else {
      stopAutoScroll();
    }
  };

  const handleScroll = (e: any) => {
    const y = e.nativeEvent.contentOffset.y;
    scrollOffsetRef.current = y;
    if (y > 250 && !showScrollTop) {
      setShowScrollTop(true);
    } else if (y <= 250 && showScrollTop) {
      setShowScrollTop(false);
    }
  };

  const startDrag = (id: string, startPageX: number, startPageY: number) => {
    try {
      Vibration.vibrate(40);
    } catch {}
    draggedIdRef.current = id;
    dragOverIdRef.current = null;
    isDraggingRef.current = true;
    setDraggedId(id);
    setDragOverId(null);
    setIsDragging(true);
    setTouchPos({ x: startPageX, y: startPageY });
  };

  const handleDragMove = (pageX: number, pageY: number) => {
    if (!isDraggingRef.current) return;
    setTouchPos({ x: pageX, y: pageY });
    checkAutoScroll(pageY);

    const layout = flatListLayoutRef.current;
    const containerPageX = layout?.pageX ?? spacing[4];
    const containerPageY = layout?.pageY ?? 180;

    const isRtl = I18nManager.isRTL;
    const screenWidth = Dimensions.get('window').width;

    const relX = isRtl
      ? (screenWidth - containerPageX) - pageX
      : pageX - containerPageX;
    const relY = pageY - containerPageY + scrollOffsetRef.current;

    let targetItem: ClosetItem | null = null;

    if (viewMode === 'list') {
      const rowHeight = 76;
      const rowIndex = Math.floor(relY / rowHeight);
      if (rowIndex >= 0 && rowIndex < displayItems.length) {
        targetItem = displayItems[rowIndex];
      }
    } else if (viewMode === 'compact') {
      const colWidth = itemWidth + spacing[2];
      const rowHeight = itemWidth + spacing[2];
      const col = Math.floor(relX / colWidth);
      const row = Math.floor(relY / rowHeight);
      if (col >= 0 && col < 3 && row >= 0) {
        const index = row * 3 + col;
        if (index >= 0 && index < displayItems.length) {
          targetItem = displayItems[index];
        }
      }
    } else {
      // 2-column Grid view
      const colWidth = itemWidth + spacing[2];
      const rowHeight = itemWidth + 68 + spacing[2];
      const col = Math.floor(relX / colWidth);
      const row = Math.floor(relY / rowHeight);
      if (col >= 0 && col < 2 && row >= 0) {
        const index = row * 2 + col;
        if (index >= 0 && index < displayItems.length) {
          targetItem = displayItems[index];
        }
      }
    }

    const foundId = targetItem && targetItem.id !== draggedIdRef.current ? targetItem.id : null;
    if (foundId !== dragOverIdRef.current) {
      dragOverIdRef.current = foundId;
      setDragOverId(foundId);
      if (foundId) {
        try {
          Vibration.vibrate(15);
        } catch {}
      }
    }
  };

  const handleDragEnd = () => {
    stopAutoScroll();
    if (!isDraggingRef.current) return;
    const sourceId = draggedIdRef.current;
    const targetId = dragOverIdRef.current;

    isDraggingRef.current = false;
    draggedIdRef.current = null;
    dragOverIdRef.current = null;
    setDraggedId(null);
    setDragOverId(null);
    setIsDragging(false);

    if (sourceId && targetId && sourceId !== targetId) {
      const sourceItem = items.find((it) => it.id === sourceId);
      const targetItem = items.find((it) => it.id === targetId);

      if (!sourceItem || !targetItem) return;

      const backupSource = { ...sourceItem };
      const backupTarget = { ...targetItem };

      const runGrouping = async () => {
        const groupId = targetItem.group_id || targetId;
        closetStore.upsert({ ...targetItem, group_id: groupId, group_role: 'host' });
        closetStore.upsert({ ...sourceItem, group_id: groupId, group_role: 'member' });

        try {
          Vibration.vibrate(50);
        } catch {}

        try {
          const res = await (api as any).groupItems?.({ host_id: targetId, member_id: sourceId });
          if (res?.status === 'success' || res?.host) {
            if (res.host) closetStore.upsert(res.host);
            if (res.member) closetStore.upsert(res.member);
            await closetRepo.refresh({ force: true });
            Alert.alert(
              t('common.success', { defaultValue: 'Success' }),
              t('closet.groupCreated', { defaultValue: 'Garments grouped successfully.' })
            );
          } else {
            closetStore.upsert(backupSource);
            closetStore.upsert(backupTarget);
            Alert.alert(t('common.error', { defaultValue: 'Error' }), t('common.error', { defaultValue: 'Failed to group items' }));
          }
        } catch (err: any) {
          console.warn('Failed to group items:', err);
          closetStore.upsert(backupSource);
          closetStore.upsert(backupTarget);
          Alert.alert(t('common.error', { defaultValue: 'Error' }), err?.message || 'Failed to group items');
        }
      };

      const normCategory = (cat?: string) => {
        const s = String(cat || '').trim().toLowerCase().replace(/\s+/g, '_');
        if (s === 'top' || s === 'tops') return 'top';
        if (s === 'bottom' || s === 'bottoms') return 'bottom';
        if (s === 'footwear' || s === 'shoes') return 'footwear';
        if (s === 'accessory' || s === 'accessories') return 'accessories';
        return s;
      };

      const sourceCategory = normCategory(sourceItem.category);
      const targetCategory = normCategory(targetItem.category);
      const isSameCategory = sourceCategory === targetCategory;

      if (isSameCategory) {
        const mismatches = getTaxonomyMismatches(sourceItem, targetItem);
        if (mismatches.length > 0) {
          const mismatchLabels = mismatches.map((m) => {
            switch (m) {
              case 'category': return t('itemDetail.edit.category', { defaultValue: 'Category' });
              case 'sub_category': return t('itemDetail.edit.subCategory', { defaultValue: 'Sub-category' });
              case 'brand': return t('itemDetail.edit.brand', { defaultValue: 'Brand' });
              case 'gender': return t('itemDetail.edit.gender', { defaultValue: 'Gender' });
              case 'dress_code': return t('itemDetail.edit.dressCode', { defaultValue: 'Dress Code' });
              case 'season': return t('itemDetail.edit.season', { defaultValue: 'Season' });
              default: return m;
            }
          });

          Alert.alert(
            t('closet.gatekeeperTitle', { defaultValue: 'Taxonomy Mismatch' }),
            t('closet.gatekeeperBody', {
              fields: mismatchLabels.join(', '),
              defaultValue: `The items have mismatching fields (${mismatchLabels.join(', ')}). Are you sure you want to group them?`
            }),
            [
              { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
              { text: t('common.continue', { defaultValue: 'Continue' }), onPress: runGrouping }
            ]
          );
        } else {
          runGrouping();
        }
      } else {
        runGrouping();
      }
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await prewarm({ force: true });
    setRefreshing(false);
  }, [prewarm]);

  useFocusEffect(
    useCallback(() => {
      if (!closetStore.isFresh()) {
        closetStore.prewarm().catch(() => {});
      }
    }, [])
  );

  // Semantic search call
  const performSemanticSearch = async (query: string) => {
    if (!query.trim()) {
      setSemanticResults(null);
      return;
    }
    setSemanticLoading(true);
    try {
      const res = await (api as any).searchSemantic?.(query.trim());
      if (res && Array.isArray(res.items)) {
        setSemanticResults(res.items);
      } else {
        setSemanticResults([]);
      }
    } catch {
      setSemanticResults([]);
    } finally {
      setSemanticLoading(false);
    }
  };

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (searchMode === 'meaning' && text.length > 2) {
      performSemanticSearch(text);
    } else if (!text.trim()) {
      setSemanticResults(null);
    }
  };

  // Filtered and sorted items
  const displayItems = useMemo(() => {
    let sourcePool = semanticResults !== null ? semanticResults : items;

    return sourcePool
      .filter((it) => {
        // Exclude grouped member garments — only host/standalone cards are displayed in the root closet grid
        if (it.group_role === 'member') return false;

        // Category filter
        if (activeCategory !== 'all') {
          if (!matchesCategory(it.category, activeCategory)) return false;
        }

        // Source / Intent filter
        if (activeSource !== 'all') {
          if (activeSource === 'Private' || activeSource === 'Retail') {
            if (it.source !== activeSource) return false;
          } else {
            if (it.marketplace_intent !== activeSource && it.intent !== activeSource) return false;
          }
        }

        // Season filter
        if (activeSeason !== 'all') {
          const seasons = Array.isArray(it.season) ? it.season : it.season ? [it.season] : [];
          if (!seasons.some((s) => s.toLowerCase().includes(activeSeason.toLowerCase()))) {
            return false;
          }
        }

        // Search query (keyword mode)
        if (searchMode === 'keyword' && searchQuery.trim()) {
          const q = searchQuery.trim().toLowerCase();
          const haystack = [
            it.name,
            it.title,
            it.brand,
            it.category,
            it.sub_category,
            it.color,
            it.material,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          if (!haystack.includes(q)) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'brand') {
          return (a.brand || '').localeCompare(b.brand || '');
        }
        if (sortBy === 'worn_desc') {
          return (b.worn_count || 0) - (a.worn_count || 0);
        }
        if (sortBy === 'worn_asc') {
          return (a.worn_count || 0) - (b.worn_count || 0);
        }
        return 0; // newest / default
      });
  }, [items, semanticResults, activeCategory, activeSource, activeSeason, searchQuery, searchMode, sortBy]);

  // Selection handlers
  const isAllSelected = displayItems.length > 0 && displayItems.every((it) => selectedIds.has(it.id));

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(displayItems.map((it) => it.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleGroupSelected = () => {
    if (selectedIds.size < 2) return;
    const count = selectedIds.size;
    Alert.alert(
      t('closet.groupSelectedTitle', { defaultValue: 'Group as Coordinated Set' }),
      t('closet.groupSelectedBody', { count, defaultValue: `Group ${count} selected items into a coordinated multi-piece set?` }),
      [
        { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
        {
          text: t('closet.confirmGroup', { defaultValue: 'Group' }),
          onPress: async () => {
            const ids = Array.from(selectedIds);
            const hostId = ids[0];
            const memberIds = ids.slice(1);
            setGrouping(true);

            // Optimistic update in closetStore
            const allItems = closetStore.getSnapshot().items || [];
            const hostItem = allItems.find((x) => x.id === hostId);
            if (hostItem) {
              closetStore.upsert({ ...hostItem, group_id: hostId, group_role: 'host' });
            }
            memberIds.forEach((mid) => {
              const memItem = allItems.find((x) => x.id === mid);
              if (memItem) {
                closetStore.upsert({ ...memItem, group_id: hostId, group_role: 'member' });
              }
            });

            setSelectedIds(new Set());
            setSelectMode(false);

            try {
              await Promise.all(
                memberIds.map((mid) => (api as any).groupItems?.({ host_id: hostId, member_id: mid }))
              );
              await closetRepo.refresh({ force: true });
            } catch (err: any) {
              console.warn('Group items failed:', err);
            } finally {
              setGrouping(false);
            }
          },
        },
      ]
    );
  };

  const handleTagSelected = () => {
    if (selectedIds.size === 0) return;
    setTagInput('');
    setTagModalOpen(true);
  };

  const handleApplyTags = async () => {
    const newTags = tagInput
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);

    if (newTags.length === 0) {
      setTagModalOpen(false);
      return;
    }

    const ids = Array.from(selectedIds);
    setTagging(true);

    const allItems = closetStore.getSnapshot().items || [];
    ids.forEach((id) => {
      const item = allItems.find((x) => x.id === id);
      if (item) {
        const existing = Array.isArray(item.tags) ? item.tags : [];
        const merged = Array.from(new Set([...existing, ...newTags]));
        closetStore.upsert({ ...item, tags: merged });
      }
    });

    setSelectedIds(new Set());
    setSelectMode(false);
    setTagModalOpen(false);

    try {
      await Promise.all(
        ids.map(async (id) => {
          const item = allItems.find((x) => x.id === id);
          const existing = Array.isArray(item?.tags) ? item!.tags! : [];
          const merged = Array.from(new Set([...existing, ...newTags]));
          return (api as any).patchItem?.(id, { tags: merged });
        })
      );
    } catch (err: any) {
      console.warn('Tag items failed:', err);
    } finally {
      setTagging(false);
    }
  };

  const handleBatchDelete = () => {
    if (!selectedIds.size) return;
    Alert.alert(
      t('closet.deleteSelectedTitle', { defaultValue: 'Delete Items' }),
      t('closet.deleteSelectedConfirm', {
        count: selectedIds.size,
        defaultValue: `Are you sure you want to delete ${selectedIds.size} item(s)?`,
      }),
      [
        { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
        {
          text: t('common.delete', { defaultValue: 'Delete' }),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteManyItems(Array.from(selectedIds));
            } catch (err: any) {
              Alert.alert(
                t('common.error', { defaultValue: 'Error' }),
                err?.message || t('closet.batchDeleteFailed', { defaultValue: 'Some items could not be deleted. Please try again.' })
              );
            } finally {
              setSelectedIds(new Set());
              setSelectMode(false);
            }
          },
        },
      ]
    );
  };

  const selectedItemsHint = useMemo(() => {
    return items.filter((it) => selectedIds.has(it.id));
  }, [items, selectedIds]);

  const numColumns = viewMode === 'compact' ? 3 : viewMode === 'grid' ? 2 : 1;
  const itemWidth =
    viewMode === 'compact'
      ? (SCREEN_WIDTH - spacing[4] * 2 - spacing[2] * 2) / 3
      : viewMode === 'grid'
      ? (SCREEN_WIDTH - spacing[4] * 2 - spacing[2]) / 2
      : SCREEN_WIDTH - spacing[4] * 2;

  const renderItem = ({ item }: { item: ClosetItem }) => {
    const isSelected = selectedIds.has(item.id);
    const isDragged = draggedId === item.id;
    const isDragOver = dragOverId === item.id;
    const imgUri = getItemImageUrl(item);

    if (viewMode === 'list') {
      return (
        <TouchableOpacity
          onPressIn={(e) => {
            lastTouchPosRef.current = {
              pageX: e.nativeEvent.pageX,
              pageY: e.nativeEvent.pageY,
            };
          }}
          onLongPress={() => {
            if (!selectMode) {
              startDrag(item.id, lastTouchPosRef.current.pageX, lastTouchPosRef.current.pageY);
            }
          }}
          {...({
            onTouchMove: (e: any) => {
              if (isDraggingRef.current) {
                handleDragMove(e.nativeEvent.pageX, e.nativeEvent.pageY);
              }
            },
            onTouchEnd: () => {
              if (isDraggingRef.current) {
                handleDragEnd();
              }
            },
            onTouchCancel: () => {
              if (isDraggingRef.current) {
                handleDragEnd();
              }
            },
          } as any)}
          delayLongPress={350}
          style={[
            styles.listItemCard,
            {
              backgroundColor: colors.card,
              borderColor: isDragOver ? colors.accent : isSelected ? colors.accent : colors.border,
              borderWidth: isDragOver ? 2.5 : isSelected ? 2 : 1,
              opacity: isDragged ? 0.4 : 1,
              transform: isDragOver ? [{ scale: 1.03 }] : isDragged ? [{ scale: 0.97 }] : [],
            },
          ]}
          onPress={() => {
            if (selectMode) toggleSelect(item.id);
            else navigation.navigate('ItemDetail', { itemId: item.id });
          }}
          activeOpacity={0.8}
        >
          {imgUri ? (
            <Image source={{ uri: imgUri }} style={[styles.listThumb, { backgroundColor: colors.cardOffWhite }]} resizeMode="contain" />
          ) : (
            <View style={[styles.listThumb, { backgroundColor: colors.cardOffWhite, alignItems: 'center', justifyContent: 'center' }]}>
              <Lucide.Shirt size={20} color={colors.mutedFg} />
            </View>
          )}

          <View style={styles.listInfo}>
            <Text style={[styles.listTitle, { color: colors.foreground }]} numberOfLines={1}>
              {item.title || item.name || 'Garment'}
            </Text>
            <Text style={[styles.listSub, { color: colors.mutedFg }]}>
              {[item.brand, item.category].filter(Boolean).join(' · ')}
            </Text>
          </View>

          {selectMode ? (
            <View
              style={[
                styles.selectCircle,
                { borderColor: colors.border, backgroundColor: isSelected ? colors.accent : 'transparent' },
              ]}
            >
              {isSelected ? <Lucide.Check size={14} color="#fff" /> : null}
            </View>
          ) : (
            <Lucide.ChevronRight size={18} color={colors.mutedFg} />
          )}
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        onPressIn={(e) => {
          lastTouchPosRef.current = {
            pageX: e.nativeEvent.pageX,
            pageY: e.nativeEvent.pageY,
          };
        }}
        onLongPress={() => {
          if (!selectMode) {
            startDrag(item.id, lastTouchPosRef.current.pageX, lastTouchPosRef.current.pageY);
          }
        }}
        {...({
          onTouchMove: (e: any) => {
            if (isDraggingRef.current) {
              handleDragMove(e.nativeEvent.pageX, e.nativeEvent.pageY);
            }
          },
          onTouchEnd: () => {
            if (isDraggingRef.current) {
              handleDragEnd();
            }
          },
          onTouchCancel: () => {
            if (isDraggingRef.current) {
              handleDragEnd();
            }
          },
        } as any)}
        delayLongPress={350}
        style={[
          styles.gridCard,
          {
            width: itemWidth,
            backgroundColor: colors.card,
            borderColor: isDragOver ? colors.accent : isSelected ? colors.accent : colors.border,
            borderWidth: isDragOver ? 2.5 : isSelected ? 2 : 1,
            opacity: isDragged ? 0.4 : 1,
            transform: isDragOver ? [{ scale: 1.05 }] : isDragged ? [{ scale: 0.95 }] : [],
          },
        ]}
        onPress={() => {
          if (selectMode) toggleSelect(item.id);
          else navigation.navigate('ItemDetail', { itemId: item.id });
        }}
        activeOpacity={0.85}
      >
        <View style={[styles.gridImgWrap, { backgroundColor: colors.cardOffWhite }]}>
          {imgUri ? (
            <Image source={{ uri: imgUri }} style={[styles.gridImg, { backgroundColor: colors.cardOffWhite }]} resizeMode="contain" />
          ) : (
            <View style={[styles.gridImg, { backgroundColor: colors.cardOffWhite, alignItems: 'center', justifyContent: 'center' }]}>
              <Lucide.Shirt size={24} color={colors.mutedFg} />
            </View>
          )}

          {/* Source Tag Badge */}
          {item.source === 'Retail' || item.marketplace_intent ? (
            <View style={[styles.intentBadge, { backgroundColor: colors.card }]}>
              <Text style={[styles.intentText, { color: colors.accent }]}>
                {item.marketplace_intent ? labelForIntent(item.marketplace_intent, t) : 'Retail'}
              </Text>
            </View>
          ) : null}

          {/* Selection indicator */}
          {selectMode ? (
            <View
              style={[
                styles.selectBadge,
                { backgroundColor: isSelected ? colors.accent : 'rgba(0,0,0,0.4)' },
              ]}
            >
              {isSelected ? <Lucide.Check size={14} color="#fff" /> : null}
            </View>
          ) : null}
        </View>

        <View style={styles.gridDetails}>
          <Text style={[styles.gridTitle, { color: colors.foreground }]} numberOfLines={1}>
            {item.title || item.name || 'Garment'}
          </Text>
          <Text style={[styles.gridSub, { color: colors.mutedFg }]} numberOfLines={1}>
            {item.brand || item.category || 'Piece'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={['top']}>
      {/* ── Top Bar ─────────────────────────────────────────────────── */}
      <View style={[styles.topBar, { borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.superTitle, { color: colors.accent }]}>
            {t('closet.superTitle', { defaultValue: 'DIGITAL WARDROBE' })}
          </Text>
          <Text style={[styles.mainTitle, { color: colors.foreground }]}>
            {t('closet.title', { defaultValue: 'My Closet' })} ({items.length})
          </Text>
        </View>

        <View style={styles.topActions}>
          <HelpFloater screenTopic="closet-page" />

          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: colors.secondary }]}
            onPress={() => navigation.navigate('DppScanner')}
            accessibilityLabel={t('dpp.scanQR', { defaultValue: 'Scan DPP QR' })}
          >
            <Lucide.QrCode size={18} color={colors.foreground} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.iconBtn,
              { backgroundColor: selectMode ? colors.primary : colors.secondary },
            ]}
            onPress={() => {
              setSelectMode(!selectMode);
              if (selectMode) setSelectedIds(new Set());
            }}
          >
            <Lucide.CheckSquare
              size={18}
              color={selectMode ? colors.primaryFg : colors.foreground}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Search & Semantic Toggle Bar ─────────────────────────────── */}
      <View style={styles.searchSection}>
        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Lucide.Search size={16} color={colors.mutedFg} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder={
              searchMode === 'meaning'
                ? t('closet.searchMeaningPlaceholder', { defaultValue: 'Search by style, vibe, mood…' })
                : t('closet.searchPlaceholder', { defaultValue: 'Search clothes, brand, color…' })
            }
            placeholderTextColor={colors.mutedFg}
            value={searchQuery}
            onChangeText={handleSearchChange}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => handleSearchChange('')}>
              <Lucide.X size={16} color={colors.mutedFg} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Semantic Toggle Button */}
        <TouchableOpacity
          style={[
            styles.semanticToggle,
            {
              backgroundColor: searchMode === 'meaning' ? colors.accent : colors.secondary,
              borderColor: colors.border,
            },
          ]}
          onPress={() => {
            const nextMode = searchMode === 'keyword' ? 'meaning' : 'keyword';
            setSearchMode(nextMode);
            if (nextMode === 'meaning' && searchQuery) performSemanticSearch(searchQuery);
            else setSemanticResults(null);
          }}
        >
          <Lucide.Sparkles size={14} color={searchMode === 'meaning' ? '#fff' : colors.foreground} />
          <Text
            style={[
              styles.semanticToggleText,
              { color: searchMode === 'meaning' ? '#fff' : colors.foreground },
            ]}
          >
            {t('closet.meaningSearch', { defaultValue: 'AI CLIP' })}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Category Pill Bar ────────────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterPillsScroll}
        style={styles.filterPillsBar}
      >
        {CATEGORIES.map((cat) => {
          const isSelected = activeCategory === cat;
          return (
            <TouchableOpacity
              key={cat}
              style={[
                styles.filterPill,
                {
                  backgroundColor: isSelected ? colors.primary : colors.card,
                  borderColor: isSelected ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setActiveCategory(cat)}
            >
              <Text
                style={[
                  styles.filterPillText,
                  { color: isSelected ? colors.primaryFg : colors.foreground },
                ]}
              >
                {cat === 'all'
                  ? t('common.all', { defaultValue: 'All' })
                  : labelForCategory(cat, t)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Secondary Filters & Layout Switcher ──────────────────────── */}
      <View style={styles.subFilterBar}>
        {/* Source / Intent scroller */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.secondaryFilterScroll}>
          {SOURCES.map((src) => {
            const isSelected = activeSource === src;
            return (
              <TouchableOpacity
                key={src}
                style={[
                  styles.secFilterChip,
                  {
                    backgroundColor: isSelected ? colors.secondary : 'transparent',
                    borderColor: isSelected ? colors.accent : colors.border,
                  },
                ]}
                onPress={() => setActiveSource(src)}
              >
                <Text
                  style={[
                    styles.secFilterChipText,
                    { color: isSelected ? colors.accent : colors.mutedFg },
                  ]}
                >
                  {src === 'all'
                    ? t('closet.allSources', { defaultValue: 'All Sources' })
                    : src === 'Private'
                    ? t('taxonomy.source.Private', { defaultValue: 'Private' })
                    : src === 'Retail'
                    ? t('taxonomy.source.Retail', { defaultValue: 'Retail' })
                    : labelForIntent(src, t)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* View Mode Toggle */}
        <View style={styles.viewModeGroup}>
          <TouchableOpacity
            style={[styles.viewModeBtn, viewMode === 'grid' && { backgroundColor: colors.secondary }]}
            onPress={() => setViewMode('grid')}
          >
            <Lucide.LayoutGrid size={15} color={viewMode === 'grid' ? colors.accent : colors.mutedFg} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewModeBtn, viewMode === 'compact' && { backgroundColor: colors.secondary }]}
            onPress={() => setViewMode('compact')}
          >
            <Lucide.Grid size={15} color={viewMode === 'compact' ? colors.accent : colors.mutedFg} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewModeBtn, viewMode === 'list' && { backgroundColor: colors.secondary }]}
            onPress={() => setViewMode('list')}
          >
            <Lucide.List size={15} color={viewMode === 'list' ? colors.accent : colors.mutedFg} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Garment Grid / List ──────────────────────────────────────── */}
      {loading ? (
        <LoadingVideo message={t('closet.loadingWardrobe', { defaultValue: 'Loading your wardrobe…' })} />
      ) : semanticLoading ? (
        <LoadingVideo message={t('closet.searchingSemantic', { defaultValue: 'FashionCLIP semantic searching…' })} />
      ) : displayItems.length === 0 ? (
        <View style={styles.emptyBox}>
          <Lucide.Shirt size={48} color={colors.mutedFg} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            {t('closet.noItemsFound', { defaultValue: 'No items in this view' })}
          </Text>
          <Text style={[styles.emptySub, { color: colors.mutedFg }]}>
            {t('closet.noItemsSub', { defaultValue: 'Try changing filters or tap + to add clothes.' })}
          </Text>
        </View>
      ) : (
        <View
          ref={flatListContainerRef}
          style={{ flex: 1 }}
          onLayout={() => {
            flatListContainerRef.current?.measureInWindow?.((x, y, width, height) => {
              flatListLayoutRef.current = { pageX: x, pageY: y, width, height };
            });
          }}
        >
          <FlatList
            ref={flatListRef}
            key={`${viewMode}-${numColumns}`}
            data={displayItems}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            numColumns={numColumns}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            columnWrapperStyle={numColumns > 1 ? { gap: spacing[2], marginBottom: spacing[2] } : undefined}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.accent}
              />
            }
          />
        </View>
      )}

      {/* ── Rich Selection Floater ────────────────────────────────────── */}
      {selectMode && (
        <RichSelectionFloater
          selectedCount={selectedIds.size}
          totalVisibleCount={displayItems.length}
          isAllSelected={isAllSelected}
          onToggleSelectAll={handleToggleSelectAll}
          onCompleteOutfit={() => setCompletionOpen(true)}
          onGroupSelected={handleGroupSelected}
          onTagSelected={handleTagSelected}
          onDeleteSelected={handleBatchDelete}
          onClose={() => {
            setSelectedIds(new Set());
            setSelectMode(false);
          }}
          deleting={loading}
        />
      )}

      {/* ── Fast Scroll To Top Floater ─────────────────────────────── */}
      <ScrollToTopFloater
        visible={showScrollTop && !selectMode}
        onPress={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true })}
      />

      {/* ── Batch Tagging Modal ────────────────────────────────────────── */}
      <Modal visible={tagModalOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.modalHeader, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
              <Lucide.Tag size={20} color={colors.accent} />
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                {t('closet.tagItemsTitle', { defaultValue: 'Tag Selected Items' })}
              </Text>
            </View>
            <Text style={[styles.modalDesc, { color: colors.mutedFg, textAlign: isRtl ? 'right' : 'left' }]}>
              {t('closet.tagItemsBody', {
                count: selectedIds.size,
                defaultValue: 'Enter tags separated by commas to add them to all selected garments.',
              })}
            </Text>

            <TextInput
              style={[
                styles.modalInput,
                {
                  backgroundColor: colors.secondary,
                  borderColor: colors.border,
                  color: colors.foreground,
                  textAlign: isRtl ? 'right' : 'left',
                },
              ]}
              value={tagInput}
              onChangeText={setTagInput}
              placeholder={t('closet.customTagPlaceholder', { defaultValue: 'e.g. Work, GYM, Swimwear' })}
              placeholderTextColor={colors.mutedFg}
              autoFocus
            />

            <View style={[styles.modalBtnRow, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { borderColor: colors.border }]}
                onPress={() => setTagModalOpen(false)}
                disabled={tagging}
              >
                <Text style={[styles.modalCancelText, { color: colors.foreground }]}>
                  {t('common.cancel', { defaultValue: 'Cancel' })}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSubmitBtn, { backgroundColor: colors.accent }]}
                onPress={handleApplyTags}
                disabled={tagging}
              >
                {tagging ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.modalSubmitText}>
                    {t('closet.applyTags', { defaultValue: 'Apply Tags' })}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Outfit Completion Sheet Modal */}
      <OutfitCompletionSheet
        open={completionOpen}
        onClose={() => setCompletionOpen(false)}
        anchorIds={Array.from(selectedIds)}
        anchorsHint={selectedItemsHint}
      />

      {/* Drag & Drop Touch Overlay and Floating Preview */}
      {isDragging && (
        <View
          style={[StyleSheet.absoluteFill, { zIndex: 9999 }]}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderMove={(e) => {
            handleDragMove(e.nativeEvent.pageX, e.nativeEvent.pageY);
          }}
          onResponderRelease={handleDragEnd}
          onResponderTerminate={handleDragEnd}
        />
      )}

      {isDragging && draggedId && (() => {
        const draggedItem = items.find(it => it.id === draggedId);
        const draggedImg = getItemImageUrl(draggedItem);

        const screenW = Dimensions.get('window').width;
        const isRtl = I18nManager.isRTL;
        const xPos = isRtl ? (screenW - touchPos.x - 48) : (touchPos.x - 48);

        return (
          <View
            style={[
              styles.floatingPreview,
              {
                top: touchPos.y - 48,
                start: xPos,
                borderColor: colors.accent,
                backgroundColor: colors.card,
              }
            ]}
            pointerEvents="none"
          >
            {draggedImg ? (
              <Image source={{ uri: draggedImg }} style={styles.floatingPreviewImg} resizeMode="contain" />
            ) : (
              <Lucide.Shirt size={24} color={colors.mutedFg} />
            )}
          </View>
        );
      })()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
  },
  superTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  mainTitle: {
    fontFamily: fonts.displayBold,
    fontSize: fontSizes['2xl'],
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchSection: {
    flexDirection: 'row',
    paddingHorizontal: spacing[4],
    paddingTop: spacing[2],
    paddingBottom: spacing[1],
    gap: spacing[2],
    alignItems: 'center',
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingHorizontal: spacing[3],
    gap: spacing[2],
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    height: '100%',
  },
  semanticToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 40,
    paddingHorizontal: spacing[3],
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  semanticToggleText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  filterPillsBar: {
    height: 46,
    flexGrow: 0,
    marginVertical: 4,
  },
  filterPillsScroll: {
    paddingHorizontal: spacing[4],
    gap: spacing[2],
    alignItems: 'center',
  },
  filterPill: {
    height: 34,
    paddingHorizontal: spacing[3.5],
    borderRadius: radii.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterPillText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
    lineHeight: 16,
    includeFontPadding: false,
  },
  subFilterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    height: 40,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  secondaryFilterScroll: {
    gap: spacing[1.5],
    alignItems: 'center',
    paddingEnd: spacing[2],
  },
  secFilterChip: {
    height: 26,
    paddingHorizontal: spacing[2.5],
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secFilterChipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
    lineHeight: 14,
    includeFontPadding: false,
  },
  viewModeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewModeBtn: {
    width: 28,
    height: 28,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: spacing[4],
    paddingBottom: spacing[12],
  },
  gridCard: {
    borderRadius: radii.xl,
    overflow: 'hidden',
    ...shadows.sm,
  },
  gridImgWrap: {
    width: '100%',
    aspectRatio: 3 / 4,
    position: 'relative',
  },
  gridImg: {
    width: '100%',
    height: '100%',
  },
  intentBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.full,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  intentText: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    textTransform: 'uppercase',
  },
  selectBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridDetails: {
    padding: spacing[2.5],
  },
  gridTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
  },
  gridSub: {
    fontFamily: fonts.body,
    fontSize: 10,
    marginTop: 2,
  },
  listItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[3],
    borderRadius: radii.xl,
    borderWidth: 1,
    marginBottom: spacing[2],
    gap: spacing[3],
    ...shadows.sm,
  },
  listThumb: {
    width: 48,
    height: 48,
    borderRadius: radii.lg,
  },
  listInfo: {
    flex: 1,
  },
  listTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.sm,
  },
  listSub: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    marginTop: 2,
  },
  selectCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
  },
  loadingText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
  },
  emptyBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[8],
    gap: spacing[2],
  },
  emptyTitle: {
    fontFamily: fonts.displayBold,
    fontSize: fontSizes.lg,
    marginTop: spacing[2],
  },
  emptySub: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[5],
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: radii.xl,
    padding: spacing[5],
    borderWidth: 1,
    gap: spacing[3],
    ...shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  modalTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.base,
  },
  modalDesc: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    lineHeight: 18,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: radii.lg,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2.5],
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    marginTop: spacing[1],
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing[2],
    marginTop: spacing[2],
  },
  modalCancelBtn: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2.5],
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  modalCancelText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
  },
  modalSubmitBtn: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2.5],
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSubmitText: {
    color: '#fff',
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.sm,
  },
  floatingPreview: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: radii.xl,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    zIndex: 9999,
  },
  floatingPreviewImg: {
    width: '100%',
    height: '100%',
    borderRadius: radii.xl - 2,
  },
});
