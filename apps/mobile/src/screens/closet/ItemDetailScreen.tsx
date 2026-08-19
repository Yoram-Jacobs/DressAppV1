/**
 * apps/mobile/src/screens/closet/ItemDetailScreen.tsx
 *
 * Closet — item detail view.
 * Ports the core loop of apps/web/src/pages/ItemDetail.jsx:
 *   - receives itemId from ClosetStack route params
 *   - fetches item via api.getItem(id)
 *   - displays image, name, category, color, brand, size
 *   - Delete button → api.deleteItem(id) → navigate back
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
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
import type { ClosetStackParamList } from '@mobile/navigation/types';

type ItemDetailNavProp = NativeStackNavigationProp<ClosetStackParamList, 'ItemDetail'>;
type ItemDetailRouteProp = RouteProp<ClosetStackParamList, 'ItemDetail'>;

// ── Types ──────────────────────────────────────────────────────────────────
interface ClosetItem {
  id: string;
  name?: string;
  category?: string;
  color?: string;
  brand?: string;
  size?: string;
  description?: string;
  image_url?: string;
  thumbnail_data_url?: string;
}

// ── Attribute row component ────────────────────────────────────────────────
function AttrRow({
  label,
  value,
  colors,
}: {
  label: string;
  value?: string;
  colors: ReturnType<typeof import('@mobile/theme').useTheme>['colors'];
}) {
  if (!value) return null;
  const isRtl = I18nManager.isRTL;
  return (
    <View style={[
      attrRowBase.row,
      { borderBottomColor: colors.border, flexDirection: isRtl ? 'row-reverse' : 'row' },
    ]}>
      <Text style={[attrRowBase.label, { color: colors.mutedFg, fontFamily: fonts.bodyMedium }]}>
        {label}
      </Text>
      <Text
        style={[
          attrRowBase.value,
          { color: colors.foreground, fontFamily: fonts.body, textAlign: isRtl ? 'left' : 'right' },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}
const attrRowBase = StyleSheet.create({
  row: { justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1 },
  label: { fontSize: fontSizes.sm },
  value: { fontSize: fontSizes.sm, flexShrink: 1 },
});

// ── Component ──────────────────────────────────────────────────────────────
export function ItemDetailScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<ItemDetailNavProp>();
  const route = useRoute<ItemDetailRouteProp>();
  const { colors } = useTheme();
  const { itemId } = route.params;

  const [item, setItem] = useState<ClosetItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getItem(itemId);
      setItem(data);
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? 'Failed to load item');
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = () => {
    Alert.alert(
      t('itemDetail.deleteTitle', 'Delete item'),
      t('itemDetail.deleteMessage', 'Are you sure you want to remove this item from your closet?'),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('common.delete', 'Delete'),
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await api.deleteItem(itemId);
              navigation.goBack();
            } catch (err: unknown) {
              setDeleting(false);
              Alert.alert(
                t('common.error', 'Error'),
                (err as { message?: string })?.message ?? 'Failed to delete item',
              );
            }
          },
        },
      ],
    );
  };

  const s = makeStyles(colors);

  if (loading) {
    return (
      <SafeAreaView style={[s.root, s.centered]}>
        <ActivityIndicator color={colors.accent} size="large" />
      </SafeAreaView>
    );
  }

  if (error || !item) {
    return (
      <SafeAreaView style={[s.root, s.centered]}>
        <Text style={s.errorText}>{error ?? 'Item not found'}</Text>
        <TouchableOpacity style={s.retryBtn} onPress={load}>
          <Text style={s.retryBtnText}>{t('common.retry', 'Retry')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const imageUri = item.image_url ?? item.thumbnail_data_url;

  return (
    <SafeAreaView style={s.root} edges={['bottom']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Item image */}
        <View style={s.imageContainer}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={s.image} resizeMode="contain" />
          ) : (
            <View style={[s.image, s.imagePlaceholder]}>
              <Text style={s.imagePlaceholderIcon}>👕</Text>
            </View>
          )}
        </View>

        {/* Details */}
        <View style={s.details}>
          <Text style={s.itemName}>{item.name ?? t('closet.unnamedItem', 'Unnamed item')}</Text>

          <View style={s.attrsBlock}>
            <AttrRow colors={colors} label={t('itemDetail.category', 'Category')} value={item.category} />
            <AttrRow colors={colors} label={t('itemDetail.color', 'Color')} value={item.color} />
            <AttrRow colors={colors} label={t('itemDetail.brand', 'Brand')} value={item.brand} />
            <AttrRow colors={colors} label={t('itemDetail.size', 'Size')} value={item.size} />
          </View>

          {item.description ? (
            <Text style={s.description}>{item.description}</Text>
          ) : null}
        </View>
      </ScrollView>

      {/* Delete button */}
      <View style={s.footer}>
        <TouchableOpacity
          style={[s.deleteBtn, deleting && s.deleteBtnDisabled]}
          onPress={handleDelete}
          disabled={deleting}
          accessibilityRole="button"
        >
          {deleting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={s.deleteBtnText}>{t('itemDetail.delete', 'Remove from closet')}</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
function makeStyles(colors: ReturnType<typeof import('@mobile/theme').useTheme>['colors']) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    centered: { alignItems: 'center', justifyContent: 'center' },
    imageContainer: { width: '100%', aspectRatio: 1, backgroundColor: colors.muted },
    image: { width: '100%', height: '100%' },
    imagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
    imagePlaceholderIcon: { fontSize: 80 },
    details: { padding: spacing[5] },
    itemName: {
      fontFamily: fonts.display,
      fontSize: fontSizes['2xl'],
      color: colors.foreground,
      marginBottom: spacing[4],
    },
    attrsBlock: {
      backgroundColor: colors.card,
      borderRadius: radii.lg,
      paddingHorizontal: spacing[4],
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: spacing[4],
    },
    description: {
      fontFamily: fonts.body,
      fontSize: fontSizes.sm,
      color: colors.mutedFg,
      lineHeight: 20,
    },
    footer: {
      padding: spacing[5],
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
    },
    deleteBtn: {
      backgroundColor: colors.destructive,
      borderRadius: radii.md,
      paddingVertical: spacing[4],
      alignItems: 'center',
    },
    deleteBtnDisabled: { opacity: 0.6 },
    deleteBtnText: {
      fontFamily: fonts.bodyMedium,
      fontSize: fontSizes.base,
      color: '#fff',
    },
    errorText: {
      fontFamily: fonts.body,
      fontSize: fontSizes.base,
      color: colors.destructive,
      textAlign: 'center',
      marginBottom: spacing[4],
    },
    retryBtn: {
      paddingHorizontal: spacing[5],
      paddingVertical: spacing[3],
      backgroundColor: colors.foreground,
      borderRadius: radii.md,
    },
    retryBtnText: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.background },
  });
}
