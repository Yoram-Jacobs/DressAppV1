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
  PanelRight,
  UserRound,
  TrendingUp,
  ShoppingBag,
  RefreshCw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import { FashionScoutPanel } from '@/components/stylist/FashionScoutPanel';
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

export default function Stylist() {
  const { t } = useTranslation();
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
  const [scoutOpen, setScoutOpen] = useState(false);

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

  const userLang = user?.preferred_language || 'en';

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
      toast.success(t('stylist.proposalGenerated', { defaultValue: 'Daily proposals generated successfully!' }));
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
      toast.success(t('stylist.proposalGenerated', { defaultValue: 'Event proposals generated successfully!' }));
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
              t('stylist.rejectionMarketplaceOffer', `You have rejected "${res.title}" 3 times. Share it in the Marketplace to free up space?`),
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
      toast.success(t('stylist.proposalGenerated', { defaultValue: 'New proposals generated successfully!' }));
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('stylist.proposalFailed', { defaultValue: 'Failed to generate new proposals.' }));
    } finally {
      setBusy(false);
    }
  };

  /* ---------- Native STT path (preferred) ---------- */
  const startNativeRecognition = () => {
    try {
      const rec = createRecognition({
        lang: userLang,
        interimResults: true,
        continuous: false,
      });
      recognitionRef.current = rec;
      setInterim('');
      setRecording(true);
      let finalText = '';
      rec.onresult = (event) => {
        let interimText = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) finalText += transcript;
          else interimText += transcript;
        }
        setInterim(interimText);
      };
      rec.onerror = () => {
        setRecording(false);
        toast.error(t('stylist.voiceError'));
      };
      rec.onend = () => {
        setRecording(false);
        setInterim('');
        if (finalText.trim()) {
          sendTurn({ overrideText: finalText.trim() });
        }
      };
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
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden h-9 w-9 rounded-lg border border-border bg-card flex items-center justify-center"
            aria-label={t('stylist.openConversations')}
            data-testid="stylist-open-sidebar-btn"
          >
            <MessageSquare className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <div className="caps-label text-muted-foreground truncate">
              {t('stylist.label')}
            </div>
            <h1 className="font-display text-lg md:text-xl truncate">
              {sessions.find((s) => s.id === activeSessionId)?.title ||
                t('stylist.hero')}
            </h1>
          </div>
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
          <button
            type="button"
            onClick={() => setScoutOpen(true)}
            className="xl:hidden h-9 w-9 rounded-lg border border-border bg-card flex items-center justify-center"
            aria-label={t('stylist.openScout')}
            data-testid="stylist-open-scout-btn"
          >
            <PanelRight className="h-4 w-4" />
          </button>
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
                    <p className="text-sm whitespace-pre-wrap">{m.transcript}</p>
                  )}
                  {m.role === 'assistant' && m.outfit_canvas && (
                    <div className="mt-3">
                      <OutfitCanvasMessage canvas={m.outfit_canvas} />
                    </div>
                  )}
                  {m.role === 'assistant' && m.payload && (
                    <div className="mt-3 space-y-3">
                      {(m.payload.outfit_recommendations || []).map((rec, i) => (
                        <OutfitRecommendationCard
                          key={rec.id || `${m.id || 'msg'}-rec-${i}`}
                          rec={rec}
                          index={i}
                          sessionId={activeSessionId}
                          onItemClick={setFloaterItemId}
                          onSave={(r) => handleSaveOutfit(r, m)}
                        />
                      ))}
                      {m.payload.shopping_suggestions?.length > 0 && (
                        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 rounded-xl p-3 text-xs text-amber-800 dark:text-amber-300 space-y-1">
                          <div className="font-semibold flex items-center gap-1.5">
                            <Sparkles className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                            {t('stylist.shoppingSuggestions', { defaultValue: 'AI Stylist Shopping Suggestions' })}
                          </div>
                          <ul className="list-disc ps-4 space-y-1">
                            {m.payload.shopping_suggestions.map((s, k) => (
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
                      {m.payload.do_dont?.length > 0 && (
                        <div className="text-xs text-muted-foreground">
                          <div className="caps-label mb-1">
                            {t('stylist.doDont')}
                          </div>
                          <ul className="list-disc ps-5 space-y-0.5">
                            {m.payload.do_dont.map((d, k) => (
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
                      {m.payload.generated_examples?.length > 0 && (
                        <div className="space-y-1" data-testid="stylist-generated-examples">
                          <div className="caps-label text-muted-foreground">
                            {t('stylist.examplesLabel')}
                          </div>
                          <div className="flex gap-2 flex-wrap">
                            {m.payload.generated_examples.map((ex, k) => (
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
                        if (!mktList || mktList.length === 0) return null;
                        return (
                          <div className="space-y-1" data-testid="stylist-marketplace-strip">
                            <div className="caps-label text-muted-foreground flex items-center gap-1">
                              <ShoppingBag className="h-3 w-3" />
                              {t('stylist.marketplaceLabel')}
                            </div>
                            <div className="flex gap-2 overflow-x-auto pb-1">
                              {mktList.map((s) => (
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
                      {m.payload.fashion_scout_picks?.length > 0 && (
                        <div className="space-y-1" data-testid="stylist-scout-strip">
                          <div className="caps-label text-muted-foreground flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" />
                            {t('stylist.trendsLabel')}
                          </div>
                          <div className="flex gap-2 overflow-x-auto pb-1">
                            {m.payload.fashion_scout_picks.map((tp) => (
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
                                  <div className="text-[11px] line-clamp-2 leading-tight font-medium">{tp.title}</div>
                                  {tp.source_name && (
                                    <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{tp.source_name}</div>
                                  )}
                                </div>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                      {m.payload.applied_preferences?.length > 0 && (
                        <details className="text-[11px] text-muted-foreground">
                          <summary className="cursor-pointer hover:text-foreground">
                            {t('stylist.preferencesApplied', { count: m.payload.applied_preferences.length })}
                          </summary>
                          <div className="ps-2 pt-1 leading-relaxed">
                            {m.payload.applied_preferences.join(' · ')}
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

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Switch
              checked={includeCalendar}
              onCheckedChange={setIncludeCalendar}
              id="inc-cal"
              data-testid="stylist-include-calendar-switch"
            />
            <label
              htmlFor="inc-cal"
              className="text-xs text-muted-foreground inline-flex items-center gap-1"
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
              className="text-xs bg-secondary border border-border rounded-lg px-2 py-1"
              data-testid="stylist-occasion-input"
            />
          )}
          {imageFile && (
            <div
              className="flex items-center gap-2 rounded-full border border-border bg-card px-2 py-1 text-xs"
              data-testid="stylist-attached-image"
            >
              <img
                src={URL.createObjectURL(imageFile)}
                alt=""
                className="h-6 w-6 rounded object-cover"
              />
              <span className="truncate max-w-[140px]">{imageFile.name}</span>
              <button
                onClick={() => setImageFile(null)}
                aria-label={t('stylist.removeImage')}
                data-testid="stylist-remove-image"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          {/* Phase R: extra image chips for multi-image outfit composer */}
          {extraImages.map((f, idx) => (
            <div
              key={`extra-${idx}-${f.name}`}
              className="flex items-center gap-2 rounded-full border border-[hsl(var(--accent))]/40 bg-[hsl(var(--accent))]/5 px-2 py-1 text-xs"
              data-testid={`stylist-extra-image-${idx}`}
            >
              <img
                src={URL.createObjectURL(f)}
                alt=""
                className="h-6 w-6 rounded object-cover"
              />
              <span className="truncate max-w-[120px]">{f.name}</span>
              <button
                onClick={() =>
                  setExtraImages((prev) => prev.filter((_, i) => i !== idx))
                }
                aria-label={t('stylist.removeImage')}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {(imageFile || extraImages.length > 0) && (imageFile ? 1 : 0) + extraImages.length >= 2 && (
            <Badge
              variant="outline"
              className="border-[hsl(var(--accent))]/60 text-[hsl(var(--accent))]"
              data-testid="stylist-compose-mode-badge"
            >
              <Sparkles className="h-3 w-3 me-1" />
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
                'inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs',
                'border border-[hsl(var(--accent))]/60 text-[hsl(var(--accent))]',
                'hover:bg-[hsl(var(--accent))]/10 transition-colors',
              )}
              data-testid="stylist-ask-professional-btn"
            >
              <UserRound className="h-3.5 w-3.5" />
              {t('stylist.askProfessional')}
            </button>
          </div>
        </div>
        <div className="flex items-end gap-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            placeholder={t('stylist.composerPlaceholder')}
            className="rounded-xl resize-none"
            data-testid="stylist-composer-textarea"
          />
          {/* Phase S2: unified attachment picker — replaces the bare
              <input type="file">. The trigger keeps the original 11x11
              icon-button silhouette so the composer layout doesn't
              shift. The picker returns a File[] which is merged into
              the existing imageFile / extraImages pipeline below; the
              backend contract is unchanged (single-image /stylist for
              one attachment, multi-image /stylist/compose-outfit for
              two or more). */}
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
                className="inline-flex items-center justify-center h-11 w-11 rounded-xl border border-border bg-card hover:bg-secondary cursor-pointer"
                aria-label={t('stylist.attachPhoto')}
                data-testid="stylist-composer-attach-button"
              >
                <ImgIcon className="h-5 w-5" />
              </span>
            }
          />
          {recording ? (
            <Button
              size="icon"
              variant="destructive"
              onClick={stopRecording}
              className="h-11 w-11 rounded-xl"
              aria-label={t('stylist.tapToStop')}
              data-testid="stylist-composer-mic-button"
            >
              <Square className="h-5 w-5" />
            </Button>
          ) : (
            <Button
              size="icon"
              variant="secondary"
              onClick={startRecording}
              className="h-11 w-11 rounded-xl"
              data-testid="stylist-composer-mic-button"
              aria-label={t('stylist.recordVoice')}
            >
              <Mic className="h-5 w-5" />
            </Button>
          )}
          <Button
            onClick={() => sendTurn({})}
            disabled={busy || (!text.trim() && !imageFile && extraImages.length === 0)}
            className="h-11 rounded-xl"
            data-testid="stylist-composer-send-button"
          >
            <Send className="h-5 w-5 mr-0 md:me-2" />
            <span className="hidden md:inline">{t('stylist.send')}</span>
          </Button>
        </div>
      </div>
    </Card>
  );

  return (
    <div className="container-px max-w-[1600px] mx-auto pt-4 md:pt-6">
      <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_340px] gap-4 h-[calc(100dvh-180px)] md:h-[calc(100dvh-140px)]">
        {/* Left rail — desktop only */}
        <aside
          className="hidden lg:flex rounded-[calc(var(--radius)+6px)] bg-card border border-border overflow-hidden"
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
        <main className="min-w-0 flex flex-col">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full h-full flex flex-col">
            <div className="flex justify-center mb-3 bg-muted/60 p-1 rounded-2xl max-w-sm mx-auto w-full border border-border/40">
              <TabsList className="grid grid-cols-3 w-full bg-transparent p-0 h-8">
                <TabsTrigger value="chat" className="rounded-xl text-xs font-semibold data-[state=active]:bg-brand data-[state=active]:text-brand-foreground shadow-sm">{t('stylist.chatPanel')}</TabsTrigger>
                <TabsTrigger value="shuffle" className="rounded-xl text-xs font-semibold data-[state=active]:bg-brand data-[state=active]:text-brand-foreground shadow-sm">{t('nav.outfits')}</TabsTrigger>
                <TabsTrigger value="match" className="rounded-xl text-xs font-semibold data-[state=active]:bg-brand data-[state=active]:text-brand-foreground shadow-sm">{t('stylist.dailySuggestion')}</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="chat" className="flex-1 min-h-0 data-[state=active]:flex flex-col mt-0 focus-visible:outline-none">
              {chatColumn}
            </TabsContent>

            <TabsContent value="shuffle" className="flex-1 min-h-0 overflow-y-auto mt-0 focus-visible:outline-none p-4 data-[state=active]:flex flex-col items-center justify-start">
              <DressMeShuffler />
            </TabsContent>

            <TabsContent value="match" className="flex-1 min-h-0 overflow-y-auto mt-0 focus-visible:outline-none p-4 data-[state=active]:flex flex-col items-center justify-start">
              <OutfitTinderSwiper />
            </TabsContent>
          </Tabs>
        </main>

        {/* Right rail — desktop only */}
        <aside
          className="hidden xl:flex rounded-[calc(var(--radius)+6px)] bg-card border border-border overflow-hidden"
          data-testid="stylist-fashion-scout"
        >
          <FashionScoutPanel />
        </aside>
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

      {/* Mobile/tablet drawer — fashion scout */}
      <Sheet open={scoutOpen} onOpenChange={setScoutOpen}>
        <SheetContent side="right" className="p-0 w-[340px] sm:w-[380px]">
          <SheetHeader className="sr-only">
            <SheetTitle>{t('stylist.fashionScout')}</SheetTitle>
          </SheetHeader>
          <FashionScoutPanel />
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
