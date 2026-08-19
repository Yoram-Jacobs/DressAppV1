/**
 * apps/mobile/src/screens/market/CreateListingScreen.tsx
 *
 * Core loop: pick a closet item → set title, price, type → api.createListing() → navigate back.
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, I18nManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { TextInput } from 'react-native-paper';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii } from '@mobile/theme/tokens';
import { api } from '@mobile/lib/api';

const schema = z.object({
  title:       z.string().min(2, 'Title required').max(160),
  price_cents: z.coerce.number().int().min(0).optional(),
  listing_type:z.enum(['sale', 'swap', 'donate']),
  description: z.string().max(1000).optional(),
});
type Form = z.infer<typeof schema>;

interface ClosetItem { id: string; name?: string; category?: string }

export function CreateListingScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const [closetItems, setClosetItems] = useState<ClosetItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { control, handleSubmit, watch, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { title: '', listing_type: 'sale', description: '' },
  });
  const listingType = watch('listing_type');

  useEffect(() => {
    api.listCloset().then((data) => {
      setClosetItems(Array.isArray(data) ? data : (data?.items ?? []));
    }).catch(() => {});
  }, []);

  const onSubmit = async (values: Form) => {
    if (!selectedItemId) {
      Alert.alert(t('market.itemRequired', 'Select an item'), t('market.pickFromCloset', 'Pick an item from your closet to list.'));
      return;
    }
    setSubmitting(true);
    try {
      await api.createListing({ ...values, item_id: selectedItemId });
      navigation.goBack();
    } catch (err: unknown) {
      Alert.alert(t('common.error', 'Error'), (err as { response?: { data?: { detail?: string } }; message?: string })?.response?.data?.detail ?? 'Failed to create listing');
    } finally { setSubmitting(false); }
  };

  const s = makeStyles(colors);
  const isRtl = I18nManager.isRTL;
  const TYPES: Form['listing_type'][] = ['sale', 'swap', 'donate'];

  return (
    <SafeAreaView style={s.root} edges={['bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <Text style={s.sectionLabel}>{t('market.listingType', 'Listing type')}</Text>
          <View style={[s.typeRow, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
            {TYPES.map((type) => (
              <Controller key={type} control={control} name="listing_type" render={({ field: { onChange, value } }) => (
                <TouchableOpacity style={[s.typeChip, value === type && s.typeChipActive]} onPress={() => onChange(type)}>
                  <Text style={[s.typeChipText, value === type && s.typeChipTextActive]}>
                    {t(`market.${type}`, type)}
                  </Text>
                </TouchableOpacity>
              )} />
            ))}
          </View>

          {/* Closet item picker (simplified list) */}
          <Text style={s.sectionLabel}>{t('market.selectItem', 'Item from closet *')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.itemPicker}>
            {closetItems.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[s.itemChip, selectedItemId === item.id && s.itemChipActive]}
                onPress={() => setSelectedItemId(item.id)}
              >
                <Text style={[s.itemChipText, selectedItemId === item.id && s.itemChipTextActive]} numberOfLines={1}>
                  {item.name ?? item.category ?? item.id}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Controller control={control} name="title" render={({ field: { onChange, value } }) => (
            <TextInput label={t('market.listingTitle', 'Listing title *')} value={value} onChangeText={onChange} mode="outlined"
              outlineColor={colors.border} activeOutlineColor={colors.accent} textColor={colors.foreground} style={s.input} error={!!errors.title} />
          )} />
          {errors.title && <Text style={s.fieldError}>{errors.title.message}</Text>}

          {listingType === 'sale' && (
            <Controller control={control} name="price_cents" render={({ field: { onChange, value } }) => (
              <TextInput label={t('market.priceEuroCents', 'Price (cents, e.g. 2500 = €25)')}
                value={value != null ? String(value) : ''} onChangeText={onChange} mode="outlined"
                keyboardType="numeric" outlineColor={colors.border} activeOutlineColor={colors.accent}
                textColor={colors.foreground} style={s.input} />
            )} />
          )}

          <Controller control={control} name="description" render={({ field: { onChange, value } }) => (
            <TextInput label={t('market.description', 'Description')} value={value} onChangeText={onChange}
              mode="outlined" multiline numberOfLines={4} outlineColor={colors.border}
              activeOutlineColor={colors.accent} textColor={colors.foreground} style={s.input} />
          )} />

          <TouchableOpacity style={[s.submitBtn, submitting && s.submitBtnDisabled]} onPress={handleSubmit(onSubmit)} disabled={submitting}>
            {submitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.submitBtnText}>{t('market.createListing', 'Create listing')}</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles(c: ReturnType<typeof import('@mobile/theme').useTheme>['colors']) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    scroll: { padding: spacing[5], gap: spacing[4] },
    sectionLabel: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: c.mutedFg, textTransform: 'uppercase', letterSpacing: 0.8 },
    typeRow: { gap: spacing[2] },
    typeChip: { flex: 1, paddingVertical: spacing[3], borderRadius: radii.md, backgroundColor: c.muted, alignItems: 'center', borderWidth: 1, borderColor: c.border },
    typeChipActive: { backgroundColor: c.foreground, borderColor: c.foreground },
    typeChipText: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: c.mutedFg },
    typeChipTextActive: { color: c.background },
    itemPicker: { gap: spacing[2], paddingVertical: spacing[1] },
    itemChip: { paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radii.xl, backgroundColor: c.muted, borderWidth: 1, borderColor: c.border, maxWidth: 140 },
    itemChipActive: { backgroundColor: c.accent, borderColor: c.accent },
    itemChipText: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: c.mutedFg },
    itemChipTextActive: { color: '#fff' },
    input: { backgroundColor: c.background },
    fieldError: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: c.destructive },
    submitBtn: { backgroundColor: c.foreground, borderRadius: radii.md, paddingVertical: spacing[4], alignItems: 'center' },
    submitBtnDisabled: { opacity: 0.6 },
    submitBtnText: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.base, color: c.background },
  });
}
