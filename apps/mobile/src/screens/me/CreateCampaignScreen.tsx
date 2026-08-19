/**
 * apps/mobile/src/screens/me/CreateCampaignScreen.tsx
 *
 * Create a new expert campaign.
 * Core loop: form (title, description, budget, dates) → api.createCampaign() → submit flow.
 *
 * Submit flow (PayPal-based):
 *   1. api.submitCampaign(id) → creates a PayPal order, returns approval_url
 *   2. Open approval_url in WebBrowser
 *   3. On callback: api.captureSubmissionOrder(id, orderId)
 * For the mobile core loop, step 2 uses expo-web-browser.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { TextInput } from 'react-native-paper';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import * as WebBrowser from 'expo-web-browser';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii } from '@mobile/theme/tokens';
import { api } from '@mobile/lib/api';

const schema = z.object({
  title:        z.string().min(3, 'Title required').max(160),
  description:  z.string().max(2000).optional(),
  budget_cents: z.coerce.number().int().min(100, 'Minimum budget is €1').optional(),
  start_date:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').optional(),
  end_date:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').optional(),
  target_audience: z.string().max(500).optional(),
  location:     z.string().max(200).optional(),
});
type Form = z.infer<typeof schema>;

export function CreateCampaignScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const [step, setStep] = useState<'form' | 'submitting' | 'payment'>('form');

  const { control, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { title: '', description: '', target_audience: '', location: '' },
  });

  const onSubmit = async (values: Form) => {
    setStep('submitting');
    try {
      // Step 1: Create the campaign
      const campaign = await api.createCampaign(values);
      const campaignId: string = campaign?.id;
      if (!campaignId) throw new Error('No campaign ID returned');

      // Step 2: Submit (creates PayPal order)
      const submitResult = await api.submitCampaign(campaignId);
      const approvalUrl: string | undefined = submitResult?.approval_url;

      if (approvalUrl) {
        setStep('payment');
        // Step 3: Open PayPal approval in browser
        const result = await WebBrowser.openAuthSessionAsync(approvalUrl, 'dressapp://payment');
        if (result.type === 'success' && result.url) {
          // Extract orderId from callback URL
          const urlParams = new URLSearchParams(result.url.split('?')[1] ?? '');
          const orderId = urlParams.get('token') ?? urlParams.get('orderId') ?? '';
          if (orderId) {
            await api.captureSubmissionOrder(campaignId, orderId);
          }
        }
      }

      Alert.alert(
        t('campaigns.submitted', 'Campaign submitted'),
        t('campaigns.submittedMsg', 'Your campaign is pending approval. We\'ll notify you when it goes live.'),
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } catch (err: unknown) {
      setStep('form');
      Alert.alert(
        t('common.error', 'Error'),
        (err as { response?: { data?: { detail?: string } }; message?: string })?.response?.data?.detail
          ?? (err as { message?: string })?.message
          ?? 'Failed to create campaign',
      );
    }
  };

  const s = makeStyles(colors);

  if (step === 'submitting' || step === 'payment') {
    return (
      <SafeAreaView style={[s.root, s.center]}>
        <ActivityIndicator color={colors.accent} size="large" />
        <Text style={s.loadingText}>
          {step === 'payment'
            ? t('campaigns.awaitingPayment', 'Awaiting payment approval…')
            : t('campaigns.creating', 'Creating campaign…')}
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root} edges={['bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          <Text style={s.sectionLabel}>{t('campaigns.basics', 'Campaign basics')}</Text>

          <Controller control={control} name="title" render={({ field: { onChange, value } }) => (
            <TextInput label={t('campaigns.titleLabel', 'Campaign title *')} value={value} onChangeText={onChange}
              mode="outlined" outlineColor={colors.border} activeOutlineColor={colors.accent}
              textColor={colors.foreground} style={s.input} error={!!errors.title} />
          )} />
          {errors.title && <Text style={s.fieldError}>{errors.title.message}</Text>}

          <Controller control={control} name="description" render={({ field: { onChange, value } }) => (
            <TextInput label={t('campaigns.descriptionLabel', 'Description')} value={value} onChangeText={onChange}
              mode="outlined" multiline numberOfLines={4} outlineColor={colors.border}
              activeOutlineColor={colors.accent} textColor={colors.foreground} style={s.input} />
          )} />

          <Text style={s.sectionLabel}>{t('campaigns.budgetDates', 'Budget & dates')}</Text>

          <Controller control={control} name="budget_cents" render={({ field: { onChange, value } }) => (
            <TextInput label={t('campaigns.budgetLabel', 'Budget (cents, e.g. 5000 = €50)')}
              value={value != null ? String(value) : ''} onChangeText={onChange}
              mode="outlined" keyboardType="numeric" outlineColor={colors.border}
              activeOutlineColor={colors.accent} textColor={colors.foreground} style={s.input}
              error={!!errors.budget_cents} />
          )} />
          {errors.budget_cents && <Text style={s.fieldError}>{errors.budget_cents.message}</Text>}

          <View style={s.dateRow}>
            <Controller control={control} name="start_date" render={({ field: { onChange, value } }) => (
              <TextInput label={t('campaigns.startDate', 'Start (YYYY-MM-DD)')} value={value ?? ''}
                onChangeText={onChange} mode="outlined" outlineColor={colors.border}
                activeOutlineColor={colors.accent} textColor={colors.foreground}
                style={[s.input, s.dateInput]} />
            )} />
            <Controller control={control} name="end_date" render={({ field: { onChange, value } }) => (
              <TextInput label={t('campaigns.endDate', 'End (YYYY-MM-DD)')} value={value ?? ''}
                onChangeText={onChange} mode="outlined" outlineColor={colors.border}
                activeOutlineColor={colors.accent} textColor={colors.foreground}
                style={[s.input, s.dateInput]} />
            )} />
          </View>

          <Text style={s.sectionLabel}>{t('campaigns.targeting', 'Targeting')}</Text>

          <Controller control={control} name="target_audience" render={({ field: { onChange, value } }) => (
            <TextInput label={t('campaigns.targetAudience', 'Target audience')} value={value ?? ''} onChangeText={onChange}
              mode="outlined" outlineColor={colors.border} activeOutlineColor={colors.accent}
              textColor={colors.foreground} style={s.input} />
          )} />

          <Controller control={control} name="location" render={({ field: { onChange, value } }) => (
            <TextInput label={t('campaigns.location', 'Location (city, country)')} value={value ?? ''}
              onChangeText={onChange} mode="outlined" outlineColor={colors.border}
              activeOutlineColor={colors.accent} textColor={colors.foreground} style={s.input} />
          )} />

          <TouchableOpacity style={s.submitBtn} onPress={handleSubmit(onSubmit)}>
            <Text style={s.submitBtnText}>{t('campaigns.createAndSubmit', 'Create & submit for approval')}</Text>
          </TouchableOpacity>

          <Text style={s.note}>
            {t('campaigns.note', 'Submitting will open a payment screen to fund the campaign. It goes live after admin approval.')}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles(c: ReturnType<typeof import('@mobile/theme').useTheme>['colors']) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[4] },
    scroll: { padding: spacing[5], gap: spacing[4], paddingBottom: spacing[12] },
    sectionLabel: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.xs, color: c.mutedFg, textTransform: 'uppercase', letterSpacing: 0.8 },
    input: { backgroundColor: c.background },
    dateRow: { flexDirection: 'row', gap: spacing[3] },
    dateInput: { flex: 1 },
    fieldError: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: c.destructive },
    submitBtn: { backgroundColor: c.foreground, borderRadius: radii.md, paddingVertical: spacing[4], alignItems: 'center' },
    submitBtnText: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.base, color: c.background },
    note: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: c.mutedFg, textAlign: 'center', lineHeight: 18 },
    loadingText: { fontFamily: fonts.body, fontSize: fontSizes.base, color: c.mutedFg, textAlign: 'center' },
  });
}
