/**
 * apps/mobile/src/screens/me/ProfileScreen.tsx
 *
 * Full-featured Profile & Settings Screen.
 * Complete parity with apps/web/src/pages/Profile.jsx and components/profile/*:
 *   - User Profile Banner with Face Photo Avatar, Membership & Credits Pill
 *   - 13-Language native selector with instant i18n switching
 *   - Full Accordion Suite:
 *       1. Identity & Demographics (with Marital Status)
 *       2. Hair & Grooming (Length, Type, Color, Style)
 *       3. Avatar & Virtual Fitting (Face Photo, Full-body Photo, Skin Tone, Live Render)
 *       4. Body Measurements & Sizing (cm/in toggle, full fields, smart calculation)
 *       5. Style Profile & Fashion Aesthetics
 *       6. AI Stylist & Model Settings (Gemini, Claude, GPT, TTS Voice, API Keys)
 *       7. Outfit Scheduler (Custom Delivery Time, Frequency, Style, Dress for Demands)
 *       8. Google Calendar Sync
 *       9. Location Services
 *       10. Professional Directory (Profession, Business details, Description, Booking)
 *       11. Payout Accounts (PayPal)
 *       12. Campaign Notifications (Frequency, Radius, Channels)
 *       13. Invite Friends (Native share sheet & referral link)
 *       14. Import Wardrobe (Multi-platform catalog migration)
 *       15. Subscription & AI Credits
 *       16. AI Shopping Assistant
 *       17. Developer Panel & Cache Purging
 *   - Sign out & Delete Account flows
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  I18nManager,
  Modal,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import * as Lucide from 'lucide-react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii } from '@mobile/theme/tokens';
import { api, tokenStore, emitAuthChange } from '@mobile/lib/api';
import { closetStore, closetRepo } from '@mobile/lib/stores/closetStore';
import { applyRtl } from '@mobile/lib/rtl';
import { HelpFloater } from '@mobile/components/help';
import type { MeStackParamList } from '@mobile/navigation/types';

import {
  DemographicsSection,
  MeasurementsSection,
  StyleProfileSection,
  HairSection,
  AIConfiguration,
  SchedulerSettings,
  CalendarConnect,
  LocationCard,
  PayoutsSection,
  CampaignNotificationsSection,
  InviteFriendsSection,
  ImportWardrobeSection,
  SubscriptionSettings,
  ShoppingAssistant,
  ProfessionalSection,
  DeveloperPanel,
  AvatarSection,
} from '@mobile/components/profile';

type MeNavProp = NativeStackNavigationProp<MeStackParamList, 'Profile'>;

export const SUPPORTED_LANGUAGES = [
  { code: 'en', nativeName: 'English', englishName: 'English' },
  { code: 'he', nativeName: 'עברית', englishName: 'Hebrew' },
  { code: 'ar', nativeName: 'العربية', englishName: 'Arabic' },
  { code: 'es', nativeName: 'Español', englishName: 'Spanish' },
  { code: 'fr', nativeName: 'Français', englishName: 'French' },
  { code: 'de', nativeName: 'Deutsch', englishName: 'German' },
  { code: 'it', nativeName: 'Italiano', englishName: 'Italian' },
  { code: 'pt', nativeName: 'Português', englishName: 'Portuguese' },
  { code: 'ru', nativeName: 'Русский', englishName: 'Russian' },
  { code: 'zh', nativeName: '中文', englishName: 'Chinese' },
  { code: 'ja', nativeName: '日本語', englishName: 'Japanese' },
  { code: 'hi', nativeName: 'हिन्दी', englishName: 'Hindi' },
];

export function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<MeNavProp>();
  const { colors, isDark, toggle } = useTheme();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string>('');
  const [langModalOpen, setLangModalOpen] = useState(false);

  // Active accordion section
  const [expandedSection, setExpandedSection] = useState<string | null>('demographics');

  // Accordion groups collapsed state
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({
    identity: false,
    subscription: false,
    more: false,
  });

  // Demographics State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [birthday, setBirthday] = useState('');
  const [gender, setGender] = useState('female');
  const [maritalStatus, setMaritalStatus] = useState('single');
  const [occupation, setOccupation] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');

  // Hair State
  const [hairLength, setHairLength] = useState('medium');
  const [hairType, setHairType] = useState('straight');
  const [hairColor, setHairColor] = useState('');
  const [hairStyle, setHairStyle] = useState('');

  // Visuals & Photos State
  const [facePhotoUrl, setFacePhotoUrl] = useState('');
  const [bodyPhotoUrl, setBodyPhotoUrl] = useState('');
  const [skinTone, setSkinTone] = useState('#E0AC69');

  // Complete Measurements State
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [waist, setWaist] = useState('');
  const [footLength, setFootLength] = useState('');
  const [chest, setChest] = useState('');
  const [hips, setHips] = useState('');
  const [shoulders, setShoulders] = useState('');
  const [sleeve, setSleeve] = useState('');
  const [inseam, setInseam] = useState('');
  const [outseam, setOutseam] = useState('');
  const [shoeSize, setShoeSize] = useState('');
  const [topSize, setTopSize] = useState('M');
  const [bottomSize, setBottomSize] = useState('30');
  const [dressSize, setDressSize] = useState('');
  const [braSize, setBraSize] = useState('');

  // Style Profile State
  const [selectedAesthetics, setSelectedAesthetics] = useState<string[]>(['Minimalist', 'Classic Chic']);
  const [fitPreference, setFitPreference] = useState('Regular');
  const [colorsToAvoid, setColorsToAvoid] = useState<string[]>([]);
  const [avoidInput, setAvoidInput] = useState('');
  const [preferredDressCode, setPreferredDressCode] = useState('Smart Casual');

  // AI Config State
  const [selectedProvider, setSelectedProvider] = useState('google_ai');
  const [selectedModel, setSelectedModel] = useState('gemini-3.5-flash');
  const [preferredVoiceId, setPreferredVoiceId] = useState('aura-2-thalia-en');
  const [customKeys, setCustomKeys] = useState<Record<string, boolean>>({});

  // Outfit Scheduler State
  const [schedulerEnabled, setSchedulerEnabled] = useState(true);
  const [morningTime, setMorningTime] = useState('07:30');
  const [schedulerFrequency, setSchedulerFrequency] = useState('everyday');
  const [schedulerStyleOption, setSchedulerStyleOption] = useState('casual');
  const [schedulerCustomStyle, setSchedulerCustomStyle] = useState('');
  const [weatherSync, setWeatherSync] = useState(true);
  const [calendarSync, setCalendarSync] = useState(false);

  // Professional State
  const [isStylist, setIsStylist] = useState(false);
  const [profession, setProfession] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');
  const [businessEmail, setBusinessEmail] = useState('');
  const [businessWebsite, setBusinessWebsite] = useState('');
  const [stylistBio, setStylistBio] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [bookingUrl, setBookingUrl] = useState('');
  const [specialties, setSpecialties] = useState<string[]>(['Personal Shopping', 'Wardrobe Audit']);

  // Payouts State
  const [paypalEmail, setPaypalEmail] = useState('');

  // Campaign Notifications State
  const [campaignFrequency, setCampaignFrequency] = useState('daily');
  const [campaignMaxDistance, setCampaignMaxDistance] = useState('25');
  const [campaignChannels, setCampaignChannels] = useState<Record<string, boolean>>({
    local_fashion_push: true,
    sale_alerts: true,
    new_expert_near_me: true,
    sustainable_fashion: true,
    luxury_promos: false,
  });

  // Subscription State
  const [tierName, setTierName] = useState('Free');
  const [credits, setCredits] = useState(1000);
  const [subscription, setSubscription] = useState<any>(null);
  const [closetCount, setClosetCount] = useState<number>(0);
  const [closetBonus, setClosetBonus] = useState<number>(0);

  // Shopping Assistant State
  const [shoppingAssistantEnabled, setShoppingAssistantEnabled] = useState(true);
  const [monthlyBudget, setMonthlyBudget] = useState('250');
  const [preferredStores, setPreferredStores] = useState<string[]>(['COS', 'Zara', 'Arket']);
  const [storeInput, setStoreInput] = useState('');
  const [sustainableOnly, setSustainableOnly] = useState(false);

  // Load user data
  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const u = await api.getMe();
      if (u) {
        setUserId(u.id || '');
        const fName = u.first_name || (u.name ? u.name.split(' ')[0] : '');
        const lName = u.last_name || (u.name ? u.name.split(' ').slice(1).join(' ') : '');
        setFirstName(fName);
        setLastName(lName);
        setDisplayName(u.display_name || u.name || `${fName} ${lName}`.trim());
        setEmail(u.email || '');
        setPhone(u.phone || '');
        setBirthday(u.date_of_birth || u.birthday || '');
        setGender(u.sex || u.gender || 'female');
        setMaritalStatus(u.personal_status || u.marital_status || 'single');
        setOccupation(u.occupation || '');
        
        const userCity = u.address?.city || u.city || u.home_location?.city || u.location?.city || '';
        const userCountry = u.address?.country || u.country || u.home_location?.country || u.location?.country || '';
        setCity(userCity);
        setCountry(userCountry);

        // Photos & Visuals
        setFacePhotoUrl(u.face_photo_url || u.avatar_url || '');
        setBodyPhotoUrl(u.body_photo_url || '');
        setSkinTone(u.skin_tone || '#E0AC69');

        // Hair
        if (u.hair) {
          if (u.hair.length) setHairLength(u.hair.length);
          if (u.hair.type) setHairType(u.hair.type);
          if (u.hair.color) setHairColor(u.hair.color);
          if (u.hair.style) setHairStyle(u.hair.style);
        }

        // Measurements
        const bm = u.body_measurements || u.measurements || {};
        setHeight(bm.height !== undefined && bm.height !== null ? String(bm.height) : '');
        setWeight(bm.weight !== undefined && bm.weight !== null ? String(bm.weight) : '');
        setWaist(bm.waist !== undefined && bm.waist !== null ? String(bm.waist) : '');
        setFootLength(bm.foot_length !== undefined && bm.foot_length !== null ? String(bm.foot_length) : '');
        setChest(bm.chest !== undefined && bm.chest !== null ? String(bm.chest) : '');
        setHips(bm.hip || bm.hips ? String(bm.hip || bm.hips) : '');
        setShoulders(bm.shoulders !== undefined && bm.shoulders !== null ? String(bm.shoulders) : '');
        setSleeve(bm.sleeve !== undefined && bm.sleeve !== null ? String(bm.sleeve) : '');
        setInseam(bm.inseam !== undefined && bm.inseam !== null ? String(bm.inseam) : '');
        setOutseam(bm.outseam !== undefined && bm.outseam !== null ? String(bm.outseam) : '');
        setShoeSize(bm.shoe_size ? String(bm.shoe_size) : '');
        setTopSize(bm.shirt_size || bm.top_size || 'M');
        setBottomSize(bm.pants_size || bm.bottom_size ? String(bm.pants_size || bm.bottom_size) : '30');
        setDressSize(bm.dress_size ? String(bm.dress_size) : '');
        setBraSize(bm.bra_size ? String(bm.bra_size) : '');

        // Style Profile
        if (u.style_profile?.aesthetics && Array.isArray(u.style_profile.aesthetics)) {
          setSelectedAesthetics(u.style_profile.aesthetics);
        }
        if (u.style_profile?.fit_preference) setFitPreference(u.style_profile.fit_preference);
        if (u.style_profile?.avoid && Array.isArray(u.style_profile.avoid)) {
          setColorsToAvoid(u.style_profile.avoid);
        } else if (u.style_profile?.colors_to_avoid && Array.isArray(u.style_profile.colors_to_avoid)) {
          setColorsToAvoid(u.style_profile.colors_to_avoid);
        }
        if (u.style_profile?.preferred_dress_code) setPreferredDressCode(u.style_profile.preferred_dress_code);

        // AI Config
        if (u.ai_configuration?.selected_provider) setSelectedProvider(u.ai_configuration.selected_provider);
        if (u.ai_configuration?.selected_model) setSelectedModel(u.ai_configuration.selected_model);
        if (u.preferred_voice_id) setPreferredVoiceId(u.preferred_voice_id);
        if (u.ai_configuration?.custom_keys) setCustomKeys(u.ai_configuration.custom_keys);

        // Outfit Scheduler
        const sched = u.scheduler_settings || {};
        if (sched.enabled !== undefined) setSchedulerEnabled(sched.enabled);
        else if (u.scheduler_enabled !== undefined) setSchedulerEnabled(u.scheduler_enabled);
        if (sched.time) setMorningTime(sched.time);
        else if (u.morning_notification_time) setMorningTime(u.morning_notification_time);
        if (sched.frequency) setSchedulerFrequency(sched.frequency);
        if (sched.style_option) setSchedulerStyleOption(sched.style_option);
        if (sched.custom_style) setSchedulerCustomStyle(sched.custom_style);
        if (sched.weather_sync !== undefined) setWeatherSync(sched.weather_sync);
        if (sched.calendar_sync !== undefined) setCalendarSync(sched.calendar_sync);

        // Professional
        if (u.is_stylist !== undefined) setIsStylist(u.is_stylist);
        else if (u.professional?.is_professional !== undefined) setIsStylist(u.professional.is_professional);
        if (u.professional?.profession) setProfession(u.professional.profession);
        if (u.professional?.business?.name) setBusinessName(u.professional.business.name);
        if (u.professional?.business?.address) setBusinessAddress(u.professional.business.address);
        if (u.professional?.business?.phone) setBusinessPhone(u.professional.business.phone);
        if (u.professional?.business?.email) setBusinessEmail(u.professional.business.email);
        if (u.professional?.business?.website) setBusinessWebsite(u.professional.business.website);
        if (u.professional?.business?.description) setStylistBio(u.professional.business.description);
        else if (u.stylist_bio) setStylistBio(u.stylist_bio);
        if (u.hourly_rate) setHourlyRate(String(u.hourly_rate));
        if (u.booking_url) setBookingUrl(u.booking_url);
        if (u.specialties) setSpecialties(u.specialties);

        // Payouts
        if (u.paypal_receiver_email) setPaypalEmail(u.paypal_receiver_email);

        // Campaign Notifications
        const cPrefs = sched.campaign_notification_prefs || {};
        if (cPrefs.notification_frequency) setCampaignFrequency(cPrefs.notification_frequency);
        if (cPrefs.max_campaign_distance_km) setCampaignMaxDistance(String(cPrefs.max_campaign_distance_km));
        setCampaignChannels((prev) => ({ ...prev, ...cPrefs }));

        // Subscription & Limits
        const sub = u.subscription || {};
        setSubscription(sub);
        const isActive = Boolean(sub.is_active);
        const effectiveTier = (isActive && sub.tier && sub.tier !== 'free')
          ? sub.tier
          : (u.subscription_tier || 'Free');
        setTierName(effectiveTier);
        setCredits(u.credits ?? u.ai_configuration?.current_credits ?? 1000);
        setClosetBonus(u.closet_capacity_bonus || 0);

        // Instant zero-latency wardrobe count from closetRepo
        const summary = closetRepo.getSummary();
        if (summary.total > 0) {
          setClosetCount(summary.total);
        } else {
          closetRepo.refresh().then(() => {
            const fresh = closetRepo.getSummary();
            if (fresh.total > 0) setClosetCount(fresh.total);
          }).catch(() => {});
        }

        // Shopping
        if (u.shopping_assistant?.enabled !== undefined) setShoppingAssistantEnabled(u.shopping_assistant.enabled);
        if (u.shopping_assistant?.monthly_budget) setMonthlyBudget(String(u.shopping_assistant.monthly_budget));
        if (u.shopping_assistant?.preferred_stores) setPreferredStores(u.shopping_assistant.preferred_stores);
        if (u.shopping_assistant?.sustainable_only !== undefined) setSustainableOnly(u.shopping_assistant.sustainable_only);
      }
    } catch (err) {
      console.warn('Failed to load profile:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const toggleAccordion = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const toggleGroup = (groupKey: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }));
  };

  const toggleAesthetic = (item: string) => {
    if (selectedAesthetics.includes(item)) {
      setSelectedAesthetics(selectedAesthetics.filter((a) => a !== item));
    } else {
      setSelectedAesthetics([...selectedAesthetics, item]);
    }
  };

  const toggleSpecialty = (item: string) => {
    if (specialties.includes(item)) {
      setSpecialties(specialties.filter((s) => s !== item));
    } else {
      setSpecialties([...specialties, item]);
    }
  };

  const toggleCampaignChannel = (key: string) => {
    setCampaignChannels((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSaveApiKey = async (providerId: string, apiKey: string) => {
    const providersList = ['google_ai', 'openai', 'anthropic', 'deepseek', 'qwen'];
    const keysPayload: Record<string, any> = {};
    providersList.forEach((p) => {
      if (p === providerId) {
        keysPayload[p] = apiKey;
      } else if (customKeys[p]) {
        keysPayload[p] = true;
      }
    });

    const payload = {
      ai_configuration: {
        provider_mode: 'custom_keys',
        selected_provider: providerId,
        selected_model: selectedModel,
        custom_keys: keysPayload,
      },
    };
    const res = await api.patchMe(payload);
    if (res?.ai_configuration?.custom_keys) {
      setCustomKeys(res.ai_configuration.custom_keys);
    } else {
      setCustomKeys((prev) => ({ ...prev, [providerId]: true }));
    }
  };

  const handleRemoveApiKey = async (providerId: string) => {
    const providersList = ['google_ai', 'openai', 'anthropic', 'deepseek', 'qwen'];
    const keysPayload: Record<string, any> = {};
    providersList.forEach((p) => {
      if (p === providerId) {
        keysPayload[p] = '';
      } else if (customKeys[p]) {
        keysPayload[p] = true;
      }
    });

    const payload = {
      ai_configuration: {
        provider_mode: 'custom_keys',
        selected_provider: providerId,
        selected_model: selectedModel,
        custom_keys: keysPayload,
      },
    };
    const res = await api.patchMe(payload);
    if (res?.ai_configuration?.custom_keys) {
      setCustomKeys(res.ai_configuration.custom_keys);
    } else {
      setCustomKeys((prev) => {
        const next = { ...prev };
        delete next[providerId];
        return next;
      });
    }
  };

  const handleSaveConfig = async (providerId: string, model: string) => {
    try {
      const payload = {
        ai_configuration: {
          provider_mode: 'custom_keys',
          selected_provider: providerId,
          selected_model: model,
          custom_keys: customKeys,
        },
      };
      const res = await api.patchMe(payload);
      if (res?.ai_configuration?.custom_keys) {
        setCustomKeys(res.ai_configuration.custom_keys);
      }
    } catch (e) {
      console.warn('Failed to auto-save AI configuration:', e);
    }
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const payload: any = {
        first_name: firstName || undefined,
        last_name: lastName || undefined,
        display_name: displayName || `${firstName} ${lastName}`.trim() || undefined,
        avatar_url: facePhotoUrl || undefined,
        face_photo_url: facePhotoUrl || undefined,
        body_photo_url: bodyPhotoUrl || undefined,
        skin_tone: skinTone || undefined,
        avatar_gender: (gender || '').toLowerCase() === 'male' ? 'male' : 'female',
        phone: phone || undefined,
        birthday: birthday || undefined,
        date_of_birth: birthday || undefined,
        gender: gender || undefined,
        sex: (gender || '').toLowerCase() === 'male' ? 'male' : 'female',
        marital_status: maritalStatus || undefined,
        personal_status: maritalStatus || undefined,
        occupation: occupation || undefined,
        city: city || undefined,
        country: country || undefined,
        address: {
          city: city || undefined,
          country: country || undefined,
        },
        home_location: {
          city: city || undefined,
          country: country || undefined,
        },
        units: { weight: 'kg', length: 'cm' },
        hair: {
          length: hairLength || undefined,
          type: hairType || undefined,
          color: hairColor || undefined,
          style: hairStyle || undefined,
        },
        body_measurements: {
          height: parseFloat(height) || undefined,
          weight: parseFloat(weight) || undefined,
          waist: parseFloat(waist) || undefined,
          foot_length: parseFloat(footLength) || undefined,
          chest: parseFloat(chest) || undefined,
          hip: parseFloat(hips) || undefined,
          shoulders: parseFloat(shoulders) || undefined,
          sleeve: parseFloat(sleeve) || undefined,
          inseam: parseFloat(inseam) || undefined,
          outseam: parseFloat(outseam) || undefined,
          shoe_size: shoeSize || undefined,
          shirt_size: topSize || undefined,
          pants_size: bottomSize || undefined,
          dress_size: dressSize || undefined,
          bra_size: braSize || undefined,
        },
        style_profile: {
          aesthetics: selectedAesthetics,
          fit_preference: fitPreference,
          avoid: colorsToAvoid,
          colors_to_avoid: colorsToAvoid,
          preferred_dress_code: preferredDressCode,
        },
        ai_configuration: {
          provider_mode: 'custom_keys',
          selected_provider: selectedProvider,
          selected_model: selectedModel,
          custom_keys: customKeys,
        },
        preferred_voice_id: preferredVoiceId,
        scheduler_settings: {
          enabled: schedulerEnabled,
          time: morningTime,
          frequency: schedulerFrequency,
          style_option: schedulerStyleOption,
          custom_style: schedulerCustomStyle,
          weather_sync: weatherSync,
          calendar_sync: calendarSync,
          campaign_notification_prefs: {
            notification_frequency: campaignFrequency,
            max_campaign_distance_km: Number(campaignMaxDistance) || 25,
            ...campaignChannels,
          },
        },
        professional: {
          is_professional: isStylist,
          profession: profession || undefined,
          business: {
            name: businessName || undefined,
            address: businessAddress || undefined,
            phone: businessPhone || undefined,
            email: businessEmail || undefined,
            website: businessWebsite || undefined,
            description: stylistBio || undefined,
          },
        },
        paypal_receiver_email: paypalEmail || undefined,
      };

      const res = await api.patchMe(payload);
      if (res) {
        // Update user local state directly from patch response without full wipe
        if (res.first_name !== undefined) setFirstName(res.first_name || '');
        if (res.last_name !== undefined) setLastName(res.last_name || '');
        if (res.display_name !== undefined) setDisplayName(res.display_name || '');
        if (res.phone !== undefined) setPhone(res.phone || '');
        if (res.date_of_birth !== undefined) setBirthday(res.date_of_birth || '');
        if (res.sex !== undefined) setGender(res.sex || 'female');
        if (res.personal_status !== undefined) setMaritalStatus(res.personal_status || 'single');
        if (res.occupation !== undefined) setOccupation(res.occupation || '');
        if (res.address?.city !== undefined) setCity(res.address.city || '');
        if (res.address?.country !== undefined) setCountry(res.address.country || '');
        if (res.ai_configuration?.custom_keys) setCustomKeys(res.ai_configuration.custom_keys);
      }
      Alert.alert(
        t('common.success', { defaultValue: 'Success' }),
        t('profile.profileSaved', { defaultValue: 'Profile updated successfully!' })
      );
    } catch (err: any) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        err?.response?.data?.detail || 'Failed to update profile.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleLanguageSelect = async (langCode: string) => {
    try {
      await AsyncStorage.setItem('dressapp.lang', langCode).catch(() => {});
      await i18n.changeLanguage(langCode);
      await api.patchMe({ preferred_language: langCode }).catch(() => {});
      setLangModalOpen(false);
      await applyRtl(langCode);
    } catch (e) {
      console.warn('Language switch failed:', e);
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      t('profile.signOut', { defaultValue: 'Sign Out' }),
      t('profile.signOutConfirm', { defaultValue: 'Are you sure you want to sign out of DressApp?' }),
      [
        { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
        {
          text: t('profile.signOut', { defaultValue: 'Sign Out' }),
          style: 'destructive',
          onPress: async () => {
            await tokenStore.clear();
            emitAuthChange(false);
          },
        },
      ]
    );
  };

  const currentLangObj =
    SUPPORTED_LANGUAGES.find((l) => l.code === i18n.language) ||
    SUPPORTED_LANGUAGES[0];

  const fullName = [firstName, lastName].filter(Boolean).join(' ') || displayName || 'User';

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.headerSuper, { color: colors.accent }]}>
            {t('profile.accountLabel', { defaultValue: 'ACCOUNT & PREFERENCES' })}
          </Text>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            {t('profile.title', { defaultValue: 'Profile' })}
          </Text>
        </View>

        <View style={styles.headerActions}>
          <HelpFloater screenTopic="profile-matters" />
          <TouchableOpacity
            style={[styles.themeToggleBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
            onPress={toggle}
            accessibilityLabel="Toggle Theme"
          >
            {isDark ? (
              <Lucide.Sun size={17} color="#FBBF24" />
            ) : (
              <Lucide.Moon size={17} color={colors.foreground} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.saveHeaderBtn, { backgroundColor: colors.accent }]}
            onPress={handleSaveAll}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Lucide.Save size={15} color="#FFF" />
                <Text style={styles.saveHeaderBtnText}>{t('common.save', { defaultValue: 'Save' })}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* User Hero Banner */}
        <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.heroRow}>
            {/* User Face Photo replacing Logo/Default avatar */}
            <View style={[styles.avatarWrap, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              {facePhotoUrl ? (
                <Image source={{ uri: facePhotoUrl }} style={styles.avatarImg} resizeMode="cover" />
              ) : (
                <Text style={[styles.avatarInitial, { color: colors.foreground }]}>
                  {firstName ? firstName.charAt(0).toUpperCase() : displayName ? displayName.charAt(0).toUpperCase() : 'D'}
                </Text>
              )}
            </View>

            <View style={styles.heroDetails}>
              <Text style={[styles.userName, { color: colors.foreground }]}>
                {fullName}
              </Text>
              {displayName ? (
                <Text style={[styles.userHandle, { color: colors.mutedFg }]}>
                  {displayName.startsWith('@') ? displayName : `@${displayName}`}
                </Text>
              ) : (
                <Text style={[styles.userEmail, { color: colors.mutedFg }]}>
                  {email || '—'}
                </Text>
              )}

              <View style={styles.pillsRow}>
                <View
                  style={[
                    styles.tierPill,
                    {
                      backgroundColor: subscription?.is_active && tierName.toLowerCase() !== 'free'
                        ? 'rgba(234, 179, 8, 0.15)'
                        : colors.secondary,
                      borderColor: subscription?.is_active && tierName.toLowerCase() !== 'free'
                        ? '#EAB308'
                        : colors.border,
                    },
                  ]}
                >
                  <Lucide.Crown
                    size={12}
                    color={subscription?.is_active && tierName.toLowerCase() !== 'free' ? '#EAB308' : colors.accent}
                  />
                  <Text
                    style={[
                      styles.tierPillText,
                      {
                        color: subscription?.is_active && tierName.toLowerCase() !== 'free'
                          ? '#EAB308'
                          : colors.foreground,
                        fontFamily: fonts.bodyBold,
                      },
                    ]}
                  >
                    {t('profile.planLabel', {
                      defaultValue: '{{tier}} Plan',
                      tier: tierName ? tierName.charAt(0).toUpperCase() + tierName.slice(1) : 'Free',
                    })}
                  </Text>
                </View>

                <View style={[styles.creditsPill, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                  <Lucide.Sparkles size={12} color={colors.accent} />
                  <Text style={[styles.creditsPillText, { color: colors.foreground }]}>
                    {t('profile.creditsLabel', { defaultValue: '{{credits}} Credits', credits })}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Explore Hub Navigation */}
        <View style={[styles.exploreCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.exploreTitle, { color: colors.foreground }]}>
            {t('profile.exploreTitle', { defaultValue: 'Explore DressApp' })}
          </Text>
          <View style={styles.exploreGrid}>
            <TouchableOpacity
              style={[styles.exploreItem, { backgroundColor: colors.secondary }]}
              onPress={() => navigation.navigate('TrendScout' as any)}
            >
              <Lucide.Newspaper size={20} color="#F97316" />
              <Text style={[styles.exploreItemText, { color: colors.foreground }]}>
                {t('nav.trend_scout', { defaultValue: 'Trend Scout' })}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.exploreItem, { backgroundColor: colors.secondary }]}
              onPress={() => navigation.navigate('Outfits' as any)}
            >
              <Lucide.Calendar size={20} color="#A855F7" />
              <Text style={[styles.exploreItemText, { color: colors.foreground }]}>
                {t('nav.outfits', { defaultValue: 'Outfits' })}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.exploreItem, { backgroundColor: colors.secondary }]}
              onPress={() => navigation.navigate('ExpertsDirectory' as any)}
            >
              <Lucide.Users size={20} color="#0D9488" />
              <Text style={[styles.exploreItemText, { color: colors.foreground }]}>
                {t('nav.experts', { defaultValue: 'Experts' })}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.exploreItem, { backgroundColor: colors.secondary }]}
              onPress={() => navigation.navigate('WardrobeStats' as any)}
            >
              <Lucide.TrendingUp size={20} color="#22C55E" />
              <Text style={[styles.exploreItemText, { color: colors.foreground }]}>
                {t('nav.insights', { defaultValue: 'Wardrobe Insights' })}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Language Selector Card */}
        <TouchableOpacity
          style={[styles.languageCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => setLangModalOpen(true)}
          activeOpacity={0.8}
        >
          <View style={styles.langLeft}>
            <Lucide.Languages size={18} color={colors.accent} />
            <View>
              <Text style={[styles.langLabel, { color: colors.mutedFg }]}>
                {t('profile.voiceLanguage', { defaultValue: 'Language & Voice' })}
              </Text>
              <Text style={[styles.langName, { color: colors.foreground }]}>
                {currentLangObj.nativeName} ({currentLangObj.englishName})
              </Text>
            </View>
          </View>
          <Lucide.ChevronRight size={18} color={colors.mutedFg} />
        </TouchableOpacity>

        {/* Main Accordion Suite */}
        {loading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={[styles.loaderText, { color: colors.mutedFg }]}>
              {t('common.loading', { defaultValue: 'Loading profile...' })}
            </Text>
          </View>
        ) : (
          <View style={styles.accordionsWrap}>
            {/* ═════════════════════════════════════════════════════════════════ */}
            {/* 1. IDENTITY ACCORDION SECTION                                   */}
            {/* ═════════════════════════════════════════════════════════════════ */}
            <View style={styles.groupContainer}>
              <TouchableOpacity
                style={[styles.groupHeader, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => toggleGroup('identity')}
                activeOpacity={0.8}
              >
                <View style={styles.groupHeaderLeft}>
                  <View style={[styles.groupIconCircle, { backgroundColor: colors.secondary }]}>
                    <Lucide.UserCheck size={16} color={colors.accent} />
                  </View>
                  <Text style={[styles.groupTitle, { color: colors.foreground }]}>
                    {t('profile.groups.identity', { defaultValue: 'Identity' })}
                  </Text>
                  <View style={[styles.groupCountBadge, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                    <Text style={[styles.groupCountText, { color: colors.mutedFg }]}>6</Text>
                  </View>
                </View>
                {collapsedGroups.identity ? (
                  <Lucide.ChevronDown size={18} color={colors.mutedFg} />
                ) : (
                  <Lucide.ChevronUp size={18} color={colors.mutedFg} />
                )}
              </TouchableOpacity>

              {!collapsedGroups.identity && (
                <View style={styles.groupItems}>
                  {/* 1.1 Identity & Demographics */}
                  <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <TouchableOpacity
                      style={styles.sectionHeader}
                      onPress={() => toggleAccordion('demographics')}
                    >
                      <View style={styles.sectionTitleRow}>
                        <Lucide.Fingerprint size={18} color={colors.accent} />
                        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                          {t('profile.sections.demographics', { defaultValue: 'Identity & Demographics' })}
                        </Text>
                      </View>
                      {expandedSection === 'demographics' ? (
                        <Lucide.ChevronUp size={18} color={colors.mutedFg} />
                      ) : (
                        <Lucide.ChevronDown size={18} color={colors.mutedFg} />
                      )}
                    </TouchableOpacity>
                    {expandedSection === 'demographics' && (
                      <View style={styles.sectionBody}>
                        <DemographicsSection
                          firstName={firstName}
                          setFirstName={setFirstName}
                          lastName={lastName}
                          setLastName={setLastName}
                          displayName={displayName}
                          setDisplayName={setDisplayName}
                          email={email}
                          phone={phone}
                          setPhone={setPhone}
                          birthday={birthday}
                          setBirthday={setBirthday}
                          gender={gender}
                          setGender={setGender}
                          maritalStatus={maritalStatus}
                          setMaritalStatus={setMaritalStatus}
                          occupation={occupation}
                          setOccupation={setOccupation}
                          city={city}
                          setCity={setCity}
                          country={country}
                          setCountry={setCountry}
                        />
                      </View>
                    )}
                  </View>

                  {/* 1.2 Body Measurements & Sizes */}
                  <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <TouchableOpacity
                      style={styles.sectionHeader}
                      onPress={() => toggleAccordion('measurements')}
                    >
                      <View style={styles.sectionTitleRow}>
                        <Lucide.Ruler size={18} color={colors.accent} />
                        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                          {t('profile.sections.measurements', { defaultValue: 'Body Measurements & Sizes' })}
                        </Text>
                      </View>
                      {expandedSection === 'measurements' ? (
                        <Lucide.ChevronUp size={18} color={colors.mutedFg} />
                      ) : (
                        <Lucide.ChevronDown size={18} color={colors.mutedFg} />
                      )}
                    </TouchableOpacity>
                    {expandedSection === 'measurements' && (
                      <View style={styles.sectionBody}>
                        <MeasurementsSection
                          height={height}
                          setHeight={setHeight}
                          weight={weight}
                          setWeight={setWeight}
                          waist={waist}
                          setWaist={setWaist}
                          footLength={footLength}
                          setFootLength={setFootLength}
                          chest={chest}
                          setChest={setChest}
                          hips={hips}
                          setHips={setHips}
                          shoulders={shoulders}
                          setShoulders={setShoulders}
                          sleeve={sleeve}
                          setSleeve={setSleeve}
                          inseam={inseam}
                          setInseam={setInseam}
                          outseam={outseam}
                          setOutseam={setOutseam}
                          shoeSize={shoeSize}
                          setShoeSize={setShoeSize}
                          topSize={topSize}
                          setTopSize={setTopSize}
                          bottomSize={bottomSize}
                          setBottomSize={setBottomSize}
                          dressSize={dressSize}
                          setDressSize={setDressSize}
                          braSize={braSize}
                          setBraSize={setBraSize}
                          gender={gender}
                        />
                      </View>
                    )}
                  </View>

                  {/* 1.3 Avatar & Virtual Fitting */}
                  <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <TouchableOpacity
                      style={styles.sectionHeader}
                      onPress={() => toggleAccordion('avatar')}
                    >
                      <View style={styles.sectionTitleRow}>
                        <Lucide.Camera size={18} color="#DB2777" />
                        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                          {t('profile.sections.photosAvatar', { defaultValue: 'Avatar & Virtual Fitting' })}
                        </Text>
                      </View>
                      {expandedSection === 'avatar' ? (
                        <Lucide.ChevronUp size={18} color={colors.mutedFg} />
                      ) : (
                        <Lucide.ChevronDown size={18} color={colors.mutedFg} />
                      )}
                    </TouchableOpacity>
                    {expandedSection === 'avatar' && (
                      <View style={styles.sectionBody}>
                        <AvatarSection
                          facePhotoUrl={facePhotoUrl}
                          setFacePhotoUrl={setFacePhotoUrl}
                          bodyPhotoUrl={bodyPhotoUrl}
                          setBodyPhotoUrl={setBodyPhotoUrl}
                          skinTone={skinTone}
                          setSkinTone={setSkinTone}
                          userGender={gender}
                          bodyMeasurements={{
                            height: parseFloat(height) || 168,
                            chest: parseFloat(chest) || 88,
                            waist: parseFloat(waist) || 68,
                            hip: parseFloat(hips) || 94,
                            shoulders: parseFloat(shoulders) || 38,
                            inseam: parseFloat(inseam) || 76,
                            armLength: parseFloat(sleeve) || 58,
                          }}
                          onSaveSuccess={() => loadProfile()}
                        />
                      </View>
                    )}
                  </View>

                  {/* 1.4 Hair & Grooming */}
                  <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <TouchableOpacity
                      style={styles.sectionHeader}
                      onPress={() => toggleAccordion('hair')}
                    >
                      <View style={styles.sectionTitleRow}>
                        <Lucide.Scissors size={18} color="#D97706" />
                        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                          {t('profile.sections.hair', { defaultValue: 'Hair & Grooming' })}
                        </Text>
                      </View>
                      {expandedSection === 'hair' ? (
                        <Lucide.ChevronUp size={18} color={colors.mutedFg} />
                      ) : (
                        <Lucide.ChevronDown size={18} color={colors.mutedFg} />
                      )}
                    </TouchableOpacity>
                    {expandedSection === 'hair' && (
                      <View style={styles.sectionBody}>
                        <HairSection
                          hairLength={hairLength}
                          setHairLength={setHairLength}
                          hairType={hairType}
                          setHairType={setHairType}
                          hairColor={hairColor}
                          setHairColor={setHairColor}
                          hairStyle={hairStyle}
                          setHairStyle={setHairStyle}
                        />
                      </View>
                    )}
                  </View>

                  {/* 1.5 Style Profile & Aesthetic */}
                  <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <TouchableOpacity
                      style={styles.sectionHeader}
                      onPress={() => toggleAccordion('style')}
                    >
                      <View style={styles.sectionTitleRow}>
                        <Lucide.Sparkles size={18} color="#8B5CF6" />
                        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                          {t('profile.sections.styleProfile', { defaultValue: 'Style Profile & Aesthetics' })}
                        </Text>
                      </View>
                      {expandedSection === 'style' ? (
                        <Lucide.ChevronUp size={18} color={colors.mutedFg} />
                      ) : (
                        <Lucide.ChevronDown size={18} color={colors.mutedFg} />
                      )}
                    </TouchableOpacity>
                    {expandedSection === 'style' && (
                      <View style={styles.sectionBody}>
                        <StyleProfileSection
                          selectedAesthetics={selectedAesthetics}
                          toggleAesthetic={toggleAesthetic}
                          fitPreference={fitPreference}
                          setFitPreference={setFitPreference}
                          colorsToAvoid={colorsToAvoid}
                          avoidInput={avoidInput}
                          setAvoidInput={setAvoidInput}
                          setColorsToAvoid={setColorsToAvoid}
                          preferredDressCode={preferredDressCode}
                          setPreferredDressCode={setPreferredDressCode}
                        />
                      </View>
                    )}
                  </View>

                  {/* 1.6 Professional Directory */}
                  <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <TouchableOpacity
                      style={styles.sectionHeader}
                      onPress={() => toggleAccordion('professional')}
                    >
                      <View style={styles.sectionTitleRow}>
                        <Lucide.Briefcase size={18} color="#6366F1" />
                        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                          {t('profile.professional.sectionTitle', { defaultValue: 'Professional Directory' })}
                        </Text>
                      </View>
                      {expandedSection === 'professional' ? (
                        <Lucide.ChevronUp size={18} color={colors.mutedFg} />
                      ) : (
                        <Lucide.ChevronDown size={18} color={colors.mutedFg} />
                      )}
                    </TouchableOpacity>
                    {expandedSection === 'professional' && (
                      <View style={styles.sectionBody}>
                        <ProfessionalSection
                          isStylist={isStylist}
                          setIsStylist={setIsStylist}
                          profession={profession}
                          setProfession={setProfession}
                          businessName={businessName}
                          setBusinessName={setBusinessName}
                          businessAddress={businessAddress}
                          setBusinessAddress={setBusinessAddress}
                          businessPhone={businessPhone}
                          setBusinessPhone={setBusinessPhone}
                          businessEmail={businessEmail}
                          setBusinessEmail={setBusinessEmail}
                          businessWebsite={businessWebsite}
                          setBusinessWebsite={setBusinessWebsite}
                          stylistBio={stylistBio}
                          setStylistBio={setStylistBio}
                          hourlyRate={hourlyRate}
                          setHourlyRate={setHourlyRate}
                          bookingUrl={bookingUrl}
                          setBookingUrl={setBookingUrl}
                          specialties={specialties}
                          toggleSpecialty={toggleSpecialty}
                        />
                      </View>
                    )}
                  </View>
                </View>
              )}
            </View>

            {/* ═════════════════════════════════════════════════════════════════ */}
            {/* 2. SUBSCRIPTION ACCORDION SECTION                               */}
            {/* ═════════════════════════════════════════════════════════════════ */}
            <View style={styles.groupContainer}>
              <TouchableOpacity
                style={[styles.groupHeader, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => toggleGroup('subscription')}
                activeOpacity={0.8}
              >
                <View style={styles.groupHeaderLeft}>
                  <View style={[styles.groupIconCircle, { backgroundColor: 'rgba(234, 179, 8, 0.15)' }]}>
                    <Lucide.Crown size={16} color="#EAB308" />
                  </View>
                  <Text style={[styles.groupTitle, { color: colors.foreground }]}>
                    {t('profile.groups.subscription', { defaultValue: 'Subscription' })}
                  </Text>
                  <View style={[styles.groupCountBadge, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                    <Text style={[styles.groupCountText, { color: colors.mutedFg }]}>5</Text>
                  </View>
                </View>
                {collapsedGroups.subscription ? (
                  <Lucide.ChevronDown size={18} color={colors.mutedFg} />
                ) : (
                  <Lucide.ChevronUp size={18} color={colors.mutedFg} />
                )}
              </TouchableOpacity>

              {!collapsedGroups.subscription && (
                <View style={styles.groupItems}>
                  {/* 2.1 AI Stylist & Model Settings */}
                  <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <TouchableOpacity
                      style={styles.sectionHeader}
                      onPress={() => toggleAccordion('ai')}
                    >
                      <View style={styles.sectionTitleRow}>
                        <Lucide.Cpu size={18} color="#3B82F6" />
                        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                          {t('profile.sections.aiConfig', { defaultValue: 'AI Stylist & Model Settings' })}
                        </Text>
                      </View>
                      {expandedSection === 'ai' ? (
                        <Lucide.ChevronUp size={18} color={colors.mutedFg} />
                      ) : (
                        <Lucide.ChevronDown size={18} color={colors.mutedFg} />
                      )}
                    </TouchableOpacity>
                    {expandedSection === 'ai' && (
                      <View style={styles.sectionBody}>
                        <AIConfiguration
                          selectedProvider={selectedProvider}
                          setSelectedProvider={setSelectedProvider}
                          selectedModel={selectedModel}
                          setSelectedModel={setSelectedModel}
                          preferredVoiceId={preferredVoiceId}
                          setPreferredVoiceId={setPreferredVoiceId}
                          customKeys={customKeys}
                          onSaveApiKey={handleSaveApiKey}
                          onRemoveApiKey={handleRemoveApiKey}
                          onSaveConfig={handleSaveConfig}
                        />
                      </View>
                    )}
                  </View>

                  {/* 2.2 Subscription & AI Credits */}
                  <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <TouchableOpacity
                      style={styles.sectionHeader}
                      onPress={() => toggleAccordion('subscription')}
                    >
                      <View style={styles.sectionTitleRow}>
                        <Lucide.Crown
                          size={18}
                          color={subscription?.is_active && tierName.toLowerCase() !== 'free' ? '#EAB308' : colors.accent}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                            {t('profile.sections.subscription', { defaultValue: 'Subscription & AI Credits' })}
                          </Text>
                          <Text style={[styles.sectionSubtext, { color: colors.mutedFg }]}>
                            {subscription?.is_active && tierName.toLowerCase() !== 'free'
                              ? t('profile.subActiveSummary', {
                                  defaultValue: 'Active: {{plan}} plan (Expires: {{date}})',
                                  plan: (subscription?.tier || tierName).toUpperCase(),
                                  date: subscription?.expires_at ? new Date(subscription.expires_at).toLocaleDateString() : '',
                                })
                              : t('profile.subFreeSummary', {
                                  defaultValue: 'Free Plan: {{count}} / {{capacity}} items used',
                                  count: closetCount,
                                  capacity: 50 + Math.min(closetBonus, 150),
                                })}
                          </Text>
                        </View>
                      </View>
                      {expandedSection === 'subscription' ? (
                        <Lucide.ChevronUp size={18} color={colors.mutedFg} />
                      ) : (
                        <Lucide.ChevronDown size={18} color={colors.mutedFg} />
                      )}
                    </TouchableOpacity>
                    {expandedSection === 'subscription' && (
                      <View style={styles.sectionBody}>
                        <SubscriptionSettings
                          subscription={subscription}
                          tierName={tierName}
                          closetCount={closetCount}
                          closetBonus={closetBonus}
                          userId={userId}
                          onManagePricingPress={() => navigation.navigate('Pricing' as any)}
                          onRefreshProfile={loadProfile}
                        />
                      </View>
                    )}
                  </View>

                  {/* 2.3 Payout (PayPal) */}
                  <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <TouchableOpacity
                      style={styles.sectionHeader}
                      onPress={() => toggleAccordion('payouts')}
                    >
                      <View style={styles.sectionTitleRow}>
                        <Lucide.CreditCard size={18} color="#10B981" />
                        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                          {t('profile.payouts.sectionTitle', { defaultValue: 'Payout (PayPal)' })}
                        </Text>
                      </View>
                      {expandedSection === 'payouts' ? (
                        <Lucide.ChevronUp size={18} color={colors.mutedFg} />
                      ) : (
                        <Lucide.ChevronDown size={18} color={colors.mutedFg} />
                      )}
                    </TouchableOpacity>
                    {expandedSection === 'payouts' && (
                      <View style={styles.sectionBody}>
                        <PayoutsSection
                          paypalEmail={paypalEmail}
                          setPaypalEmail={setPaypalEmail}
                        />
                      </View>
                    )}
                  </View>

                  {/* 2.4 Google Calendar Sync */}
                  <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <TouchableOpacity
                      style={styles.sectionHeader}
                      onPress={() => toggleAccordion('calendar')}
                    >
                      <View style={styles.sectionTitleRow}>
                        <Lucide.Calendar size={18} color="#2563EB" />
                        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                          {t('calendar.title', { defaultValue: 'Google Calendar Sync' })}
                        </Text>
                      </View>
                      {expandedSection === 'calendar' ? (
                        <Lucide.ChevronUp size={18} color={colors.mutedFg} />
                      ) : (
                        <Lucide.ChevronDown size={18} color={colors.mutedFg} />
                      )}
                    </TouchableOpacity>
                    {expandedSection === 'calendar' && (
                      <View style={styles.sectionBody}>
                        <CalendarConnect />
                      </View>
                    )}
                  </View>

                  {/* 2.5 Location and Weather */}
                  <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <TouchableOpacity
                      style={styles.sectionHeader}
                      onPress={() => toggleAccordion('location')}
                    >
                      <View style={styles.sectionTitleRow}>
                        <Lucide.MapPin size={18} color="#16A34A" />
                        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                          {t('location.title', { defaultValue: 'Location and Weather' })}
                        </Text>
                      </View>
                      {expandedSection === 'location' ? (
                        <Lucide.ChevronUp size={18} color={colors.mutedFg} />
                      ) : (
                        <Lucide.ChevronDown size={18} color={colors.mutedFg} />
                      )}
                    </TouchableOpacity>
                    {expandedSection === 'location' && (
                      <View style={styles.sectionBody}>
                        <LocationCard city={city} country={country} />
                      </View>
                    )}
                  </View>
                </View>
              )}
            </View>

            {/* ═════════════════════════════════════════════════════════════════ */}
            {/* 3. MORE ACCORDION SECTION                                       */}
            {/* ═════════════════════════════════════════════════════════════════ */}
            <View style={styles.groupContainer}>
              <TouchableOpacity
                style={[styles.groupHeader, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => toggleGroup('more')}
                activeOpacity={0.8}
              >
                <View style={styles.groupHeaderLeft}>
                  <View style={[styles.groupIconCircle, { backgroundColor: colors.secondary }]}>
                    <Lucide.MoreHorizontal size={16} color={colors.accent} />
                  </View>
                  <Text style={[styles.groupTitle, { color: colors.foreground }]}>
                    {t('profile.groups.more', { defaultValue: 'More' })}
                  </Text>
                  <View style={[styles.groupCountBadge, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                    <Text style={[styles.groupCountText, { color: colors.mutedFg }]}>6</Text>
                  </View>
                </View>
                {collapsedGroups.more ? (
                  <Lucide.ChevronDown size={18} color={colors.mutedFg} />
                ) : (
                  <Lucide.ChevronUp size={18} color={colors.mutedFg} />
                )}
              </TouchableOpacity>

              {!collapsedGroups.more && (
                <View style={styles.groupItems}>
                  {/* 3.1 Outfit Scheduler */}
                  <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <TouchableOpacity
                      style={styles.sectionHeader}
                      onPress={() => toggleAccordion('scheduler')}
                    >
                      <View style={styles.sectionTitleRow}>
                        <Lucide.Bell size={18} color="#F59E0B" />
                        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                          {t('profile.sections.scheduler', { defaultValue: 'Outfit Scheduler' })}
                        </Text>
                      </View>
                      {expandedSection === 'scheduler' ? (
                        <Lucide.ChevronUp size={18} color={colors.mutedFg} />
                      ) : (
                        <Lucide.ChevronDown size={18} color={colors.mutedFg} />
                      )}
                    </TouchableOpacity>
                    {expandedSection === 'scheduler' && (
                      <View style={styles.sectionBody}>
                        <SchedulerSettings
                          enabled={schedulerEnabled}
                          setEnabled={setSchedulerEnabled}
                          time={morningTime}
                          setTime={setMorningTime}
                          frequency={schedulerFrequency}
                          setFrequency={setSchedulerFrequency}
                          styleOption={schedulerStyleOption}
                          setStyleOption={setSchedulerStyleOption}
                          customStyle={schedulerCustomStyle}
                          setCustomStyle={setSchedulerCustomStyle}
                          weatherSync={weatherSync}
                          setWeatherSync={setWeatherSync}
                          calendarSync={calendarSync}
                          setCalendarSync={setCalendarSync}
                        />
                      </View>
                    )}
                  </View>

                  {/* 3.2 Campaign Notifications */}
                  <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <TouchableOpacity
                      style={styles.sectionHeader}
                      onPress={() => toggleAccordion('campaigns')}
                    >
                      <View style={styles.sectionTitleRow}>
                        <Lucide.Megaphone size={18} color="#EC4899" />
                        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                          {t('campaigns.notifications.sectionTitle', { defaultValue: 'Campaign Notifications' })}
                        </Text>
                      </View>
                      {expandedSection === 'campaigns' ? (
                        <Lucide.ChevronUp size={18} color={colors.mutedFg} />
                      ) : (
                        <Lucide.ChevronDown size={18} color={colors.mutedFg} />
                      )}
                    </TouchableOpacity>
                    {expandedSection === 'campaigns' && (
                      <View style={styles.sectionBody}>
                        <CampaignNotificationsSection
                          frequency={campaignFrequency}
                          setFrequency={setCampaignFrequency}
                          maxDistance={campaignMaxDistance}
                          setMaxDistance={setCampaignMaxDistance}
                          channels={campaignChannels}
                          toggleChannel={toggleCampaignChannel}
                        />
                      </View>
                    )}
                  </View>

                  {/* 3.3 AI Shopping Assistant */}
                  <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <TouchableOpacity
                      style={styles.sectionHeader}
                      onPress={() => toggleAccordion('shopping')}
                    >
                      <View style={styles.sectionTitleRow}>
                        <Lucide.ShoppingBag size={18} color="#EC4899" />
                        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                          {t('profile.sections.shopping', { defaultValue: 'AI Shopping Assistant' })}
                        </Text>
                      </View>
                      {expandedSection === 'shopping' ? (
                        <Lucide.ChevronUp size={18} color={colors.mutedFg} />
                      ) : (
                        <Lucide.ChevronDown size={18} color={colors.mutedFg} />
                      )}
                    </TouchableOpacity>
                    {expandedSection === 'shopping' && (
                      <View style={styles.sectionBody}>
                        <ShoppingAssistant
                          shoppingAssistantEnabled={shoppingAssistantEnabled}
                          setShoppingAssistantEnabled={setShoppingAssistantEnabled}
                          monthlyBudget={monthlyBudget}
                          setMonthlyBudget={setMonthlyBudget}
                          preferredStores={preferredStores}
                          storeInput={storeInput}
                          setStoreInput={setStoreInput}
                          setPreferredStores={setPreferredStores}
                          sustainableOnly={sustainableOnly}
                          setSustainableOnly={setSustainableOnly}
                        />
                      </View>
                    )}
                  </View>

                  {/* 3.4 Import Wardrobe */}
                  <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <TouchableOpacity
                      style={styles.sectionHeader}
                      onPress={() => toggleAccordion('import')}
                    >
                      <View style={styles.sectionTitleRow}>
                        <Lucide.FolderDown size={18} color="#0EA5E9" />
                        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                          {t('profile.importWardrobe', { defaultValue: 'Import Wardrobe' })}
                        </Text>
                      </View>
                      {expandedSection === 'import' ? (
                        <Lucide.ChevronUp size={18} color={colors.mutedFg} />
                      ) : (
                        <Lucide.ChevronDown size={18} color={colors.mutedFg} />
                      )}
                    </TouchableOpacity>
                    {expandedSection === 'import' && (
                      <View style={styles.sectionBody}>
                        <ImportWardrobeSection />
                      </View>
                    )}
                  </View>

                  {/* 3.5 Invite Friends */}
                  <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <TouchableOpacity
                      style={styles.sectionHeader}
                      onPress={() => toggleAccordion('invite')}
                    >
                      <View style={styles.sectionTitleRow}>
                        <Lucide.UserPlus size={18} color="#8B5CF6" />
                        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                          {t('profile.inviteFriends', { defaultValue: 'Invite Friends' })}
                        </Text>
                      </View>
                      {expandedSection === 'invite' ? (
                        <Lucide.ChevronUp size={18} color={colors.mutedFg} />
                      ) : (
                        <Lucide.ChevronDown size={18} color={colors.mutedFg} />
                      )}
                    </TouchableOpacity>
                    {expandedSection === 'invite' && (
                      <View style={styles.sectionBody}>
                        <InviteFriendsSection userId={userId} />
                      </View>
                    )}
                  </View>

                  {/* 3.6 Developer & Cache Tools */}
                  <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <TouchableOpacity
                      style={styles.sectionHeader}
                      onPress={() => toggleAccordion('developer')}
                    >
                      <View style={styles.sectionTitleRow}>
                        <Lucide.Terminal size={18} color={colors.mutedFg} />
                        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                          {t('profile.sections.developer', { defaultValue: 'Developer & Cache Tools' })}
                        </Text>
                      </View>
                      {expandedSection === 'developer' ? (
                        <Lucide.ChevronUp size={18} color={colors.mutedFg} />
                      ) : (
                        <Lucide.ChevronDown size={18} color={colors.mutedFg} />
                      )}
                    </TouchableOpacity>
                    {expandedSection === 'developer' && (
                      <View style={styles.sectionBody}>
                        <DeveloperPanel />
                      </View>
                    )}
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Global Save Profile Button */}
        <TouchableOpacity
          style={[styles.mainSaveBtn, { backgroundColor: colors.accent }]}
          onPress={handleSaveAll}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <Lucide.Save size={18} color="#FFF" />
              <Text style={styles.mainSaveBtnText}>{t('profile.saveProfile', { defaultValue: 'Save Full Profile' })}</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Sign Out Button */}
        <TouchableOpacity
          style={[styles.signOutBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
          onPress={handleSignOut}
        >
          <Lucide.LogOut size={16} color="#EF4444" />
          <Text style={styles.signOutBtnText}>{t('profile.signOut', { defaultValue: 'Sign Out' })}</Text>
        </TouchableOpacity>

        {/* Footer Legal Links */}
        <View style={styles.legalRow}>
          <TouchableOpacity onPress={() => navigation.navigate('Privacy' as any)}>
            <Text style={[styles.legalLink, { color: colors.mutedFg }]}>
              {t('profile.privacyPolicy', { defaultValue: 'Privacy Policy' })}
            </Text>
          </TouchableOpacity>
          <Text style={[styles.legalDot, { color: colors.mutedFg }]}>•</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Terms' as any)}>
            <Text style={[styles.legalLink, { color: colors.mutedFg }]}>
              {t('profile.termsOfService', { defaultValue: 'Terms of Service' })}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Language Selection Modal */}
      <Modal visible={langModalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                {t('profile.chooseLanguage', { defaultValue: 'Select Language' })}
              </Text>
              <TouchableOpacity onPress={() => setLangModalOpen(false)}>
                <Lucide.X size={20} color={colors.mutedFg} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.langList}>
              {SUPPORTED_LANGUAGES.map((lang) => {
                const isSelected = i18n.language === lang.code;
                return (
                  <TouchableOpacity
                    key={lang.code}
                    style={[
                      styles.langOption,
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
                    onPress={() => handleLanguageSelect(lang.code)}
                  >
                    <View style={styles.langOptionLeft}>
                      <Text
                        style={[
                          styles.langNative,
                          {
                            color: isSelected ? colors.foreground : colors.mutedFg,
                            fontFamily: isSelected ? fonts.bodyBold : fonts.bodyMedium,
                          },
                        ]}
                      >
                        {lang.nativeName}
                      </Text>
                      <Text style={[styles.langEnglish, { color: colors.mutedFg }]}>
                        · {lang.englishName}
                      </Text>
                    </View>
                    {isSelected && <Lucide.Check size={16} color={colors.accent} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  headerLeft: {
    gap: 2,
  },
  headerSuper: {
    fontFamily: fonts.bodyBold,
    fontSize: 10.5,
    letterSpacing: 1.2,
  },
  headerTitle: {
    fontFamily: fonts.display,
    fontSize: fontSizes['2xl'],
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  themeToggleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radii.full,
  },
  saveHeaderBtnText: {
    color: '#FFF',
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
  },
  scrollContent: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing['2xl'],
  },
  heroCard: {
    padding: spacing.md,
    borderRadius: radii.xl,
    borderWidth: 1,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatarWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarInitial: {
    fontFamily: fonts.display,
    fontSize: 26,
  },
  heroDetails: {
    flex: 1,
    gap: 2,
  },
  userName: {
    fontFamily: fonts.display,
    fontSize: fontSizes.lg,
  },
  userHandle: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
  },
  userEmail: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
  },
  pillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 4,
  },
  tierPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  tierPillText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
  },
  creditsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  creditsPillText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
  },
  exploreCard: {
    padding: spacing.md,
    borderRadius: radii.xl,
    borderWidth: 1,
    gap: spacing.sm,
  },
  exploreTitle: {
    fontFamily: fonts.display,
    fontSize: fontSizes.base,
  },
  exploreGrid: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  exploreItem: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: 4,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  exploreItemText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
    textAlign: 'center',
  },
  languageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: radii.xl,
    borderWidth: 1,
  },
  langLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  langLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    textTransform: 'uppercase',
  },
  langName: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
  },
  loaderWrap: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  loaderText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
  },
  accordionsWrap: {
    gap: spacing.md,
  },
  groupContainer: {
    gap: spacing.xs,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.xl,
    borderWidth: 1,
    marginBottom: spacing.xs,
  },
  groupHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  groupIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.md,
    letterSpacing: 0.3,
  },
  groupCountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  groupCountText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.xs,
  },
  groupItems: {
    gap: spacing.sm,
  },
  sectionCard: {
    borderRadius: radii.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  sectionTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.sm,
  },
  sectionSubtext: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs - 1,
    marginTop: 1,
  },
  sectionBody: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    paddingTop: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  mainSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: spacing.md,
    borderRadius: radii.full,
    marginTop: spacing.sm,
  },
  mainSaveBtnText: {
    color: '#FFF',
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.base,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  signOutBtnText: {
    color: '#EF4444',
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.sm,
  },
  legalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  legalLink: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    textDecorationLine: 'underline',
  },
  legalDot: {
    fontSize: fontSizes.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    maxHeight: '80%',
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.xs,
  },
  modalTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.base,
  },
  langList: {
    maxHeight: 360,
  },
  langOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radii.md,
    marginBottom: spacing.xs,
  },
  langOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  langNative: {
    fontSize: fontSizes.sm,
  },
  langEnglish: {
    fontSize: fontSizes.xs,
    fontFamily: fonts.body,
  },
});
