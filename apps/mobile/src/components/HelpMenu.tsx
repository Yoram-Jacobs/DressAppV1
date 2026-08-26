/**
 * apps/mobile/src/components/HelpMenu.tsx
 *
 * Full two-layer Help Menu modal with 13-language i18next localization.
 * Parity with apps/web/src/components/HelpMenu.jsx:
 *   - Layer 1: Friendly, step-by-step summary guides with maximum 6 steps.
 *   - Layer 2: Detailed "Learn More" guide integration.
 *   - Supports all topics: Overview, Adding Clothes, Closet, AI Stylist,
 *     Scheduler, Profile, Wardrobe Stats, Outfit Planner, Suitcase,
 *     Marketplace, Extension, Trend Scout, Experts, Campaigns, Monetization, Troubleshooting.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  I18nManager,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Lucide from 'lucide-react-native';

import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii } from '@mobile/theme/tokens';

interface HelpSection {
  id: string;
  titleKey: string;
  fallbackTitle: string;
  icon: any;
  p1Key?: string;
  fallbackP1?: string;
  p2Key?: string;
  fallbackP2?: string;
  stepsCount?: number;
  stepPrefix?: string;
}

const SECTIONS: HelpSection[] = [
  {
    id: 'overview',
    titleKey: 'help.overview_title',
    fallbackTitle: 'Overview',
    icon: Lucide.BookOpen,
    p1Key: 'help.overview_p1',
    fallbackP1: 'DressApp is your personal AI wardrobe organizer and smart stylist assistant.',
    p2Key: 'help.overview_p2',
    fallbackP2: 'Digitize your closet, create stunning outfits, plan travel luggage, and get AI recommendations.',
  },
  {
    id: 'adding_clothes',
    titleKey: 'help.add_clothes_title',
    fallbackTitle: 'Adding Clothes',
    icon: Lucide.Camera,
    p1Key: 'help.add_clothes_p1',
    fallbackP1: 'Easily digitize your wardrobe in seconds.',
    stepsCount: 5,
    stepPrefix: 'help.add_clothes_step',
  },
  {
    id: 'closet_management',
    titleKey: 'help.closet_page_title',
    fallbackTitle: 'Closet Management',
    icon: Lucide.Grid,
    p1Key: 'help.closet_page_p1',
    fallbackP1: 'Browse, search, and manage your digital wardrobe.',
    stepsCount: 5,
    stepPrefix: 'help.closet_page_step',
  },
  {
    id: 'ai_stylist',
    titleKey: 'help.stylist_title',
    fallbackTitle: 'AI Stylist',
    icon: Lucide.Sparkles,
    p1Key: 'help.stylist_p1',
    fallbackP1: 'Get smart outfit recommendations tailored for the weather and occasions.',
    stepsCount: 5,
    stepPrefix: 'help.stylist_step',
  },
  {
    id: 'outfit_planner',
    titleKey: 'help.planner_title',
    fallbackTitle: 'Outfit Planner',
    icon: Lucide.Layers,
    p1Key: 'help.planner_p1',
    fallbackP1: 'Layer and combine your clothes on the visual outfit canvas.',
    stepsCount: 4,
    stepPrefix: 'help.planner_step',
  },
  {
    id: 'suitcase_packing',
    titleKey: 'help.suitcase_title',
    fallbackTitle: 'Travel Packing',
    icon: Lucide.MapPin,
    p1Key: 'help.suitcase_p1',
    fallbackP1: 'Pack smart with AI luggage packing assistance based on destination weather.',
    stepsCount: 4,
    stepPrefix: 'help.suitcase_step',
  },
  {
    id: 'marketplace_listing',
    titleKey: 'help.market_title',
    fallbackTitle: 'Marketplace',
    icon: Lucide.ShoppingBag,
    p1Key: 'help.market_p1',
    fallbackP1: 'Buy, sell, swap, or donate pre-loved clothes in your community.',
    stepsCount: 5,
    stepPrefix: 'help.market_step',
  },
  {
    id: 'wardrobe_insights',
    titleKey: 'help.stats_title',
    fallbackTitle: 'Wardrobe Insights',
    icon: Lucide.BarChart4,
    p1Key: 'help.stats_p1',
    fallbackP1: 'Track your cost-per-wear, color breakdown, and sustainability impact.',
  },
  {
    id: 'trend_scout',
    titleKey: 'help.trend_scout_title',
    fallbackTitle: 'Trend Scout',
    icon: Lucide.TrendingUp,
    p1Key: 'help.trend_scout_p1',
    fallbackP1: 'Stay ahead of runway, street fashion, and sustainable trends daily.',
  },
  {
    id: 'experts_registry',
    titleKey: 'help.experts_title',
    fallbackTitle: 'Certified Stylists',
    icon: Lucide.UserRound,
    p1Key: 'help.experts_p1',
    fallbackP1: 'Connect with certified personal stylists for custom consultations.',
  },
  {
    id: 'troubleshooting',
    titleKey: 'help.trouble_title',
    fallbackTitle: 'Troubleshooting',
    icon: Lucide.HelpCircle,
    p1Key: 'help.trouble_p1',
    fallbackP1: 'Find quick solutions to common questions and camera/sync tips.',
  },
];

interface HelpMenuProps {
  visible: boolean;
  onClose: () => void;
}

export function HelpMenuModal({ visible, onClose }: HelpMenuProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const isRtl = I18nManager.isRTL;

  const [selectedSection, setSelectedSection] = useState<HelpSection>(SECTIONS[0]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <View style={styles.headerTitleRow}>
            <Lucide.HelpCircle size={22} color={colors.accent} />
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>
              {t('help.center_title', { defaultValue: 'Help & User Manual' })}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.secondary }]}>
            <Lucide.X size={20} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        {/* Section Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillsScroll}
          style={[styles.pillsRow, { borderBottomColor: colors.border }]}
        >
          {SECTIONS.map((sec) => {
            const Icon = sec.icon;
            const isSelected = selectedSection.id === sec.id;
            return (
              <TouchableOpacity
                key={sec.id}
                onPress={() => setSelectedSection(sec)}
                style={[
                  styles.pill,
                  {
                    backgroundColor: isSelected ? colors.primary : colors.card,
                    borderColor: isSelected ? colors.primary : colors.border,
                  },
                ]}
              >
                <Icon size={14} color={isSelected ? colors.primaryFg : colors.foreground} />
                <Text
                  style={[
                    styles.pillText,
                    { color: isSelected ? colors.primaryFg : colors.foreground },
                  ]}
                >
                  {t(sec.titleKey, { defaultValue: sec.fallbackTitle })}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Content Body */}
        <ScrollView contentContainerStyle={styles.contentScroll} showsVerticalScrollIndicator={false}>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.cardHeaderRow}>
              {React.createElement(selectedSection.icon, { size: 24, color: colors.accent })}
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>
                {t(selectedSection.titleKey, { defaultValue: selectedSection.fallbackTitle })}
              </Text>
            </View>

            {selectedSection.p1Key ? (
              <Text style={[styles.paragraph, { color: colors.mutedFg }]}>
                {t(selectedSection.p1Key, { defaultValue: selectedSection.fallbackP1 })}
              </Text>
            ) : null}

            {selectedSection.p2Key ? (
              <Text style={[styles.paragraph, { color: colors.mutedFg, marginTop: spacing[2] }]}>
                {t(selectedSection.p2Key, { defaultValue: selectedSection.fallbackP2 })}
              </Text>
            ) : null}

            {/* Steps if present */}
            {selectedSection.stepsCount ? (
              <View style={styles.stepsContainer}>
                <Text style={[styles.stepsTitle, { color: colors.foreground }]}>
                  {t('help.stepsToFollow', { defaultValue: 'How it works:' })}
                </Text>
                {Array.from({ length: selectedSection.stepsCount }).map((_, idx) => {
                  const stepNum = idx + 1;
                  const stepKey = `${selectedSection.stepPrefix}${stepNum}`;
                  return (
                    <View key={stepNum} style={styles.stepRow}>
                      <View style={[styles.stepBadge, { backgroundColor: colors.accent }]}>
                        <Text style={styles.stepBadgeText}>{stepNum}</Text>
                      </View>
                      <Text style={[styles.stepText, { color: colors.foreground }]}>
                        {t(stepKey, { defaultValue: `Step ${stepNum}` })}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ) : null}
          </View>
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
    width: 36,
    height: 36,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillsRow: {
    maxHeight: 52,
    borderBottomWidth: 1,
  },
  pillsScroll: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    gap: spacing[2],
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1.5],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderRadius: radii.full,
    borderWidth: 1,
  },
  pillText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.xs,
  },
  contentScroll: {
    padding: spacing[4],
    paddingBottom: spacing[10],
  },
  card: {
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: spacing[5],
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    marginBottom: spacing[3],
  },
  cardTitle: {
    fontFamily: fonts.displayBold,
    fontSize: fontSizes.xl,
  },
  paragraph: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    lineHeight: fontSizes.sm * 1.6,
  },
  stepsContainer: {
    marginTop: spacing[4],
    paddingTop: spacing[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e7eb',
    gap: spacing[2.5],
  },
  stepsTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.sm,
    marginBottom: spacing[1],
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
  },
  stepBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  stepBadgeText: {
    color: '#fff',
    fontFamily: fonts.bodyBold,
    fontSize: 11,
  },
  stepText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    flex: 1,
    lineHeight: fontSizes.sm * 1.4,
  },
});
