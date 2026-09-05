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
              {t('help.overview_p1', { defaultValue: 'DressApp is your personal AI wardrobe organizer and smart stylist assistant.' })}
            </Text>
            <Text style={[styles.bodyText, { color: colors.mutedFg }]}>
              {t('help.overview_p2', { defaultValue: 'Digitize your closet, create stunning outfits, plan travel luggage, and get personalized recommendations.' })}
            </Text>
            <Text style={[styles.bodyText, { color: colors.mutedFg }]}>
              {t('help.overview_p3', { defaultValue: 'Explore the features using the topic picker above or tap Learn more for the complete guide.' })}
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
                {
                  title: t('help.closet_view_title', { defaultValue: 'View & Filter' }),
                  desc: t('help.closet_view_desc', { defaultValue: 'Browse all your registered shirts, pants, skirts, shoes, and outerwear in a grid. Filter by color, category, season, or material.' })
                },
                {
                  title: t('help.closet_select_title', { defaultValue: 'Multi-Select & Group Tagging' }),
                  desc: t('help.closet_select_desc', { defaultValue: 'Select multiple garments to apply batch seasons, dress codes, and custom labels in seconds, or bulk delete outdated items.' })
                },
                {
                  title: t('help.closet_group_title', { defaultValue: 'Item Grouping (Single vs. Set)' }),
                  desc: t('help.closet_group_desc', { defaultValue: 'Combine individual garments into a synchronized Set (like a suit or matching dress sets) to ensure they are suggested together.' })
                },
                {
                  title: t('help.closet_edit_title', { defaultValue: 'Edit & Tags' }),
                  desc: t('help.closet_edit_desc', { defaultValue: 'Tap any garment card to open the item details, edit metadata, apply AI Vision photo repairs, and attach custom tags.' })
                },
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
                t('help.stylist_step3', { defaultValue: 'Curates complete coordinated looks styled around your preferences.' }),
                t('help.stylist_step4', { defaultValue: 'Tap any recommendation to try it on your 2D mannequin avatar.' }),
                t('help.stylist_step5', { defaultValue: 'Save looks to your Outfit Planner or Diary.' }),
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

      case 'scheduler-push':
        return (
          <View style={styles.layer1Content}>
            <Text style={[styles.introText, { color: colors.foreground }]}>
              {t('help.scheduler_push_p1', { defaultValue: 'Receive automatic, weather-appropriate style recommendations every morning:' })}
            </Text>
            <View style={styles.stepsContainer}>
              {[
                t('help.scheduler_push_step1', { defaultValue: 'Enable push notifications in your device settings.' }),
                t('help.scheduler_push_step2', { defaultValue: 'Choose your preferred delivery time in Profile settings.' }),
                t('help.scheduler_push_step3', { defaultValue: 'Optionally link your Google Calendar for occasion-aware recommendations.' }),
                t('help.scheduler_push_step4', { defaultValue: 'Tap the morning notification to open your 3 curated outfit proposals.' }),
                t('help.scheduler_push_step5', { defaultValue: 'Inspect the weather harmony score and tap to schedule your favorite look.' }),
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

      case 'profile-matters':
        return (
          <View style={styles.layer1Content}>
            <Text style={[styles.introText, { color: colors.foreground }]}>
              {t('help.profile_p1', { defaultValue: 'Your Profile personalizes every outfit recommendation, size fit, and avatar preview:' })}
            </Text>
            <View style={styles.stepsContainer}>
              {[
                {
                  title: t('help.profile_item1_title', { defaultValue: '1. Identity & Auto-Fill' }),
                  desc: t('help.profile_item1_desc', { defaultValue: 'Sync your name and contact details seamlessly with Google Sign-In.' })
                },
                {
                  title: t('help.profile_item4_title', { defaultValue: '2. Sizing & Body Measurements' }),
                  desc: t('help.profile_item4_desc', { defaultValue: 'Enter 4 key measurements (height, weight, waist, shoe) and our ANSUR II sizing predictor auto-populates 15+ retail sizes!' })
                },
                {
                  title: t('help.profile_item7_title', { defaultValue: '3. Virtual Try-On Avatar' }),
                  desc: t('help.profile_item7_desc', { defaultValue: 'Upload a real full-body photo cutout or customize your dynamic 2D vector SVG mannequin with your skin tone.' })
                },
                {
                  title: t('help.profile_item15_title', { defaultValue: '4. Voice & 13 Languages' }),
                  desc: t('help.profile_item15_desc', { defaultValue: 'Choose from 13 supported languages with natural regional speech voices and instant RTL layout mirroring.' })
                },
              ].map((item, idx) => (
                <View key={idx} style={[styles.featureCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                  <Text style={[styles.featureTitle, { color: colors.foreground }]}>{item.title}</Text>
                  <Text style={[styles.featureDesc, { color: colors.mutedFg }]}>{item.desc}</Text>
                </View>
              ))}
            </View>
          </View>
        );

      case 'wardrobe-stats':
        return (
          <View style={styles.layer1Content}>
            <Text style={[styles.introText, { color: colors.foreground }]}>
              {t('help.stats_p1', { defaultValue: 'See how much your closet is worth and which items are your favorites!' })}
            </Text>
            <View style={styles.stepsContainer}>
              {[
                t('help.stats_worth', { defaultValue: 'Closet Worth: Total financial value of all your cataloged clothing assets.' }),
                t('help.stats_util', { defaultValue: 'Closet Utilization: The percentage of clothes in your wardrobe you have worn.' }),
                t('help.stats_cpw', { defaultValue: 'Cost-Per-Wear (CPW): Price divided by wears to identify your best wardrobe investments.' }),
                t('help.stats_palette', { defaultValue: 'Color Palette: Visual breakdown of colors, fabrics, and category distributions.' }),
              ].map((text, idx) => (
                <View key={idx} style={[styles.bulletCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                  <View style={[styles.bulletDot, { backgroundColor: colors.primary }]} />
                  <Text style={[styles.bulletText, { color: colors.foreground }]}>{text}</Text>
                </View>
              ))}
            </View>
          </View>
        );

      case 'dress-up':
        return (
          <View style={styles.layer1Content}>
            <Text style={[styles.introText, { color: colors.foreground }]}>
              {t('help.planner_p1', { defaultValue: 'The Outfit Planner helps you layer, arrange, and evaluate your styling selections:' })}
            </Text>
            <View style={styles.stepsContainer}>
              {[
                {
                  title: t('help.planner_item1_title', { defaultValue: 'Outfit Canvas' }),
                  desc: t('help.planner_item1_desc', { defaultValue: 'Layer and combine clothes dynamically on your custom character avatar to build your outfit layout.' })
                },
                {
                  title: t('help.planner_item2_title', { defaultValue: 'Dual Canvas Layering' }),
                  desc: t('help.planner_item2_desc', { defaultValue: 'Use the "With / Without Outerwear" toggle to review jackets layered over shirts and the look underneath.' })
                },
                {
                  title: t('help.planner_item3_title', { defaultValue: 'Interactive Body-Mapping' }),
                  desc: t('help.planner_item3_desc', { defaultValue: 'Tap directly on any clothing item on your avatar to open its dedicated details card.' })
                },
                {
                  title: t('help.planner_item4_title', { defaultValue: 'Grading & Metrics' }),
                  desc: t('help.planner_item4_desc', { defaultValue: 'Displays progress bars grading color harmony, formality rules, and weather suitability.' })
                },
              ].map((item, idx) => (
                <View key={idx} style={[styles.featureCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                  <Text style={[styles.featureTitle, { color: colors.foreground }]}>{item.title}</Text>
                  <Text style={[styles.featureDesc, { color: colors.mutedFg }]}>{item.desc}</Text>
                </View>
              ))}
            </View>
          </View>
        );

      case 'suitcase':
        return (
          <View style={styles.layer1Content}>
            <Text style={[styles.introText, { color: colors.foreground }]}>
              {t('help.suitcase_title', { defaultValue: 'Travel Suitcase Assistant' })}
            </Text>
            <View style={styles.stepsContainer}>
              {[
                t('help.suitcase_step1', { defaultValue: 'Fill out your trip details (destination city, dates, and purpose).' }),
                t('help.suitcase_step2', { defaultValue: 'The Stylist generates a daily packing checklist matched to the forecast.' }),
                t('help.suitcase_step3', { defaultValue: 'Receives alerts if rain is forecast and reminds you of coats or umbrellas.' }),
                t('help.suitcase_step4', { defaultValue: 'Refine contents interactively in chat (e.g. "Add a formal outfit for dinner").' }),
                t('help.suitcase_step5', { defaultValue: 'Tap Approve Suitcase to save your packing list for offline travel access!' }),
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

      case 'marketplace':
        return (
          <View style={styles.layer1Content}>
            <Text style={[styles.introText, { color: colors.foreground }]}>
              {t('help.market_p1', { defaultValue: 'Share, donate, rent, or trade clothes with other users in your area!' })}
            </Text>
            <View style={styles.stepsContainer}>
              {[
                {
                  title: t('help.market_title', { defaultValue: 'Create a Listing' }),
                  desc: t('help.market_step1', { defaultValue: 'Open any closet item, select listing intent, and choose For Sale, Rent, Swap, or Donate.' })
                },
                {
                  title: t('help.market_sandbox_title', { defaultValue: 'Try-On Sandbox' }),
                  desc: t('help.market_step2', { defaultValue: 'Buyers can test-fit your listing on their avatar before deciding to swap or buy with secure PayPal payments.' })
                },
              ].map((item, idx) => (
                <View key={idx} style={[styles.featureCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                  <Text style={[styles.featureTitle, { color: colors.foreground }]}>{item.title}</Text>
                  <Text style={[styles.featureDesc, { color: colors.mutedFg }]}>{item.desc}</Text>
                </View>
              ))}
            </View>
          </View>
        );

      case 'shopping-assistant':
        return (
          <View style={styles.layer1Content}>
            <Text style={[styles.introText, { color: colors.foreground }]}>
              {t('help.shopping_assistant_p1', { defaultValue: 'Shop online with precision size comparison matched to your body measurements:' })}
            </Text>
            <View style={styles.stepsContainer}>
              {[
                t('help.shopping_assistant_step1', { defaultValue: 'Install the DressApp Shopping Assistant extension on Google Chrome.' }),
                t('help.shopping_assistant_step2', { defaultValue: 'Log in with your DressApp account credentials.' }),
                t('help.shopping_assistant_step3', { defaultValue: 'Browse supported partner fashion stores (like Zara or ASOS).' }),
                t('help.shopping_assistant_step4', { defaultValue: 'The assistant reads size charts and highlights your perfect match.' }),
                t('help.shopping_assistant_step5', { defaultValue: 'Tap Import to Closet to save a preview card of the item.' }),
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

      case 'import-wardrobe':
        return (
          <View style={styles.layer1Content}>
            <Text style={[styles.introText, { color: colors.foreground }]}>
              {t('help.import_wardrobe_p1', { defaultValue: 'Migrate your existing closet from Whering, Acloset, or Stylebook easily:' })}
            </Text>
            <View style={styles.stepsContainer}>
              {[
                t('help.import_wardrobe_step1', { defaultValue: 'Open your Profile on a computer browser and click Import Wardrobe.' }),
                t('help.import_wardrobe_step2', { defaultValue: 'Select your old wardrobe application from the list.' }),
                t('help.import_wardrobe_step3', { defaultValue: 'Drag the Share & Start Agent button to your browser bookmarks bar.' }),
                t('help.import_wardrobe_step4', { defaultValue: 'Open your old app website, log in, and click the bookmarklet.' }),
                t('help.import_wardrobe_step5', { defaultValue: 'The agent streams garment photos to DressApp in batches of 15.' }),
                t('help.import_wardrobe_step6', { defaultValue: 'Our AI removes backgrounds and fills in garment attributes automatically!' }),
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

      case 'trend-scout':
        return (
          <View style={styles.layer1Content}>
            <Text style={[styles.introText, { color: colors.foreground }]}>
              {t('help.trend_scout_p1', { defaultValue: 'Stay inspired with our daily curated fashion radar and style recommendations:' })}
            </Text>
            <View style={styles.stepsContainer}>
              {[
                {
                  title: t('help.trend_feed_title', { defaultValue: 'Daily Fashion Radar (7 Curated Channels)' }),
                  desc: t('help.trend_feed_desc', { defaultValue: 'Explore 📍 Local News, 👑 Runway, 👟 Street Style, 🌿 Sustainability, ✨ Influencers & Icons, ♻️ Vintage / Archival, and 🔧 Care & Repairs.' }),
                },
                {
                  title: t('help.trend_closet_title', { defaultValue: '1-Tap "Style with My Closet"' }),
                  desc: t('help.trend_closet_desc', { defaultValue: 'Tap the button on any trend card to let our AI Stylist match the trend\'s colors and silhouette directly to clothes already hanging in your digitized wardrobe.' }),
                },
                {
                  title: t('help.trend_personalization_title', { defaultValue: 'Personalization & Social Feeds (⚙️)' }),
                  desc: t('help.trend_personalization_desc', { defaultValue: 'Customize style aesthetics (Quiet Luxury, Vintage, Streetwear, Old Money, Minimalist, Y2K), connect social accounts, and view your automated closet profile.' }),
                },
                {
                  title: t('help.trend_gender_title', { defaultValue: 'Gender Targeting & Live Refresh' }),
                  desc: t('help.trend_gender_desc', { defaultValue: 'Toggle effortlessly between Women\'s and Men\'s fashion, read verified articles on Vogue/GQ, and tap Refresh (🔄) for instant real-time updates.' }),
                },
              ].map((item, idx) => (
                <View key={idx} style={[styles.featureCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                  <Text style={[styles.featureTitle, { color: colors.foreground }]}>{item.title}</Text>
                  <Text style={[styles.featureDesc, { color: colors.mutedFg }]}>{item.desc}</Text>
                </View>
              ))}
            </View>
          </View>
        );

      case 'experts':
        return (
          <View style={styles.layer1Content}>
            <Text style={[styles.introText, { color: colors.foreground }]}>
              {t('help.experts_p1', { defaultValue: 'Connect with real-world fashion experts directly inside DressApp:' })}
            </Text>
            <View style={styles.stepsContainer}>
              {[
                {
                  title: t('help.experts_dir_title', { defaultValue: 'Fashion Expert Directory' }),
                  desc: t('help.experts_dir_desc', { defaultValue: 'Browse a registry of certified professional stylists, fashion advisors, and wardrobe consultants.' })
                },
                {
                  title: t('help.experts_search_title', { defaultValue: 'Style Speciality Search' }),
                  desc: t('help.experts_search_desc', { defaultValue: 'Filter stylists by region, city, or specific fashion specialties.' })
                },
                {
                  title: t('help.experts_contact_title', { defaultValue: 'Direct Contact' }),
                  desc: t('help.experts_contact_desc', { defaultValue: 'Reach out via phone, email, or view their professional portfolios and websites.' })
                },
              ].map((item, idx) => (
                <View key={idx} style={[styles.featureCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                  <Text style={[styles.featureTitle, { color: colors.foreground }]}>{item.title}</Text>
                  <Text style={[styles.featureDesc, { color: colors.mutedFg }]}>{item.desc}</Text>
                </View>
              ))}
            </View>
          </View>
        );

      case 'campaigns':
        return (
          <View style={styles.layer1Content}>
            <Text style={[styles.introText, { color: colors.foreground }]}>
              {t('help.campaigns_help_p1', { defaultValue: 'Find exclusive sales, stylist events, and local fashion offers in your area:' })}
            </Text>
            <View style={styles.stepsContainer}>
              {[
                {
                  title: t('help.campaigns_feed_help_title', { defaultValue: 'Local Offers Feed' }),
                  desc: t('help.campaigns_feed_help_desc', { defaultValue: 'Browse live promotional campaigns published by verified fashion experts near your city.' })
                },
                {
                  title: t('help.campaigns_maps_help_title', { defaultValue: 'Google Maps Integration' }),
                  desc: t('help.campaigns_maps_help_desc', { defaultValue: 'Tap any offer to view its description, copy discount codes, and locate the boutique directly on Google Maps.' })
                },
                {
                  title: t('help.campaigns_save_help_title', { defaultValue: 'Save & Share Offers' }),
                  desc: t('help.campaigns_save_help_desc', { defaultValue: 'Bookmark your favorite deals to view later or share them directly with friends.' })
                },
              ].map((item, idx) => (
                <View key={idx} style={[styles.featureCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                  <Text style={[styles.featureTitle, { color: colors.foreground }]}>{item.title}</Text>
                  <Text style={[styles.featureDesc, { color: colors.mutedFg }]}>{item.desc}</Text>
                </View>
              ))}
            </View>
          </View>
        );

      case 'tiers':
        return (
          <View style={styles.layer1Content}>
            <Text style={[styles.introText, { color: colors.foreground }]}>
              {t('help.tiers_p1', { defaultValue: 'DressApp offers flexible subscription tiers tailored to your closet size and styling needs:' })}
            </Text>
            <View style={styles.stepsContainer}>
              <View style={[styles.featureCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                <Text style={[styles.featureTitle, { color: colors.foreground }]}>
                  {t('help.tiers_free_title', { defaultValue: 'Free Plan' })}
                </Text>
                <Text style={[styles.featureDesc, { color: colors.mutedFg }]}>
                  {t('help.tiers_free_desc', { defaultValue: 'Baseline limit of 150 items. Expandable up to 1,000 items by sharing your invite code with friends (+10 capacity slots per friend).' })}
                </Text>
              </View>

              <View style={[styles.featureCard, { backgroundColor: colors.primary + '15', borderColor: colors.primary }]}>
                <Text style={[styles.featureTitle, { color: colors.primary }]}>
                  {t('help.tiers_manager_title', { defaultValue: 'Manager (Pro) Plan' })}
                </Text>
                <Text style={[styles.featureDesc, { color: colors.mutedFg }]}>
                  {t('help.tiers_manager_desc', { defaultValue: 'Costs $4.99/mo. Removes closet size limits entirely, unlocks advanced stats, and provides priority processing.' })}
                </Text>
              </View>

              <View style={[styles.featureCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                <Text style={[styles.featureTitle, { color: colors.foreground }]}>
                  {t('help.tiers_how_to_upgrade_title', { defaultValue: 'How to upgrade:' })}
                </Text>
                <Text style={[styles.featureDesc, { color: colors.mutedFg }]}>
                  {t('help.tiers_step1', { defaultValue: 'Go to your Profile settings' })} &rarr; {t('help.tiers_step3', { defaultValue: 'Tap Upgrade to Pro' })} &rarr; {t('help.tiers_step4', { defaultValue: 'Complete checkout securely via PayPal or Bit.' })}
                </Text>
              </View>
            </View>
          </View>
        );

      case 'troubleshooting':
        return (
          <View style={styles.layer1Content}>
            <Text style={[styles.introText, { color: colors.foreground }]}>
              {t('help.trouble_title', { defaultValue: 'Troubleshooting (Easy Solutions!)' })}
            </Text>
            <View style={styles.stepsContainer}>
              <View style={[styles.featureCard, { backgroundColor: '#fef3c720', borderColor: '#f59e0b' }]}>
                <Text style={[styles.featureTitle, { color: '#d97706' }]}>
                  {t('help.trouble_full_q', { defaultValue: 'Help! My closet is full and I cannot add more clothes!' })}
                </Text>
                <Text style={[styles.featureDesc, { color: colors.mutedFg, marginTop: 4 }]}>
                  {t('help.trouble_full_fix', { defaultValue: 'Free accounts hold 150 items. Invite a friend for +10 bonus slots or upgrade to Pro for unlimited storage.' })}
                </Text>
              </View>

              <View style={[styles.featureCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                <Text style={[styles.featureTitle, { color: colors.foreground }]}>
                  {t('help.trouble_cam_q', { defaultValue: 'My camera will not turn on!' })}
                </Text>
                <Text style={[styles.featureDesc, { color: colors.mutedFg, marginTop: 4 }]}>
                  {t('help.trouble_cam_fix', { defaultValue: 'Go to device settings, find DressApp, and enable Camera permissions.' })}
                </Text>
              </View>

              <View style={[styles.featureCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                <Text style={[styles.featureTitle, { color: colors.foreground }]}>
                  {t('help.trouble_slow_q', { defaultValue: 'Processing pictures takes a moment' })}
                </Text>
                <Text style={[styles.featureDesc, { color: colors.mutedFg, marginTop: 4 }]}>
                  {t('help.trouble_slow_fix', { defaultValue: 'The AI processes images sequentially in the background. You can keep browsing the app while they finish!' })}
                </Text>
              </View>
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
                { backgroundColor: colors.secondary, borderColor: colors.primary },
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
  bulletCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, padding: spacing.md, borderRadius: radii.xl, borderWidth: 1 },
  bulletDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  bulletText: { flex: 1, fontFamily: fonts.body, fontSize: fontSizes.xs + 1, lineHeight: 18 },
  footerRow: { marginTop: spacing.sm, paddingTop: spacing.sm },
  learnMoreBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: spacing.xs },
  learnMoreText: { fontFamily: fonts.bodyBold, fontSize: fontSizes.sm },
  guideContainer: { gap: spacing.md },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, borderRadius: radii.full, borderWidth: 1 },
  backBtnText: { fontFamily: fonts.bodyBold, fontSize: fontSizes.xs },
  loadingBox: { padding: spacing['2xl'], alignItems: 'center', gap: spacing.sm },
  loadingText: { fontFamily: fonts.body, fontSize: fontSizes.xs },
});