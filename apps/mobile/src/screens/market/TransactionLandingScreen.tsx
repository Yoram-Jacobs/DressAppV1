/**
 * apps/mobile/src/screens/market/TransactionLandingScreen.tsx
 * Core loop: show transaction status + confirm receipt button.
 */
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii } from '@mobile/theme/tokens';
import { api } from '@mobile/lib/api';
import type { MarketStackParamList } from '@mobile/navigation/types';

type TxLandingRouteProp = RouteProp<MarketStackParamList, 'TransactionLanding'>;

interface Transaction { id: string; status?: string; listing_title?: string; amount_cents?: number; currency?: string; role?: string }

export function TransactionLandingScreen() {
  const { t } = useTranslation();
  const route = useRoute<TxLandingRouteProp>();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { transactionId } = route.params;
  const [tx, setTx] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    // Fetch the specific transaction from the list endpoint (no single-tx endpoint exists)
    api.listTransactions().then((data: any) => {
      const list: Transaction[] = Array.isArray(data) ? data : (data?.transactions ?? []);

      setTx(list.find((t) => t.id === transactionId) ?? { id: transactionId });
    }).catch(() => setTx({ id: transactionId })).finally(() => setLoading(false));
  }, [transactionId]);

  const handleConfirm = async () => {
    setActing(true);
    try {
      await api.confirmReceipt(transactionId);
      Alert.alert(t('market.confirmed', { defaultValue: 'Confirmed!' }), t('market.receiptConfirmed', { defaultValue: 'Receipt confirmed. Thank you!' }), [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err: unknown) {
      Alert.alert(t('common.error', { defaultValue: 'Error' }), (err as { message?: string })?.message ?? 'Failed to confirm');
    } finally { setActing(false); }
  };

  const s = makeStyles(colors);

  if (loading) return <SafeAreaView style={[s.root, s.center]}><ActivityIndicator color={colors.accent} size="large" /></SafeAreaView>;

  const isPending = !tx?.status || tx.status === 'pending';
  const statusIcon = tx?.status === 'completed' ? '✅' : tx?.status === 'failed' ? '❌' : '⏳';

  return (
    <SafeAreaView style={[s.root, s.center]}>
      <Text style={s.icon}>{statusIcon}</Text>
      <Text style={s.title}>{tx?.listing_title ?? t('market.transaction', { defaultValue: 'Transaction' })}</Text>
      <Text style={s.status}>{t('market.status', { defaultValue: 'Status' })}: {tx?.status ?? t('market.pending', { defaultValue: 'pending' })}</Text>
      {tx?.amount_cents != null && (
        <Text style={s.amount}>{(tx.amount_cents / 100).toFixed(2)} {tx.currency ?? '€'}</Text>
      )}
      {isPending && tx?.role === 'buyer' && (
        <TouchableOpacity style={[s.confirmBtn, acting && s.confirmBtnDisabled]} onPress={handleConfirm} disabled={acting}>
          {acting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.confirmBtnText}>{t('market.confirmReceipt', { defaultValue: 'Confirm I received the item' })}</Text>}
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

function makeStyles(c: ReturnType<typeof import('@mobile/theme').useTheme>['colors']) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[8], gap: spacing[4] },
    icon: { fontSize: 72 },
    title: { fontFamily: fonts.display, fontSize: fontSizes['2xl'], color: c.foreground, textAlign: 'center' },
    status: { fontFamily: fonts.body, fontSize: fontSizes.base, color: c.mutedFg, textTransform: 'capitalize' },
    amount: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xl, color: c.accent },
    confirmBtn: { backgroundColor: c.foreground, borderRadius: radii.md, paddingVertical: spacing[4], paddingHorizontal: spacing[6], alignItems: 'center' },
    confirmBtnDisabled: { opacity: 0.6 },
    confirmBtnText: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.base, color: c.background },
  });
}
