/**
 * apps/mobile/src/screens/me/ExpertsDirectoryScreen.tsx
 * Core loop: api.listProfessionals() → directory list with contact info.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Linking, I18nManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii } from '@mobile/theme/tokens';
import { api } from '@mobile/lib/api';

interface Professional {
  id: string;
  name?: string;
  specialty?: string;
  bio?: string;
  email?: string;
  instagram?: string;
  website?: string;
  city?: string;
  country?: string;
  verified?: boolean;
}

export function ExpertsDirectoryScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [pros, setPros] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await api.listProfessionals();
      setPros(Array.isArray(data) ? data : (data?.professionals ?? []));
    } catch { /* silent */ } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const s = makeStyles(colors);
  const isRtl = I18nManager.isRTL;

  const renderPro = ({ item }: { item: Professional }) => (
    <View style={s.card}>
      <View style={[s.cardTop, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{(item.name ?? '?')[0].toUpperCase()}</Text>
        </View>
        <View style={s.cardInfo}>
          <View style={[s.nameRow, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
            <Text style={s.name}>{item.name}</Text>
            {item.verified && <Text style={s.verifiedBadge}>✓</Text>}
          </View>
          {item.specialty && <Text style={s.specialty}>{item.specialty}</Text>}
          {(item.city || item.country) && (
            <Text style={s.location}>{[item.city, item.country].filter(Boolean).join(', ')}</Text>
          )}
        </View>
      </View>
      {item.bio ? <Text style={s.bio} numberOfLines={3}>{item.bio}</Text> : null}
      <View style={[s.links, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
        {item.email && (
          <TouchableOpacity style={s.link} onPress={() => Linking.openURL(`mailto:${item.email}`)}>
            <Text style={s.linkText}>✉ {t('experts.email', 'Email')}</Text>
          </TouchableOpacity>
        )}
        {item.instagram && (
          <TouchableOpacity style={s.link} onPress={() => Linking.openURL(`https://instagram.com/${item.instagram!.replace('@', '')}`)}>
            <Text style={s.linkText}>📸 Instagram</Text>
          </TouchableOpacity>
        )}
        {item.website && (
          <TouchableOpacity style={s.link} onPress={() => Linking.openURL(item.website!)}>
            <Text style={s.linkText}>🌐 {t('experts.website', 'Website')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  if (loading) return <SafeAreaView style={[s.root, s.center]}><ActivityIndicator color={colors.accent} size="large" /></SafeAreaView>;

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <Text style={s.headerTitle}>{t('experts.title', 'Style Experts')}</Text>
      <FlatList
        data={pros}
        renderItem={renderPro}
        keyExtractor={(i) => i.id}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={colors.accent} />}
        ListEmptyComponent={<View style={s.center}><Text style={s.emptyText}>{t('experts.empty', 'No experts listed yet.')}</Text></View>}
      />
    </SafeAreaView>
  );
}

function makeStyles(c: ReturnType<typeof import('@mobile/theme').useTheme>['colors']) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[8] },
    headerTitle: { fontFamily: fonts.display, fontSize: fontSizes['2xl'], color: c.foreground, paddingHorizontal: spacing[5], paddingVertical: spacing[3] },
    list: { padding: spacing[4], gap: spacing[3] },
    card: { backgroundColor: c.card, borderRadius: radii.xl, padding: spacing[4], gap: spacing[3], borderWidth: 1, borderColor: c.border },
    cardTop: { gap: spacing[3], alignItems: 'flex-start' },
    avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontFamily: fonts.display, fontSize: fontSizes.xl, color: '#fff' },
    cardInfo: { flex: 1, gap: 2 },
    nameRow: { gap: spacing[1], alignItems: 'center' },
    name: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.base, color: c.foreground },
    verifiedBadge: { fontSize: 14, color: c.accent },
    specialty: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: c.accent },
    location: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: c.mutedFg },
    bio: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: c.foreground, lineHeight: 20 },
    links: { gap: spacing[2], flexWrap: 'wrap' },
    link: { backgroundColor: c.muted, paddingHorizontal: spacing[3], paddingVertical: spacing[1], borderRadius: radii.lg },
    linkText: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.xs, color: c.foreground },
    emptyText: { fontFamily: fonts.body, fontSize: fontSizes.base, color: c.mutedFg, textAlign: 'center' },
  });
}
