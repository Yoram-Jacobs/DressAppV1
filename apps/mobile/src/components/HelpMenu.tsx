/**
 * apps/mobile/src/components/HelpMenu.tsx
 *
 * Full two-layer Help Menu modal with 13-language i18next localization.
 * Parity with apps/web/src/components/HelpMenu.jsx:
 *   - Layer 1: Friendly, step-by-step summary guides with maximum 6 steps.
 *   - Layer 2: Detailed "Learn More" guide integration.
 *   - Supports all 18 topics: Overview, Prerequisites, Adding Clothes, Closet, AI Stylist,
 *     Scheduler, Profile, Wardrobe Stats, Outfit Planner, Suitcase, Marketplace,
 *     Shopping Assistant, Import Wardrobe, Trend Scout, Experts, Campaigns,
 *     Monetization Tiers, Troubleshooting.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  I18nManager,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Lucide from 'lucide-react-native';

import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii } from '@mobile/theme/tokens';
import { helpStore } from '@mobile/lib/stores/helpStore';

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
    id: 'prerequisites',
    titleKey: 'help.prereq_title',
    fallbackTitle: 'Prerequisites',
    icon: Lucide.ClipboardList,
    p1Key: 'help.prereq_p1',
    fallbackP1: 'Before you start digitizing your wardrobe, ensure you have clear photos and internet access.',
    stepsCount: 4,
    stepPrefix: 'help.prereq_item',
  },
  {
    id: 'adding-clothes',
    titleKey: 'help.add_clothes_title',
    fallbackTitle: 'Adding Clothes',
    icon: Lucide.Camera,
    p1Key: 'help.add_clothes_p1',
    fallbackP1: 'Easily digitize your wardrobe in seconds with camera cutouts and background removal.',
    stepsCount: 6,
    stepPrefix: 'help.add_clothes_step',
  },
  {
    id: 'closet-page',
    titleKey: 'help.closet_page_title',
    fallbackTitle: 'Your Closet',
    icon: Lucide.Grid,
    p1Key: 'help.closet_page_p1',
    fallbackP1: 'Browse, search, group tag, and manage your digital wardrobe.',
    stepsCount: 4,
    stepPrefix: 'help.closet_view_step',
  },
  {
    id: 'ai-stylist',
    titleKey: 'help.stylist_title',
    fallbackTitle: 'AI Stylist',
    icon: Lucide.Sparkles,
    p1Key: 'help.stylist_p1',
    fallbackP1: 'Get smart outfit recommendations tailored for the weather and occasions.',
    stepsCount: 5,
    stepPrefix: 'help.stylist_step',
  },
  {
    id: 'scheduler-push',
    titleKey: 'help.scheduler_push_title',
    fallbackTitle: 'Daily Suggestions',
    icon: Lucide.Bell,
    p1Key: 'help.scheduler_push_p1',
    fallbackP1: 'Receive automatic weather-appropriate outfit suggestions every morning.',
    stepsCount: 5,
    stepPrefix: 'help.scheduler_push_step',
  },
  {
    id: 'profile-matters',
    titleKey: 'help.profile_title',
    fallbackTitle: 'Your Profile',
    icon: Lucide.User,
    p1Key: 'help.profile_p1',
    fallbackP1: 'Personalize body sizing, virtual try-on avatar, and language preferences.',
  },
  {
    id: 'wardrobe-stats',
    titleKey: 'help.stats_title',
    fallbackTitle: 'Wardrobe Insights',
    icon: Lucide.BarChart4,
    p1Key: 'help.stats_p1',
    fallbackP1: 'Track your closet valuation, cost-per-wear, and color palette breakdowns.',
  },
  {
    id: 'dress-up',
    titleKey: 'help.planner_title',
    fallbackTitle: 'Outfit Planner',
    icon: Lucide.Layers,
    p1Key: 'help.planner_p1',
    fallbackP1: 'Layer and combine your clothes on the visual outfit canvas with outerwear toggles.',
  },
  {
    id: 'suitcase',
    titleKey: 'help.suitcase_title',
    fallbackTitle: 'Travel Packing',
    icon: Lucide.MapPin,
    p1Key: 'help.suitcase_p1',
    fallbackP1: 'Pack smart with AI luggage packing assistance based on destination weather.',
    stepsCount: 5,
    stepPrefix: 'help.suitcase_step',
  },
  {
    id: 'marketplace',
    titleKey: 'help.market_title',
    fallbackTitle: 'Marketplace',
    icon: Lucide.ShoppingBag,
    p1Key: 'help.market_p1',
    fallbackP1: 'Buy, sell, swap, or donate pre-loved clothes with virtual try-on sandbox testing.',
  },
  {
    id: 'shopping-assistant',
    titleKey: 'help.shopping_assistant_title',
    fallbackTitle: 'Shopping Assistant',
    icon: Lucide.Globe,
    p1Key: 'help.shopping_assistant_p1',
    fallbackP1: 'Shop smart on partner stores with automatic body size comparison.',
    stepsCount: 6,
    stepPrefix: 'help.shopping_assistant_step',
  },
  {
    id: 'import-wardrobe',
    titleKey: 'help.import_wardrobe_title',
    fallbackTitle: 'Import Wardrobe',
    icon: Lucide.Search,
    p1Key: 'help.import_wardrobe_p1',
    fallbackP1: 'Migrate your existing digital clothes from other apps easily.',
    stepsCount: 6,
    stepPrefix: 'help.import_wardrobe_step',
  },
  {
    id: 'trend-scout',
    titleKey: 'help.trend_scout_title',
    fallbackTitle: 'Trend Scout',
    icon: Lucide.TrendingUp,
    p1Key: 'help.trend_scout_p1',
    fallbackP1: 'Daily fashion radar across 7 curated channels with 1-tap "Style with My Closet" matching.',
  },
  {
    id: 'experts',
    titleKey: 'help.experts_title',
    fallbackTitle: 'Stylists & Experts',
    icon: Lucide.UserRound,
    p1Key: 'help.experts_p1',
    fallbackP1: 'Connect with certified personal stylists for custom consultations.',
  },
  {
    id: 'campaigns',
    titleKey: 'help.campaigns_help_title',
    fallbackTitle: 'Local Campaigns',
    icon: Lucide.Megaphone,
    p1Key: 'help.campaigns_help_p1',
    fallbackP1: 'Find exclusive sales, boutique events, and local fashion offers near you.',
  },
  {
    id: 'tiers',
    titleKey: 'help.tiers_title',
    fallbackTitle: 'Tiers & Credits',
    icon: Lucide.Wallet,
    p1Key: 'help.tiers_p1',
    fallbackP1: 'Free plan with 150 items baseline, referral bonuses, and Pro plans for unlimited closets.',
  },
  {
    id: 'troubleshooting',
    titleKey: 'help.trouble_title',
    fallbackTitle: 'Troubleshooting',
    icon: Lucide.HelpCircle,
    p1Key: 'help.trouble_p1',
    fallbackP1: 'Find quick solutions to common questions, camera permissions, and photo processing.',
  },
];

interface HelpMenuProps {
  visible: boolean;
  onClose: () => void;
}

export function HelpMenuModal({ visible, onClose }: HelpMenuProps) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const isRtl = I18nManager.isRTL;

  const [selectedSection, setSelectedSection] = useState<HelpSection>(SECTIONS[0]);

  const handleLearnMore = () => {
    onClose();
    helpStore.openHelp(selectedSection.id);
    helpStore.loadGuide(selectedSection.id, i18n.language || 'en');
  };

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

            {/* Learn More Button */}
            <TouchableOpacity
              style={[styles.learnMoreBtn, { borderColor: colors.primary }]}
              onPress={handleLearnMore}
              activeOpacity={0.7}
            >
              <Text style={[styles.learnMoreText, { color: colors.primary }]}>
                {t('help.learnMore', { defaultValue: 'Learn more' })}
              </Text>
              <Lucide.ArrowRight size={16} color={colors.primary} />
            </TouchableOpacity>
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
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
  },
  contentScroll: {
    padding: spacing[4],
    paddingBottom: spacing[8],
  },
  card: {
    padding: spacing[4],
    borderRadius: radii.xl,
    borderWidth: 1,
    gap: spacing[3],
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  cardTitle: {
    fontFamily: fonts.displayBold,
    fontSize: fontSizes.base,
  },
  paragraph: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    lineHeight: 20,
  },
  stepsContainer: {
    marginTop: spacing[2],
    gap: spacing[2],
  },
  stepsTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing[1],
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2.5],
  },
  stepBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepBadgeText: {
    color: '#FFF',
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs - 1,
  },
  stepText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: fontSizes.xs + 1,
    lineHeight: 18,
  },
  learnMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: spacing[3],
    paddingVertical: spacing[2.5],
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  learnMoreText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.sm,
  },
});
