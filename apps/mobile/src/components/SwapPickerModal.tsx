/**
 * apps/mobile/src/components/SwapPickerModal.tsx
 *
 * Modal allowing users to pick an item from their closet to offer in a marketplace swap.
 * Parity with apps/web/src/components/SwapPickerModal.jsx.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import * as Lucide from 'lucide-react-native';

import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii } from '@mobile/theme/tokens';
import { api } from '@mobile/lib/api';

interface SwapPickerModalProps {
  open: boolean;
  onClose: () => void;
  listingId: string;
  listingTitle?: string;
  onSwapCreated?: (tx: any) => void;
}

export function SwapPickerModal({
  open,
  onClose,
  listingId,
  listingTitle,
  onSwapCreated,
}: SwapPickerModalProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelectedId(null);
    setLoading(true);
    api
      .listCloset()
      .then((res: any) => {
        const list = Array.isArray(res) ? res : res?.items || [];
        setItems(list.filter((it: any) => it.title || it.name));
      })

      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  const handleSubmit = async () => {
    if (!selectedId) return;
    setSubmitting(true);
    try {
      const tx = await (api as any).proposeSwap(listingId, selectedId);
      Alert.alert(
        t('common.success', { defaultValue: 'Success' }),
        t('components.swapPickerModal.swap_proposal_sent_the_lister', {
          defaultValue: 'Swap proposal sent to the seller!',
        })
      );
      onClose();
      onSwapCreated?.(tx);
    } catch (err: any) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        err?.response?.data?.detail || 'Could not send swap proposal.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <View style={styles.headerTitleRow}>
            <Lucide.Repeat size={20} color={colors.accent} />
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>
              {t('components.swapPickerModal.offer_an_item_in_exchange', {
                defaultValue: 'Offer Item in Swap',
              })}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.secondary }]}>
            <Lucide.X size={18} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.subtitle, { color: colors.mutedFg }]}>
          {t('components.swapPickerModal.pickOne', {
            defaultValue: 'Select one item from your closet to trade for {{title}}',
            title: listingTitle || 'this listing',
          })}
        </Text>

        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : items.length === 0 ? (
          <View style={styles.centerBox}>
            <Lucide.Shirt size={40} color={colors.mutedFg} />
            <Text style={[styles.emptyText, { color: colors.mutedFg }]}>
              {t('components.swapPickerModal.noItems', { defaultValue: 'No items found in your closet to offer.' })}
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
            {items.map((it) => {
              const isSelected = selectedId === it.id;
              const img = it.thumbnail_data_url || it.image_url;
              return (
                <TouchableOpacity
                  key={it.id}
                  style={[
                    styles.card,
                    {
                      backgroundColor: colors.card,
                      borderColor: isSelected ? colors.accent : colors.border,
                      borderWidth: isSelected ? 2 : 1,
                    },
                  ]}
                  onPress={() => setSelectedId(isSelected ? null : it.id)}
                  activeOpacity={0.8}
                >
                  {img ? (
                    <Image source={{ uri: img }} style={[styles.thumb, { backgroundColor: colors.cardOffWhite }]} resizeMode="contain" />
                  ) : (
                    <View style={[styles.thumb, styles.placeholder, { backgroundColor: colors.cardOffWhite }]}>
                      <Text style={{ color: colors.mutedFg, fontSize: 10 }}>{it.category || 'Garment'}</Text>
                    </View>
                  )}
                  {isSelected ? (
                    <View style={[styles.checkBadge, { backgroundColor: colors.accent }]}>
                      <Lucide.Check size={14} color="#fff" />
                    </View>
                  ) : null}
                  <View style={styles.cardInfo}>
                    <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={1}>
                      {it.title || it.name}
                    </Text>
                    {it.brand ? (
                      <Text style={[styles.cardBrand, { color: colors.mutedFg }]} numberOfLines={1}>
                        {it.brand}
                      </Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* Footer */}
        <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.card }]}>
          <TouchableOpacity
            style={[styles.cancelBtn, { borderColor: colors.border }]}
            onPress={onClose}
            disabled={submitting}
          >
            <Text style={[styles.cancelBtnText, { color: colors.foreground }]}>
              {t('common.cancel', { defaultValue: 'Cancel' })}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.submitBtn,
              { backgroundColor: colors.accent, opacity: !selectedId || submitting ? 0.5 : 1 },
            ]}
            onPress={handleSubmit}
            disabled={!selectedId || submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>
                {t('components.swapPickerModal.proposeSwap', { defaultValue: 'Propose Swap' })}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  headerTitle: {
    fontFamily: fonts.displayBold,
    fontSize: fontSizes.lg,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    padding: spacing[6],
  },
  emptyText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: spacing[3],
    gap: spacing[3],
  },
  card: {
    width: '47%',
    borderRadius: radii.xl,
    overflow: 'hidden',
    position: 'relative',
  },
  thumb: {
    width: '100%',
    aspectRatio: 3 / 4,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: {
    padding: spacing[2],
  },
  cardTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.xs,
  },
  cardBrand: {
    fontFamily: fonts.body,
    fontSize: 10,
    marginTop: 2,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing[3],
    padding: spacing[4],
    borderTopWidth: 1,
  },
  cancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: radii.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.sm,
  },
  submitBtn: {
    flex: 2,
    height: 44,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: {
    color: '#fff',
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.sm,
  },
});
