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
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'relative rounded-[12px] bg-white p-2.5 cursor-pointer transition-all duration-400 ease-out w-full',
        isActive ? 'bg-[var(--primary-shadow)]' : '',
      )}
      onClick={() => onSelect(session.id)}
      data-testid={`stylist-session-row-${session.id}`}
    >
      <div className="flex items-start gap-2 min-w-0 pr-24">
        <div className="relative mt-[3px] flex-shrink-0">
          <MessageSquare className={cn('h-3.5 w-3.5 text-[var(--text-color)]', isUnread && '!text-[var(--primary-color)]')} />
          {isUnread && (
            <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-[var(--primary-color)]" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className={cn(
            'text-[13.5px] font-semibold text-[var(--dark-color)] whitespace-nowrap overflow-hidden text-ellipsis',
            isUnread && '!font-extrabold',
          )}>
            {displayTitle}
          </div>
          {snippet ? (
            <div className="text-[11px] text-[var(--text-color)] whitespace-nowrap overflow-hidden text-ellipsis mt-0.5">{snippet}</div>
          ) : null}
        </div>
      </div>
      <div
        className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5 z-[2]"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="h-6 w-6 rounded-full flex items-center justify-center text-[var(--text-color)] bg-transparent border-none transition-all duration-400 hover:text-black"
              aria-label={t('stylist.moreActions', { defaultValue: 'More actions' })}
            >
              <MoreVertical className="h-3.5 w-3.5" />
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
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => { if (window.confirm(t('stylist.deleteConfirm'))) onDelete(session.id); }}
            >
              <Trash2 className="h-4 w-4" />
              {t('stylist.delete', { defaultValue: 'Delete' })}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <button
          type="button"
          onClick={() => onTogglePin(session.id)}
          className={cn(
            'h-6 w-6 rounded-full flex items-center justify-center text-[var(--text-color)] bg-transparent border-none transition-all duration-400 hover:text-black',
            isPinned && '!text-[var(--primary-color)]',
          )}
          title={isPinned ? t('stylist.unpin', { defaultValue: 'Unpin' }) : t('stylist.pin', { defaultValue: 'Pin' })}
        >
          <Pin className={cn('h-3.5 w-3.5', isPinned && '[&]:fill-current')} />
        </button>
        <button
          type="button"
          onClick={() => onToggleArchive(session.id)}
          className="h-6 w-6 rounded-full flex items-center justify-center text-[var(--text-color)] bg-transparent border-none transition-all duration-400 hover:text-black"
          title={isArchived ? t('stylist.unarchive', { defaultValue: 'Unarchive' }) : t('stylist.archive', { defaultValue: 'Archive' })}
        >
          {isArchived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
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
    <div className="flex flex-col p-5 h-full w-full gap-2">
      <div className="">
        <Button onClick={onNew} className="w-full h-11 !rounded-full !bg-[var(--primary-color)] !text-white !text-sm !font-bold shadow-[0_10px_22px_rgba(31,92,69,0.3)] transition-all hover:!bg-[var(--primary-hover)] hover:-translate-y-px">
          <i className="fa-solid fa-plus"></i>{t('stylist.newConversation')}
        </Button>
      </div>
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-5 w-5 text-[var(--text-color)] animate-spin" />
        </div>
      ) : empty ? (
        <div className="flex-1 flex flex-col items-center justify-center p-4 text-center text-xs text-black/60 border border-dashed border-black/[0.12] rounded-2xl m-3">
          <MessageSquare className="h-6 w-6 mb-2 opacity-40 text-[var(--text-color)]" />
          <div>{t('stylist.noConversations', { defaultValue: 'No conversations yet' })}</div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {pinnedSessions.length > 0 && (
            <div className="">
              <span className="block text-[10px] font-extrabold tracking-[0.12em] uppercase text-[var(--primary-color)] mb-2">
                {t('stylist.pinned', { defaultValue: 'Pinned' }).toUpperCase()}
              </span>
              <div className="flex flex-col gap-2.5">
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
            <div className="">
              <Button variant="ghost" size="sm" onClick={() => setShowArchived(!showArchived)} className="w-full flex items-center justify-between text-sm text-[var(--text-color)] rounded-[10px] !p-0 hover:text-[var(--dark-color)]  !transition-none !duration-0 hover:!translate-y-0 hover:!transform-none">
                <span>{t('stylist.archivedChats', { defaultValue: 'Archived Chats' })} ({archivedSessions.length})</span>
                <span className="text-[10px]">{showArchived ? 'Hide' : 'Show'}</span>
              </Button>
              {showArchived && (
                <div className="flex flex-col gap-2.5 mt-2">
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
            <div className="">
              <span className="block text-[10px] font-extrabold tracking-[0.12em] uppercase text-[var(--primary-color)] mb-2">
                {t('stylist.today', { defaultValue: 'Today' }).toUpperCase()}
              </span>
              <div className="flex flex-col gap-2.5">
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
            <div className="">
              <span className="block text-[10px] font-extrabold tracking-[0.12em] uppercase text-[var(--primary-color)] mb-2">
                {t('stylist.yesterday', { defaultValue: 'Yesterday' }).toUpperCase()}
              </span>
              <div className="flex flex-col gap-2.5">
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
            <div className="">
              <span className="block text-[10px] font-extrabold tracking-[0.12em] uppercase text-[var(--primary-color)] mb-2">
                {t('stylist.earlier', { defaultValue: 'Earlier' }).toUpperCase()}
              </span>
              <div className="flex flex-col gap-2.5">
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