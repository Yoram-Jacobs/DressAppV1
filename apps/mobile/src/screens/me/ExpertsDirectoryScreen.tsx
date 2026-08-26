/**
 * apps/mobile/src/screens/me/ExpertsDirectoryScreen.tsx
 * Core loop: api.listProfessionals() → directory list with contact info & business details.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Image,
  TextInput,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as Lucide from 'lucide-react-native';
import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii } from '@mobile/theme/tokens';
import { useExpertsStore } from '@mobile/lib/stores';

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

export function ExpertsDirectoryScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { experts, loading, fetchExperts } = useExpertsStore({ prewarm: true });
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProfession, setSelectedProfession] = useState<string>('all');

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchExperts({}, { force: true });
    } finally {
      setRefreshing(false);
    }
  }, [fetchExperts]);

  const pros: Professional[] = useMemo(() => {
    return experts.map((p: any) => {
      const dName = p.display_name || p.name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Style Expert';
      return {
        id: p.id || p._id || Math.random().toString(),
        name: dName,
        avatar_url: p.avatar_url || p.face_photo_url || undefined,
        specialty: p.specialty || p.professional?.profession || 'Fashion Stylist',
        bio: p.bio || p.professional?.business?.description || '',
        email: p.email || p.professional?.business?.email || undefined,
        phone: p.phone || p.professional?.business?.phone || undefined,
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
  const isRtl = I18nManager.isRTL;

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
            {item.specialty ? <Text style={s.specialty}>{item.specialty}</Text> : null}
            {locationStr ? (
              <View style={[s.locRow, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
                <Lucide.MapPin size={12} color={colors.mutedFg} />
                <Text style={s.location}>{locationStr}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {item.bio ? <Text style={s.bio} numberOfLines={3}>{item.bio}</Text> : null}

        <View style={[s.links, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
          {item.email ? (
            <TouchableOpacity style={s.link} onPress={() => Linking.openURL(`mailto:${item.email}`)}>
              <Lucide.Mail size={13} color={colors.foreground} />
              <Text style={s.linkText}>{t('experts.email', { defaultValue: 'Email' })}</Text>
            </TouchableOpacity>
          ) : null}
          {item.phone ? (
            <TouchableOpacity style={s.link} onPress={() => Linking.openURL(`tel:${item.phone}`)}>
              <Lucide.Phone size={13} color={colors.foreground} />
              <Text style={s.linkText}>{t('experts.phone', { defaultValue: 'Call' })}</Text>
            </TouchableOpacity>
          ) : null}
          {item.website ? (
            <TouchableOpacity style={s.link} onPress={() => {
              const url = item.website!.startsWith('http') ? item.website! : `https://${item.website!}`;
              Linking.openURL(url);
            }}>
              <Lucide.Globe size={13} color={colors.foreground} />
              <Text style={s.linkText}>{t('experts.website', { defaultValue: 'Website' })}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <View style={s.header}>
        <Text style={s.headerTitle}>{t('experts.title', { defaultValue: 'Style Experts' })}</Text>
        <Text style={s.headerSubtitle}>{t('experts.subtitle', { defaultValue: 'Connect with certified stylists, designers, and tailors' })}</Text>
      </View>

      {/* Search Input */}
      <View style={s.searchWrap}>
        <View style={s.searchBox}>
          <Lucide.Search size={16} color={colors.mutedFg} />
          <TextInput
            style={s.searchInput}
            placeholder={t('experts.searchPlaceholder', { defaultValue: 'Search experts by name, specialty, or city...' })}
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
          contentContainerStyle={s.filterRow}
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
                  {prof === 'all' ? t('closet.filterAll', { defaultValue: 'All' }) : prof}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={filteredPros}
          renderItem={renderPro}
          keyExtractor={(i) => i.id}
          contentContainerStyle={s.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
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
    </SafeAreaView>
  );
}

function makeStyles(c: ReturnType<typeof import('@mobile/theme').useTheme>['colors']) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[8] },
    header: { paddingHorizontal: spacing[5], paddingTop: spacing[3], paddingBottom: spacing[2] },
    headerTitle: { fontFamily: fonts.display, fontSize: fontSizes['2xl'], color: c.foreground },
    headerSubtitle: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: c.mutedFg, marginTop: 2 },
    searchWrap: { paddingHorizontal: spacing[4], paddingTop: spacing[2], paddingBottom: spacing[2.5] },
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
  });
}
