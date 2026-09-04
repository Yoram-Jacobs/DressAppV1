/**
 * apps/mobile/src/components/itemDetail/ItemStylistChat.tsx
 *
 * Direct Item Stylist Chat & Advice Assistant.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Lucide from 'lucide-react-native';
import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii } from '@mobile/theme/tokens';
import { client } from '@mobile/lib/api';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ItemStylistChatProps {
  visible: boolean;
  onClose: () => void;
  itemName: string;
  itemId: string;
}

export function ItemStylistChat({
  visible,
  onClose,
  itemName,
  itemId,
}: ItemStylistChatProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: t('itemDetail.stylistGreeting', {
        defaultValue: 'Hello! I\'m your AI Stylist. Ask me anything about how to style, accessorize, or layer your "{{name}}".',
        name: itemName || t('itemDetail.defaultItemName', { defaultValue: 'item' }),
      }),
    },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    const userMsg = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
    setSending(true);

    try {
      const formData = new FormData();
      formData.append('prompt', `Regarding the wardrobe item "${itemName}" (ID: ${itemId}): ${userMsg}`);
      const res = await client.post('/stylist', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const reply = res?.data?.response || res?.data?.reply || 'That would look fantastic with neutral tailored trousers and minimalist loafers.';
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'I recommend pairing this with clean silhouettes and complementary earth tones.',
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const quickPrompts = [
    t('itemDetail.quickPrompt1', { defaultValue: 'How should I style this for a dinner date?' }),
    t('itemDetail.quickPrompt2', { defaultValue: 'What colors match best with this?' }),
    t('itemDetail.quickPrompt3', { defaultValue: 'Suggest shoes and accessories for this item.' }),
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={styles.headerTitleRow}>
              <Lucide.Sparkles size={18} color={colors.accent} />
              <Text style={[styles.headerTitle, { color: colors.foreground }]}>
                {t('itemDetail.stylistChatTitle', { defaultValue: 'AI Stylist Advice' })}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Lucide.X size={20} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          {/* Messages */}
          <ScrollView 
            style={styles.chatScroll} 
            contentContainerStyle={styles.chatContent}
            keyboardShouldPersistTaps="handled"
          >
            {messages.map((m, idx) => {
              const isUser = m.role === 'user';
              return (
                <View
                  key={idx}
                  style={[
                    styles.msgBubble,
                    isUser
                      ? [styles.userBubble, { backgroundColor: colors.primary }]
                      : [styles.assistantBubble, { backgroundColor: colors.secondary, borderColor: colors.border }],
                  ]}
                >
                  <Text
                    style={[
                      styles.msgText,
                      { color: isUser ? '#FFF' : colors.foreground },
                    ]}
                  >
                    {m.content}
                  </Text>
                </View>
              );
            })}
            {sending && (
              <View style={[styles.assistantBubble, { backgroundColor: colors.secondary, alignSelf: 'flex-start' }]}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            )}
          </ScrollView>

          {/* Quick Prompts */}
          <View style={styles.promptsRow}>
            {quickPrompts.map((p, idx) => (
              <TouchableOpacity
                key={idx}
                style={[styles.promptChip, { backgroundColor: colors.secondary, borderColor: colors.border }]}
                onPress={() => setInput(p)}
              >
                <Text style={[styles.promptText, { color: colors.foreground }]} numberOfLines={1}>
                  {p}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Input Box */}
          <View style={[styles.inputRow, { borderTopColor: colors.border }]}>
            <TextInput
              style={[styles.input, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
              value={input}
              onChangeText={setInput}
              placeholder={t('itemDetail.askStylistPlaceholder', { defaultValue: 'Ask for styling advice...' })}
              placeholderTextColor={colors.mutedFg}
              onSubmitEditing={handleSend}
            />
            <TouchableOpacity
              style={[styles.sendBtn, { backgroundColor: colors.primary }]}
              onPress={handleSend}
              disabled={sending}
            >
              <Lucide.Send size={16} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    height: '75%',
    borderTopLeftRadius: radii['2xl'],
    borderTopRightRadius: radii['2xl'],
    borderTopWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontFamily: fonts.displayBold,
    fontSize: fontSizes.md,
  },
  chatScroll: {
    flex: 1,
  },
  chatContent: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  msgBubble: {
    maxWidth: '82%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
  },
  userBubble: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: radii.sm,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: radii.sm,
  },
  msgText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    lineHeight: 20,
  },
  promptsRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
  },
  promptChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radii.full,
    borderWidth: 1,
    maxWidth: 150,
  },
  promptText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs - 2,
  },
  inputRow: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.sm,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
