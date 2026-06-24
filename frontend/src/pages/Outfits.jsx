import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExploreBackButton } from '@/components/ExploreBackButton';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Trash2, 
  Calendar, 
  MapPin, 
  Sparkles, 
  Bell, 
  RefreshCw, 
  AlertCircle, 
  ChevronLeft, 
  ChevronRight, 
  X, 
  GripVertical 
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import AvatarViewer from '@/components/AvatarViewer';
import { labelForRole, labelForDressCode } from '@/lib/taxonomy';
import { cn } from '@/lib/utils';
import { OutfitRecommendationCard } from '@/components/stylist/OutfitRecommendationCard';
import { ItemFloater } from '@/components/stylist/ItemFloater';

const getLocalizedNotification = (n, t) => {
  if (!n) return { title: '', body: '' };
  let title = n.title || '';
  let body = n.body || '';

  // 1. Check if Daily Proposal Title: "Tomorrow's Outfit Proposal is Ready! 👕"
  const dailyTitleRegex = /^Tomorrow's Outfit Proposal is Ready!\s*(.+)?$/i;
  const matchDailyTitle = title.match(dailyTitleRegex);
  if (matchDailyTitle) {
    const emoji = matchDailyTitle[1] || '👕';
    title = t('outfits.notification.dailyTitle', { emoji, defaultValue: title });
  }

  // 2. Check if Daily Proposal Body: "Your AI Stylist prepared 3 outfit options for your: <style>."
  const dailyBodyRegex = /^Your AI Stylist prepared(?:\s+\d+)?\s+outfit options for your:\s*(.+?)\.?$/i;
  const matchDailyBody = body.match(dailyBodyRegex);
  if (matchDailyBody) {
    const style = matchDailyBody[1] || 'day';
    const translatedStyle = labelForDressCode(style.toLowerCase().trim(), t);
    body = t('outfits.notification.dailyBody', { style: translatedStyle, defaultValue: body });
  }

  // 3. Check if multi-line proposals list format: "Proposals for <style>:\n• Outfit: ..."
  if (body.includes('\n')) {
    const lines = body.split('\n');
    const proposalsTitleRegex = /^Proposals for\s+(.+?)\s*:\s*$/i;
    const matchProposalsTitle = lines[0].match(proposalsTitleRegex);
    if (matchProposalsTitle) {
      const style = matchProposalsTitle[1] || 'day';
      const translatedStyle = labelForDressCode(style.toLowerCase().trim(), t);
      const headerText = t('outfits.notification.proposalsTitle', { style: translatedStyle, defaultValue: `Proposals for ${translatedStyle}:` });
      
      const translatedLines = lines.slice(1).map(line => {
        const outfitLineRegex = /^(\s*•\s*)(Outfit(?:\s+\d+)?)(\s*:\s*)(.+)$/i;
        const matchLine = line.match(outfitLineRegex);
        if (matchLine) {
          const bullet = matchLine[1];
          const outfitWord = matchLine[2]; // e.g. "Outfit" or "Outfit 1"
          const colon = matchLine[3];
          const details = matchLine[4];
          
          let translatedOutfitWord = outfitWord;
          if (outfitWord.toLowerCase().startsWith('outfit')) {
            const numPart = outfitWord.substring(6); // e.g. " 1" or ""
            const baseTranslated = t('outfits.outfit', { defaultValue: 'Outfit' });
            translatedOutfitWord = `${baseTranslated}${numPart}`;
          }
          return `${bullet}${translatedOutfitWord}${colon}${details}`;
        }
        return line;
      });
      body = [headerText, ...translatedLines].join('\n');
    }
  }

  // 4. Check if Event Title: "Get ready for: <event_name> 🌟"
  const eventTitleRegex = /^Get ready for:\s*(.+?)\s*(🌟)?$/i;
  const matchEventTitle = title.match(eventTitleRegex);
  if (matchEventTitle) {
    const name = matchEventTitle[1] || 'Special Event';
    title = t('outfits.notification.eventTitle', { name, defaultValue: title });
  }

  // 5. Check if Event Body: "Your chosen outfit is prepared. Have a wonderful time!"
  const eventBodyRegex = /^Your chosen outfit is prepared\.\s*Have a wonderful time!/i;
  if (eventBodyRegex.test(body)) {
    body = t('outfits.notification.eventBody', { defaultValue: body });
  }

  return { title, body };
};

const parseNotificationBodyToPayload = (body) => {
  if (!body || !body.includes('\n')) return null;
  const lines = body.split('\n');
  const outfitLines = lines.filter(line => line.trim().startsWith('•'));
  if (outfitLines.length === 0) return null;

  const outfit_recommendations = outfitLines.map((line, index) => {
    const parts = line.replace(/^\s*•\s*/, '').split(':');
    const name = parts[0]?.trim() || `Outfit ${index + 1}`;
    const itemsText = parts.slice(1).join(':').trim();
    const items = itemsText.split(',').map(item => {
      const desc = item.trim();
      let role = 'top';
      const dLower = desc.toLowerCase();
      if (dLower.includes('shoe') || dLower.includes('sneaker') || dLower.includes('boot') || dLower.includes('heel') || dLower.includes('loafer') || dLower.includes('sandal')) {
        role = 'shoes';
      } else if (dLower.includes('pant') || dLower.includes('trouser') || dLower.includes('jean') || dLower.includes('short') || dLower.includes('skirt')) {
        role = 'bottom';
      } else if (dLower.includes('dress') || dLower.includes('gown')) {
        role = 'dress';
      } else if (dLower.includes('jacket') || dLower.includes('coat') || dLower.includes('blazer') || dLower.includes('sweater') || dLower.includes('hoodie')) {
        role = 'outerwear';
      } else if (dLower.includes('bag') || dLower.includes('backpack') || dLower.includes('purse')) {
        role = 'bag';
      } else if (dLower.includes('hat') || dLower.includes('cap') || dLower.includes('beanie')) {
        role = 'headwear';
      }
      return {
        role,
        description: desc,
        closet_item_id: null
      };
    });

    return {
      name,
      items,
      why: 'Scheduled recommendation from your AI Stylist.',
      confidence: 0.8
    };
  });

  return {
    reasoning_summary: lines[0] || 'Your scheduled proposals.',
    outfit_recommendations
  };
};

const formatWeekday = (date, t) => {
  const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const key = `calendar.days.${days[date.getDay()]}`;
  const defaults = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return t(key, { defaultValue: defaults[date.getDay()] }).toUpperCase();
};

const formatMonthDay = (date, t) => {
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const monthKey = `calendar.months.${months[date.getMonth()]}`;
  const monthDefaults = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthStr = t(monthKey, { defaultValue: monthDefaults[date.getMonth()] });
  return `${monthStr} ${date.getDate()}`;
};

const getOutfitPiecesMap = (o) => {
  const map = {};
  if (Array.isArray(o?.garments)) {
    o.garments.forEach((g) => {
      if (g && g.role) {
        map[g.role] = { image_url: g.image_url };
      }
    });
  }
  return map;
};

export default function Outfits() {
  const { t } = useTranslation();
  const { user } = useAuth();
  
  const [outfits, setOutfits] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notifLoading, setNotifLoading] = useState(false);
  const [activeNotifContext, setActiveNotifContext] = useState(null);
  const [floaterItemId, setFloaterItemId] = useState(null);
  const [notifModalLoading, setNotifModalLoading] = useState(false);

  // Calendar view states
  const [calendarStartDate, setCalendarStartDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [dragOverDay, setDragOverDay] = useState(null);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.listSavedOutfits();
      setOutfits(res.outfits || []);
      await loadNotifications();
    } catch (err) {
      toast.error(t('outfits.failedLoadOutfits', { defaultValue: 'Failed to load saved outfits.' }));
    } finally {
      setLoading(false);
    }
  };

  const loadNotifications = async () => {
    setNotifLoading(true);
    try {
      const res = await api.listSimulatedNotifications();
      setNotifications(res.notifications || []);
    } catch (err) {
      console.debug("Failed to load notifications:", err);
    } finally {
      setNotifLoading(false);
    }
  };

  const deleteOutfit = async (id) => {
    try {
      await api.deleteSavedOutfit(id);
      setOutfits((prev) => prev.filter((o) => o.id !== id));
      toast.success(t('outfits.removedSuccess', { defaultValue: 'Outfit removed from your diary.' }));
    } catch (err) {
      toast.error(t('outfits.failedDelete', { defaultValue: 'Failed to delete outfit.' }));
    }
  };

  const clearNotifications = async () => {
    try {
      await api.clearSimulatedNotifications();
      setNotifications([]);
      setActiveNotifContext(null);
      toast.success(t('outfits.logsCleared', { defaultValue: 'Notification logs cleared.' }));
    } catch (err) {
      toast.error(t('outfits.failedClearLogs', { defaultValue: 'Failed to clear logs.' }));
    }
  };

  const handleSaveOutfit = async (rec, notification) => {
    const isEvent = (notification?.title || '').toLowerCase().includes('get ready');
    
    const body = {
      name: rec.name,
      source_workflow: isEvent ? 'event' : 'scheduled',
      prompt: isEvent ? 'Event' : (user?.scheduler_settings?.style_dress_for || 'casual'),
      garments: (rec.items || []).map((it) => ({
        closet_item_id: it.closet_item_id,
        role: it.role,
        title: it.description,
      })),
      usage: {
        date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        time: user?.scheduler_settings?.time || '08:00',
        location: null,
        event_name: null,
      },
    };

    try {
      await api.saveOutfit(body);
      toast.success(t('stylist.outfitSaved', { defaultValue: 'Outfit saved to your diary!' }));
      const res = await api.listSavedOutfits();
      setOutfits(res.outfits || []);
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('stylist.saveFailed', { defaultValue: 'Failed to save outfit.' }));
    }
  };

  const handleNotificationClick = async (n) => {
    let payload = n.payload || parseNotificationBodyToPayload(n.body);
    
    // Check if we need to generate proposals dynamically on-demand
    if (!payload && (n.title || '').toLowerCase().includes('proposal is ready')) {
      setActiveNotifContext({ ...n, payload: { outfit_recommendations: [] } });
      setNotifModalLoading(true);
      try {
        const res = await api.triggerScheduledProposal();
        const updatedPayload = res.advice;
        setNotifications((prev) => prev.map((item) => (item.id === n.id ? { ...item, payload: updatedPayload } : item)));
        setActiveNotifContext((current) => current && current.id === n.id ? { ...current, payload: updatedPayload } : current);
      } catch (err) {
        toast.error(t('outfits.failedGenerateProposals', { defaultValue: 'Failed to generate recommendations.' }));
        setActiveNotifContext(null);
      } finally {
        setNotifModalLoading(false);
      }
      return;
    }
    
    if (payload) {
      setActiveNotifContext({ ...n, payload });
    } else {
      toast.error(t('outfits.noProposalsAvailable', { defaultValue: 'No outfit recommendations available for this notification.' }));
    }
  };

  // Drag-and-drop & Rescheduling
  const handleDropOnDay = async (e, dateStr) => {
    e.preventDefault();
    setDragOverDay(null);
    const dataStr = e.dataTransfer.getData('text/plain');
    if (!dataStr) return;
    try {
      const data = JSON.parse(dataStr);
      if (data.type === 'saved') {
        await handleMoveOutfit(data.id, dateStr);
      } else if (data.type === 'recommended') {
        await handleSaveOutfitToDate(data.notifId, data.recIndex, dateStr);
      }
    } catch (err) {
      console.error("Failed to process drop:", err);
    }
  };

  const handleMoveOutfit = async (id, targetDate) => {
    try {
      await api.updateSavedOutfit(id, { usage: { date: targetDate } });
      toast.success(t('outfits.rescheduledSuccess', { defaultValue: 'Outfit rescheduled!' }));
      const res = await api.listSavedOutfits();
      setOutfits(res.outfits || []);
    } catch (err) {
      toast.error(t('outfits.failedReschedule', { defaultValue: 'Failed to reschedule outfit.' }));
    }
  };

  const handleSaveOutfitToDate = async (notifId, recIndex, targetDate) => {
    const notif = notifications.find(n => n.id === notifId);
    const rec = notif?.payload?.outfit_recommendations?.[recIndex];
    if (!rec) return;
    
    const isEvent = (notif?.title || '').toLowerCase().includes('get ready');
    
    const body = {
      name: rec.name,
      source_workflow: isEvent ? 'event' : 'scheduled',
      prompt: isEvent ? 'Event' : (user?.scheduler_settings?.style_dress_for || 'casual'),
      garments: (rec.items || []).map((it) => ({
        closet_item_id: it.closet_item_id,
        role: it.role,
        title: it.description,
      })),
      usage: {
        date: targetDate,
        time: user?.scheduler_settings?.time || '08:00',
        location: null,
        event_name: null,
      },
    };

    try {
      await api.saveOutfit(body);
      toast.success(t('stylist.outfitSaved', { defaultValue: 'Outfit saved and scheduled!' }));
      const res = await api.listSavedOutfits();
      setOutfits(res.outfits || []);
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('stylist.saveFailed', { defaultValue: 'Failed to save outfit.' }));
    }
  };

  const handleUnscheduleOutfit = async (id) => {
    try {
      await api.updateSavedOutfit(id, { usage: { date: '' } });
      toast.success(t('outfits.unscheduledSuccess', { defaultValue: 'Outfit removed from calendar.' }));
      const res = await api.listSavedOutfits();
      setOutfits(res.outfits || []);
    } catch (err) {
      toast.error(t('outfits.failedUnschedule', { defaultValue: 'Failed to unschedule outfit.' }));
    }
  };

  const handlePrevDay = () => {
    setCalendarStartDate((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() - 1);
      return next;
    });
  };

  const handleNextDay = () => {
    setCalendarStartDate((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + 1);
      return next;
    });
  };

  const handleJumpToToday = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    setCalendarStartDate(today);
  };

  return (
    <div className="container-px max-w-6xl mx-auto pt-6 md:pt-10 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
        <div>
          <div className="caps-label text-muted-foreground">{t('components.outfitCanvas.outfit_canvas', { defaultValue: 'My Wardrobe Diary' })}</div>
          <h1 className="font-display text-3xl sm:text-4xl mt-1">{t('components.outfitCanvas.outfit_canvas', { defaultValue: 'Saved Outfits' })}</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-xl">
            {t('outfits.viewDescription', { defaultValue: 'View outfits you have composed and scheduled. Your AI Stylist ensures you utilize all closet assets and warns you of previous occasion repetitions.' })}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} className="rounded-xl flex items-center gap-1.5 self-start sm:self-auto">
          <RefreshCw className="h-4 w-4" /> {t('stylist.refreshScout', { defaultValue: 'Refresh' })}
        </Button>
      </div>

      {/* Visual 7-Day Outfit Calendar */}
      <Card className="border border-border/80 rounded-2xl shadow-editorial mb-8 overflow-hidden bg-card">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-[hsl(var(--accent))]" />
              <h3 className="font-display text-lg font-medium">{t('calendar.title', { defaultValue: '7-Day Outfit Calendar' })}</h3>
            </div>
            <div className="flex items-center gap-2">
              <Button size="xs" variant="outline" className="rounded-lg h-8 text-xs font-semibold px-3" onClick={handleJumpToToday}>
                {t('calendar.todayBtn', { defaultValue: 'Today' })}
              </Button>
              <div className="flex items-center border border-border rounded-lg overflow-hidden h-8">
                <Button size="icon" variant="ghost" className="h-full w-8 rounded-none border-r border-border" onClick={handlePrevDay} aria-label="Previous day">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-full w-8 rounded-none" onClick={handleNextDay} aria-label="Next day">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
            {Array.from({ length: 7 }).map((_, idx) => {
              const day = new Date(calendarStartDate);
              day.setDate(day.getDate() + idx);
              const dayStr = day.toISOString().split('T')[0];
              
              // Check if today
              const today = new Date();
              const isToday = today.toISOString().split('T')[0] === dayStr;
              
              // Find outfit scheduled for this day
              const dayOutfit = outfits.find(o => o.usage?.date === dayStr);
              
              return (
                <div
                  key={dayStr}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverDay(dayStr);
                  }}
                  onDragLeave={() => setDragOverDay(null)}
                  onDrop={(e) => handleDropOnDay(e, dayStr)}
                  className={cn(
                    "flex-1 min-w-[130px] max-w-[160px] rounded-2xl border p-3 flex flex-col items-center justify-between text-center transition-all duration-300 bg-card select-none",
                    isToday ? "border-[hsl(var(--accent))] shadow-sm" : "border-border/60",
                    dragOverDay === dayStr ? "border-[hsl(var(--accent))] bg-[hsl(var(--accent))]/15 scale-[1.03]" : ""
                  )}
                >
                  <div className="space-y-0.5">
                    <div className={cn("text-[9px] caps-label tracking-wider", isToday ? "text-[hsl(var(--accent))] font-bold" : "text-muted-foreground")}>
                      {isToday ? t('calendar.todayLabel', { defaultValue: 'TODAY' }) : formatWeekday(day, t)}
                    </div>
                    <div className="text-xs font-semibold font-display">
                      {formatMonthDay(day, t)}
                    </div>
                  </div>

                  <div className="w-full aspect-[4/5] mt-3 rounded-xl overflow-hidden relative group/slot flex items-center justify-center bg-secondary/5 border border-dashed border-border/80">
                    {dayOutfit ? (
                      <>
                        <div className="absolute inset-0 scale-[0.9]">
                          <AvatarViewer
                            shapeParams={user?.avatar_shape_params || {}}
                            sex={user?.sex || 'female'}
                            outfitItems={getOutfitPiecesMap(dayOutfit)}
                          />
                        </div>
                        <div className="absolute inset-0 bg-background/90 opacity-0 group-hover/slot:opacity-100 transition-opacity flex flex-col items-center justify-center p-2 gap-1.5 text-center">
                          <div className="text-[10px] font-semibold truncate w-full px-1">{dayOutfit.name}</div>
                          <Button
                            size="xs"
                            variant="destructive"
                            onClick={() => handleUnscheduleOutfit(dayOutfit.id)}
                            className="h-6 px-2 rounded-lg text-[9px] flex items-center gap-1 font-semibold"
                          >
                            <Trash2 className="h-3 w-3" /> {t('calendar.unschedule', { defaultValue: 'Remove' })}
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div className="text-[9px] text-muted-foreground/60 p-2 flex flex-col items-center justify-center gap-1.5">
                        <Calendar className="h-4 w-4 opacity-50" />
                        <span>{t('calendar.dragHere', { defaultValue: 'Drop Outfit' })}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Active Recommendations Shelf */}
      {activeNotifContext && (
        <Card className="border border-[hsl(var(--accent))]/20 rounded-2xl shadow-editorial mb-8 overflow-hidden bg-[hsl(var(--accent))]/5 animate-[slideDown_0.2s_ease-out]">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-[hsl(var(--accent))]" />
                <h3 className="font-display text-lg font-medium">
                  {t('calendar.recommendationsShelf', { defaultValue: 'Recommended Outfits' })}: {getLocalizedNotification(activeNotifContext, t).title}
                </h3>
              </div>
              <Button size="icon" variant="ghost" className="h-8 w-8 rounded-xl animate-none" onClick={() => setActiveNotifContext(null)} aria-label="Close shelf">
                <X className="h-4 w-4" />
              </Button>
            </div>

            {notifModalLoading ? (
              <div className="flex flex-col items-center justify-center py-8 space-y-3">
                <RefreshCw className="h-6 w-6 animate-spin text-[hsl(var(--accent))]" />
                <p className="text-xs text-muted-foreground animate-pulse">
                  {t('outfits.generatingProposals', { defaultValue: 'Generating outfit recommendations from your closet...' })}
                </p>
              </div>
            ) : (activeNotifContext?.payload?.outfit_recommendations && Array.isArray(activeNotifContext.payload.outfit_recommendations) && activeNotifContext.payload.outfit_recommendations.filter(Boolean).length > 0) ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {activeNotifContext.payload.outfit_recommendations.filter(Boolean).map((rec, i) => (
                  <div key={i} className="relative group">
                    <div className="absolute top-2 left-2 z-10 bg-background/95 backdrop-blur rounded-lg p-1.5 flex items-center gap-1.5 shadow-sm border border-border/80 text-[8px] text-muted-foreground font-semibold pointer-events-none opacity-80 group-hover:opacity-100 transition-opacity">
                      <GripVertical className="h-3 w-3" />
                      <span>{t('calendar.dragToSchedule', { defaultValue: 'DRAG ME' })}</span>
                    </div>
                    <OutfitRecommendationCard
                      rec={rec}
                      index={i}
                      sessionId={null}
                      onItemClick={(itemId) => setFloaterItemId(itemId)}
                      onSave={(r) => handleSaveOutfit(r, activeNotifContext)}
                      draggable={true}
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', JSON.stringify({
                          type: 'recommended',
                          notifId: activeNotifContext.id,
                          recIndex: i
                        }));
                      }}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                {t('outfits.noRecommendationsPayload', { defaultValue: 'No structured recommendations available for this notification.' })}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Simulated Notification Logs Box */}
      <Card className="border border-border/80 rounded-2xl shadow-editorial mb-8 overflow-hidden bg-[hsl(var(--accent))]/5">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-[hsl(var(--accent))]" />
              <h3 className="font-display text-lg font-medium">{t('outfits.notificationCenter', { defaultValue: 'Notification Center' })}</h3>
            </div>
            {notifications.length > 0 && (
              <Button size="xs" variant="ghost" className="text-rose-700 text-xs h-7 px-2" onClick={clearNotifications}>
                {t('common.clear', { defaultValue: 'Clear logs' })}
              </Button>
            )}
          </div>
          
          {notifLoading ? (
            <p className="text-xs text-muted-foreground animate-pulse">{t('common.loading', { defaultValue: 'Loading mock push notifications...' })}</p>
          ) : notifications.length === 0 ? (
            <div className="text-xs text-muted-foreground flex items-center gap-2 p-3 bg-card/40 rounded-xl border border-dashed border-border/60">
              <AlertCircle className="h-4 w-4 opacity-75" />
              <span>{t('outfits.noNotifs', { defaultValue: 'No notifications triggered yet. Set your daily reminder in settings or schedule an event to test.' })}</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[180px] overflow-y-auto pr-1">
              {notifications.map((n) => {
                const { title, body } = getLocalizedNotification(n, t);
                const isActive = activeNotifContext?.id === n.id;
                return (
                  <div
                    key={n.id}
                    className={cn(
                      "p-3 rounded-xl border flex items-start gap-2.5 shadow-sm text-xs transition-colors cursor-pointer hover:bg-muted/30 bg-card",
                      isActive ? "border-[hsl(var(--accent))] bg-[hsl(var(--accent))]/5" : "border-border"
                    )}
                    onClick={() => handleNotificationClick(n)}
                  >
                    <div className="p-1 bg-[hsl(var(--accent))]/10 text-[hsl(var(--accent))] rounded-lg shrink-0">
                      <Bell className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-foreground truncate">{title}</div>
                      <div className="text-muted-foreground mt-0.5 leading-relaxed">{body}</div>
                      <div className="text-[10px] text-muted-foreground/60 mt-1.5">
                        {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Outfits Gallery Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-[600px] rounded-2xl shimmer border border-border" />
          ))}
        </div>
      ) : outfits.length === 0 ? (
        <Card className="rounded-2xl border border-dashed border-border py-16 text-center">
          <CardContent className="space-y-4">
            <Sparkles className="h-12 w-12 text-muted-foreground/60 mx-auto" />
            <h2 className="font-display text-xl">{t('common.noResults', { defaultValue: 'No outfits saved yet' })}</h2>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              {t('outfits.noSavedOutfitsDesc', { defaultValue: 'Get outfit proposals in the AI Stylist tab, pick your favorite, and save it to start logging your outfits.' })}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {outfits.map((o) => {
            const outfitItemsMap = {};
            if (Array.isArray(o?.garments)) {
              o.garments.forEach((g) => {
                if (g && g.role) {
                  outfitItemsMap[g.role] = { image_url: g.image_url };
                }
              });
            }

            const canvasContent = (
              <div className="relative w-full aspect-[4/5] bg-secondary/10 shrink-0">
                <AvatarViewer shapeParams={user?.avatar_shape_params || {}} sex={user?.sex || 'female'} outfitItems={outfitItemsMap} />
                <Badge className="absolute top-3 left-3 rounded-full caps-label bg-background/90 text-foreground border border-border backdrop-blur">
                  {o.source_workflow === 'scheduled' ? t('ads.schedule.title', { defaultValue: 'Scheduled Preset' }) : t('stylist.occasion', { defaultValue: 'Special Event' })}
                </Badge>
                <Button
                  size="icon"
                  variant="destructive"
                  onClick={() => deleteOutfit(o.id)}
                  className="absolute top-3 right-3 rounded-xl h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label={t('common.delete', { defaultValue: 'Delete' })}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );

            return (
              <Card 
                key={o.id} 
                draggable="true"
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'saved', id: o.id }));
                }}
                className="rounded-2xl border border-border bg-card shadow-editorial overflow-hidden flex flex-col group hover:shadow-lg transition-shadow cursor-grab active:cursor-grabbing select-none"
              >
                {canvasContent}

                <CardContent className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <h3 className="font-display text-lg font-semibold truncate text-foreground">
                      {(o.name || '').toLowerCase() === 'the look' ? t('components.outfitCanvas.the_look', { defaultValue: o.name }) : o.name}
                    </h3>
                    {o.prompt && (
                      <p className="text-xs text-muted-foreground line-clamp-2 italic">
                        "{o.prompt}"
                      </p>
                    )}
                  </div>

                  <Separator />

                  <div className="space-y-2.5 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 shrink-0 text-muted-foreground/75" />
                      <span>
                        {o?.usage?.date || t('calendar.unscheduled', { defaultValue: 'Not scheduled' })} {o?.usage?.date && o?.usage?.time ? `· ${o.usage.time}` : ''}
                      </span>
                    </div>
                    {o?.usage?.location && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 shrink-0 text-muted-foreground/75" />
                        <span className="truncate">{o.usage.location}</span>
                      </div>
                    )}
                  </div>

                  <Separator />

                  <div className="space-y-1.5">
                    <div className="caps-label text-[10px] text-muted-foreground">{t('outfits.outfitPieces', { defaultValue: 'Outfit Pieces' })}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {Array.isArray(o?.garments) && o.garments.map((g, idx) => (
                        <div
                          key={idx}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-secondary/50 border border-border/80 rounded-lg text-[10px] text-foreground/80 font-medium"
                        >
                          <span className="text-muted-foreground uppercase text-[8px] tracking-wider mr-1">{labelForRole(g.role, t)}</span>
                          <span>{g.title || g.description || t('addItem.preflight.untitled', { defaultValue: 'Garment' })}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      <ExploreBackButton />

      {/* Closet Item Detail Side Sheet */}
      <ItemFloater
        itemId={floaterItemId}
        onClose={() => setFloaterItemId(null)}
        fromOutfits
      />
    </div>
  );
}
