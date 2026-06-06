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

/**
 * Group sessions into Today / Yesterday / Earlier buckets based on
 * `last_active_at` (ISO string). Order within each bucket preserves the
 * input order (already newest-first).
 */
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
        'group relative rounded-xl border px-3 py-2 cursor-pointer transition-colors',
        isActive
          ? 'bg-[hsl(var(--accent))]/10 border-[hsl(var(--accent))]/40'
          : 'bg-card border-border hover:bg-secondary',
      )}
      onClick={() => onSelect(session.id)}
      data-testid={`stylist-session-row-${session.id}`}
    >
      <div className="flex items-start gap-2 min-w-0 pr-16">
        <div className="relative mt-1 shrink-0">
          <MessageSquare className={cn('h-3.5 w-3.5 opacity-70', isUnread && 'text-[hsl(var(--accent))]')} />
          {isUnread && (
            <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-[hsl(var(--accent))]" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div
            className={cn(
              'text-sm font-medium truncate',
              isActive ? 'text-foreground' : 'text-foreground/90',
              isUnread && 'font-bold text-foreground',
            )}
          >
            {displayTitle}
          </div>
          {snippet ? (
            <div className="text-[11px] text-muted-foreground truncate mt-0.5">
              {snippet}
            </div>
          ) : null}
        </div>
      </div>

      <div
        className={cn(
          'absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5 backdrop-blur pl-1 rounded-full py-0.5 shadow-sm border border-border/40',
          'opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150',
          isActive ? 'opacity-100 bg-[hsl(var(--background))]/95' : 'bg-card/90',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Dropdown Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="h-6 w-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              aria-label={t('stylist.moreActions', { defaultValue: 'More actions' })}
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => onToggleUnread(session.id)}>
              <MessageSquare className="h-4 w-4 me-2" />
              {isUnread ? t('stylist.markRead', { defaultValue: 'Mark As Read' }) : t('stylist.markUnread', { defaultValue: 'Mark As Unread' })}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onRename(session.id, displayTitle)}>
              <Edit2 className="h-4 w-4 me-2" />
              {t('stylist.rename', { defaultValue: 'Rename' })}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => {
                if (window.confirm(t('stylist.deleteConfirm'))) onDelete(session.id);
              }}
            >
              <Trash2 className="h-4 w-4 me-2" />
              {t('stylist.delete', { defaultValue: 'Delete' })}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Pin Action */}
        <button
          type="button"
          onClick={() => onTogglePin(session.id)}
          className={cn(
            'h-6 w-6 rounded-full flex items-center justify-center transition-colors',
            isPinned
              ? 'text-[hsl(var(--accent))] hover:bg-secondary'
              : 'text-muted-foreground hover:text-foreground hover:bg-secondary',
          )}
          title={isPinned ? t('stylist.unpin', { defaultValue: 'Unpin' }) : t('stylist.pin', { defaultValue: 'Pin' })}
        >
          <Pin className={cn('h-3.5 w-3.5', isPinned && 'fill-current')} />
        </button>

        {/* Archive Action */}
        <button
          type="button"
          onClick={() => onToggleArchive(session.id)}
          className="h-6 w-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
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

  // Client-side states mapped to localStorage for full persistence
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

  // Toggle Handlers
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

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-3 border-b border-border">
        <Button
          onClick={onNew}
          className="w-full rounded-xl h-10"
          data-testid="stylist-new-conversation-btn"
        >
          <Plus className="h-4 w-4 me-2" /> {t('stylist.newConversation')}
        </Button>
        <div className="caps-label text-muted-foreground mt-3 ps-1">
          {t('stylist.conversations')}
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-4">
          {loading ? (
            <div
              className="flex items-center gap-2 text-xs text-muted-foreground justify-center py-6"
              data-testid="stylist-sessions-loading"
            >
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            </div>
          ) : empty ? (
            <div
              className="text-center py-8 px-3"
              data-testid="stylist-sessions-empty"
            >
              <MessageSquare className="h-7 w-7 mx-auto mb-2 text-muted-foreground opacity-60" />
              <div className="text-sm font-medium">
                {t('stylist.noConversations')}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {t('stylist.startFirst')}
              </p>
            </div>
          ) : (
            <>
              {/* Pinned Section */}
              {pinnedSessions.length > 0 && (
                <div className="space-y-1">
                  <div className="caps-label text-[10px] text-muted-foreground ps-1 flex items-center gap-1 font-semibold">
                    <Pin className="h-3 w-3" />
                    {t('stylist.pinnedLabel', { defaultValue: 'Pinned' })}
                  </div>
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
                      isPinned={true}
                      isArchived={false}
                      isUnread={unreadIds.includes(s.id)}
                      title={customTitles[s.id] || s.title}
                      t={t}
                    />
                  ))}
                </div>
              )}

              {/* Regular Sections */}
              {groups.today.length > 0 && (
                <div className="space-y-1">
                  <div className="caps-label text-[10px] text-muted-foreground ps-1">
                    {t('stylist.todayLabel')}
                  </div>
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
                      isPinned={false}
                      isArchived={false}
                      isUnread={unreadIds.includes(s.id)}
                      title={customTitles[s.id] || s.title}
                      t={t}
                    />
                  ))}
                </div>
              )}
              {groups.yesterday.length > 0 && (
                <div className="space-y-1">
                  <div className="caps-label text-[10px] text-muted-foreground ps-1">
                    {t('stylist.yesterdayLabel')}
                  </div>
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
                      isPinned={false}
                      isArchived={false}
                      isUnread={unreadIds.includes(s.id)}
                      title={customTitles[s.id] || s.title}
                      t={t}
                    />
                  ))}
                </div>
              )}
              {groups.earlier.length > 0 && (
                <div className="space-y-1">
                  <div className="caps-label text-[10px] text-muted-foreground ps-1">
                    {t('stylist.earlierLabel')}
                  </div>
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
                      isPinned={false}
                      isArchived={false}
                      isUnread={unreadIds.includes(s.id)}
                      title={customTitles[s.id] || s.title}
                      t={t}
                    />
                  ))}
                </div>
              )}

              {/* Archived Collapsible Section */}
              {archivedSessions.length > 0 && (
                <div className="pt-2 border-t border-border/40 mt-4">
                  <button
                    type="button"
                    onClick={() => setShowArchived(!showArchived)}
                    className="w-full flex items-center justify-between px-1 py-1 text-[10px] caps-label text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <span className="flex items-center gap-1 font-semibold">
                      <Archive className="h-3 w-3" />
                      {t('stylist.archivedLabel', { defaultValue: 'Archived' })} ({archivedSessions.length})
                    </span>
                    <span className="text-[8px]">{showArchived ? '▼' : '▶'}</span>
                  </button>
                  {showArchived && (
                    <div className="space-y-1 mt-1">
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
                          isArchived={true}
                          isUnread={unreadIds.includes(s.id)}
                          title={customTitles[s.id] || s.title}
                          t={t}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
