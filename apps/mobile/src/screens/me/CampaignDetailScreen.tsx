/**
 * apps/mobile/src/screens/me/CampaignDetailScreen.tsx
 *
 * Campaign detail view for experts.
 * Core loop: api.getCampaign(id) → show full campaign + lifecycle actions.
 * Actions available by status:
 *   draft/rejected: edit (re-submit) | delete
 *   pending_approval: no actions (waiting)
 *   active: pause | share | extend (TODO)
 *   paused: resume | cancel
 *   cancelled: read-only
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
  Share,
  I18nManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii } from '@mobile/theme/tokens';
import { api } from '@mobile/lib/api';
import type { MeStackParamList } from '@mobile/navigation/types';

type MeNavProp = NativeStackNavigationProp<MeStackParamList, 'CampaignDetail'>;
type MeRoute   = RouteProp<MeStackParamList, 'CampaignDetail'>;

interface Campaign {
  id: string;
  title?: string;
  status?: string;
  description?: string;
  budget_cents?: number;
  currency?: string;
  start_date?: string;
  end_date?: string;
  target_audience?: string;
  location?: string;
  views_count?: number;
  saves_count?: number;
  shares_count?: number;
  created_at?: string;
}

const STATUS_LABELS: Record<string, string> = {
  draft:            'Draft',
  pending_approval: 'Pending approval',
  active:           'Active ✓',
  paused:           'Paused',
  cancelled:        'Cancelled',
  rejected:         'Rejected',
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  draft:            { bg: 'hsl(240,5%,90%)',  text: 'hsl(240,5%,40%)' },
  pending_approval: { bg: 'hsl(45,90%,88%)',  text: 'hsl(35,80%,30%)' },
  active:           { bg: 'hsl(142,60%,88%)', text: 'hsl(142,60%,25%)' },
  paused:           { bg: 'hsl(45,90%,88%)',  text: 'hsl(35,80%,30%)' },
  cancelled:        { bg: 'hsl(0,60%,90%)',   text: 'hsl(0,60%,40%)' },
  rejected:         { bg: 'hsl(0,60%,90%)',   text: 'hsl(0,60%,40%)' },
};

export function CampaignDetailScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<MeNavProp>();
  const route = useRoute<MeRoute>();
  const { colors } = useTheme();
  const { campaignId } = route.params;

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setCampaign(await api.getCampaign(campaignId));
    } catch { /* silent */ } finally { setLoading(false); }
  }, [campaignId]);

  useEffect(() => { load(); }, [load]);

  const handlePause = async () => {
    setActing(true);
    try {
      await api.pauseCampaign(campaignId);
      setCampaign((c) => c ? { ...c, status: 'paused' } : c);
    } catch (err: unknown) {
      Alert.alert(t('common.error', 'Error'), (err as { message?: string })?.message);
    } finally { setActing(false); }
  };

  const handleResume = async () => {
    setActing(true);
    try {
      await api.resumeCampaign(campaignId);
      setCampaign((c) => c ? { ...c, status: 'active' } : c);
    } catch (err: unknown) {
      Alert.alert(t('common.error', 'Error'), (err as { message?: string })?.message);
    } finally { setActing(false); }
  };

  const handleCancel = () => {
    Alert.alert(
      t('campaigns.cancelTitle', 'Cancel campaign'),
      t('campaigns.cancelMsg', 'This cannot be undone. The campaign will be permanently cancelled.'),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('campaigns.confirmCancel', 'Cancel campaign'), style: 'destructive', onPress: async () => {
            setActing(true);
            try {
              await api.cancelCampaign(campaignId);
              setCampaign((c) => c ? { ...c, status: 'cancelled' } : c);
            } catch (err: unknown) {
              Alert.alert(t('common.error', 'Error'), (err as { message?: string })?.message);
            } finally { setActing(false); }
          },
        },
      ],
    );
  };

  const handleShare = async () => {
    try {
      await api.shareCampaign(campaignId);
      await Share.share({ title: campaign?.title, message: `Check out this campaign: ${campaign?.title}` });
    } catch { /* ignore */ }
  };

  const s = makeStyles(colors);
  const isRtl = I18nManager.isRTL;

  if (loading) return <SafeAreaView style={[s.root, s.center]}><ActivityIndicator color={colors.accent} size="large" /></SafeAreaView>;
  if (!campaign) return <SafeAreaView style={[s.root, s.center]}><Text style={s.emptyText}>{t('common.notFound', 'Not found')}</Text></SafeAreaView>;

  const status = campaign.status ?? 'draft';
  const sc = STATUS_COLORS[status] ?? { bg: colors.muted, text: colors.mutedFg };

  return (
    <SafeAreaView style={s.root} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Title + status */}
        <View style={[s.titleRow, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
          <Text style={s.title} numberOfLines={3}>{campaign.title}</Text>
          <View style={[s.badge, { backgroundColor: sc.bg }]}>
            <Text style={[s.badgeText, { color: sc.text }]}>{STATUS_LABELS[status] ?? status}</Text>
          </View>
        </View>

        {/* Stats row */}
        {(campaign.views_count != null || campaign.saves_count != null || campaign.shares_count != null) && (
          <View style={[s.statsRow, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
            {campaign.views_count != null && <View style={s.statItem}><Text style={s.statValue}>{campaign.views_count}</Text><Text style={s.statLabel}>{t('campaigns.views', 'Views')}</Text></View>}
            {campaign.saves_count != null && <View style={s.statItem}><Text style={s.statValue}>{campaign.saves_count}</Text><Text style={s.statLabel}>{t('campaigns.saves', 'Saves')}</Text></View>}
            {campaign.shares_count != null && <View style={s.statItem}><Text style={s.statValue}>{campaign.shares_count}</Text><Text style={s.statLabel}>{t('campaigns.shares', 'Shares')}</Text></View>}
          </View>
        )}

        {/* Meta grid */}
        {campaign.budget_cents != null && <InfoRow icon="💰" label={t('campaigns.budget', 'Budget')} value={`${(campaign.budget_cents / 100).toFixed(0)} ${campaign.currency ?? '€'}`} colors={colors} />}
        {campaign.start_date && <InfoRow icon="📅" label={t('campaigns.startDate', 'Start')} value={campaign.start_date.slice(0, 10)} colors={colors} />}
        {campaign.end_date   && <InfoRow icon="🏁" label={t('campaigns.endDate', 'End')} value={campaign.end_date.slice(0, 10)} colors={colors} />}
        {campaign.location   && <InfoRow icon="📍" label={t('campaigns.location', 'Location')} value={campaign.location} colors={colors} />}
        {campaign.target_audience && <InfoRow icon="🎯" label={t('campaigns.audience', 'Audience')} value={campaign.target_audience} colors={colors} />}

        {/* Description */}
        {campaign.description && (
          <View style={s.descBlock}>
            <Text style={s.descTitle}>{t('campaigns.description', 'Description')}</Text>
            <Text style={s.descBody}>{campaign.description}</Text>
          </View>
        )}

        {/* Actions */}
        <View style={s.actions}>
          {status === 'active' && (
            <>
              <ActionBtn label={`⏸ ${t('campaigns.pause', 'Pause')}`} onPress={handlePause} loading={acting} colors={colors} />
              <ActionBtn label={`📤 ${t('campaigns.share', 'Share')}`} onPress={handleShare} colors={colors} variant="secondary" />
            </>
          )}
          {status === 'paused' && (
            <>
              <ActionBtn label={`▶ ${t('campaigns.resume', 'Resume')}`} onPress={handleResume} loading={acting} colors={colors} />
              <ActionBtn label={`✕ ${t('campaigns.cancel', 'Cancel')}`} onPress={handleCancel} loading={acting} colors={colors} variant="danger" />
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ icon, label, value, colors }: { icon: string; label: string; value: string; colors: ReturnType<typeof import('@mobile/theme').useTheme>['colors'] }) {
  return (
    <View style={[infoRowS.row, { borderColor: colors.border }]}>
      <Text style={infoRowS.icon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[infoRowS.label, { color: colors.mutedFg }]}>{label}</Text>
        <Text style={[infoRowS.value, { color: colors.foreground }]}>{value}</Text>
      </View>
    </View>
  );
}
const infoRowS = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing[3], alignItems: 'center', paddingVertical: spacing[2], borderBottomWidth: StyleSheet.hairlineWidth },
  icon: { fontSize: 18, width: 28, textAlign: 'center' },
  label: { fontFamily: 'Manrope_400Regular', fontSize: 11 },
  value: { fontFamily: 'Manrope_500Medium', fontSize: 14 },
});

function ActionBtn({ label, onPress, loading, colors, variant = 'primary' }: {
  label: string; onPress: () => void; loading?: boolean;
  colors: ReturnType<typeof import('@mobile/theme').useTheme>['colors']; variant?: 'primary' | 'secondary' | 'danger';
}) {
  const bg = variant === 'danger' ? colors.destructive : variant === 'secondary' ? colors.muted : colors.foreground;
  const fg = variant === 'secondary' ? colors.foreground : '#fff';
  return (
    <TouchableOpacity style={[{ backgroundColor: bg, borderRadius: radii.md, paddingVertical: spacing[3], paddingHorizontal: spacing[4], flex: 1, alignItems: 'center' }, loading ? { opacity: 0.6 } : {}]} onPress={onPress} disabled={loading}>
      {loading ? <ActivityIndicator color={fg} size="small" /> : <Text style={{ fontFamily: 'Manrope_500Medium', fontSize: 14, color: fg }}>{label}</Text>}
    </TouchableOpacity>
  );
}

function makeStyles(c: ReturnType<typeof import('@mobile/theme').useTheme>['colors']) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    scroll: { padding: spacing[5], gap: spacing[4], paddingBottom: spacing[12] },
    titleRow: { alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing[3] },
    title: { flex: 1, fontFamily: fonts.display, fontSize: fontSizes['2xl'], color: c.foreground, lineHeight: 32 },
    badge: { paddingHorizontal: spacing[2], paddingVertical: 4, borderRadius: radii.sm },
    badgeText: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.xs, textTransform: 'capitalize' },
    statsRow: { gap: spacing[4], backgroundColor: c.card, borderRadius: radii.xl, padding: spacing[4], borderWidth: 1, borderColor: c.border },
    statItem: { flex: 1, alignItems: 'center', gap: 2 },
    statValue: { fontFamily: fonts.display, fontSize: fontSizes['2xl'], color: c.foreground },
    statLabel: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: c.mutedFg },
    descBlock: { gap: spacing[2] },
    descTitle: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: c.mutedFg, textTransform: 'uppercase', letterSpacing: 0.6 },
    descBody: { fontFamily: fonts.body, fontSize: fontSizes.base, color: c.foreground, lineHeight: 24 },
    actions: { flexDirection: 'row', gap: spacing[3] },
    emptyText: { fontFamily: fonts.body, fontSize: fontSizes.base, color: c.mutedFg },
  });
}
