/**
 * apps/mobile/src/screens/me/SuitcaseScreen.tsx
 *
 * Suitcase Packing — trip-based closet packing assistant.
 * Ports the core loop of apps/web/src/pages/Suitcase.jsx.
 *
 * API methods (from packages/api-client/src/suitcase.js):
 *  - api.getSuitcaseActive()        → get current active trip state
 *  - api.saveSuitcaseActive(body)   → save/update active trip (destination, dates, etc.)
 *  - api.packSuitcase(body)         → AI-generate packing list for trip params
 *  - api.deleteSuitcaseItem(itemId) → remove item from packing list
 *  - api.updateSuitcaseItemPackStatus(body) → toggle packed/unpacked
 *  - api.suitcaseChat(body)         → chat with AI about packing
 *
 * Flow:
 *  1. Load active suitcase state on mount
 *  2. If no active trip → show "Start trip" form (destination, dates)
 *  3. If active trip → show packing list with packed/unpack toggles
 *  4. "Pack for me" button → ai-generated packing list
 *  5. Remove item → api.deleteSuitcaseItem()
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
  FlatList,
  I18nManager,
  TextInput as RNTextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii } from '@mobile/theme/tokens';
import { api } from '@mobile/lib/api';

// ── Types ──────────────────────────────────────────────────────────────────
interface SuitcaseItemData {
  id: string;
  name?: string;
  category?: string;
  image_url?: string;
  thumbnail_data_url?: string;
  is_packed?: boolean;
}

interface ActiveSuitcase {
  destination?: string;
  start_date?: string;
  end_date?: string;
  items?: SuitcaseItemData[];
  days?: number;
}

// ── Component ──────────────────────────────────────────────────────────────
export function SuitcaseScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const [loading, setLoading] = useState(true);
  const [packing, setPacking] = useState(false);
  const [suitcase, setSuitcase] = useState<ActiveSuitcase | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Setup form state
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getSuitcaseActive();
      // Backend returns the active suitcase or null/empty
      if (data && (data.destination || (data.items && data.items.length > 0))) {
        setSuitcase(data);
        setDestination(data.destination ?? '');
        setStartDate(data.start_date ?? '');
        setEndDate(data.end_date ?? '');
      } else {
        setSuitcase(null);
      }
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? 'Failed to load suitcase');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Start / update trip ───────────────────────────────────────────────────
  const handleSaveTrip = async () => {
    if (!destination.trim()) {
      Alert.alert(t('suitcase.destinationRequired', 'Destination required'), t('suitcase.enterDestination', 'Please enter a destination.'));
      return;
    }
    setPacking(true);
    try {
      await api.saveSuitcaseActive({
        destination: destination.trim(),
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      });
      await load();
    } catch (err: unknown) {
      Alert.alert(t('common.error', 'Error'), (err as { message?: string })?.message ?? 'Failed to save trip');
    } finally {
      setPacking(false);
    }
  };

  // ── AI pack ───────────────────────────────────────────────────────────────
  const handlePackForMe = async () => {
    setPacking(true);
    try {
      await api.packSuitcase({
        destination: suitcase?.destination ?? destination,
        start_date: suitcase?.start_date ?? startDate,
        end_date: suitcase?.end_date ?? endDate,
      });
      await load();
    } catch (err: unknown) {
      Alert.alert(t('common.error', 'Error'), (err as { message?: string })?.message ?? 'Failed to generate packing list');
    } finally {
      setPacking(false);
    }
  };

  // ── Toggle packed status ──────────────────────────────────────────────────
  const handleTogglePacked = async (item: SuitcaseItemData) => {
    try {
      await api.updateSuitcaseItemPackStatus({
        item_id: item.id,
        is_packed: !item.is_packed,
      });
      setSuitcase((prev) => prev ? {
        ...prev,
        items: prev.items?.map((i) =>
          i.id === item.id ? { ...i, is_packed: !i.is_packed } : i,
        ),
      } : prev);
    } catch {
      /* silent — optimistic update reverted on next load */
    }
  };

  // ── Remove item ───────────────────────────────────────────────────────────
  const handleRemoveItem = (item: SuitcaseItemData) => {
    Alert.alert(
      t('suitcase.removeItem', 'Remove item'),
      t('suitcase.removeItemMsg', 'Remove this item from your packing list?'),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('common.remove', 'Remove'),
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteSuitcaseItem(item.id);
              setSuitcase((prev) => prev ? {
                ...prev,
                items: prev.items?.filter((i) => i.id !== item.id),
              } : prev);
            } catch (err: unknown) {
              Alert.alert(t('common.error', 'Error'), (err as { message?: string })?.message ?? 'Failed to remove item');
            }
          },
        },
      ],
    );
  };

  const s = makeStyles(colors);
  const isRtl = I18nManager.isRTL;

  // ── Render packing list item ───────────────────────────────────────────────
  const renderPackItem = ({ item }: { item: SuitcaseItemData }) => {
    const thumb = item.thumbnail_data_url ?? item.image_url;
    return (
      <View style={[s.packItem, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
        <TouchableOpacity onPress={() => handleTogglePacked(item)} style={s.packCheckbox}>
          <Text style={s.packCheckboxIcon}>{item.is_packed ? '✅' : '⬜️'}</Text>
        </TouchableOpacity>
        {thumb ? (
          <Image source={{ uri: thumb }} style={s.packItemImage} resizeMode="cover" />
        ) : (
          <View style={[s.packItemImage, s.packItemImagePlaceholder]}>
            <Text style={{ fontSize: 20 }}>👕</Text>
          </View>
        )}
        <View style={s.packItemInfo}>
          <Text style={[s.packItemName, item.is_packed && s.packItemNamePacked]} numberOfLines={1}>
            {item.name ?? t('closet.unnamedItem', 'Item')}
          </Text>
          {item.category ? <Text style={s.packItemCategory}>{item.category}</Text> : null}
        </View>
        <TouchableOpacity onPress={() => handleRemoveItem(item)} style={s.packRemoveBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={s.packRemoveIcon}>✕</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[s.root, s.centered]}>
        <ActivityIndicator color={colors.accent} size="large" />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[s.root, s.centered]}>
        <Text style={s.errorText}>{error}</Text>
        <TouchableOpacity style={s.actionBtn} onPress={load}>
          <Text style={s.actionBtnText}>{t('common.retry', 'Retry')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Header ── */}
        <View style={s.headerRow}>
          <Text style={s.headerTitle}>🧳 {t('suitcase.title', 'Suitcase Packing')}</Text>
        </View>

        {/* ── Trip setup form ── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>{t('suitcase.tripDetails', 'Trip details')}</Text>
          <RNTextInput
            style={s.textInput}
            placeholder={t('suitcase.destination', 'Destination (e.g. Paris, France)')}
            placeholderTextColor={colors.mutedFg}
            value={destination}
            onChangeText={setDestination}
          />
          <View style={s.dateRow}>
            <RNTextInput
              style={[s.textInput, s.dateInput]}
              placeholder={t('suitcase.startDate', 'From (YYYY-MM-DD)')}
              placeholderTextColor={colors.mutedFg}
              value={startDate}
              onChangeText={setStartDate}
            />
            <RNTextInput
              style={[s.textInput, s.dateInput]}
              placeholder={t('suitcase.endDate', 'To (YYYY-MM-DD)')}
              placeholderTextColor={colors.mutedFg}
              value={endDate}
              onChangeText={setEndDate}
            />
          </View>
          <TouchableOpacity
            style={[s.actionBtn, packing && s.actionBtnDisabled]}
            onPress={handleSaveTrip}
            disabled={packing}
          >
            {packing ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={s.actionBtnText}>
                {suitcase ? t('suitcase.updateTrip', 'Update trip') : t('suitcase.startTrip', 'Start trip')}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* ── AI Pack button ── */}
        {suitcase?.destination && (
          <TouchableOpacity
            style={[s.packForMeBtn, packing && s.actionBtnDisabled]}
            onPress={handlePackForMe}
            disabled={packing}
          >
            {packing ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={s.packForMeText}>✨ {t('suitcase.packForMe', 'Pack for me with AI')}</Text>
            )}
          </TouchableOpacity>
        )}

        {/* ── Packing list ── */}
        {suitcase?.items && suitcase.items.length > 0 && (
          <View style={s.card}>
            <View style={[s.packListHeader, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
              <Text style={s.cardTitle}>{t('suitcase.packingList', 'Packing list')}</Text>
              <Text style={s.packCount}>
                {suitcase.items.filter((i) => i.is_packed).length}/{suitcase.items.length}
              </Text>
            </View>
            <FlatList
              data={suitcase.items}
              renderItem={renderPackItem}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              ItemSeparatorComponent={() => <View style={s.separator} />}
            />
          </View>
        )}

        {/* Empty packing list notice */}
        {suitcase && (!suitcase.items || suitcase.items.length === 0) && (
          <View style={s.emptyPack}>
            <Text style={s.emptyPackText}>
              {t('suitcase.emptyList', 'No items packed yet.\nTap "Pack for me" to get AI suggestions.')}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
function makeStyles(colors: ReturnType<typeof import('@mobile/theme').useTheme>['colors']) {
  const isRtl = I18nManager.isRTL;
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    centered: { alignItems: 'center', justifyContent: 'center' },
    scroll: { padding: spacing[5], gap: spacing[4], paddingBottom: spacing[12] },
    headerRow: { gap: spacing[1] },
    headerTitle: { fontFamily: fonts.display, fontSize: fontSizes['2xl'], color: colors.foreground },
    card: {
      backgroundColor: colors.card,
      borderRadius: radii.xl,
      padding: spacing[4],
      gap: spacing[3],
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardTitle: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.base, color: colors.foreground },
    textInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[3],
      fontFamily: fonts.body,
      fontSize: fontSizes.base,
      color: colors.foreground,
      backgroundColor: colors.background,
      textAlign: isRtl ? 'right' : 'left',
    },
    dateRow: { flexDirection: isRtl ? 'row-reverse' : 'row', gap: spacing[3] },
    dateInput: { flex: 1 },
    actionBtn: {
      backgroundColor: colors.foreground,
      borderRadius: radii.md,
      paddingVertical: spacing[3],
      alignItems: 'center',
    },
    actionBtnDisabled: { opacity: 0.6 },
    actionBtnText: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.base, color: colors.background },
    packForMeBtn: {
      backgroundColor: colors.accent,
      borderRadius: radii.xl,
      paddingVertical: spacing[4],
      alignItems: 'center',
    },
    packForMeText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: '#fff' },
    packListHeader: { justifyContent: 'space-between', alignItems: 'center' },
    packCount: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.mutedFg },
    packItem: { alignItems: 'center', gap: spacing[3], paddingVertical: spacing[2] },
    packCheckbox: { width: 28, alignItems: 'center' },
    packCheckboxIcon: { fontSize: 22 },
    packItemImage: { width: 48, height: 48, borderRadius: radii.md, overflow: 'hidden' },
    packItemImagePlaceholder: { backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
    packItemInfo: { flex: 1 },
    packItemName: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.foreground },
    packItemNamePacked: { textDecorationLine: 'line-through', color: colors.mutedFg },
    packItemCategory: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.mutedFg },
    packRemoveBtn: { padding: spacing[1] },
    packRemoveIcon: { fontSize: 14, color: colors.mutedFg },
    separator: { height: 1, backgroundColor: colors.border },
    emptyPack: { alignItems: 'center', padding: spacing[6] },
    emptyPackText: {
      fontFamily: fonts.body,
      fontSize: fontSizes.sm,
      color: colors.mutedFg,
      textAlign: 'center',
      lineHeight: 22,
    },
    errorText: {
      fontFamily: fonts.body,
      fontSize: fontSizes.base,
      color: colors.destructive,
      textAlign: 'center',
      marginBottom: spacing[4],
    },
  });
}
