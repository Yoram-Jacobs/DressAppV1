/**
 * apps/mobile/src/screens/me/MyCampaignsScreen.tsx
 *
 * Expert Campaign Management — lists campaigns created by the current user.
 * Core loop:
 *  - api.campaignApi.getCampaignFeed({ mine: true }) — or fallback list
 *  - Shows status badge (draft, pending_approval, active, paused, cancelled)
 *  - Tap → CampaignDetailScreen
 *  - FAB → CreateCampaignScreen
 *  - pause/resume inline actions
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
  I18nManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii } from '@mobile/theme/tokens';
import { api } from '@mobile/lib/api';
import type { MeStackParamList } from '@mobile/navigation/types';

type MeNavProp = NativeStackNavigationProp<MeStackParamList, 'Campaigns'>;

interface Campaign {
  id: string;
  title?: string;
  status?: string;
  budget_cents?: number;
  currency?: string;
  start_date?: string;
  end_date?: string;
  description?: string;
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  draft:            { bg: 'hsl(240,5%,90%)',  text: 'hsl(240,5%,40%)' },
  pending_approval: { bg: 'hsl(45,90%,88%)',  text: 'hsl(35,80%,30%)' },
  active:           { bg: 'hsl(142,60%,88%)', text: 'hsl(142,60%,25%)' },
  paused:           { bg: 'hsl(45,90%,88%)',  text: 'hsl(35,80%,30%)' },
  cancelled:        { bg: 'hsl(0,60%,90%)',   text: 'hsl(0,60%,40%)' },
  rejected:         { bg: 'hsl(0,60%,90%)',   text: 'hsl(0,60%,40%)' },
};

export function MyCampaignsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<MeNavProp>();
  const { colors } = useTheme();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // getCampaignFeed with mine:true returns the user's own campaigns
      const data = await api.getCampaignFeed({ mine: true });
      setCampaigns(Array.isArray(data) ? data : (data?.campaigns ?? data?.items ?? []));
    } catch { /* silent */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handlePauseResume = async (c: Campaign) => {
    try {
      if (c.status === 'active') {
        await api.pauseCampaign(c.id);
        setCampaigns((prev) => prev.map((x) => x.id === c.id ? { ...x, status: 'paused' } : x));
      } else if (c.status === 'paused') {
        await api.resumeCampaign(c.id);
        setCampaigns((prev) => prev.map((x) => x.id === c.id ? { ...x, status: 'active' } : x));
      }
    } catch (err: unknown) {
      Alert.alert(t('common.error', { defaultValue: 'Error' }), (err as { message?: string })?.message ?? 'Action failed');
    }
  };

  const s = makeStyles(colors);
  const isRtl = I18nManager.isRTL;

  const renderItem = ({ item }: { item: Campaign }) => {
    const sc = STATUS_COLORS[item.status ?? ''] ?? { bg: colors.muted, text: colors.mutedFg };
    const canPauseResume = item.status === 'active' || item.status === 'paused';
    return (
      <TouchableOpacity
        style={s.card}
        onPress={() => navigation.navigate('CampaignDetail', { campaignId: item.id })}
        activeOpacity={0.8}
      >
        <View style={[s.cardTop, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
          <Text style={s.cardTitle} numberOfLines={2}>{item.title ?? t('campaigns.untitled', { defaultValue: 'Untitled campaign' })}</Text>
          <View style={[s.statusBadge, { backgroundColor: sc.bg }]}>
            <Text style={[s.statusText, { color: sc.text }]}>{item.status?.replace('_', ' ') ?? '—'}</Text>
          </View>
        </View>
        <View style={[s.cardMeta, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
          {item.budget_cents != null && (
            <Text style={s.metaItem}>
              💰 {(item.budget_cents / 100).toFixed(0)} {item.currency ?? '€'}
            </Text>
          )}
          {item.start_date && <Text style={s.metaItem}>📅 {item.start_date.slice(0, 10)}</Text>}
          {item.end_date && <Text style={s.metaItem}>→ {item.end_date.slice(0, 10)}</Text>}
        </View>
        {canPauseResume && (
          <TouchableOpacity
            style={s.actionBtn}
            onPress={(e) => { e.stopPropagation?.(); handlePauseResume(item); }}
          >
            <Text style={s.actionBtnText}>
              {item.status === 'active' ? '⏸ ' + t('campaigns.pause', { defaultValue: 'Pause' }) : '▶ ' + t('campaigns.resume', { defaultValue: 'Resume' })}
            </Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[s.root, s.center]}>
        <ActivityIndicator color={colors.accent} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <View style={[s.header, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
        <Text style={s.headerTitle}>{t('campaigns.my', { defaultValue: 'My Campaigns' })}</Text>
        <TouchableOpacity style={s.newBtn} onPress={() => navigation.navigate('CreateCampaign')}>
          <Text style={s.newBtnText}>＋ {t('campaigns.new', { defaultValue: 'New' })}</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={campaigns}
        renderItem={renderItem}
        keyExtractor={(i) => i.id}
        contentContainerStyle={s.list}
        ItemSeparatorComponent={() => <View style={{ height: spacing[3] }} />}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={colors.accent} />
        }
        ListEmptyComponent={
          <View style={s.center}>
            <Text style={s.emptyIcon}>📋</Text>
            <Text style={s.emptyTitle}>{t('campaigns.emptyTitle', { defaultValue: 'No campaigns yet' })}</Text>
            <Text style={s.emptyBody}>{t('campaigns.emptyBody', { defaultValue: 'Create your first expert campaign to reach your audience.' })}</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

function makeStyles(c: ReturnType<typeof import('@mobile/theme').useTheme>['colors']) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[8], gap: spacing[3] },
    header: { alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[5], paddingVertical: spacing[3] },
    headerTitle: { fontFamily: fonts.display, fontSize: fontSizes['2xl'], color: c.foreground },
    newBtn: { backgroundColor: c.foreground, paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radii.lg },
    newBtnText: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: c.background },
    list: { paddingHorizontal: spacing[5], paddingBottom: spacing[12] },
    card: { backgroundColor: c.card, borderRadius: radii.xl, padding: spacing[4], borderWidth: 1, borderColor: c.border, gap: spacing[2] },
    cardTop: { alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing[2] },
    cardTitle: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: fontSizes.base, color: c.foreground },
    statusBadge: { paddingHorizontal: spacing[2], paddingVertical: 3, borderRadius: radii.sm },
    statusText: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.xs, textTransform: 'capitalize' },
    cardMeta: { gap: spacing[3], flexWrap: 'wrap' },
    metaItem: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: c.mutedFg },
    actionBtn: { borderWidth: 1, borderColor: c.border, borderRadius: radii.md, paddingVertical: spacing[2], alignItems: 'center' },
    actionBtnText: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: c.foreground },
    emptyIcon: { fontSize: 48 },
    emptyTitle: { fontFamily: fonts.display, fontSize: fontSizes.xl, color: c.foreground },
    emptyBody: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: c.mutedFg, textAlign: 'center', lineHeight: 22 },
  });
}
