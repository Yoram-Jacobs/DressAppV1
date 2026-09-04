/**
 * apps/mobile/src/screens/market/TransactionsScreen.tsx
 * Core loop: api.listTransactions() → list view, tap → TransactionLanding
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, I18nManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii } from '@mobile/theme/tokens';
import { useMarketplaceStore } from '@mobile/lib/stores';
import type { MarketStackParamList } from '@mobile/navigation/types';

type TxNavProp = NativeStackNavigationProp<MarketStackParamList, 'Transactions'>;

interface Transaction {
  id: string;
  status?: string;
  listing_type?: string;
  listing_title?: string;
  role?: string;
  amount_cents?: number;
  currency?: string;
  created_at?: string;
}

const STATUS_COLOR: Record<string, string> = {
  pending:   'hsl(38,92%,50%)',
  escrow:    'hsl(215,80%,55%)',
  completed: 'hsl(160,70%,38%)',
  failed:    'hsl(0,72%,52%)',
  cancelled: 'hsl(240,5%,45%)',
};

export function TransactionsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<TxNavProp>();
  const { colors } = useTheme();
  const { transactions: txs, loading, fetchTransactions } = useMarketplaceStore({ prewarm: true });
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchTransactions({ force: true });
    } finally {
      setRefreshing(false);
    }
  }, [fetchTransactions]);

  const s = makeStyles(colors);
  const isRtl = I18nManager.isRTL;

  const renderItem = ({ item }: { item: Transaction }) => (
    <TouchableOpacity
      style={[s.row, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}
      onPress={() => navigation.navigate('TransactionLanding', { transactionId: item.id })}
      activeOpacity={0.78}
    >
      <View style={s.rowMain}>
        <Text style={s.rowTitle} numberOfLines={1}>{item.listing_title ?? t('market.transaction', { defaultValue: 'Transaction' })}</Text>
        <Text style={s.rowSub}>
          {item.role === 'buyer' ? t('market.youBought', { defaultValue: 'You bought' }) : t('market.youSold', { defaultValue: 'You sold' })}
          {item.amount_cents != null ? ` · ${(item.amount_cents / 100).toFixed(2)} ${item.currency ?? '€'}` : ''}
        </Text>
      </View>
      <View style={s.rowRight}>
        <Text style={[s.status, { color: STATUS_COLOR[item.status ?? ''] ?? colors.mutedFg }]}>
          {item.status ?? '—'}
        </Text>
        <Text style={s.chevron}>›</Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) return <SafeAreaView style={[s.root, s.center]}><ActivityIndicator color={colors.accent} size="large" /></SafeAreaView>;

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <Text style={s.headerTitle}>{t('market.transactions', { defaultValue: 'Transactions' })}</Text>
      <FlatList
        data={txs}
        renderItem={renderItem}
        keyExtractor={(i) => i.id}
        contentContainerStyle={s.list}
        ItemSeparatorComponent={() => <View style={s.sep} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        ListEmptyComponent={<View style={s.center}><Text style={s.emptyText}>{t('market.noTransactions', { defaultValue: 'No transactions yet.' })}</Text></View>}
      />
    </SafeAreaView>
  );
}

function makeStyles(c: ReturnType<typeof import('@mobile/theme').useTheme>['colors']) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[8] },
    headerTitle: { fontFamily: fonts.display, fontSize: fontSizes['2xl'], color: c.foreground, paddingHorizontal: spacing[5], paddingVertical: spacing[3] },
    list: { paddingHorizontal: spacing[5] },
    row: { alignItems: 'center', paddingVertical: spacing[4], gap: spacing[3] },
    rowMain: { flex: 1 },
    rowTitle: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.base, color: c.foreground },
    rowSub: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: c.mutedFg, marginTop: 2 },
    rowRight: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
    status: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.xs, textTransform: 'capitalize' },
    chevron: { fontSize: 18, color: c.mutedFg },
    sep: { height: 1, backgroundColor: c.border },
    emptyText: { fontFamily: fonts.body, fontSize: fontSizes.base, color: c.mutedFg, textAlign: 'center' },
  });
}
