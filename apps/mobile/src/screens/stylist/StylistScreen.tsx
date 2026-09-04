/**
 * apps/mobile/src/screens/stylist/StylistScreen.tsx
 *
 * Full-featured AI Stylist Suite with 4 Core Tabs:
 *   1. 💬 Chat: Conversational AI stylist with chat history, audio mic, quick prompts, and look cards
 *   2. ☀️ Daily Look: Weather-based daily outfit proposal, occasion recommendations, and rationale
 *   3. 🧩 Outfit Planner: 4-slot canvas with locking, wardrobe harmony shuffler, and item swap picker
 *   4. 👗 Try On: Dynamic virtual fitting room with real-time garment layering over SVG avatar
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  I18nManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import * as Lucide from 'lucide-react-native';

import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii } from '@mobile/theme/tokens';
import type { StylistStackParamList } from '@mobile/navigation/types';

import { StylistChatView, StylistOutfitCard } from '@mobile/components/stylist/StylistChatView';
import { DailySuggestionView } from '@mobile/components/stylist/DailySuggestionView';
import { OutfitPlannerView, PlannerSlotItem } from '@mobile/components/stylist/OutfitPlannerView';
import { VirtualTryOnView, TryOnItem } from '@mobile/components/stylist/VirtualTryOnView';
import { HelpFloater } from '@mobile/components/help';
import { resolveImageUrl } from '@mobile/lib/imageUtils';

type StylistTab = 'chat' | 'daily' | 'planner' | 'tryon';

export function StylistScreen() {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<StylistStackParamList, 'Stylist'>>();
  const route = useRoute<any>();

  const [activeTab, setActiveTab] = useState<StylistTab>(route.params?.tab || 'chat');
  const [previousTab, setPreviousTab] = useState<StylistTab>('daily');
  const [previousScreen, setPreviousScreen] = useState<string | null>(
    route.params?.previousScreen || route.params?.fromScreen || null
  );
  const [tryOnOutfitData, setTryOnOutfitData] = useState<any>(route.params?.outfit || null);
  const [tryOnOutfit, setTryOnOutfit] = useState<TryOnItem[]>([]);

  React.useEffect(() => {
    if (route.params?.previousScreen || route.params?.fromScreen) {
      setPreviousScreen(route.params.previousScreen || route.params.fromScreen);
    }
    if (route.params?.tab) {
      if (route.params.tab === 'tryon') {
        if (route.params?.previousTab) {
          setPreviousTab(route.params.previousTab);
        } else if (!previousTab) {
          setPreviousTab('daily');
        }
      }
      setActiveTab(route.params.tab);
    }
    if (route.params?.outfit) {
      setTryOnOutfitData(route.params.outfit);
      const raw = Array.isArray(route.params.outfit)
        ? route.params.outfit
        : (route.params.outfit.garments || route.params.outfit.items || []);

      setTryOnOutfit(
        raw.map((g: any, idx: number) => ({
          id: g.id || g.closet_item_id || `try_${idx}`,
          closet_item_id: g.closet_item_id || g.id,
          name: g.name || g.title,
          role: g.role || g.category,
          category: g.category || g.role,
          sub_category: g.sub_category || g.subcategory,
          color: g.color || (Array.isArray(g.colors) && g.colors[0]?.name) || undefined,
          image_url: resolveImageUrl(g.image_url || g.thumbnail_data_url),
        }))
      );
    }
  }, [route.params]);

  const handleSelectOutfitForTryOn = (outfit: StylistOutfitCard) => {
    setTryOnOutfitData(outfit);
    const raw = outfit.garments ?? outfit.items ?? [];
    const items: TryOnItem[] = (raw as any[]).map((g: any, idx: number) => ({
      id: g.id || g.closet_item_id || `try_${idx}`,
      closet_item_id: g.closet_item_id || g.id,
      name: g.name || g.title,
      role: g.role || g.category,
      category: g.category || g.role,
      sub_category: g.sub_category || g.subcategory,
      color: g.color || (Array.isArray(g.colors) && g.colors[0]?.name) || undefined,
      image_url: resolveImageUrl(g.image_url || g.thumbnail_data_url),
    }));
    setTryOnOutfit(items);
    setPreviousScreen(null);
    setPreviousTab('chat');
    setActiveTab('tryon');
  };

  const handleSelectPlannerForTryOn = (slots: PlannerSlotItem[]) => {
    const items: TryOnItem[] = slots.map((s) => ({
      id: s.id,
      closet_item_id: s.id,
      name: s.name,
      role: s.category,
      category: s.category,
      color: s.color,
      image_url: resolveImageUrl(s.image_url),
    }));
    setTryOnOutfitData({
      name: 'Custom Planner Look',
      style: 'Casual',
      garments: items,
    });
    setTryOnOutfit(items);
    setPreviousScreen(null);
    setPreviousTab('planner');
    setActiveTab('tryon');
  };

  const handleBack = () => {
    if (activeTab === 'tryon') {
      if (previousScreen) {
        const target = previousScreen;
        setPreviousScreen(null);
        if (navigation.canGoBack()) {
          navigation.goBack();
        } else {
          navigation.navigate(target as any);
        }
      } else {
        setActiveTab(previousTab || 'daily');
      }
    } else {
      if (previousScreen) {
        const target = previousScreen;
        setPreviousScreen(null);
        if (navigation.canGoBack()) {
          navigation.goBack();
        } else {
          navigation.navigate(target as any);
        }
      } else if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        setActiveTab('daily');
      }
    }
  };

  const tabs: { id: StylistTab; label: string; icon: any }[] = [
    { id: 'chat', label: t('stylist.chatPanel', { defaultValue: 'AI Chat' }), icon: Lucide.MessageSquare },
    { id: 'planner', label: t('stylist.outfitPlanner', { defaultValue: 'Outfit Planner' }), icon: Lucide.Layers },
    { id: 'daily', label: t('stylist.dailySuggestion', { defaultValue: 'Daily Look' }), icon: Lucide.SunMedium },
    { id: 'tryon', label: t('stylist.virtualFitting', { defaultValue: 'Try On' }), icon: Lucide.UserCheck },
  ];

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Top Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.superTitle, { color: colors.accent }]}>
            {t('stylist.superTitle', { defaultValue: 'AI STYLIST & ATELIER' })}
          </Text>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            {t('stylist.title', { defaultValue: 'Your Stylist' })}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <HelpFloater screenTopic={activeTab === 'planner' ? 'dress-up' : activeTab === 'daily' ? 'scheduler-push' : 'ai-stylist'} />
          <TouchableOpacity
            style={[styles.savedOutfitsBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
            onPress={() => navigation.navigate('Outfits')}
          >
            <Lucide.BookmarkCheck size={14} color={colors.foreground} />
            <Text style={[styles.savedOutfitsBtnText, { color: colors.foreground }]}>
              {t('stylist.savedOutfits', { defaultValue: 'Saved Outfits' })}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs Navigation Bar */}
      <View style={[styles.tabsRow, { borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
          {tabs.map((tab) => {
            const isSelected = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[
                  styles.tabChip,
                  {
                    backgroundColor: isSelected
                      ? isDark
                        ? 'rgba(35, 139, 130, 0.22)'
                        : 'rgba(31, 111, 107, 0.12)'
                      : colors.secondary,
                    borderColor: isSelected ? colors.accent : colors.border,
                    borderWidth: isSelected ? 2 : 1,
                  },
                ]}
                onPress={() => {
                  if (tab.id === 'tryon') {
                    setPreviousTab(activeTab === 'tryon' ? 'daily' : activeTab);
                  }
                  setActiveTab(tab.id);
                }}
                activeOpacity={0.8}
              >
                <Icon size={14} color={isSelected ? colors.accent : colors.mutedFg} />
                <Text
                  style={[
                    styles.tabChipText,
                    {
                      color: isSelected ? colors.foreground : colors.mutedFg,
                      fontFamily: isSelected ? fonts.bodyBold : fonts.bodyMedium,
                    },
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Tab Views */}
      <View style={styles.tabContent}>
        {activeTab === 'chat' && (
          <StylistChatView onSelectOutfitForTryOn={handleSelectOutfitForTryOn} />
        )}
        {activeTab === 'daily' && (
          <DailySuggestionView
            onTryOn={(outfit: any) => {
              const outfitObj = outfit?.garments || outfit?.items ? outfit : { name: 'Daily Look', garments: outfit };
              const garments = outfitObj.garments || outfitObj.items || [];
              setTryOnOutfitData(outfitObj);
              setTryOnOutfit(
                garments.map((g: any, idx: number) => ({
                  id: g.id || g.closet_item_id || `try_${idx}`,
                  closet_item_id: g.closet_item_id || g.id,
                  name: g.name || g.title,
                  role: g.role || g.category,
                  category: g.category || g.role,
                  sub_category: g.sub_category || g.subcategory,
                  color: g.color || (Array.isArray(g.colors) && g.colors[0]?.name) || undefined,
                  image_url: resolveImageUrl(g.image_url || g.thumbnail_data_url),
                }))
              );
              setPreviousScreen(null);
              setPreviousTab('daily');
              setActiveTab('tryon');
            }}
          />
        )}
        {activeTab === 'planner' && (
          <OutfitPlannerView onTryOn={handleSelectPlannerForTryOn} />
        )}
        {activeTab === 'tryon' && (
          <VirtualTryOnView
            activeOutfit={tryOnOutfit}
            outfitData={tryOnOutfitData}
            onBack={handleBack}
            onOpenAvatarSettings={() => navigation.navigate('Avatar')}
            onDeleteSuccess={handleBack}
          />
        )}
      </View>
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
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
  },
  superTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    letterSpacing: 1.2,
  },
  headerTitle: {
    fontFamily: fonts.displayBold,
    fontSize: fontSizes.xl,
  },
  savedOutfitsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  savedOutfitsBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs - 1,
  },
  tabsRow: {
    borderBottomWidth: 1,
    paddingVertical: 6,
  },
  tabsScroll: {
    paddingHorizontal: spacing.md,
    gap: 8,
  },
  tabChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radii.full,
  },
  tabChipActive: {},
  tabChipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.xs,
  },
  tabChipTextActive: {
    fontFamily: fonts.bodyBold,
  },
  tabContent: {
    flex: 1,
  },
});
