/**
 * apps/mobile/src/screens/me/ExpertsDirectoryScreen.tsx
 * Core loop:
 *  - Experts tab: api.listProfessionals() → directory list with contact info & business details.
 *  - Campaigns tab: campaignApi.getCampaignFeed() → local promotional campaigns with sort and detail navigation.
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Linking,
  I18nManager,
  TextInput,
  ScrollView,
  Modal,
  Pressable,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import * as Lucide from 'lucide-react-native';
import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii, shadows } from '@mobile/theme/tokens';
import { useExpertsStore } from '@mobile/lib/stores';
import { labelForProfession } from '@mobile/lib/taxonomy';
import { HelpFloater } from '@mobile/components/help';
import { ScrollToTopFloater } from '@mobile/components/common/ScrollToTopFloater';
import { api, campaignApi } from '@mobile/lib/api';

export interface Professional {
  id: string;
  name: string;
  avatar_url?: string;
  specialty: string;
  bio: string;
  email?: string;
  phone?: string;
  instagram?: string;
  website?: string;
  city?: string;
  country?: string;
  verified?: boolean;
}

export interface CampaignFeedItem {
  id: string;
  title?: string;
  business_name?: string;
  cover_image_url?: string;
  short_description?: string;
  discount_pct?: number;
  coupon_code?: string;
  end_date?: string;
  limited_time_offer?: boolean;
  location?: {
    city?: string;
    country?: string;
    region?: string;
  };
}

type SortOption = 'newest' | 'ending_soon' | 'highest_discount';

export function ExpertsDirectoryScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const isRtl = I18nManager.isRTL;

  // Tabs: 'experts' | 'campaigns'
  const [activeTab, setActiveTab] = useState<'experts' | 'campaigns'>('experts');

  // Experts state
  const { experts, loading: expertsLoading, fetchExperts } = useExpertsStore({ prewarm: true });
  const [expertsRefreshing, setExpertsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProfession, setSelectedProfession] = useState<string>('all');

  // Campaigns state
  const [campaigns, setCampaigns] = useState<CampaignFeedItem[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [campaignsRefreshing, setCampaignsRefreshing] = useState(false);
  const [campaignSort, setCampaignSort] = useState<SortOption>('newest');
  const [showSortModal, setShowSortModal] = useState(false);

  // Fast Scroll to Top floater state
  const flatListRef = useRef<FlatList>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const handleScroll = (e: any) => {
    const y = e?.nativeEvent?.contentOffset?.y ?? 0;
    if (y > 250 && !showScrollTop) {
      setShowScrollTop(true);
    } else if (y <= 250 && showScrollTop) {
      setShowScrollTop(false);
    }
  };

  // Refresh experts
  const onRefreshExperts = useCallback(async () => {
    setExpertsRefreshing(true);
    try {
      await fetchExperts({}, { force: true });
    } finally {
      setExpertsRefreshing(false);
    }
  }, [fetchExperts]);

  // Fetch campaigns
  const fetchCampaignsList = useCallback(async (sortOpt: SortOption = campaignSort, silent = false) => {
    if (!silent) setCampaignsLoading(true);
    try {
      const res = await ((campaignApi as any)?.getCampaignFeed?.({
        sort: sortOpt,
        limit: 20,
      }) ?? api?.getCampaignFeed?.({ sort: sortOpt, limit: 20 }));
      const items = res?.items || (Array.isArray(res) ? res : []);
      setCampaigns(items);
    } catch {
      setCampaigns([]);
    } finally {
      setCampaignsLoading(false);
      setCampaignsRefreshing(false);
    }
  }, [campaignSort]);

  useEffect(() => {
    if (activeTab === 'campaigns') {
      fetchCampaignsList(campaignSort);
    }
  }, [activeTab, campaignSort, fetchCampaignsList]);

  const onRefreshCampaigns = useCallback(async () => {
    setCampaignsRefreshing(true);
    await fetchCampaignsList(campaignSort, true);
  }, [campaignSort, fetchCampaignsList]);

  // Format experts list
  const pros: Professional[] = useMemo(() => {
    return experts.map((p: any) => {
      const dName = p.display_name || p.name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Style Expert';
      const rawPhone = p.phone || p.professional?.business?.phone || '';
      const cleanPhone = typeof rawPhone === 'string' && rawPhone.trim().length > 3 ? rawPhone.trim() : undefined;
      return {
        id: p.id || p._id || Math.random().toString(),
        name: dName,
        avatar_url: p.avatar_url || p.face_photo_url || undefined,
        specialty: p.specialty || p.professional?.profession || 'Fashion Stylist',
        bio: p.bio || p.professional?.business?.description || '',
        email: p.email || p.professional?.business?.email || undefined,
        phone: cleanPhone,
        instagram: p.instagram || undefined,
        website: p.website || p.professional?.business?.website || undefined,
        city: p.city || p.address?.city || p.home_location?.city || undefined,
        country: p.country || p.address?.country || p.home_location?.country || undefined,
        verified: p.verified || p.professional?.approval_status === 'approved' || p.professional?.approval_status === 'self',
      };
    });
  }, [experts]);

  const professions = useMemo(() => {
    const set = new Set(pros.map((p) => p.specialty).filter(Boolean));
    return ['all', ...Array.from(set)];
  }, [pros]);

  const filteredPros = useMemo(() => {
    return pros.filter((p) => {
      if (selectedProfession !== 'all' && p.specialty !== selectedProfession) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = p.name?.toLowerCase().includes(q);
        const matchSpec = p.specialty?.toLowerCase().includes(q);
        const matchBio = p.bio?.toLowerCase().includes(q);
        const matchCity = p.city?.toLowerCase().includes(q);
        if (!matchName && !matchSpec && !matchBio && !matchCity) return false;
      }
      return true;
    });
  }, [pros, selectedProfession, searchQuery]);

  const s = makeStyles(colors);

  // Render Single Expert Card
  const renderPro = ({ item }: { item: Professional }) => {
    const initials = (item.name || '?').substring(0, 2).toUpperCase();
    const locationStr = [item.city, item.country].filter(Boolean).join(', ');

    return (
      <View style={s.card}>
        <View style={[s.cardTop, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
          {item.avatar_url ? (
            <Image source={{ uri: item.avatar_url }} style={s.avatarImg} />
          ) : (
            <View style={s.avatar}>
              <Text style={s.avatarText}>{initials}</Text>
            </View>
          )}
          <View style={s.cardInfo}>
            <View style={[s.nameRow, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
              <Text style={s.name}>{item.name}</Text>
              {item.verified && (
                <View style={s.verifiedBadge}>
                  <Lucide.Check size={10} color="#FFF" />
                </View>
              )}
            </View>
            {item.specialty ? (
              <Text style={[s.specialty, { textAlign: isRtl ? 'right' : 'left' }]}>
                {labelForProfession(item.specialty, t)}
              </Text>
            ) : null}
            {locationStr ? (
              <View style={[s.locRow, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
                <Lucide.MapPin size={12} color={colors.mutedFg} />
                <Text style={s.location}>{locationStr}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {item.bio ? (
          <Text style={[s.bio, { textAlign: isRtl ? 'right' : 'left' }]} numberOfLines={3}>
            {item.bio}
          </Text>
        ) : null}

        <View style={[s.links, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
          {item.email ? (
            <TouchableOpacity style={s.link} onPress={() => Linking.openURL(`mailto:${item.email}`)}>
              <Lucide.Mail size={13} color={colors.foreground} />
              <Text style={s.linkText}>{t('experts.email', { defaultValue: 'Email' })}</Text>
            </TouchableOpacity>
          ) : null}
          {item.phone ? (
            <TouchableOpacity
              style={s.link}
              onPress={() => {
                const clean = item.phone!.replace(/[^+\d]/g, '');
                Linking.openURL(`tel:${clean}`).catch((err) => {
                  console.warn('[Experts] Call error:', err);
                });
              }}
            >
              <Lucide.Phone size={13} color={colors.foreground} />
              <Text style={s.linkText}>{t('experts.callNow', { defaultValue: 'Call' })}</Text>
            </TouchableOpacity>
          ) : null}
          {item.website ? (
            <TouchableOpacity
              style={s.link}
              onPress={() => {
                const url = item.website!.startsWith('http') ? item.website! : `https://${item.website!}`;
                Linking.openURL(url);
              }}
            >
              <Lucide.Globe size={13} color={colors.foreground} />
              <Text style={s.linkText}>{t('experts.website', { defaultValue: 'Website' })}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  };

  // Render Single Campaign Card
  const renderCampaign = ({ item }: { item: CampaignFeedItem }) => {
    let daysLeft: number | null = null;
    if (item.end_date) {
      const diff = Math.ceil((new Date(item.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (diff >= 0) daysLeft = diff;
    }
    const locationStr = [item.location?.city, item.location?.country].filter(Boolean).join(', ');

    return (
      <TouchableOpacity
        style={s.campaignCard}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('CampaignDetail', { campaignId: item.id })}
      >
        {/* Cover image */}
        <View style={s.campaignCoverWrap}>
          {item.cover_image_url ? (
            <Image source={{ uri: item.cover_image_url }} style={s.campaignCoverImg} resizeMode="cover" />
          ) : (
            <View style={s.campaignCoverPlaceholder}>
              <Lucide.Tag size={32} color={colors.mutedFg} opacity={0.4} />
            </View>
          )}

          {/* Discount Badge */}
          {item.discount_pct != null && item.discount_pct > 0 ? (
            <View style={[s.campaignDiscountBadge, { [isRtl ? 'left' : 'right']: spacing[2.5] }]}>
              <Lucide.Percent size={10} color="#FFF" style={{ marginRight: 2 }} />
              <Text style={s.campaignDiscountText}>
                {item.discount_pct}
                {t('campaigns.card.off', { defaultValue: '% OFF' })}
              </Text>
            </View>
          ) : item.limited_time_offer ? (
            <View style={[s.campaignLimitedBadge, { [isRtl ? 'left' : 'right']: spacing[2.5] }]}>
              <Text style={s.campaignLimitedText}>
                {t('campaigns.card.limitedTime', { defaultValue: 'Limited Time' })}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Content */}
        <View style={s.campaignContent}>
          {item.business_name ? (
            <Text style={[s.campaignBusiness, { textAlign: isRtl ? 'right' : 'left' }]}>
              {item.business_name.toUpperCase()}
            </Text>
          ) : null}

          {item.title ? (
            <Text style={[s.campaignTitle, { textAlign: isRtl ? 'right' : 'left' }]} numberOfLines={2}>
              {item.title}
            </Text>
          ) : null}

          {item.short_description ? (
            <Text style={[s.campaignDesc, { textAlign: isRtl ? 'right' : 'left' }]} numberOfLines={2}>
              {item.short_description}
            </Text>
          ) : null}

          {/* Footer details: location + expiry */}
          <View style={[s.campaignFooter, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
            {locationStr ? (
              <View style={[s.locRow, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
                <Lucide.MapPin size={12} color={colors.mutedFg} />
                <Text style={s.location}>{locationStr}</Text>
              </View>
            ) : <View />}

            {daysLeft !== null ? (
              <View style={[s.locRow, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
                <Lucide.Clock size={12} color={daysLeft <= 3 ? '#ef4444' : colors.mutedFg} />
                <Text style={[s.location, daysLeft <= 3 && { color: '#ef4444', fontFamily: fonts.bodyMedium }]}>
                  {daysLeft === 0
                    ? t('campaigns.card.expirestoday', { defaultValue: 'Expires today' })
                    : t('campaigns.card.expiresInDays', { count: daysLeft, defaultValue: `Expires in ${daysLeft} days` })}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const sortOptions: { value: SortOption; label: string }[] = [
    { value: 'newest', label: t('campaigns.feed.sort.newest', { defaultValue: 'Newest' }) },
    { value: 'ending_soon', label: t('campaigns.feed.sort.endingSoon', { defaultValue: 'Ending Soon' }) },
    { value: 'highest_discount', label: t('campaigns.feed.sort.highestDiscount', { defaultValue: 'Highest Discount' }) },
  ];

  const currentSortLabel = sortOptions.find((o) => o.value === campaignSort)?.label || t('campaigns.feed.sort.newest', { defaultValue: 'Newest' });

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      {/* Eyebrow & Header Title */}
      <View style={s.header}>
        <View style={[s.headerTop, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
          <View style={{ flex: 1 }}>
            <Text style={[s.eyebrow, { textAlign: isRtl ? 'right' : 'left' }]}>
              {t('nav.experts', { defaultValue: 'EXPERTS' }).toUpperCase()}
            </Text>
            <Text style={[s.headerTitle, { textAlign: isRtl ? 'right' : 'left' }]}>
              {activeTab === 'campaigns'
                ? t('campaigns.feed.title', { defaultValue: 'Local Campaigns' })
                : t('experts.title', { defaultValue: 'Ask a professional' })}
            </Text>
          </View>
          <HelpFloater screenTopic={activeTab === 'campaigns' ? 'campaigns_feed' : 'experts_registry'} />
        </View>
        <Text style={[s.headerSubtitle, { textAlign: isRtl ? 'right' : 'left' }]}>
          {activeTab === 'campaigns'
            ? t('campaigns.feed.subtitle', { defaultValue: 'Exclusive fashion offers from experts near you.' })
            : t('experts.subtitle', { defaultValue: 'Browse verified fashion experts — stylists, tailors, barbers, designers — in your region.' })}
        </Text>

        {/* Count Badge on Experts Tab */}
        {activeTab === 'experts' && (
          <View style={[s.countBadgeWrap, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
            <View style={s.countBadge}>
              <Text style={s.countBadgeText}>
                {t('experts.countLabel', { count: filteredPros.length, defaultValue: `${filteredPros.length} EXPERTS` }).toUpperCase()}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Segmented Pill Tab Bar */}
      <View style={s.tabBarWrap}>
        <View style={[s.tabBarContainer, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
          <TouchableOpacity
            style={[s.tabPill, activeTab === 'experts' && s.tabPillActive, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}
            onPress={() => setActiveTab('experts')}
            activeOpacity={0.7}
          >
            <Lucide.UserRound
              size={15}
              color={activeTab === 'experts' ? colors.foreground : colors.mutedFg}
            />
            <Text style={[s.tabPillText, activeTab === 'experts' && s.tabPillTextActive]}>
              {t('experts.tabExperts', { defaultValue: 'Experts' })}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.tabPill, activeTab === 'campaigns' && s.tabPillActive, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}
            onPress={() => setActiveTab('campaigns')}
            activeOpacity={0.7}
          >
            <Lucide.Megaphone
              size={15}
              color={activeTab === 'campaigns' ? colors.foreground : colors.mutedFg}
            />
            <Text style={[s.tabPillText, activeTab === 'campaigns' && s.tabPillTextActive]}>
              {t('experts.tabCampaigns', { defaultValue: 'Campaigns' })}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ---- TAB 1: EXPERTS TAB ---- */}
      {activeTab === 'experts' && (
        <>
          {/* Search Input */}
          <View style={s.searchWrap}>
            <View style={[s.searchBox, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
              <Lucide.Search size={16} color={colors.mutedFg} />
              <TextInput
                style={[s.searchInput, { textAlign: isRtl ? 'right' : 'left' }]}
                placeholder={t('experts.searchPlaceholder', { defaultValue: 'Search by name, city, specialty…' })}
                placeholderTextColor={colors.mutedFg}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Lucide.X size={16} color={colors.mutedFg} />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          {/* Profession filter chips */}
          {professions.length > 2 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={s.filterScroll}
              contentContainerStyle={[s.filterRow, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}
            >
              {professions.map((prof) => {
                const isSel = selectedProfession === prof;
                return (
                  <TouchableOpacity
                    key={prof}
                    style={[s.filterChip, isSel && s.filterChipActive]}
                    onPress={() => setSelectedProfession(prof as string)}
                  >
                    <Text style={[s.filterChipText, isSel && s.filterChipTextActive]}>
                      {labelForProfession(prof, t)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {expertsLoading ? (
            <View style={s.center}>
              <ActivityIndicator color={colors.primary} size="large" />
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={filteredPros}
              renderItem={renderPro}
              keyExtractor={(i) => i.id}
              contentContainerStyle={s.list}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              refreshControl={
                <RefreshControl
                  refreshing={expertsRefreshing}
                  onRefresh={onRefreshExperts}
                  tintColor={colors.primary}
                />
              }
              ListEmptyComponent={
                <View style={s.center}>
                  <Lucide.Users size={48} color={colors.mutedFg} style={{ marginBottom: spacing[3] }} />
                  <Text style={s.emptyText}>{t('experts.empty', { defaultValue: 'No experts listed yet.' })}</Text>
                </View>
              }
            />
          )}
        </>
      )}

      {/* ---- TAB 2: CAMPAIGNS TAB ---- */}
      {activeTab === 'campaigns' && (
        <>
          {/* Sort bar */}
          <View style={[s.campaignSortBar, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
            <TouchableOpacity
              style={[s.sortButton, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}
              onPress={() => setShowSortModal(true)}
              activeOpacity={0.7}
            >
              <Lucide.SlidersHorizontal size={14} color={colors.foreground} />
              <Text style={s.sortButtonText}>{currentSortLabel}</Text>
              <Lucide.ChevronDown size={14} color={colors.mutedFg} />
            </TouchableOpacity>
          </View>

          {campaignsLoading ? (
            <View style={s.center}>
              <ActivityIndicator color={colors.primary} size="large" />
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={campaigns}
              renderItem={renderCampaign}
              keyExtractor={(i) => i.id}
              contentContainerStyle={s.list}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              refreshControl={
                <RefreshControl
                  refreshing={campaignsRefreshing}
                  onRefresh={onRefreshCampaigns}
                  tintColor={colors.primary}
                />
              }
              ListEmptyComponent={
                <View style={s.emptyContainer}>
                  <Text style={s.emptyTitleText}>
                    {t('campaigns.feed.empty.title', { defaultValue: 'No Campaigns Near You' })}
                  </Text>
                  <Text style={s.emptySubtitleText}>
                    {t('campaigns.feed.empty.body', {
                      defaultValue: 'Check back soon — local experts may be posting new offers.',
                    })}
                  </Text>
                </View>
              }
            />
          )}
        </>
      )}

      {/* Sort Options Modal */}
      <Modal
        visible={showSortModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSortModal(false)}
      >
        <Pressable style={s.modalOverlay} onPress={() => setShowSortModal(false)}>
          <View style={s.modalContent}>
            <Text style={[s.modalTitle, { textAlign: isRtl ? 'right' : 'left' }]}>
              {t('campaigns.feed.sort.title', { defaultValue: 'Sort Campaigns' })}
            </Text>
            {sortOptions.map((opt) => {
              const isSelected = campaignSort === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    s.modalOption,
                    isSelected && s.modalOptionSelected,
                    { flexDirection: isRtl ? 'row-reverse' : 'row' },
                  ]}
                  onPress={() => {
                    setCampaignSort(opt.value);
                    setShowSortModal(false);
                  }}
                >
                  <Text
                    style={[
                      s.modalOptionText,
                      isSelected && s.modalOptionTextSelected,
                      { textAlign: isRtl ? 'right' : 'left' },
                    ]}
                  >
                    {opt.label}
                  </Text>
                  {isSelected && <Lucide.Check size={16} color={colors.primary} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Modal>

      {/* ── Fast Scroll To Top Floater ─────────────────────────────── */}
      <ScrollToTopFloater
        visible={showScrollTop}
        onPress={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true })}
      />
    </SafeAreaView>
  );
}

function makeStyles(c: ReturnType<typeof import('@mobile/theme').useTheme>['colors']) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[8] },
    header: { paddingHorizontal: spacing[5], paddingTop: spacing[2], paddingBottom: spacing[2] },
    headerTop: { alignItems: 'flex-start', justifyContent: 'space-between' },
    eyebrow: {
      fontFamily: fonts.bodyMedium,
      fontSize: fontSizes.xs,
      color: c.mutedFg,
      letterSpacing: 1,
      marginBottom: 2,
    },
    headerTitle: { fontFamily: fonts.display, fontSize: fontSizes['2xl'], color: c.foreground },
    headerSubtitle: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: c.mutedFg, marginTop: 4, lineHeight: 19 },
    countBadgeWrap: { marginTop: spacing[2] },
    countBadge: {
      paddingHorizontal: spacing[2.5],
      paddingVertical: 3,
      borderRadius: radii.full,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.card,
    },
    countBadgeText: {
      fontFamily: fonts.bodyMedium,
      fontSize: 10,
      color: c.foreground,
      letterSpacing: 0.8,
    },
    tabBarWrap: { paddingHorizontal: spacing[5], marginVertical: spacing[2.5] },
    tabBarContainer: {
      backgroundColor: c.secondary,
      borderRadius: radii.xl,
      padding: 4,
      alignSelf: 'flex-start',
      gap: 4,
    },
    tabPill: {
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[2],
      borderRadius: radii.lg,
      alignItems: 'center',
      gap: spacing[2],
    },
    tabPillActive: {
      backgroundColor: c.card,
      ...shadows.sm,
    },
    tabPillText: {
      fontFamily: fonts.bodyMedium,
      fontSize: fontSizes.sm,
      color: c.mutedFg,
    },
    tabPillTextActive: {
      fontFamily: fonts.bodyMedium,
      color: c.foreground,
    },
    searchWrap: { paddingHorizontal: spacing[4], paddingTop: spacing[1], paddingBottom: spacing[2] },
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.secondary,
      borderRadius: radii.xl,
      paddingHorizontal: spacing[3.5],
      height: 46,
      borderWidth: 1,
      borderColor: c.border,
      gap: spacing[2],
    },
    searchInput: {
      flex: 1,
      fontFamily: fonts.body,
      fontSize: fontSizes.sm,
      color: c.foreground,
      paddingVertical: 0,
    },
    filterScroll: { flexGrow: 0, height: 48, marginBottom: spacing[2] },
    filterRow: { paddingHorizontal: spacing[4], alignItems: 'center', gap: spacing[2] },
    filterChip: {
      height: 36,
      paddingHorizontal: spacing[4],
      borderRadius: radii.full,
      backgroundColor: c.secondary,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    filterChipActive: { backgroundColor: c.primary, borderColor: c.primary },
    filterChipText: {
      fontFamily: fonts.bodyMedium,
      fontSize: fontSizes.sm,
      color: c.mutedFg,
      includeFontPadding: false,
      textAlignVertical: 'center',
    },
    filterChipTextActive: { color: '#FFF' },
    list: { padding: spacing[4], gap: spacing[3], paddingBottom: spacing[12] },
    card: {
      backgroundColor: c.card,
      borderRadius: radii.xl,
      padding: spacing[4],
      gap: spacing[3],
      borderWidth: 1,
      borderColor: c.border,
    },
    cardTop: { gap: spacing[3], alignItems: 'center' },
    avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
    avatarImg: { width: 50, height: 50, borderRadius: 25, backgroundColor: c.secondary },
    avatarText: { fontFamily: fonts.display, fontSize: fontSizes.lg, color: '#fff' },
    cardInfo: { flex: 1, gap: 2 },
    nameRow: { gap: spacing[1.5], alignItems: 'center' },
    name: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.base, color: c.foreground },
    verifiedBadge: { width: 16, height: 16, borderRadius: 8, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
    specialty: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.xs, color: c.primary },
    locRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
    location: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: c.mutedFg },
    bio: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: c.foreground, lineHeight: 20 },
    links: { gap: spacing[2], flexWrap: 'wrap', marginTop: spacing[1] },
    link: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[1.5],
      backgroundColor: c.secondary,
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[1.5],
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: c.border,
    },
    linkText: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.xs, color: c.foreground },
    emptyText: { fontFamily: fonts.body, fontSize: fontSizes.base, color: c.mutedFg, textAlign: 'center' },

    // Campaigns styles
    campaignSortBar: {
      paddingHorizontal: spacing[5],
      paddingVertical: spacing[1],
      justifyContent: 'flex-end',
      alignItems: 'center',
    },
    sortButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[1.5],
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[2],
      borderRadius: radii.lg,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
    },
    sortButtonText: {
      fontFamily: fonts.bodyMedium,
      fontSize: fontSizes.xs,
      color: c.foreground,
    },
    campaignCard: {
      backgroundColor: c.card,
      borderRadius: radii.xl,
      borderWidth: 1,
      borderColor: c.border,
      overflow: 'hidden',
      marginBottom: spacing[3],
      ...shadows.sm,
    },
    campaignCoverWrap: {
      width: '100%',
      aspectRatio: 16 / 9,
      backgroundColor: c.secondary,
      position: 'relative',
    },
    campaignCoverImg: { width: '100%', height: '100%' },
    campaignCoverPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    campaignDiscountBadge: {
      position: 'absolute',
      top: spacing[2.5],
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#10b981',
      paddingHorizontal: spacing[2.5],
      paddingVertical: 3,
      borderRadius: radii.full,
      ...shadows.sm,
    },
    campaignDiscountText: {
      fontFamily: fonts.bodyMedium,
      fontSize: fontSizes.xs,
      color: '#FFF',
      fontWeight: '700',
    },
    campaignLimitedBadge: {
      position: 'absolute',
      top: spacing[2.5],
      backgroundColor: '#f97316',
      paddingHorizontal: spacing[2.5],
      paddingVertical: 3,
      borderRadius: radii.full,
      ...shadows.sm,
    },
    campaignLimitedText: {
      fontFamily: fonts.bodyMedium,
      fontSize: fontSizes.xs,
      color: '#FFF',
      fontWeight: '700',
    },
    campaignContent: {
      padding: spacing[4],
      gap: spacing[1.5],
    },
    campaignBusiness: {
      fontFamily: fonts.bodyMedium,
      fontSize: 10,
      color: c.mutedFg,
      letterSpacing: 0.8,
    },
    campaignTitle: {
      fontFamily: fonts.display,
      fontSize: fontSizes.base,
      color: c.foreground,
      lineHeight: 22,
    },
    campaignDesc: {
      fontFamily: fonts.body,
      fontSize: fontSizes.xs,
      color: c.mutedFg,
      lineHeight: 18,
    },
    campaignFooter: {
      marginTop: spacing[2],
      paddingTop: spacing[2],
      borderTopWidth: 1,
      borderTopColor: c.border,
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing[16],
      paddingHorizontal: spacing[8],
    },
    emptyTitleText: {
      fontFamily: fonts.display,
      fontSize: fontSizes.xl,
      color: c.foreground,
      textAlign: 'center',
      marginBottom: spacing[2],
    },
    emptySubtitleText: {
      fontFamily: fonts.body,
      fontSize: fontSizes.sm,
      color: c.mutedFg,
      textAlign: 'center',
      lineHeight: 20,
    },

    // Sort modal
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing[6],
    },
    modalContent: {
      width: '100%',
      maxWidth: 340,
      backgroundColor: c.card,
      borderRadius: radii.xl,
      padding: spacing[5],
      borderWidth: 1,
      borderColor: c.border,
      gap: spacing[2],
    },
    modalTitle: {
      fontFamily: fonts.display,
      fontSize: fontSizes.lg,
      color: c.foreground,
      marginBottom: spacing[2],
    },
    modalOption: {
      paddingVertical: spacing[3],
      paddingHorizontal: spacing[3],
      borderRadius: radii.lg,
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    modalOptionSelected: {
      backgroundColor: c.secondary,
    },
    modalOptionText: {
      fontFamily: fonts.body,
      fontSize: fontSizes.sm,
      color: c.foreground,
      flex: 1,
    },
    modalOptionTextSelected: {
      fontFamily: fonts.bodyMedium,
      color: c.primary,
    },
  });
}
