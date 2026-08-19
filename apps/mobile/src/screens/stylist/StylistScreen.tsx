/**
 * apps/mobile/src/screens/stylist/StylistScreen.tsx
 *
 * AI Stylist — voice-input + streaming text response.
 * Ports the core loop of apps/web/src/pages/Stylist.jsx.
 *
 * Flow:
 *  1. User taps the mic button → expo-av records audio
 *  2. On stop: audio file is sent to /stylist as multipart/form-data
 *  3. Response is a JSON object with { reply, outfits? }
 *     (on native, NDJSON streaming becomes a single-shot fetch via streamNdjson.native.js)
 *  4. reply text is displayed; outfits (if any) shown as a horizontal card scroll
 *
 * Session management (create / switch sessions) is included at the core level.
 * 3D avatar / try-on is excluded (Phase 7).
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
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
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii } from '@mobile/theme/tokens';
import { api } from '@mobile/lib/api';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { StylistStackParamList } from '@mobile/navigation/types';

// ── Types ──────────────────────────────────────────────────────────────────
interface OutfitCard {
  id?: string;
  name?: string;
  image_url?: string;
  thumbnail_data_url?: string;
  items?: Array<{ id: string; name?: string; image_url?: string; thumbnail_data_url?: string }>;
}

interface HistoryMessage {
  role: 'user' | 'assistant';
  content: string;
  outfits?: OutfitCard[];
}

// ── Component ──────────────────────────────────────────────────────────────
export function StylistScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<StylistStackParamList, 'Stylist'>>();

  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<HistoryMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const scrollRef = useRef<ScrollView>(null);

  // ── Session init ──────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const session = await api.stylistCreateSession();
        setSessionId(session?.id ?? session?.session_id ?? null);
      } catch {
        /* non-fatal — will work without a session ID */
      }
    })();
  }, []);

  // ── Audio permissions ─────────────────────────────────────────────────────
  const ensureAudioPermission = async (): Promise<boolean> => {
    const { status } = await Audio.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        t('common.permissionRequired', 'Permission required'),
        t('stylist.micPermission', 'Please allow microphone access to use the AI Stylist.'),
      );
      return false;
    }
    return true;
  };

  // ── Start recording ───────────────────────────────────────────────────────
  const startRecording = async () => {
    if (!(await ensureAudioPermission())) return;
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      setRecording(rec);
      setIsRecording(true);
    } catch (err: unknown) {
      Alert.alert(t('common.error', 'Error'), (err as { message?: string })?.message ?? 'Could not start recording');
    }
  };

  // ── Stop recording & send ─────────────────────────────────────────────────
  const stopAndSend = useCallback(async () => {
    if (!recording) return;
    setIsRecording(false);
    setLoading(true);

    try {
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = recording.getURI();
      setRecording(null);

      if (!uri) throw new Error('No audio file recorded');

      // Build multipart FormData — same shape as the web app
      const formData = new FormData();
      formData.append('audio', {
        uri,
        type: 'audio/m4a',
        name: 'voice.m4a',
      } as unknown as Blob);
      if (sessionId) formData.append('session_id', sessionId);

      // Add user message optimistically
      setMessages((prev) => [...prev, { role: 'user', content: '🎙️ …' }]);

      // api.stylist() posts to /stylist as multipart
      const data = await api.stylist(formData);

      // The response: { reply: string, outfits?: [...], user_text?: string }
      const userText: string = data?.user_text ?? data?.transcription ?? '🎙️';
      const assistantText: string = data?.reply ?? data?.response ?? '';
      const outfits: OutfitCard[] = Array.isArray(data?.outfits) ? data.outfits : [];

      setMessages((prev) => {
        const updated = [...prev];
        // Replace last optimistic user message
        updated[updated.length - 1] = { role: 'user', content: userText };
        return [...updated, { role: 'assistant', content: assistantText, outfits }];
      });

      // Scroll to bottom
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } }; message?: string })
        ?.response?.data?.detail ?? (err as { message?: string })?.message ?? 'Stylist error';
      setMessages((prev) => [...prev, { role: 'assistant', content: `⚠️ ${msg}` }]);
    } finally {
      setLoading(false);
    }
  }, [recording, sessionId]);

  const s = makeStyles(colors);

  // ── Outfit card ───────────────────────────────────────────────────────────
  const renderOutfitCard = ({ item }: { item: OutfitCard }) => {
    const thumb = item.image_url ?? item.thumbnail_data_url
      ?? item.items?.[0]?.image_url ?? item.items?.[0]?.thumbnail_data_url;
    return (
      <View style={s.outfitCard}>
        {thumb ? (
          <Image source={{ uri: thumb }} style={s.outfitImage} resizeMode="cover" />
        ) : (
          <View style={[s.outfitImage, s.outfitImagePlaceholder]}>
            <Text style={{ fontSize: 32 }}>👗</Text>
          </View>
        )}
        {item.name ? <Text style={s.outfitName} numberOfLines={2}>{item.name}</Text> : null}
      </View>
    );
  };

  // ── Message bubble ────────────────────────────────────────────────────────
  const renderMessage = (msg: HistoryMessage, idx: number) => {
    const isUser = msg.role === 'user';
    return (
      <View key={idx} style={[s.msgRow, isUser ? s.msgRowUser : s.msgRowAssistant]}>
        <View style={[s.bubble, isUser ? s.bubbleUser : s.bubbleAssistant]}>
          <Text style={[s.bubbleText, isUser ? s.bubbleTextUser : s.bubbleTextAssistant]}>
            {msg.content}
          </Text>
        </View>
        {!isUser && msg.outfits && msg.outfits.length > 0 && (
          <FlatList
            data={msg.outfits}
            renderItem={renderOutfitCard}
            keyExtractor={(_, i) => String(i)}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.outfitRow}
            style={s.outfitList}
          />
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={s.root} edges={['bottom']}>
      {/* ── Header row with Outfits shortcut ── */}
      <View style={[s.topBar, { flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row' }]}>
        <Text style={s.topBarTitle}>{t('stylist.title', 'AI Stylist')}</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Outfits')} style={s.outfitsLink}>
          <Text style={s.outfitsLinkText}>👗 {t('stylist.savedOutfits', 'Saved outfits')}</Text>
        </TouchableOpacity>
      </View>
      {/* ── Messages ── */}
      <ScrollView
        ref={scrollRef}
        style={s.msgScroll}
        contentContainerStyle={s.msgContent}
        showsVerticalScrollIndicator={false}
      >
        {messages.length === 0 && (
          <View style={s.emptyState}>
            <Text style={s.emptyStateIcon}>✨</Text>
            <Text style={s.emptyStateTitle}>{t('stylist.greeting', 'Your AI Stylist')}</Text>
            <Text style={s.emptyStateSub}>
              {t('stylist.greetingSub', 'Tap the mic and ask me anything about your wardrobe.')}
            </Text>
          </View>
        )}
        {messages.map(renderMessage)}
        {loading && (
          <View style={s.msgRowAssistant}>
            <View style={s.bubbleAssistant}>
              <ActivityIndicator color={colors.accent} size="small" />
            </View>
          </View>
        )}
      </ScrollView>

      {/* ── Mic button ── */}
      <View style={s.controls}>
        <TouchableOpacity
          style={[s.micBtn, isRecording && s.micBtnActive]}
          onPress={isRecording ? stopAndSend : startRecording}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel={isRecording ? t('stylist.stopRecording', 'Stop recording') : t('stylist.startRecording', 'Start recording')}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={s.micIcon}>{isRecording ? '⏹' : '🎙'}</Text>
          )}
        </TouchableOpacity>
        <Text style={s.micHint}>
          {isRecording
            ? t('stylist.recording', 'Recording… tap to send')
            : loading
              ? t('stylist.thinking', 'Thinking…')
              : t('stylist.micHint', 'Tap to speak')}
        </Text>
      </View>
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
function makeStyles(colors: ReturnType<typeof import('@mobile/theme').useTheme>['colors']) {
  const isRtl = I18nManager.isRTL;
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    msgScroll: { flex: 1 },
    msgContent: { padding: spacing[4], gap: spacing[3], paddingBottom: spacing[8] },
    emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing[16], gap: spacing[3] },
    emptyStateIcon: { fontSize: 56 },
    emptyStateTitle: { fontFamily: fonts.display, fontSize: fontSizes.xl, color: colors.foreground },
    emptyStateSub: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.mutedFg, textAlign: 'center', paddingHorizontal: spacing[6] },
    msgRow: { maxWidth: '88%', gap: spacing[2] },
    msgRowUser: { alignSelf: isRtl ? 'flex-start' : 'flex-end' },
    msgRowAssistant: { alignSelf: isRtl ? 'flex-end' : 'flex-start' },
    bubble: { borderRadius: radii.lg, padding: spacing[3] },
    bubbleUser: { backgroundColor: colors.foreground },
    bubbleAssistant: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    bubbleText: { fontFamily: fonts.body, fontSize: fontSizes.base, lineHeight: 22 },
    bubbleTextUser: { color: colors.background },
    bubbleTextAssistant: { color: colors.foreground },
    outfitList: { marginTop: spacing[2] },
    outfitRow: { gap: spacing[3] },
    outfitCard: {
      width: 120,
      borderRadius: radii.lg,
      overflow: 'hidden',
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    outfitImage: { width: '100%', height: 120 },
    outfitImagePlaceholder: { backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
    outfitName: {
      fontFamily: fonts.body,
      fontSize: fontSizes.xs,
      color: colors.foreground,
      padding: spacing[2],
    },
    controls: {
      alignItems: 'center',
      paddingVertical: spacing[4],
      paddingHorizontal: spacing[5],
      borderTopWidth: 1,
      borderTopColor: colors.border,
      gap: spacing[2],
      backgroundColor: colors.background,
    },
    micBtn: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      ...Platform.select({
        ios: { shadowColor: colors.accent, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
        android: { elevation: 6 },
      }),
    },
    micBtnActive: { backgroundColor: colors.destructive },
    micIcon: { fontSize: 30 },
    micHint: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.mutedFg },
    // ── Header ──────────────────────────────────────────────────────────────
    topBar: {
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing[5],
      paddingTop: spacing[3],
      paddingBottom: spacing[2],
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    topBarTitle: { fontFamily: fonts.display, fontSize: fontSizes.xl, color: colors.foreground },
    outfitsLink: { paddingHorizontal: spacing[3], paddingVertical: spacing[1], backgroundColor: colors.muted, borderRadius: radii.xl },
    outfitsLinkText: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.xs, color: colors.foreground },
  });
}
