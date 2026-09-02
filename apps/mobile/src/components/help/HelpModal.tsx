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
  Dimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Lucide from 'lucide-react-native';

import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii, shadows } from '@mobile/theme/tokens';
import { useHelpStore } from '@mobile/lib/stores/helpStore';
import { HELP_TOPICS } from '@mobile/lib/helpTopics';
import { SimpleMarkdownView } from './SimpleMarkdownView';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

function renderTopicIcon(iconName: string, size = 20, color = '#2F7972') {
  const IconComponent = (Lucide as any)[iconName] || Lucide.HelpCircle;
  return <IconComponent size={size} color={color} />;
}

export function HelpModal() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const isRtl = I18nManager.isRTL;

  const {
    isOpen,
    activeTopic,
    viewingGuide,
    guideContent,
    loadingGuide,
    closeHelp,
    setTopic,
    setViewingGuide,
    loadGuide,
  } = useHelpStore();

  const [topicDropdownOpen, setTopicDropdownOpen] = useState(false);

  if (!isOpen) return null;

  const currentTopic = HELP_TOPICS.find((t) => t.id === activeTopic) || HELP_TOPICS[0];

  const handleTopicSelect = (topicId: string) => {
    setTopic(topicId);
    setTopicDropdownOpen(false);
  };

  const handleLearnMore = () => {
    loadGuide(currentTopic.id, i18n.language || 'en');
  };

  const renderLayer1Cards = () => {
    switch (currentTopic.id) {
      case 'overview':
        return (
          <View style={styles.layer1Content}>
            <Text style={[styles.introText, { color: colors.foreground }]}>
              {t('help.overview_p1', { defaultValue: 'DressApp is your AI-driven digital wardrobe assistant.' })}
            </Text>
            <Text style={[styles.bodyText, { color: colors.mutedFg }]}>
              {t('help.overview_p2', { defaultValue: 'Digitize your closet, curate complete daily outfits, get AI styling advice, and pack smartly.' })}
            </Text>
            <Text style={[styles.bodyText, { color: colors.mutedFg }]}>
              {t('help.overview_p3', { defaultValue: 'Explore the features using the topic picker above.' })}
            </Text>
          </View>
        );

      case 'prerequisites':
        return (
          <View style={styles.layer1Content}>
            <Text style={[styles.introText, { color: colors.foreground }]}>
              {t('help.prereq_p1', { defaultValue: 'Before you start digitizing your wardrobe:' })}
            </Text>
            <View style={styles.stepsContainer}>
              {[
                { num: 1, text: t('help.prereq_item1', { defaultValue: 'Clear, well-lit clothing photos' }) },
                { num: 2, text: t('help.prereq_item2', { defaultValue: 'Stable internet connection' }) },
                { num: 3, text: t('help.prereq_item3', { defaultValue: 'Valid user profile setup' }) },
                { num: 4, text: t('help.geminiKeyStep', { defaultValue: 'A free Gemini API Key configured in your profile settings.' }) },
              ].map((step) => (
                <View key={step.num} style={[styles.stepCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                  <View style={[styles.stepBadge, { backgroundColor: colors.primary }]}>
                    <Text style={styles.stepBadgeText}>{step.num}</Text>
                  </View>
                  <Text style={[styles.stepText, { color: colors.foreground }]}>{step.text}</Text>
                </View>
              ))}
            </View>
          </View>
        );

      case 'closet-page':
        return (
          <View style={styles.layer1Content}>
            <Text style={[styles.introText, { color: colors.foreground }]}>
              {t('help.closet_page_p1', { defaultValue: 'The Closet page lets you view, search, and manage your digitized garments:' })}
            </Text>
            <View style={styles.stepsContainer}>
              {[
                { title: t('help.closet_view_title', { defaultValue: 'View & Filter' }), desc: t('help.closet_view_desc', { defaultValue: 'Browse all your registered shirts, pants, skirts, shoes, and outerwear in a grid. Filter by color, category, season, or material.' }) },
                { title: t('help.closet_select_title', { defaultValue: 'Multi-Select & Delete' }), desc: t('help.closet_select_desc', { defaultValue: 'Enable select mode to checkmark multiple clothing items and bulk delete them from your wardrobe database in a single action.' }) },
                { title: t('help.closet_group_title', { defaultValue: 'Item Grouping (Single vs. Set)' }), desc: t('help.closet_group_desc', { defaultValue: 'Combine individual garments into a synchronized Set (like a suit or matching dress sets) to ensure they are suggested together.' }) },
                { title: t('help.closet_edit_title', { defaultValue: 'Edit & Tags' }), desc: t('help.closet_edit_desc', { defaultValue: 'Tap any garment card to open the item details, edit metadata, apply AI Vision photo repairs, and attach custom tags.' }) },
              ].map((item, idx) => (
                <View key={idx} style={[styles.featureCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                  <Text style={[styles.featureTitle, { color: colors.foreground }]}>{item.title}</Text>
                  <Text style={[styles.featureDesc, { color: colors.mutedFg }]}>{item.desc}</Text>
                </View>
              ))}
            </View>
          </View>
        );

      case 'adding-clothes':
        return (
          <View style={styles.layer1Content}>
            <Text style={[styles.introText, { color: colors.foreground }]}>
              {t('help.add_clothes_p1', { defaultValue: 'Adding new garments to your digital closet takes just a few seconds:' })}
            </Text>
            <View style={styles.stepsContainer}>
              {[
                t('help.add_clothes_step1', { defaultValue: 'Tap the Camera button in the bottom navigation.' }),
                t('help.add_clothes_step2', { defaultValue: 'Snap a clear photo or upload from your camera roll.' }),
                t('help.add_clothes_step3', { defaultValue: 'AI automatically isolates and removes the background cutout.' }),
                t('help.add_clothes_step4', { defaultValue: 'Verify identified category, colors, and materials.' }),
                t('help.add_clothes_step5', { defaultValue: 'Optionally add custom tags or formality dress code.' }),
                t('help.add_clothes_step6', { defaultValue: 'Save to instantly include the item in styling rotation.' }),
              ].map((step, idx) => (
                <View key={idx} style={[styles.stepCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                  <View style={[styles.stepBadge, { backgroundColor: colors.primary }]}>
                    <Text style={styles.stepBadgeText}>{idx + 1}</Text>
                  </View>
                  <Text style={[styles.stepText, { color: colors.foreground }]}>{step}</Text>
                </View>
              ))}
            </View>
          </View>
        );

      case 'ai-stylist':
        return (
          <View style={styles.layer1Content}>
            <Text style={[styles.introText, { color: colors.foreground }]}>
              {t('help.stylist_p1', { defaultValue: 'Your AI Stylist recommends tailored looks grounded in your real wardrobe:' })}
            </Text>
            <View style={styles.stepsContainer}>
              {[
                t('help.stylist_step1', { defaultValue: 'Ask via voice or text (e.g. "What should I wear to dinner tonight?").' }),
                t('help.stylist_step2', { defaultValue: 'The AI checks your real closet pieces, local weather, and occasion.' }),
                t('help.stylist_step3', { defaultValue: 'Curates 3 complete coordinated looks (Top, Bottom, Shoes, and Accessories).' }),
                t('help.stylist_step4', { defaultValue: 'Tap any recommendation to try it on your 2D mannequin avatar.' }),
                t('help.stylist_step5', { defaultValue: 'Save looks to your Outfit Planner or Suitcase.' }),
              ].map((step, idx) => (
                <View key={idx} style={[styles.stepCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                  <View style={[styles.stepBadge, { backgroundColor: colors.primary }]}>
                    <Text style={styles.stepBadgeText}>{idx + 1}</Text>
                  </View>
                  <Text style={[styles.stepText, { color: colors.foreground }]}>{step}</Text>
                </View>
              ))}
            </View>
          </View>
        );

      default:
        return (
          <View style={styles.layer1Content}>
            <Text style={[styles.introText, { color: colors.foreground }]}>
              {t(`help.${currentTopic.wiki}_p1`, { defaultValue: `Learn how to use ${t(currentTopic.labelKey, { defaultValue: currentTopic.defaultLabel })} inside DressApp.` })}
            </Text>
            <View style={[styles.featureCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <Text style={[styles.featureTitle, { color: colors.foreground }]}>
                {t(currentTopic.labelKey, { defaultValue: currentTopic.defaultLabel })}
              </Text>
              <Text style={[styles.featureDesc, { color: colors.mutedFg }]}>
                {t('help.learnMorePrompt', { defaultValue: 'Tap "Learn more" below for the comprehensive step-by-step guide from the DressApp Wiki.' })}
              </Text>
            </View>
          </View>
        );
    }
  };

  return (
    <Modal visible={isOpen} animationType="slide" transparent onRequestClose={closeHelp}>
      <View style={styles.backdrop}>
        <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.headerRow, { borderBottomColor: colors.border }]}>
            <TouchableOpacity
              style={[
                styles.topicDropdownBtn,
                { backgroundColor: colors.secondary, borderColor: '#a855f7' },
                isRtl ? { flexDirection: 'row-reverse' } : { flexDirection: 'row' },
              ]}
              onPress={() => setTopicDropdownOpen(!topicDropdownOpen)}
              activeOpacity={0.8}
            >
              <Text style={[styles.topicDropdownText, { color: colors.foreground }]} numberOfLines={1}>
                {t(currentTopic.labelKey, { defaultValue: currentTopic.defaultLabel })}
              </Text>
              <View style={styles.dropdownIcons}>
                <Lucide.ChevronDown size={18} color={colors.mutedFg} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity onPress={closeHelp} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Lucide.X size={20} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          {topicDropdownOpen && (
            <View style={[styles.dropdownMenu, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <ScrollView style={styles.dropdownScroll} showsVerticalScrollIndicator={true}>
                {HELP_TOPICS.map((item) => {
                  const isSelected = item.id === currentTopic.id;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        styles.dropdownItem,
                        isSelected && { backgroundColor: colors.secondary },
                        isRtl ? { flexDirection: 'row-reverse' } : { flexDirection: 'row' },
                      ]}
                      onPress={() => handleTopicSelect(item.id)}
                    >
                      {renderTopicIcon(item.iconName, 16, isSelected ? colors.primary : colors.mutedFg)}
                      <Text
                        style={[
                          styles.dropdownItemText,
                          { color: isSelected ? colors.primary : colors.foreground },
                          isSelected && { fontFamily: fonts.bodyBold },
                        ]}
                      >
                        {t(item.labelKey, { defaultValue: item.defaultLabel })}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          <ScrollView style={styles.scrollBody} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {viewingGuide ? (
              <View style={styles.guideContainer}>
                <TouchableOpacity
                  style={[styles.backBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
                  onPress={() => setViewingGuide(false)}
                  activeOpacity={0.7}
                >
                  <Lucide.ArrowLeft size={16} color={colors.foreground} />
                  <Text style={[styles.backBtnText, { color: colors.foreground }]}>
                    {t('common.back', { defaultValue: 'Back to Summary' })}
                  </Text>
                </TouchableOpacity>

                {loadingGuide ? (
                  <View style={styles.loadingBox}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={[styles.loadingText, { color: colors.mutedFg }]}>
                      {t('common.loading', { defaultValue: 'Loading guide…' })}
                    </Text>
                  </View>
                ) : (
                  <SimpleMarkdownView markdown={guideContent} />
                )}
              </View>
            ) : (
              <View style={styles.summaryContainer}>
                <View style={[styles.topicTitleRow, isRtl ? { flexDirection: 'row-reverse' } : { flexDirection: 'row' }]}>
                  {renderTopicIcon(currentTopic.iconName, 22, colors.foreground)}
                  <Text style={[styles.topicHeading, { color: colors.foreground }]}>
                    {t(currentTopic.labelKey, { defaultValue: currentTopic.defaultLabel })}
                  </Text>
                </View>

                {renderLayer1Cards()}

                <View style={[styles.footerRow, isRtl ? { justifyContent: 'flex-start' } : { justifyContent: 'flex-end' }]}>
                  <TouchableOpacity style={styles.learnMoreBtn} onPress={handleLearnMore} disabled={loadingGuide} activeOpacity={0.7}>
                    {loadingGuide ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <>
                        <Text style={[styles.learnMoreText, { color: colors.primary }]}>
                          {t('help.learnMore', { defaultValue: 'Learn more' })}
                        </Text>
                        <Lucide.ArrowRight size={14} color={colors.primary} />
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalCard: { height: SCREEN_HEIGHT * 0.85, borderTopLeftRadius: radii['2xl'], borderTopRightRadius: radii['2xl'], borderTopWidth: 1, overflow: 'hidden' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, borderBottomWidth: 1, gap: spacing.sm },
  topicDropdownBtn: { flex: 1, height: 40, borderRadius: radii.full, borderWidth: 2, alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md },
  topicDropdownText: { fontFamily: fonts.bodyBold, fontSize: fontSizes.sm, flex: 1 },
  dropdownIcons: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  closeBtn: { padding: spacing.xs },
  dropdownMenu: { position: 'absolute', top: 56, left: spacing.md, right: spacing.md, maxHeight: 280, borderRadius: radii.xl, borderWidth: 1, zIndex: 999, ...shadows.md },
  dropdownScroll: { padding: spacing.xs },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 1, borderRadius: radii.lg },
  dropdownItemText: { fontFamily: fonts.body, fontSize: fontSizes.sm },
  scrollBody: { flex: 1 },
  scrollContent: { padding: spacing.md, paddingBottom: spacing['2xl'] },
  summaryContainer: { gap: spacing.md },
  topicTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  topicHeading: { fontFamily: fonts.displayBold, fontSize: fontSizes.xl },
  layer1Content: { gap: spacing.md },
  introText: { fontFamily: fonts.body, fontSize: fontSizes.sm, lineHeight: 22 },
  bodyText: { fontFamily: fonts.body, fontSize: fontSizes.xs, lineHeight: 18 },
  stepsContainer: { gap: spacing.sm },
  stepCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, padding: spacing.md, borderRadius: radii.xl, borderWidth: 1 },
  stepBadge: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  stepBadgeText: { color: '#FFF', fontFamily: fonts.bodyBold, fontSize: fontSizes.xs },
  stepText: { flex: 1, fontFamily: fonts.body, fontSize: fontSizes.xs + 1, lineHeight: 18 },
  featureCard: { padding: spacing.md, borderRadius: radii.xl, borderWidth: 1, gap: 4 },
  featureTitle: { fontFamily: fonts.bodyBold, fontSize: fontSizes.sm },
  featureDesc: { fontFamily: fonts.body, fontSize: fontSizes.xs, lineHeight: 18 },
  footerRow: { marginTop: spacing.sm, paddingTop: spacing.sm },
  learnMoreBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: spacing.xs },
  learnMoreText: { fontFamily: fonts.bodyBold, fontSize: fontSizes.sm },
  guideContainer: { gap: spacing.md },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, borderRadius: radii.full, borderWidth: 1 },
  backBtnText: { fontFamily: fonts.bodyBold, fontSize: fontSizes.xs },
  loadingBox: { padding: spacing['2xl'], alignItems: 'center', gap: spacing.sm },
  loadingText: { fontFamily: fonts.body, fontSize: fontSizes.xs },
});