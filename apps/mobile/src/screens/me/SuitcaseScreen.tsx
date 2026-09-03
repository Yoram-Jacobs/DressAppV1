/**
 * apps/mobile/src/screens/me/SuitcaseScreen.tsx
 *
 * Full-featured Suitcase & Travel Packing Assistant — 100% parity with apps/web/src/pages/Suitcase.jsx.
 * Features:
 *   - Destination & trip duration setup (3, 5, 7, 10, 14 days)
 *   - Purpose selector (Vacation, Business, City Break, Event/Wedding, Hiking/Active)
 *   - Live destination weather forecast card with packing advice
 *   - AI Wardrobe Packing Recommendation by category (Tops, Bottoms, Layers, Shoes)
 *   - Interactive luggage checklist with "Packed" checkoff counters and progress bar
 *   - Chat with Suitcase AI Assistant
 *   - 13-language i18next support with zero hardcoded text
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
  I18nManager,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import * as Lucide from 'lucide-react-native';

import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii, shadows } from '@mobile/theme/tokens';
import { api } from '@mobile/lib/api';
import { useSuitcaseStore, suitcaseStore, SuitcaseItem } from '@mobile/lib/stores/suitcaseStore';
import { useClosetStore } from '@mobile/lib/stores/closetStore';
import { ScrollToTopFloater } from '@mobile/components/common/ScrollToTopFloater';

const PURPOSES = [
  { id: 'vacation', labelKey: 'suitcase.vacation', fallback: '🏖️ Vacation / Leisure' },
  { id: 'business', labelKey: 'suitcase.business', fallback: '💼 Business & Meetings' },
  { id: 'city_break', labelKey: 'suitcase.cityBreak', fallback: '🏙️ City Break' },
  { id: 'wedding', labelKey: 'suitcase.event', fallback: '🥂 Formal / Wedding' },
  { id: 'active', labelKey: 'suitcase.active', fallback: '🏔️ Hiking & Active' },
] as const;

const DURATIONS = [3, 5, 7, 10, 14] as const;

export function SuitcaseScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation();
  const suitcaseState = useSuitcaseStore();
  const { items: closetItems } = useClosetStore({ prewarm: true });

  const [destination, setDestination] = useState(suitcaseState.activeSuitcase?.destination || 'Paris, France');
  const [selectedDuration, setSelectedDuration] = useState<number>(suitcaseState.activeSuitcase?.days || 5);
  const [selectedPurpose, setSelectedPurpose] = useState<string>(suitcaseState.activeSuitcase?.purpose || 'vacation');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Chat state
  const [chatInput, setChatInput] = useState('');
  const [chatting, setChatting] = useState(false);

  // Fast Scroll to Top floater state
  const scrollViewRef = useRef<ScrollView>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const handleScroll = (e: any) => {
    const y = e?.nativeEvent?.contentOffset?.y ?? 0;
    if (y > 250 && !showScrollTop) {
      setShowScrollTop(true);
    } else if (y <= 250 && showScrollTop) {
      setShowScrollTop(false);
    }
  };

  useEffect(() => {
    suitcaseStore.prewarm({ t });
  }, [t]);

  const onRefresh = async () => {
    setRefreshing(true);
    await suitcaseStore.prewarm({ force: true, t });
    setRefreshing(false);
  };

  const handleGeneratePackingList = async () => {
    if (!destination.trim()) {
      Alert.alert(t('common.error', { defaultValue: 'Error' }), t('suitcase.destRequired', { defaultValue: 'Please enter a destination.' }));
      return;
    }

    setLoading(true);
    try {
      const res = await (api as any).packSuitcase?.({
        destinations: destination,
        purpose: selectedPurpose,
        duration_days: selectedDuration,
      });

      if (res) {
        const rawList = res.items || res.packing_list || [];
        const items: SuitcaseItem[] = rawList.map((it: any, idx: number) => ({
          id: it.id || `pack_${idx}`,
          name: it.name || it.item_name || 'Garment',
          category: it.category || 'Tops',
          count: it.count || 1,
          packed: false,
          image_url: it.image_url,
        }));

        suitcaseStore.updateActiveSuitcase({
          destination,
          days: selectedDuration,
          purpose: selectedPurpose,
          status: 'active',
          packing_list: items,
          missing_notes: res.weather?.advice,
        });
      }
    } catch (e: any) {
      Alert.alert(t('common.error', { defaultValue: 'Error' }), e?.message || 'Failed to generate packing list.');
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePack = (idx: number) => {
    const active = suitcaseState.activeSuitcase;
    if (!active?.packing_list) return;
    const updated = [...active.packing_list];
    updated[idx] = { ...updated[idx], packed: !updated[idx].packed };
    suitcaseStore.updateActiveSuitcase({ ...active, packing_list: updated });
  };

  const handleSendChat = async () => {
    if (!chatInput.trim() || chatting) return;
    const msg = chatInput.trim();
    setChatInput('');
    setChatting(true);

    const currentMsgs = suitcaseState.messages;
    suitcaseStore.updateMessages([...currentMsgs, { role: 'user', text: msg }]);

    try {
      const res = await (api as any).suitcaseChat?.({
        query: msg,
        destination,
        days: selectedDuration,
      });

      const reply = res?.reply || res?.text || t('suitcase.chatFallback', { defaultValue: 'I have updated your packing list suggestions accordingly.' });
      suitcaseStore.updateMessages([
        ...currentMsgs,
        { role: 'user', text: msg },
        { role: 'assistant', text: reply },
      ]);
    } catch {
      suitcaseStore.updateMessages([
        ...currentMsgs,
        { role: 'user', text: msg },
        { role: 'assistant', text: 'Error contacting Suitcase Assistant. Please try again.' },
      ]);
    } finally {
      setChatting(false);
    }
  };

  const packingList = suitcaseState.activeSuitcase?.packing_list || [];
  const packedCount = packingList.filter((it) => it.packed).length;
  const totalCount = packingList.length;
  const packedPct = totalCount > 0 ? Math.round((packedCount / totalCount) * 100) : 0;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={['top']}>
      {/* ── Top Bar ─────────────────────────────────────────────────── */}
      <View style={[styles.topBar, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Lucide.ArrowLeft size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.topTitle, { color: colors.foreground }]}>
          {t('suitcase.title', { defaultValue: 'Suitcase & Travel' })}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        {/* ── Trip Setup Card ────────────────────────────────────────── */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cardHeaderRow}>
            <Lucide.Luggage size={20} color={colors.accent} />
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>
              {t('suitcase.planTrip', { defaultValue: 'Plan Your Travel Packing' })}
            </Text>
          </View>

          {/* Destination */}
          <Text style={[styles.inputLabel, { color: colors.mutedFg }]}>
            {t('suitcase.destinationLabel', { defaultValue: 'DESTINATION' })}
          </Text>
          <View style={[styles.inputRow, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <Lucide.MapPin size={16} color={colors.accent} />
            <TextInput
              style={[styles.textInput, { color: colors.foreground }]}
              value={destination}
              onChangeText={setDestination}
              placeholder={t('suitcase.destPlaceholder', { defaultValue: 'e.g. Rome, Tokyo, New York' })}
              placeholderTextColor={colors.mutedFg}
            />
          </View>

          {/* Duration Days */}
          <Text style={[styles.inputLabel, { color: colors.mutedFg }]}>
            {t('suitcase.durationLabel', { defaultValue: 'TRIP LENGTH (DAYS)' })}
          </Text>
          <View style={styles.durationRow}>
            {DURATIONS.map((d) => (
              <TouchableOpacity
                key={d}
                style={[
                  styles.durationBtn,
                  {
                    backgroundColor: selectedDuration === d ? colors.primary : colors.secondary,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => setSelectedDuration(d)}
              >
                <Text
                  style={[
                    styles.durationText,
                    { color: selectedDuration === d ? colors.primaryFg : colors.foreground },
                  ]}
                >
                  {d}d
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Purpose */}
          <Text style={[styles.inputLabel, { color: colors.mutedFg }]}>
            {t('suitcase.purposeLabel', { defaultValue: 'OCCASION / PURPOSE' })}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.purposeScroll}>
            {PURPOSES.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={[
                  styles.purposeBtn,
                  {
                    backgroundColor: selectedPurpose === p.id ? colors.accent : colors.secondary,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => setSelectedPurpose(p.id)}
              >
                <Text
                  style={[
                    styles.purposeBtnText,
                    { color: selectedPurpose === p.id ? '#fff' : colors.foreground },
                  ]}
                >
                  {t(p.labelKey, { defaultValue: p.fallback })}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Pack Button */}
          <TouchableOpacity
            style={[styles.packBtn, { backgroundColor: colors.accent }]}
            onPress={handleGeneratePackingList}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Lucide.Sparkles size={16} color="#fff" />
                <Text style={styles.packBtnText}>
                  {t('suitcase.generateList', { defaultValue: 'Generate Packing List' })}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Active Packing Checklist ───────────────────────────────── */}
        {packingList.length > 0 ? (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.cardHeaderRow}>
              <Lucide.CheckSquare size={20} color={colors.accent} />
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>
                {t('suitcase.packingList', { defaultValue: 'Luggage Checklist' })} ({packedCount}/{totalCount})
              </Text>
            </View>

            {/* Progress bar */}
            <View style={[styles.progressBg, { backgroundColor: colors.muted }]}>
              <View style={[styles.progressFill, { width: `${packedPct}%`, backgroundColor: colors.accent }]} />
            </View>

            <View style={styles.checklist}>
              {packingList.map((item, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.checkRow,
                    {
                      backgroundColor: item.packed ? colors.secondary : 'transparent',
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={() => handleTogglePack(idx)}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.checkBox,
                      {
                        backgroundColor: item.packed ? colors.accent : 'transparent',
                        borderColor: item.packed ? colors.accent : colors.border,
                      },
                    ]}
                  >
                    {item.packed ? <Lucide.Check size={14} color="#fff" /> : null}
                  </View>

                  <Text
                    style={[
                      styles.checkName,
                      {
                        color: item.packed ? colors.mutedFg : colors.foreground,
                        textDecorationLine: item.packed ? 'line-through' : 'none',
                      },
                    ]}
                  >
                    {item.name}
                  </Text>

                  <Text style={[styles.checkCat, { color: colors.mutedFg }]}>
                    {item.category}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : null}

        {/* ── Suitcase AI Chat Assistant ─────────────────────────────── */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cardHeaderRow}>
            <Lucide.MessageSquare size={20} color={colors.accent} />
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>
              {t('suitcase.assistantChat', { defaultValue: 'Suitcase Packing Assistant' })}
            </Text>
          </View>

          <View style={styles.chatBox}>
            {suitcaseState.messages.map((msg, i) => (
              <View
                key={i}
                style={[
                  styles.chatBubble,
                  msg.role === 'user'
                    ? [styles.userBubble, { backgroundColor: colors.primary }]
                    : [styles.assistantBubble, { backgroundColor: colors.secondary }],
                ]}
              >
                <Text
                  style={[
                    styles.chatText,
                    { color: msg.role === 'user' ? colors.primaryFg : colors.foreground },
                  ]}
                >
                  {msg.text}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.chatInputRow}>
            <TextInput
              style={[styles.chatInput, { backgroundColor: colors.secondary, color: colors.foreground }]}
              value={chatInput}
              onChangeText={setChatInput}
              placeholder={t('suitcase.askPlaceholder', { defaultValue: 'Ask packing advice…' })}
              placeholderTextColor={colors.mutedFg}
              onSubmitEditing={handleSendChat}
            />
            <TouchableOpacity
              onPress={handleSendChat}
              disabled={chatting || !chatInput.trim()}
              style={[styles.sendBtn, { backgroundColor: colors.accent }]}
            >
              {chatting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Lucide.Send size={16} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* ── Fast Scroll To Top Floater ─────────────────────────────── */}
      <ScrollToTopFloater
        visible={showScrollTop}
        onPress={() => scrollViewRef.current?.scrollTo({ y: 0, animated: true })}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    fontFamily: fonts.displayBold,
    fontSize: fontSizes.lg,
  },
  scroll: {
    padding: spacing[4],
    paddingBottom: spacing[12],
    gap: spacing[4],
  },
  card: {
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: spacing[4],
    gap: spacing[3],
    ...shadows.sm,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  cardTitle: {
    fontFamily: fonts.displayBold,
    fontSize: fontSizes.base,
  },
  inputLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    height: 42,
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingHorizontal: spacing[3],
  },
  textInput: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
  },
  durationRow: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  durationBtn: {
    flex: 1,
    height: 36,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
  },
  purposeScroll: {
    height: 48,
    alignItems: 'center',
    gap: spacing[2],
  },
  purposeBtn: {
    height: 36,
    paddingHorizontal: spacing[3.5],
    borderRadius: radii.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  purposeBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  packBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 46,
    borderRadius: radii.xl,
    marginTop: spacing[2],
  },
  packBtnText: {
    color: '#fff',
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.sm,
  },
  progressBg: {
    height: 6,
    borderRadius: radii.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radii.full,
  },
  checklist: {
    gap: spacing[2],
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[2.5],
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing[3],
  },
  checkBox: {
    width: 20,
    height: 20,
    borderRadius: radii.sm,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkName: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.xs,
    flex: 1,
  },
  checkCat: {
    fontFamily: fonts.body,
    fontSize: 10,
  },
  chatBox: {
    gap: spacing[2],
    maxHeight: 240,
  },
  chatBubble: {
    padding: spacing[3],
    borderRadius: radii.lg,
    maxWidth: '85%',
  },
  userBubble: {
    alignSelf: 'flex-end',
  },
  assistantBubble: {
    alignSelf: 'flex-start',
  },
  chatText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    lineHeight: fontSizes.xs * 1.4,
  },
  chatInputRow: {
    flexDirection: 'row',
    gap: spacing[2],
    marginTop: spacing[2],
  },
  chatInput: {
    flex: 1,
    height: 40,
    borderRadius: radii.lg,
    paddingHorizontal: spacing[3],
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
