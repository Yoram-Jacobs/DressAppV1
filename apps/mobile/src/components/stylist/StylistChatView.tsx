/**
 * apps/mobile/src/components/stylist/StylistChatView.tsx
 *
 * Full-featured AI Stylist Conversational Chat Interface.
 * Features:
 *   - Scrollable message history with user and assistant message bubbles
 *   - Quick action shortcuts: Daily Suggestion, Plan Event Outfit, Trend-Scout, Ask a professional
 *   - Image picker with Take Photo (camera), Gallery (photo library), and Wardrobe (closet item)
 *   - Plan Event Outfit modal dialog with Event Name, Location, Date/Time, and Dress Code
 *   - Outfit recommendation cards with harmony badges, garment thumbnails, and save actions
 *   - Voice recording with audio mic
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
  KeyboardAvoidingView,
  Modal,
} from 'react-native';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import * as Lucide from 'lucide-react-native';

import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii } from '@mobile/theme/tokens';
import { api } from '@mobile/lib/api';
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
  shopping_suggestions?: string[];
  do_dont?: string[];
}

interface StylistChatViewProps {
  onSelectOutfitForTryOn?: (outfit: StylistOutfitCard) => void;
}

export function StylistChatView({ onSelectOutfitForTryOn }: StylistChatViewProps) {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<any>();
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
        defaultValue: "Hello! I'm your AI Fashion Stylist. Ask me what to wear, request looks for an occasion, or describe your outfit needs!",
      }),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  // Attached media state
  const [attachedImage, setAttachedImage] = useState<{ uri: string; name?: string } | null>(null);
  const [attachedClosetItem, setAttachedClosetItem] = useState<any | null>(null);

  // Modals state
  const [imagePickerModalOpen, setImagePickerModalOpen] = useState(false);
  const [closetPickerModalOpen, setClosetPickerModalOpen] = useState(false);
  const [closetSearch, setClosetSearch] = useState('');
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [eventForm, setEventForm] = useState({
    event_name: '',
    location: '',
    date: '',
    time: '',
    prompt: '',
  });

  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    setMessages((prev) => {
      if (prev.length === 1 && prev[0].id === 'msg_welcome') {
        return [
          {
            id: 'msg_welcome',
            role: 'assistant',
            content: t('stylist.welcomeMsg', {
              defaultValue:
                "Hello! I'm your AI Fashion Stylist. Ask me what to wear, request looks for an occasion, or describe your outfit needs!",
            }),
            timestamp: prev[0].timestamp,
          },
        ];
      }
      return prev;
    });
  }, [i18n.language, t]);

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
        name: o.name || t('stylist.curatedLook', { defaultValue: 'Curated Look' }),
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
            const mapped: ChatMessage[] = history.messages.map((m: any, idx: number) => {
              const rawTxt = m.transcript || m.content || m.text || '';
              const isFallbackError =
                rawTxt.toLowerCase().includes('trouble putting that recommendation together') ||
                rawTxt.toLowerCase().includes('rephrasing') ||
                rawTxt.includes('התקשיתי בהרכבת ההמלצה') ||
                rawTxt.includes('משكلة في إعداد التوصية');
              const content = isFallbackError
                ? t('stylist.errorAdvice', {
                    defaultValue:
                      "Sorry — I had trouble putting that recommendation together. Try rephrasing, or attach a photo so I can see what you're working with.",
                  })
                : rawTxt;

              return {
                id: m.id || `hist_${idx}`,
                role: m.role,
                content,
                outfits: hydrateOutfits(m.assistant_payload?.outfit_recommendations || m.outfits || []),
                shopping_suggestions: m.assistant_payload?.shopping_suggestions || [],
                do_dont: m.assistant_payload?.do_dont || [],
                timestamp: m.created_at
                  ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : undefined,
              };
            });
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

  // Image source actions
  const handleTakePhoto = async () => {
    setImagePickerModalOpen(false);
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          t('common.permissionRequired', { defaultValue: 'Permission required' }),
          t('addItem.cameraPermission', { defaultValue: 'Camera access is required.' })
        );
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsEditing: true,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        setAttachedImage({ uri: result.assets[0].uri, name: result.assets[0].fileName || 'camera_photo.jpg' });
        setAttachedClosetItem(null);
      }
    } catch (err: any) {
      Alert.alert(t('common.error', { defaultValue: 'Error' }), err?.message || 'Could not take photo.');
    }
  };

  const handlePickImageLibrary = async () => {
    setImagePickerModalOpen(false);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          t('common.permissionRequired', { defaultValue: 'Permission required' }),
          t('addItem.photosPermission', { defaultValue: 'Photo library access is required.' })
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsEditing: true,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        setAttachedImage({ uri: result.assets[0].uri, name: result.assets[0].fileName || 'gallery_photo.jpg' });
        setAttachedClosetItem(null);
      }
    } catch (err: any) {
      Alert.alert(t('common.error', { defaultValue: 'Error' }), err?.message || 'Could not pick image.');
    }
  };

  const handleSelectClosetItem = (item: any) => {
    setAttachedClosetItem(item);
    setAttachedImage(null);
    setClosetPickerModalOpen(false);
  };

  const handleClearAttachment = () => {
    setAttachedImage(null);
    setAttachedClosetItem(null);
  };

  // Shortcuts
  const handleTriggerDailySuggestion = async () => {
    if (loading) return;
    setLoading(true);
    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: `✨ ${t('stylist.dailySuggestion', { defaultValue: 'Daily Suggestion' })}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const res = await api.triggerScheduledProposal();
      const outfit = res?.outfit || res;
      const garments = outfit?.garments || outfit?.items || [];
      const outfitCard: StylistOutfitCard = {
        id: outfit?.id || `daily_${Date.now()}`,
        name: outfit?.name || t('stylist.todayProposal', { defaultValue: "Today's Outfit" }),
        occasion: outfit?.occasion || outfit?.target_occasion || 'Daily',
        harmony_score: outfit?.harmony_score || 95,
        reasoning: outfit?.reasoning || outfit?.description || '',
        garments,
        items: garments,
      };

      const assistantMsg: ChatMessage = {
        id: `msg_${Date.now() + 1}`,
        role: 'assistant',
        content:
          outfit?.description ||
          t('stylist.dailyProposalSuccess', {
            defaultValue: 'Here is your curated look for today based on your local weather and schedule:',
          }),
        outfits: hydrateOutfits([outfitCard]),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.warn('Daily proposal fallback to chat:', err);
      await handleSendText(t('stylist.dailyProposalPrompt', { defaultValue: 'Suggest an outfit for today based on current weather and schedule.' }));
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerEventProposal = async () => {
    if (!eventForm.prompt.trim() || loading) return;
    const { event_name, location, date, time, prompt } = eventForm;
    setEventModalOpen(false);
    setLoading(true);

    const eventName = event_name.trim() || t('stylist.occasion', { defaultValue: 'Special Event' });
    const locText = location.trim() ? ` at ${location.trim()}` : '';
    const dateText = date.trim() ? ` on ${date.trim()}` : '';
    const timeText = time.trim() ? ` at ${time.trim()}` : '';
    const userText = `Suggest event outfits for "${eventName}"${locText}${dateText}${timeText}. Details: "${prompt.trim()}".`;

    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, userMsg]);
    setEventForm({ event_name: '', location: '', date: '', time: '', prompt: '' });

    try {
      const res = await api.triggerEventProposal({
        event_name: event_name.trim() || null,
        location: location.trim() || null,
        date: date.trim() || null,
        time: time.trim() || null,
        prompt: prompt.trim(),
      });

      const outfit = res?.outfit || res;
      const rawRecs = res?.outfit_recommendations || (outfit ? [outfit] : []);
      const assistantMsg: ChatMessage = {
        id: `msg_${Date.now() + 1}`,
        role: 'assistant',
        content:
          res?.reasoning ||
          outfit?.reasoning ||
          t('stylist.eventProposalSuccess', { defaultValue: `Here is a curated look for ${eventName}:` }),
        outfits: hydrateOutfits(
          rawRecs.map((o: any, idx: number) => ({
            id: o.id || `event_outfit_${idx}`,
            name: o.name || eventName,
            occasion: eventName,
            harmony_score: o.harmony_score || 95,
            reasoning: o.reasoning || o.description || prompt,
            garments: o.garments || o.items || [],
            items: o.garments || o.items || [],
          }))
        ),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.warn('Event proposal fallback to chat:', err);
      await handleSendText(userText);
    } finally {
      setLoading(false);
    }
  };

  const handleTrendScoutShortcut = () => {
    try {
      navigation.navigate('MeTab', { screen: 'TrendScout' });
    } catch {
      navigation.navigate('TrendScout' as any);
    }
  };

  const handleAskProfessionalShortcut = () => {
    try {
      navigation.navigate('MeTab', { screen: 'ExpertsDirectory' });
    } catch {
      navigation.navigate('Experts' as any);
    }
  };

  const handleSendText = async (textToSend?: string) => {
    const rawText = (textToSend || inputQuery).trim();
    if (!rawText && !attachedImage && !attachedClosetItem) return;
    if (loading) return;

    let textWithAttachment = rawText || t('stylist.analyseAttached', { defaultValue: 'Please give me styling advice for this item.' });
    if (attachedClosetItem) {
      const itemName = attachedClosetItem.title || attachedClosetItem.name || 'garment';
      const itemCat = attachedClosetItem.category || '';
      const itemColor = attachedClosetItem.color || '';
      textWithAttachment = `[Regarding my closet item: "${itemName}" (${[itemCat, itemColor].filter(Boolean).join(', ')})]: ${textWithAttachment}`;
    }

    const currentAttachedImage = attachedImage;
    const currentAttachedClosetItem = attachedClosetItem;
    handleClearAttachment();

    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: rawText || (currentAttachedClosetItem ? `👗 ${currentAttachedClosetItem.title || currentAttachedClosetItem.name}` : `🖼️ ${t('stylist.photoAttached', { defaultValue: 'Photo attached' })}`),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('text', textWithAttachment);
      const userLang = (i18n.language || 'en').toLowerCase();
      formData.append('language', userLang);
      formData.append('skip_tts', 'true');
      formData.append('include_calendar', 'true');
      if (sessionId) formData.append('session_id', sessionId);

      if (currentAttachedImage) {
        const filename = currentAttachedImage.uri.split('/').pop() || 'photo.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';
        formData.append('image', {
          uri: currentAttachedImage.uri,
          name: filename,
          type,
        } as any);
      }

      const res = await api.stylist(formData);
      if (res?.session?.id) {
        setSessionId(res.session.id);
      }

      const advice = res?.advice || res;
      const outfitRecs = advice?.outfit_recommendations || res?.outfits || [];
      const rawResText = advice?.spoken_reply || advice?.reasoning_summary || res?.reply || res?.text || '';

      const isFallbackError =
        rawResText.toLowerCase().includes('trouble putting that recommendation together') ||
        rawResText.toLowerCase().includes('rephrasing') ||
        rawResText.includes('התקשיתי בהרכבת ההמלצה') ||
        rawResText.includes('مشكلة في إعداد التوصية');

      const content = isFallbackError
        ? t('stylist.errorAdvice', {
            defaultValue:
              "Sorry — I had trouble putting that recommendation together. Try rephrasing, or attach a photo so I can see what you're working with.",
          })
        : rawResText || t('stylist.curatedLookHeader', { defaultValue: 'Here is a curated outfit combination from your wardrobe:' });

      const assistantMsg: ChatMessage = {
        id: `msg_${Date.now() + 1}`,
        role: 'assistant',
        content,
        outfits: hydrateOutfits(outfitRecs),
        shopping_suggestions: advice?.shopping_suggestions || [],
        do_dont: advice?.do_dont || [],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.warn('Stylist chat error:', err);
      const status = err?.response?.status;
      const dataDetail = err?.response?.data?.detail;
      const errMsg = err?.message || String(err);
      const errorText = dataDetail
        ? `${status ? `[${status}] ` : ''}${typeof dataDetail === 'string' ? dataDetail : JSON.stringify(dataDetail)}`
        : `${status ? `[${status}] ` : ''}${errMsg}`;

      const fallbackMsg: ChatMessage = {
        id: `msg_${Date.now() + 1}`,
        role: 'assistant',
        content: `${t('common.error', { defaultValue: 'Error' })}: ${errorText}`,
        outfits: [],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, fallbackMsg]);

      if (typeof dataDetail === 'string' && (dataDetail.includes('API key') || dataDetail.includes('API_KEY'))) {
        Alert.alert(
          t('profile.apiKeyRequiredTitle', { defaultValue: 'API Key Required' }),
          t('profile.apiKeyRequiredMessage', {
            defaultValue: 'Please enter a valid Google Gemini API key in your Profile -> AI Configuration to use the AI Stylist.',
          })
        );
      }
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
      const userLang = (i18n.language || 'en').toLowerCase();
      formData.append('language', userLang);
      formData.append('skip_tts', 'true');
      formData.append('include_calendar', 'true');
      if (sessionId) formData.append('session_id', sessionId);

      setMessages((prev) => [
        ...prev,
        {
          id: `msg_${Date.now()}`,
          role: 'user',
          content: `🎙️ ${t('stylist.voiceNote', { defaultValue: 'Voice note' })}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);

      const res = await api.stylist(formData);
      if (res?.session?.id) {
        setSessionId(res.session.id);
      }

      const advice = res?.advice || res;
      const outfitRecs = advice?.outfit_recommendations || res?.outfits || [];
      const rawText = advice?.spoken_reply || advice?.reasoning_summary || res?.reply || res?.text || '';

      const isFallbackError =
        rawText.toLowerCase().includes('trouble putting that recommendation together') ||
        rawText.toLowerCase().includes('rephrasing') ||
        rawText.includes('התקשיתי בהרכבת ההמלצה') ||
        rawText.includes('مشكلة في إعداد التوصية');

      const content = isFallbackError
        ? t('stylist.errorAdvice', {
            defaultValue:
              "Sorry — I had trouble putting that recommendation together. Try rephrasing, or attach a photo so I can see what you're working with.",
          })
        : rawText || t('stylist.curatedLookHeader', { defaultValue: 'Here is your requested styling recommendation:' });

      setMessages((prev) => [
        ...prev,
        {
          id: `msg_${Date.now() + 1}`,
          role: 'assistant',
          content,
          outfits: hydrateOutfits(outfitRecs),
          shopping_suggestions: advice?.shopping_suggestions || [],
          do_dont: advice?.do_dont || [],
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
      Alert.alert(t('common.error', { defaultValue: 'Error' }), err?.response?.data?.detail || t('stylist.saveFailed', { defaultValue: 'Could not save outfit.' }));
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ScrollView
        ref={scrollRef}
        style={styles.messagesScroll}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <View
              key={msg.id}
              style={[
                styles.messageRow,
                isUser ? styles.userMessageRow : styles.assistantMessageRow,
                isRtl ? { flexDirection: isUser ? 'row' : 'row-reverse' } : { flexDirection: isUser ? 'row-reverse' : 'row' },
              ]}
            >
              {!isUser && (
                <View style={[styles.avatarIconWrap, { backgroundColor: colors.primary }]}>
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
                    { color: isUser ? '#FFF' : colors.foreground, textAlign: isRtl ? 'right' : 'left' },
                  ]}
                >
                  {msg.content}
                </Text>

                {msg.timestamp && (
                  <Text
                    style={[
                      styles.timestampText,
                      { color: isUser ? 'rgba(255,255,255,0.7)' : colors.mutedFg, textAlign: isRtl ? 'left' : 'right' },
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
                          <View style={[styles.outfitCardHeader, isRtl ? { flexDirection: 'row-reverse' } : { flexDirection: 'row' }]}>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.outfitCardName, { color: colors.foreground, textAlign: isRtl ? 'right' : 'left' }]}>
                                {outfit.name || 'Curated Look'}
                              </Text>
                              {outfit.occasion ? (
                                <Text style={[styles.outfitOccasion, { color: colors.accent, textAlign: isRtl ? 'right' : 'left' }]}>
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

                          {outfit.reasoning ? (
                            <Text style={[styles.outfitReasoning, { color: colors.mutedFg, textAlign: isRtl ? 'right' : 'left' }]}>
                              {outfit.reasoning}
                            </Text>
                          ) : null}

                          {/* Garment Thumbnails Row */}
                          {garments.length > 0 && (
                            <ScrollView
                              horizontal
                              showsHorizontalScrollIndicator={false}
                              contentContainerStyle={[styles.garmentThumbsRow, isRtl ? { flexDirection: 'row-reverse' } : { flexDirection: 'row' }]}
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
                          <View style={[styles.outfitActions, isRtl ? { flexDirection: 'row-reverse' } : { flexDirection: 'row' }]}>
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

                {/* Shopping Suggestions if present */}
                {msg.shopping_suggestions && msg.shopping_suggestions.length > 0 && (
                  <View style={[styles.shoppingBox, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                    <View style={[styles.sectionHeaderRow, isRtl ? { flexDirection: 'row-reverse' } : { flexDirection: 'row' }]}>
                      <Lucide.ShoppingBag size={14} color={colors.primary} />
                      <Text style={[styles.sectionHeading, { color: colors.foreground }]}>
                        {t('stylist.shoppingSuggestions', { defaultValue: 'Shopping Suggestions' })}
                      </Text>
                    </View>
                    {msg.shopping_suggestions.map((item, sIdx) => (
                      <Text key={sIdx} style={[styles.suggestionItemText, { color: colors.mutedFg, textAlign: isRtl ? 'right' : 'left' }]}>
                        • {item}
                      </Text>
                    ))}
                  </View>
                )}

                {/* Do & Don't if present */}
                {msg.do_dont && msg.do_dont.length > 0 && (
                  <View style={[styles.doDontBox, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                    <View style={[styles.sectionHeaderRow, isRtl ? { flexDirection: 'row-reverse' } : { flexDirection: 'row' }]}>
                      <Lucide.Sparkles size={14} color={colors.accent} />
                      <Text style={[styles.sectionHeading, { color: colors.foreground }]}>
                        {t('stylist.doDont', { defaultValue: 'Styling Tips' })}
                      </Text>
                    </View>
                    {msg.do_dont.map((tip, dIdx) => (
                      <Text key={dIdx} style={[styles.suggestionItemText, { color: colors.mutedFg, textAlign: isRtl ? 'right' : 'left' }]}>
                        • {tip}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
            </View>
          );
        })}

        {loading && (
          <View style={[styles.typingRow, isRtl ? { flexDirection: 'row-reverse' } : { flexDirection: 'row' }]}>
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

        {/* Action Shortcuts Pill Row */}
        <View style={styles.shortcutsRowContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.shortcutsRow, isRtl ? { flexDirection: 'row-reverse' } : { flexDirection: 'row' }]}
          >
            <TouchableOpacity
              style={[styles.shortcutBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={handleTriggerDailySuggestion}
              disabled={loading}
            >
              <Lucide.Sparkles size={13} color={colors.accent} />
              <Text style={[styles.shortcutBtnText, { color: colors.foreground }]}>
                {t('stylist.dailySuggestion', { defaultValue: 'Daily Suggestion' })}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.shortcutBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => setEventModalOpen(true)}
              disabled={loading}
            >
              <Lucide.Calendar size={13} color={colors.accent} />
              <Text style={[styles.shortcutBtnText, { color: colors.foreground }]}>
                {t('stylist.planEventOutfit', { defaultValue: 'Plan Event Outfit' })}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.shortcutBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={handleTrendScoutShortcut}
            >
              <Lucide.TrendingUp size={13} color={colors.accent} />
              <Text style={[styles.shortcutBtnText, { color: colors.foreground }]}>
                {t('home.trendScout', { defaultValue: 'Trend-Scout' })}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.shortcutBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={handleAskProfessionalShortcut}
            >
              <Lucide.UserCheck size={13} color={colors.accent} />
              <Text style={[styles.shortcutBtnText, { color: colors.foreground }]}>
                {t('experts.askProfessional', { defaultValue: 'Ask a professional' })}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* User's Input Box rendered directly below the Stylist welcome greeting / conversation */}
        <View style={[styles.inlineInputCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Attached Preview Chip */}
          {(attachedImage || attachedClosetItem) && (
            <View style={[styles.attachedPreviewBar, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <Image
                source={{
                  uri:
                    attachedImage?.uri ||
                    attachedClosetItem?.clean_image_url ||
                    attachedClosetItem?.image_url ||
                    attachedClosetItem?.thumbnail_data_url,
                }}
                style={styles.attachedThumbnail}
                resizeMode="cover"
              />
              <View style={{ flex: 1, marginHorizontal: 8 }}>
                <Text style={[styles.attachedLabel, { color: colors.foreground }]} numberOfLines={1}>
                  {attachedClosetItem
                    ? attachedClosetItem.title || attachedClosetItem.name || 'Closet Item'
                    : attachedImage?.name || 'Attached Photo'}
                </Text>
                <Text style={[styles.attachedSub, { color: colors.mutedFg }]}>
                  {attachedClosetItem
                    ? t('stylist.fromCloset', { defaultValue: 'From your closet' })
                    : t('stylist.photoAttached', { defaultValue: 'Photo for stylist analysis' })}
                </Text>
              </View>
              <TouchableOpacity onPress={handleClearAttachment} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Lucide.X size={16} color={colors.mutedFg} />
              </TouchableOpacity>
            </View>
          )}

          <View style={[styles.inputBarRow, isRtl ? { flexDirection: 'row-reverse' } : { flexDirection: 'row' }]}>
            {/* Image Picker Trigger Button */}
            <TouchableOpacity
              style={[styles.imagePickerBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
              onPress={() => setImagePickerModalOpen(true)}
              accessibilityLabel="Attach photo or closet item"
            >
              <Lucide.Image size={20} color={colors.accent} />
            </TouchableOpacity>

            <TextInput
              style={[
                styles.inlineTextInput,
                {
                  backgroundColor: colors.secondary,
                  color: colors.foreground,
                  borderColor: colors.border,
                  textAlign: isRtl ? 'right' : 'left',
                },
              ]}
              value={inputQuery}
              onChangeText={setInputQuery}
              placeholder={
                isRecording
                  ? t('stylist.listening', { defaultValue: 'Listening...' })
                  : t('stylist.composerPlaceholder', { defaultValue: 'Ask what to wear...' })
              }
              placeholderTextColor={colors.mutedFg}
              multiline
              maxLength={500}
            />

            <TouchableOpacity
              style={[
                styles.micBtn,
                isRecording && { backgroundColor: '#EF4444' },
                { backgroundColor: isRecording ? '#EF4444' : colors.secondary, borderColor: colors.border, borderWidth: 1 },
              ]}
              onPress={isRecording ? stopRecording : startRecording}
            >
              <Lucide.Mic size={18} color={isRecording ? '#FFF' : colors.foreground} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.inlineSendBtn,
                { backgroundColor: inputQuery.trim() || attachedImage || attachedClosetItem ? colors.primary : colors.secondary },
              ]}
              onPress={() => handleSendText()}
              disabled={(!inputQuery.trim() && !attachedImage && !attachedClosetItem) || loading}
            >
              <Lucide.Send
                size={16}
                color={inputQuery.trim() || attachedImage || attachedClosetItem ? '#FFF' : colors.mutedFg}
              />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Plan Event Outfit Modal */}
      <Modal visible={eventModalOpen} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.modalHeader, isRtl ? { flexDirection: 'row-reverse' } : { flexDirection: 'row' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Lucide.Calendar size={20} color={colors.accent} />
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                  {t('stylist.planEventOutfitTitle', { defaultValue: 'Plan Event Outfit' })}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setEventModalOpen(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Lucide.X size={20} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingVertical: 8 }}>
              <View>
                <Text style={[styles.fieldLabel, { color: colors.foreground, textAlign: isRtl ? 'right' : 'left' }]}>
                  {t('stylist.eventName', { defaultValue: 'Event Name' })}
                </Text>
                <TextInput
                  style={[
                    styles.modalInput,
                    { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border, textAlign: isRtl ? 'right' : 'left' },
                  ]}
                  placeholder={t('stylist.eventNamePlaceholder', { defaultValue: 'e.g. Birthday Party, Dinner, Wedding' })}
                  placeholderTextColor={colors.mutedFg}
                  value={eventForm.event_name}
                  onChangeText={(val) => setEventForm((prev) => ({ ...prev, event_name: val }))}
                />
              </View>

              <View>
                <Text style={[styles.fieldLabel, { color: colors.foreground, textAlign: isRtl ? 'right' : 'left' }]}>
                  {t('stylist.location', { defaultValue: 'Location' })}
                </Text>
                <TextInput
                  style={[
                    styles.modalInput,
                    { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border, textAlign: isRtl ? 'right' : 'left' },
                  ]}
                  placeholder={t('stylist.locationPlaceholder', { defaultValue: 'e.g. Rooftop Restaurant, Beach' })}
                  placeholderTextColor={colors.mutedFg}
                  value={eventForm.location}
                  onChangeText={(val) => setEventForm((prev) => ({ ...prev, location: val }))}
                />
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: colors.foreground, textAlign: isRtl ? 'right' : 'left' }]}>
                    {t('common.date', { defaultValue: 'Date' })}
                  </Text>
                  <TextInput
                    style={[
                      styles.modalInput,
                      { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border, textAlign: isRtl ? 'right' : 'left' },
                    ]}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.mutedFg}
                    value={eventForm.date}
                    onChangeText={(val) => setEventForm((prev) => ({ ...prev, date: val }))}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: colors.foreground, textAlign: isRtl ? 'right' : 'left' }]}>
                    {t('common.time', { defaultValue: 'Time' })}
                  </Text>
                  <TextInput
                    style={[
                      styles.modalInput,
                      { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border, textAlign: isRtl ? 'right' : 'left' },
                    ]}
                    placeholder="HH:MM"
                    placeholderTextColor={colors.mutedFg}
                    value={eventForm.time}
                    onChangeText={(val) => setEventForm((prev) => ({ ...prev, time: val }))}
                  />
                </View>
              </View>

              <View>
                <Text style={[styles.fieldLabel, { color: colors.foreground, textAlign: isRtl ? 'right' : 'left' }]}>
                  {t('stylist.dressCodeDemands', { defaultValue: 'Dress Code / Demands' })} *
                </Text>
                <TextInput
                  style={[
                    styles.modalTextArea,
                    { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border, textAlign: isRtl ? 'right' : 'left' },
                  ]}
                  placeholder={t('stylist.promptPlaceholder', {
                    defaultValue: 'Describe what you need e.g. informal outdoor setting, casual chic, warm',
                  })}
                  placeholderTextColor={colors.mutedFg}
                  multiline
                  numberOfLines={3}
                  value={eventForm.prompt}
                  onChangeText={(val) => setEventForm((prev) => ({ ...prev, prompt: val }))}
                />
              </View>

              <View style={[styles.modalActionRow, isRtl ? { flexDirection: 'row-reverse' } : { flexDirection: 'row' }]}>
                <TouchableOpacity
                  style={[styles.modalCancelBtn, { borderColor: colors.border }]}
                  onPress={() => setEventModalOpen(false)}
                >
                  <Text style={[styles.modalCancelText, { color: colors.foreground }]}>
                    {t('common.cancel', { defaultValue: 'Cancel' })}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.modalSubmitBtn,
                    { backgroundColor: eventForm.prompt.trim() ? colors.primary : colors.secondary },
                  ]}
                  onPress={handleTriggerEventProposal}
                  disabled={!eventForm.prompt.trim() || loading}
                >
                  <Text
                    style={[
                      styles.modalSubmitText,
                      { color: eventForm.prompt.trim() ? '#FFF' : colors.mutedFg },
                    ]}
                  >
                    {t('stylist.getSuggestions', { defaultValue: 'Get Suggestions' })}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Image Source Options Modal */}
      <Modal visible={imagePickerModalOpen} animationType="fade" transparent>
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setImagePickerModalOpen(false)}
        >
          <View style={[styles.pickerOptionsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.pickerTitle, { color: colors.foreground }]}>
              {t('stylist.attachImageTitle', { defaultValue: 'Attach Image for Stylist' })}
            </Text>

            <TouchableOpacity style={styles.pickerOptionRow} onPress={handleTakePhoto}>
              <View style={[styles.pickerIconWrap, { backgroundColor: colors.secondary }]}>
                <Lucide.Camera size={20} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.pickerOptionLabel, { color: colors.foreground }]}>
                  {t('addItem.takePhoto', { defaultValue: 'Take Photo' })}
                </Text>
                <Text style={[styles.pickerOptionSub, { color: colors.mutedFg }]}>
                  {t('stylist.takePhotoSub', { defaultValue: 'Snap garment or fit with camera' })}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.pickerOptionRow} onPress={handlePickImageLibrary}>
              <View style={[styles.pickerIconWrap, { backgroundColor: colors.secondary }]}>
                <Lucide.Image size={20} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.pickerOptionLabel, { color: colors.foreground }]}>
                  {t('addItem.chooseFromLibrary', { defaultValue: 'Pick from Photos' })}
                </Text>
                <Text style={[styles.pickerOptionSub, { color: colors.mutedFg }]}>
                  {t('stylist.chooseFromLibrarySub', { defaultValue: 'Select from device gallery' })}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.pickerOptionRow}
              onPress={() => {
                setImagePickerModalOpen(false);
                setClosetPickerModalOpen(true);
              }}
            >
              <View style={[styles.pickerIconWrap, { backgroundColor: colors.secondary }]}>
                <Lucide.Shirt size={20} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.pickerOptionLabel, { color: colors.foreground }]}>
                  {t('stylist.pickFromCloset', { defaultValue: 'Pick from Closet' })}
                </Text>
                <Text style={[styles.pickerOptionSub, { color: colors.mutedFg }]}>
                  {t('stylist.pickFromClosetSub', { defaultValue: 'Choose an item from your wardrobe' })}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Closet Item Picker Modal */}
      <Modal visible={closetPickerModalOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={[styles.closetPickerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.modalHeader, isRtl ? { flexDirection: 'row-reverse' } : { flexDirection: 'row' }]}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                {t('stylist.selectClosetItem', { defaultValue: 'Select Wardrobe Item' })}
              </Text>
              <TouchableOpacity onPress={() => setClosetPickerModalOpen(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Lucide.X size={20} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            {/* Search Filter */}
            <View style={[styles.searchBar, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <Lucide.Search size={16} color={colors.mutedFg} />
              <TextInput
                style={[styles.searchInput, { color: colors.foreground, textAlign: isRtl ? 'right' : 'left' }]}
                placeholder={t('closet.searchPlaceholder', { defaultValue: 'Search items...' })}
                placeholderTextColor={colors.mutedFg}
                value={closetSearch}
                onChangeText={setClosetSearch}
              />
            </View>

            {/* Grid */}
            <ScrollView contentContainerStyle={styles.closetGrid} showsVerticalScrollIndicator={false}>
              {closetItems
                .filter(
                  (item: any) =>
                    !closetSearch ||
                    (item.title || item.name || '').toLowerCase().includes(closetSearch.toLowerCase()) ||
                    (item.category || '').toLowerCase().includes(closetSearch.toLowerCase())
                )
                .map((item: any) => {
                  const img = item.clean_image_url || item.image_url || item.thumbnail_data_url;
                  return (
                    <TouchableOpacity
                      key={item.id || item._id}
                      style={[styles.closetItemCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}
                      onPress={() => handleSelectClosetItem(item)}
                    >
                      {img ? (
                        <Image source={{ uri: img }} style={styles.closetItemThumb} resizeMode="contain" />
                      ) : (
                        <View style={styles.closetItemThumbEmpty}>
                          <Lucide.Shirt size={24} color={colors.mutedFg} />
                        </View>
                      )}
                      <Text style={[styles.closetItemTitle, { color: colors.foreground }]} numberOfLines={1}>
                        {item.title || item.name || 'Item'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  messagesScroll: {
    padding: spacing.md,
    gap: spacing.md,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginVertical: 4,
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
    maxWidth: '84%',
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
    fontSize: fontSizes.xs - 2,
    marginTop: 2,
  },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 6,
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  typingText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.xs,
  },
  outfitsContainer: {
    marginTop: 8,
    gap: 8,
  },
  outfitCard: {
    borderRadius: radii.lg,
    padding: spacing.sm + 2,
    borderWidth: 1,
    gap: 6,
  },
  outfitCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 6,
  },
  outfitCardName: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.sm,
  },
  outfitOccasion: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.xs - 1,
  },
  harmonyPill: {
    backgroundColor: '#2F7972',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  harmonyText: {
    color: '#FFF',
    fontFamily: fonts.bodyBold,
    fontSize: 9,
  },
  outfitReasoning: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    lineHeight: 16,
  },
  shoppingBox: {
    marginTop: 6,
    padding: 8,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: 4,
  },
  doDontBox: {
    marginTop: 6,
    padding: 8,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: 4,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  sectionHeading: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
  },
  suggestionItemText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs - 1,
    lineHeight: 16,
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

  // Action Shortcuts Row
  shortcutsRowContainer: {
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  shortcutsRow: {
    gap: 8,
    paddingHorizontal: 2,
  },
  shortcutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  shortcutBtnText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.xs,
  },

  // Inline Input Box
  inlineInputCard: {
    borderRadius: radii.xl,
    padding: spacing.sm + 4,
    borderWidth: 1,
    marginTop: spacing.sm,
    marginBottom: spacing['2xl'],
    gap: spacing.xs + 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  attachedPreviewBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 6,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: 4,
  },
  attachedThumbnail: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
  },
  attachedLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
  },
  attachedSub: {
    fontFamily: fonts.body,
    fontSize: 10,
  },
  inputBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  imagePickerBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineTextInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderWidth: 1,
    fontSize: fontSizes.sm,
    fontFamily: fonts.body,
  },
  micBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineSendBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Modals
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: radii['2xl'],
    borderWidth: 1,
    padding: spacing.lg,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontFamily: fonts.displayBold || fonts.bodyBold,
    fontSize: fontSizes.md + 1,
  },
  fieldLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.xs,
    marginBottom: 4,
  },
  modalInput: {
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
  },
  modalTextArea: {
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    minHeight: 70,
  },
  modalActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  modalCancelText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
  },
  modalSubmitBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: radii.md,
  },
  modalSubmitText: {
    color: '#FFF',
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.sm,
  },

  // Image Picker Options Modal
  pickerOptionsCard: {
    width: '90%',
    maxWidth: 360,
    borderRadius: radii['2xl'],
    borderWidth: 1,
    padding: spacing.lg,
    gap: 12,
  },
  pickerTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.md,
    marginBottom: 6,
    textAlign: 'center',
  },
  pickerOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  pickerIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerOptionLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.sm,
  },
  pickerOptionSub: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs - 1,
    marginTop: 1,
  },

  // Closet Picker Modal
  closetPickerCard: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '80%',
    borderRadius: radii['2xl'],
    borderWidth: 1,
    padding: spacing.lg,
    gap: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    paddingVertical: 2,
  },
  closetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingVertical: 8,
    justifyContent: 'space-between',
  },
  closetItemCard: {
    width: '30%',
    aspectRatio: 0.85,
    borderRadius: radii.md,
    borderWidth: 1,
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closetItemThumb: {
    width: '100%',
    height: '70%',
  },
  closetItemThumbEmpty: {
    width: '100%',
    height: '70%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closetItemTitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: 9.5,
    marginTop: 4,
    textAlign: 'center',
  },
});
