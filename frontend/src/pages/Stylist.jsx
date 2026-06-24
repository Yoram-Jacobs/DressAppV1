import { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Mic,
  Image as ImgIcon,
  Send,
  CloudSun,
  Calendar as CalIcon,
  Square,
  Sparkles,
  X,
  Volume2,
  VolumeX,
  MessageSquare,
  PanelLeft,
  Plus,
  UserRound,
  TrendingUp,
  ShoppingBag,
  RefreshCw,
  Trash2,
  MapPin,
  Bell,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  GripVertical,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { WaveformAudioPlayer } from '@/components/WaveformAudioPlayer';
import { ConversationSidebar } from '@/components/stylist/ConversationSidebar';
import { OutfitCanvasMessage } from '@/components/OutfitCanvas';
import AvatarViewer from '@/components/AvatarViewer';
import { labelForRole, labelForDressCode } from '@/lib/taxonomy';

import { OutfitRecommendationCard } from '@/components/stylist/OutfitRecommendationCard';
import { ItemFloater } from '@/components/stylist/ItemFloater';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import DressMeShuffler from '@/components/stylist/DressMeShuffler';
import OutfitTinderSwiper from '@/components/stylist/OutfitTinderSwiper';
import { AttachmentPicker } from '@/components/stylist/AttachmentPicker';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { useLocation as useAppLocation } from '@/lib/location';
import {
  isSTTSupported,
  isTTSSupported,
  createRecognition,
  speak,
  cancelSpeak,
  ensureVoicesLoaded,
} from '@/lib/speech';

const base64ToUrl = (b64, mime = 'audio/mpeg') => {
  if (!b64) return null;
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const blob = new Blob([bytes], { type: mime });
  return URL.createObjectURL(blob);
};

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

export default function Stylist() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const loc = useAppLocation();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('chat');

  useEffect(() => {
    if (location.state?.tab) {
      setActiveTab(location.state.tab);
    } else {
      const params = new URLSearchParams(location.search);
      const tabParam = params.get('tab');
      if (tabParam) {
        setActiveTab(tabParam);
      }
    }
  }, [location]);

  // Conversation state
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const messagesEndRef = useRef(null);

  // Outfits, Notifications, and Calendar states
  const [outfits, setOutfits] = useState([]);
  const [outfitsLoading, setOutfitsLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [activeNotifContext, setActiveNotifContext] = useState(null);
  const [notifModalLoading, setNotifModalLoading] = useState(false);
  const [calendarStartDate, setCalendarStartDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [dragOverDay, setDragOverDay] = useState(null);

  const loadOutfitsAndNotifications = useCallback(async () => {
    setOutfitsLoading(true);
    try {
      const res = await api.listSavedOutfits();
      setOutfits(res.outfits || []);
    } catch (err) {
      console.error("Failed to load saved outfits:", err);
    } finally {
      setOutfitsLoading(false);
    }

    setNotifLoading(true);
    try {
      const res = await api.listSimulatedNotifications();
      setNotifications(res.notifications || []);
    } catch (err) {
      console.error("Failed to load notifications:", err);
    } finally {
      setNotifLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOutfitsAndNotifications();
  }, [loadOutfitsAndNotifications]);

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



  // Event Proposal Dialog state
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const todayStr = new Date().toISOString().split('T')[0];
  const [eventForm, setEventForm] = useState({
    event_name: '',
    location: '',
    prompt: '',
    date: todayStr,
    time: '19:00',
  });

  // Composer state
  const [text, setText] = useState('');
  const [imageFile, setImageFile] = useState(null);
  // Phase R: extra attachments (>1 image triggers the multi-image
  // outfit composer instead of the single-image stylist endpoint).
  const [extraImages, setExtraImages] = useState([]);
  const [includeCalendar, setIncludeCalendar] = useState(false);
  const [occasion, setOccasion] = useState('');
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [interim, setInterim] = useState('');
  const [speakingId, setSpeakingId] = useState(null);

  // Mobile drawers
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Phase S3: ItemFloater (side-sheet preview for closet items in
  // outfit recommendations). Single instance per page — any thumbnail
  // click sets this to the closet item id and the floater slides in.
  const [floaterItemId, setFloaterItemId] = useState(null);

  // Browser capabilities
  const sttSupportedRef = useRef(isSTTSupported());
  const ttsSupportedRef = useRef(isTTSSupported());

  // Server-side STT fallback
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recognitionRef = useRef(null);
  const threadRef = useRef(null);

  const userLang = (user?.preferred_language || i18n.language || 'en').split('-')[0].toLowerCase();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, busy, interim]);

  /* ---------- Load sessions + pick active ---------- */
  const loadSessions = useCallback(async () => {
    try {
      const { sessions: rows } = await api.stylistSessions();
      setSessions(rows || []);
      return rows || [];
    } catch (err) {
      console.debug('[Stylist] loadSessions failed:', err?.message || err);
      return [];
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  const loadMessagesFor = useCallback(async (sessionId) => {
    setMessagesLoading(true);
    try {
      const h = await api.stylistHistory(sessionId, 200);
      const hydrated = (h.messages || []).map((m) => ({
        id: m.id,
        role: m.role,
        transcript: m.transcript,
        payload: m.assistant_payload,
        // Phase R: hydrate the outfit canvas if this message is one
        // produced by the multi-image composer endpoint.
        outfit_canvas: m.assistant_payload?.outfit_canvas || null,
      }));
      setMessages(hydrated);
    } catch (err) {
      console.debug('[Stylist] loadMessagesFor failed:', err?.message || err);
      setMessages([]);
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const rows = await loadSessions();
      if (rows.length > 0) {
        // Newest first — list_sessions returns sorted by last_active_at desc.
        const first = rows[0];
        setActiveSessionId(first.id);
        await loadMessagesFor(first.id);
      }
      try {
        const s = await api.calendarStatus();
        setCalendarConnected(!!s?.connected);
      } catch (err) {
        // Non-fatal: calendar status is a hint UI, never required for chat.
        console.debug('[Stylist] calendarStatus failed:', err?.message || err);
      }
    })();
    if (ttsSupportedRef.current) {
      ensureVoicesLoaded().catch((err) => {
        console.debug('[Stylist] voices load failed:', err?.message || err);
      });
    }
    return () => {
      cancelSpeak();
      try {
        recognitionRef.current?.abort?.();
      } catch (err) {
        // SpeechRecognition abort throws on some browsers after it's already stopped.
        console.debug('[Stylist] recognition abort:', err?.message || err);
      }
    };
  }, [loadSessions, loadMessagesFor]);

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [messages, busy]);

  /* ---------- Session actions ---------- */
  const handleSelectSession = async (id) => {
    if (id === activeSessionId) {
      setSidebarOpen(false);
      return;
    }
    setActiveSessionId(id);
    setSidebarOpen(false);
    await loadMessagesFor(id);
  };

  const handleNewConversation = async () => {
    try {
      const fresh = await api.stylistCreateSession();
      setActiveSessionId(fresh.id);
      setMessages([]);
      setText('');
      setImageFile(null);
      setSidebarOpen(false);
      // Optimistically prepend the new session to the sidebar so the user
      // sees it immediately; the real snapshot will reconcile on next load.
      setSessions((prev) => [fresh, ...(prev || [])]);
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('stylist.errorAdvice'));
    }
  };

  const handleDeleteSession = async (id) => {
    try {
      await api.stylistDeleteSession(id);
      const remaining = sessions.filter((s) => s.id !== id);
      setSessions(remaining);
      if (id === activeSessionId) {
        if (remaining.length > 0) {
          setActiveSessionId(remaining[0].id);
          await loadMessagesFor(remaining[0].id);
        } else {
          // Auto-create a fresh empty session so the composer stays usable.
          const fresh = await api.stylistCreateSession();
          setSessions([fresh]);
          setActiveSessionId(fresh.id);
          setMessages([]);
        }
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('common.error'));
    }
  };

  /* ---------- AI Stylist Scheduler Triggers & Handlers ---------- */
  const handleTriggerScheduled = async () => {
    if (busy) return;
    setBusy(true);

    const optimisticId = `tmp-sched-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: optimisticId,
        role: 'user',
        transcript: t('stylist.triggerScheduledRequest', { defaultValue: 'Get tomorrow\'s scheduled outfit proposals' }),
      },
    ]);

    try {
      const res = await api.triggerScheduledProposal();
      const newId = `sched-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        {
          id: newId,
          role: 'assistant',
          transcript: res.advice.reasoning_summary,
          payload: {
            ...res.advice,
            source_workflow: 'scheduled',
          },
        },
      ]);
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('stylist.proposalFailed', { defaultValue: 'Failed to generate daily proposals.' }));
      setMessages((prev) => prev.filter((x) => x.id !== optimisticId));
    } finally {
      setBusy(false);
    }
  };

  const handleTriggerEvent = async (e) => {
    if (e) e.preventDefault();
    if (!eventForm.prompt.trim()) {
      toast.error(t('common.error'));
      return;
    }

    setEventModalOpen(false);
    setBusy(true);

    const eventName = eventForm.event_name || t('stylist.occasion');
    const locText = eventForm.location ? ` at ${eventForm.location}` : '';
    const dateText = eventForm.date ? ` on ${eventForm.date}` : '';
    const timeText = eventForm.time ? ` at ${eventForm.time}` : '';
    const userText = `Suggest event outfits for "${eventName}"${locText}${dateText}${timeText}. Details: "${eventForm.prompt}".`;

    const optimisticId = `tmp-event-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: optimisticId,
        role: 'user',
        transcript: userText,
      },
    ]);

    try {
      const res = await api.triggerEventProposal({
        prompt: eventForm.prompt,
        date: eventForm.date || null,
        time: eventForm.time || null,
        location: eventForm.location || null,
        event_name: eventForm.event_name || null,
      });

      const newId = `event-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        {
          id: newId,
          role: 'assistant',
          transcript: res.advice.reasoning_summary,
          payload: {
            ...res.advice,
            source_workflow: 'event',
            event_details: { ...eventForm },
          },
        },
      ]);
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('stylist.proposalFailed', { defaultValue: 'Failed to generate event proposals.' }));
      setMessages((prev) => prev.filter((x) => x.id !== optimisticId));
    } finally {
      setBusy(false);
    }
  };

  const handleSaveOutfit = async (rec, message) => {
    const isEvent = message.payload?.source_workflow === 'event';
    const eventDetails = message.payload?.event_details || {};

    const body = {
      name: rec.name,
      source_workflow: isEvent ? 'event' : 'scheduled',
      prompt: isEvent ? eventDetails.prompt : (user?.scheduler_settings?.style_dress_for || 'casual'),
      garments: (rec.items || []).map((it) => ({
        closet_item_id: it.closet_item_id,
        role: it.role,
        title: it.description,
      })),
      usage: {
        date: isEvent ? (eventDetails.date || new Date().toISOString().split('T')[0]) : new Date(Date.now() + 86400000).toISOString().split('T')[0],
        time: isEvent ? (eventDetails.time || '12:00') : (user?.scheduler_settings?.time || '08:00'),
        location: isEvent ? eventDetails.location : null,
        event_name: isEvent ? eventDetails.event_name : null,
      },
    };

    try {
      await api.saveOutfit(body);
      toast.success(t('stylist.outfitSaved', { defaultValue: 'Outfit saved to your diary!' }));
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('stylist.saveFailed', { defaultValue: 'Failed to save outfit.' }));
    }
  };

  const handleRetry = async (message) => {
    if (busy) return;

    const recs = message.payload?.outfit_recommendations || [];
    const itemIds = [];
    recs.forEach((rec) => {
      (rec.items || []).forEach((it) => {
        if (it.closet_item_id) {
          itemIds.push(it.closet_item_id);
        }
      });
    });

    const uniqueIds = [...new Set(itemIds)];

    setBusy(true);
    try {
      // Reject items
      for (const itemId of uniqueIds) {
        try {
          const res = await api.rejectItemSuggestion(itemId);
          if (res.offer_marketplace) {
            toast.warning(
              t('stylist.rejectionMarketplaceOffer', {
                defaultValue: 'You have rejected "{{title}}" 3 times. Share it in the Marketplace to free up space?',
                title: res.title
              }),
              {
                action: {
                  label: t('common.share', { defaultValue: 'Share' }),
                  onClick: () => navigate(`/market/create?item_id=${itemId}`),
                },
                duration: 8000,
              }
            );
          }
        } catch (rejErr) {
          console.debug('Failed to reject item:', itemId, rejErr);
        }
      }

      // Add user turn
      const isEvent = message.payload.source_workflow === 'event';
      const optimisticId = `tmp-retry-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        {
          id: optimisticId,
          role: 'user',
          transcript: t('stylist.retryRequest', { defaultValue: 'Suggest 3 other options' }),
        },
      ]);

      if (isEvent) {
        const eventDetails = message.payload.event_details || {};
        const res = await api.triggerEventProposal({
          prompt: eventDetails.prompt,
          date: eventDetails.date || null,
          time: eventDetails.time || null,
          location: eventDetails.location || null,
          event_name: eventDetails.event_name || null,
        });

        const newId = `event-${Date.now()}`;
        setMessages((prev) => [
          ...prev,
          {
            id: newId,
            role: 'assistant',
            transcript: res.advice.reasoning_summary,
            payload: {
              ...res.advice,
              source_workflow: 'event',
              event_details: eventDetails,
            },
          },
        ]);
      } else {
        const res = await api.triggerScheduledProposal();
        const newId = `sched-${Date.now()}`;
        setMessages((prev) => [
          ...prev,
          {
            id: newId,
            role: 'assistant',
            transcript: res.advice.reasoning_summary,
            payload: {
              ...res.advice,
              source_workflow: 'scheduled',
            },
          },
        ]);
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('stylist.proposalFailed', { defaultValue: 'Failed to generate new proposals.' }));
    } finally {
      setBusy(false);
    }
  };

  /* ---------- Native STT path (preferred) ---------- */
  const startNativeRecognition = () => {
    try {
      let finalText = '';
      const rec = createRecognition({
        lang: userLang,
        onInterim: (txt) => {
          setInterim(txt || '');
        },
        onFinal: (txt) => {
          finalText = txt || '';
        },
        onError: () => {
          setRecording(false);
          toast.error(t('stylist.voiceError'));
        },
        onEnd: () => {
          setRecording(false);
          setInterim('');
          if (finalText.trim()) {
            sendTurn({ overrideText: finalText.trim() });
          }
        },
      });
      if (!rec) return false;
      recognitionRef.current = rec;
      setInterim('');
      setRecording(true);
      rec.start();
      return true;
    } catch (err) {
      console.debug('[Stylist] startNativeRecognition failed:', err?.message || err);
      recognitionRef.current = null;
      return false;
    }
  };

  /* ---------- MediaRecorder fallback ---------- */
  const startMediaRecorder = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data?.size) audioChunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach((x) => x.stop());
        await sendTurn({ voiceBlob: blob });
      };
      mr.start();
      setRecording(true);
    } catch (err) {
      console.debug('[Stylist] startMediaRecorder failed:', err?.message || err);
      toast.error(t('stylist.micError'));
    }
  };

  const startRecording = () => {
    if (sttSupportedRef.current && startNativeRecognition()) return;
    startMediaRecorder();
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        // SpeechRecognition.stop() throws on some browsers after it's already stopped.
        console.debug('[Stylist] recognition stop:', err?.message || err);
      }
      recognitionRef.current = null;
      return;
    }
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  };

  /* ---------- Local TTS ---------- */
  const playLocalSpeech = async (id, txt) => {
    if (!txt) return;
    try {
      setSpeakingId(id);
      await speak(txt, { lang: userLang });
    } catch (err) {
      console.debug('[Stylist] playLocalSpeech failed:', err?.message || err);
    } finally {
      setSpeakingId(null);
    }
  };
  const stopLocalSpeech = () => {
    cancelSpeak();
    setSpeakingId(null);
  };

  /* ---------- Compose + send turn ---------- */
  const sendTurn = async ({ voiceBlob = null, overrideText = null } = {}) => {
    if (busy) return;
    const outgoingText = (overrideText ?? text).trim();
    // Route: 2+ images → multi-image outfit composer (Phase R).
    // The composer endpoint also auto-persists an assistant message, so
    // we don't need a parallel call to /stylist.
    const allImages = [imageFile, ...extraImages].filter(Boolean);
    const useComposer = allImages.length >= 2;
    if (useComposer) {
      const body = new FormData();
      if (outgoingText) body.append('text', outgoingText);
      body.append('language', userLang);
      if (activeSessionId) body.append('session_id', activeSessionId);
      allImages.forEach((f) => body.append('images', f, f.name || 'upload.jpg'));

      const previews = allImages.map((f) => URL.createObjectURL(f));
      const optimistic = {
        id: `tmp-${Date.now()}`,
        role: 'user',
        transcript: outgoingText || t('stylist.composeOutfitOptimistic'),
        imagePreviews: previews,
      };
      setMessages((m) => [...m, optimistic]);
      setText('');
      setImageFile(null);
      setExtraImages([]);
      setBusy(true);
      try {
        const res = await api.composeOutfit(body);
        const canvas = res?.canvas;
        const newId = `a-${Date.now()}`;
        setMessages((m) => [
          ...m,
          {
            id: newId,
            role: 'assistant',
            transcript: canvas?.summary || t('stylist.composeOutfitDone'),
            outfit_canvas: canvas,
          },
        ]);
        if (res?.session_id) setActiveSessionId(res.session_id);
      } catch (err) {
        toast.error(err?.response?.data?.detail || t('stylist.composeOutfitFailed'));
      } finally {
        setBusy(false);
      }
      return;
    }

    const body = new FormData();
    if (outgoingText) body.append('text', outgoingText);
    if (voiceBlob) body.append('voice_audio', voiceBlob, 'voice.webm');
    if (imageFile) body.append('image', imageFile);
    body.append('language', userLang);
    body.append('voice_id', user?.preferred_voice_id || 'aura-2-thalia-en');
    if (activeSessionId) body.append('session_id', activeSessionId);
    if (ttsSupportedRef.current) body.append('skip_tts', 'true');
    // Augment the turn with the device coordinates so the stylist can
    // ground weather + regional context without waiting for a background
    // call. Falls back to the user's saved home_location server-side.
    if (loc?.coords?.lat != null && loc?.coords?.lng != null) {
      body.append('lat', String(loc.coords.lat));
      body.append('lng', String(loc.coords.lng));
    }
    if (includeCalendar) {
      body.append('include_calendar', 'true');
      if (occasion) body.append('occasion', occasion);
    }

    const optimistic = {
      id: `tmp-${Date.now()}`,
      role: 'user',
      transcript: voiceBlob ? t('stylist.voiceNote') : outgoingText,
      imagePreview: imageFile ? URL.createObjectURL(imageFile) : null,
    };
    setMessages((m) => [...m, optimistic]);
    setText('');
    setImageFile(null);
    setBusy(true);
    try {
      const res = await api.stylist(body);
      const advice = res.advice;
      const audioUrl = base64ToUrl(advice.tts_audio_base64);
      const newId = `a-${Date.now()}`;
      setMessages((m) => [
        ...m,
        {
          id: newId,
          role: 'assistant',
          transcript: advice.reasoning_summary,
          payload: advice,
          audioUrl,
          spokenText: advice.spoken_reply || advice.reasoning_summary || '',
        },
      ]);
      // Update the active session meta (title + snippet + id) in the sidebar.
      if (res.session) {
        setActiveSessionId(res.session.id);
        setSessions((prev) => {
          const without = (prev || []).filter((s) => s.id !== res.session.id);
          return [res.session, ...without];
        });
      }
      if (ttsSupportedRef.current && !audioUrl) {
        const spoken = advice.spoken_reply || advice.reasoning_summary || '';
        if (spoken) playLocalSpeech(newId, spoken);
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('stylist.errorAdvice'));
      // Roll back optimistic user bubble on failure so the user can retry.
      setMessages((m) => m.filter((x) => x.id !== optimistic.id));
    } finally {
      setBusy(false);
    }
  };

  /* ---------- Render helpers ---------- */
  const chatColumn = (
    <Card className="h-full flex flex-col rounded-[calc(var(--radius)+6px)] shadow-editorial overflow-hidden">
      {/* Sticky top bar */}
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 md:px-4 py-2.5 bg-background">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => {
              if (window.innerWidth < 1024) {
                setSidebarOpen(true);
              } else {
                setSidebarCollapsed(!sidebarCollapsed);
              }
            }}
            className="h-9 w-9 rounded-lg border border-border bg-card flex items-center justify-center hover:bg-secondary transition-colors"
            aria-label={t('stylist.openConversations')}
            data-testid="stylist-open-sidebar-btn"
          >
            <PanelLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex flex-col justify-center">
            <div className="caps-label text-muted-foreground truncate">
              {t('stylist.label')}
            </div>
            <h1 className="font-display text-lg md:text-xl truncate">
              {sessions.find((s) => s.id === activeSessionId)?.title ||
                t('stylist.hero')}
            </h1>
          </div>
          <button
            type="button"
            onClick={handleNewConversation}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-border bg-card text-[11px] font-medium hover:bg-secondary transition-colors ms-2"
            data-testid="stylist-header-new-chat-btn"
          >
            <Plus className="h-3 w-3" />
            <span>{t('stylist.newConversation', { defaultValue: 'New Chat' })}</span>
          </button>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge
            variant="outline"
            className="hidden md:inline-flex caps-label rounded-full bg-card"
          >
            <CloudSun className="h-3 w-3 me-1" /> {t('stylist.weatherAware')}
          </Badge>
          {(sttSupportedRef.current || ttsSupportedRef.current) && (
            <Badge
              variant="outline"
              className="hidden md:inline-flex caps-label rounded-full bg-card"
              data-testid="stylist-native-speech-badge"
            >
              <Mic className="h-3 w-3 me-1" /> {t('stylist.nativeSpeech')}
            </Badge>
          )}

        </div>
      </div>

      <ScrollArea className="flex-1" data-testid="stylist-chat-thread">
        <div ref={threadRef} className="p-3 md:p-6 space-y-4">
          {/* CSS-fix Phase Z2.5 — outer padding eased from p-4 to p-3
              on mobile to give ~8px more horizontal room to the
              bubbles below. The desktop value (md:p-6) is unchanged. */}
          {messages.length === 0 && !busy && !messagesLoading && (
            <div className="text-center py-10">
              <Sparkles className="h-10 w-10 mx-auto mb-3 text-[hsl(var(--accent))]" />
              <p className="font-display text-xl">{t('stylist.askAnything')}</p>
              <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
                {t('stylist.askAnythingSub')}
              </p>
            </div>
          )}
          <AnimatePresence initial={false}>
            {messages.map((m) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  // ``min-w-0`` is the critical bit — by spec a flex
                  // child's ``min-width`` defaults to ``auto`` (its
                  // intrinsic content size), so a single unbreakable
                  // token (long URL, hashtag, single long word) would
                  // override the bubble's ``max-w-[85%]`` and push it
                  // past the card boundary, where the Card's
                  // ``overflow-hidden`` clips it.  Adding ``min-w-0``
                  // restores the expected "shrink to allowed width"
                  // behaviour and is what unblocks ``break-words``
                  // inside the bubble below.
                  'flex min-w-0',
                  m.role === 'user' ? 'justify-end' : 'justify-start',
                )}
                data-testid={`chat-message-${m.role}`}
              >
                <div
                  className={cn(
                    // ``break-words`` (overflow-wrap: break-word)
                    // wraps the long unbreakable tokens that
                    // ``whitespace-pre-wrap`` on the child <p> would
                    // otherwise keep on one line.  ``min-w-0`` mirrors
                    // the parent so the cascade is consistent on
                    // every nested flex level.  We do NOT add an
                    // ``overflow-hidden`` here — Tailwind's
                    // ``rounded-2xl`` clips visible overflow already
                    // via border-radius, and ``overflow-hidden``
                    // would crop the speak/share popovers that some
                    // child components anchor with absolute
                    // positioning.
                    'max-w-[85%] min-w-0 rounded-2xl border px-4 py-3 break-words',
                    m.role === 'user'
                      ? 'bg-[hsl(var(--accent))]/10 border-[hsl(var(--accent))]/30'
                      : 'bg-card border-border',
                  )}
                >
                  {m.imagePreview && (
                    <img
                      src={m.imagePreview}
                      alt="attachment"
                      className="rounded-lg mb-2 max-h-48 object-cover"
                    />
                  )}
                  {m.imagePreviews && m.imagePreviews.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2" data-testid="stylist-msg-image-grid">
                      {m.imagePreviews.map((src, i) => (
                        <img
                          key={i}
                          src={src}
                          alt=""
                          className="h-20 w-20 rounded-lg object-cover border border-border"
                        />
                      ))}
                    </div>
                  )}
                  {m.transcript && (
                    <p className="text-sm whitespace-pre-wrap">
                      {typeof m.transcript === 'string' ? m.transcript : JSON.stringify(m.transcript)}
                    </p>
                  )}
                  {m.role === 'assistant' && m.outfit_canvas && (
                    <div className="mt-3">
                      <OutfitCanvasMessage canvas={m.outfit_canvas} />
                    </div>
                  )}
                  {m.role === 'assistant' && m.payload && (
                    <div className="mt-3 space-y-3">
                      {Array.isArray(m.payload.outfit_recommendations) && (m.payload.outfit_recommendations || []).filter(Boolean).map((rec, i) => (
                        <OutfitRecommendationCard
                          key={rec.id || `${m.id || 'msg'}-rec-${i}`}
                          rec={rec}
                          index={i}
                          sessionId={activeSessionId}
                          onItemClick={setFloaterItemId}
                          onSave={(r) => handleSaveOutfit(r, m)}
                        />
                      ))}
                      {Array.isArray(m.payload.shopping_suggestions) && m.payload.shopping_suggestions.filter(Boolean).length > 0 && (
                        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 rounded-xl p-3 text-xs text-amber-800 dark:text-amber-300 space-y-1">
                          <div className="font-semibold flex items-center gap-1.5">
                            <Sparkles className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                            {t('stylist.shoppingSuggestions', { defaultValue: 'AI Stylist Shopping Suggestions' })}
                          </div>
                          <ul className="list-disc ps-4 space-y-1">
                            {m.payload.shopping_suggestions.filter(Boolean).map((s, k) => (
                              <li key={`shop-sug-${k}`}>{s}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {(m.payload.source_workflow === 'scheduled' || m.payload.source_workflow === 'event') && (
                        <div className="flex items-center gap-2 mt-3 pt-2 border-t border-border/60">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRetry(m)}
                            disabled={busy}
                            className="rounded-full text-xs gap-1.5"
                            data-testid={`retry-proposals-${m.id}`}
                          >
                            <RefreshCw className={cn("h-3 w-3", busy && "animate-spin")} />
                            {t('stylist.suggestOthers', { defaultValue: 'Suggest 3 Others' })}
                          </Button>
                        </div>
                      )}
                      {Array.isArray(m.payload.do_dont) && m.payload.do_dont.filter(Boolean).length > 0 && (
                        <div className="text-xs text-muted-foreground">
                          <div className="caps-label mb-1">
                            {t('stylist.doDont')}
                          </div>
                          <ul className="list-disc ps-5 space-y-0.5">
                            {m.payload.do_dont.filter(Boolean).map((d, k) => (
                              <li key={`${m.id || 'msg'}-dd-${k}-${String(d).slice(0, 24)}`}>{d}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {m.payload.weather_summary && (
                        <div className="caps-label text-muted-foreground">
                          {t('stylist.contextLabel')}: {m.payload.weather_summary}
                          {m.payload.calendar_summary
                            ? ` · ${m.payload.calendar_summary}`
                            : ''}
                        </div>
                      )}
                      {/* Phase S — horizon expansion enrichment */}
                      {Array.isArray(m.payload.generated_examples) && m.payload.generated_examples.filter(Boolean).length > 0 && (
                        <div className="space-y-1" data-testid="stylist-generated-examples">
                          <div className="caps-label text-muted-foreground">
                            {t('stylist.examplesLabel')}
                          </div>
                          <div className="flex gap-2 flex-wrap">
                            {m.payload.generated_examples.filter(Boolean).map((ex, k) => (
                              <figure key={`gen-${m.id}-${k}`} className="w-32">
                                <img
                                  src={ex.image_data_url}
                                  alt={ex.caption || ex.category}
                                  loading="lazy"
                                  className="w-full aspect-square rounded-lg border border-border object-cover"
                                />
                                <figcaption className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                                  {ex.caption || ex.category}
                                </figcaption>
                              </figure>
                            ))}
                          </div>
                        </div>
                      )}
                      {(() => {
                        const mktList = m.payload.marketplace_suggestions || m.payload.marketplace_matches;
                        if (!Array.isArray(mktList) || mktList.filter(Boolean).length === 0) return null;
                        return (
                          <div className="space-y-1" data-testid="stylist-marketplace-strip">
                            <div className="caps-label text-muted-foreground flex items-center gap-1">
                              <ShoppingBag className="h-3 w-3" />
                              {t('stylist.marketplaceLabel')}
                            </div>
                            <div className="flex gap-2 overflow-x-auto pb-1">
                              {mktList.filter(Boolean).map((s) => (
                                <Link
                                  key={`mkt-${m.id}-${s.listing_id}`}
                                  to={`/marketplace/${s.listing_id}`}
                                  className="block min-w-[120px] w-[120px] rounded-lg border border-border bg-card hover:border-[hsl(var(--accent))]/60"
                                >
                                  {s.image_url && (
                                    <img src={s.image_url} alt="" className="w-full aspect-square rounded-t-lg object-cover" />
                                  )}
                                  <div className="p-1.5">
                                    <div className="text-[11px] line-clamp-2 leading-tight">{s.title}</div>
                                    {s.price_cents != null && (
                                      <div className="text-[10px] text-muted-foreground mt-0.5">
                                        {s.currency === 'USD' ? '$' : s.currency === 'ILS' ? '₪' : ''}{(s.price_cents/100).toFixed(0)}
                                      </div>
                                    )}
                                  </div>
                                </Link>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                      {Array.isArray(m.payload.fashion_scout_picks) && m.payload.fashion_scout_picks.filter(Boolean).length > 0 && (
                        <div className="space-y-1" data-testid="stylist-scout-strip">
                          <div className="caps-label text-muted-foreground flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" />
                            {t('stylist.trendsLabel', { defaultValue: 'Trends' })}
                          </div>
                          <div className="flex gap-2 overflow-x-auto pb-1">
                            {m.payload.fashion_scout_picks.filter(Boolean).map((tp) => (
                              <a
                                key={`tp-${m.id}-${tp.id}`}
                                href={tp.source_url || '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block min-w-[140px] w-[140px] rounded-lg border border-border bg-card hover:border-[hsl(var(--accent))]/60"
                              >
                                {tp.image_url && (
                                  <img src={tp.image_url} alt="" className="w-full aspect-square rounded-t-lg object-cover" />
                                )}
                                <div className="p-1.5">
                                  <div className="text-[11px] line-clamp-2 leading-tight font-medium">
                                    {tp.title === 'Trend' ? t('stylist.trend', { defaultValue: 'Trend' }) : tp.title}
                                  </div>
                                  {tp.source_name && (
                                    <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{tp.source_name}</div>
                                  )}
                                </div>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                      {Array.isArray(m.payload.applied_preferences) && m.payload.applied_preferences.filter(Boolean).length > 0 && (
                        <details className="text-[11px] text-muted-foreground">
                          <summary className="cursor-pointer hover:text-foreground">
                            {t('stylist.preferencesApplied', { count: m.payload.applied_preferences.filter(Boolean).length })}
                          </summary>
                          <div className="ps-2 pt-1 leading-relaxed">
                            {m.payload.applied_preferences.filter(Boolean).join(' · ')}
                          </div>
                        </details>
                      )}
                      {m.audioUrl ? (
                        <WaveformAudioPlayer src={m.audioUrl} />
                      ) : ttsSupportedRef.current && m.spokenText ? (
                        <div className="flex items-center gap-2">
                          {speakingId === m.id ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={stopLocalSpeech}
                              className="h-8 rounded-full"
                              data-testid={`stylist-stop-speak-${m.id}`}
                            >
                              <VolumeX className="h-3.5 w-3.5 me-1" />
                              {t('stylist.stopSpeaking')}
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => playLocalSpeech(m.id, m.spokenText)}
                              className="h-8 rounded-full"
                              data-testid={`stylist-play-speak-${m.id}`}
                            >
                              <Volume2 className="h-3.5 w-3.5 me-1" />
                              {t('stylist.playReply')}
                            </Button>
                          )}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {busy && (
            <div className="flex min-w-0 justify-start" data-testid="stylist-thinking">
              <div className="max-w-[85%] min-w-[280px] rounded-2xl border border-border bg-card p-4 break-words space-y-3">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-5 rounded-full animate-pulse" />
                  <span className="caps-label text-muted-foreground">{t('stylist.thinking')}</span>
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-3.5 w-3/4 rounded" />
                  <Skeleton className="h-3.5 w-1/2 rounded" />
                  <Skeleton className="h-3.5 w-5/6 rounded" />
                </div>
                <p className="text-xs text-muted-foreground pt-1">
                  {t('stylist.thinkingSub')}
                </p>
              </div>
            </div>
          )}
          {recording && interim && (
            <div
              className="flex min-w-0 justify-end"
              data-testid="stylist-interim-transcript"
            >
              <div className="max-w-[85%] min-w-0 rounded-2xl border border-dashed border-[hsl(var(--accent))]/40 bg-[hsl(var(--accent))]/5 px-4 py-3 break-words">
                <div className="caps-label text-[hsl(var(--accent))] mb-1">
                  {t('stylist.listening')}
                </div>
                <p className="text-sm whitespace-pre-wrap italic">{interim}</p>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      <div className="border-t border-border p-3 md:p-4 space-y-3 bg-background">
        {/* Quick Scheduler Actions */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1.5 border-b border-border/40" data-testid="stylist-scheduler-actions">
          <Button
            size="xs"
            variant="outline"
            onClick={handleTriggerScheduled}
            disabled={busy}
            className="rounded-full bg-card hover:bg-secondary text-xs h-7 gap-1"
            data-testid="stylist-daily-suggestion-btn"
          >
            <Sparkles className="h-3.5 w-3.5 text-[hsl(var(--accent))]" />
            {t('stylist.dailySuggestion', { defaultValue: 'Daily Suggestion' })}
          </Button>
          <Button
            size="xs"
            variant="outline"
            onClick={() => setEventModalOpen(true)}
            disabled={busy}
            className="rounded-full bg-card hover:bg-secondary text-xs h-7 gap-1"
            data-testid="stylist-plan-event-btn"
          >
            <CalIcon className="h-3.5 w-3.5" />
            {t('stylist.planEventOutfit', { defaultValue: 'Plan Event Outfit' })}
          </Button>
        </div>

        <div className="max-w-3xl mx-auto w-full flex items-center gap-3 flex-wrap text-xs text-muted-foreground border-b border-border/40 pb-2">
          <div className="flex items-center gap-2">
            <Switch
              checked={includeCalendar}
              onCheckedChange={setIncludeCalendar}
              id="inc-cal"
              data-testid="stylist-include-calendar-switch"
            />
            <label
              htmlFor="inc-cal"
              className="text-[11px] text-muted-foreground inline-flex items-center gap-1 cursor-pointer"
            >
              <CalIcon className="h-3.5 w-3.5" /> {t('stylist.includeCalendar')}
            </label>
            {includeCalendar && calendarConnected && (
              <Badge
                variant="outline"
                className="bg-emerald-50 text-emerald-800 border-emerald-200 text-[10px] py-0 h-5"
                data-testid="stylist-calendar-live-badge"
              >
                {t('stylist.liveCalendar')}
              </Badge>
            )}
          </div>
          {includeCalendar && !calendarConnected && (
            <input
              value={occasion}
              onChange={(e) => setOccasion(e.target.value)}
              placeholder={t('stylist.occasionPlaceholder')}
              className="text-[11px] bg-secondary border border-border rounded-lg px-2 py-0.5"
              data-testid="stylist-occasion-input"
            />
          )}
          {imageFile && (
            <div
              className="flex items-center gap-1.5 rounded-full border border-border bg-card px-2 py-0.5 text-[11px]"
              data-testid="stylist-attached-image"
            >
              <img
                src={URL.createObjectURL(imageFile)}
                alt=""
                className="h-5 w-5 rounded object-cover"
              />
              <span className="truncate max-w-[120px]">{imageFile.name}</span>
              <button
                onClick={() => setImageFile(null)}
                aria-label={t('stylist.removeImage')}
                data-testid="stylist-remove-image"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
          {extraImages.map((f, idx) => (
            <div
              key={`extra-${idx}-${f.name}`}
              className="flex items-center gap-1.5 rounded-full border border-[hsl(var(--accent))]/40 bg-[hsl(var(--accent))]/5 px-2 py-0.5 text-[11px]"
              data-testid={`stylist-extra-image-${idx}`}
            >
              <img
                src={URL.createObjectURL(f)}
                alt=""
                className="h-5 w-5 rounded object-cover"
              />
              <span className="truncate max-w-[100px]">{f.name}</span>
              <button
                onClick={() =>
                  setExtraImages((prev) => prev.filter((_, i) => i !== idx))
                }
                aria-label={t('stylist.removeImage')}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          {(imageFile || extraImages.length > 0) && (imageFile ? 1 : 0) + extraImages.length >= 2 && (
            <Badge
              variant="outline"
              className="border-[hsl(var(--accent))]/60 text-[hsl(var(--accent))] text-[10px] py-0 h-5"
              data-testid="stylist-compose-mode-badge"
            >
              <Sparkles className="h-2.5 w-2.5 me-1" />
              {t('stylist.composeOutfitMode')}
            </Badge>
          )}
          <div className="ms-auto">
            <button
              type="button"
              onClick={() => {
                const q = new URLSearchParams();
                const cc = loc?.country_code;
                const city = loc?.city;
                if (cc) q.set('country', cc);
                if (city) q.set('region', city);
                const qs = q.toString();
                navigate(qs ? `/experts?${qs}` : '/experts');
              }}
              title={
                loc?.coords
                  ? t('stylist.askProfessionalLocal')
                  : t('stylist.askProfessionalSoon')
              }
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px]',
                'border border-[hsl(var(--accent))]/60 text-[hsl(var(--accent))]',
                'hover:bg-[hsl(var(--accent))]/10 transition-colors',
              )}
              data-testid="stylist-ask-professional-btn"
            >
              <UserRound className="h-3 w-3" />
              {t('stylist.askProfessional')}
            </button>
          </div>
        </div>

        <div className="max-w-3xl mx-auto w-full relative flex items-end gap-2 border border-border bg-card rounded-2xl p-1.5 focus-within:ring-2 focus-within:ring-[hsl(var(--accent))]/50 focus-within:border-[hsl(var(--accent))] transition-all">
          <AttachmentPicker
            maxItems={7}
            currentCount={(imageFile ? 1 : 0) + extraImages.length}
            onConfirm={(files) => {
              if (!files?.length) return;
              if (!imageFile) {
                setImageFile(files[0]);
                if (files.length > 1) {
                  setExtraImages((prev) =>
                    [...prev, ...files.slice(1)].slice(0, 7),
                  );
                }
              } else {
                setExtraImages((prev) =>
                  [...prev, ...files].slice(0, 7),
                );
              }
            }}
            trigger={
              <span
                className="inline-flex items-center justify-center h-9 w-9 rounded-xl border border-border bg-card hover:bg-secondary cursor-pointer shrink-0"
                aria-label={t('stylist.attachPhoto')}
                data-testid="stylist-composer-attach-button"
              >
                <ImgIcon className="h-4.5 w-4.5" />
              </span>
            }
          />

          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={1}
            placeholder={t('stylist.composerPlaceholder')}
            className="flex-1 min-h-[36px] max-h-[160px] border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent resize-none py-1.5 px-1 text-sm shadow-none"
            data-testid="stylist-composer-textarea"
          />

          <div className="flex items-center gap-1 shrink-0">
            {recording ? (
              <Button
                size="icon"
                variant="destructive"
                onClick={stopRecording}
                className="h-9 w-9 rounded-xl"
                aria-label={t('stylist.tapToStop')}
                data-testid="stylist-composer-mic-button"
              >
                <Square className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                size="icon"
                variant="ghost"
                onClick={startRecording}
                className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground"
                data-testid="stylist-composer-mic-button"
                aria-label={t('stylist.recordVoice')}
              >
                <Mic className="h-4.5 w-4.5" />
              </Button>
            )}
            <Button
              size="icon"
              variant="default"
              onClick={() => sendTurn({})}
              disabled={busy || (!text.trim() && !imageFile && extraImages.length === 0)}
              className="h-9 w-9 rounded-xl bg-[hsl(var(--accent))] text-white hover:bg-[hsl(var(--accent))]/90"
              data-testid="stylist-composer-send-button"
            >
              <Send className="h-4.5 w-4.5" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );

  return (
    <div className="container-px max-w-[1600px] mx-auto pt-4 md:pt-6">
      <div className={cn(
        "grid grid-cols-1 gap-4 h-[calc(100dvh-180px)] md:h-[calc(100dvh-140px)] transition-all duration-300",
        sidebarCollapsed
          ? "lg:grid-cols-[minmax(0,1fr)]"
          : "lg:grid-cols-[280px_minmax(0,1fr)]"
      )}>
        {/* Left rail — desktop only */}
        <aside
          className={cn(
            "hidden lg:flex rounded-[calc(var(--radius)+6px)] bg-card border border-border overflow-hidden transition-all duration-300",
            sidebarCollapsed ? "w-0 border-0 opacity-0 pointer-events-none" : "w-[280px]"
          )}
          data-testid="stylist-conversation-sidebar"
        >
          <ConversationSidebar
            sessions={sessions}
            activeId={activeSessionId}
            onSelect={handleSelectSession}
            onNew={handleNewConversation}
            onDelete={handleDeleteSession}
            loading={sessionsLoading}
          />
        </aside>

        {/* Center — chat */}
        <main className="min-w-0 flex flex-col h-full min-h-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full h-full flex flex-col">
            <div className="flex justify-center mb-3 bg-muted/60 p-1 rounded-2xl max-w-sm mx-auto w-full border border-border/40">
              <TabsList className="grid grid-cols-3 w-full bg-transparent p-0 h-8">
                <TabsTrigger value="chat" className="rounded-xl text-xs font-semibold data-[state=active]:bg-brand data-[state=active]:text-brand-foreground shadow-sm">{t('stylist.chatPanel')}</TabsTrigger>
                <TabsTrigger value="shuffle" className="rounded-xl text-xs font-semibold data-[state=active]:bg-brand data-[state=active]:text-brand-foreground shadow-sm">{t('stylist.outfitPlanner', { defaultValue: 'Outfit Planner' })}</TabsTrigger>
                <TabsTrigger value="match" className="rounded-xl text-xs font-semibold data-[state=active]:bg-brand data-[state=active]:text-brand-foreground shadow-sm">{t('stylist.dailySuggestion')}</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="chat" className="flex-1 min-h-0 data-[state=active]:flex flex-col mt-0 focus-visible:outline-none">
              {chatColumn}
            </TabsContent>

            <TabsContent value="shuffle" className="flex-1 min-h-0 overflow-y-auto mt-0 focus-visible:outline-none p-4 data-[state=active]:flex flex-col gap-8 w-full max-w-4xl mx-auto">
              {/* Google Calendar (7-Day Strip) */}
              <Card className="border border-border/80 rounded-2xl shadow-editorial overflow-hidden bg-card w-full">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-2">
                      <CalIcon className="h-5 w-5 text-[hsl(var(--accent))]" />
                      <h3 className="font-display text-lg font-medium">{t('calendar.title', { defaultValue: 'Google Calendar' })}</h3>
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
                                <CalIcon className="h-4 w-4 opacity-50" />
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

              {/* Shuffler */}
              <DressMeShuffler />

              {/* Outfits Gallery Grid */}
              <div className="w-full space-y-4">
                <h3 className="font-display text-xl">{t('components.outfitCanvas.outfit_canvas', { defaultValue: 'Saved Outfits' })}</h3>
                {outfitsLoading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 w-full">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-[300px] rounded-2xl shimmer border border-border" />
                    ))}
                  </div>
                ) : outfits.length === 0 ? (
                  <Card className="rounded-2xl border border-dashed border-border py-16 text-center w-full">
                    <CardContent className="space-y-4">
                      <Sparkles className="h-12 w-12 text-muted-foreground/60 mx-auto" />
                      <h2 className="font-display text-xl">{t('common.noResults', { defaultValue: 'No outfits saved yet' })}</h2>
                      <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                        {t('outfits.noSavedOutfitsDesc', { defaultValue: 'Get outfit proposals in the AI Stylist tab, pick your favorite, and save it to start logging your outfits.' })}
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 w-full">
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
                                <CalIcon className="h-4 w-4 shrink-0 text-muted-foreground/75" />
                                <span>
                                  {o?.usage?.date || t('calendar.unscheduled', { defaultValue: 'Not scheduled' })} {o?.usage?.date && o?.usage?.time ? `· ${o.usage.time}` : ''}
                                </span>
                              </div>
                              {o?.usage?.location && (
                                <div className="flex items-center gap-2">
                                  <MapPin className="h-4 w-4 shrink-0 text-muted-foreground/75" />
                                  <span>{o.usage.location}</span>
                                </div>
                              )}
                              {o?.usage?.event_name && (
                                <div className="flex items-center gap-2">
                                  <Sparkles className="h-4 w-4 shrink-0 text-muted-foreground/75" />
                                  <span>{o.usage.event_name}</span>
                                </div>
                              )}
                            </div>

                            {o?.garments && o.garments.length > 0 && (
                              <div className="space-y-2 pt-2 text-left">
                                <div className="text-[10px] caps-label tracking-wider text-muted-foreground">{t('outfits.outfitPieces', { defaultValue: 'Outfit Pieces' })}</div>
                                <div className="flex flex-wrap gap-1.5">
                                  {o.garments.map((g, idx) => (
                                    <Badge 
                                      key={idx} 
                                      variant="secondary" 
                                      className="text-[9px] px-2 py-0.5 rounded-md font-medium bg-secondary/80 text-foreground border border-border/40 hover:bg-secondary cursor-pointer"
                                      onClick={() => setActiveFloaterItemId(g.closet_item_id)}
                                    >
                                      {labelForRole(g.role, t)}: {g.title}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="match" className="flex-1 min-h-0 overflow-y-auto mt-0 focus-visible:outline-none p-4 data-[state=active]:flex flex-col gap-6 w-full max-w-4xl mx-auto">
              {/* Notification Center */}
              <Card className="border border-border/80 rounded-2xl shadow-editorial overflow-hidden bg-[hsl(var(--accent))]/5 w-full">
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

              {/* Active Recommendations Shelf */}
              {activeNotifContext && (
                <Card className="border border-[hsl(var(--accent))]/20 rounded-2xl shadow-editorial overflow-hidden bg-[hsl(var(--accent))]/5 animate-[slideDown_0.2s_ease-out] w-full">
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
                            <OutfitRecommendationCard
                              rec={rec}
                              index={i}
                              sessionId={null}
                              onItemClick={(itemId) => setActiveFloaterItemId(itemId)}
                              onSave={(r) => handleSaveOutfit(r, activeNotifContext)}
                              draggable={false}
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

              {/* Tinder Swiper */}
              <OutfitTinderSwiper />
            </TabsContent>
          </Tabs>
        </main>


      </div>

      {/* Mobile drawer — conversations */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="p-0 w-[320px] sm:w-[360px]">
          <SheetHeader className="sr-only">
            <SheetTitle>{t('stylist.conversations')}</SheetTitle>
          </SheetHeader>
          <ConversationSidebar
            sessions={sessions}
            activeId={activeSessionId}
            onSelect={handleSelectSession}
            onNew={handleNewConversation}
            onDelete={handleDeleteSession}
            loading={sessionsLoading}
          />
        </SheetContent>
      </Sheet>



      {/* Phase S3: item preview floater — opens on thumbnail click in
          any outfit recommendation. Renders via portal so it overlays
          the chat without dimming it. */}
      <ItemFloater
        itemId={floaterItemId}
        onClose={() => setFloaterItemId(null)}
      />

      {/* Plan Event Outfit Modal */}
      <Dialog open={eventModalOpen} onOpenChange={setEventModalOpen}>
        <DialogContent className="sm:max-w-[425px]" data-testid="stylist-event-dialog">
          <DialogHeader>
            <DialogTitle>{t('stylist.planEventOutfitTitle', { defaultValue: 'Plan Event Outfit' })}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleTriggerEvent} className="space-y-4 py-2" data-testid="stylist-event-form">
            <div className="space-y-1">
              <Label htmlFor="event-name">{t('stylist.eventName', { defaultValue: 'Event Name' })}</Label>
              <Input
                id="event-name"
                value={eventForm.event_name}
                onChange={(e) => setEventForm(prev => ({ ...prev, event_name: e.target.value }))}
                placeholder={t('stylist.eventNamePlaceholder', { defaultValue: 'e.g. Birthday Party, Dinner' })}
                data-testid="event-name-input"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="location">{t('stylist.location', { defaultValue: 'Location' })}</Label>
              <Input
                id="location"
                value={eventForm.location}
                onChange={(e) => setEventForm(prev => ({ ...prev, location: e.target.value }))}
                placeholder={t('stylist.locationPlaceholder', { defaultValue: 'e.g. Rooftop Restaurant' })}
                data-testid="event-location-input"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="date">{t('common.date', { defaultValue: 'Date' })}</Label>
                <Input
                  id="date"
                  type="date"
                  value={eventForm.date}
                  onChange={(e) => setEventForm(prev => ({ ...prev, date: e.target.value }))}
                  data-testid="event-date-input"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="time">{t('common.time', { defaultValue: 'Time' })}</Label>
                <Input
                  id="time"
                  type="time"
                  value={eventForm.time}
                  onChange={(e) => setEventForm(prev => ({ ...prev, time: e.target.value }))}
                  data-testid="event-time-input"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="prompt">{t('stylist.dressCodeDemands', { defaultValue: 'Dress Code / Demands' })}</Label>
              <Textarea
                id="prompt"
                value={eventForm.prompt}
                onChange={(e) => setEventForm(prev => ({ ...prev, prompt: e.target.value }))}
                placeholder={t('stylist.promptPlaceholder', { defaultValue: 'Describe what you need e.g. informal outdoor setting, casual chic' })}
                rows={3}
                required
                data-testid="event-prompt-input"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setEventModalOpen(false)}>
                {t('common.cancel', { defaultValue: 'Cancel' })}
              </Button>
              <Button type="submit" disabled={busy} data-testid="event-submit-btn">
                {t('stylist.getSuggestions', { defaultValue: 'Get Suggestions' })}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
