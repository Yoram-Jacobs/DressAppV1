import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useStoreState } from '@/lib/createSimpleStore';
import { stylistUIStore } from '@/lib/stylistUIStore';
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
  ChevronLeft,
  ChevronRight,
  GripVertical,
  ArrowLeft,
  Share2,
  ShirtIcon, 
  Key, Shirt, CalendarCheck2, CalendarPlus, Crown,
  Search, Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ScrollToTop } from '@/components/ScrollToTop';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Pencil } from 'lucide-react';
import { useClosetStore } from '@/lib/useClosetStore';
import { closetStore } from '@/lib/closetStore';
import { bestImageUrl, resolveMediaUrl } from '@/lib/itemImage';
import { useLocalStorageSync } from '@/lib/useLocalStorageSync';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTierLimits } from '@/hooks/useTierLimits';
import { WaveformAudioPlayer } from '@/components/WaveformAudioPlayer';
import { ConversationSidebar } from '@/components/stylist/ConversationSidebar';
import { OutfitCanvasMessage } from '@/components/OutfitCanvas';
import AvatarViewer from '@/components/AvatarViewer';
import { labelForRole, labelForDressCode } from '@/lib/taxonomy';
import { OutfitRecommendationCard } from '@/components/stylist/OutfitRecommendationCard';
import { ItemFloater } from '@/components/stylist/ItemFloater';
import HarmonyBadge from '@/components/stylist/HarmonyBadge';
import ShareOutfitModal from '@/components/stylist/ShareOutfitModal';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import DressMeShuffler from '@/components/stylist/DressMeShuffler';
import { AttachmentPicker } from '@/components/stylist/AttachmentPicker';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { useOutfitStore, prewarmOutfits } from '@/lib/useOutfitStore';
import { useLocation as useAppLocation } from '@/lib/location';
import { useDailySuggestionsStore } from '@/lib/dailySuggestionsStore';
import {
  prewarmStylist,
  loadStylistMessages,
  setStylistActiveSession,
  setStylistMessages,
  setStylistSessions,
  addStylistMessage,
} from '@/lib/stylistStore';
import {
  isSTTSupported,
  isTTSSupported,
  getSpeechRecognitionCtor,
  createRecognition,
  startDictationSession,
  speak,
  cancelSpeak,
  ensureVoicesLoaded,
} from '@/lib/speech';
import { Layers, Footprints, Tag } from 'lucide-react';
import ClosetBanner from "../assets/img/inner6.webp";
import { PageHeroBanner } from '@/components/ui/PageHeroBanner';
// role → icon mapping 
const roleIcon = (role) => {
  const key = (role || '').toLowerCase();
  if (key.includes('top') || key.includes('shirt')) return <Shirt />;
  if (key.includes('bottom') || key.includes('pant') || key.includes('jean')) return <Layers />;
  if (key.includes('shoe') || key.includes('sneaker')) return <Footprints />;
  if (key.includes('outer') || key.includes('jacket')) return <ShirtIcon />;
  return <Tag />;
};

const PieceThumbnail = ({ imgUrl, alt, role }) => {
  const [error, setError] = useState(false);
  if (!imgUrl || error) {
    return (
      <div className="w-full h-full flex items-center justify-center text-[var(--primary-color)]">
        {roleIcon(role)}
      </div>
    );
  }
  return (
    <img
      src={imgUrl}
      alt={alt || ''}
      className="w-full h-full object-cover"
      onError={() => setError(true)}
    />
  );
};
const base64ToUrl = (b64, mime = 'audio/mpeg') => {
  if (!b64) return null;
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const blob = new Blob([bytes], { type: mime });
  return URL.createObjectURL(blob);
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

const getOutfitPiecesMap = (o, closetItems = []) => {
  const map = {};
  const garments = Array.isArray(o?.garments) && o.garments.length > 0 ? o.garments : (Array.isArray(o?.items) ? o.items : []);
  if (Array.isArray(garments)) {
    garments.forEach((g) => {
      if (g && g.role) {
        let img = g.image_url || g.clean_image_url || g.thumbnail_data_url;
        let cid = g.closet_item_id || g.id;
        if (Array.isArray(closetItems) && closetItems.length > 0) {
          const ci = closetItems.find(c =>
            (cid && (c.id === cid || c._id === cid)) ||
            (g.title && (c.title === g.title || c.name === g.title))
          );
          if (ci) {
            img = bestImageUrl(ci) || img;
            cid = cid || ci.id;
          }
        }
        map[g.role] = {
          id: cid,
          closet_item_id: cid,
          image_url: img
        };
      }
    });
  }
  return map;
};
const getRecommendationPiecesMap = (rec, closetItems) => {
  const map = {};
  if (Array.isArray(rec?.items)) {
    rec.items.forEach((item) => {
      if (item && item.role) {
        const closetItem = closetItems.find(c => c.id === item.closet_item_id);
        if (closetItem) {
          map[item.role] = {
            id: closetItem.id,
            closet_item_id: closetItem.id,
            image_url: closetItem.image_url,
            image_url: bestImageUrl(closetItem) || closetItem.image_url,
            clean_image_url: closetItem.clean_image_url,
            cutout_url: closetItem.cutout_url,
            segmented_image_url: closetItem.segmented_image_url,
            thumbnail_data_url: closetItem.thumbnail_data_url,
            reconstructed_image_url: closetItem.reconstructed_image_url,
            original_image_url: closetItem.original_image_url,
            image_variants: closetItem.image_variants,
          };
        }
      }
    });
  }
  return map;
};

const getWeekdayName = (day, locale) => {
  const days = {
    monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sunday: 0
  };
  const date = new Date(2026, 4, 24 + days[day.toLowerCase()]); // May 24, 2026 is a Sunday (0).
  return new Intl.DateTimeFormat(locale || 'en', { weekday: 'long' }).format(date);
};

const getFrequencyLabel = (freq, weekday, lang, t) => {
  if (!freq) return '';
  switch (freq) {
    case 'everyday':
      return t('pages.admin.daily_utc', { defaultValue: 'Everyday' }).split(' ')[0].replace(':', '');
    case 'every_other_day':
      return t('profile.everyOtherDay', { defaultValue: 'Every Other Day' });
    case 'twice_a_week':
      return t('profile.twiceAWeek', { defaultValue: 'Twice a Week' });
    case 'on_weekday': {
      const dayName = getWeekdayName(weekday || 'monday', lang);
      return `${t('profile.onWeekday', { defaultValue: 'On' })} ${dayName}`;
    }
    default:
      return freq;
  }
};

const getStyleLabel = (styleOpt, customStyle, t) => {
  if (!styleOpt) return '';
  if (styleOpt === 'tags') {
    return customStyle || labelForDressCode('tags', t);
  }
  if (styleOpt === 'custom') {
    return customStyle || t('credits.custom', { defaultValue: 'Custom' });
  }
  return labelForDressCode(styleOpt, t);
};

const formatLocalDate = (date) => {
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getWeekdayShortName = (dayIndex, locale) => {
  const date = new Date(2026, 4, 24 + dayIndex); // May 24, 2026 is Sunday
  return new Intl.DateTimeFormat(locale || 'en', { weekday: 'short' }).format(date);
};

const QUICK_VIBE_ITEMS = [
  { id: 'black_t_shirt', query: 'Black T-shirt' },
  { id: 'business_meeting', query: 'Business meeting' },
  { id: 'summer_barbecue', query: 'Summer barbecue' },
  { id: 'mall_shopping', query: 'Mall shopping' },
  { id: 'rainy_day', query: 'Rainy day' },
  { id: 'stone_washed_jeans', query: 'Stone-washed jeans' },
  { id: 'colorful_summer', query: 'Colorful summer' },
  { id: 'casual_chic', query: 'Casual chic' },
];

const getDaysInMonth = (date) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  // First day of the month
  const firstDay = new Date(year, month, 1);
  // Last day of the month
  const lastDay = new Date(year, month + 1, 0);
  const days = [];

  // Day of week of the first day (0 = Sunday, 1 = Monday, etc.)
  const startDayOfWeek = firstDay.getDay();

  // Padding days from the previous month
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    days.push({ date: d, isCurrentMonth: false });
  }

  // Days of the current month
  for (let i = 1; i <= lastDay.getDate(); i++) {
    const d = new Date(year, month, i);
    days.push({ date: d, isCurrentMonth: true });
  }

  // Padding days from the next month to make a complete 42-day grid
  const remaining = 42 - days.length;
  for (let i = 1; i <= remaining; i++) {
    const d = new Date(year, month + 1, i);
    days.push({ date: d, isCurrentMonth: false });
  }
  return days;
};

export default function Stylist() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const loc = useAppLocation();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useLocalStorageSync('dressapp.stylist.activeTab', 'chat');
  const [keyErrorOpen, setKeyErrorOpen] = useState(false);
  const shuffleScrollRef = useRef(null);
  const todayRef = useRef(null);
  const isAiConfigValid = () => {
    // DressApp Free Tier and non-BYOK users rely on the built-in fine-tuned Gemma-4-E4B model.
    // The server handles provider resolution and graceful fallback automatically.
    return true;
  };
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
  const [sessions, setSessions] = useStoreState(stylistUIStore, 'sessions');
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [activeSessionId, setActiveSessionId] = useStoreState(stylistUIStore, 'activeSessionId');
  const getOutfitName = (name) => {
    if (!name) return '';
    let localized = name;
    localized = localized.replace('(Fallback. Quota exhausted)', t('stylist.fallbackQuotaExhausted', { defaultValue: '(Fallback. Quota exhausted)' }));
    localized = localized.replace('(Fallback)', t('stylist.fallbackLabel', { defaultValue: '(Fallback)' }));
    return localized;
  };

  const getOutfitDescription = (desc) => {
    if (!desc) return '';
    if (typeof desc !== 'string') return desc;
    const regex = /^A balanced daily outfit matching your preferred (.+) style and local weather\.$/i;
    const match = desc.match(regex);
    if (match) {
      const style = match[1].toLowerCase();
      const styleLabel = labelForDressCode(style, t);
      return t('stylist.fallbackDescriptionPattern', {
        defaultValue: 'A balanced daily outfit matching your preferred {{style}} style and local weather.',
        style: styleLabel
      });
    }
    return desc;
  };
  const [messages, setMessages] = useStoreState(stylistUIStore, 'messages');
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const messagesEndRef = useRef(null);
  const lastAssistantRef = useRef(null);
  // Outfits, Notifications, and Calendar states
  const { items: outfits, loading: outfitsLoading, incrementalSync, upsert, remove } = useOutfitStore();
  const [notifications, setNotifications] = useStoreState(stylistUIStore, 'notifications');
  const [calendarStartDate, setCalendarStartDate] = useStoreState(stylistUIStore, 'calendarStartDate');
  const [dragOverDay, setDragOverDay] = useStoreState(stylistUIStore, 'dragOverDay');
  const [selectedOutfitForDetail, setSelectedOutfitForDetail] = useStoreState(stylistUIStore, 'selectedOutfitForDetail');
  const [shareDetailModalOpen, setShareDetailModalOpen] = useStoreState(stylistUIStore, 'shareDetailModalOpen');
  const [calendarModalOpen, setCalendarModalOpen] = useStoreState(stylistUIStore, 'calendarModalOpen');
  const [schedulingDate, setSchedulingDate] = useStoreState(stylistUIStore, 'schedulingDate');
  const [currentCalendarMonth, setCurrentCalendarMonth] = useStoreState(stylistUIStore, 'currentCalendarMonth');
  const { items: closetItems } = useClosetStore({ prewarm: true });
  const [isEditingOutfit, setIsEditingOutfit] = useStoreState(stylistUIStore, 'isEditingOutfit');
  const [editOutfitName, setEditOutfitName] = useStoreState(stylistUIStore, 'editOutfitName');
  const [editOutfitDescription, setEditOutfitDescription] = useStoreState(stylistUIStore, 'editOutfitDescription');
  const [canvasSearchQuery, setCanvasSearchQuery] = useState('');

  // Vibe & keyword search filter for Outfit Canvas
  const filteredCanvasOutfits = useMemo(() => {
    if (!canvasSearchQuery || !canvasSearchQuery.trim()) return outfits || [];

    const rawQ = canvasSearchQuery.trim().toLowerCase();
    const q = rawQ.replace(/[-_]/g, ' ');
    const searchTokens = q.split(/[\s,]+/).filter((t) => t.length > 0);

    const COLOR_MAP = {
      black: ['black', 'nero', 'onyx', 'charcoal', 'שחור', 'שחורה', 'שחורים', 'שחורות'],
      white: ['white', 'ivory', 'cream', 'לבן', 'לבנה', 'לבנים', 'לבנות'],
      blue: ['blue', 'navy', 'indigo', 'כחול', 'כחולה', 'כחולים', 'כחולות', 'תכלת'],
      red: ['red', 'crimson', 'burgundy', 'maroon', 'אדום', 'אדומה', 'בורדו'],
      green: ['green', 'olive', 'emerald', 'sage', 'ירוק', 'ירוקה', 'זית'],
      brown: ['brown', 'camel', 'tan', 'khaki', 'חום', 'חומה', 'בז\'', 'בז'],
      grey: ['grey', 'gray', 'slate', 'ash', 'אפור', 'אפורה', 'אפורים'],
      yellow: ['yellow', 'mustard', 'צהוב', 'צהובה'],
      pink: ['pink', 'rose', 'ורוד', 'ורודה'],
    };

    const GARMENT_TYPES = {
      tshirt: ['t shirt', 'tshirt', 'tee', 'טי שירט', 'טי-שירט', 'חולצת טי', 'טישירט', 'חולצה קצרה'],
      shirt: ['shirt', 'button down', 'buttondown', 'collared', 'blouse', 'חולצה מכופתרת', 'מכופתרת', 'חולצה'],
      jeans: ['jeans', 'denim', "ג'ינס", "ג'ינסים", 'ג’ינס', 'גנס'],
      pants: ['pants', 'trousers', 'slacks', 'chinos', 'מכנסיים', 'מכנס'],
      shorts: ['shorts', 'ברמודה', 'מכנסיים קצרים', 'מכנס קצר'],
      sneakers: ['sneakers', 'sneaker', 'סניקרס', 'נעלי ספורט'],
      boots: ['boots', 'boot', 'מגפיים', 'מגפונים', 'מגף'],
      shoes: ['shoes', 'shoe', 'loafers', 'oxfords', 'נעליים', 'נעלי', 'מוקסינים'],
      jacket: ['jacket', 'coat', 'blazer', 'trench', 'מעיל', "ג'קט", 'ז\'קט', 'בלייזר'],
      dress: ['dress', 'שמלה', 'שמלת'],
      skirt: ['skirt', 'חצאית'],
    };

    let targetColor = null;
    for (const [colName, colWords] of Object.entries(COLOR_MAP)) {
      if (colWords.some((w) => q.includes(w))) {
        targetColor = colName;
        break;
      }
    }

    let targetGarmentType = null;
    for (const [garmentKey, garmentWords] of Object.entries(GARMENT_TYPES)) {
      if (garmentWords.some((w) => q.includes(w))) {
        targetGarmentType = garmentKey;
        break;
      }
    }

    const isStonewashed = ['stone wash', 'stonewash', 'washed', 'משופשף', 'שטיפת אבן'].some((w) => q.includes(w));
    const isBusinessMeetingQuery = [
      'business', 'meeting', 'office', 'corporate', 'formal meeting',
      'עסקים', 'פגישת עסקים', 'פגישה עסקית', 'משרד', 'פורמלי'
    ].some((w) => q.includes(w));

    const isSummerBbqQuery = [
      'barbecue', 'bbq', 'grill', 'picnic', 'ברביקיו', 'על האש', 'פיקניק'
    ].some((w) => q.includes(w));

    const isMallShoppingQuery = [
      'mall', 'shopping', 'קניון', 'קניות'
    ].some((w) => q.includes(w));

    const isRainyDayQuery = [
      'rain', 'rainy', 'wet', 'גשם', 'גשום', 'יום גשום'
    ].some((w) => q.includes(w));

    const isColorfulSummerQuery = [
      'colorful summer', 'colorful', 'bright summer', 'קיץ צבעוני', 'צבעוני'
    ].some((w) => q.includes(w));

    return (outfits || []).filter((o) => {
      const name = (o.name || '').toLowerCase();
      const desc = (o.description || o.prompt || '').toLowerCase();
      const event = (o.usage?.event_name || '').toLowerCase();
      const location = (o.usage?.location || '').toLowerCase();
      const combinedMeta = `${name} ${desc} ${event} ${location}`;

      const garments = Array.isArray(o.garments) && o.garments.length > 0
        ? o.garments
        : (Array.isArray(o.items) ? o.items : []);

      const richGarments = garments.map((g) => {
        const cid = g.closet_item_id || g.id;
        const ci = (closetItems || []).find((c) => c && (c.id === cid || c._id === cid)) || {};
        const title = (g.title || g.name || ci.title || ci.name || '').toLowerCase();
        const role = (g.role || ci.category || '').toLowerCase();
        const category = (ci.category || '').toLowerCase();
        const subCategory = (ci.sub_category || '').toLowerCase();
        const color = (ci.color || '').toLowerCase();
        const colors = Array.isArray(ci.colors) ? ci.colors.map((c) => String(c?.name || c).toLowerCase()) : [];
        const material = (ci.material || '').toLowerCase();
        const fabrics = Array.isArray(ci.fabric_materials) ? ci.fabric_materials.map((m) => String(m?.name || m).toLowerCase()) : [];
        const tags = Array.isArray(ci.tags) ? ci.tags.map((t) => String(t).toLowerCase()) : [];

        const allItemText = [title, role, category, subCategory, color, ...colors, material, ...fabrics, ...tags].join(' ');

        return {
          title,
          role,
          category,
          subCategory,
          color,
          colors,
          material,
          fabrics,
          tags,
          allItemText,
        };
      });

      // 1. Specific Color + Garment check (e.g. "Black T-shirt")
      if (targetColor && targetGarmentType) {
        const colorWords = COLOR_MAP[targetColor] || [targetColor];
        const garmentWords = GARMENT_TYPES[targetGarmentType] || [targetGarmentType];

        const hasMatchingPiece = richGarments.some((rg) => {
          const matchesColor = colorWords.some((cw) => rg.allItemText.includes(cw));
          const matchesGarment = garmentWords.some((gw) => rg.allItemText.includes(gw));
          return matchesColor && matchesGarment;
        });

        if (!hasMatchingPiece) return false;

        if (isStonewashed) {
          const hasStonewashed = richGarments.some((rg) =>
            ['stone', 'wash', 'washed', 'משופשף'].some((w) => rg.allItemText.includes(w))
          );
          if (!hasStonewashed) return false;
        }

        return true;
      }

      // 2. Stone-washed jeans query
      if (isStonewashed && (q.includes('jean') || q.includes('ג\'ינס') || q.includes('denim'))) {
        return richGarments.some((rg) => {
          const isJeans = ['jeans', 'denim', "ג'ינס"].some((w) => rg.allItemText.includes(w));
          const isWashed = ['stone', 'wash', 'washed', 'משופשף'].some((w) => rg.allItemText.includes(w));
          return isJeans && isWashed;
        });
      }

      // 3. Business Meeting: dress code and restrictions
      if (isBusinessMeetingQuery) {
        // Disqualifiers (Casual items forbidden in business meetings)
        const hasDisqualifier = richGarments.some((rg) => {
          const t = rg.allItemText;
          return (
            t.includes('shorts') || t.includes('מכנסיים קצרים') || t.includes('ברמודה') ||
            t.includes('sweatpants') || t.includes('joggers') || t.includes('טרנינג') ||
            t.includes('hoodie') || t.includes('קפוצ\'ון') ||
            t.includes('flip flop') || t.includes('flip-flop') || t.includes('slides') || t.includes('כפכפים') ||
            t.includes('ripped') || t.includes('distressed') || t.includes('קרוע') ||
            t.includes('tank top') || t.includes('גופייה')
          );
        });
        if (hasDisqualifier) return false;

        const isExplicitBusiness = ['business', 'meeting', 'office', 'corporate', 'formal', 'עסקים', 'פגישה', 'משרד'].some((w) => combinedMeta.includes(w));
        const hasBusinessPieces = richGarments.some((rg) => {
          const t = rg.allItemText;
          return (
            t.includes('blazer') || t.includes('suit') || t.includes('בלייזר') || t.includes('מקטורן') || t.includes('חליפה') ||
            t.includes('button down') || t.includes('button-down') || t.includes('collared') || t.includes('dress shirt') || t.includes('מכופתרת') ||
            t.includes('trousers') || t.includes('slacks') || t.includes('tailored') || t.includes('מחויט') || t.includes('pencil skirt') ||
            t.includes('loafers') || t.includes('oxford') || t.includes('heels') || t.includes('מוקסינים') || t.includes('עקבים')
          );
        });

        const isOnlyCasualTeeAndJeans = richGarments.every((rg) => {
          const t = rg.allItemText;
          return t.includes('t-shirt') || t.includes('tee') || t.includes('jeans') || t.includes('sneakers');
        });
        if (isOnlyCasualTeeAndJeans && !isExplicitBusiness) return false;

        return isExplicitBusiness || hasBusinessPieces;
      }

      // 4. Summer Barbecue query
      if (isSummerBbqQuery) {
        const hasWinterOrSuit = richGarments.some((rg) => {
          const t = rg.allItemText;
          return t.includes('puffer') || t.includes('heavy coat') || t.includes('wool') || t.includes('suit') || t.includes('tuxedo');
        });
        if (hasWinterOrSuit) return false;

        const isExplicitBbq = ['barbecue', 'bbq', 'grill', 'picnic', 'ברביקיו', 'על האש'].some((w) => combinedMeta.includes(w));
        const isCasualSummer = combinedMeta.includes('summer') || richGarments.some((rg) => {
          const t = rg.allItemText;
          return t.includes('shorts') || t.includes('tee') || t.includes('t-shirt') || t.includes('linen') || t.includes('sandals');
        });
        return isExplicitBbq || isCasualSummer;
      }

      // 5. Mall Shopping query
      if (isMallShoppingQuery) {
        const isExplicitMall = ['mall', 'shopping', 'קניון', 'קניות'].some((w) => combinedMeta.includes(w));
        const hasCasualComfort = richGarments.some((rg) => {
          const t = rg.allItemText;
          return t.includes('sneakers') || t.includes('casual') || t.includes('jeans') || t.includes('tote') || t.includes('walk');
        });
        return isExplicitMall || hasCasualComfort;
      }

      // 6. Rainy Day query
      if (isRainyDayQuery) {
        const isExplicitRain = ['rain', 'rainy', 'wet', 'גשם', 'גשום'].some((w) => combinedMeta.includes(w));
        const hasRainLayers = richGarments.some((rg) => {
          const t = rg.allItemText;
          return t.includes('coat') || t.includes('trench') || t.includes('jacket') || t.includes('boots') || t.includes('waterproof') || t.includes('מעיל');
        });
        return isExplicitRain || hasRainLayers;
      }

      // 7. Colorful Summer query
      if (isColorfulSummerQuery) {
        const hasVibrantColor = richGarments.some((rg) => {
          const t = rg.allItemText;
          return ['red', 'blue', 'green', 'yellow', 'pink', 'orange', 'purple', 'colorful', 'floral', 'print', 'צבעוני', 'אדום', 'ירוק', 'צהוב', 'ורוד'].some((c) => t.includes(c));
        });
        const hasSummerPiece = combinedMeta.includes('summer') || richGarments.some((rg) => {
          const t = rg.allItemText;
          return t.includes('short') || t.includes('tee') || t.includes('t-shirt') || t.includes('linen') || t.includes('dress') || t.includes('sandals');
        });
        return hasVibrantColor && hasSummerPiece;
      }

      // 8. General search: ALL search terms must match across the outfit (strict AND logic)
      const allText = `${combinedMeta} ${richGarments.map((rg) => rg.allItemText).join(' ')}`;
      return searchTokens.every((token) => allText.includes(token));
    });
  }, [outfits, canvasSearchQuery, closetItems]);
  const { canAccessScheduler } = useTierLimits();
  const { notifications: cachedNotifications, dailyProposal, proposals, generate: generateDailyProposalAction, prewarm: prewarmDaily, act: actDailyProposal } = useDailySuggestionsStore();
  const [generatingDaily, setGeneratingDaily] = useState(false);
  const proposalToOutfit = useCallback((prop, dateStr) => {
    if (!prop) return null;
    const rawItems = prop.items || prop.garments || [];
    const targetDate = prop?.date || prop?.usage?.date || dateStr || formatLocalDate(new Date());
    return {
      id: prop.id || `prop_${Date.now()}`,
      isDailyProposal: true,
      name: prop.title || prop.name || 'Look of the Day',
      description: prop.description || 'Curated based on your style profile, weather conditions, and closet harmony.',
      prompt: prop.style_preference || 'casual',
      source_workflow: 'scheduled',
      garments: rawItems.map(it => {
        const cid = it.closet_item_id || it.id;
        const ci = (closetItems || []).find(c => c && (c.id === cid || c._id === cid));
        return {
          closet_item_id: cid,
          role: it.role,
          title: it.name || it.title || it.description || ci?.title || ci?.name || 'Garment',
          image_url: resolveMediaUrl(bestImageUrl(ci) || it.image_url || it.clean_image_url || ci?.image_url || ''),
        };
      }),
      items: rawItems,
      usage: {
        date: targetDate,
        time: '08:00',
      },
      harmony_score: prop.harmony_score || 94,
      proposal_raw: prop,
    };
  }, [closetItems]);

  const handleWearDailyProposal = useCallback(async (prop) => {
    const todayDateStr = formatLocalDate(new Date());
    const targetDateStr = prop?.date || prop?.usage?.date || prop?.proposal_raw?.date || todayDateStr;
    const isTomorrow = targetDateStr > todayDateStr;
    const rawItems = prop.items || prop.garments || [];
    const body = {
      name: prop.name || prop.title || (isTomorrow ? "Tomorrow's Look" : 'Look of the Day'),
      description: prop.description || (isTomorrow ? 'Tomorrow style suggestion' : 'Daily style suggestion'),
      source_workflow: 'scheduled',
      prompt: prop.prompt || user?.scheduler_settings?.style_dress_for || 'casual',
      garments: rawItems.map(it => {
        const cid = it.closet_item_id || it.id;
        const ci = (closetItems || []).find(c => c && (c.id === cid || c._id === cid));
        return {
          closet_item_id: cid,
          role: it.role,
          title: it.name || it.title || it.description || ci?.title || ci?.name || 'Garment',
          image_url: resolveMediaUrl(bestImageUrl(ci) || it.image_url || it.clean_image_url || ci?.image_url || ''),
        };
      }),
      usage: {
        date: targetDateStr,
        time: '08:00',
      },
      is_fallback: false,
    };

    try {
      const saved = await api.saveOutfit(body);
      const savedOutfit = saved?.outfit || saved;
      upsert(savedOutfit);
      
      const propId = prop.id || prop.proposal_raw?.id;
      if (propId && actDailyProposal) {
        await actDailyProposal('wear', propId, targetDateStr);
      }
      
      setSelectedOutfitForDetail(savedOutfit);
      toast.success(
        isTomorrow
          ? t('calendar.scheduledTomorrowSuccess', { defaultValue: 'Saved as tomorrow’s scheduled outfit!' })
          : t('stylist.outfitSaved', { defaultValue: 'Saved as today’s scheduled outfit!' })
      );
    } catch (err) {
      console.error("Wear daily proposal error:", err);
      toast.error(err?.response?.data?.detail || t('stylist.saveFailed', { defaultValue: 'Failed to schedule outfit.' }));
    }
  }, [closetItems, user, upsert, actDailyProposal, setSelectedOutfitForDetail, t]);

  const handleSaveOutfitSuccess = useCallback(async () => {
    prewarmOutfits({ force: true }).catch(() => { });
    try {
      const res = await api.listSimulatedNotifications();
      setNotifications(res.notifications || []);
    } catch (err) {
      console.error("Failed to refresh notifications:", err);
    }
  }, [setNotifications]);

  useEffect(() => {
    if (cachedNotifications && cachedNotifications.length > 0) {
      setNotifications(cachedNotifications);
    } else {
      prewarmDaily().then(snap => {
        setNotifications(snap.notifications || []);
      }).catch(() => { });
    }
  }, [cachedNotifications, setNotifications, prewarmDaily]);

  const [userDismissedDetail, setUserDismissedDetail] = useState(false);

  useEffect(() => {
    if (activeTab === 'match') {
      if (!canAccessScheduler) {
        setSelectedOutfitForDetail(null);
        return;
      }
      if (!selectedOutfitForDetail && !userDismissedDetail) {
        const todayDateStr = formatLocalDate(new Date());
        const todayOutfit = (outfits || []).find(o => o.usage?.date === todayDateStr);
        if (todayOutfit) {
          setSelectedOutfitForDetail(todayOutfit);
        } else if (dailyProposal && (dailyProposal.items || []).length > 0) {
          setSelectedOutfitForDetail(proposalToOutfit(dailyProposal, dailyProposal.date || todayDateStr));
        } else if (proposals && proposals.length > 0 && (proposals[0].items || []).length > 0) {
          setSelectedOutfitForDetail(proposalToOutfit(proposals[0], proposals[0].date || todayDateStr));
        } else {
          generateDailyProposalAction(false).then(prop => {
            if (prop && (prop.items || []).length > 0) {
              setSelectedOutfitForDetail(proposalToOutfit(prop, prop?.date || todayDateStr));
            }
          }).catch(() => { });
        }
      }
    } else {
      setUserDismissedDetail(false);
    }
  }, [activeTab, canAccessScheduler, selectedOutfitForDetail, userDismissedDetail, outfits, dailyProposal, proposals, proposalToOutfit, generateDailyProposalAction, setSelectedOutfitForDetail]);

  useEffect(() => {
    if (location.state?.selectedOutfitId && outfits.length > 0) {
      const found = outfits.find(o => o.id === location.state.selectedOutfitId);
      if (found) {
        setSelectedOutfitForDetail(found);
      }
    }
  }, [location.state, outfits]);

  const deleteOutfit = async (id) => {
    try {
      remove(id);
      await api.deleteSavedOutfit(id);
      toast.success(t('outfits.removedSuccess', { defaultValue: 'Outfit removed from your diary.' }));
    } catch (err) {
      incrementalSync();
      toast.error(t('outfits.failedDelete', { defaultValue: 'Failed to delete outfit.' }));
    }
  };



  const handleSaveOutfit = async (rec, messageOrNotif) => {
    const isEvent =
      (messageOrNotif?.title || '').toLowerCase().includes('get ready') ||
      messageOrNotif?.payload?.source_workflow === 'event';

    const eventDetails = messageOrNotif?.payload?.event_details || {};
    const targetDate = isEvent ? (eventDetails.date || formatLocalDate(new Date())) : formatLocalDate(new Date(Date.now() + 86400000));

    const isFallback = messageOrNotif?.payload?.is_fallback || false;
    let displayName = rec.name;
    if (!isEvent) {
      try {
        const [y, m, d] = targetDate.split('-');
        const dateObj = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
        displayName = dateObj.toLocaleDateString(i18n.language || 'en', { month: 'numeric', day: 'numeric', year: 'numeric' });
      } catch (e) {
        displayName = rec.name;
      }
    }
    if (isFallback && !displayName.includes('Fallback')) {
      displayName = `${displayName} (Fallback)`;
    }

    const body = {
      name: displayName,
      description: rec.why || '',
      source_workflow: isEvent ? 'event' : 'scheduled',
      prompt: isEvent ? (eventDetails.prompt || 'Event') : (user?.scheduler_settings?.style_dress_for || 'casual'),
      garments: (rec.items || []).map((it) => {
        const cid = it.closet_item_id || it.id;
        const ci = (closetItems || []).find((c) => c && (c.id === cid || c._id === cid));
        return {
          closet_item_id: cid,
          role: it.role,
          title: it.description || it.title || it.name,
          image_url: (ci ? bestImageUrl(ci) : null) || bestImageUrl(it) || it.clean_image_url || it.image_url || '',
        };
      }),
      usage: {
        date: targetDate,
        time: isEvent ? (eventDetails.time || '12:00') : (user?.scheduler_settings?.time || '08:00'),
        location: isEvent ? eventDetails.location : null,
        event_name: isEvent ? eventDetails.event_name : null,
      },
      is_fallback: messageOrNotif?.payload?.is_fallback || false,
    };

    try {
      const saved = await api.saveOutfit(body);
      upsert(saved?.outfit || saved);
      toast.success(t('stylist.outfitSaved', { defaultValue: 'Outfit saved to your diary!' }));
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('stylist.saveFailed', { defaultValue: 'Failed to save outfit.' }));
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
      const existing = outfits.find(o => o.id === id);
      if (existing) upsert({ ...existing, usage: { ...existing.usage, date: targetDate } });
      const updated = await api.updateSavedOutfit(id, { usage: { date: targetDate } });
      upsert(updated?.outfit || updated);
      toast.success(t('outfits.rescheduledSuccess', { defaultValue: 'Outfit rescheduled!' }));
    } catch (err) {
      incrementalSync();
      toast.error(t('outfits.failedReschedule', { defaultValue: 'Failed to reschedule outfit.' }));
    }
  };

  const handleSaveOutfitEdits = async () => {
    try {
      if (selectedOutfitForDetail) upsert({ ...selectedOutfitForDetail, name: editOutfitName, description: editOutfitDescription });
      const updated = await api.updateSavedOutfit(selectedOutfitForDetail.id, {
        name: editOutfitName,
        description: editOutfitDescription
      });
      const finalOutfit = updated?.outfit || updated;
      upsert(finalOutfit);
      setSelectedOutfitForDetail(finalOutfit);
      setIsEditingOutfit(false);
      toast.success(t('outfits.editSuccess', { defaultValue: 'Outfit updated successfully!' }));
    } catch (err) {
      incrementalSync();
      toast.error(t('outfits.editFailed', { defaultValue: 'Failed to update outfit.' }));
    }
  };

  const calculateOutfitValue = (outfit) => {
    if (!outfit || !Array.isArray(outfit.garments)) return 0;
    let totalCents = 0;
    outfit.garments.forEach((g) => {
      if (g.closet_item_id) {
        const item = closetItems.find(it => it.id === g.closet_item_id);
        if (item) {
          totalCents += (item.purchase_price_cents || item.price_cents || 0);
        }
      }
    });
    return totalCents / 100;
  };

  const determineOutfitStyle = (outfit) => {
    if (!outfit || !Array.isArray(outfit.garments)) return 'Casual';
    const styles = [];
    outfit.garments.forEach((g) => {
      if (g.closet_item_id) {
        const item = closetItems.find(it => it.id === g.closet_item_id);
        if (item && item.dress_code) {
          styles.push(item.dress_code);
        }
      }
    });

    if (styles.length === 0) return 'Casual';

    const counts = {};
    styles.forEach(s => { counts[s] = (counts[s] || 0) + 1; });
    const sorted = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);

    const style = sorted[0];
    return style.charAt(0).toUpperCase() + style.slice(1);
  };

  const calculateOutfitMetrics = (outfit) => {
    if (!outfit) return {};

    const colors = outfit.garments
      .map(g => {
        const item = closetItems.find(it => it.id === g.closet_item_id);
        return item?.color || item?.colors?.[0]?.name;
      })
      .filter(Boolean)
      .map(c => c.toLowerCase());

    let colorScore = 80;
    if (colors.length <= 1) {
      colorScore = 95;
    } else {
      const neutrals = ['black', 'white', 'grey', 'gray', 'beige', 'navy', 'cream', 'charcoal'];
      const neutralCount = colors.filter(c => neutrals.some(n => c.includes(n))).length;
      if (neutralCount === colors.length) {
        colorScore = 98;
      } else if (neutralCount > 0) {
        colorScore = 90;
      } else {
        colorScore = 75;
      }
    }

    const patterns = outfit.garments
      .map(g => {
        const item = closetItems.find(it => it.id === g.closet_item_id);
        return item?.pattern;
      })
      .filter(Boolean)
      .map(p => p.toLowerCase());

    let patternScore = 95;
    const patternedCount = patterns.filter(p => p !== 'solid' && p !== 'plain').length;
    if (patternedCount > 1) {
      patternScore = 65;
    } else if (patternedCount === 1) {
      patternScore = 88;
    }

    const sizes = outfit.garments
      .map(g => {
        const item = closetItems.find(it => it.id === g.closet_item_id);
        return item?.size;
      })
      .filter(Boolean)
      .map(s => s.toUpperCase());

    let fitScore = 90;
    if (sizes.length > 0) {
      const distinctSizes = new Set(sizes);
      if (distinctSizes.size === 1) {
        fitScore = 98;
      } else if (distinctSizes.size > 1) {
        fitScore = 85;
      }
    }

    let weatherScore = 85;
    const seasonTags = outfit.garments
      .flatMap(g => {
        const item = closetItems.find(it => it.id === g.closet_item_id);
        return item?.season || [];
      });

    if (seasonTags.length > 0) {
      const hasWinter = seasonTags.some(s => s.toLowerCase().includes('winter'));
      const hasSummer = seasonTags.some(s => s.toLowerCase().includes('summer'));
      if (hasWinter && hasSummer) {
        weatherScore = 60;
      } else {
        weatherScore = 92;
      }
    }

    let eventScore = 75;
    const hasEvent = outfit.usage?.event_name || outfit.source_workflow === 'event';
    if (hasEvent) {
      eventScore = 95;
    }

    let locationScore = 80;
    const location = (outfit.usage?.location || '').toLowerCase();
    if (location) {
      if (location.includes('museum') || location.includes('church') || location.includes('temple') || location.includes('mosque') || location.includes('synagogue') || location.includes('warship') || location.includes('naval') || location.includes('base')) {
        const isCasualOrSporty = outfit.garments.some(g => {
          const item = closetItems.find(it => it.id === g.closet_item_id);
          const dc = (item?.dress_code || '').toLowerCase();
          return dc === 'sporty' || dc === 'beachwear' || dc === 'loungewear';
        });
        if (isCasualOrSporty) {
          locationScore = 45;
        } else {
          locationScore = 90;
        }
      } else {
        locationScore = 88;
      }
    }

    return {
      color: colorScore,
      pattern: patternScore,
      fit: fitScore,
      weather: weatherScore,
      event: eventScore,
      location: locationScore
    };
  };

  const getMetricBarColor = (pct) => {
    if (pct >= 80) return 'bg-gradient-to-r from-emerald-500 to-green-400';
    if (pct >= 50) return 'bg-gradient-to-r from-amber-500 to-orange-400';
    return 'bg-gradient-to-r from-rose-500 to-red-400';
  };

  const dailyRecommendations = useMemo(() => {
    if (!schedulingDate) return [];
    const targetDateStr = schedulingDate;
    const matches = (notifications || []).filter(n => {
      try {
        const payload = n.payload || {};
        if (payload.target_date) {
          return payload.target_date === targetDateStr;
        }
        const notifDate = new Date(n.created_at);
        const y = notifDate.getFullYear();
        const m = String(notifDate.getMonth() + 1).padStart(2, '0');
        const d = String(notifDate.getDate()).padStart(2, '0');
        const localNotifDateStr = `${y}-${m}-${d}`;
        return localNotifDateStr === targetDateStr && n.payload;
      } catch (e) {
        return n.created_at?.slice(0, 10) === targetDateStr && n.payload;
      }
    });

    const recs = [];
    if (matches.length > 0) {
      matches.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      const latestNotif = matches[0];
      const payload = latestNotif.payload || {};
      const list = payload.outfit_recommendations || payload.proposals || [];
      list.forEach((rec, idx) => {
        recs.push({
          ...rec,
          notifId: latestNotif.id,
          recIndex: idx,
        });
      });
    }

    // Also include dailyProposal if available for target date
    if (dailyProposal && dailyProposal.date === targetDateStr && Array.isArray(dailyProposal.items) && dailyProposal.items.length > 0) {
      const alreadyHas = recs.some(r => r.name === dailyProposal.title);
      if (!alreadyHas) {
        recs.unshift({
          name: dailyProposal.title || 'Look of the Day',
          items: dailyProposal.items,
          proposalId: dailyProposal.id,
          isDailyProposal: true,
        });
      }
    }

    return recs;
  }, [schedulingDate, notifications, dailyProposal]);

  const detailMetrics = selectedOutfitForDetail ? calculateOutfitMetrics(selectedOutfitForDetail) : null;
  const overallMatchingGrade = detailMetrics ? Math.round(
    (detailMetrics.color + detailMetrics.pattern + detailMetrics.fit + detailMetrics.weather + detailMetrics.event + detailMetrics.location) / 6
  ) : 0;

  const handleSaveOutfitToDate = async (notifId, recIndex, targetDate, directRec = null) => {
    const rec = directRec || (() => {
      const notif = (notifications || []).find(n => n.id === notifId);
      return notif?.payload?.outfit_recommendations?.[recIndex] || notif?.payload?.proposals?.[recIndex];
    })();
    if (!rec) return;

    const notif = notifId ? (notifications || []).find(n => n.id === notifId) : null;
    const isEvent = (notif?.title || '').toLowerCase().includes('get ready');
    const isFallback = notif?.payload?.is_fallback || false;

    let displayName = rec.name || rec.title;
    if (!displayName) {
      try {
        const [y, m, d] = targetDate.split('-');
        const dateObj = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
        displayName = dateObj.toLocaleDateString(i18n.language || 'en', { month: 'numeric', day: 'numeric', year: 'numeric' });
      } catch (e) {
        displayName = 'Daily Look';
      }
    }
    if (isFallback && !displayName.includes('Fallback')) {
      displayName = `${displayName} (Fallback)`;
    }

    const body = {
      name: displayName,
      source_workflow: isEvent ? 'event' : 'scheduled',
      prompt: isEvent ? 'Event' : (user?.scheduler_settings?.style_dress_for || 'casual'),
      garments: (rec.items || []).map((it) => {
        const cid = it.closet_item_id || it.id;
        const ci = (closetItems || []).find((c) => c && (c.id === cid || c._id === cid));
        return {
          closet_item_id: cid,
          role: it.role,
          title: it.description || it.title || it.name,
          image_url: (ci ? bestImageUrl(ci) : null) || bestImageUrl(it) || it.clean_image_url || it.image_url || '',
        };
      }),
      usage: {
        date: targetDate,
        time: user?.scheduler_settings?.time || '08:00',
        location: null,
        event_name: null,
      },
      is_fallback: isFallback,
    };

    try {
      const saved = await api.saveOutfit(body);
      const savedOutfit = saved?.outfit || saved;
      upsert(savedOutfit);
      toast.success(t('stylist.outfitSaved', { defaultValue: 'Outfit saved and scheduled!' }));
      return savedOutfit;
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('stylist.saveFailed', { defaultValue: 'Failed to save outfit.' }));
      return null;
    }
  };

  const handleUnscheduleOutfit = async (id) => {
    try {
      const existing = outfits.find(o => o.id === id);
      if (existing) upsert({ ...existing, usage: { ...existing.usage, date: '' } });
      const updated = await api.updateSavedOutfit(id, { usage: { date: '' } });
      upsert(updated?.outfit || updated);
      toast.success(t('outfits.unscheduledSuccess', { defaultValue: 'Outfit removed from calendar.' }));
      setSchedulingDate(null);
    } catch (err) {
      incrementalSync();
      toast.error(t('outfits.failedUnschedule', { defaultValue: 'Failed to unschedule outfit.' }));
    }
  };

  const handleAssignOutfitToDate = async (outfitId, targetDate) => {
    try {
      const existingOnDate = outfits.find(o => o.usage?.date === targetDate);
      if (existingOnDate && existingOnDate.id !== outfitId) {
        upsert({ ...existingOnDate, usage: { ...existingOnDate.usage, date: '' } });
        api.updateSavedOutfit(existingOnDate.id, { usage: { date: '' } }).then(res => upsert(res?.outfit || res));
      }
      const existingOutfit = outfits.find(o => o.id === outfitId);
      if (existingOutfit) upsert({ ...existingOutfit, usage: { ...existingOutfit.usage, date: targetDate } });
      const updated = await api.updateSavedOutfit(outfitId, { usage: { date: targetDate } });
      upsert(updated?.outfit || updated);
      toast.success(t('outfits.rescheduledSuccess', { defaultValue: 'Outfit scheduled!' }));
      setSchedulingDate(null);
    } catch (err) {
      incrementalSync();
      toast.error(t('outfits.failedReschedule', { defaultValue: 'Failed to reschedule outfit.' }));
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
    setTimeout(() => {
      todayRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }, 100);
  };
  // Event Proposal Dialog state
  const [eventModalOpen, setEventModalOpen] = useStoreState(stylistUIStore, 'eventModalOpen');
  const todayStr = formatLocalDate(new Date());
  const [eventForm, setEventForm] = useState({
    event_name: '',
    location: '',
    prompt: '',
    date: todayStr,
    time: '19:00',
  });
  // Composer state
  const [text, setText] = useStoreState(stylistUIStore, 'text');
  const [imageFile, setImageFile] = useStoreState(stylistUIStore, 'imageFile');
  // Phase R: extra attachments (>1 image triggers the multi-image
  // outfit composer instead of the single-image stylist endpoint).
  const [extraImages, setExtraImages] = useStoreState(stylistUIStore, 'extraImages');
  const [includeCalendar, setIncludeCalendar] = useStoreState(stylistUIStore, 'includeCalendar');
  const [occasion, setOccasion] = useStoreState(stylistUIStore, 'occasion');
  const [calendarConnected, setCalendarConnected] = useStoreState(stylistUIStore, 'calendarConnected');
  const [busy, setBusy] = useStoreState(stylistUIStore, 'busy');
  const [recording, setRecording] = useStoreState(stylistUIStore, 'recording');
  const [interim, setInterim] = useStoreState(stylistUIStore, 'interim');
  const [speakingId, setSpeakingId] = useStoreState(stylistUIStore, 'speakingId');

  // Mobile drawers
  const [sidebarOpen, setSidebarOpen] = useStoreState(stylistUIStore, 'sidebarOpen');

  // Phase S3: ItemFloater (side-sheet preview for closet items in
  // outfit recommendations). Single instance per page — any thumbnail
  // click sets this to the closet item id and the floater slides in.
  const [floaterItemId, setFloaterItemId] = useStoreState(stylistUIStore, 'floaterItemId');

  // Browser capabilities
  const sttSupportedRef = useRef(isSTTSupported());
  const ttsSupportedRef = useRef(isTTSSupported());

  // Voice dictation session
  const dictationSessionRef = useRef(null);
  const threadRef = useRef(null);

  useEffect(() => () => {
    try { dictationSessionRef.current?.stop?.(); } catch { /* ignore */ }
  }, []);

  const userLang = (user?.preferred_language || i18n.language || 'en').split('-')[0].toLowerCase();

  const scrollToBottom = useCallback(() => {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.role === 'assistant') {
      lastAssistantRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    scrollToBottom();
  }, [scrollToBottom, busy, interim]);

  /* ---------- Load sessions + pick active safely ---------- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setSessionsLoading(true);
      try {
        const snap = await prewarmStylist({ force: true });
        if (cancelled) return;
        const rows = snap?.sessions || [];
        setSessions(rows);
        setStylistSessions(rows);
        if (rows.length > 0) {
          const activeId = snap.activeSessionId || rows[0].id;
          setActiveSessionId(activeId);
          setStylistActiveSession(activeId);
          const msgs = await loadStylistMessages(activeId, { force: true });
          if (!cancelled) setMessages(msgs || []);
        }
      } catch (err) {
        console.debug('[Stylist] prewarm failed:', err);
      } finally {
        if (!cancelled) {
          setSessionsLoading(false);
          setMessagesLoading(false);
        }
      }

      try {
        const s = await api.calendarStatus();
        if (!cancelled) setCalendarConnected(!!s?.connected);
      } catch (err) {
        console.debug('[Stylist] calendarStatus failed:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadSessions = useCallback(async () => {
    const snap = await prewarmStylist({ force: true });
    const rows = snap?.sessions || [];
    setSessions(rows);
    setStylistSessions(rows);
    return rows;
  }, [setSessions]);

  const loadMessagesFor = useCallback(async (sessionId) => {
    if (!sessionId) return;
    setMessagesLoading(true);
    try {
      const msgs = await loadStylistMessages(sessionId, { force: true });
      setMessages(msgs || []);
    } finally {
      setMessagesLoading(false);
    }
  }, [setMessages]);

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
    setStylistActiveSession(id);
    setSidebarOpen(false);
    await loadMessagesFor(id);
  };

  const handleNewConversation = async () => {
    try {
      const fresh = await api.stylistCreateSession();
      setActiveSessionId(fresh.id);
      setStylistActiveSession(fresh.id);
      setMessages([]);
      setStylistMessages(fresh.id, []);
      setText('');
      setImageFile(null);
      setSidebarOpen(false);
      const updated = [fresh, ...(sessions || []).filter(s => s.id !== fresh.id)];
      setSessions(updated);
      setStylistSessions(updated);
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('stylist.errorAdvice'));
    }
  };

  const handleDeleteSession = async (id) => {
    try {
      await api.stylistDeleteSession(id);
      const remaining = (sessions || []).filter((s) => s.id !== id);
      setSessions(remaining);
      setStylistSessions(remaining);
      if (id === activeSessionId) {
        if (remaining.length > 0) {
          setActiveSessionId(remaining[0].id);
          setStylistActiveSession(remaining[0].id);
          await loadMessagesFor(remaining[0].id);
        } else {
          // Auto-create a fresh empty session so the composer stays usable.
          const fresh = await api.stylistCreateSession();
          setSessions([fresh]);
          setStylistSessions([fresh]);
          setActiveSessionId(fresh.id);
          setStylistActiveSession(fresh.id);
          setMessages([]);
          setStylistMessages(fresh.id, []);
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

  /* ---------- Voice Dictation (Native SpeechRecognition + Server STT) ---------- */
  const startRecording = async () => {
    try {
      setInterim('');
      const session = await startDictationSession({
        lang: userLang,
        transcribeFn: async (blob) => {
          const fd = new FormData();
          fd.append('file', blob, 'stylist_dictation.webm');
          fd.append('language', userLang || 'auto');
          const res = await api.stylist.transcribeAudio(fd);
          return res?.text || '';
        },
        onInterim: (txt) => {
          if (txt) {
            setInterim(txt);
          }
        },
        onFinal: (finalText) => {
          if (finalText && finalText.trim()) {
            setText((prev) => {
              const trimmed = finalText.trim();
              if (!prev || prev.trim() === trimmed) return trimmed;
              return `${prev} ${trimmed}`;
            });
          }
          setInterim('');
        },
        onRecordingChange: (isRec) => setRecording(isRec),
        onError: () => toast.error(t('stylist.micDenied', { defaultValue: 'Microphone access denied' })),
      });
      dictationSessionRef.current = session;
    } catch (err) {
      console.debug('[Stylist] startRecording failed:', err);
      setRecording(false);
      dictationSessionRef.current = null;
    }
  };

  const stopRecording = () => {
    try {
      dictationSessionRef.current?.stop?.();
    } catch (err) {
      console.debug('[Stylist] stopRecording error:', err);
    }
    dictationSessionRef.current = null;
    setRecording(false);
    setInterim('');
  };

  /* ---------- Local TTS ---------- */
  const playLocalSpeech = async (id, txt) => {
    if (!txt) return;
    const isStr = typeof txt === 'string';
    const spokenTxt = isStr && txt.includes("trouble putting that recommendation together")
      ? t('stylist.fallbackError', { defaultValue: txt })
      : txt;
    try {
      setSpeakingId(id);
      await speak(spokenTxt, userLang);
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
    if (!isAiConfigValid()) {
      setKeyErrorOpen(true);
      return;
    }
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
        const assistantMsg = {
          id: newId,
          role: 'assistant',
          transcript: canvas?.summary || t('stylist.composeOutfitDone'),
          outfit_canvas: canvas,
        };
        setMessages((m) => [...m, assistantMsg]);
        if (res?.session_id) {
          const sId = res.session_id;
          setActiveSessionId(sId);
          setStylistActiveSession(sId);
          addStylistMessage(sId, optimistic);
          addStylistMessage(sId, assistantMsg);
        }
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
      const assistantMsg = {
        id: newId,
        role: 'assistant',
        transcript: advice.reasoning_summary,
        payload: advice,
        audioUrl,
        spokenText: advice.spoken_reply || advice.reasoning_summary || '',
      };
      setMessages((m) => [...m, assistantMsg]);
      if (res?.advice?.transcript && voiceBlob) {
        setMessages((m) =>
          m.map((msg) =>
            msg.id === optimistic.id ? { ...msg, transcript: res.advice.transcript } : msg
          )
        );
      }
      // Update the active session meta (title + snippet + id) in the sidebar and store.
      if (res.session) {
        const sId = res.session.id;
        setActiveSessionId(sId);
        setStylistActiveSession(sId);
        const updatedSessions = [res.session, ...(sessions || []).filter((s) => s.id !== sId)];
        setSessions(updatedSessions);
        setStylistSessions(updatedSessions);
        const resolvedOptimistic = res?.advice?.transcript && voiceBlob
          ? { ...optimistic, transcript: res.advice.transcript }
          : optimistic;
        addStylistMessage(sId, resolvedOptimistic);
        addStylistMessage(sId, assistantMsg);
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
    <div className="bg-white rounded-[20px] shadow-[0_12px_36px_rgba(20,30,25,0.06)] flex flex-col overflow-hidden h-[calc(100dvh-112px)]">
      <div className="flex items-center justify-between gap-2 border-b border-[#ededed] p-[15px] bg-white shrink-0">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <button
            type="button"
            onClick={() => {
              if (window.innerWidth < 1024) {
                setSidebarOpen(true);
              } else {
                setSidebarCollapsed(!sidebarCollapsed);
              }
            }}
            className="inline-flex items-center justify-center h-9 w-9 rounded-full hover:bg-black/5 transition-colors shrink-0"
            aria-label={t('stylist.openConversations')}
            data-testid="stylist-open-sidebar-btn"
          >
            <PanelLeft className="h-5 w-5 text-[var(--primary-color)]" />
          </button>
          <div className="min-w-0 flex-1 flex flex-col justify-center">
            {/* <div className="text-[11px] font-bold tracking-wide uppercase text-[var(--text-color)] whitespace-nowrap overflow-hidden text-ellipsis">{t('stylist.label')} </div> */}
            <h1 className="text-base font-extrabold text-[var(--dark-color)] whitespace-nowrap overflow-hidden text-ellipsis m-0">
              {sessions.find((s) => s.id === activeSessionId)?.title ||
                t('stylist.hero')}
            </h1>
          </div>
          <button
            type="button"
            onClick={handleNewConversation}
            className="group inline-flex items-center gap-[5px] px-3 py-1 rounded-full border border-[#dddddd] bg-white text-xs font-semibold text-[var(--text-color)] transition-all shrink-0 hover:bg-[var(--primary-color)] hover:text-white"
            data-testid="stylist-header-new-chat-btn"
          >
            <Plus className="h-3.5 w-3.5 text-[var(--primary-color)] group-hover:text-white transition-colors" />
            <span className="hidden sm:inline">{t('stylist.newConversation', { defaultValue: 'New Chat' })}</span>
          </button>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge
            variant="outline"
            className="hidden md:inline-flex items-center rounded-full text-xs font-semibold px-3 py-1 bg-white border border-[#dddddd] text-[#666]"
          >
            <CloudSun className="h-3.5 w-3.5 mr-[5px] text-[var(--primary-color)]" /> {t('stylist.weatherAware')}
          </Badge>
          {(sttSupportedRef.current || ttsSupportedRef.current) && (
            <Badge
              variant="outline"
              className="hidden md:inline-flex items-center rounded-full text-xs font-semibold px-3 py-1 bg-white border border-[#dddddd] text-[#666]"
              data-testid="stylist-native-speech-badge"
            >
              <Mic className="h-3.5 w-3.5 mr-[5px] text-[var(--primary-color)]" /> {t('stylist.nativeSpeech')}
            </Badge>
          )}
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        <div ref={threadRef} className="flex-1 min-h-0 w-full p-5 overflow-y-auto flex flex-col gap-5" data-testid="stylist-chat-thread">
          {messages.length === 0 && !busy && !messagesLoading && (
            <div className="flex-1 min-h-0 flex items-center justify-center flex-col text-center">
              <div className="">
                <Sparkles className="h-10 w-10 mx-auto mb-3 text-[var(--primary-color)]" />
                <p className="text-xl font-extrabold text-[var(--dark-color)] m-0">{t('stylist.askAnything')}</p>
                <p className="text-sm text-[var(--text-color)] mt-2 mx-auto max-w-[340px] leading-6 font-semibold">
                  {t('stylist.askAnythingSub')}
                </p>
              </div>
            </div>
          )}
          <AnimatePresence initial={false}>
            {messages.map((m, idx) => {
              const isLastAssistant = m.role === 'assistant' && idx === messages.length - 1;
              return (
                <motion.div
                  ref={isLastAssistant ? lastAssistantRef : null}
                  key={m.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    'flex min-w-0 w-full',
                    m.role === 'user' ? 'justify-end' : 'justify-start',
                  )}
                  data-testid={`chat-message-${m.role}`}
                >
                  <div
                    className={cn(
                      'max-w-[85%] min-w-0 rounded-xl border border-transparent px-5 py-[15px] break-words',
                      m.role === 'user'
                        ? 'bg-[var(--primary-color)] border-[var(--primary-color)]'
                        : 'bg-[#edf2f0] border-[#ededed]',
                    )}
                  >
                    {m.imagePreview && (
                      <img
                        src={m.imagePreview}
                        alt="attachment"
                        className="rounded-[10px] mb-2 max-h-[190px] object-cover"
                      />
                    )}
                    {m.imagePreviews && m.imagePreviews.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2" data-testid="stylist-msg-image-grid">
                        {m.imagePreviews.map((src, i) => (
                          <img
                            key={i}
                            src={src}
                            alt=""
                            className="h-20 w-20 rounded-[10px] object-cover border border-border"
                          />
                        ))}
                      </div>
                    )}
                    {m.role === 'assistant' && (m.payload?.fallback_from_quota || m.payload?.provider_fallback?.quota_exhausted) && (
                      <div className="mb-2.5 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-900 text-xs flex items-center gap-2 font-medium" data-testid="stylist-fallback-quota-banner">
                        <Info className="h-4 w-4 shrink-0 text-amber-600" />
                        <span>
                          {t('stylist.fallbackQuotaBanner', {
                            defaultValue: 'Custom API key quota was exceeded. Request fulfilled seamlessly using DressApp on-prem AI (Gemma-4-E4B).'
                          })}
                        </span>
                      </div>
                    )}
                    {m.transcript && (
                      <p className={cn(
                        "text-sm whitespace-pre-wrap m-0",
                        m.role === 'user' ? "leading-none text-white" : "leading-6 text-[var(--dark-color)]"
                      )}>
                        {typeof m.transcript === 'string'
                          ? (m.transcript.includes("trouble putting that recommendation together")
                            ? t('stylist.fallbackError', { defaultValue: m.transcript })
                            : m.transcript)
                          : JSON.stringify(m.transcript)}
                      </p>
                    )}
                    {m.role === 'assistant' && m.outfit_canvas && (
                      <div className="mt-3">
                        <OutfitCanvasMessage canvas={m.outfit_canvas} sessionId={activeSessionId} />
                      </div>
                    )}
                    {m.role === 'assistant' && m.payload && (
                      <div className="mt-3 flex flex-col gap-3">
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
                          <div className="bg-yellow-shadow border border-yellow-border rounded-[12px] p-3 text-xs text-[#7a5b12]">
                            <div className="font-bold flex items-center gap-1.5 mb-1.5">
                              <Sparkles className="h-3.5 w-3.5 text-primary-brand" />
                              {t('stylist.shoppingSuggestions', { defaultValue: 'AI Stylist Shopping Suggestions' })}
                            </div>
                            <ul className="list-disc pl-4 m-0 flex flex-col gap-1">
                              {m.payload.shopping_suggestions.filter(Boolean).map((s, k) => (
                                <li key={`shop-sug-${k}`}>{s}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {(m.payload.source_workflow === 'scheduled' || m.payload.source_workflow === 'event') && (
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRetry(m)}
                              disabled={busy}
                              className="rounded-full text-xs gap-1.5 shadow-none bg-[var(--primary-color)] text-white px-2.5 py-[5px] hover:bg-[var(--dark-color)]"
                              data-testid={`retry-proposals-${m.id}`}
                            >
                              <RefreshCw className={cn("h-3 w-3", busy && "animate-spin")} />
                              {t('stylist.suggestOthers', { defaultValue: 'Suggest 3 Others' })}
                            </Button>
                          </div>
                        )}
                        {Array.isArray(m.payload.do_dont) && m.payload.do_dont.filter(Boolean).length > 0 && (
                          <div className="text-xs text-[var(--text-color)]">
                            <div className="text-[11px] font-bold tracking-wide uppercase mb-1">
                              {t('stylist.doDont', { defaultValue: 'Do & Don\'t' })}
                            </div>
                            <ul className="list-disc ps-5 m-0 flex flex-col gap-0.5">
                              {m.payload.do_dont.filter(Boolean).map((d, k) => (
                                <li key={`${m.id || 'msg'}-dd-${k}-${String(d).slice(0, 24)}`}>{d}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {m.payload.weather_summary && (
                          <div className="text-[11px] font-bold tracking-wide uppercase text-[var(--text-color)]">
                            {t('stylist.contextLabel', { defaultValue: 'Context' })}: {m.payload.weather_summary}
                            {m.payload.calendar_summary
                              ? ` · ${m.payload.calendar_summary}`
                              : ''}
                          </div>
                        )}
                        {Array.isArray(m.payload.generated_examples) && m.payload.generated_examples.filter(Boolean).length > 0 && (
                          <div className="" data-testid="stylist-generated-examples">
                            <div className="text-[11px] font-bold tracking-wide uppercase text-[var(--text-color)] mb-1">
                              {t('stylist.examplesLabel', { defaultValue: 'Examples' })}
                            </div>
                            <div className="flex gap-2 flex-wrap">
                              {m.payload.generated_examples.filter(Boolean).map((ex, k) => (
                                <figure key={`gen-${m.id}-${k}`} className="w-32 m-0">
                                  <img
                                    src={ex.image_data_url}
                                    alt={ex.caption || ex.category}
                                    loading="lazy"
                                    className="w-full aspect-square rounded-[10px] border border-black/[0.08] object-cover"
                                  />
                                  <figcaption className="text-[11px] text-[var(--text-color)] mt-1 line-clamp-2">
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
                            <div className="" data-testid="stylist-marketplace-strip">
                              <div className="text-[11px] font-bold tracking-wide uppercase text-[var(--text-color)] flex items-center gap-1 mb-1">
                                <ShoppingBag className="h-3 w-3" />
                                {t('stylist.marketplaceLabel', { defaultValue: 'Marketplace' })}
                              </div>
                              <div className="flex gap-2 overflow-x-auto pb-1">
                                {mktList.filter(Boolean).map((s) => (
                                  <Link
                                    key={`mkt-${m.id}-${s.listing_id}`}
                                    to={`/marketplace/${s.listing_id}`}
                                    className="block min-w-[120px] max-w-[200px] w-max shrink-0 rounded-[10px] border border-black/[0.08] bg-white no-underline transition-all hover:border-[var(--primary-color)]"
                                  >
                                    {s.image_url && (
                                      <img src={s.image_url} alt="" className="w-full aspect-square rounded-t-[10px] object-cover" />
                                    )}
                                    <div className="p-1.5">
                                      <div className="text-[11px] leading-[1.3] text-[var(--dark-color)] line-clamp-2">{s.title}</div>
                                      {s.price_cents != null && (
                                        <div className="text-[10px] text-[var(--text-color)] mt-0.5">
                                          {s.currency === 'USD' ? '$' : s.currency === 'ILS' ? '₪' : ''}{(s.price_cents / 100).toFixed(0)}
                                        </div>
                                      )}
                                    </div>
                                  </Link>
                                ))}
                              </div>
                            </div>
                          );
                        })()}

                        {Array.isArray(m.payload.applied_preferences) && m.payload.applied_preferences.filter(Boolean).length > 0 && (
                          <details className="text-[11px] text-[var(--text-color)]">
                            <summary className="cursor-pointer hover:text-[var(--dark-color)]">
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
                                className="rounded-full h-8"
                                data-testid={`stylist-stop-speak-${m.id}`}
                              >
                                <VolumeX className="h-3.5 w-3.5 me-1" />
                                {t('stylist.stopSpeaking', { defaultValue: 'Stop Speaking' })}
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => playLocalSpeech(m.id, m.spokenText)}
                                className="rounded-full h-8"
                                data-testid={`stylist-play-speak-${m.id}`}
                              >
                                <Volume2 className="h-3.5 w-3.5 me-1" />
                                {t('stylist.playReply', { defaultValue: 'Play Reply' })}
                              </Button>
                            )}
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
          {busy && (
            <div className="flex min-w-0 justify-start" data-testid="stylist-thinking">
              <div className="max-w-[85%] min-w-[280px] rounded-[18px] border border-black/[0.08] bg-white p-4 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-5 rounded-full" />
                  <span className="text-[11px] font-bold tracking-wide uppercase text-[var(--text-color)]">{t('stylist.thinking', { defaultValue: 'Thinking...' })}</span>
                </div>
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-3.5 rounded-md w-3/4" />
                  <Skeleton className="h-3.5 rounded-md w-1/2" />
                  <Skeleton className="h-3.5 rounded-md w-[85%]" />
                </div>
                <p className="text-xs text-[var(--text-color)] pt-1 m-0">
                  {t('stylist.thinkingSub', { defaultValue: 'Your stylist is coming up with something...' })}
                </p>
              </div>
            </div>
          )}
          {recording && interim && (
            <div
              className="flex min-w-0 justify-end"
              data-testid="stylist-interim-transcript"
            >
              <div className="max-w-[85%] min-w-0 rounded-[18px] border border-dashed border-[var(--primary-color)]/40 bg-[var(--primary-color)]/5 px-4 py-3 break-words">
                <div className="text-[11px] font-bold tracking-wide uppercase text-[var(--primary-color)] mb-1">
                  {t('stylist.listening', { defaultValue: 'Listening...' })}
                </div>
                <p className="text-[13.5px] italic whitespace-pre-wrap m-0 text-[var(--dark-color)]">{interim}</p>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>
      <div className="border-t border-black/[0.08] p-3 flex flex-col gap-3 bg-white shrink-0">
        {/* Quick Actions Row */}
        <div className="flex items-center gap-2 flex-wrap text-[var(--text-color)]" data-testid="stylist-scheduler-actions">
          <Button
            size="xs"
            variant="outline"
            onClick={handleTriggerScheduled}
            disabled={busy}
            className="rounded-full bg-white text-[12px] gap-1 border border-[var(--primary-color)] px-2 py-0.5 shadow-none text-[var(--primary-color)] hover:!bg-[var(--primary-color)] hover:text-white"
            data-testid="stylist-daily-suggestion-btn"
          >
            <Sparkles className="h-3 w-3" />
            {t('stylist.dailySuggestion', { defaultValue: 'Daily Suggestion' })}
          </Button>
          <Button
            size="xs"
            variant="outline"
            onClick={() => setEventModalOpen(true)}
            disabled={busy}
            className="rounded-full bg-white text-[12px] gap-1 border border-[var(--primary-color)] px-2 py-0.5 shadow-none text-[var(--primary-color)] hover:!bg-[var(--primary-color)] hover:text-white"
            data-testid="stylist-plan-event-btn"
          >
            <CalIcon className="h-3 w-3" />
            {t('stylist.planEventOutfit', { defaultValue: 'Plan Event Outfit' })}
          </Button>
          <Button
            variant="outline"
            size="xs"
            onClick={() => navigate('/trends')}
            className="rounded-full bg-white text-[12px] gap-1 border border-[var(--primary-color)] px-2 py-0.5 shadow-none text-[var(--primary-color)] hover:!bg-[var(--primary-color)] hover:text-white"
            data-testid="stylist-trends-btn"
          >
            <TrendingUp className="h-3 w-3" />
            {t('home.trendScout', { defaultValue: 'Trends' })}
          </Button>
          {imageFile && (
            <div
              className="flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-2 py-0.5 text-[11px]"
              data-testid="stylist-attached-image"
            >
              <img
                src={URL.createObjectURL(imageFile)}
                alt=""
                className="h-5 w-5 rounded object-cover"
              />
              <span className="max-w-[120px] whitespace-nowrap overflow-hidden text-ellipsis">{imageFile.name}</span>
              <button
                onClick={() => setImageFile(null)}
                aria-label={t('stylist.removeImage', { defaultValue: 'Remove Image' })}
                data-testid="stylist-remove-image"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
          {extraImages.map((f, idx) => (
            <div
              key={`extra-${idx}-${f.name}`}
              className="flex items-center gap-1.5 rounded-full border border-[var(--primary-color)]/40 bg-[var(--primary-color)]/5 px-2 py-0.5 text-[11px]"
              data-testid={`stylist-extra-image-${idx}`}
            >
              <img
                src={URL.createObjectURL(f)}
                alt=""
                className="h-5 w-5 rounded object-cover"
              />
              <span className="max-w-[120px] whitespace-nowrap overflow-hidden text-ellipsis">{f.name}</span>
              <button
                onClick={() =>
                  setExtraImages((prev) => prev.filter((_, i) => i !== idx))
                }
                aria-label={t('stylist.removeImage', { defaultValue: 'Remove Image' })}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          {(imageFile || extraImages.length > 0) && (imageFile ? 1 : 0) + extraImages.length >= 2 && (
            <Badge
              variant="outline"
              className="border-[var(--primary-color)]/60 text-[var(--primary-color)] text-[10px] h-5 px-2"
              data-testid="stylist-compose-mode-badge"
            >
              <Sparkles className="h-2.5 w-2.5 mr-1" />
              {t('stylist.composeOutfitMode', { defaultValue: 'Compose Outfit Mode' })}
            </Badge>
          )}
          <div className="">
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
                  ? t('stylist.askProfessionalLocal', { defaultValue: 'Ask a local professional' })
                  : t('stylist.askProfessionalSoon', { defaultValue: 'Ask a professional (coming soon)' })
              }
              className="rounded-full bg-white text-[12px] gap-1 border border-[var(--primary-color)] px-2 py-0.5 shadow-none text-[var(--primary-color)] inline-flex items-center hover:bg-[var(--primary-color)] hover:text-white"
              data-testid="stylist-ask-professional-btn"
            >
              <UserRound className="h-3 w-3" />
              {t('stylist.askProfessional', { defaultValue: 'Ask a Professional' })}
            </button>
          </div>
        </div>
        <div className="relative flex items-center gap-2 border border-[#ccc] bg-white rounded-full p-2 transition-all focus-within:border-[var(--primary-color)] focus-within:shadow-[0_0_0_3px_rgba(31,92,69,0.15)]">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={1} placeholder={t('stylist.composerPlaceholder', { defaultValue: 'Type your message...' })}
            className="flex-1 min-h-9 max-h-40 border-0 mb-0 bg-transparent resize-none p-1.5 text-sm shadow-none focus-visible:outline-none focus-visible:shadow-none" data-testid="stylist-composer-textarea" />
          <div className="flex items-center gap-1 shrink-0">
            {recording ? (
              <Button
                size="icon"
                variant="destructive"
                onClick={stopRecording}
                className="h-3.5 w-3.5 rounded-xl bg-[#d13c3c] text-white"
                aria-label={t('stylist.tapToStop', { defaultValue: 'Tap to Stop' })}
                data-testid="stylist-composer-mic-button"
              >
                <Square className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                size="icon"
                variant="ghost"
                onClick={startRecording}
                className="h-3.5 w-3.5 rounded-xl text-[var(--text-color)] hover:text-[var(--dark-color)]"
                data-testid="stylist-composer-mic-button"
                aria-label={t('stylist.recordVoice', { defaultValue: 'Record Voice' })}
              >
                <Mic className="h-4 w-4" />
              </Button>
            )}
            <AttachmentPicker maxItems={7} currentCount={(imageFile ? 1 : 0) + extraImages.length}
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
                <div
                  className="inline-flex items-center justify-center h-9 w-9 cursor-pointer shrink-0"
                  aria-label={t('stylist.attachPhoto', { defaultValue: 'Attach Photo' })}
                  data-testid="stylist-composer-attach-button"
                >
                  <ImgIcon className="h-4 w-4 text-[var(--text-color)]" />
                </div>
              }
            />
            <Button
              size="icon"
              variant="default"
              onClick={() => sendTurn({})}
              disabled={busy || (!text.trim() && !imageFile && extraImages.length === 0)}
              className="h-9 w-9 rounded-full bg-[var(--primary-color)] text-white hover:bg-[var(--primary-hover)]"
              data-testid="stylist-composer-send-button"
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
  const renderOutfitDetailPane = () => {
    if (!selectedOutfitForDetail) return null;
    const detailMetrics = calculateOutfitMetrics(selectedOutfitForDetail);
    const overallMatchingGrade = detailMetrics ? Math.round(
      (detailMetrics.color + detailMetrics.pattern + detailMetrics.fit + detailMetrics.weather + detailMetrics.event + detailMetrics.location) / 6
    ) : 0;

    const detailColors = selectedOutfitForDetail.garments
      ? selectedOutfitForDetail.garments
        .map((g) => {
          const item = closetItems.find((it) => it.id === g.closet_item_id);
          const name = g.color || item?.color || (Array.isArray(item?.colors) && item.colors[0]?.name) || null;
          return name ? { name } : null;
        })
        .filter(Boolean)
      : [];

    const isDaily = Boolean(selectedOutfitForDetail.isDailyProposal);
    const todayDateStr = formatLocalDate(new Date());
    const outfitDateStr = selectedOutfitForDetail?.usage?.date || selectedOutfitForDetail?.date || selectedOutfitForDetail?.proposal_raw?.date || todayDateStr;
    const isTomorrow = outfitDateStr > todayDateStr || Boolean(selectedOutfitForDetail?.proposal_raw?.is_tomorrow || selectedOutfitForDetail?.is_tomorrow);
    const currentLookIndex = (proposals || []).findIndex(p => p.id === (selectedOutfitForDetail.proposal_raw?.id || selectedOutfitForDetail.id));
    const idx = currentLookIndex >= 0 ? currentLookIndex : Math.max(0, (proposals?.length || 1) - 1);
    const totalLooks = Math.max(1, proposals?.length || 1);

    return (
      <div className='bg-white rounded-[12px] shadow-[0_12px_36px_rgba(20,30,25,0.06)] p-5'>
        <div className="flex items-center justify-between pb-5 flex-wrap gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setUserDismissedDetail(true);
              setSelectedOutfitForDetail(null);
              setIsEditingOutfit(false);
            }}
            className="rounded-full h-auto text-xs font-semibold inline-flex items-center gap-1 px-5 py-[5px] leading-[22px] !shadow-none p-0 !text-[var(--dark-color)] hover:!text-[var(--primary-color)]"
          >
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" /> {t('common.back', { defaultValue: 'Back' })}
          </Button>
          <div className="flex items-center gap-2 flex-wrap">
            {isDaily ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={generatingDaily}
                  onClick={async () => {
                    setGeneratingDaily(true);
                    try {
                      const newProp = await generateDailyProposalAction(true, 'daily', outfitDateStr);
                      if (newProp) {
                        setSelectedOutfitForDetail(proposalToOutfit(newProp, outfitDateStr));
                        toast.success(
                          isTomorrow
                            ? t('stylist.tomorrowSuggestionRefreshed', { defaultValue: 'Refreshed tomorrow’s suggestion!' })
                            : t('stylist.suggestionRefreshed', { defaultValue: 'Refreshed today’s suggestion!' })
                        );
                      }
                    } catch {
                      toast.error(t('common.error', { defaultValue: 'Failed to refresh' }));
                    } finally {
                      setGeneratingDaily(false);
                    }
                  }}
                  className="rounded-full h-auto text-xs font-semibold inline-flex items-center gap-1.5 px-4 py-[5px] leading-[22px] !shadow-none border border-[#666] hover:!border-[var(--primary-color)] hover:!text-[var(--primary-color)]"
                >
                  <RefreshCw className={cn("!h-3.5 !w-3.5", generatingDaily && "animate-spin")} />
                  <span>{t('stylist.refreshSuggestion', { defaultValue: 'New Look' })}</span>
                </Button>
                <Button
                  size="sm"
                  onClick={async () => {
                    await handleWearDailyProposal(selectedOutfitForDetail.proposal_raw || selectedOutfitForDetail);
                  }}
                  className="rounded-full h-auto text-xs font-semibold inline-flex items-center gap-1.5 px-5 py-[5px] leading-[22px] text-white !bg-[var(--primary-color)] hover:!bg-[var(--dark-color)] !shadow-none"
                >
                  <CalendarPlus className="!h-3.5 !w-3.5" />
                  <span>
                    {isTomorrow
                      ? t('stylist.wearTomorrow', { defaultValue: 'Wear Tomorrow' })
                      : t('stylist.wearToday', { defaultValue: 'Wear Today' })}
                  </span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShareDetailModalOpen(true)}
                  className="rounded-full h-auto text-xs font-semibold inline-flex items-center gap-2 px-4 py-[5px] leading-[22px] !shadow-none border border-[#666] hover:!border-[var(--primary-color)] hover:!text-[var(--primary-color)]"
                >
                  <Share2 className="!h-3.5 !w-3.5" /> {t('common.share', { defaultValue: 'Share' })}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setEditOutfitName(selectedOutfitForDetail.name);
                    setEditOutfitDescription(selectedOutfitForDetail.description || selectedOutfitForDetail.prompt || '');
                    setIsEditingOutfit(true);
                  }}
                  className="!bg-[var(--primary-color)] px-5 py-[5px] rounded-full text-xs leading-[22px] !text-white h-auto w-auto inline-flex !gap-2 hover:!bg-[var(--dark-color)]"
                  title={t('common.edit', { defaultValue: 'Edit' })}
                >
                  <Pencil className="!h-3 !w-3" />{t('common.edit', { defaultValue: 'Edit' })}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={async () => {
                    await deleteOutfit(selectedOutfitForDetail.id);
                    setSelectedOutfitForDetail(null);
                    setIsEditingOutfit(false);
                  }}
                  className="rounded-full h-auto text-xs font-semibold inline-flex items-center gap-2 px-5 py-[5px] leading-[22px] !shadow-none"
                >
                  <Trash2 className="!h-3.5 !w-3.5" /> {t('common.delete', { defaultValue: 'Delete' })}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShareDetailModalOpen(true)}
                  className="rounded-full h-auto text-xs font-semibold inline-flex items-center gap-2 px-5 py-[5px] leading-[22px] !shadow-none border border-[#666] hover:!border-[var(--primary-color)] hover:!text-[var(--primary-color)]"
                >
                  <Share2 className="!h-3.5 !w-3.5" /> {t('common.share', { defaultValue: 'Share' })}
                </Button>
              </>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-1">
            {/* Large Avatar Viewer */}
            <div className="relative w-full h-full bg-[#ddd] rounded-[12px] overflow-hidden border border-border aspect-[4/5]">
              <AvatarViewer
                shapeParams={user?.avatar_shape_params || {}}
                sex={user?.sex || 'female'}
                outfitItems={getOutfitPiecesMap(selectedOutfitForDetail, closetItems)}
              />
            </div>
          </div>
          <div className="md:col-span-3">
            {/* Details and Items */}
            <div className="flex flex-col justify-between gap-6">
              <div className="flex flex-col gap-4">

                {isEditingOutfit ? (
                  <div className="flex flex-col gap-3 pt-2">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                      <div className="md:col-span-12">
                        <div className="field-set">
                          <Label htmlFor="edit-outfit-name">{t('outfits.editName', { defaultValue: 'Outfit Name' })}</Label>
                          <Input
                            id="edit-outfit-name"
                            value={editOutfitName}
                            onChange={(e) => setEditOutfitName(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="md:col-span-12">
                        <div className="field-set">
                          <Label htmlFor="edit-outfit-desc">{t('outfits.editDescription', { defaultValue: 'Description' })}</Label>
                          <Textarea
                            id="edit-outfit-desc"
                            value={editOutfitDescription}
                            onChange={(e) => setEditOutfitDescription(e.target.value)}
                            rows={3}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEditingOutfit(false)}
                        className="rounded-full h-auto text-xs font-semibold inline-flex items-center gap-2 px-5 py-[5px] leading-[22px] !shadow-none border border-[#666] hover:!border-[var(--primary-color)] hover:!text-[var(--primary-color)]"
                      >
                        {t('common.cancel', { defaultValue: 'Cancel' })}
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSaveOutfitEdits}
                        className="!bg-[var(--primary-color)] px-5 py-[5px] rounded-full text-xs leading-[22px] text-white h-auto w-auto inline-flex !gap-2 hover:!bg-[var(--dark-color)]"
                      >
                        {t('common.save', { defaultValue: 'Save' })}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="">
                      <h3 className="text-xl font-extrabold text-[var(--dark-color)] leading-[30px]">
                        {getOutfitName(selectedOutfitForDetail.name)}
                      </h3>
                      <div className="mt-1">
                        <HarmonyBadge colors={detailColors.length > 0 ? detailColors : [{ name: 'Neutral' }, { name: 'Earthy' }]} />
                      </div>
                    </div>
                    {(selectedOutfitForDetail.description || selectedOutfitForDetail.prompt) && (
                      <p className="text-sm text-[var(--text-color)] leading-6 font-semibold">
                        {getOutfitDescription(selectedOutfitForDetail.description) || labelForDressCode((selectedOutfitForDetail.prompt || '').toLowerCase(), t)}
                      </p>
                    )}
                  </>
                )}
                <Separator />
                <div className="flex flex-col gap-2 text-xs text-[var(--muted-foreground)]">
                  <div className="flex items-center gap-2">
                    <CalIcon className="h-4 w-4 text-[var(--primary-color)]" />
                    <span className="font-bold text-[var(--text-color)]">
                      {selectedOutfitForDetail?.usage?.date || t('calendar.unscheduled', { defaultValue: 'Not scheduled' })} {selectedOutfitForDetail?.usage?.date && selectedOutfitForDetail?.usage?.time ? `· ${selectedOutfitForDetail.usage.time}` : ''}
                    </span>
                  </div>
                  {selectedOutfitForDetail?.usage?.location && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-[var(--primary-color)]" />
                      <span className="overflow-hidden text-ellipsis whitespace-nowrap font-bold text-[var(--text-color)]">{selectedOutfitForDetail.usage.location}</span>
                    </div>
                  )}
                </div>
                <Separator />
                <Tabs defaultValue="pieces" className="w-full">
                  <TabsList className="inline-flex items-center gap-0 bg-[var(--accent-beige)] border border-[#ebebeb] rounded-full p-1 mb-5 w-fit">
                    <TabsTrigger
                      value="pieces"
                      className="flex items-center gap-1.5 text-xs font-semibold text-[#6b655c] bg-transparent border-none rounded-full px-4 py-1.5 transition-colors duration-180 hover:text-[#24211d] data-[state=active]:bg-white data-[state=active]:text-[#24211d] data-[state=active]:shadow-sm"
                    >
                      {t('outfits.piecesTab', { defaultValue: 'Pieces' })}
                    </TabsTrigger>
                    <TabsTrigger
                      value="metrics"
                      className="flex items-center gap-1.5 text-xs font-semibold text-[#6b655c] bg-transparent border-none rounded-full px-4 py-1.5 transition-colors duration-180 hover:text-[#24211d] data-[state=active]:bg-white data-[state=active]:text-[#24211d] data-[state=active]:shadow-sm"
                    >
                      <span>{t('outfits.metricsTabLabel', { defaultValue: 'Metrics' })}</span>
                      <span className="tabular-nums text-[#6b655c] [[data-state=active]_&]:text-[#2f4a3d] [[data-state=active]_&]:font-bold">={overallMatchingGrade || 85}%</span>
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="pieces" className="w-full">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-color)] mb-3.5">
                      {t('outfits.outfitPieces', { defaultValue: 'Outfit Pieces' })}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 max-[420px]:grid-cols-1 gap-3">
                      {Array.isArray(selectedOutfitForDetail?.garments) && selectedOutfitForDetail.garments.map((g, idx) => {
                        const closetItem = closetItems.find(it => it && it.id === g.closet_item_id);
                        const imgUrl = resolveMediaUrl(bestImageUrl(closetItem) || g.image_url || g.clean_image_url || closetItem?.image_url);
                        return (
                          <div
                            key={idx}
                            onClick={() => navigate(`/closet/${g.closet_item_id}`, {
                              state: {
                                fromOutfits: true,
                                returnToOutfitId: selectedOutfitForDetail.id
                              }
                            })}
                            className="bg-white border border-[#ccc] rounded-[12px] p-3.5 flex items-center gap-3 cursor-pointer transition-all duration-180 hover:border-[var(--primary-color)] hover:shadow-[0_4px_14px_rgba(31,107,92,0.1)] hover:-translate-y-0.5 group"
                          >
                            <div className="w-12 h-12 rounded-xl bg-[var(--primary-shadow)] text-[var(--primary-color)] flex items-center justify-center flex-shrink-0 overflow-hidden">
                              <PieceThumbnail
                                imgUrl={imgUrl}
                                alt={g.title || ''}
                                role={g.role}
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--primary-color)] mb-0.5">{labelForRole(g.role, t)}</div>
                              <div className="text-[13px] font-semibold text-[var(--text-color)] overflow-hidden text-ellipsis whitespace-nowrap">
                                {g.title || g.description || closetItem?.title || closetItem?.name || t('addItem.preflight.untitled', { defaultValue: 'Garment' })}
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0 transition-all duration-180 group-hover:text-[var(--primary-color)] group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
                          </div>
                        );
                      })}
                    </div>
                  </TabsContent>
                  <TabsContent value="metrics" className="w-full">
                    {/* Stat cards */}
                    <div className="grid grid-cols-3 max-[480px]:grid-cols-1 gap-3 mb-[15px]">
                      <div className="bg-white rounded-[12px] p-[15px] border border-[#ccc] transition-all duration-180 hover:border-[var(--primary-color)] hover:shadow-[0_4px_14px_rgba(31,107,92,0.08)]">
                        <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#7c837e] mb-1">
                          {t('outfits.styleLabel', { defaultValue: 'Style' })}
                        </div>
                        <div className="text-base font-bold text-[#1c1f1d]">
                          {labelForDressCode(determineOutfitStyle(selectedOutfitForDetail).toLowerCase(), t)}
                        </div>
                      </div>
                      <div className="bg-white rounded-[12px] p-[15px] border border-[#ccc] transition-all duration-180 hover:border-[var(--primary-color)] hover:shadow-[0_4px_14px_rgba(31,107,92,0.08)]">
                        <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#7c837e] mb-1">
                          {t('outfits.wornLabel', { defaultValue: 'Times Worn' })}
                        </div>
                        <div className="text-base font-bold text-[#1c1f1d]">
                          {selectedOutfitForDetail.use_count || 0}
                        </div>
                      </div>
                      <div className="bg-white rounded-[12px] p-[15px] border border-[#ccc] transition-all duration-180 hover:border-[var(--primary-color)] hover:shadow-[0_4px_14px_rgba(31,107,92,0.08)]">
                        <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#7c837e] mb-1">
                          {t('outfits.valueLabel', { defaultValue: 'Total Value' })}
                        </div>
                        <div className="text-base font-bold text-[#1c1f1d]">
                          {t('common.currencyFormat', { defaultValue: '${{val}}', val: calculateOutfitValue(selectedOutfitForDetail).toFixed(2) })}
                        </div>
                      </div>
                    </div>

                    {/* Progress bars */}
                    <div className="flex flex-col gap-[18px]">
                      {[
                        { label: t('outfits.metrics.color', { defaultValue: 'Color Matching' }), val: detailMetrics?.color || 0 },
                        { label: t('outfits.metrics.pattern', { defaultValue: 'Pattern Matching' }), val: detailMetrics?.pattern || 0 },
                        { label: t('outfits.metrics.fit', { defaultValue: 'Body Fitting' }), val: detailMetrics?.fit || 0 },
                        { label: t('outfits.metrics.weather', { defaultValue: 'Match to Weather' }), val: detailMetrics?.weather || 0 },
                        { label: t('outfits.metrics.event', { defaultValue: 'Match to Event' }), val: detailMetrics?.event || 0 },
                        { label: t('outfits.metrics.location', { defaultValue: 'Match to Location' }), val: detailMetrics?.location || 0 }
                      ].map((m, idx) => (
                        <div key={idx} className="flex flex-col gap-1.5">
                          <div className="flex justify-between items-baseline">
                            <span className="text-[12px] font-medium text-text-brand">{m.label}</span>
                            <span className="text-[12px] font-bold text-dark-brand tabular-nums">{m.val}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-[var(--accent-beige)] rounded-full overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full bg-[var(--primary-color)] transition-[width] duration-600 ease-in-out",
                                m.val < 50 && "!bg-[#7fb0a3]",
                                m.val >= 50 && m.val < 80 && "!bg-[#4e9382]"
                              )}
                              style={{ width: `${m.val}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </div>
        </div>
        <ShareOutfitModal open={shareDetailModalOpen} onOpenChange={setShareDetailModalOpen} outfit={selectedOutfitForDetail} />
      </div>
    );
  };

  return (
    <>
      {/* banner-start */}
      <PageHeroBanner image={ClosetBanner}>
        <div className="relative z-10 w-full">
          <div
            className="
              px-10 py-20
               max-[991px]:px-[15px] max-[991px]:py-[30px]
            max-[767px]:px-[15px] max-[767px]:py-[30px]
            max-[480px]:px-[15px] max-[480px]:py-[30px]
            "
          >
            <div className="max-w-[520px]">
              {/* Title */}
              <h1
                className="
                  m-0 mb-0
                  text-[40px] leading-[40px]
                  font-bold
                  tracking-normal
                  text-white
                  max-[767px]:text-[30px]
                max-[480px]:text-[20px]
                max-[480px]:leading-[30px]
                max-[480px]:mb-3
                "
              >
                {t('stylist.heroTitle', { defaultValue: 'Your Personal AI Stylist' })}
              </h1>
              {/* Description */}
              <p
                className="
                  my-5
                  max-w-[450px]
                  text-[14px]
                  leading-6
                  tracking-[0.5px]
                  text-white/60
                  max-[767px]:max-w-full
                  max-[767px]:mt-[15px]
                "
              >
                {t('stylist.heroDescription', { defaultValue: 'Get personalized outfit recommendations, style advice, and fashion inspiration tailored to your wardrobe, occasion, and local weather.' })}
              </p>
            </div>
          </div>
        </div>
      </PageHeroBanner>
      <section className='px-[40px] py-[40px] bg-[var(--accent-beige)] max-[991px]:px-[15px] max-[991px]:py-[30px]
            max-[767px]:px-[15px] max-[767px]:py-[30px]
            max-[480px]:px-[15px] max-[480px]:py-[30px]'>
        <div className='w-full'>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className={cn("h-full hidden lg:block lg:col-span-3", (sidebarCollapsed || activeTab !== 'chat') && "!hidden")}>
              <aside className={cn("hidden lg:flex h-full w-full bg-white rounded-[12px] border border-border shadow-sm hover:shadow-md overflow-hidden transition-all duration-300", (sidebarCollapsed || activeTab !== 'chat') && "!hidden")}
                data-testid="stylist-conversation-sidebar">
                <ConversationSidebar
                  sessions={sessions}
                  activeId={activeSessionId}
                  onSelect={handleSelectSession}
                  onNew={handleNewConversation}
                  onDelete={handleDeleteSession}
                  loading={sessionsLoading}
                />
              </aside>
            </div>
            <div className={cn("h-full min-w-0", (sidebarCollapsed || activeTab !== 'chat') ? "lg:col-span-12" : "lg:col-span-9")}>
              <main className="min-w-0 h-full flex flex-col overflow-hidden">
                <Tabs value={activeTab} onValueChange={setActiveTab} dir={i18n.dir()} className="w-full min-w-0 h-full flex flex-col overflow-hidden">
                  <div className="inline-flex items-center gap-1 p-[5px] bg-white rounded-full shadow-[0_8px_24px_rgba(20,30,25,0.06)] mb-4 w-fit max-[480px]:rounded-[12px]">
                    <TabsList className="flex items-center gap-1 bg-transparent p-0 h-auto flex-wrap max-[480px]:items-start">
                      <TabsTrigger value="chat" className="group inline-flex items-center gap-[7px] px-5 py-[11px] rounded-full text-[13px] font-bold text-[var(--text-color)] bg-transparent border-none shadow-none transition-all whitespace-nowrap hover:text-[var(--primary-color)] hover:bg-[var(--primary-shadow)] data-[state=active]:bg-[var(--primary-color)] data-[state=active]:text-white max-sm:flex-1 max-sm:justify-center max-sm:px-2.5 max-sm:py-2.5 max-sm:text-[11.5px]">
                        <MessageSquare className="h-[15px] w-[15px] text-[var(--primary-color)] shrink-0 transition-all group-data-[state=active]:text-white" />
                        {t('stylist.chatPanel')}
                      </TabsTrigger>
                      <TabsTrigger value="shuffle" className="group inline-flex items-center gap-[7px] px-5 py-[11px] rounded-full text-[13px] font-bold text-[var(--text-color)] bg-transparent border-none shadow-none transition-all whitespace-nowrap hover:text-[var(--primary-color)] hover:bg-[var(--primary-shadow)] data-[state=active]:bg-[var(--primary-color)] data-[state=active]:text-white max-sm:flex-1 max-sm:justify-center max-sm:px-2.5 max-sm:py-2.5 max-sm:text-[11.5px]">
                        <Shirt className="h-[15px] w-[15px] text-[var(--primary-color)] shrink-0 transition-all group-data-[state=active]:text-white" />
                        {t('stylist.outfitPlanner', { defaultValue: 'Outfit Planner' })}
                      </TabsTrigger>
                      <TabsTrigger value="match" className="group inline-flex items-center gap-[7px] px-5 py-[11px] rounded-full text-[13px] font-bold text-[var(--text-color)] bg-transparent border-none shadow-none transition-all whitespace-nowrap hover:text-[var(--primary-color)] hover:bg-[var(--primary-shadow)] data-[state=active]:bg-[var(--primary-color)] data-[state=active]:text-white max-sm:flex-1 max-sm:justify-center max-sm:px-2.5 max-sm:py-2.5 max-sm:text-[11.5px]">
                        <CalendarCheck2 className="h-[15px] w-[15px] text-[var(--primary-color)] shrink-0 transition-all group-data-[state=active]:text-white" />
                        {t('stylist.dailySuggestion')}
                        {!canAccessScheduler && (
                          <Crown className="h-3.5 w-3.5 text-amber-500 ms-1 shrink-0" />
                        )}
                      </TabsTrigger>
                    </TabsList>
                  </div>
                  <TabsContent value="chat">{chatColumn}</TabsContent>
                  <TabsContent ref={shuffleScrollRef} value="shuffle">
                    <DressMeShuffler onSaveSuccess={handleSaveOutfitSuccess} onOpenCalendar={() => setCalendarModalOpen(true)} />
                    <section className='bg-white p-5 mt-5 shadow-sm border border-border rounded-[12px]'>
                      <div className="w-full">
                        {selectedOutfitForDetail ? (
                          renderOutfitDetailPane()
                        ) : (
                          /* Outfit Thumbnail Grid View */
                          <>
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                              <h3 className="text-[20px] font-bold text-[var(--dark-color)]">
                                {t('stylist.calendar.outfit_canvas', { defaultValue: 'Saved Outfits' })}
                              </h3>
                              {outfits.length > 0 && (
                                <Badge variant="secondary" className="w-fit text-xs font-semibold px-2.5 py-0.5 rounded-full">
                                  {canvasSearchQuery
                                    ? t('stylist.calendar.resultsCount', {
                                        count: filteredCanvasOutfits.length,
                                        total: outfits.length,
                                        defaultValue: `Found ${filteredCanvasOutfits.length} of ${outfits.length} outfits`
                                      })
                                    : `${outfits.length} outfits`}
                                </Badge>
                              )}
                            </div>

                            {/* Vibe Search Bar (if outfits exist) */}
                            {outfits.length > 0 && (
                              <div className="mb-5 space-y-2.5">
                                <div className="relative flex items-center">
                                  <Search className="absolute start-3.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                                  <Input
                                    type="text"
                                    value={canvasSearchQuery}
                                    onChange={(e) => setCanvasSearchQuery(e.target.value)}
                                    placeholder={t('stylist.calendar.searchPlaceholder', {
                                      defaultValue: 'Vibe search: "Summer barbecue", "Mall shopping", "Business meeting", "Black T-shirt", "Stone-washed jeans"...'
                                    })}
                                    className="ps-10 pe-10 h-10 rounded-xl bg-secondary/30 border-border text-xs sm:text-sm placeholder:text-muted-foreground/70 focus-visible:ring-1 focus-visible:ring-primary-brand"
                                    data-testid="outfit-canvas-search-input"
                                  />
                                  {canvasSearchQuery && (
                                    <button
                                      type="button"
                                      onClick={() => setCanvasSearchQuery('')}
                                      className="absolute end-3 p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                                      aria-label={t('stylist.calendar.clearSearch', { defaultValue: 'Clear search' })}
                                    >
                                      <X className="h-4 w-4" />
                                    </button>
                                  )}
                                </div>

                                {/* Quick Vibe Chips */}
                                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
                                  <span className="text-muted-foreground font-semibold shrink-0 flex items-center gap-1 me-1">
                                    <Sparkles className="h-3 w-3 text-primary-brand" />
                                    {t('stylist.calendar.quickVibes', { defaultValue: 'Vibes:' })}
                                  </span>
                                  {QUICK_VIBE_ITEMS.map((vibe) => {
                                    const localizedLabel = t(`stylist.calendar.vibes.${vibe.id}`, { defaultValue: vibe.query });
                                    const isSelected =
                                      canvasSearchQuery.toLowerCase() === vibe.query.toLowerCase() ||
                                      canvasSearchQuery.toLowerCase() === localizedLabel.toLowerCase();
                                    return (
                                      <button
                                        key={vibe.id}
                                        type="button"
                                        onClick={() => setCanvasSearchQuery((prev) => isSelected ? '' : localizedLabel)}
                                        className={cn(
                                          "shrink-0 px-2.5 py-1 rounded-full border text-xs font-medium transition-colors cursor-pointer",
                                          isSelected
                                            ? "bg-primary-brand text-white border-primary-brand shadow-xs"
                                            : "bg-background border-border text-text-brand hover:border-primary-brand/50 hover:bg-secondary/50"
                                        )}
                                      >
                                        {localizedLabel}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {outfitsLoading ? (
                              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4 w-full">
                                {[1, 2, 3, 4, 5].map((i) => (
                                  <div key={i} className="aspect-[4/5] rounded-xl border border-border animate-pulse bg-muted/40" />
                                ))}
                              </div>
                            ) : outfits.length === 0 ? (
                              <Card className="w-full rounded-[12px] border border-dashed border-border py-16 text-center">
                                <CardContent className="flex flex-col gap-4">
                                  <Sparkles className="h-12 w-12 text-primary-brand mx-auto" />
                                  <h2 className="text-xl font-extrabold text-[var(--dark-color)] mb-2">
                                    {t('common.noResults', { defaultValue: 'No outfits saved yet' })}
                                  </h2>
                                  <p className="text-sm text-[var(--muted-foreground)] max-w-sm mx-auto">
                                    {t('outfits.noSavedOutfitsDesc', {
                                      defaultValue: 'Get outfit proposals in the AI Stylist tab, pick your favorite, and save it to start logging your outfits.',
                                    })}
                                  </p>
                                </CardContent>
                              </Card>
                            ) : filteredCanvasOutfits.length === 0 ? (
                              <Card className="w-full rounded-[12px] border border-dashed border-border py-12 text-center">
                                <CardContent className="flex flex-col items-center gap-3">
                                  <Search className="h-10 w-10 text-muted-foreground/60" />
                                  <h3 className="text-base font-bold text-dark-brand">
                                    {t('stylist.calendar.noSearchMatches', { defaultValue: 'No outfits match this vibe' })}
                                  </h3>
                                  <p className="text-xs text-muted-foreground max-w-sm">
                                    {t('stylist.calendar.noSearchMatchesDesc', {
                                      query: canvasSearchQuery,
                                      defaultValue: `We couldn't find any saved outfits matching "${canvasSearchQuery}". Try another vibe, garment, or clear the search.`
                                    })}
                                  </p>
                                  <Button variant="outline" size="sm" onClick={() => setCanvasSearchQuery('')} className="rounded-xl mt-1">
                                    {t('stylist.calendar.clearSearch', { defaultValue: 'Clear search' })}
                                  </Button>
                                </CardContent>
                              </Card>
                            ) : (
                              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4 w-full">
                                {filteredCanvasOutfits.map((o) => (
                                  <Card
                                    key={o.id}
                                    draggable="true"
                                    onDragStart={(e) => {
                                      e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'saved', id: o.id }));
                                    }}
                                    onClick={() => {
                                      setSelectedOutfitForDetail(o);
                                      setIsEditingOutfit(false);
                                    }}
                                    className="relative overflow-hidden rounded-[12px] bg-white border border-border shadow-sm hover:shadow-md transition-smooth cursor-pointer"
                                  >
                                    <div className="relative w-full aspect-[4/5] bg-[#ddd] overflow-hidden shrink-0">
                                      <AvatarViewer
                                        shapeParams={user?.avatar_shape_params || {}}
                                        sex={user?.sex || 'female'}
                                        outfitItems={getOutfitPiecesMap(o)}
                                      />
                                    </div>
                                    <div className="p-2">
                                      <p className="text-xs text-center font-bold text-[#666] leading-[22px]">{getOutfitName(o.name)}</p>
                                    </div>
                                  </Card>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </section>
                  </TabsContent>
                  <TabsContent value="match">
                    {!canAccessScheduler ? (
                      <div className="bg-white rounded-[16px] border border-border shadow-sm p-8 sm:p-12 my-6 flex flex-col items-center text-center space-y-4 max-w-xl mx-auto">
                        <div className="p-4 rounded-full bg-amber-500/10 text-amber-500">
                          <Crown className="h-10 w-10" />
                        </div>
                        <h2 className="font-bold text-[22px] text-dark-brand">
                          {t('stylist.dailySuggestion', { defaultValue: 'Daily Suggestions' })}
                        </h2>
                        <p className="text-[14px] font-semibold text-text-brand max-w-md leading-relaxed">
                          {t('stylist.upgradeForDailySuggestionsDesc', { defaultValue: 'Upgrade to Manager or Professional to unlock Daily Suggestions.' })}
                        </p>
                        <div className="pt-2">
                          <Button
                            onClick={() => navigate('/pricing')}
                            className="rounded-full px-6 py-2.5 font-bold"
                          >
                            {t('nav.pricing', { defaultValue: 'View Plans & Upgrade' })}
                          </Button>
                        </div>
                      </div>
                    ) : selectedOutfitForDetail ? (
                      renderOutfitDetailPane()
                    ) : (
                      <>
                        {/* 1. Schedule & Push Notifications Settings Summary */}
                        <Card className="border border-border rounded-[12px] shadow-editorial overflow-hidden bg-white w-full shrink-0 mb-6">
                          <CardContent className="p-4 md:p-5 flex items-center justify-between gap-4 flex-wrap">
                            <div className="flex items-center gap-3">
                              <div className="p-2.5 bg-primary-shadow text-primary-brand rounded-xl shrink-0">
                                <Bell className="h-5 w-5" />
                              </div>
                              <div className="text-start space-y-1">
                                <h3 className="text-[14px] font-semibold text-dark-brand">
                                  {t('profile.schedulerPushReminders', { defaultValue: 'Schedule & Push Reminders' })}
                                </h3>
                                <div className="flex flex-wrap items-center gap-2 text-xs text-text-brand font-semibold">
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-secondary/10 border border-border">
                                    <span className={cn(
                                      "h-2 w-2 rounded-full",
                                      user?.scheduler_settings?.enabled ? "bg-primary-brand animate-pulse" : "bg-primary-shadow"
                                    )} />
                                    <span>
                                      {user?.scheduler_settings?.enabled
                                        ? t('common.enabled', { defaultValue: 'Enabled' })
                                        : t('common.unenabled', { defaultValue: 'Unenabled' })}
                                    </span>
                                  </span>
                                  {user?.scheduler_settings?.enabled && (
                                    <>
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-secondary/5 border border-border text-[11px]" dir="auto">
                                        {getFrequencyLabel(user?.scheduler_settings?.frequency, user?.scheduler_settings?.weekday, i18n.language, t)}
                                      </span>
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-secondary/5 border border-border text-[11px]" dir="ltr">
                                        {(() => {
                                          try {
                                            const tVal = (typeof user?.scheduler_settings?.time === 'string') ? user.scheduler_settings.time : '07:00';
                                            const [h, m] = tVal.split(':');
                                            const hInt = parseInt(h, 10) || 7;
                                            const mStr = m || '00';
                                            const ampm = hInt >= 12 ? 'PM' : 'AM';
                                            const h12 = hInt % 12 || 12;
                                            return `${h12.toString().padStart(2, '0')}:${mStr} ${ampm}`;
                                          } catch (e) {
                                            return '07:00 AM';
                                          }
                                        })()}
                                      </span>
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-secondary/5 border border-border text-[11px] capitalize" dir="auto">
                                        {getStyleLabel(user?.scheduler_settings?.style_option, user?.scheduler_settings?.custom_style, t)}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => navigate('/me?open=scheduler')}
                              className="rounded-xl flex items-center gap-1 shadow-sm"
                              data-testid="edit-scheduler-btn"
                            >
                              <Pencil className="!h-3 !w-3" />
                              <span>{t('common.edit', { defaultValue: 'Edit' })}</span>
                            </Button>
                          </CardContent>
                        </Card>
                        {/* 1.5 Today's / Tomorrow's Style Suggestion / Outfit Card */}
                        {(() => {
                          const todayDate = new Date();
                          const todayDateStr = formatLocalDate(todayDate);
                          const tomorrowDate = new Date(todayDate);
                          tomorrowDate.setDate(tomorrowDate.getDate() + 1);
                          const tomorrowDateStr = formatLocalDate(tomorrowDate);

                          const todayOutfit = (outfits || []).find(o => o.usage?.date === todayDateStr);
                          const tomorrowOutfit = (outfits || []).find(o => o.usage?.date === tomorrowDateStr);

                          const todayNotifRecs = (notifications || []).filter(n => {
                            try {
                              const p = n.payload || {};
                              if (p.target_date) return p.target_date === todayDateStr || p.target_date === tomorrowDateStr;
                              const nd = new Date(n.created_at);
                              const ndStr = `${nd.getFullYear()}-${String(nd.getMonth() + 1).padStart(2, '0')}-${String(nd.getDate()).padStart(2, '0')}`;
                              return ndStr === todayDateStr || ndStr === tomorrowDateStr;
                            } catch {
                              return false;
                            }
                          }).flatMap(n => (n.payload?.proposals || n.payload?.outfit_recommendations || []));

                          // Active proposal matches either today or tomorrow
                          const activeProposal = (dailyProposal && (dailyProposal.date === todayDateStr || dailyProposal.date === tomorrowDateStr) && (dailyProposal.items || []).length > 0) ? dailyProposal : null;

                          // If the active proposal or context is tomorrow's proposal and we don't have a scheduled todayOutfit, highlight tomorrow!
                          const isTomorrow = (activeProposal?.date === tomorrowDateStr) && !todayOutfit;
                          const targetDateStr = isTomorrow ? tomorrowDateStr : todayDateStr;
                          const targetDateObj = isTomorrow ? tomorrowDate : todayDate;
                          const currentOutfit = isTomorrow ? tomorrowOutfit : todayOutfit;

                          const hasContent = currentOutfit || todayOutfit || activeProposal || todayNotifRecs.length > 0;
                          if (!hasContent) return null;

                          return (
                            <Card className="border border-border rounded-[12px] shadow-editorial overflow-hidden bg-white w-full shrink-0 mb-6">
                              <CardContent className="p-4 md:p-5">
                                <div className="flex items-center justify-between gap-4 flex-wrap pb-3">
                                  <div className="flex items-center gap-3 flex-wrap">
                                    <div className="p-2.5 bg-primary-shadow text-primary-brand rounded-full shrink-0">
                                      <Sparkles className="h-5 w-5" />
                                    </div>
                                    <div className="text-start">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <h3 className="text-[14px] font-bold text-dark-brand">
                                          {currentOutfit
                                            ? (isTomorrow
                                                ? t('calendar.tomorrowOutfit', { defaultValue: "Tomorrow's Scheduled Outfit" })
                                                : t('calendar.todayOutfit', { defaultValue: "Today's Scheduled Outfit" }))
                                            : (isTomorrow
                                                ? t('stylist.tomorrowSuggestionTitle', { defaultValue: "Tomorrow's Style Suggestion" })
                                                : t('stylist.todaySuggestionTitle', { defaultValue: "Today's Style Suggestion" }))}
                                        </h3>
                                        <Badge variant="outline" className="text-[10px] font-semibold text-primary-brand border-primary-brand bg-white">
                                          {targetDateObj.toLocaleDateString(i18n.language || 'en', { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </Badge>
                                        {currentOutfit && (
                                          <Badge className="text-[10px] font-semibold bg-emerald-600 text-white border-none">
                                            {t('calendar.scheduled', { defaultValue: 'Scheduled' })}
                                          </Badge>
                                        )}
                                      </div>
                                      <p className="text-xs text-text-brand mt-0.5">
                                        {currentOutfit
                                          ? (currentOutfit.description || getOutfitName(currentOutfit.name))
                                          : ((activeProposal?.description && !activeProposal.description.includes('Curated based on your style profile'))
                                            ? activeProposal.description
                                            : (isTomorrow
                                                ? t('stylist.tomorrowSuggestionSubtitle', { defaultValue: 'Curated for tomorrow based on your style profile, forecasted weather, and calendar events.' })
                                                : t('stylist.todaySuggestionSubtitle', { defaultValue: 'Curated based on your style profile, weather conditions, and closet harmony.' })))}
                                      </p>
                                    </div>
                                  </div>
                                   <div className="flex items-center gap-2 flex-wrap">
                                     {currentOutfit ? (
                                        <Button
                                          size="sm"
                                          onClick={() => {
                                            setUserDismissedDetail(false);
                                            setSelectedOutfitForDetail(currentOutfit);
                                          }}
                                          className="rounded-xl flex items-center gap-1.5 shadow-sm text-xs !bg-primary-brand text-white"
                                        >
                                          <Shirt className="!h-3.5 !w-3.5" />
                                          <span>{t('stylist.viewOutfitDetails', { defaultValue: 'View Details' })}</span>
                                        </Button>
                                      ) : (
                                        <>
                                          {activeProposal && (
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              onClick={() => {
                                                setUserDismissedDetail(false);
                                                setSelectedOutfitForDetail(proposalToOutfit(activeProposal, targetDateStr));
                                              }}
                                              className="rounded-xl flex items-center gap-1.5 shadow-sm text-xs border-primary-brand text-primary-brand hover:bg-primary-shadow"
                                            >
                                              <Shirt className="!h-3.5 !w-3.5" />
                                              <span>{t('stylist.tryOnAvatar', { defaultValue: 'View Look' })}</span>
                                            </Button>
                                          )}
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            disabled={generatingDaily}
                                            onClick={async () => {
                                              setGeneratingDaily(true);
                                              try {
                                                const newProp = await generateDailyProposalAction(true, 'daily', targetDateStr);
                                                if (newProp && selectedOutfitForDetail?.isDailyProposal) {
                                                  setSelectedOutfitForDetail(proposalToOutfit(newProp, targetDateStr));
                                                }
                                                toast.success(
                                                  isTomorrow
                                                    ? t('stylist.tomorrowSuggestionRefreshed', { defaultValue: 'Refreshed tomorrow’s suggestion!' })
                                                    : t('stylist.suggestionRefreshed', { defaultValue: 'Refreshed today’s suggestion!' })
                                                );
                                              } catch {
                                                toast.error(t('common.error', { defaultValue: 'Failed to refresh' }));
                                              } finally {
                                                setGeneratingDaily(false);
                                              }
                                            }}
                                            className="rounded-xl flex items-center gap-1.5 shadow-sm text-xs"
                                          >
                                            <RefreshCw className={cn("!h-3.5 !w-3.5", generatingDaily && "animate-spin")} />
                                            <span>{t('stylist.refreshSuggestion', { defaultValue: 'New Look' })}</span>
                                          </Button>
                                          {activeProposal && (
                                            <Button
                                              size="sm"
                                              onClick={async () => {
                                                await handleWearDailyProposal(activeProposal);
                                              }}
                                              className="rounded-xl flex items-center gap-1.5 shadow-sm text-xs !bg-primary-brand text-white"
                                            >
                                              <CalendarPlus className="!h-3.5 !w-3.5" />
                                              <span>
                                                {isTomorrow
                                                  ? t('stylist.wearTomorrow', { defaultValue: 'Wear Tomorrow' })
                                                  : t('stylist.wearToday', { defaultValue: 'Wear Today' })}
                                              </span>
                                            </Button>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  </div>
                                {/* Garments Preview row */}
                                {(() => {
                                  const itemsToRender = currentOutfit?.garments || activeProposal?.items || (todayNotifRecs[0]?.items) || [];
                                  if (itemsToRender.length === 0) return null;
                                  return (
                                    <div className="flex gap-2 overflow-x-auto flex-nowrap pb-3">
                                      {itemsToRender.map((g, idx) => {
                                        const cid = g.closet_item_id || g.id;
                                        const cItem = (closetItems || []).find(it => it && (it.id === cid || it._id === cid));
                                        const img = resolveMediaUrl(bestImageUrl(cItem) || g.image_url || g.clean_image_url || cItem?.image_url);
                                        return (
                                          <div
                                            key={idx}
                                            onClick={() => {
                                              setUserDismissedDetail(false);
                                              if (currentOutfit) {
                                                setSelectedOutfitForDetail(currentOutfit);
                                              } else if (activeProposal) {
                                                setSelectedOutfitForDetail(proposalToOutfit(activeProposal, targetDateStr));
                                              }
                                            }}
                                            className="flex items-center gap-2 p-2 rounded-[12px] border border-border hover:border-primary-brand hover:bg-primary-shadow cursor-pointer transition-colors"
                                          >
                                            <div className="w-10 h-10 rounded-full bg-accent-beige overflow-hidden shrink-0 border border-border flex items-center justify-center">
                                              {img ? (
                                                <img src={img} alt={g.name || g.title || ''} className="w-full h-full object-contain p-0.5" />
                                              ) : (
                                                <Shirt className="h-4 w-4 text-text-brand opacity-40" />
                                              )}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                              <h6 className="text-[12px] font-bold text-dark-brand truncate">{labelForRole(g.role, t)}</h6>
                                              <p className="text-[10px] text-text-brand font-semibold truncate">
                                                {g.name || g.title || cItem?.title || cItem?.name || 'Garment'}
                                              </p>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  );
                                 })()}
                              </CardContent>
                            </Card>
                          );
                        })()}
                        {/* 2. Scheduled Outfits Monthly Calendar Grid */}
                        <Card className="border border-border rounded-[12px] shadow-editorial overflow-hidden bg-white w-full flex flex-col min-h-[480px] h-auto shrink-0">
                          <CardContent className="p-4 md:p-5 flex flex-col">
                            {/* Calendar Month Header */}
                            <div className="flex items-center justify-center mb-4">
                              <div className="flex items-center gap-2">
                                <Button
                                  size="xs"
                                  variant="outline"
                                  className="rounded-lg h-7 text-xs font-semibold px-2.5"
                                  onClick={() => setCurrentCalendarMonth(new Date())}
                                >
                                  {t('calendar.todayBtn', { defaultValue: 'Today' })}
                                </Button>
                                <div className="flex items-center border border-border rounded-lg overflow-hidden h-7">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 rounded-none border-r border-border"
                                    onClick={() => setCurrentCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                                    aria-label={t('calendar.prevMonthAria', { defaultValue: 'Previous month' })}
                                  >
                                    <ChevronLeft className="h-3.5 w-3.5 rtl:rotate-180" />
                                  </Button>
                                  <span className="px-3 text-xs font-semibold font-display min-w-[110px] text-center select-none">
                                    {currentCalendarMonth.toLocaleString(i18n.language || 'en', { month: 'long', year: 'numeric' })}
                                  </span>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 rounded-none border-l border-border"
                                    onClick={() => setCurrentCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                                    aria-label={t('calendar.nextMonthAria', { defaultValue: 'Next month' })}
                                  >
                                    <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
                                  </Button>
                                </div>
                              </div>
                            </div>

                            {/* Calendar Weekday Headers */}
                            <div className="grid grid-cols-7 gap-1.5 text-center mb-1">
                              {Array.from({ length: 7 }).map((_, idx) => (
                                <div key={idx} className="text-[10px] font-bold uppercase text-text-brand py-1">
                                  {getWeekdayShortName(idx, i18n.language)}
                                </div>
                              ))}
                            </div>

                            {/* Calendar Grid Cells */}
                            <div className="grid grid-cols-7 gap-1.5 flex-1 min-h-0">
                              {getDaysInMonth(currentCalendarMonth).map(({ date, isCurrentMonth }, idx) => {
                                const dayStr = formatLocalDate(date);
                                const todayStr = formatLocalDate(new Date());
                                const isToday = dayStr === todayStr;
                                const dayOutfit = outfits.find(o => o.usage?.date === dayStr);

                                return (
                                  <div
                                    key={idx}
                                    onClick={() => {
                                      if (dayOutfit) {
                                        setSelectedOutfitForDetail(dayOutfit);
                                        setIsEditingOutfit(false);
                                      } else {
                                        setSchedulingDate(dayStr);
                                      }
                                    }}
                                    className={cn(
                                      "relative rounded-[12px] border p-1 flex flex-col justify-between transition-all duration-200 select-none cursor-pointer group bg-card min-h-[60px] sm:min-h-[90px] hover:border-border-accent-beige hover:shadow-sm",
                                      isCurrentMonth ? "border-accent-beige" : "border-border opacity-40 bg-muted/5",
                                      isToday && "border-primary-brand ring-1 ring-primary-brand bg-primary-shadow"
                                    )}
                                  >
                                    {/* Day Number */}
                                    <span className={cn(
                                      "text-[10px] sm:text-xs font-bold self-start px-0.5 rounded-full min-w-[18px] h-[18px] flex items-center justify-center",
                                      isToday ? "bg-primary-brand text-white" : "text-dark-brand"
                                    )}>
                                      {date.getDate()}
                                    </span>

                                    {/* Outfit Thumbnail */}
                                    <div className="w-full flex-grow aspect-[4/5] rounded-[12px] overflow-hidden relative flex items-center justify-center bg-accent-beige">
                                      {dayOutfit ? (
                                        <div className="absolute inset-0 scale-[0.95]">
                                          <AvatarViewer
                                            shapeParams={user?.avatar_shape_params || {}}
                                            sex={user?.sex || 'female'}
                                            outfitItems={getOutfitPiecesMap(dayOutfit)}
                                          />
                                        </div>
                                      ) : (
                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                          <Plus className="h-3.5 w-3.5 text-primary-brand" />
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </CardContent>
                        </Card>
                      </>
                    )}
                  </TabsContent>
                </Tabs>
              </main>
            </div>
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
            <DialogContent data-testid="stylist-event-dialog">
              <DialogTitle>{t('stylist.planEventOutfitTitle', { defaultValue: 'Plan Event Outfit' })}</DialogTitle>
              <form onSubmit={handleTriggerEvent} data-testid="stylist-event-form">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  <div className="md:col-span-12">
                    <div>
                      <Label htmlFor="event-name">{t('stylist.eventName', { defaultValue: 'Event Name' })}</Label>
                      <Input
                        id="event-name"
                        value={eventForm.event_name}
                        onChange={(e) => setEventForm(prev => ({ ...prev, event_name: e.target.value }))}
                        placeholder={t('stylist.eventNamePlaceholder', { defaultValue: 'e.g. Birthday Party, Dinner' })}
                        data-testid="event-name-input"
                      />
                    </div>
                  </div>
                  <div className="md:col-span-12">
                    <div>
                      <Label htmlFor="location">{t('stylist.location', { defaultValue: 'Location' })}</Label>
                      <Input
                        id="location"
                        value={eventForm.location}
                        onChange={(e) => setEventForm(prev => ({ ...prev, location: e.target.value }))}
                        placeholder={t('stylist.locationPlaceholder', { defaultValue: 'e.g. Rooftop Restaurant' })}
                        data-testid="event-location-input"
                      />
                    </div>
                  </div>
                  <div className="md:col-span-6">
                    <div>
                      <Label htmlFor="date">{t('common.date', { defaultValue: 'Date' })}</Label>
                      <Input
                        id="date"
                        type="date"
                        value={eventForm.date}
                        onChange={(e) => setEventForm(prev => ({ ...prev, date: e.target.value }))}
                        data-testid="event-date-input" />
                    </div>
                  </div>
                  <div className="md:col-span-6">
                    <div>
                      <Label htmlFor="time">{t('common.time', { defaultValue: 'Time' })}</Label>
                      <Input
                        id="time"
                        type="time"
                        value={eventForm.time}
                        onChange={(e) => setEventForm(prev => ({ ...prev, time: e.target.value }))}
                        data-testid="event-time-input" />
                    </div>
                  </div>
                  <div className="md:col-span-12">
                    <div>
                      <Label htmlFor="prompt">{t('stylist.dressCodeDemands', { defaultValue: 'Dress Code / Demands' })}</Label>
                      <Textarea
                        id="prompt"
                        value={eventForm.prompt}
                        onChange={(e) => setEventForm(prev => ({ ...prev, prompt: e.target.value }))}
                        placeholder={t('stylist.promptPlaceholder', { defaultValue: 'Describe what you need e.g. informal outdoor setting, casual chic' })}
                        rows={3}
                        required
                        data-testid="event-prompt-input" />
                    </div>
                  </div>
                  <div className="md:col-span-12 text-end">
                    {/* <Button type="button" variant="outline" onClick={() => setEventModalOpen(false)} className="">
                      {t('common.cancel', { defaultValue: 'Cancel' })}
                    </Button> */}
                    <Button type="submit" disabled={busy} data-testid="event-submit-btn">
                      {t('stylist.getSuggestions', { defaultValue: 'Get Suggestions' })}
                    </Button>
                  </div>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          {/* Google Calendar Modal */}
          <Dialog open={calendarModalOpen} onOpenChange={setCalendarModalOpen}>
            <DialogContent className="!max-w-4xl rounded-[12px]" data-testid="stylist-calendar-dialog">
              <div className="flex items-center gap-2">
                <CalIcon className="h-5 w-5 text-primary-brand" />
                <DialogTitle>{t('calendar.title', { defaultValue: 'Google Calendar' })}</DialogTitle>
              </div>
              <div className="flex items-center gap-2 pe-6">
                <Button size="xs" variant="outline" className="rounded-lg h-8 text-xs font-semibold px-3" onClick={handleJumpToToday}>
                  {t('calendar.todayBtn', { defaultValue: 'Today' })}
                </Button>
                <div className="flex items-center border border-border rounded-lg overflow-hidden h-10">
                  <Button size="icon" variant="ghost" className="h-full w-11 min-w-[44px] rounded-none border-r border-border" onClick={handlePrevDay} aria-label={t('calendar.prevDayAria', { defaultValue: 'Previous day' })}>
                    <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-full w-11 min-w-[44px] rounded-none" onClick={handleNextDay} aria-label={t('calendar.nextDayAria', { defaultValue: 'Next day' })}>
                    <ChevronRight className="h-4 w-4 rtl:rotate-180" />
                  </Button>
                </div>
              </div>
              {/* Main 7-day row */}
              <div className="flex sm:grid sm:grid-cols-7 gap-3 overflow-x-auto pb-4 pt-2 scrollbar-thin">
                {Array.from({ length: 7 }).map((_, idx) => {
                  const day = new Date(calendarStartDate);
                  day.setDate(day.getDate() + idx);
                  const dayStr = formatLocalDate(day);

                  const today = new Date();
                  const isToday = formatLocalDate(today) === dayStr;
                  const dayOutfit = outfits.find(o => o.usage?.date === dayStr);

                  return (
                    <div
                      key={dayStr}
                      ref={isToday ? todayRef : null}
                      onClick={() => setSchedulingDate(dayStr)}
                      className={cn(
                        "flex-1 min-w-[130px] sm:min-w-0 rounded-[12px] border p-3 flex flex-col items-center justify-between text-center transition-all duration-300 bg-white select-none cursor-pointer hover:border-primary-brand hover:shadow-sm",
                        isToday ? "border-primary-brand shadow-sm" : "border-border"
                      )}
                    >
                      <div className="space-y-0.5">
                        <div className={cn("text-[10px] uppercase", isToday ? "text-primary-brand font-bold" : "text-text-brand")}>
                          {isToday ? t('calendar.todayLabel', { defaultValue: 'TODAY' }) : formatWeekday(day, t)}
                        </div>
                        <div className="text-xs font-semibold font-display">
                          {formatMonthDay(day, t)}
                        </div>
                      </div>

                      <div className="w-full aspect-[4/5] mt-3 rounded-[12px] overflow-hidden relative group/slot flex items-center justify-center bg-accent-beige border border-dashed border-border">
                        {dayOutfit ? (
                          <>
                            <div className="absolute inset-0 scale-[0.9]">
                              <AvatarViewer
                                shapeParams={user?.avatar_shape_params || {}}
                                sex={user?.sex || 'female'}
                                outfitItems={getOutfitPiecesMap(dayOutfit)}
                              />
                            </div>
                            <div className="absolute inset-0 bg-background/90 opacity-0 hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-2 text-center">
                              <div className="text-[10px] font-semibold truncate w-full px-1 mb-1">{dayOutfit.name}</div>
                              <div className="text-[9px] text-primary-brand font-medium">{t('calendar.manage', { defaultValue: 'Manage' })}</div>
                            </div>
                          </>
                        ) : (
                          <div className="text-[9px] text-primary-brand p-2 flex flex-col items-center justify-center gap-1.5">
                            <Plus className="h-4 w-4 opacity-50" />
                            <span>{t('calendar.schedule', { defaultValue: 'Schedule' })}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </DialogContent>
          </Dialog>
          {/* Outfit Selector Dialog */}
          <Dialog open={schedulingDate !== null} onOpenChange={(open) => { if (!open) setSchedulingDate(null); }}>
            <DialogContent className="!max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="stylist-schedule-dialog">
              <DialogTitle>
                {t('calendar.scheduleTitle', { defaultValue: 'Schedule Outfit' })}
              </DialogTitle>
              <div className="text-[14px] font-semibold text-text-brand">
                {schedulingDate && formatMonthDay(new Date(schedulingDate), t)}
              </div>
              {/* If there's an outfit scheduled for the active date, show a quick removal card */}
              {schedulingDate && (() => {
                const dayOutfit = outfits.find(o => o.usage?.date === schedulingDate);
                if (!dayOutfit) return null;
                return (
                  <div className="flex flex-col gap-3 p-3 bg-rose-500/5 border border-rose-500/10 rounded-xl mb-4">
                    {dayOutfit.is_fallback && (
                      <div className="text-[11px] font-semibold text-rose-700 leading-normal text-start pb-2 border-b border-rose-500/10">
                        {t('outfits.notification.quotaBody', { defaultValue: 'AI service quota limit reached. A fallback suggestion from your closet rotation has been scheduled for tomorrow:' })}
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-12 h-12 bg-secondary/10 rounded-full overflow-hidden border border-border shrink-0">
                          <AvatarViewer shapeParams={user?.avatar_shape_params || {}} sex={user?.sex || 'female'} outfitItems={getOutfitPiecesMap(dayOutfit)} />
                        </div>
                        <div className="min-w-0 text-start">
                          <div className="text-[10px] uppercase tracking-wide text-rose-600 font-semibold">{t('calendar.scheduled', { defaultValue: 'Scheduled' })}</div>
                          <div className="font-semibold text-xs text-text-brand truncate">{dayOutfit.name}</div>
                        </div>
                      </div>
                      <Button
                        size="xs"
                        variant="destructive"
                        onClick={() => handleUnscheduleOutfit(dayOutfit.id)}
                        className="rounded-lg text-[10px] font-semibold h-7 px-2.5 flex items-center gap-1 shrink-0"
                      >
                        <Trash2 className="h-3 w-3" />
                        {t('calendar.unschedule', { defaultValue: 'Remove' })}
                      </Button>
                    </div>
                  </div>
                );
              })()}

              {/* AI Daily Suggestions */}
              {dailyRecommendations.length > 0 && (
                <div className="space-y-3 mb-3">
                  <h4 className="text-xs font-semibold text-primary-brand flex items-center gap-1.5 uppercase">
                    <Sparkles className="h-3.5 w-3.5 text-primary-brand" />
                    {t('calendar.dailyAISuggestions', { defaultValue: 'AI Daily Suggestions' })}
                  </h4>
                  <div className="grid grid-cols-3 gap-3">
                    {dailyRecommendations.map((rec, idx) => (
                      <div
                        key={`daily-rec-${idx}`}
                        onClick={async () => {
                          const saved = await handleSaveOutfitToDate(rec.notifId, rec.recIndex, schedulingDate, rec);
                          if (saved) {
                            setSelectedOutfitForDetail(saved);
                            setIsEditingOutfit(false);
                          }
                          setSchedulingDate(null);
                        }}
                        className="flex flex-col items-center rounded-[12px] border border-border hover:border-primary-brand cursor-pointer text-center group transition-all relative overflow-hidden"
                      >
                        <div className="w-full aspect-[4/5] bg-accent-beige overflow-hidden relative shrink-0">
                          <AvatarViewer
                            shapeParams={user?.avatar_shape_params || {}}
                            sex={user?.sex || 'female'}
                            outfitItems={getRecommendationPiecesMap(rec, closetItems)}
                          />
                        </div>
                        <div className="p-2 text-[12px] font-semibold truncate text-text-brand w-full">
                          {rec.name}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* List of saved outfits */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-text-brand">
                  {t('calendar.selectSavedOutfit', { defaultValue: 'Select Saved Outfit' })}
                </h4>
                {outfitsLoading ? (
                  <div className="grid grid-cols-3 gap-3">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className="aspect-[4/5] animate-pulse bg-muted/40 border border-border" />
                    ))}
                  </div>
                ) : outfits.length === 0 ? (
                  <div className="text-center py-6 text-xs text-text-brand border border-dashed border-border rounded-xl">
                    {t('outfits.noSavedOutfitsDesc', { defaultValue: 'No outfits saved yet' })}
                  </div>
                ) : (
                  <div className="h-[50vh] overflow-y-auto pe-1 mb-[40px] scrollbar-thin">
                    <div className="grid grid-cols-3 gap-3">
                      {outfits.map((o) => {
                        const isAlreadyScheduled = o.usage?.date === schedulingDate;
                        return (
                          <div
                            key={o.id}
                            onClick={() => {
                              if (!isAlreadyScheduled) {
                                handleAssignOutfitToDate(o.id, schedulingDate);
                              }
                            }}
                            className={cn(
                              "flex flex-col items-center rounded-[12px] border border-border hover:border-primary-brand cursor-pointer text-center group transition-all relative overflow-hidden",
                              isAlreadyScheduled ? "border-primary-brand bg-primary-shadow cursor-default hover:border-primary-brand hover:bg-primary-shadow" : "border-border"
                            )}
                          >
                            <div className="w-full aspect-[4/5] bg-accent-beige overflow-hidden relative shrink-0">
                              <AvatarViewer shapeParams={user?.avatar_shape_params || {}} sex={user?.sex || 'female'} outfitItems={getOutfitPiecesMap(o)} />
                              {isAlreadyScheduled && (
                                <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                                  <Badge className="rounded-full bg-primary-brand text-white border-0 scale-90">
                                    {t('calendar.scheduled', { defaultValue: 'Selected' })}
                                  </Badge>
                                </div>
                              )}
                            </div>
                            <div className="p-2 text-[12px] font-semibold truncate text-text-brand w-full">
                              {getOutfitName(o.name)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={keyErrorOpen} onOpenChange={setKeyErrorOpen}>
            <DialogContent>
              <div className="mx-auto w-12 h-12 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mb-2">
                <Key className="h-6 w-6" />
              </div>
              <DialogTitle>{t('stylist.keyRequiredTitle', { defaultValue: 'AI API Key Required' })}</DialogTitle>
              <DialogDescription>{t('stylist.keyRequiredDesc', { defaultValue: 'To use the AI Stylist, please configure your Gemini API Key in the settings page. Google AI Studio offers a free-tier quota for personal use.' })}</DialogDescription>
              <div className="flex flex-col gap-2 pt-2">
                <Button
                  className="rounded-xl text-xs h-9 font-semibold w-full"
                  onClick={() => {
                    setKeyErrorOpen(false);
                    navigate('/profile?open=ai-config', { state: { scrollTo: 'ai-configuration-section' } });
                  }}
                >
                  {t('stylist.goToSettings', { defaultValue: 'Configure in Settings' })}
                </Button>
                <Button
                  variant="outline"
                  className="rounded-xl text-xs h-9 font-semibold w-full text-text-brand"
                  onClick={() => setKeyErrorOpen(false)}
                >
                  {t('common.cancel', { defaultValue: 'Cancel' })}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </section>
    </>
  );
}
