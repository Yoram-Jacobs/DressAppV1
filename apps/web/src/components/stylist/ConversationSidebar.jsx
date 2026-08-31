import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  MessageSquare,
  Plus,
  Trash2,
  Loader2,
  Pin,
  Archive,
  MoreVertical,
  Edit2,
  ArchiveRestore,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

function groupSessions(sessions) {
  const out = { today: [], yesterday: [], earlier: [] };
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
    if (ts >= startOfToday) out.today.push(s);
    else if (ts >= startOfYesterday) out.yesterday.push(s);
    else out.earlier.push(s);
  }
  return out;
}

function SessionRow({
  session,
  isActive,
  onSelect,
  onDelete,
  onTogglePin,
  onToggleArchive,
  onToggleUnread,
  onRename,
  isPinned,
  isArchived,
  isUnread,
  title,
  t,
}) {
  const displayTitle = (title && title.trim()) || t('stylist.untitledConversation');
  const snippet = (session.snippet || '').trim();

  return (
    <motion.div layout initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className={cn('stylist-session-row', isActive ? 'stylist-session-row--active' : '',)}
      onClick={() => onSelect(session.id)} data-testid={`stylist-session-row-${session.id}`}>
      <div className="stylist-session-main">
        <div className="stylist-session-icon-wrap">
          <MessageSquare className={cn('stylist-session-icon', isUnread && 'stylist-session-icon--unread')} />
          {isUnread && (<span className="stylist-session-unread-dot" />)}
        </div>
        <div className="stylist-session-text">
          <div className={cn('stylist-session-title', isUnread && 'stylist-session-title--unread',)}>
            {displayTitle}
          </div>
          {snippet ? (
            <div className="stylist-session-snippet">{snippet}</div>
          ) : null}
        </div>
      </div>
      <div className="stylist-session-actions" onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="stylist-session-action-btn" aria-label={t('stylist.moreActions', { defaultValue: 'More actions' })}>
              <MoreVertical className="stylist-session-action-icon" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => onToggleUnread(session.id)}>
              <MessageSquare className="h-4 w-4" />
              {isUnread ? t('stylist.markRead', { defaultValue: 'Mark As Read' }) : t('stylist.markUnread', { defaultValue: 'Mark As Unread' })}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onRename(session.id, displayTitle)}>
              <Edit2 className="h-4 w-4" />
              {t('stylist.rename', { defaultValue: 'Rename' })}
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => { if (window.confirm(t('stylist.deleteConfirm'))) onDelete(session.id); }}>
              <Trash2 className="h-4 w-4" />
              {t('stylist.delete', { defaultValue: 'Delete' })}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <button type="button" onClick={() => onTogglePin(session.id)} className={cn('stylist-session-action-btn', isPinned && 'stylist-session-action-btn--pinned',)}
          title={isPinned ? t('stylist.unpin', { defaultValue: 'Unpin' }) : t('stylist.pin', { defaultValue: 'Pin' })}>
          <Pin className={cn('stylist-session-action-icon', isPinned && 'stylist-session-action-icon--filled')} />
        </button>
        <button type="button" onClick={() => onToggleArchive(session.id)} className="stylist-session-action-btn"
          title={isArchived ? t('stylist.unarchive', { defaultValue: 'Unarchive' }) : t('stylist.archive', { defaultValue: 'Archive' })}>
          {isArchived ? <ArchiveRestore className="stylist-session-action-icon" /> : <Archive className="stylist-session-action-icon" />}
        </button>
      </div>
    </motion.div>
  );
}

export function ConversationSidebar({
  sessions,
  activeId,
  onSelect,
  onNew,
  onDelete,
  loading = false,
}) {
  const { t } = useTranslation();

  const [pinnedIds, setPinnedIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('dressapp.stylist.pinned') || '[]');
    } catch {
      return [];
    }
  });

  const [archivedIds, setArchivedIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('dressapp.stylist.archived') || '[]');
    } catch {
      return [];
    }
  });

  const [unreadIds, setUnreadIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('dressapp.stylist.unread') || '[]');
    } catch {
      return [];
    }
  });

  const [customTitles, setCustomTitles] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('dressapp.stylist.titles') || '{}');
    } catch {
      return {};
    }
  });

  const [showArchived, setShowArchived] = useState(false);

  const togglePin = (id) => {
    setPinnedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      localStorage.setItem('dressapp.stylist.pinned', JSON.stringify(next));
      return next;
    });
  };

  const toggleArchive = (id) => {
    setArchivedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      localStorage.setItem('dressapp.stylist.archived', JSON.stringify(next));
      return next;
    });
  };

  const toggleUnread = (id) => {
    setUnreadIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      localStorage.setItem('dressapp.stylist.unread', JSON.stringify(next));
      return next;
    });
  };

  const renameSession = (id, currentTitle) => {
    const newTitle = window.prompt(t('stylist.renamePrompt', { defaultValue: 'Rename conversation:' }), currentTitle);
    if (newTitle === null) return;
    setCustomTitles((prev) => {
      const next = { ...prev, [id]: newTitle.trim() };
      localStorage.setItem('dressapp.stylist.titles', JSON.stringify(next));
      return next;
    });
  };

  // Filter & Group logic: exclude empty 0-turn sessions
  const validSessions = useMemo(() => {
    return (sessions || []).filter((s) => {
      const hasTurns = (s.turns && s.turns > 0);
      const hasSnippet = !!(s.snippet && s.snippet.trim().length > 0);
      const hasCustomTitle = !!customTitles[s.id];
      const hasRealTitle = s.title && !['Untitled chat', 'שיחה ללא שם', 'New conversation', 'Style advice'].includes(s.title);
      return hasTurns || hasSnippet || hasCustomTitle || hasRealTitle;
    });
  }, [sessions, customTitles]);

  const activeSessions = useMemo(() => {
    return validSessions.filter((s) => !archivedIds.includes(s.id));
  }, [validSessions, archivedIds]);

  const archivedSessions = useMemo(() => {
    return validSessions.filter((s) => archivedIds.includes(s.id));
  }, [validSessions, archivedIds]);

  const pinnedSessions = useMemo(() => {
    return activeSessions.filter((s) => pinnedIds.includes(s.id));
  }, [activeSessions, pinnedIds]);

  const regularSessions = useMemo(() => {
    return activeSessions.filter((s) => !pinnedIds.includes(s.id));
  }, [activeSessions, pinnedIds]);

  const groups = useMemo(() => groupSessions(regularSessions), [regularSessions]);
  const empty = !loading && validSessions.length === 0;
  return (
    <div className="stylist-sidebar-inner">
      <div className="stylist-sidebar-newbtn-wrap">
        <Button onClick={onNew} className="stylist-sidebar-newbtn" data-testid="stylist-new-conversation-btn">
          <i className="fa-solid fa-plus"></i>{t('stylist.newConversation')}
        </Button>
      </div>
      {loading ? (
        <div className="stylist-sidebar-loading">
          <Loader2 className="stylist-sidebar-loading-icon" />
        </div>
      ) : empty ? (
        <div className="stylist-sidebar-empty">
          <MessageSquare className="stylist-sidebar-empty-icon" />
          <div>{t('stylist.noConversations', { defaultValue: 'No conversations yet' })}</div>
        </div>
      ) : (
        <div className="stylist-sidebar-groups">
          {pinnedSessions.length > 0 && (
            <div classname="">
              <span className="stylist-sidebar-label">
                {t('stylist.pinned', { defaultValue: 'Pinned' }).toUpperCase()}
              </span>
              <div className="stylist-sidebar-list">
                {pinnedSessions.map((s) => (
                  <SessionRow
                    key={s.id}
                    session={s}
                    isActive={s.id === activeId}
                    onSelect={onSelect}
                    onDelete={onDelete}
                    onTogglePin={togglePin}
                    onToggleArchive={toggleArchive}
                    onToggleUnread={toggleUnread}
                    onRename={renameSession}
                    isPinned={pinnedIds.includes(s.id)}
                    isArchived={archivedIds.includes(s.id)}
                    isUnread={unreadIds.includes(s.id)}
                    title={customTitles[s.id] || s.title}
                    t={t}
                  />
                ))}
              </div>
            </div>
          )}
          {archivedSessions.length > 0 && (
            <div className="stylist-sidebar-archived-wrap">
              <Button variant="ghost" size="sm" onClick={() => setShowArchived(!showArchived)} className="stylist-sidebar-archived-toggle">
                <span>{t('stylist.archivedChats', { defaultValue: 'Archived Chats' })} ({archivedSessions.length})</span>
                <span className="stylist-sidebar-archived-toggle-label">{showArchived ? 'Hide' : 'Show'}</span>
              </Button>
              {showArchived && (
                <div className="stylist-sidebar-list stylist-sidebar-list--archived">
                  {archivedSessions.map((s) => (
                    <SessionRow
                      key={s.id}
                      session={s}
                      isActive={s.id === activeId}
                      onSelect={onSelect}
                      onDelete={onDelete}
                      onTogglePin={togglePin}
                      onToggleArchive={toggleArchive}
                      onToggleUnread={toggleUnread}
                      onRename={renameSession}
                      isPinned={pinnedIds.includes(s.id)}
                      isArchived={archivedIds.includes(s.id)}
                      isUnread={unreadIds.includes(s.id)}
                      title={customTitles[s.id] || s.title}
                      t={t}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
          {groups.today.length > 0 && (
            <div classname="">
              <span className="stylist-sidebar-label">
                {t('stylist.today', { defaultValue: 'Today' }).toUpperCase()}
              </span>
              <div className="stylist-sidebar-list">
                {groups.today.map((s) => (
                  <SessionRow
                    key={s.id}
                    session={s}
                    isActive={s.id === activeId}
                    onSelect={onSelect}
                    onDelete={onDelete}
                    onTogglePin={togglePin}
                    onToggleArchive={toggleArchive}
                    onToggleUnread={toggleUnread}
                    onRename={renameSession}
                    isPinned={pinnedIds.includes(s.id)}
                    isArchived={archivedIds.includes(s.id)}
                    isUnread={unreadIds.includes(s.id)}
                    title={customTitles[s.id] || s.title}
                    t={t}
                  />
                ))}
              </div>
            </div>
          )}
          {groups.yesterday.length > 0 && (
            <div classname="">
              <span className="stylist-sidebar-label">
                {t('stylist.yesterday', { defaultValue: 'Yesterday' }).toUpperCase()}
              </span>
              <div className="stylist-sidebar-list">
                {groups.yesterday.map((s) => (
                  <SessionRow
                    key={s.id}
                    session={s}
                    isActive={s.id === activeId}
                    onSelect={onSelect}
                    onDelete={onDelete}
                    onTogglePin={togglePin}
                    onToggleArchive={toggleArchive}
                    onToggleUnread={toggleUnread}
                    onRename={renameSession}
                    isPinned={pinnedIds.includes(s.id)}
                    isArchived={archivedIds.includes(s.id)}
                    isUnread={unreadIds.includes(s.id)}
                    title={customTitles[s.id] || s.title}
                    t={t}
                  />
                ))}
              </div>
            </div>
          )}
          {groups.earlier.length > 0 && (
            <div classname="">
              <span className="stylist-sidebar-label">
                {t('stylist.earlier', { defaultValue: 'Earlier' }).toUpperCase()}
              </span>
              <div className="stylist-sidebar-list">
                {groups.earlier.map((s) => (
                  <SessionRow
                    key={s.id}
                    session={s}
                    isActive={s.id === activeId}
                    onSelect={onSelect}
                    onDelete={onDelete}
                    onTogglePin={togglePin}
                    onToggleArchive={toggleArchive}
                    onToggleUnread={toggleUnread}
                    onRename={renameSession}
                    isPinned={pinnedIds.includes(s.id)}
                    isArchived={archivedIds.includes(s.id)}
                    isUnread={unreadIds.includes(s.id)}
                    title={customTitles[s.id] || s.title}
                    t={t}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}