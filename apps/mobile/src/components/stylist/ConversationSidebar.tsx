/**
 * apps/mobile/src/components/stylist/ConversationSidebar.tsx
 *
 * Mobile AI Stylist Conversation History Drawer / Sidebar.
 * Parity with web ConversationSidebar:
 *   - New conversation button at top
 *   - Groups: Pinned, Today, Yesterday, Earlier, Archived
 *   - Bottom-sheet Action Modal for Three Dots menu (no clipping or sibling overlays)
 *   - Actions: Select, Pin/Unpin, Rename, Mark Read/Unread, Archive/Unarchive, Delete
 *   - Filters out empty/untitled chats with 0 messages
 *   - Full AsyncStorage persistence for client-side state
 *   - RTL-aware sliding drawer animation
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  I18nManager,
  Animated,
  Dimensions,
  Pressable,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import * as Lucide from 'lucide-react-native';

import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii } from '@mobile/theme/tokens';

const STORAGE_PINNED = 'dressapp.stylist.pinned';
const STORAGE_ARCHIVED = 'dressapp.stylist.archived';
const STORAGE_UNREAD = 'dressapp.stylist.unread';
const STORAGE_TITLES = 'dressapp.stylist.titles';

export interface StylistSession {
  id: string;
  title?: string;
  snippet?: string;
  turns?: number;
  last_active_at?: string;
  updated_at?: string;
  created_at?: string;
}

interface ConversationSidebarProps {
  visible: boolean;
  onClose: () => void;
  sessions: StylistSession[];
  activeId: string | null;
  onSelect: (sessionId: string) => void;
  onNew: () => void;
  onDelete: (sessionId: string) => void;
  loading?: boolean;
}

export function ConversationSidebar({
  visible,
  onClose,
  sessions,
  activeId,
  onSelect,
  onNew,
  onDelete,
  loading = false,
}: ConversationSidebarProps) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const isRtl = I18nManager.isRTL;
  const screenWidth = Dimensions.get('window').width;
  const drawerWidth = Math.min(screenWidth * 0.82, 340);

  const [slideAnim] = useState(() => new Animated.Value(0));

  // Client-persisted states
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [archivedIds, setArchivedIds] = useState<string[]>([]);
  const [unreadIds, setUnreadIds] = useState<string[]>([]);
  const [customTitles, setCustomTitles] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');

  // UI States
  const [showArchived, setShowArchived] = useState(false);
  const [actionSheetSession, setActionSheetSession] = useState<StylistSession | null>(null);


  // Rename Dialog
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renameTargetId, setRenameTargetId] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState('');

  // Load client state on mount
  useEffect(() => {
    (async () => {
      try {
        const [pinRaw, archRaw, unreadRaw, titlesRaw] = await Promise.all([
          AsyncStorage.getItem(STORAGE_PINNED),
          AsyncStorage.getItem(STORAGE_ARCHIVED),
          AsyncStorage.getItem(STORAGE_UNREAD),
          AsyncStorage.getItem(STORAGE_TITLES),
        ]);
        if (pinRaw) setPinnedIds(JSON.parse(pinRaw));
        if (archRaw) setArchivedIds(JSON.parse(archRaw));
        if (unreadRaw) setUnreadIds(JSON.parse(unreadRaw));
        if (titlesRaw) setCustomTitles(JSON.parse(titlesRaw));
      } catch {
        // non-fatal
      }
    })();
  }, []);

  // Slide drawer animation
  useEffect(() => {
    if (visible) {
      Animated.timing(slideAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  // Actions
  const togglePin = async (id: string) => {
    const next = pinnedIds.includes(id)
      ? pinnedIds.filter((x) => x !== id)
      : [...pinnedIds, id];
    setPinnedIds(next);
    await AsyncStorage.setItem(STORAGE_PINNED, JSON.stringify(next)).catch(() => {});
  };

  const toggleArchive = async (id: string) => {
    const next = archivedIds.includes(id)
      ? archivedIds.filter((x) => x !== id)
      : [...archivedIds, id];
    setArchivedIds(next);
    await AsyncStorage.setItem(STORAGE_ARCHIVED, JSON.stringify(next)).catch(() => {});
  };

  const toggleUnread = async (id: string) => {
    const next = unreadIds.includes(id)
      ? unreadIds.filter((x) => x !== id)
      : [...unreadIds, id];
    setUnreadIds(next);
    await AsyncStorage.setItem(STORAGE_UNREAD, JSON.stringify(next)).catch(() => {});
  };

  const handleStartRename = (session: StylistSession) => {
    setActionSheetSession(null);
    const currTitle = customTitles[session.id] || session.title || t('stylist.untitledChat', { defaultValue: 'Conversation' });
    setRenameTargetId(session.id);
    setRenameInput(currTitle);
    setRenameModalOpen(true);
  };

  const handleSaveRename = async () => {
    if (!renameTargetId) return;
    const trimmed = renameInput.trim();
    if (trimmed) {
      const next = { ...customTitles, [renameTargetId]: trimmed };
      setCustomTitles(next);
      await AsyncStorage.setItem(STORAGE_TITLES, JSON.stringify(next)).catch(() => {});
    }
    setRenameModalOpen(false);
    setRenameTargetId(null);
  };

  const confirmDelete = (sessionId: string) => {
    setActionSheetSession(null);
    Alert.alert(
      t('stylist.deleteChatTitle', { defaultValue: 'Delete conversation?' }),
      t('stylist.deleteChatConfirm', { defaultValue: 'This will permanently remove this stylist thread and its recommended outfits.' }),
      [
        { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
        {
          text: t('common.delete', { defaultValue: 'Delete' }),
          style: 'destructive',
          onPress: () => onDelete(sessionId),
        },
      ]
    );
  };

  // Filter out empty 0-turn sessions with no snippet, and apply search filter
  const validSessions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sessions.filter((s) => {
      const hasTurns = (s.turns && s.turns > 0);
      const hasSnippet = !!(s.snippet && s.snippet.trim().length > 0);
      const hasCustomTitle = !!customTitles[s.id];
      const hasRealTitle = s.title && !['Untitled chat', 'שיחה ללא שם', 'New conversation', 'Style advice'].includes(s.title);
      const isValid = hasTurns || hasSnippet || hasCustomTitle || hasRealTitle;
      if (!isValid) return false;
      if (!q) return true;
      const title = (customTitles[s.id] || s.title || '').toLowerCase();
      const snippet = (s.snippet || '').toLowerCase();
      return title.includes(q) || snippet.includes(q);
    });
  }, [sessions, customTitles, searchQuery]);


  // Grouping logic (Today, Yesterday, Earlier)
  const { pinnedSessions, archivedSessions, groups } = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 86400000;

    const pinned: StylistSession[] = [];
    const archived: StylistSession[] = [];
    const today: StylistSession[] = [];
    const yesterday: StylistSession[] = [];
    const earlier: StylistSession[] = [];

    for (const session of validSessions) {
      if (archivedIds.includes(session.id)) {
        archived.push(session);
        continue;
      }
      if (pinnedIds.includes(session.id)) {
        pinned.push(session);
        continue;
      }

      const rawDate = session.last_active_at || session.updated_at || session.created_at;
      const ts = rawDate ? new Date(rawDate).getTime() : 0;

      if (ts >= startOfToday) {
        today.push(session);
      } else if (ts >= startOfYesterday) {
        yesterday.push(session);
      } else {
        earlier.push(session);
      }
    }

    return {
      pinnedSessions: pinned,
      archivedSessions: archived,
      groups: { today, yesterday, earlier },
    };
  }, [validSessions, pinnedIds, archivedIds]);

  const empty =
    pinnedSessions.length === 0 &&
    archivedSessions.length === 0 &&
    groups.today.length === 0 &&
    groups.yesterday.length === 0 &&
    groups.earlier.length === 0;

  const renderSessionRow = (session: StylistSession) => {
    const isActive = session.id === activeId;
    const isPinned = pinnedIds.includes(session.id);
    const isUnread = unreadIds.includes(session.id);
    const title = customTitles[session.id] || session.title || session.snippet || t('stylist.untitledChat', { defaultValue: 'Conversation' });
    const snippet = session.snippet;

    return (
      <TouchableOpacity
        key={session.id}
        style={[
          styles.sessionRow,
          {
            backgroundColor: isActive ? (isDark ? 'rgba(168, 85, 247, 0.18)' : '#F3E8FF') : colors.card,
            borderColor: isActive ? colors.accent : colors.border,
          },
        ]}
        onPress={() => {
          if (unreadIds.includes(session.id)) {
            toggleUnread(session.id);
          }
          onSelect(session.id);
        }}
        onLongPress={() => setActionSheetSession(session)}
        activeOpacity={0.7}
      >
        {/* Left / Main text info */}
        <View style={styles.sessionMain}>
          <View style={styles.iconWrap}>
            <Lucide.MessageSquare
              size={15}
              color={isActive ? colors.accent : colors.mutedFg}
            />
            {isUnread && (
              <View style={[styles.unreadDot, { backgroundColor: colors.accent }]} />
            )}
          </View>

          <View style={styles.sessionTextCol}>
            <Text
              style={[
                styles.sessionTitle,
                {
                  color: isActive ? colors.accent : colors.foreground,
                  fontFamily: isUnread || isActive ? fonts.bodyBold : fonts.bodyMedium,
                  textAlign: isRtl ? 'right' : 'left',
                },
              ]}
              numberOfLines={1}
            >
              {title}
            </Text>
            {snippet ? (
              <Text
                style={[
                  styles.sessionSnippet,
                  { color: colors.mutedFg, textAlign: isRtl ? 'right' : 'left' },
                ]}
                numberOfLines={1}
              >
                {snippet}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Action icons */}
        <View style={styles.actionsRow}>
          {/* Pin Button */}
          <TouchableOpacity
            style={styles.actionIconBtn}
            onPress={() => togglePin(session.id)}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
          >
            <Lucide.Pin
              size={14}
              color={isPinned ? colors.accent : colors.mutedFg}
              fill={isPinned ? colors.accent : 'transparent'}
            />
          </TouchableOpacity>

          {/* Three Dots Menu Button (Opens Bottom Action Sheet) */}
          <TouchableOpacity
            style={styles.actionIconBtn}
            onPress={() => setActionSheetSession(session)}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
          >
            <Lucide.MoreVertical size={15} color={colors.mutedFg} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const translateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [isRtl ? drawerWidth : -drawerWidth, 0],
  });

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        {/* Backdrop */}
        <Pressable style={styles.backdrop} onPress={onClose} />

        {/* Sliding Drawer */}
        <Animated.View
          style={[
            styles.drawerContainer,
            {
              width: drawerWidth,
              backgroundColor: colors.background,
              borderRightColor: isRtl ? 'transparent' : colors.border,
              borderLeftColor: isRtl ? colors.border : 'transparent',
              transform: [{ translateX }],
            },
            isRtl ? { right: 0 } : { left: 0 },
          ]}
        >
          {/* Top Area: + New conversation + Search input */}
          <View style={[styles.headerArea, { borderBottomColor: colors.border }]}>
            <TouchableOpacity
              style={[
                styles.newConversationBtn,
                {
                  backgroundColor: colors.primary,
                  borderColor: isDark ? 'hsl(271, 85%, 62%)' : 'hsl(271, 81%, 56%)',
                },
              ]}
              onPress={() => {
                onNew();
                onClose();
              }}
              activeOpacity={0.8}
            >
              <Lucide.Plus size={16} color={colors.primaryFg} style={{ marginRight: 6 }} />
              <Text style={[styles.newConversationBtnText, { color: colors.primaryFg }]}>
                {t('stylist.newConversation', { defaultValue: 'New conversation' })}
              </Text>
            </TouchableOpacity>

            <View style={[styles.searchBox, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <Lucide.Search size={14} color={colors.mutedFg} />
              <TextInput
                style={[styles.searchInput, { color: colors.foreground, textAlign: isRtl ? 'right' : 'left' }]}
                placeholder={t('stylist.searchChats', { defaultValue: 'Search conversations...' })}
                placeholderTextColor={colors.mutedFg}
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="search"
                autoCapitalize="none"
              />
              {searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Lucide.X size={14} color={colors.mutedFg} />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>


          {/* Sessions List */}
          {loading ? (
            <View style={styles.centerLoading}>
              <ActivityIndicator size="small" color={colors.accent} />
            </View>
          ) : empty ? (
            <View style={[styles.emptyBox, { borderColor: colors.border }]}>
              <Lucide.MessageSquare size={28} color={colors.mutedFg} opacity={0.4} />
              <Text style={[styles.emptyText, { color: colors.mutedFg }]}>
                {t('stylist.noConversations', { defaultValue: 'No conversations yet' })}
              </Text>
            </View>
          ) : (
            <ScrollView
              style={styles.scrollArea}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Pinned Group */}
              {pinnedSessions.length > 0 && (
                <View style={styles.groupSection}>
                  <Text style={[styles.groupHeader, { color: colors.mutedFg }]}>
                    {t('stylist.pinned', { defaultValue: 'PINNED' }).toUpperCase()}
                  </Text>
                  {pinnedSessions.map(renderSessionRow)}
                </View>
              )}

              {/* Today Group */}
              {groups.today.length > 0 && (
                <View style={styles.groupSection}>
                  <Text style={[styles.groupHeader, { color: colors.mutedFg }]}>
                    {t('stylist.today', { defaultValue: 'TODAY' }).toUpperCase()}
                  </Text>
                  {groups.today.map(renderSessionRow)}
                </View>
              )}

              {/* Yesterday Group */}
              {groups.yesterday.length > 0 && (
                <View style={styles.groupSection}>
                  <Text style={[styles.groupHeader, { color: colors.mutedFg }]}>
                    {t('stylist.yesterday', { defaultValue: 'YESTERDAY' }).toUpperCase()}
                  </Text>
                  {groups.yesterday.map(renderSessionRow)}
                </View>
              )}

              {/* Earlier Group */}
              {groups.earlier.length > 0 && (
                <View style={styles.groupSection}>
                  <Text style={[styles.groupHeader, { color: colors.mutedFg }]}>
                    {t('stylist.earlier', { defaultValue: 'EARLIER' }).toUpperCase()}
                  </Text>
                  {groups.earlier.map(renderSessionRow)}
                </View>
              )}

              {/* Archived Section Toggle */}
              {archivedSessions.length > 0 && (
                <View style={styles.groupSection}>
                  <TouchableOpacity
                    style={styles.archiveToggle}
                    onPress={() => setShowArchived(!showArchived)}
                  >
                    <Lucide.Archive size={14} color={colors.mutedFg} />
                    <Text style={[styles.groupHeader, { color: colors.mutedFg, marginBottom: 0 }]}>
                      {t('stylist.archived', { defaultValue: 'ARCHIVED' }).toUpperCase()} ({archivedSessions.length})
                    </Text>
                  </TouchableOpacity>
                  {showArchived && archivedSessions.map(renderSessionRow)}
                </View>
              )}
            </ScrollView>
          )}
        </Animated.View>
      </View>

      {/* Three-Dots Floating Action Sheet Modal */}
      <Modal
        visible={!!actionSheetSession}
        transparent
        animationType="fade"
        onRequestClose={() => setActionSheetSession(null)}
      >
        <View style={styles.actionSheetOverlay}>
          <Pressable
            style={styles.actionSheetBackdrop}
            onPress={() => setActionSheetSession(null)}
          />
          {actionSheetSession && (
            <View
              style={[
                styles.actionSheetCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              {/* Action Sheet Header */}
              <View style={styles.actionSheetHeader}>
                <Text
                  style={[styles.actionSheetTitle, { color: colors.foreground }]}
                  numberOfLines={1}
                >
                  {customTitles[actionSheetSession.id] ||
                    actionSheetSession.title ||
                    actionSheetSession.snippet ||
                    t('stylist.untitledChat', { defaultValue: 'Conversation' })}
                </Text>
              </View>

              {/* Action Buttons */}
              <View style={styles.actionSheetList}>
                {/* Rename */}
                <TouchableOpacity
                  style={[styles.actionSheetItem, { borderBottomColor: colors.border }]}
                  onPress={() => handleStartRename(actionSheetSession)}
                >
                  <Lucide.Edit3 size={18} color={colors.accent} />
                  <Text style={[styles.actionSheetItemText, { color: colors.foreground }]}>
                    {t('stylist.rename', { defaultValue: 'Rename conversation' })}
                  </Text>
                </TouchableOpacity>

                {/* Mark as read / unread */}
                <TouchableOpacity
                  style={[styles.actionSheetItem, { borderBottomColor: colors.border }]}
                  onPress={() => {
                    toggleUnread(actionSheetSession.id);
                    setActionSheetSession(null);
                  }}
                >
                  <Lucide.MessageSquare size={18} color={colors.foreground} />
                  <Text style={[styles.actionSheetItemText, { color: colors.foreground }]}>
                    {unreadIds.includes(actionSheetSession.id)
                      ? t('stylist.markRead', { defaultValue: 'Mark as read' })
                      : t('stylist.markUnread', { defaultValue: 'Mark as unread' })}
                  </Text>
                </TouchableOpacity>

                {/* Pin / Unpin */}
                <TouchableOpacity
                  style={[styles.actionSheetItem, { borderBottomColor: colors.border }]}
                  onPress={() => {
                    togglePin(actionSheetSession.id);
                    setActionSheetSession(null);
                  }}
                >
                  <Lucide.Pin size={18} color={colors.foreground} />
                  <Text style={[styles.actionSheetItemText, { color: colors.foreground }]}>
                    {pinnedIds.includes(actionSheetSession.id)
                      ? t('stylist.unpin', { defaultValue: 'Unpin from top' })
                      : t('stylist.pin', { defaultValue: 'Pin to top' })}
                  </Text>
                </TouchableOpacity>

                {/* Archive / Unarchive */}
                <TouchableOpacity
                  style={[styles.actionSheetItem, { borderBottomColor: colors.border }]}
                  onPress={() => {
                    toggleArchive(actionSheetSession.id);
                    setActionSheetSession(null);
                  }}
                >
                  {archivedIds.includes(actionSheetSession.id) ? (
                    <Lucide.ArchiveRestore size={18} color={colors.foreground} />
                  ) : (
                    <Lucide.Archive size={18} color={colors.foreground} />
                  )}
                  <Text style={[styles.actionSheetItemText, { color: colors.foreground }]}>
                    {archivedIds.includes(actionSheetSession.id)
                      ? t('stylist.unarchive', { defaultValue: 'Unarchive conversation' })
                      : t('stylist.archive', { defaultValue: 'Archive conversation' })}
                  </Text>
                </TouchableOpacity>

                {/* Delete (Destructive) */}
                <TouchableOpacity
                  style={[styles.actionSheetItem, { borderBottomWidth: 0 }]}
                  onPress={() => confirmDelete(actionSheetSession.id)}
                >
                  <Lucide.Trash2 size={18} color="#EF4444" />
                  <Text style={[styles.actionSheetItemText, { color: '#EF4444' }]}>
                    {t('stylist.deleteChat', { defaultValue: 'Delete conversation' })}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Cancel Button */}
              <TouchableOpacity
                style={[
                  styles.actionSheetCancelBtn,
                  { backgroundColor: colors.background, borderColor: colors.border },
                ]}
                onPress={() => setActionSheetSession(null)}
              >
                <Text style={[styles.actionSheetCancelText, { color: colors.foreground }]}>
                  {t('common.cancel', { defaultValue: 'Cancel' })}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>

      {/* Rename Dialog Modal */}
      <Modal visible={renameModalOpen} transparent animationType="fade">
        <View style={styles.dialogOverlay}>
          <View style={[styles.dialogCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.dialogTitle, { color: colors.foreground }]}>
              {t('stylist.renamePrompt', { defaultValue: 'Rename conversation' })}
            </Text>
            <TextInput
              style={[
                styles.dialogInput,
                {
                  color: colors.foreground,
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                },
              ]}
              value={renameInput}
              onChangeText={setRenameInput}
              autoFocus
              selectTextOnFocus
            />
            <View style={styles.dialogButtons}>
              <TouchableOpacity
                style={[styles.dialogBtn, { borderColor: colors.border }]}
                onPress={() => setRenameModalOpen(false)}
              >
                <Text style={{ color: colors.foreground, fontFamily: fonts.bodyMedium }}>
                  {t('common.cancel', { defaultValue: 'Cancel' })}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dialogBtn, { backgroundColor: colors.accent, borderColor: colors.accent }]}
                onPress={handleSaveRename}
              >
                <Text style={{ color: '#FFF', fontFamily: fonts.bodyBold }}>
                  {t('common.save', { defaultValue: 'Save' })}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    flexDirection: 'row',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  drawerContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderRightWidth: 1,
    borderLeftWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 16,
    zIndex: 100,
  },
  headerArea: {
    padding: spacing[3],
    paddingTop: spacing[8],
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing[2],
  },
  newConversationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: radii.full,
    borderWidth: 2,
    paddingHorizontal: spacing[4],
  },
  newConversationBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.sm,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.full,
    borderWidth: 1,
    paddingHorizontal: spacing[3],
    height: 36,
    gap: spacing[2],
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    paddingVertical: 0,
  },

  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing[3],
    paddingBottom: spacing[8],
  },
  centerLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBox: {
    flex: 1,
    margin: spacing[4],
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: radii.xl,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[4],
    gap: spacing[2],
  },
  emptyText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    textAlign: 'center',
  },
  groupSection: {
    marginBottom: spacing[4],
  },
  groupHeader: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 0.8,
    marginBottom: spacing[2],
    paddingHorizontal: spacing[1],
  },
  sessionRow: {
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2.5],
    marginBottom: spacing[2],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sessionMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginRight: spacing[2],
  },
  iconWrap: {
    position: 'relative',
    marginTop: 2,
  },
  unreadDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  sessionTextCol: {
    flex: 1,
  },
  sessionTitle: {
    fontSize: fontSizes.sm,
    lineHeight: 18,
  },
  sessionSnippet: {
    fontFamily: fonts.body,
    fontSize: 11,
    marginTop: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionIconBtn: {
    width: 28,
    height: 28,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Three-Dots Action Sheet Modal
  actionSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  actionSheetBackdrop: {
    ...StyleSheet.absoluteFill,
  },
  actionSheetCard: {
    borderTopLeftRadius: radii['2xl'],
    borderTopRightRadius: radii['2xl'],
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: spacing[4],
    paddingBottom: spacing[8],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 24,
  },
  actionSheetHeader: {
    paddingBottom: spacing[3],
    marginBottom: spacing[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(150, 150, 150, 0.2)',
  },
  actionSheetTitle: {
    fontFamily: fonts.displayBold,
    fontSize: fontSizes.md,
    textAlign: 'center',
  },
  actionSheetList: {
    borderRadius: radii.xl,
    overflow: 'hidden',
  },
  actionSheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  actionSheetItemText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
  },
  actionSheetCancelBtn: {
    marginTop: spacing[3],
    height: 46,
    borderRadius: radii.xl,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionSheetCancelText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.sm,
  },

  archiveToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1.5],
    marginBottom: spacing[2],
    paddingHorizontal: spacing[1],
  },
  dialogOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[4],
  },
  dialogCard: {
    width: '100%',
    maxWidth: 320,
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: spacing[4],
    gap: spacing[3],
  },
  dialogTitle: {
    fontFamily: fonts.displayBold,
    fontSize: fontSizes.md,
  },
  dialogInput: {
    height: 40,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing[3],
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
  },
  dialogButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing[2],
  },
  dialogBtn: {
    paddingHorizontal: spacing[3.5],
    paddingVertical: spacing[2],
    borderRadius: radii.md,
    borderWidth: 1,
  },
});
