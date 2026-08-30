/**
 * apps/mobile/src/components/stylist/ConversationSidebar.tsx
 *
 * Mobile AI Stylist Conversation History Drawer / Sidebar.
 * Parity with web ConversationSidebar:
 *   - New conversation button at top
 *   - Groups: Pinned, Today, Yesterday, Earlier, Archived
 *   - Actions: Select, Pin/Unpin, Rename, Mark Read/Unread, Delete
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

/**
 * Group sessions into Today / Yesterday / Earlier buckets based on last_active_at
 */
function groupSessions(sessions: StylistSession[]) {
  const out: { today: StylistSession[]; yesterday: StylistSession[]; earlier: StylistSession[] } = {
    today: [],
    yesterday: [],
    earlier: [],
  };
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday.getTime() - 86400 * 1000);

  for (const s of sessions) {
    const raw = s.last_active_at || s.updated_at || s.created_at;
    const ts = raw ? new Date(raw) : null;
    if (!ts || Number.isNaN(ts.getTime())) {
      out.earlier.push(s);
      continue;
    }
    if (ts >= startOfToday) {
      out.today.push(s);
    } else if (ts >= startOfYesterday) {
      out.yesterday.push(s);
    } else {
      out.earlier.push(s);
    }
  }
  return out;
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

  // Persistence States
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [archivedIds, setArchivedIds] = useState<string[]>([]);
  const [unreadIds, setUnreadIds] = useState<string[]>([]);
  const [customTitles, setCustomTitles] = useState<Record<string, string>>({});
  const [showArchived, setShowArchived] = useState(false);

  // Rename Dialog State
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renameTargetId, setRenameTargetId] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState('');

  // Action Menu State
  const [actionMenuTargetId, setActionMenuTargetId] = useState<string | null>(null);

  // Slide Animation
  const [slideAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    // Load persisted local UI settings
    AsyncStorage.getItem(STORAGE_PINNED).then((v) => v && setPinnedIds(JSON.parse(v))).catch(() => {});
    AsyncStorage.getItem(STORAGE_ARCHIVED).then((v) => v && setArchivedIds(JSON.parse(v))).catch(() => {});
    AsyncStorage.getItem(STORAGE_UNREAD).then((v) => v && setUnreadIds(JSON.parse(v))).catch(() => {});
    AsyncStorage.getItem(STORAGE_TITLES).then((v) => v && setCustomTitles(JSON.parse(v))).catch(() => {});
  }, []);

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
  }, [visible, slideAnim]);

  const togglePin = (id: string) => {
    const next = pinnedIds.includes(id) ? pinnedIds.filter((x) => x !== id) : [...pinnedIds, id];
    setPinnedIds(next);
    AsyncStorage.setItem(STORAGE_PINNED, JSON.stringify(next)).catch(() => {});
  };

  const toggleArchive = (id: string) => {
    const next = archivedIds.includes(id) ? archivedIds.filter((x) => x !== id) : [...archivedIds, id];
    setArchivedIds(next);
    AsyncStorage.setItem(STORAGE_ARCHIVED, JSON.stringify(next)).catch(() => {});
  };

  const toggleUnread = (id: string) => {
    const next = unreadIds.includes(id) ? unreadIds.filter((x) => x !== id) : [...unreadIds, id];
    setUnreadIds(next);
    AsyncStorage.setItem(STORAGE_UNREAD, JSON.stringify(next)).catch(() => {});
  };

  const handleStartRename = (id: string, currentTitle: string) => {
    setRenameTargetId(id);
    setRenameInput(currentTitle);
    setRenameModalOpen(true);
    setActionMenuTargetId(null);
  };

  const handleSaveRename = () => {
    if (!renameTargetId) return;
    const trimmed = renameInput.trim();
    if (trimmed) {
      const next = { ...customTitles, [renameTargetId]: trimmed };
      setCustomTitles(next);
      AsyncStorage.setItem(STORAGE_TITLES, JSON.stringify(next)).catch(() => {});
    }
    setRenameModalOpen(false);
    setRenameTargetId(null);
  };

  const confirmDelete = (id: string) => {
    setActionMenuTargetId(null);
    Alert.alert(
      t('stylist.delete', { defaultValue: 'Delete' }),
      t('stylist.deleteConfirm', { defaultValue: 'Are you sure you want to delete this conversation?' }),
      [
        { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
        {
          text: t('common.delete', { defaultValue: 'Delete' }),
          style: 'destructive',
          onPress: () => onDelete(id),
        },
      ]
    );
  };

  // Filter & Group logic
  const activeSessions = useMemo(() => {
    return (sessions || []).filter((s) => !archivedIds.includes(s.id));
  }, [sessions, archivedIds]);

  const archivedSessions = useMemo(() => {
    return (sessions || []).filter((s) => archivedIds.includes(s.id));
  }, [sessions, archivedIds]);

  const pinnedSessions = useMemo(() => {
    return activeSessions.filter((s) => pinnedIds.includes(s.id));
  }, [activeSessions, pinnedIds]);

  const regularSessions = useMemo(() => {
    return activeSessions.filter((s) => !pinnedIds.includes(s.id));
  }, [activeSessions, pinnedIds]);

  const groups = useMemo(() => groupSessions(regularSessions), [regularSessions]);
  const empty = !loading && (sessions || []).length === 0;

  const renderSessionRow = (session: StylistSession) => {
    const isSessionActive = session.id === activeId;
    const isPinned = pinnedIds.includes(session.id);
    const isArchived = archivedIds.includes(session.id);
    const isUnread = unreadIds.includes(session.id);
    const title = customTitles[session.id] || session.title || t('stylist.untitledConversation', { defaultValue: 'Untitled chat' });
    const snippet = (session.snippet || '').trim();

    return (
      <TouchableOpacity
        key={session.id}
        style={[
          styles.sessionRow,
          {
            backgroundColor: isSessionActive
              ? isDark
                ? 'rgba(45, 143, 127, 0.22)'
                : 'rgba(45, 143, 127, 0.12)'
              : colors.card,
            borderColor: isSessionActive ? colors.accent : colors.border,
          },
        ]}
        onPress={() => {
          onSelect(session.id);
          onClose();
        }}
        activeOpacity={0.7}
      >
        <View style={styles.sessionMain}>
          <View style={styles.iconWrap}>
            <Lucide.MessageSquare size={16} color={isUnread ? colors.accent : colors.mutedFg} />
            {isUnread && <View style={[styles.unreadDot, { backgroundColor: colors.accent }]} />}
          </View>

          <View style={styles.sessionTextCol}>
            <Text
              style={[
                styles.sessionTitle,
                {
                  color: colors.foreground,
                  fontFamily: isUnread || isSessionActive ? fonts.bodyBold : fonts.bodyMedium,
                },
              ]}
              numberOfLines={1}
            >
              {title}
            </Text>
            {snippet ? (
              <Text style={[styles.sessionSnippet, { color: colors.mutedFg }]} numberOfLines={1}>
                {snippet}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Right Actions Bar */}
        <View style={styles.actionsRow} onStartShouldSetResponder={() => true}>
          {/* More Menu */}
          <TouchableOpacity
            style={styles.actionIconBtn}
            onPress={() => setActionMenuTargetId(actionMenuTargetId === session.id ? null : session.id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Lucide.MoreVertical size={14} color={colors.mutedFg} />
          </TouchableOpacity>

          {/* Pin */}
          <TouchableOpacity
            style={styles.actionIconBtn}
            onPress={() => togglePin(session.id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Lucide.Pin
              size={14}
              color={isPinned ? colors.accent : colors.mutedFg}
              fill={isPinned ? colors.accent : 'transparent'}
            />
          </TouchableOpacity>

          {/* Delete */}
          <TouchableOpacity
            style={styles.actionIconBtn}
            onPress={() => confirmDelete(session.id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Lucide.Trash2 size={14} color={colors.mutedFg} />
          </TouchableOpacity>
        </View>

        {/* Action Menu Popover */}
        {actionMenuTargetId === session.id && (
          <View style={[styles.inlineMenu, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TouchableOpacity
              style={styles.inlineMenuItem}
              onPress={() => {
                toggleUnread(session.id);
                setActionMenuTargetId(null);
              }}
            >
              <Lucide.MessageSquare size={14} color={colors.foreground} />
              <Text style={[styles.inlineMenuText, { color: colors.foreground }]}>
                {isUnread
                  ? t('stylist.markRead', { defaultValue: 'Mark as read' })
                  : t('stylist.markUnread', { defaultValue: 'Mark as unread' })}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.inlineMenuItem}
              onPress={() => handleStartRename(session.id, title)}
            >
              <Lucide.Edit2 size={14} color={colors.foreground} />
              <Text style={[styles.inlineMenuText, { color: colors.foreground }]}>
                {t('stylist.rename', { defaultValue: 'Rename' })}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.inlineMenuItem}
              onPress={() => {
                toggleArchive(session.id);
                setActionMenuTargetId(null);
              }}
            >
              {isArchived ? (
                <Lucide.ArchiveRestore size={14} color={colors.foreground} />
              ) : (
                <Lucide.Archive size={14} color={colors.foreground} />
              )}
              <Text style={[styles.inlineMenuText, { color: colors.foreground }]}>
                {isArchived
                  ? t('stylist.unarchive', { defaultValue: 'Unarchive' })
                  : t('stylist.archive', { defaultValue: 'Archive' })}
              </Text>
            </TouchableOpacity>
          </View>
        )}
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
          {/* Top Capsule Button: + New conversation */}
          <View style={styles.headerArea}>
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
    ...StyleSheet.absoluteFillObject,
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
    borderBottomColor: '#e5e7eb',
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
    position: 'relative',
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
    alignItems: 'flex-start',
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
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  actionIconBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineMenu: {
    position: 'absolute',
    top: '100%',
    right: spacing[2],
    zIndex: 999,
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing[1],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 8,
    minWidth: 140,
  },
  inlineMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[2],
    borderRadius: radii.sm,
  },
  inlineMenuText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.xs,
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
