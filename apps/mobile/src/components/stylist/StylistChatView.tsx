/**
 * apps/mobile/src/components/stylist/StylistChatView.tsx
 *
 * Full-featured AI Stylist Conversational Chat Interface.
 * Features:
 *   - Scrollable message history with user and assistant message bubbles
 *   - Quick prompt suggestion chips (Dinner date, Rainy day, Casual office, etc.)
 *   - Outfit recommendation cards with harmony badges, garment thumbnails, and save actions
 *   - Text chatbox input + audio recording button
 *   - Automatic scroll to bottom on new messages
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Image,
  Alert,
  Platform,
  I18nManager,
  Share,
} from 'react-native';
import { Audio } from 'expo-av';
import { useTranslation } from 'react-i18next';
import * as Lucide from 'lucide-react-native';

import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii } from '@mobile/theme/tokens';
import { api, client } from '@mobile/lib/api';
import { useClosetStore } from '@mobile/lib/stores/closetStore';

export interface OutfitGarment {
  id?: string;
  name?: string;
  role?: string;
  image_url?: string;
  thumbnail_data_url?: string;
}

export interface StylistOutfitCard {
  id?: string;
  name?: string;
  occasion?: string;
  harmony_score?: number;
  reasoning?: string;
  garments?: OutfitGarment[];
  items?: OutfitGarment[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
  outfits?: StylistOutfitCard[];
}

const QUICK_PROMPTS = [
  '✨ Suggest a look for a dinner date',
  '💼 Casual Friday office outfit',
  '🌧️ Stylish layering for chilly rain',
  '👟 What matches my sneakers?',
  '🎉 Elegant evening cocktail party',
  '☕ Weekend coffee walk',
];

interface StylistChatViewProps {
  onSelectOutfitForTryOn?: (outfit: StylistOutfitCard) => void;
}

export function StylistChatView({ onSelectOutfitForTryOn }: StylistChatViewProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const isRtl = I18nManager.isRTL;
  const closetStore = useClosetStore();
  const closetItems = closetStore.items || [];

  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg_welcome',
      role: 'assistant',
      content: t('stylist.welcomeMsg', {
        defaultValue: "Hello! I'm your AI Fashion Stylist. Ask me what to wear, request looks for an occasion, or tap a quick prompt below!",
      }),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  const scrollRef = useRef<ScrollView>(null);

  // Helper to hydrate outfit recommendations with real closet item images
  const hydrateOutfits = (rawOutfits: any[]): StylistOutfitCard[] => {
    if (!Array.isArray(rawOutfits)) return [];
    return rawOutfits.map((o: any, idx: number) => {
      const rawItems = o.items || o.garments || [];
      const garments: OutfitGarment[] = rawItems.map((item: any) => {
        const matched = item.closet_item_id
          ? closetItems.find((c) => c.id === item.closet_item_id)
          : null;
        return {
          id: item.closet_item_id || matched?.id || item.id || `g_${Math.random()}`,
          name: item.description || item.title || matched?.name || matched?.title || item.role,
          role: item.role || matched?.category || 'Item',
          image_url: matched?.clean_image_url || matched?.cutout_url || matched?.thumbnail_data_url || matched?.image_url || item.image_url,
          thumbnail_data_url: matched?.thumbnail_data_url || item.thumbnail_data_url,
        };
      });

      return {
        id: o.id || `outfit_${idx}`,
        name: o.name || 'Curated Look',
        occasion: o.occasion || o.target_occasion,
        harmony_score: o.harmony_score || (o.confidence ? Math.round(o.confidence * 100) : 95),
        reasoning: o.why || o.reasoning || o.description,
        garments,
        items: garments,
      };
    });
  };

  // Initialize session and load history
  useEffect(() => {
    (async () => {
      try {
        const session = await api.stylistCreateSession().catch(() => null);
        const sId = session?.id ?? session?.session_id ?? null;
        setSessionId(sId);

        if (sId) {
          const history = await api.stylistHistory(sId).catch(() => null);
          if (history?.messages?.length) {
            const mapped: ChatMessage[] = history.messages.map((m: any, idx: number) => ({
              id: m.id || `hist_${idx}`,
              role: m.role,
              content: m.transcript || m.content || m.text || '',
              outfits: hydrateOutfits(m.assistant_payload?.outfit_recommendations || m.outfits || []),
              timestamp: m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined,
            }));
            setMessages(mapped);
          }
        }
      } catch {
        // Non-fatal
      }
    })();
  }, []);

  useEffect(() => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 150);
  }, [messages, loading]);

  const handleSendText = async (textToSend?: string) => {
    const text = (textToSend || inputQuery).trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('text', text);
      if (sessionId) formData.append('session_id', sessionId);

      const res = await api.stylist(formData);
      const advice = res?.advice || res;
      const outfitRecs = advice?.outfit_recommendations || res?.outfits || [];

      const assistantMsg: ChatMessage = {
        id: `msg_${Date.now() + 1}`,
        role: 'assistant',
        content: advice?.spoken_reply || advice?.reasoning_summary || res?.reply || res?.text || "Here is a curated outfit combination from your wardrobe:",
        outfits: hydrateOutfits(outfitRecs),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.warn('Stylist chat error:', err);
      const errDetail = err?.response?.data?.detail || err?.message;
      const fallbackMsg: ChatMessage = {
        id: `msg_${Date.now() + 1}`,
        role: 'assistant',
        content: errDetail
          ? `${t('common.error', { defaultValue: 'Error' })}: ${errDetail}`
          : t('stylist.errorAdvice', { defaultValue: 'Sorry, I had trouble putting that recommendation together. Please try again.' }),
        outfits: [],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setLoading(false);
    }
  };

  // Voice Recording
  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          t('common.permissionRequired', { defaultValue: 'Permission required' }),
          t('stylist.micPermissionDesc', { defaultValue: 'Please grant microphone access to speak to your stylist.' })
        );
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: rec } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(rec);
      setIsRecording(true);
    } catch (e: any) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('stylist.micStartFailed', { defaultValue: 'Could not start microphone recording.' })
      );
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    setIsRecording(false);
    setLoading(true);
    try {
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = recording.getURI();
      setRecording(null);

      if (!uri) throw new Error('No audio recording found');

      const formData = new FormData();
      formData.append('voice_audio', {
        uri,
        type: 'audio/m4a',
        name: 'voice.m4a',
      } as unknown as Blob);
      if (sessionId) formData.append('session_id', sessionId);

      setMessages((prev) => [
        ...prev,
        {
          id: `msg_${Date.now()}`,
          role: 'user',
          content: '🎙️ Voice note',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);

      const res = await api.stylist(formData);
      const advice = res?.advice || res;
      const outfitRecs = advice?.outfit_recommendations || res?.outfits || [];

      setMessages((prev) => [
        ...prev,
        {
          id: `msg_${Date.now() + 1}`,
          role: 'assistant',
          content: advice?.spoken_reply || advice?.reasoning_summary || res?.reply || res?.text || "Here is your requested styling recommendation:",
          outfits: hydrateOutfits(outfitRecs),
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err: any) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        err?.response?.data?.detail || err?.message || t('stylist.audioProcessFailed', { defaultValue: 'Could not process audio.' })
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSaveOutfit = async (outfit: StylistOutfitCard) => {
    try {
      const garments = outfit.garments ?? outfit.items ?? [];
      const body = {
        name: outfit.name || 'AI Styled Look',
        description: outfit.reasoning || '',
        source_workflow: 'scheduled',
        prompt: 'AI Stylist Recommendation',
        garments: garments.map((g: any) => ({
          closet_item_id: g.id || g.closet_item_id,
          role: g.role || 'item',
          title: g.name || g.title,
          image_url: g.image_url || g.thumbnail_data_url,
        })),
        usage: {
          date: new Date().toISOString().split('T')[0],
          time: new Date().toTimeString().split(' ')[0].substring(0, 5),
        },
      };
      await api.saveOutfit(body);
      Alert.alert(t('common.success', { defaultValue: 'Saved' }), t('stylist.outfitSaved', { defaultValue: 'Look saved to your collection!' }));
    } catch (err: any) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        err?.response?.data?.detail || err?.message || t('stylist.saveFailed', { defaultValue: 'Could not save outfit.' })
      );
    }
  };

  return (
    <View style={styles.container}>
      {/* Scrollable Message History */}
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.messagesScroll}
        showsVerticalScrollIndicator={false}
      >
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <View
              key={msg.id}
              style={[
                styles.messageRow,
                isUser ? styles.userMessageRow : styles.assistantMessageRow,
              ]}
            >
              {!isUser && (
                <View style={[styles.avatarIconWrap, { backgroundColor: colors.accent }]}>
                  <Lucide.Sparkles size={14} color="#FFF" />
                </View>
              )}

              <View
                style={[
                  styles.messageBubble,
                  isUser
                    ? [styles.userBubble, { backgroundColor: colors.primary }]
                    : [styles.assistantBubble, { backgroundColor: colors.card, borderColor: colors.border }],
                ]}
              >
                <Text
                  style={[
                    styles.messageText,
                    { color: isUser ? '#FFF' : colors.foreground },
                  ]}
                >
                  {msg.content}
                </Text>

                {msg.timestamp && (
                  <Text
                    style={[
                      styles.timestampText,
                      { color: isUser ? 'rgba(255,255,255,0.7)' : colors.mutedFg },
                    ]}
                  >
                    {msg.timestamp}
                  </Text>
                )}

                {/* Outfit Cards in Assistant Message */}
                {msg.outfits && msg.outfits.length > 0 && (
                  <View style={styles.outfitsContainer}>
                    {msg.outfits.map((outfit, oIdx) => {
                      const garments = outfit.garments ?? outfit.items ?? [];
                      return (
                        <View
                          key={oIdx}
                          style={[styles.outfitCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}
                        >
                          <View style={styles.outfitCardHeader}>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.outfitCardName, { color: colors.foreground }]}>
                                {outfit.name || 'Curated Look'}
                              </Text>
                              {outfit.occasion ? (
                                <Text style={[styles.outfitOccasion, { color: colors.accent }]}>
                                  {outfit.occasion}
                                </Text>
                              ) : null}
                            </View>

                            {outfit.harmony_score ? (
                              <View style={styles.harmonyPill}>
                                <Text style={styles.harmonyText}>
                                  {t('stylist.harmonyPercent', { score: outfit.harmony_score, defaultValue: `${outfit.harmony_score}% Harmony` })}
                                </Text>
                              </View>
                            ) : null}
                          </View>

                          {/* Garment Thumbnails Row */}
                          {garments.length > 0 && (
                            <ScrollView
                              horizontal
                              showsHorizontalScrollIndicator={false}
                              contentContainerStyle={styles.garmentThumbsRow}
                            >
                              {garments.map((g, gIdx) => {
                                const img = g.thumbnail_data_url || g.image_url;
                                return (
                                  <View key={gIdx} style={[styles.thumbBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                    {img ? (
                                      <Image source={{ uri: img }} style={styles.thumbImg} resizeMode="contain" />
                                    ) : (
                                      <Lucide.Shirt size={18} color={colors.mutedFg} />
                                    )}
                                    <Text style={[styles.thumbRole, { color: colors.mutedFg }]} numberOfLines={1}>
                                      {g.role || g.name || 'Item'}
                                    </Text>
                                  </View>
                                );
                              })}
                            </ScrollView>
                          )}

                          {/* Action Buttons */}
                          <View style={styles.outfitActions}>
                            <TouchableOpacity
                              style={[styles.saveOutfitBtn, { backgroundColor: colors.primary }]}
                              onPress={() => handleSaveOutfit(outfit)}
                            >
                              <Lucide.BookmarkCheck size={13} color="#FFF" />
                              <Text style={styles.saveOutfitBtnText}>
                                {t('stylist.saveLook', { defaultValue: 'Save Look' })}
                              </Text>
                            </TouchableOpacity>

                            {onSelectOutfitForTryOn && (
                              <TouchableOpacity
                                style={[styles.tryOnBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                                onPress={() => onSelectOutfitForTryOn(outfit)}
                              >
                                <Lucide.UserCheck size={13} color={colors.foreground} />
                                <Text style={[styles.tryOnBtnText, { color: colors.foreground }]}>
                                  {t('stylist.tryOn', { defaultValue: 'Try On' })}
                                </Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            </View>
          );
        })}

        {loading && (
          <View style={styles.typingRow}>
            <View style={[styles.avatarIconWrap, { backgroundColor: colors.accent }]}>
              <Lucide.Sparkles size={14} color="#FFF" />
            </View>
            <View style={[styles.typingBubble, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={[styles.typingText, { color: colors.mutedFg }]}>
                {t('stylist.thinking', { defaultValue: 'Stylist is curating...' })}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Quick Suggestion Chips */}
      <View style={styles.quickPromptsWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickPromptsRow}>
          {[
            { id: 'date', label: t('stylist.prompt_date', { defaultValue: '✨ Suggest a look for a dinner date' }) },
            { id: 'work', label: t('stylist.prompt_work', { defaultValue: '💼 Casual Friday office outfit' }) },
            { id: 'rain', label: t('stylist.prompt_rain', { defaultValue: '🌧️ Stylish layering for chilly rain' }) },
            { id: 'sneakers', label: t('stylist.prompt_sneakers', { defaultValue: '👟 What matches my sneakers?' }) },
            { id: 'party', label: t('stylist.prompt_party', { defaultValue: '🎉 Elegant evening cocktail party' }) },
            { id: 'coffee', label: t('stylist.prompt_coffee', { defaultValue: '☕ Weekend coffee walk' }) },
          ].map((prompt, idx) => (
            <TouchableOpacity
              key={idx}
              style={[styles.promptChip, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => handleSendText(prompt.label.replace(/^[^\s]+\s/, ''))}
            >
              <Text style={[styles.promptChipText, { color: colors.foreground }]}>{prompt.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Chatbox Input Bar */}
      <View style={[styles.inputBarWrapper, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[
            styles.micBtn,
            isRecording && { backgroundColor: '#EF4444' },
            { backgroundColor: isRecording ? '#EF4444' : colors.secondary },
          ]}
          onPress={isRecording ? stopRecording : startRecording}
        >
          <Lucide.Mic size={18} color={isRecording ? '#FFF' : colors.foreground} />
        </TouchableOpacity>

        <TextInput
          style={[styles.textInput, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
          value={inputQuery}
          onChangeText={setInputQuery}
          placeholder={isRecording ? t('stylist.listening', { defaultValue: 'Listening...' }) : t('stylist.composerPlaceholder', { defaultValue: 'Ask what to wear...' })}
          placeholderTextColor={colors.mutedFg}
          multiline
          maxLength={500}
        />

        <TouchableOpacity
          style={[
            styles.sendBtn,
            { backgroundColor: inputQuery.trim() ? colors.primary : colors.secondary },
          ]}
          onPress={() => handleSendText()}
          disabled={!inputQuery.trim() || loading}
        >
          <Lucide.Send size={16} color={inputQuery.trim() ? '#FFF' : colors.mutedFg} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  messagesScroll: {
    padding: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  userMessageRow: {
    justifyContent: 'flex-end',
  },
  assistantMessageRow: {
    justifyContent: 'flex-start',
  },
  avatarIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  messageBubble: {
    maxWidth: '82%',
    borderRadius: radii.xl,
    padding: spacing.md,
    gap: 4,
  },
  userBubble: {
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    borderBottomLeftRadius: 4,
    borderWidth: 1,
  },
  messageText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    lineHeight: 20,
  },
  timestampText: {
    fontFamily: fonts.body,
    fontSize: 9.5,
    alignSelf: 'flex-end',
    marginTop: 2,
  },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radii.xl,
    borderWidth: 1,
  },
  typingText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
  },
  outfitsContainer: {
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  outfitCard: {
    borderRadius: radii.lg,
    padding: spacing.sm + 2,
    borderWidth: 1,
    gap: spacing.xs,
  },
  outfitCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  outfitCardName: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs + 1,
  },
  outfitOccasion: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.xs - 1,
    marginTop: 1,
  },
  harmonyPill: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  harmonyText: {
    color: '#10B981',
    fontFamily: fonts.bodyBold,
    fontSize: 9,
  },
  garmentThumbsRow: {
    gap: 6,
    paddingVertical: 4,
  },
  thumbBox: {
    width: 60,
    height: 64,
    borderRadius: radii.md,
    borderWidth: 1,
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbImg: {
    width: '100%',
    height: 42,
  },
  thumbRole: {
    fontFamily: fonts.body,
    fontSize: 8.5,
    marginTop: 2,
  },
  outfitActions: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 2,
  },
  saveOutfitBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    borderRadius: radii.md,
  },
  saveOutfitBtnText: {
    color: '#FFF',
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs - 1,
  },
  tryOnBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  tryOnBtnText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.xs - 1,
  },
  quickPromptsWrapper: {
    paddingVertical: 6,
  },
  quickPromptsRow: {
    paddingHorizontal: spacing.md,
    gap: 6,
  },
  promptChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  promptChipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.xs,
  },
  inputBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    gap: spacing.sm,
  },
  micBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInput: {
    flex: 1,
    maxHeight: 80,
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
