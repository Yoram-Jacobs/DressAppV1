/**
 * apps/mobile/src/screens/me/TrendScoutScreen.tsx
 * Core loop: api.fashionScoutFeed() → card list of trend items with image + title + source.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Image, RefreshControl, ActivityIndicator, Linking, I18nManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii } from '@mobile/theme/tokens';
import { api } from '@mobile/lib/api';

interface TrendItem {
  id?: string;
  title?: string;
  description?: string;
  image_url?: string;
  source_url?: string;
  source_name?: string;
  category?: string;
}

export function TrendScoutScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [items, setItems] = useState<TrendItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await api.fashionScoutFeed(16);
      setItems(Array.isArray(data) ? data : (data?.items ?? data?.feed ?? []));
    } catch { /* silent */ } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const s = makeStyles(colors);

  const renderItem = ({ item, index }: { item: TrendItem; index: number }) => (
    <TouchableOpacity
      style={s.card}
      activeOpacity={0.82}
      onPress={() => item.source_url && Linking.openURL(item.source_url)}
    >
      {item.image_url
        ? <Image source={{ uri: item.image_url }} style={s.cardImage} resizeMode="cover" />
        : <View style={[s.cardImage, s.cardImagePlaceholder]}><Text style={{ fontSize: 40 }}>✨</Text></View>}
      <View style={s.cardBody}>
        {item.category && <Text style={s.category}>{item.category}</Text>}
        <Text style={s.title} numberOfLines={2}>{item.title ?? '—'}</Text>
        {item.description && <Text style={s.description} numberOfLines={3}>{item.description}</Text>}
        {item.source_name && <Text style={s.source}>— {item.source_name}</Text>}
      </View>
    </TouchableOpacity>
  );

  if (loading) return <SafeAreaView style={[s.root, s.center]}><ActivityIndicator color={colors.accent} size="large" /></SafeAreaView>;

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <Text style={s.headerTitle}>🔍 {t('trends.title', 'Trend Scout')}</Text>
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item, i) => item.id ?? String(i)}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={colors.accent} />}
        ListEmptyComponent={<View style={s.center}><Text style={s.emptyText}>{t('trends.empty', 'No trends loaded yet.')}</Text></View>}
      />
    </SafeAreaView>
  );
}

function makeStyles(c: ReturnType<typeof import('@mobile/theme').useTheme>['colors']) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[8] },
    headerTitle: { fontFamily: fonts.display, fontSize: fontSizes['2xl'], color: c.foreground, paddingHorizontal: spacing[5], paddingVertical: spacing[3] },
    list: { padding: spacing[4], gap: spacing[4] },
    card: { backgroundColor: c.card, borderRadius: radii.xl, overflow: 'hidden', borderWidth: 1, borderColor: c.border },
    cardImage: { width: '100%', height: 200 },
    cardImagePlaceholder: { backgroundColor: c.muted, alignItems: 'center', justifyContent: 'center' },
    cardBody: { padding: spacing[4], gap: spacing[1] },
    category: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.xs, color: c.accent, textTransform: 'uppercase', letterSpacing: 0.8 },
    title: { fontFamily: fonts.display, fontSize: fontSizes.lg, color: c.foreground, lineHeight: 26 },
    description: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: c.mutedFg, lineHeight: 20 },
    source: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: c.mutedFg, marginTop: spacing[1] },
    emptyText: { fontFamily: fonts.body, fontSize: fontSizes.base, color: c.mutedFg, textAlign: 'center' },
  });
}
