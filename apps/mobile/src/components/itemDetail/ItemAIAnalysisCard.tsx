/**
 * apps/mobile/src/components/itemDetail/ItemAIAnalysisCard.tsx
 *
 * Visual AI Vision Re-Analysis & Nano-Banana Inpainting Interactive Assistant.
 * Fully aligned with DressApp-web (ItemDetail.jsx):
 *   - 1-Click Full Re-analyse with asymptotic progress bar and in-place form hydration.
 *   - Interactive Multi-Turn Chat with The Eyes / Gemini Vision & Nano-Banana.
 *   - Quick Prompt Starters (Remove shoes, complete holes, remove studs, refine fabric).
 *   - Image Inpainting Previews with 1-tap "Apply as garment photo".
 *   - Updated metadata chips feedback.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  I18nManager,
} from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import * as Lucide from 'lucide-react-native';

import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii, shadows } from '@mobile/theme/tokens';

export interface ReanalyzeChatTurn {
  role: 'user' | 'assistant';
  content: string;
  action_taken?: 'metadata_update' | 'image_edit' | 'none' | string;
  image_url?: string;
  updated_fields?: Record<string, any>;
  error?: boolean;
}

interface ItemAIAnalysisProps {
  itemId?: string;
  analyzing: boolean;
  onReanalyze: () => void;
  reanalyzeProgress: number;
  chatHistory: ReanalyzeChatTurn[];
  chatBusy: boolean;
  chatProgress: number;
  onSendPrompt: (promptText: string) => void;
  appliedImageUrl?: string | null;
  onApplyImage?: (imageUrl: string) => void;
  onFocusInput?: () => void;
}

export function ItemAIAnalysisCard({
  itemId,
  analyzing,
  onReanalyze,
  reanalyzeProgress,
  chatHistory,
  chatBusy,
  chatProgress,
  onSendPrompt,
  appliedImageUrl,
  onApplyImage,
  onFocusInput,
}: ItemAIAnalysisProps) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const isRtl = I18nManager.isRTL;

  const [promptInput, setPromptInput] = useState('');

  const handleSend = (textToSend?: string) => {
    const text = (typeof textToSend === 'string' ? textToSend : promptInput).trim();
    if (!text || chatBusy || analyzing) return;
    setPromptInput('');
    onSendPrompt(text);
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* ── Header ────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={[styles.iconBox, { backgroundColor: isDark ? 'rgba(232, 96, 60, 0.15)' : '#FFF1EE' }]}>
            <Lucide.Sparkles size={18} color="#E8603C" />
          </View>
          <View style={styles.titleCol}>
            <Text style={[styles.title, { color: colors.foreground }]}>
              {t('itemDetail.reanalyze.label', { defaultValue: 'AI Vision & Inpainting' })}
            </Text>
            <Text style={[styles.subtitle, { color: colors.mutedFg }]}>
              {t('itemDetail.reanalyze.eyesBadge', { defaultValue: 'The Eyes / Gemini Vision' })}
            </Text>
          </View>
        </View>

        {/* 1-Click Full Re-analyse Button */}
        <TouchableOpacity
          style={[
            styles.reAnalyzeBtn,
            {
              backgroundColor: isDark ? 'rgba(31, 111, 107, 0.18)' : '#E6F4F3',
              borderColor: colors.accent,
            },
          ]}
          onPress={onReanalyze}
          disabled={analyzing || chatBusy}
          activeOpacity={0.7}
        >
          {analyzing ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <Lucide.RefreshCw size={13} color={colors.accent} />
          )}
          <Text style={[styles.reAnalyzeText, { color: colors.accent }]}>
            {analyzing
              ? t('itemDetail.reanalyze.running', { defaultValue: 'Analyzing…' })
              : t('itemDetail.reanalyze.quickReanalyze', { defaultValue: '1-Click Full Re-analyse' })}
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={[styles.desc, { color: colors.mutedFg, textAlign: isRtl ? 'right' : 'left' }]}>
        {t('itemDetail.reanalyze.subtitle', {
          defaultValue: 'Chat with The Eyes to remove unwanted objects, complete cutoffs, or refine garment details using Nano Banana.',
        })}
      </Text>

      {/* ── 1-Click Reanalyze Progress Bar ────────────────────────────── */}
      {analyzing && (
        <View style={[styles.progressSection, { backgroundColor: colors.secondary }]}>
          <View style={styles.progressBarTrack}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${Math.max(5, Math.min(100, reanalyzeProgress))}%`, backgroundColor: colors.accent },
              ]}
            />
          </View>
          <View style={[styles.progressInfoRow, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
            <Text style={[styles.progressHintText, { color: colors.mutedFg }]}>
              {t('itemDetail.reanalyze.progressHint', {
                defaultValue: 'Reading photo, identifying garment, and rewriting auto-fill fields…',
              })}
            </Text>
            <Text style={[styles.progressPctText, { color: colors.accent }]}>
              {Math.round(reanalyzeProgress)}%
            </Text>
          </View>
        </View>
      )}

      {/* ── Interactive Chat History Thread ────────────────────────────── */}
      {chatHistory.length > 0 && (
        <View style={styles.chatThread}>
          {chatHistory.map((turn, idx) => (
            <View
              key={idx}
              style={[
                styles.turnContainer,
                turn.role === 'user' ? styles.userTurn : styles.assistantTurn,
              ]}
            >
              {turn.role === 'user' ? (
                <View style={[styles.userBubble, { backgroundColor: colors.primary }]}>
                  <Text style={styles.userBubbleText}>{turn.content}</Text>
                </View>
              ) : (
                <View style={styles.assistantCol}>
                  {/* Badges */}
                  <View style={[styles.badgeRow, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
                    <View style={[styles.badgePill, { backgroundColor: isDark ? '#082f49' : '#e0f2fe' }]}>
                      <Lucide.Sparkles size={10} color="#0284c7" />
                      <Text style={[styles.badgeText, { color: '#0284c7' }]}>
                        {t('itemDetail.reanalyze.eyesBadge', { defaultValue: 'The Eyes' })}
                      </Text>
                    </View>

                    {turn.action_taken === 'image_edit' && (
                      <View style={[styles.badgePill, { backgroundColor: isDark ? '#451a03' : '#fef3c7' }]}>
                        <Text style={[styles.badgeText, { color: '#d97706' }]}>
                          {t('itemDetail.reanalyze.nanoBananaBadge', { defaultValue: 'Nano Banana' })}
                        </Text>
                      </View>
                    )}

                    {turn.action_taken === 'metadata_update' && (
                      <View style={[styles.badgePill, { backgroundColor: isDark ? '#064e3b' : '#d1fae5' }]}>
                        <Text style={[styles.badgeText, { color: '#059669' }]}>
                          {t('itemDetail.reanalyze.refreshedAttributes', { defaultValue: 'Refreshed attributes' })}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Bubble Content */}
                  <View
                    style={[
                      styles.assistantBubble,
                      {
                        backgroundColor: turn.error
                          ? isDark ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2'
                          : colors.secondary,
                        borderColor: turn.error ? '#f87171' : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.assistantBubbleText,
                        {
                          color: turn.error ? '#dc2626' : colors.foreground,
                          textAlign: isRtl ? 'right' : 'left',
                        },
                      ]}
                    >
                      {turn.content}
                    </Text>

                    {/* Reconstructed / Inpainted Image Preview */}
                    {turn.image_url ? (
                      <View style={[styles.imagePreviewBox, { borderColor: colors.border, backgroundColor: colors.card }]}>
                        <Image
                          source={{ uri: turn.image_url }}
                          style={styles.previewImage}
                          resizeMode="contain"
                        />
                        <TouchableOpacity
                          style={[
                            styles.applyImageBtn,
                            appliedImageUrl === turn.image_url
                              ? { backgroundColor: colors.secondary, borderColor: colors.border }
                              : { backgroundColor: colors.accent },
                          ]}
                          onPress={() => onApplyImage?.(turn.image_url!)}
                          activeOpacity={0.8}
                        >
                          {appliedImageUrl === turn.image_url ? (
                            <>
                              <Lucide.Check size={14} color="#10B981" />
                              <Text style={[styles.applyImageBtnText, { color: colors.foreground }]}>
                                {t('itemDetail.reanalyze.applied', { defaultValue: 'Applied' })}
                              </Text>
                            </>
                          ) : (
                            <>
                              <Lucide.Sparkles size={14} color="#FFF" />
                              <Text style={[styles.applyImageBtnText, { color: '#FFF' }]}>
                                {t('itemDetail.reanalyze.applyImage', { defaultValue: 'Apply as garment photo' })}
                              </Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>
                    ) : null}

                    {/* Updated metadata fields chips */}
                    {turn.updated_fields && (
                      <View style={[styles.fieldsRow, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
                        {Object.keys(turn.updated_fields).map((k) => (
                          <View key={k} style={[styles.fieldChip, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <Text style={[styles.fieldChipText, { color: colors.mutedFg }]}>
                              ✓ {k}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                </View>
              )}
            </View>
          ))}
        </View>
      )}

      {/* ── Chat Busy Progress Bar ────────────────────────────────────── */}
      {chatBusy && (
        <View style={[styles.progressSection, { backgroundColor: colors.secondary }]}>
          <View style={styles.progressBarTrack}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${Math.max(5, Math.min(100, chatProgress))}%`, backgroundColor: colors.accent },
              ]}
            />
          </View>
          <View style={[styles.progressInfoRow, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
            <View style={[styles.thinkingRow, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={[styles.progressHintText, { color: colors.foreground }]}>
                {t('itemDetail.reanalyze.eyesThinking', { defaultValue: 'The Eyes is analyzing…' })}
              </Text>
            </View>
            <Text style={[styles.progressPctText, { color: colors.accent }]}>
              {Math.round(chatProgress)}%
            </Text>
          </View>
        </View>
      )}

      {/* ── Quick Prompt Starters ──────────────────────────────────────── */}
      <View style={styles.startersSection}>
        <Text style={[styles.startersTitle, { color: colors.mutedFg, textAlign: isRtl ? 'right' : 'left' }]}>
          {t('itemDetail.reanalyze.promptStarters', { defaultValue: 'QUICK PROMPTS' })}
        </Text>
        <View style={[styles.startersGrid, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
          <TouchableOpacity
            style={[styles.starterChip, { backgroundColor: colors.secondary, borderColor: colors.border }]}
            onPress={() => handleSend(t('itemDetail.reanalyze.promptRemoveShoes', { defaultValue: 'Remove the shoes' }))}
            disabled={chatBusy || analyzing}
            activeOpacity={0.7}
          >
            <Text style={[styles.starterChipText, { color: colors.foreground }]}>
              🪄 {t('itemDetail.reanalyze.promptRemoveShoes', { defaultValue: 'Remove the shoes' })}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.starterChip, { backgroundColor: colors.secondary, borderColor: colors.border }]}
            onPress={() => handleSend(t('itemDetail.reanalyze.promptCompleteHole', { defaultValue: 'Complete the hole where the hand was' }))}
            disabled={chatBusy || analyzing}
            activeOpacity={0.7}
          >
            <Text style={[styles.starterChipText, { color: colors.foreground }]}>
              ✂️ {t('itemDetail.reanalyze.promptCompleteHole', { defaultValue: 'Complete hole' })}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.starterChip, { backgroundColor: colors.secondary, borderColor: colors.border }]}
            onPress={() => handleSend(t('itemDetail.reanalyze.promptFixMaterials', { defaultValue: 'Refine fabric and color palette' }))}
            disabled={chatBusy || analyzing}
            activeOpacity={0.7}
          >
            <Text style={[styles.starterChipText, { color: colors.foreground }]}>
              🔍 {t('itemDetail.reanalyze.promptFixMaterials', { defaultValue: 'Refine fabrics' })}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Interactive Prompt Input Box ──────────────────────────────── */}
      <View
        style={[
          styles.promptInputRow,
          {
            backgroundColor: colors.secondary,
            borderColor: colors.border,
            flexDirection: isRtl ? 'row-reverse' : 'row',
          },
        ]}
      >
        <TextInput
          style={[
            styles.promptInput,
            {
              color: colors.foreground,
              textAlign: isRtl ? 'right' : 'left',
            },
          ]}
          placeholder={t('itemDetail.reanalyze.promptPlaceholder', {
            defaultValue: 'Ask The Eyes: Remove shoes, Complete hole, Fix colors…',
          })}
          placeholderTextColor={colors.mutedFg}
          value={promptInput}
          onChangeText={setPromptInput}
          onFocus={onFocusInput}
          editable={!chatBusy && !analyzing}
          onSubmitEditing={() => handleSend()}
        />

        <TouchableOpacity
          style={[
            styles.sendBtn,
            {
              backgroundColor: colors.accent,
              opacity: !promptInput.trim() || chatBusy || analyzing ? 0.45 : 1,
            },
          ]}
          onPress={() => handleSend()}
          disabled={!promptInput.trim() || chatBusy || analyzing}
          activeOpacity={0.8}
        >
          {chatBusy ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Lucide.Send size={15} color="#FFF" />
          )}
        </TouchableOpacity>
      </View>

      {/* Footnote Disclaimer */}
      <Text style={[styles.disclaimerText, { color: colors.mutedFg, textAlign: isRtl ? 'right' : 'left' }]}>
        {t('itemDetail.reanalyze.disclaimer', {
          defaultValue: 'Only auto-filled fields are overwritten. Your manual edits to size, price, notes, and intent are preserved.',
        })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.xl,
    padding: spacing[4],
    borderWidth: 1,
    gap: spacing[3],
    ...shadows.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
    flexWrap: 'wrap',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2.5],
    flex: 1,
    minWidth: 180,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleCol: {
    flex: 1,
  },
  title: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.sm,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 10,
    marginTop: 1,
  },
  reAnalyzeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  reAnalyzeText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
  },
  desc: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    lineHeight: 18,
  },
  progressSection: {
    borderRadius: radii.lg,
    padding: spacing[3],
    gap: spacing[2],
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.08)',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  thinkingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  progressHintText: {
    fontFamily: fonts.body,
    fontSize: 10,
    flex: 1,
  },
  progressPctText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
  },
  chatThread: {
    gap: spacing[3],
    marginTop: spacing[1],
  },
  turnContainer: {
    width: '100%',
  },
  userTurn: {
    alignItems: 'flex-end',
  },
  assistantTurn: {
    alignItems: 'flex-start',
  },
  userBubble: {
    maxWidth: '85%',
    paddingHorizontal: spacing[3.5],
    paddingVertical: spacing[2],
    borderRadius: radii.xl,
    borderTopRightRadius: 2,
  },
  userBubbleText: {
    color: '#FFF',
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    lineHeight: 18,
  },
  assistantCol: {
    maxWidth: '92%',
    gap: spacing[1],
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  badgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
  },
  assistantBubble: {
    padding: spacing[3],
    borderRadius: radii.xl,
    borderTopLeftRadius: 2,
    borderWidth: 1,
    gap: spacing[2],
  },
  assistantBubbleText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    lineHeight: 19,
  },
  imagePreviewBox: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing[2],
    gap: spacing[2],
    marginTop: spacing[1],
  },
  previewImage: {
    width: '100%',
    height: 180,
    borderRadius: radii.md,
  },
  applyImageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing[2],
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  applyImageBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
  },
  fieldsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
  },
  fieldChip: {
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  fieldChipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
  },
  startersSection: {
    gap: spacing[1.5],
    marginTop: spacing[1],
  },
  startersTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  startersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[1.5],
  },
  starterChip: {
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[1.5],
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  starterChipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
  },
  promptInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radii.xl,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    gap: spacing[2],
    marginTop: spacing[1],
  },
  promptInput: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    paddingVertical: 4,
  },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disclaimerText: {
    fontFamily: fonts.body,
    fontSize: 10,
    fontStyle: 'italic',
    lineHeight: 14,
  },
});
