/**
 * apps/mobile/src/screens/me/WardrobeStatsScreen.tsx
 *
 * Wardrobe Insights — sustainability metrics from api.getSustainabilityStats()
 * Displays: utilisation %, carbon footprint, cost-per-wear trend, intake breakdown.
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, I18nManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii } from '@mobile/theme/tokens';
import { api } from '@mobile/lib/api';

interface CpwPoint { month: string; cpw: number }
interface StatsData {
  utilisation_pct?: number;
  cpw_trend?: CpwPoint[];
  intake_breakdown?: { receipt: number; manual: number };
  carbon_sum?: number;
}

// ── Minimal bar chart (no library dep) ───────────────────────────────────
function MiniBarChart({ data, color }: { data: CpwPoint[]; color: string }) {
  if (!data.length) return null;
  const max = Math.max(...data.map((d) => d.cpw), 0.01);
  return (
    <View style={chart.root}>
      {data.map((d, i) => (
        <View key={i} style={chart.barWrap}>
          <View style={[chart.bar, { height: Math.max((d.cpw / max) * 80, 4), backgroundColor: color }]} />
          <Text style={chart.label}>{d.month}</Text>
        </View>
      ))}
    </View>
  );
}
const chart = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 96, paddingTop: 12 },
  barWrap: { flex: 1, alignItems: 'center', gap: 4 },
  bar: { width: '100%', borderRadius: 3 },
  label: { fontFamily: 'Manrope_400Regular', fontSize: 10, color: 'hsl(240,5%,45%)' },
});

// ── Stat card ─────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  const { colors } = useTheme();
  const s = scardStyles;
  return (
    <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[s.value, { color: accent ?? colors.foreground }]}>{value}</Text>
      <Text style={[s.label, { color: colors.mutedFg }]}>{label}</Text>
      {sub ? <Text style={[s.sub, { color: colors.mutedFg }]}>{sub}</Text> : null}
    </View>
  );
}
const scardStyles = StyleSheet.create({
  card: { flex: 1, borderWidth: 1, borderRadius: radii.xl, padding: spacing[3], gap: 2 },
  value: { fontFamily: 'Gloock_400Regular', fontSize: 28 },
  label: { fontFamily: 'Manrope_500Medium', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6 },
  sub: { fontFamily: 'Manrope_400Regular', fontSize: 11 },
});

// ── Component ─────────────────────────────────────────────────────────────
export function WardrobeStatsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      setStats(await api.getSustainabilityStats());
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? 'Failed to load stats');
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const s = makeStyles(colors);
  const isRtl = I18nManager.isRTL;

  if (loading) return <SafeAreaView style={[s.root, s.center]}><ActivityIndicator color={colors.accent} size="large" /></SafeAreaView>;

  if (error) return (
    <SafeAreaView style={[s.root, s.center]}>
      <Text style={s.errorText}>{error}</Text>
      <TouchableOpacity style={s.retryBtn} onPress={() => load()}><Text style={s.retryText}>{t('common.retry', 'Retry')}</Text></TouchableOpacity>
    </SafeAreaView>
  );

  const intake = stats?.intake_breakdown;
  const totalIntake = (intake?.receipt ?? 0) + (intake?.manual ?? 0);

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={colors.accent} />}
      >
        <Text style={s.headerTitle}>📊 {t('stats.title', 'Wardrobe Insights')}</Text>

        {/* Top stat grid */}
        <View style={[s.statRow, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
          <StatCard
            label={t('stats.utilisation', 'Utilisation')}
            value={`${stats?.utilisation_pct ?? 0}%`}
            sub={t('stats.utilisationSub', 'items worn')}
            accent={colors.accent}
          />
          <StatCard
            label={t('stats.carbon', 'Carbon')}
            value={`${stats?.carbon_sum ?? 0}`}
            sub="kg CO₂"
          />
        </View>

        {/* CPW trend chart */}
        {stats?.cpw_trend && stats.cpw_trend.length > 0 && (
          <View style={s.card}>
            <Text style={s.cardTitle}>{t('stats.cpwTrend', 'Cost per Wear trend')}</Text>
            <MiniBarChart data={stats.cpw_trend} color={colors.accent} />
          </View>
        )}

        {/* Intake breakdown */}
        {intake && totalIntake > 0 && (
          <View style={s.card}>
            <Text style={s.cardTitle}>{t('stats.intake', 'How items were added')}</Text>
            <View style={[s.intakeRow, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
              <View style={s.intakeItem}>
                <Text style={s.intakePct}>{totalIntake > 0 ? Math.round((intake.receipt / totalIntake) * 100) : 0}%</Text>
                <Text style={s.intakeLabel}>{t('stats.receipt', 'From receipts')}</Text>
              </View>
              <View style={s.intakeDivider} />
              <View style={s.intakeItem}>
                <Text style={s.intakePct}>{totalIntake > 0 ? Math.round((intake.manual / totalIntake) * 100) : 0}%</Text>
                <Text style={s.intakeLabel}>{t('stats.manual', 'Added manually')}</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(c: ReturnType<typeof import('@mobile/theme').useTheme>['colors']) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[8] },
    scroll: { padding: spacing[5], gap: spacing[4], paddingBottom: spacing[12] },
    headerTitle: { fontFamily: fonts.display, fontSize: fontSizes['2xl'], color: c.foreground },
    statRow: { gap: spacing[3] },
    card: { backgroundColor: c.card, borderRadius: radii.xl, padding: spacing[4], gap: spacing[3], borderWidth: 1, borderColor: c.border },
    cardTitle: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: c.mutedFg, textTransform: 'uppercase', letterSpacing: 0.6 },
    intakeRow: { gap: spacing[4], alignItems: 'center' },
    intakeItem: { flex: 1, alignItems: 'center', gap: spacing[1] },
    intakePct: { fontFamily: fonts.display, fontSize: fontSizes['3xl'], color: c.foreground },
    intakeLabel: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: c.mutedFg, textAlign: 'center' },
    intakeDivider: { width: 1, height: 60, backgroundColor: c.border },
    errorText: { fontFamily: fonts.body, fontSize: fontSizes.base, color: c.destructive, marginBottom: spacing[4] },
    retryBtn: { backgroundColor: c.foreground, paddingHorizontal: spacing[5], paddingVertical: spacing[3], borderRadius: radii.md },
    retryText: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: c.background },
  });
}
