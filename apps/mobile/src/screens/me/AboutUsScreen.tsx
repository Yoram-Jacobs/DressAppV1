/**
 * apps/mobile/src/screens/me/AboutUsScreen.tsx
 *
 * About Us Screen for DressApp Mobile — 100% parity with Web AboutUs.jsx.
 * Adheres strictly to DIRECTIVE_UI_DESIGN_AND_BRANDING.md:
 *   - Editorial Boutique Magazine & Quiet-Luxury Minimal aesthetic
 *   - Zero purple/indigo on AI surfaces (Ocean Teal #1F6F6B / Emerald #1F5C45 + Persimmon #E8603C accents)
 *   - Three authentic editorial photos of founder Yoram Jacobs
 *   - Concealed internal tech stack (focus on capabilities and values)
 *   - All 10 Garment Lifecycle ecosystem pillars
 *   - 6 Core manifesto principles
 *   - Personal letter from Yoram Jacobs
 *   - Direct founder outreach channel (dev@dressapp.co)
 *   - Full RTL support and 13-language i18next translation with fallbacks
 */

import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  Linking,
  I18nManager,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import * as Lucide from 'lucide-react-native';

import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii, shadows } from '@mobile/theme/tokens';

const YORAM_PORTRAIT = require('../../../assets/about/yoram-portrait.jpg');
const YORAM_SOUND_CONSOLE = require('../../../assets/about/yoram-sound-console.jpg');
const YORAM_STUDIO_CODE = require('../../../assets/about/yoram-studio-code.jpg');

export function AboutUsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<any>();

  const BackIcon = I18nManager.isRTL ? Lucide.ArrowRight : Lucide.ArrowLeft;
  const isRTL = I18nManager.isRTL;
  const alignStyle = { textAlign: isRTL ? 'right' : 'left' } as const;

  const ecosystemFeatures = [
    {
      id: 'eyes',
      icon: Lucide.Camera,
      title: t('about.feature1_title', { defaultValue: 'Zero-Friction Digitization ("The Eyes")' }),
      desc: t('about.feature1_desc', {
        defaultValue:
          'Snapshot clothes on your bed or rack. Our neural vision engine segments items, creates clean transparent cutouts, and extracts 20+ fine-grained attributes automatically.',
      }),
      tag: t('about.feature1_tag', { defaultValue: 'Computer Vision' }),
    },
    {
      id: 'migration',
      icon: Lucide.RefreshCw,
      title: t('about.feature2_title', { defaultValue: 'One-Click Wardrobe Migration' }),
      desc: t('about.feature2_desc', {
        defaultValue:
          'Liberate your closet from competitor app silos in 30 seconds. Our screen-harvesting bookmarklet streams your existing wardrobe into DressApp with zero manual re-entry.',
      }),
      tag: t('about.feature2_tag', { defaultValue: 'Zero Lock-In' }),
    },
    {
      id: 'avatar',
      icon: Lucide.Layers,
      title: t('about.feature3_title', { defaultValue: 'Dynamic Avatar & Virtual Try-On' }),
      desc: t('about.feature3_desc', {
        defaultValue:
          'Preview outfits layered on an adaptive 2D vector mannequin calibrated to your exact physical metrics—or directly on a segmented cutout of your real-body photo.',
      }),
      tag: t('about.feature3_tag', { defaultValue: 'Anatomical Precision' }),
    },
    {
      id: 'stylist',
      icon: Lucide.Sparkles,
      title: t('about.feature4_title', { defaultValue: 'Context-Aware AI Stylist' }),
      desc: t('about.feature4_desc', {
        defaultValue:
          'Conversational styling via voice or text grounded in your actual physical wardrobe, real-time local weather forecasts, and calendar appointments.',
      }),
      tag: t('about.feature4_tag', { defaultValue: 'Daily Confidant' }),
    },
    {
      id: 'scheduler',
      icon: Lucide.Calendar,
      title: t('about.feature5_title', { defaultValue: 'Scheduled Outfits & Wardrobe Diary' }),
      desc: t('about.feature5_desc', {
        defaultValue:
          'Plan looks days or weeks in advance. Receive tailored morning push notifications with your scheduled look while rotating unworn items to prevent repeat wear.',
      }),
      tag: t('about.feature5_tag', { defaultValue: 'Zero Morning Fatigue' }),
    },
    {
      id: 'shopping',
      icon: Lucide.ShoppingBag,
      title: t('about.feature6_title', { defaultValue: 'Smart Shopping Assistant' }),
      desc: t('about.feature6_desc', {
        defaultValue:
          'Desktop extension and mobile bookmarklet that scans product size charts across e-commerce storefronts, delivering instant personalized size confidence before you buy.',
      }),
      tag: t('about.feature6_tag', { defaultValue: 'Browser Intelligence' }),
    },
    {
      id: 'insights',
      icon: Lucide.TrendingUp,
      title: t('about.feature7_title', { defaultValue: 'Wardrobe Insights & Cost-Per-Wear' }),
      desc: t('about.feature7_desc', {
        defaultValue:
          'Illuminate hidden capital in your closet. Track wear frequency, garment capitalization, and true cost-per-wear to make conscious, sustainable fashion decisions.',
      }),
      tag: t('about.feature7_tag', { defaultValue: 'Wardrobe Analytics' }),
    },
    {
      id: 'suitcase',
      icon: Lucide.Briefcase,
      title: t('about.feature8_title', { defaultValue: 'Intelligent Suitcase Packing' }),
      desc: t('about.feature8_desc', {
        defaultValue:
          'AI-curated travel capsules mapped to your destination weather and itinerary. Never overpack or forget critical pieces on your trips again.',
      }),
      tag: t('about.feature8_tag', { defaultValue: 'Travel Companion' }),
    },
    {
      id: 'marketplace',
      icon: Lucide.Compass,
      title: t('about.feature9_title', { defaultValue: 'Circular Marketplace: Swap, Sell, Donate' }),
      desc: t('about.feature9_desc', {
        defaultValue:
          'Extend garment lifespans through community swapping, resale, and donation workflows designed to divert pre-loved textiles from landfills.',
      }),
      tag: t('about.feature9_tag', { defaultValue: 'Circular Economy' }),
    },
    {
      id: 'experts',
      icon: Lucide.UserCheck,
      title: t('about.feature10_title', { defaultValue: 'Certified Experts Registry' }),
      desc: t('about.feature10_desc', {
        defaultValue:
          'Seamlessly connect with vetted human fashion stylists, bespoke tailors, repair artisans, and custom patternmakers to preserve and elevate your clothes.',
      }),
      tag: t('about.feature10_tag', { defaultValue: 'Human Craftsmanship' }),
    },
  ];

  const values = [
    {
      title: t('about.val1_title', { defaultValue: 'Shop Your Closet First' }),
      desc: t('about.val1_desc', {
        defaultValue:
          'The most sustainable and stylish garment in the world is the one already hanging in your closet. We maximize what you own before suggesting anything new.',
      }),
    },
    {
      title: t('about.val2_title', { defaultValue: 'Zero Lock-In & Open Ecosystem' }),
      desc: t('about.val2_desc', {
        defaultValue:
          'You own your wardrobe data. Liberate your closet from competitor silos in 30 seconds and bring your sizing intelligence across the open web.',
      }),
    },
    {
      title: t('about.val3_title', { defaultValue: 'Editorial Boutique & Quiet Luxury' }),
      desc: t('about.val3_desc', {
        defaultValue:
          'Clean typography, generous whitespace, tactile surfaces, and zero digital clutter. An experience that feels like an art-directed luxury magazine.',
      }),
    },
    {
      title: t('about.val4_title', { defaultValue: 'Sovereign Privacy by Design' }),
      desc: t('about.val4_desc', {
        defaultValue:
          'Your wardrobe is deeply personal. We never sell your photos or styling history to advertisers. Built with private sovereign AI architecture.',
      }),
    },
    {
      title: t('about.val5_title', { defaultValue: 'Circular by Design' }),
      desc: t('about.val5_desc', {
        defaultValue:
          'Fashion should never be disposable. We champion the EU Digital Product Passport (DPP), repairability, mindful reuse, and community garment exchange.',
      }),
    },
    {
      title: t('about.val6_title', { defaultValue: 'Universal Inclusivity' }),
      desc: t('about.val6_desc', {
        defaultValue:
          'True style belongs to everyone. DressApp supports 13 localized languages (including full native RTL for Hebrew and Arabic) and universal body sizing without bias.',
      }),
    },
  ];

  const handleContactFounder = () => {
    Linking.openURL('mailto:dev@dressapp.co');
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Top Navigation Bar */}
      <View style={[styles.topBar, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityLabel={t('common.back', { defaultValue: 'Back' })}
        >
          <BackIcon size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: colors.foreground }]}>
          {t('about.title', { defaultValue: 'About Us' })}
        </Text>
        <View style={styles.topBarRightSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* HERO SECTION */}
        <View style={styles.heroSection}>
          <View style={[styles.capsuleBadge, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <Text style={[styles.capsuleBadgeText, { color: colors.foreground }]}>
              {t('about.hero_badge', { defaultValue: 'THE DRESSAPP STORY' })}
            </Text>
          </View>

          <Text style={[styles.heroTitle, { color: colors.foreground }, alignStyle]}>
            {t('about.hero_title_prefix', { defaultValue: 'Engineering Confidence' })}{' '}
            <Text style={{ color: colors.primary }}>
              {t('about.hero_title_highlight', { defaultValue: 'From the Inside Out' })}
            </Text>
          </Text>

          <Text style={[styles.heroSubtitle, { color: colors.mutedFg }, alignStyle]}>
            {t('about.hero_subtitle', {
              defaultValue:
                'How an arena sound engineer and lighting designer turned a New Year’s wardrobe crisis into an intelligent, circular fashion ecosystem.',
            })}
          </Text>

          {/* Pull Quote Box */}
          <View style={[styles.quoteCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.quoteCardAccentLine, { backgroundColor: colors.primary }]} />
            <Text style={[styles.quoteText, { color: colors.foreground }, alignStyle]}>
              &ldquo;{t('about.hero_quote', {
                defaultValue:
                  'I can tune an arena sound system by ear and paint an entire stage with light. But on New Year’s Eve 2019, standing in front of my own wardrobe, I was completely lost.',
              })}&rdquo;
            </Text>
            <View style={styles.quoteAuthorRow}>
              <View style={[styles.quoteAvatarBadge, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                <Lucide.Sliders size={16} color={colors.primary} />
              </View>
              <View>
                <Text style={[styles.quoteAuthorName, { color: colors.foreground }]}>Yoram Jacobs</Text>
                <Text style={[styles.quoteAuthorTitle, { color: colors.mutedFg }]}>
                  {t('about.founder_title', { defaultValue: 'Founder & Chief Architect, DressApp' })}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* SECTION 1: THE GENESIS & PORTRAIT */}
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionCapsLabel, { color: colors.primary }, alignStyle]}>
            {t('about.genesis_label', { defaultValue: 'DECEMBER 31, 2019' })}
          </Text>
          <Text style={[styles.sectionTitle, { color: colors.foreground }, alignStyle]}>
            {t('about.genesis_title', { defaultValue: 'The Night That Started It All' })}
          </Text>

          <View style={[styles.imageCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Image
              source={YORAM_PORTRAIT}
              style={styles.portraitImage}
              resizeMode="cover"
            />
            <View style={[styles.imageCaptionBar, { borderTopColor: colors.border }]}>
              <View>
                <Text style={[styles.imageCaptionName, { color: colors.foreground }]}>Yoram Jacobs</Text>
                <Text style={[styles.imageCaptionSub, { color: colors.mutedFg }]}>
                  {t('about.portrait_sub', { defaultValue: 'Founder & Chief Architect (Age 59)' })}
                </Text>
              </View>
              <View style={[styles.inlineBadge, { backgroundColor: colors.secondary }]}>
                <Text style={[styles.inlineBadgeText, { color: colors.foreground }]}>
                  {t('about.founder_badge', { defaultValue: 'Creator' })}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.narrativeBlock}>
            <Text style={[styles.narrativeParagraph, { color: colors.mutedFg }, alignStyle]}>
              {t('about.genesis_p1', {
                defaultValue:
                  'The world was getting ready to welcome 2020, and Yoram Jacobs was standing paralyzed in front of an open closet. Like millions of people every single morning, he was gripped by that quiet, exasperating dilemma: a wardrobe full of clothes, and absolutely nothing to wear.',
              })}
            </Text>
            <Text style={[styles.narrativeParagraph, { color: colors.mutedFg }, alignStyle]}>
              {t('about.genesis_p2', {
                defaultValue:
                  'He pulled out his phone searching for an app that could look at what he already owned, consider the party dress code, and tell him what worked. Nothing existed—only fast-fashion stores trying to sell more throwaway clothes, and runway moodboards of garments he didn\'t own.',
              })}
            </Text>
            <Text style={[styles.narrativeParagraph, { color: colors.mutedFg }, alignStyle]}>
              {t('about.genesis_p3', {
                defaultValue:
                  'With time running out, he threw on the safest default he knew: a basic t-shirt, jeans, and sneakers. Walking into the party, the realization was instant. Everyone was dressed with elegance and intention. Yoram felt noticeably out of place, uncomfortable in his own skin.',
              })}
            </Text>
            <Text style={[styles.narrativeParagraphBold, { color: colors.foreground }, alignStyle]}>
              {t('about.genesis_p4', {
                defaultValue:
                  'For most people, that night would be forgotten as an awkward social memory. For Yoram, it became an obsession.',
              })}
            </Text>
          </View>
        </View>

        {/* SECTION 2: THE FOUNDER'S PARADOX & LIVE AUDIO CONSOLE */}
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionCapsLabel, { color: colors.primary }, alignStyle]}>
            {t('about.paradox_label', { defaultValue: 'ACOUSTICS, LIGHT & FABRIC' })}
          </Text>
          <Text style={[styles.sectionTitle, { color: colors.foreground }, alignStyle]}>
            {t('about.paradox_title', { defaultValue: 'The Founder’s Paradox' })}
          </Text>

          <View style={[styles.imageCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Image
              source={YORAM_SOUND_CONSOLE}
              style={styles.landscapeImage}
              resizeMode="cover"
            />
            <View style={[styles.imageCaptionBar, { borderTopColor: colors.border }]}>
              <Lucide.Volume2 size={16} color={colors.primary} style={{ marginEnd: 8 }} />
              <Text style={[styles.imageCaptionSub, { color: colors.mutedFg, flex: 1 }]}>
                {t('about.sound_caption', {
                  defaultValue:
                    'Yoram behind the live faders: decades of engineering acoustics, room frequencies, and stage luminescence.',
                })}
              </Text>
            </View>
          </View>

          <View style={styles.narrativeBlock}>
            <Text style={[styles.narrativeParagraph, { color: colors.mutedFg }, alignStyle]}>
              {t('about.paradox_p1', {
                defaultValue:
                  'Yoram is not a fashion house insider. At 59, he brings decades of rigorous technical mastery as an acoustic sound engineer, multimedia specialist, and lighting designer. He spent his career working with invisible physical frequencies—sculpting room reverberation, synchronizing signals, and shaping atmospheres with stage luminescence.',
              })}
            </Text>
            <Text style={[styles.narrativeParagraph, { color: colors.mutedFg }, alignStyle]}>
              {t('about.paradox_p2', {
                defaultValue:
                  'Yet when it came to fabrics, garment drape, color pairings, and silhouette matching, he experienced total sartorial friction. That contradiction triggered a foundational realization:',
              })}
            </Text>

            <View style={[styles.highlightCallout, { backgroundColor: colors.secondary, borderLeftColor: colors.primary }]}>
              <Text style={[styles.highlightCalloutText, { color: colors.foreground }, alignStyle]}>
                &ldquo;{t('about.paradox_quote', {
                  defaultValue:
                    'Style is not a secret genetic gift reserved for the elite—it is a harmony problem. Just like frequencies in an acoustic hall, an outfit is an interplay of texture, contrast, geometry, and context. You simply need the right instrument.',
                })}&rdquo;
              </Text>
            </View>
          </View>
        </View>

        {/* SECTION 3: THE SIX-YEAR WAIT & STUDIO CONVERGENCE */}
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionCapsLabel, { color: colors.primary }, alignStyle]}>
            {t('about.wait_label', { defaultValue: '2019 TO 2026' })}
          </Text>
          <Text style={[styles.sectionTitle, { color: colors.foreground }, alignStyle]}>
            {t('about.wait_title', { defaultValue: 'Why 2020 Had to Wait for 2026' })}
          </Text>

          <View style={[styles.imageCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Image
              source={YORAM_STUDIO_CODE}
              style={styles.landscapeImage}
              resizeMode="cover"
            />
            <View style={[styles.imageCaptionBar, { borderTopColor: colors.border }]}>
              <Lucide.Sliders size={16} color={colors.primary} style={{ marginEnd: 8 }} />
              <Text style={[styles.imageCaptionSub, { color: colors.mutedFg, flex: 1 }]}>
                {t('about.studio_caption', {
                  defaultValue:
                    'The studio workstation: mixing board behind, code in front. Where acoustic precision converged with modern AI.',
                })}
              </Text>
            </View>
          </View>

          <View style={styles.narrativeBlock}>
            <Text style={[styles.narrativeParagraph, { color: colors.mutedFg }, alignStyle]}>
              {t('about.wait_p1', {
                defaultValue:
                  'The vision was crystal clear in early 2020, but the technology was not ready. Early computer vision could not handle folded garments, natural language models were rigid rule-trees, and mobile hardware could not process real-time matting. Yoram refused to build a superficial gimmick.',
              })}
            </Text>
            <Text style={[styles.narrativeParagraph, { color: colors.mutedFg }, alignStyle]}>
              {t('about.wait_p2', {
                defaultValue:
                  'For six years, he experimented, tested emerging vision models, and refined the mathematics of wardrobe organization. Finally, in 2026, the breakthrough arrived: ultra-responsive multimodal artificial intelligence, real-time semantic garment segmentation, and sovereign private AI pipelines.',
              })}
            </Text>
            <Text style={[styles.narrativeParagraph, { color: colors.mutedFg }, alignStyle]}>
              {t('about.wait_p3', {
                defaultValue:
                  'In April 2026, Yoram sat down at his desk inside the studio and began building. Every line of code—from the neural vision pipelines to the fluid responsive web experience and mobile app—was crafted directly by his own hands as a one-man enterprise.',
              })}
            </Text>

            <View style={styles.metaBadgeRow}>
              <View style={[styles.solidBadge, { backgroundColor: colors.primary }]}>
                <Text style={styles.solidBadgeText}>
                  {t('about.v1_release', { defaultValue: 'Version 1.0 Launched: September 2026' })}
                </Text>
              </View>
              <Text style={[styles.metaBadgeSub, { color: colors.mutedFg }]}>
                {t('about.solo_note', { defaultValue: '100% Sovereign & Independent' })}
              </Text>
            </View>
          </View>
        </View>

        {/* SECTION 4: THE 10 ECOSYSTEM PILLARS */}
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionCapsLabel, { color: colors.primary }, alignStyle]}>
            {t('about.ecosystem_label', { defaultValue: 'THE ARCHITECTURE' })}
          </Text>
          <Text style={[styles.sectionTitle, { color: colors.foreground }, alignStyle]}>
            {t('about.ecosystem_title', { defaultValue: 'A Complete Garment Lifecycle Ecosystem' })}
          </Text>
          <Text style={[styles.sectionSubtitle, { color: colors.mutedFg }, alignStyle]}>
            {t('about.ecosystem_subtitle', {
              defaultValue:
                'DressApp is not another fast-fashion store. It is an intelligent operating system designed to elevate the clothes you already own.',
            })}
          </Text>

          <View style={styles.cardsGrid}>
            {ecosystemFeatures.map((feat) => {
              const IconComponent = feat.icon;
              return (
                <View
                  key={feat.id}
                  style={[styles.featureCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <View style={styles.featureCardHeader}>
                    <View style={[styles.featureIconBox, { backgroundColor: colors.secondary }]}>
                      <IconComponent size={20} color={colors.primary} />
                    </View>
                    <View style={[styles.featureTagBadge, { backgroundColor: colors.secondary }]}>
                      <Text style={[styles.featureTagText, { color: colors.mutedFg }]}>{feat.tag}</Text>
                    </View>
                  </View>
                  <Text style={[styles.featureTitle, { color: colors.foreground }, alignStyle]}>
                    {feat.title}
                  </Text>
                  <Text style={[styles.featureDesc, { color: colors.mutedFg }, alignStyle]}>
                    {feat.desc}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* SECTION 5: MANIFESTO VALUES */}
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionCapsLabel, { color: colors.primary }, alignStyle]}>
            {t('about.values_label', { defaultValue: 'OUR MANIFESTO' })}
          </Text>
          <Text style={[styles.sectionTitle, { color: colors.foreground }, alignStyle]}>
            {t('about.values_title', { defaultValue: 'Principles We Live By' })}
          </Text>
          <Text style={[styles.sectionSubtitle, { color: colors.mutedFg }, alignStyle]}>
            {t('about.values_subtitle', {
              defaultValue:
                'Every feature and line of code is held accountable to six core human and environmental commitments.',
            })}
          </Text>

          <View style={styles.valuesList}>
            {values.map((val, idx) => (
              <View
                key={idx}
                style={[styles.valueCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={styles.valueTitleRow}>
                  <Lucide.CheckCircle2 size={18} color={colors.primary} style={{ marginEnd: 8 }} />
                  <Text style={[styles.valueTitle, { color: colors.foreground }]}>{val.title}</Text>
                </View>
                <Text style={[styles.valueDesc, { color: colors.mutedFg }, alignStyle]}>{val.desc}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* SECTION 6: PERSONAL LETTER FROM YORAM */}
        <View style={styles.sectionContainer}>
          <View style={[styles.letterCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.letterTopStripe, { backgroundColor: colors.primary }]} />
            <Text style={[styles.sectionCapsLabel, { color: colors.primary }, alignStyle]}>
              {t('about.letter_label', { defaultValue: "FROM YORAM'S DESK" })}
            </Text>
            <Text style={[styles.letterHeadline, { color: colors.foreground }, alignStyle]}>
              {t('about.letter_title', { defaultValue: 'A Personal Note to You' })}
            </Text>

            <View style={styles.letterBody}>
              <Text style={[styles.letterParagraph, { color: colors.foreground }, alignStyle]}>
                &ldquo;{t('about.letter_p1', {
                  defaultValue:
                    'To anyone who has ever stood in front of their closet feeling inadequate, stressed, or unsure:',
                })}&rdquo;
              </Text>
              <Text style={[styles.letterParagraph, { color: colors.foreground }, alignStyle]}>
                &ldquo;{t('about.letter_p2', {
                  defaultValue:
                    'I built DressApp for you, because I was you. For years, I believed having great personal style was a genetic lottery I simply didn\'t win. I was wrong. Style isn\'t about chasing frantic trends or buying an endless stream of cheap clothes—it\'s about knowing what you have, understanding how it harmonizes with who you are, and walking out the door every morning feeling calm, composed, and undeniably confident.',
                })}&rdquo;
              </Text>
              <Text style={[styles.letterParagraph, { color: colors.foreground }, alignStyle]}>
                &ldquo;{t('about.letter_p3', {
                  defaultValue:
                    'DressApp is my life\'s technical and creative synthesis: merging the rigor of acoustic and lighting design with the quiet genius of modern AI. I hope it brings ease and delight to your mornings, just as it has to mine.',
                })}&rdquo;
              </Text>
            </View>

            <View style={[styles.letterSignRow, { borderTopColor: colors.border }]}>
              <View>
                <Text style={[styles.letterSignName, { color: colors.foreground }]}>Yoram Jacobs</Text>
                <Text style={[styles.letterSignRole, { color: colors.mutedFg }]}>
                  {t('about.letter_sign_role', { defaultValue: 'Founder & Chief Architect, DressApp' })}
                </Text>
              </View>
              <View style={[styles.verifiedBadge, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                <Text style={[styles.verifiedBadgeText, { color: colors.foreground }]}>
                  {t('about.verified_founder', { defaultValue: 'Verified Founder' })}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* SECTION 7: DIRECT FOUNDER OUTREACH & METRICS */}
        <View style={[styles.factsBox, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <Text style={[styles.sectionCapsLabel, { color: colors.primary }, alignStyle]}>
            {t('about.facts_label', { defaultValue: 'COMPANY & OPERATIONS' })}
          </Text>
          <Text style={[styles.factsTitle, { color: colors.foreground }, alignStyle]}>
            {t('about.facts_title', { defaultValue: 'Direct Founder Channel' })}
          </Text>
          <Text style={[styles.factsSubtitle, { color: colors.mutedFg }, alignStyle]}>
            {t('about.facts_subtitle', {
              defaultValue:
                'DressApp is a sovereign, one-man enterprise headquartered in the global cloud. Have a technical question, press inquiry, or feedback?',
            })}
          </Text>

          <TouchableOpacity
            style={[styles.contactButton, { backgroundColor: colors.primary }]}
            onPress={handleContactFounder}
            activeOpacity={0.85}
          >
            <Lucide.Mail size={18} color="#FFFFFF" style={{ marginEnd: 8 }} />
            <Text style={styles.contactButtonText}>dev@dressapp.co</Text>
          </TouchableOpacity>

          <View style={[styles.factsGrid, { borderTopColor: colors.border }]}>
            <View style={styles.factCol}>
              <Text style={[styles.factColLabel, { color: colors.mutedFg }]}>
                {t('about.fact1_label', { defaultValue: 'Origin' })}
              </Text>
              <Text style={[styles.factColVal, { color: colors.foreground }]}>Dec 2019</Text>
            </View>
            <View style={styles.factCol}>
              <Text style={[styles.factColLabel, { color: colors.mutedFg }]}>
                {t('about.fact2_label', { defaultValue: 'Inception' })}
              </Text>
              <Text style={[styles.factColVal, { color: colors.foreground }]}>Apr 2026</Text>
            </View>
            <View style={styles.factCol}>
              <Text style={[styles.factColLabel, { color: colors.mutedFg }]}>
                {t('about.fact3_label', { defaultValue: 'Version 1.0' })}
              </Text>
              <Text style={[styles.factColVal, { color: colors.foreground }]}>Sep 2026</Text>
            </View>
            <View style={styles.factCol}>
              <Text style={[styles.factColLabel, { color: colors.mutedFg }]}>
                {t('about.fact4_label', { defaultValue: 'Ecosystem' })}
              </Text>
              <Text style={[styles.factColVal, { color: colors.foreground }]}>Web • Mobile</Text>
            </View>
          </View>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  topBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    fontFamily: fonts.displayBold,
    fontSize: fontSizes.lg,
    fontWeight: '700',
  },
  topBarRightSpacer: {
    width: 40,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing['2xl'],
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  capsuleBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  capsuleBadgeText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.xs,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontFamily: fonts.displayBold,
    fontSize: fontSizes['3xl'],
    lineHeight: 38,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  heroSubtitle: {
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  quoteCard: {
    width: '100%',
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  quoteCardAccentLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 4,
  },
  quoteText: {
    fontFamily: fonts.displayItalic,
    fontSize: fontSizes.base,
    lineHeight: 24,
    fontStyle: 'italic',
    marginBottom: spacing.md,
    paddingLeft: spacing.xs,
  },
  quoteAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: spacing.xs,
  },
  quoteAvatarBadge: {
    width: 32,
    height: 32,
    borderRadius: radii.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginEnd: spacing.sm,
  },
  quoteAuthorName: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.sm,
    fontWeight: '700',
  },
  quoteAuthorTitle: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
  },
  sectionContainer: {
    marginBottom: spacing.xl,
  },
  sectionCapsLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.xs,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    fontFamily: fonts.displayBold,
    fontSize: fontSizes['2xl'],
    lineHeight: 30,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  sectionSubtitle: {
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  imageCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  portraitImage: {
    width: '100%',
    height: 340,
  },
  landscapeImage: {
    width: '100%',
    height: 220,
  },
  imageCaptionBar: {
    padding: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  imageCaptionName: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.sm,
    fontWeight: '700',
  },
  imageCaptionSub: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    marginTop: 2,
  },
  inlineBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  inlineBadgeText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  narrativeBlock: {
    gap: spacing.sm,
  },
  narrativeParagraph: {
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    lineHeight: 24,
  },
  narrativeParagraphBold: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.base,
    lineHeight: 24,
    fontWeight: '600',
  },
  highlightCallout: {
    padding: spacing.md,
    borderRadius: radii.md,
    borderLeftWidth: 4,
    marginVertical: spacing.xs,
  },
  highlightCalloutText: {
    fontFamily: fonts.displayItalic,
    fontSize: fontSizes.base,
    lineHeight: 24,
    fontStyle: 'italic',
  },
  metaBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  solidBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
  },
  solidBadgeText: {
    color: '#FFFFFF',
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.xs,
    fontWeight: '600',
  },
  metaBadgeSub: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
  },
  cardsGrid: {
    gap: spacing.md,
  },
  featureCard: {
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  featureCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  featureIconBox: {
    width: 38,
    height: 38,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTagBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  featureTagText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  featureTitle: {
    fontFamily: fonts.displayBold,
    fontSize: fontSizes.md,
    lineHeight: 22,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  featureDesc: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    lineHeight: 20,
  },
  valuesList: {
    gap: spacing.sm,
  },
  valueCard: {
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  valueTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  valueTitle: {
    fontFamily: fonts.displayBold,
    fontSize: fontSizes.base,
    fontWeight: '700',
    flex: 1,
  },
  valueDesc: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    lineHeight: 20,
    paddingLeft: 26,
  },
  letterCard: {
    padding: spacing.lg,
    borderRadius: radii.xl,
    borderWidth: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  letterTopStripe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  letterHeadline: {
    fontFamily: fonts.displayBold,
    fontSize: fontSizes['2xl'],
    lineHeight: 28,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  letterBody: {
    gap: spacing.md,
  },
  letterParagraph: {
    fontFamily: fonts.displayItalic,
    fontSize: fontSizes.base,
    lineHeight: 24,
    fontStyle: 'italic',
  },
  letterSignRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
    marginTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  letterSignName: {
    fontFamily: fonts.displayBold,
    fontSize: fontSizes.base,
    fontWeight: '700',
  },
  letterSignRole: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    marginTop: 2,
  },
  verifiedBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  verifiedBadgeText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  factsBox: {
    padding: spacing.lg,
    borderRadius: radii.xl,
    borderWidth: 1,
  },
  factsTitle: {
    fontFamily: fonts.displayBold,
    fontSize: fontSizes.xl,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  factsSubtitle: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    alignSelf: 'flex-start',
    marginBottom: spacing.lg,
  },
  contactButtonText: {
    color: '#FFFFFF',
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.base,
    fontWeight: '700',
  },
  factsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
  },
  factCol: {
    flex: 1,
    minWidth: 70,
  },
  factColLabel: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    marginBottom: 2,
  },
  factColVal: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.sm,
    fontWeight: '700',
  },
  bottomSpacer: {
    height: spacing.xl,
  },
});
