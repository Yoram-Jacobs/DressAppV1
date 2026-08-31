/**
 * apps/mobile/src/components/profile/AIConfiguration.tsx
 *
 * AI Stylist & Model Settings accordion section for DressApp mobile.
 * Features:
 *   - Model Provider selector (Google Gemini, OpenAI, Claude, DeepSeek, Qwen) with framed selection
 *   - Model selector for chosen provider
 *   - TTS Voice selector across 13 languages with framed selection
 *   - Custom API Key management modal
 *   - (Creativity/Temperature and Custom Persona removed per specification)
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ScrollView,
  Linking,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Lucide from 'lucide-react-native';
import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii } from '@mobile/theme/tokens';

export interface AIProvider {
  id: string;
  name: string;
  defaultModel: string;
  models: string[];
}

export const AI_PROVIDERS: AIProvider[] = [
  {
    id: 'google_ai',
    name: 'Google Gemini',
    defaultModel: 'gemini-3.5-flash',
    models: ['gemini-3.5-flash', 'gemini-3.5-pro'],
  },
  {
    id: 'openai',
    name: 'OpenAI ChatGPT',
    defaultModel: 'gpt-4o-mini',
    models: ['gpt-4o-mini', 'gpt-4o'],
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    defaultModel: 'claude-3-5-haiku',
    models: ['claude-3-5-haiku', 'claude-3-5-sonnet'],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    defaultModel: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-coder'],
  },
  {
    id: 'qwen',
    name: 'Alibaba Qwen',
    defaultModel: 'qwen-plus',
    models: ['qwen-plus', 'qwen-max'],
  },
];

export const TTS_VOICES = [
  { id: 'aura-2-thalia-en', name: 'Thalia (English - Expressive)' },
  { id: 'aura-2-orpheus-en', name: 'Orpheus (English - Confident)' },
  { id: 'he_IL-hebrew-medium', name: 'Noa (עברית / Hebrew)' },
  { id: 'ar_JO-kareem-low', name: 'Kareem (العربية / Arabic)' },
  { id: 'es_ES-carl-medium', name: 'Carlos (Español / Spanish)' },
  { id: 'fr_FR-gilles-low', name: 'Gilles (Français / French)' },
  { id: 'de_DE-thorsten-medium', name: 'Thorsten (Deutsch / German)' },
  { id: 'it_IT-riccardo-medium', name: 'Riccardo (Italiano / Italian)' },
  { id: 'pt_BR-faber-medium', name: 'Faber (Português / Portuguese)' },
  { id: 'ru_RU-dmitri-medium', name: 'Dmitri (Русский / Russian)' },
  { id: 'zh_CN-huayan-medium', name: 'Huayan (中文 / Mandarin)' },
  { id: 'ja_JP-koko-medium', name: 'Koko (日本語 / Japanese)' },
  { id: 'hi_IN-rohan-medium', name: 'Rohan (हिन्दी / Hindi)' },
];

interface AIConfigProps {
  selectedProvider: string;
  setSelectedProvider: (val: string) => void;
  selectedModel: string;
  setSelectedModel: (val: string) => void;
  preferredVoiceId: string;
  setPreferredVoiceId: (val: string) => void;
  customKeys?: Record<string, boolean>;
  onSaveApiKey?: (providerId: string, apiKey: string) => Promise<void>;
  onRemoveApiKey?: (providerId: string) => Promise<void>;
  onSaveConfig?: (providerId: string, model: string) => Promise<void>;
}

import { api } from '@mobile/lib/api';

export function AIConfiguration({
  selectedProvider,
  setSelectedProvider,
  selectedModel,
  setSelectedModel,
  preferredVoiceId,
  setPreferredVoiceId,
  customKeys = {},
  onSaveApiKey,
  onRemoveApiKey,
  onSaveConfig,
}: AIConfigProps) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();

  const [modalVisible, setModalVisible] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showKeyText, setShowKeyText] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [validatingKey, setValidatingKey] = useState(false);

  const activeProvider =
    AI_PROVIDERS.find((p) => p.id === selectedProvider) || AI_PROVIDERS[0];
  const hasKey = !!customKeys[selectedProvider];

  const handleProviderSelect = (provider: AIProvider) => {
    setSelectedProvider(provider.id);
    setSelectedModel(provider.defaultModel);
    onSaveConfig?.(provider.id, provider.defaultModel);
  };

  const handleModelSelect = (model: string) => {
    setSelectedModel(model);
    onSaveConfig?.(selectedProvider, model);
  };

  const getPlaceholder = (providerId: string) => {
    switch (providerId) {
      case 'google_ai':
        return 'AIzaSy...';
      case 'anthropic':
        return 'sk-ant-...';
      case 'openai':
      case 'deepseek':
        return 'sk-...';
      default:
        return 'Enter API key';
    }
  };

  const getProviderDocUrl = (providerId: string) => {
    switch (providerId) {
      case 'google_ai':
        return 'https://aistudio.google.com/app/apikey';
      case 'openai':
        return 'https://platform.openai.com/api-keys';
      case 'anthropic':
        return 'https://console.anthropic.com/settings/keys';
      case 'deepseek':
        return 'https://platform.deepseek.com/api_keys';
      default:
        return null;
    }
  };

  const handleValidateKey = async () => {
    const trimmed = apiKeyInput.trim();
    if (!trimmed) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('aiConfig.apiKeyRequired', { defaultValue: 'Please enter a valid API key to test.' })
      );
      return;
    }
    setValidatingKey(true);
    try {
      const res = await api.validateApiKey({ provider: selectedProvider, api_key: trimmed });
      if (res?.valid) {
        Alert.alert(
          t('common.success', { defaultValue: 'Success' }),
          t('profile.apiKeyValidNotice', {
            defaultValue: 'API Key is valid and connected successfully to Google Gemini!',
          })
        );
      } else {
        Alert.alert(
          t('common.error', { defaultValue: 'Invalid API Key' }),
          res?.message || t('profile.apiKeyInvalidNotice', { defaultValue: 'API Key validation failed. Please check your key from Google AI Studio.' })
        );
      }
    } catch (err: any) {
      const errMsg =
        err?.response?.data?.detail ||
        err?.message ||
        t('profile.apiKeyInvalidNotice', { defaultValue: 'API Key validation failed. Please check your key from Google AI Studio.' });
      Alert.alert(t('common.error', { defaultValue: 'Invalid API Key' }), String(errMsg));
    } finally {
      setValidatingKey(false);
    }
  };

  const handleSaveKeySubmit = async () => {
    const trimmed = apiKeyInput.trim();
    if (!trimmed) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('aiConfig.apiKeyRequired', { defaultValue: 'Please enter a valid API key.' })
      );
      return;
    }
    setSavingKey(true);
    try {
      // Validate key with the backend before saving
      const valRes = await api.validateApiKey({ provider: selectedProvider, api_key: trimmed });
      if (!valRes?.valid) {
        throw new Error(valRes?.message || 'Invalid API key');
      }

      if (onSaveApiKey) {
        await onSaveApiKey(selectedProvider, trimmed);
      }
      setApiKeyInput('');
      setModalVisible(false);
      Alert.alert(
        t('common.success', { defaultValue: 'Success' }),
        t('aiConfig.apiKeySaved', { defaultValue: 'API Key is valid and saved securely.' })
      );
    } catch (err: any) {
      const errMsg =
        err?.response?.data?.detail ||
        err?.message ||
        t('aiConfig.apiKeyFailed', { defaultValue: 'Failed to validate or save API key.' });
      Alert.alert(t('common.error', { defaultValue: 'Invalid API Key' }), String(errMsg));
    } finally {
      setSavingKey(false);
    }
  };

  const handleRemoveKey = async () => {
    Alert.alert(
      t('profile.removeKeyTitle', { defaultValue: 'Remove API Key' }),
      t('profile.removeKeyConfirm', {
        defaultValue: 'Are you sure you want to remove your custom key and revert to shared system credits?',
      }),
      [
        { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
        {
          text: t('common.remove', { defaultValue: 'Remove' }),
          style: 'destructive',
          onPress: async () => {
            setSavingKey(true);
            try {
              if (onRemoveApiKey) {
                await onRemoveApiKey(selectedProvider);
              } else if (onSaveApiKey) {
                await onSaveApiKey(selectedProvider, '');
              }
              setModalVisible(false);
              Alert.alert(
                t('common.success', { defaultValue: 'Success' }),
                t('profile.keyRemoved', { defaultValue: 'Custom API key removed.' })
              );
            } catch (err: any) {
              Alert.alert(
                t('common.error', { defaultValue: 'Error' }),
                err?.response?.data?.detail || 'Failed to remove API key.'
              );
            } finally {
              setSavingKey(false);
            }
          },
        },
      ]
    );
  };

  const docUrl = getProviderDocUrl(selectedProvider);

  return (
    <View style={styles.container}>
      {/* Provider Selector */}
      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.foreground }]}>
          {t('profile.aiProvider', { defaultValue: 'AI Engine & Model Provider' })}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.providersRow}>
          {AI_PROVIDERS.map((prov) => {
            const isSelected = selectedProvider === prov.id;
            return (
              <TouchableOpacity
                key={prov.id}
                style={[
                  styles.providerCard,
                  {
                    backgroundColor: isSelected
                      ? isDark
                        ? 'rgba(35, 139, 130, 0.22)'
                        : 'rgba(31, 111, 107, 0.12)'
                      : colors.secondary,
                    borderColor: isSelected ? colors.accent : colors.border,
                    borderWidth: isSelected ? 2 : 1,
                  },
                ]}
                onPress={() => handleProviderSelect(prov)}
                activeOpacity={0.8}
              >
                <View style={styles.providerCardHeader}>
                  <Lucide.Cpu
                    size={16}
                    color={isSelected ? colors.accent : colors.mutedFg}
                  />
                  <Text
                    style={[
                      styles.providerName,
                      {
                        color: isSelected ? colors.foreground : colors.mutedFg,
                        fontFamily: isSelected ? fonts.bodyBold : fonts.bodyMedium,
                      },
                    ]}
                  >
                    {prov.name}
                  </Text>
                </View>
                <Text style={[styles.providerDefaultModel, { color: colors.mutedFg }]}>
                  {prov.defaultModel}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Model Selector for Selected Provider */}
      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.foreground }]}>
          {t('profile.selectedModel', { defaultValue: 'Active AI Model' })}
        </Text>
        <View style={styles.chipsContainer}>
          {activeProvider.models.map((mod) => {
            const isSelected = selectedModel === mod;
            return (
              <TouchableOpacity
                key={mod}
                style={[
                  styles.chip,
                  {
                    backgroundColor: isSelected
                      ? isDark
                        ? 'rgba(35, 139, 130, 0.22)'
                        : 'rgba(31, 111, 107, 0.12)'
                      : colors.secondary,
                    borderColor: isSelected ? colors.accent : colors.border,
                    borderWidth: isSelected ? 2 : 1,
                  },
                ]}
                onPress={() => handleModelSelect(mod)}
              >
                <Text
                  style={[
                    styles.chipText,
                    {
                      color: isSelected ? colors.foreground : colors.mutedFg,
                      fontFamily: isSelected ? fonts.bodyBold : fonts.bodyMedium,
                    },
                  ]}
                >
                  {mod}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Custom API Key Button */}
      <View style={[styles.keyCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
        <View style={styles.keyInfo}>
          <Lucide.Key size={18} color={hasKey ? colors.accent : colors.mutedFg} />
          <View style={styles.keyTextWrap}>
            <Text style={[styles.keyTitle, { color: colors.foreground }]}>
              {t('profile.bringYourOwnKey', { defaultValue: 'Bring Your Own API Key' })}
            </Text>
            <Text style={[styles.keySub, { color: colors.mutedFg }]}>
              {hasKey
                ? t('profile.customKeyConfigured', { defaultValue: 'Custom key active for this provider.' })
                : t('profile.usingServerDefaults', { defaultValue: 'Using shared system credits.' })}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.keyBtn, { borderColor: colors.accent }]}
          onPress={() => setModalVisible(true)}
        >
          <Text style={[styles.keyBtnText, { color: colors.accent }]}>
            {hasKey ? t('common.edit', { defaultValue: 'Edit Key' }) : t('common.addKey', { defaultValue: '+ Add Key' })}
          </Text>
        </TouchableOpacity>
      </View>

      {/* TTS Voice Selector */}
      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.foreground }]}>
          {t('profile.voiceSelection', { defaultValue: 'AI Stylist Speech & Voice' })}
        </Text>
        <View style={styles.voiceList}>
          {TTS_VOICES.map((v) => {
            const isSelected = preferredVoiceId === v.id;
            return (
              <TouchableOpacity
                key={v.id}
                style={[
                  styles.voiceItem,
                  {
                    backgroundColor: isSelected
                      ? isDark
                        ? 'rgba(35, 139, 130, 0.22)'
                        : 'rgba(31, 111, 107, 0.12)'
                      : colors.secondary,
                    borderColor: isSelected ? colors.accent : colors.border,
                    borderWidth: isSelected ? 2 : 1,
                  },
                ]}
                onPress={() => setPreferredVoiceId(v.id)}
              >
                <View style={styles.voiceItemLeft}>
                  <Lucide.Volume2 size={16} color={isSelected ? colors.accent : colors.mutedFg} />
                  <Text
                    style={[
                      styles.voiceItemName,
                      {
                        color: isSelected ? colors.foreground : colors.mutedFg,
                        fontFamily: isSelected ? fonts.bodyBold : fonts.bodyMedium,
                      },
                    ]}
                  >
                    {v.name}
                  </Text>
                </View>
                {isSelected && <Lucide.Check size={16} color={colors.accent} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* API Key Modal */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                {activeProvider.name} API Key
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Lucide.X size={20} color={colors.mutedFg} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalSub, { color: colors.mutedFg }]}>
              Enter your personal API key for direct unlimited access. Keys are encrypted securely.
            </Text>

            {hasKey && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  backgroundColor: isDark ? 'rgba(35, 139, 130, 0.2)' : 'rgba(31, 111, 107, 0.1)',
                  paddingHorizontal: spacing.sm,
                  paddingVertical: 6,
                  borderRadius: radii.md,
                  marginBottom: 6,
                }}
              >
                <Lucide.CheckCircle2 size={14} color={colors.accent} />
                <Text
                  style={{
                    fontSize: 11,
                    color: colors.accent,
                    fontFamily: fonts.bodyMedium,
                    flex: 1,
                  }}
                >
                  {t('profile.keyCurrentlyActive', {
                    defaultValue: 'A key is currently active & encrypted. Enter a new key below only to replace it.',
                  })}
                </Text>
              </View>
            )}

            {docUrl && (
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}
                onPress={() => Linking.openURL(docUrl)}
              >
                <Lucide.ExternalLink size={14} color={colors.accent} />
                <Text style={{ fontSize: fontSizes.xs, color: colors.accent, fontFamily: fonts.bodyMedium }}>
                  Get key from {activeProvider.name} console
                </Text>
              </TouchableOpacity>
            )}

            <View style={[styles.inputRow, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <TextInput
                style={[styles.modalInput, { color: colors.foreground }]}
                value={apiKeyInput}
                onChangeText={setApiKeyInput}
                placeholder={getPlaceholder(selectedProvider)}
                placeholderTextColor={colors.mutedFg}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry={!showKeyText}
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowKeyText(!showKeyText)}
              >
                {showKeyText ? (
                  <Lucide.EyeOff size={18} color={colors.mutedFg} />
                ) : (
                  <Lucide.Eye size={18} color={colors.mutedFg} />
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.modalActions}>
              {hasKey && (
                <TouchableOpacity
                  style={[styles.modalRemoveBtn, { borderColor: colors.destructive || '#EF4444' }]}
                  onPress={handleRemoveKey}
                  disabled={savingKey || validatingKey}
                >
                  <Text style={[styles.modalRemoveBtnText, { color: colors.destructive || '#EF4444' }]}>
                    {t('common.remove', { defaultValue: 'Remove' })}
                  </Text>
                </TouchableOpacity>
              )}
              <View style={{ flex: 1 }} />
              <TouchableOpacity
                style={[styles.modalCancelBtn, { borderColor: colors.border }]}
                onPress={() => setModalVisible(false)}
                disabled={savingKey || validatingKey}
              >
                <Text style={[styles.modalCancelBtnText, { color: colors.foreground }]}>
                  {t('common.cancel', { defaultValue: 'Cancel' })}
                </Text>
              </TouchableOpacity>
              {apiKeyInput.trim().length > 0 && (
                <TouchableOpacity
                  style={[styles.modalCancelBtn, { borderColor: colors.accent, backgroundColor: colors.card }]}
                  onPress={handleValidateKey}
                  disabled={savingKey || validatingKey}
                >
                  <Text style={[styles.modalCancelBtnText, { color: colors.accent, fontFamily: fonts.bodyBold }]}>
                    {validatingKey ? t('common.testing', { defaultValue: 'Testing...' }) : t('profile.testKey', { defaultValue: 'Test Key' })}
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.modalSubmitBtn, { backgroundColor: colors.accent }]}
                onPress={handleSaveKeySubmit}
                disabled={savingKey || validatingKey}
              >
                <Text style={styles.modalSubmitBtnText}>
                  {savingKey ? t('common.saving', { defaultValue: 'Saving...' }) : t('common.save', { defaultValue: 'Save Key' })}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  field: {
    gap: spacing.xs,
  },
  label: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
  },
  providersRow: {
    gap: spacing.sm,
    paddingVertical: 2,
  },
  providerCard: {
    width: 140,
    padding: spacing.sm,
    borderRadius: radii.lg,
    gap: 4,
  },
  providerCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  providerName: {
    fontSize: fontSizes.xs,
  },
  providerDefaultModel: {
    fontFamily: fonts.body,
    fontSize: 10,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radii.full,
  },
  chipText: {
    fontSize: fontSizes.xs,
  },
  keyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.sm,
  },
  keyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  keyTextWrap: {
    flex: 1,
    gap: 2,
  },
  keyTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
  },
  keySub: {
    fontFamily: fonts.body,
    fontSize: 10.5,
  },
  keyBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  keyBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
  },
  voiceList: {
    gap: spacing.xs,
  },
  voiceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    borderRadius: radii.md,
  },
  voiceItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
  },
  voiceItemName: {
    fontSize: fontSizes.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.base,
  },
  modalSub: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    lineHeight: 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
  },
  modalInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: fontSizes.sm,
    fontFamily: fonts.body,
  },
  eyeBtn: {
    padding: spacing.xs,
  },
  modalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  modalRemoveBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  modalRemoveBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
  },
  modalCancelBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  modalCancelBtnText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.xs,
  },
  modalSubmitBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radii.md,
  },
  modalSubmitBtnText: {
    color: '#FFF',
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
  },
});
