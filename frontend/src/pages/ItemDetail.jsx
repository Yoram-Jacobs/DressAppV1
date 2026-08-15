/* global FileReader, setTimeout, setInterval, clearTimeout, clearInterval */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Sparkles,
  Trash2,
  Store,
  Loader2,
  Wand2,
  Mic,
  Square,
  RefreshCw,
  Save,
  Undo2,
  Plus,
  X,
  CheckCircle2,
  Camera,
  Images,
  QrCode,
  Leaf,
  Globe2,
  Wrench,
  BadgeCheck,
  ExternalLink,
  Search,
  Tag,
  Sliders,
  Calendar,
  Palette,
  CreditCard,
  Ruler,
  Briefcase,
  Send,
  Bot,
  User as UserIcon,
  Check,
  Image as ImageIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollToTop } from '@/components/ScrollToTop';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { WeightedList } from '@/components/WeightedList';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SourceTagBadge } from '@/components/SourceTagBadge';
import { DppPanel } from '@/components/DppPanel';
import { api } from '@/lib/api';
import { useClosetStore } from '@/lib/useClosetStore';
import { closetStore } from '@/lib/closetStore';
import { workStore } from '@/lib/workStore';
import { bestImageUrl } from '@/lib/itemImage';
import {
  labelForCategory,
  labelForDressCode,
  labelForGender,
  labelForPattern,
  labelForSeason,
  labelForState,
  labelForCondition,
  labelForQuality,
  labelForIntent,
  labelForFormality,
  labelForSubCategory,
  labelForItemType,
  labelForColor,
  getTaxonomyMismatches,
} from '@/lib/taxonomy';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { isSTTSupported, createRecognition } from '@/lib/speech';
import { deriveSizeFromPreferences } from '@/lib/size_preferences';

/* -------------------- enum option lists (kept in-file to avoid a cross-page coupling) -------------------- */
const CATEGORY_OPTIONS = [
  'Top',
  'Bottom',
  'Outerwear',
  'Full Body',
  'Footwear',
  'Accessories',
  'Underwear',
];
const DRESS_CODE_OPTIONS = [
  'casual',
  'smart-casual',
  'business',
  'formal',
  'athletic',
  'loungewear',
];
const GENDER_OPTIONS = ['men', 'women', 'unisex', 'kids'];
const SEASON_OPTIONS = ['spring', 'summer', 'fall', 'winter', 'all'];
const STATE_OPTIONS = ['new', 'used'];
const CONDITION_OPTIONS = ['bad', 'fair', 'good', 'excellent'];
const QUALITY_OPTIONS = ['budget', 'mid', 'premium', 'luxury'];
const PATTERN_OPTIONS = [
  'solid',
  'striped',
  'plaid',
  'floral',
  'herringbone',
  'polka',
  'paisley',
  'geometric',
  'abstract',
];
const FORMALITY_OPTIONS = ['casual', 'smart-casual', 'business', 'formal'];
const INTENT_OPTIONS = ['own', 'for_sale', 'donate', 'swap', 'rent'];
const ALL_CURRENCY_OPTIONS = [
  'USD', 'EUR', 'GBP', 'ILS', 'CAD', 'AUD', 'JPY', 'INR', 'RUB', 'CNY', 
  'BRL', 'MXN', 'CHF', 'AED', 'SAR', 'ZAR', 'SGD', 'HKD', 'SEK', 'NOK', 
  'TRY', 'NZD', 'KRW'
];

const getDefaultCurrency = () => {
  try {
    const locale = (navigator.language || 'en-US').toUpperCase();
    const country = locale.split('-')[1];
    
    const countryToCurrency = {
      US: 'USD', IL: 'ILS', GB: 'GBP', JP: 'JPY', IN: 'INR', RU: 'RUB',
      CN: 'CNY', TW: 'TWD', HK: 'HKD', CA: 'CAD', AU: 'AUD', NZ: 'NZD',
      CH: 'CHF', BR: 'BRL', MX: 'MXN', AR: 'ARS', CL: 'CLP', CO: 'COP',
      PE: 'PEN', UY: 'UYU', ZA: 'ZAR', SG: 'SGD', MY: 'MYR', TH: 'THB',
      ID: 'IDR', PH: 'PHP', KR: 'KRW', AE: 'AED', SA: 'SAR', EG: 'EGP',
      TR: 'TRY', SE: 'SEK', NO: 'NOK', DK: 'DKK', PL: 'PLN'
    };

    if (country && countryToCurrency[country]) {
      return countryToCurrency[country];
    }

    const lang = locale.split('-')[0].toLowerCase();
    const langToCurrency = {
      he: 'ILS', ja: 'JPY', hi: 'INR', ru: 'RUB', zh: 'CNY',
      de: 'EUR', fr: 'EUR', it: 'EUR', es: 'EUR', pt: 'EUR', ar: 'AED'
    };

    return langToCurrency[lang] || 'USD';
  } catch (e) {
    return 'USD';
  }
};

const EDITABLE_FIELDS = [
  'title',
  'name',
  'caption',
  'category',
  'sub_category',
  'item_type',
  'brand',
  'gender',
  'dress_code',
  'season',
  'tradition',
  'size',
  'color',
  'colors',
  'material',
  'fabric_materials',
  'pattern',
  'state',
  'condition',
  'quality',
  'repair_advice',
  'price_cents',
  'currency',
  'marketplace_intent',
  'formality',
  'cultural_tags',
  'tags',
  'notes',
  'reconstructed_image_url',
  'reconstruction_metadata',
  'clean_image_url',
  'clean_image_status',
];

/** Pick the subset of fields we mutate + normalise to a stable shape.
 *
 * When ``user`` is provided and the item has no recorded size, the
 * size field defaults to the user's saved preference for the
 * relevant garment category (e.g. shirt_size for tops). This is
 * applied symmetrically to both the displayed form state AND the
 * `diffPatch` baseline so it never causes a spurious "dirty"
 * indicator — the user has to actually change the size for it to
 * be sent in a PATCH.
 */
function toFormState(item, user = null) {
  // The analyser writes `colors` / `fabric_materials` as `[{name, pct}]`
  // arrays. We surface them as-is so the WeightedList editor can render
  // the per-material percentages. The legacy single-string `color` /
  // `material` fields are kept editable too for backward compat with
  // older items that pre-date the weighted taxonomy.
  const normalisedColors = Array.isArray(item.colors)
    ? item.colors
        .filter((c) => c && (c.name || c.pct != null))
        .map((c) => ({ name: c.name || '', pct: c.pct ?? null }))
    : [];
  const normalisedMaterials = Array.isArray(item.fabric_materials)
    ? item.fabric_materials
        .filter((c) => c && (c.name || c.pct != null))
        .map((c) => ({ name: c.name || '', pct: c.pct ?? null }))
    : [];
  const rawSize = item.size || '';
  // Prefill missing size with the user's stored measurement for the
  // garment category (Top → shirt_size, Bottom → pants_size, …). The
  // prefill is treated as the canonical "saved" value here so the
  // diffPatch baseline matches and the form doesn't immediately
  // report itself as dirty.
  const size =
    rawSize || (user ? deriveSizeFromPreferences(user, item) : '');
  return {
    title: item.title || '',
    name: item.name || '',
    caption: item.caption || '',
    category: item.category || 'Top',
    sub_category: item.sub_category || '',
    item_type: item.item_type || '',
    brand: item.brand || '',
    gender: item.gender || '',
    dress_code: item.dress_code || '',
    season: Array.isArray(item.season) ? item.season : [],
    tradition: item.tradition || '',
    size,
    color: item.color || '',
    colors: normalisedColors,
    material: item.material || '',
    fabric_materials: normalisedMaterials,
    pattern: item.pattern || '',
    state: item.state || '',
    condition: item.condition || '',
    quality: item.quality || '',
    repair_advice: item.repair_advice || '',
    // Whole-unit pricing in the UI: store the form value in
    // currency *units* (e.g. ``29`` for ₪29) and let ``diffPatch``
    // convert back to cents on save. The previous flow exposed raw
    // cents in the input and re-saved them as cents, which meant
    // typing "100" intending $100 ended up storing 100 cents = $1
    // — the symptom users reported as "the system divides my price
    // by 100". Defaulting to 0 also drops the awkward "—"/empty
    // initial state.
    price_cents: Math.round(Number(item.price_cents ?? 0) / 100),
    currency: item.currency || getDefaultCurrency(),
    marketplace_intent: item.marketplace_intent || 'own',
    formality: item.formality || '',
    cultural_tags: Array.isArray(item.cultural_tags) ? item.cultural_tags : [],
    tags: Array.isArray(item.tags) ? item.tags : [],
    notes: item.notes || '',
    reconstructed_image_url: item.reconstructed_image_url || null,
    reconstruction_metadata: item.reconstruction_metadata || null,
    clean_image_url: item.clean_image_url || null,
    clean_image_status: item.clean_image_status || null,
  };
}

/** Compute the PATCH body from a form snapshot: include only the fields
 *  that actually changed from the loaded item. Empty-string fields that
 *  were previously set are translated to ``null`` (clear the field).
 *  Multi-select arrays are sent as the full array whenever they differ.
 */
function diffPatch(loaded, form, user = null) {
  const baseline = toFormState(loaded, user);
  const out = {};
  for (const key of EDITABLE_FIELDS) {
    const a = baseline[key];
    const b = form[key];
    const isArr = Array.isArray(a) || Array.isArray(b);
    if (isArr) {
      const aa = Array.isArray(a) ? a : [];
      const bb = Array.isArray(b) ? b : [];
      // Object arrays (`colors`, `fabric_materials`) need a deep
      // compare — otherwise reference-equality always fails and
      // `isDirty` is permanently true. JSON.stringify is fine here:
      // entries are tiny (`{name, pct}`) and key order is stable.
      const isObjArray = aa.some((v) => v && typeof v === 'object') ||
        bb.some((v) => v && typeof v === 'object');
      if (isObjArray) {
        if (JSON.stringify(aa) !== JSON.stringify(bb)) {
          out[key] = bb;
        }
        continue;
      }
      if (aa.length !== bb.length || aa.some((v, i) => v !== bb[i])) {
        out[key] = bb;
      }
      continue;
    }
    // price_cents: form holds whole currency units (e.g. ``29`` for
    // ₪29) — the wire format is cents, so multiply by 100. We also
    // diff against the loaded value re-projected into the same
    // whole-unit space so a no-op edit stays out of the patch body.
    if (key === 'price_cents') {
      const aUnits = a === '' || a == null ? null : Math.round(Number(a));
      const bUnits = b === '' || b == null ? null : Math.round(Number(b));
      if (bUnits !== aUnits) {
        out[key] = Number.isFinite(bUnits) ? bUnits * 100 : null;
      }
      continue;
    }
    if ((a || '') !== (b || '')) {
      out[key] = b === '' ? null : b;
    }
  }
  return out;
}

/* -------------------- generic chip-list editor -------------------- */
function ChipList({ value, onChange, placeholder, disabled, testidPrefix }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (value.includes(trimmed)) { setDraft(''); return; }
    onChange([...value, trimmed]);
    setDraft('');
  };
  return (
    <div
      className="flex flex-wrap gap-1.5 items-center rounded-xl border border-border bg-background px-2 py-1.5 min-h-10"
      data-testid={`${testidPrefix}-chiplist`}
    >
      {value.map((v) => (
        <Badge
          key={v}
          variant="secondary"
          className="rounded-full text-[11px] inline-flex items-center gap-1"
          data-testid={`${testidPrefix}-chip-${v}`}
        >
          {v}
          {!disabled && (
            <button
              type="button"
              onClick={() => onChange(value.filter((x) => x !== v))}
              className="hover:text-destructive"
              aria-label={`Remove ${v}`}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </Badge>
      ))}
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); add(); }
        }}
        placeholder={placeholder}
        disabled={disabled}
        className="h-7 text-xs border-0 shadow-none flex-1 min-w-24 focus-visible:ring-0 px-1"
        data-testid={`${testidPrefix}-input`}
      />
      {!disabled && draft.trim() && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={add}
          className="h-7 px-2 text-xs"
          data-testid={`${testidPrefix}-add`}
        >
          <Plus className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

/* -------------------- localized-display hint -------------------- */
/**
 * Shows a small secondary line below free-text taxonomy inputs (sub_category,
 * item_type) with the localized display when the raw DB value matches a
 * known taxonomy token. Hidden otherwise.
 */
function LocalizedHint({ raw, translated }) {
  const trimmed = String(raw || '').trim();
  if (!trimmed || !translated || translated === trimmed) return null;
  return (
    <div
      className="mt-1 text-[11px] text-muted-foreground flex items-center gap-1 truncate"
      data-testid="localized-display-hint"
    >
      <span aria-hidden="true">·</span>
      <span>{translated}</span>
    </div>
  );
}

/* -------------------- multi-select pill group -------------------- */
function PillMultiSelect({ value, options, onChange, testidPrefix, format }) {
  const toggle = (opt) => {
    onChange(
      value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt],
    );
  };
  return (
    <div
      className="flex flex-wrap gap-1.5"
      data-testid={`${testidPrefix}-pillgroup`}
    >
      {options.map((opt) => {
        const on = value.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            data-testid={`${testidPrefix}-pill-${opt}`}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              on
                ? 'bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] border-[hsl(var(--accent))]'
                : 'bg-card border-border hover:bg-secondary'
            }`}
          >
            {format ? format(opt) : opt}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------- single-select shadcn wrapper that tolerates "" -------------------- */
function NullableSelect({ value, onChange, options, placeholder, testid, format, className }) {
  // Shadcn Select rejects empty string as a value; we map "" -> __none__ for the control.
  const v = value || '__none__';
  return (
    <Select
      value={v}
      onValueChange={(next) => onChange(next === '__none__' ? '' : next)}
    >
      <SelectTrigger className={`rounded-xl h-10 ${className || ''}`} data-testid={testid}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">—</SelectItem>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {format ? format(o) : o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/* ========================= Page ========================= */
export default function ItemDetail() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { id } = useParams();
  const nav = useNavigate();
  const location = useLocation();

  const [item, setItem] = useState(null);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const closetState = useClosetStore();
  const [addOpen, setAddOpen] = useState(false);
  const [closetSearch, setClosetSearch] = useState('');

  const [groupItemsState, setGroupItemsState] = useState([]);
  const [deletedGroupMemberIds, setDeletedGroupMemberIds] = useState(new Set());
  const [addedGroupMembers, setAddedGroupMembers] = useState([]);
  const [newUploadedMembers, setNewUploadedMembers] = useState([]);
  const [hostIdState, setHostIdState] = useState(null);
  const [activeViewIdState, setActiveViewIdState] = useState(id);
  const [gatekeeperOpen, setGatekeeperOpen] = useState(false);
  const [gatekeeperMismatches, setGatekeeperMismatches] = useState([]);

  const getTaxonomyFieldLabel = (field) => {
    switch (field) {
      case 'category': return t('itemDetail.edit.category', { defaultValue: 'Category' });
      case 'sub_category': return t('itemDetail.edit.subCategory', { defaultValue: 'Sub-category' });
      case 'brand': return t('itemDetail.edit.brand', { defaultValue: 'Brand' });
      case 'gender': return t('itemDetail.edit.gender', { defaultValue: 'Gender' });
      case 'dress_code': return t('itemDetail.edit.dressCode', { defaultValue: 'Dress Code' });
      case 'season': return t('itemDetail.edit.season', { defaultValue: 'Season' });
      case 'tradition': return t('itemDetail.edit.tradition', { defaultValue: 'Tradition' });
      default: return field;
    }
  };


  // ────────────────────────────────────────────────────────────────
  // Legacy "Clean background" (rembg matte) state.
  //
  // Naming note (May 2026): historically this whole block was named
  // ``repair*`` because rembg matting was originally pitched as a
  // "photo repair" operation. With Phase O.6 we ALSO added a real
  // Nano-Banana reconstruction CTA labelled "Repair photo" in the
  // UI — so the two flows ended up sharing the word "repair" in
  // their code but mapping to entirely different APIs:
  //
  //   • THIS block + ``onCleanBackground`` -> ``/closet/{id}/clean-background``
  //     i.e. rembg, alpha-channel cutout. Confusingly still labelled
  //     "Restore photo" in some legacy localisation strings; the
  //     ``itemDetail.repair.*`` i18n keys belong to RECONSTRUCTION
  //     and are NOT used by this block.
  //
  //   • ``onReshootPhoto`` below -> ``/closet/{id}/repair``
  //     i.e. Nano Banana studio reshoot. This is the user-facing
  //     "Repair photo" CTA from Phase O.6.
  //
  // Rename completed in May 2026 to make the two flows unambiguous
  // when reading the file. Don't merge them \u2014 they're different
  // backend endpoints with different cost/latency profiles.
  const [cleanBackgroundHint, setCleanBackgroundHint] = useState('');
  const [cleaningBackground, setCleaningBackground] = useState(false);
  // Phase O.6 — "Repair photo" CTA state. SEPARATE from
  // ``cleaningBackground`` above which gates the rembg flow.
  // This one gates the Nano-Banana studio reshoot.
  const [reshootingPhoto, setReshootingPhoto] = useState(false);
  // Clean-background progress %, simulated client-side because the
  // backend matting endpoint is a single non-streaming POST. We tick
  // the bar towards ~92% over ~14s (roughly the p95 duration of the
  // SegFormer + rembg pipeline) and snap to 100% on completion.
  const [cleanBackgroundProgress, setCleanBackgroundProgress] = useState(0);
  const [dictating, setDictating] = useState(false);
  const [dictationInterim, setDictationInterim] = useState('');
  const [showingOriginal, setShowingOriginal] = useState(false);

  // Phase V6 — photo add/replace state
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  // Re-analyse state. Same simulated-progress treatment as the
  // clean-background flow because the backend `/reanalyze` endpoint
  // is a single non-streaming POST that takes ~10–20 s on the VPS.
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState(0);

  // AI Eyes Assistant Chat state for Re-analyse photo
  const [reanalyzePrompt, setReanalyzePrompt] = useState('');
  const [reanalyzeChatHistory, setReanalyzeChatHistory] = useState([]);
  const [reanalyzeChatBusy, setReanalyzeChatBusy] = useState(false);
  const [reanalyzeChatProgress, setReanalyzeChatProgress] = useState(0);
  const [reanalyzeDictating, setReanalyzeDictating] = useState(false);
  const reanalyzeRecRef = useRef(null);

  const photoInputRef = useRef(null);
  const downscaleImageFileToB64 = (file, maxSide = 1600, quality = 0.85) => {
    return new Promise((resolve, reject) => {
      if (!file) return resolve('');
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result;
        if (typeof dataUrl !== 'string') {
          return resolve('');
        }
        const img = new Image();
        img.onload = () => {
          let width = img.naturalWidth || img.width || 0;
          let height = img.naturalHeight || img.height || 0;
          if (!width || !height) {
            const comma = dataUrl.indexOf(',');
            return resolve(comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl);
          }
          if (width > maxSide || height > maxSide) {
            if (width > height) {
              height = Math.round((height * maxSide) / width);
              width = maxSide;
            } else {
              width = Math.round((width * maxSide) / height);
              height = maxSide;
            }
          }
          try {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              const comma = dataUrl.indexOf(',');
              return resolve(comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl);
            }
            ctx.drawImage(img, 0, 0, width, height);
            const outDataUrl = canvas.toDataURL('image/jpeg', quality);
            canvas.width = 0;
            canvas.height = 0;
            const comma = outDataUrl.indexOf(',');
            resolve(comma >= 0 ? outDataUrl.slice(comma + 1) : outDataUrl);
          } catch (_) {
            const comma = dataUrl.indexOf(',');
            resolve(comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl);
          }
        };
        img.onerror = () => {
          const comma = dataUrl.indexOf(',');
          resolve(comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl);
        };
        img.src = dataUrl;
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  };

  // Phase Z3 — separate hidden input for direct-camera capture, mirrors
  // the Add-Item UX. ``capture="environment"`` opens the rear camera
  // on mobile; on desktop it harmlessly falls back to a file picker so
  // the button is safe to surface everywhere. We keep TWO inputs (vs.
  // one) so the same DOM element doesn't have to flip its ``capture``
  // attribute between clicks — that's racy on some Android browsers
  // and causes the camera to open even when the user wanted the
  // library picker.
  const cameraInputRef = useRef(null);
  const onPickPhoto = () => photoInputRef.current?.click();
  const openCameraCapture = () => cameraInputRef.current?.click();
  const onPhotoFileChosen = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingPhoto(true);
    const loadingId = toast.loading(t('itemDetail.photo.running'));
    try {
      const imageBase64 = await downscaleImageFileToB64(file, 1600, 0.85);
      const res = await api.setItemPhoto(id, {
        imageBase64,
        imageMime: 'image/jpeg',
        // Per UX spec: "Replace photo" must just swap in the raw
        // upload — don't auto-run the cutout/analysis pipeline. The
        // user then explicitly chooses to "Clean background" and/or
        // "Analyze" afterwards. This avoids surprise field rewrites
        // and a long automatic wait the user didn't ask for.
        autoSegment: false,
        // Pass through the current UI locale so that if the caller
        // later flips ``autoSegment`` back on, the analyzer output
        // matches what the user sees in the app. Harmless no-op while
        // ``autoSegment`` is false.
        language: (i18n.language || '').split('-')[0] || 'en',
      });
      // Phase Z2.6 — same fix as Clean Background. Only refresh the
      // baseline ``item`` so the image preview picks up the new
      // ``original_image_url``; do NOT call ``setForm(toFormState(...))``,
      // which would wipe the user's pending edits to other fields.
      // With ``autoSegment=false`` the backend only mutates image
      // URLs (no editable-field touches), so ``diffPatch`` against
      // the new baseline correctly reflects only the user's
      // editable-field drafts.
      setItem(res.item);
      try {
        closetStore.upsert(res.item);
        closetStore.triggerRepair();
      } catch (e) {
        console.warn('ItemDetail: closetStore sync after photo upload failed', e);
      }
      toast.dismiss(loadingId);
      toast.success(t('itemDetail.photo.success'));
    } catch (err) {
      toast.dismiss(loadingId);
      toast.error(err?.response?.data?.detail || t('itemDetail.photo.error'));
    } finally {
      setUploadingPhoto(false);
    }
  };
  const memberPhotoInputRef = useRef(null);
  const onAddMemberPhoto = () => memberPhotoInputRef.current?.click();
  const recognitionRef = useRef(null);
  const sttSupported = useRef(isSTTSupported());



  /* ------------------- load + sync ------------------- */
  const load = async () => {
    try {
      const data = await api.getItem(id);
      setItem(data);
      setForm(toFormState(data, user));
    } catch (err) {
      const is404 = err?.response?.status === 404;
      toast.error(is404 ? t('itemDetail.notFound') : (err?.response?.data?.detail || t('common.error')));
      nav('/closet');
    } finally {
      setLoading(false);
    }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [id]);
  useEffect(() => () => {
    try { recognitionRef.current?.abort?.(); } catch { /* ignore */ }
  }, []);

  const patch = useMemo(
    () => (item && form ? diffPatch(item, form, user) : {}),
    [item, form, user],
  );

  const initialHostId = useMemo(() => {
    if (!item) return null;
    const dbList = [item, ...(item.group_members || [])];
    const hostItem = dbList.find(x => x.group_role === 'host' || x.id === x.group_id) || dbList[0] || item;
    return hostItem ? hostItem.id : item.id;
  }, [item]);

  const groupIsDirty = useMemo(() => {
    return (
      deletedGroupMemberIds.size > 0 ||
      addedGroupMembers.length > 0 ||
      newUploadedMembers.length > 0 ||
      (initialHostId !== null && hostIdState !== initialHostId)
    );
  }, [deletedGroupMemberIds, addedGroupMembers, newUploadedMembers, hostIdState, initialHostId]);

  const isDirty = Object.keys(patch).length > 0 || groupIsDirty;

  useEffect(() => {
    if (item) {
      const dbList = [item, ...(item.group_members || [])];
      const unique = [];
      const seen = new Set();
      for (const x of dbList) {
        if (x && !seen.has(x.id)) {
          seen.add(x.id);
          unique.push(x);
        }
      }
      setGroupItemsState(unique);
      
      const hostItem = unique.find(x => x.group_role === 'host' || x.id === x.group_id) || unique[0] || item;
      setHostIdState(hostItem ? hostItem.id : item.id);
      setActiveViewIdState(hostItem ? hostItem.id : item.id);
      
      setDeletedGroupMemberIds(new Set());
      setAddedGroupMembers([]);
      setNewUploadedMembers([]);
    }
  }, [item]);

  useEffect(() => {
    setActiveViewIdState(id);
  }, [id]);


  const currentGroupItems = useMemo(() => {
    if (!item) return [];
    const dbList = [item, ...(item.group_members || [])];
    const filteredDbList = dbList.filter(x => !deletedGroupMemberIds.has(x.id));
    const list = [...filteredDbList, ...addedGroupMembers];
    const uploadsMapped = newUploadedMembers.map(up => ({
      id: up.id,
      title: `${item.title || 'Garment'} (View)`,
      original_image_url: up.original_image_url,
      group_role: up.id === hostIdState ? 'host' : 'member',
      group_id: hostIdState
    }));
    const allItems = [...list, ...uploadsMapped];
    return allItems.map(x => ({
      ...x,
      group_role: x.id === hostIdState ? 'host' : 'member',
      group_id: hostIdState
    })).sort((a, b) => {
      if (a.id === hostIdState) return -1;
      if (b.id === hostIdState) return 1;
      return 0;
    });
  }, [item, deletedGroupMemberIds, addedGroupMembers, newUploadedMembers, hostIdState]);

  const candidateItems = useMemo(() => {
    const dbMemberIds = new Set((item?.group_members || []).map((m) => m.id));
    const addedMemberIds = new Set(addedGroupMembers.map(m => m.id));
    return (closetState.items || []).filter(
      (it) =>
        it.id !== id &&
        !dbMemberIds.has(it.id) &&
        !addedMemberIds.has(it.id) &&
        it.id !== hostIdState &&
        it.group_role !== 'member'
    );
  }, [closetState.items, id, item, addedGroupMembers, hostIdState]);

  const filteredCandidates = useMemo(() => {
    const q = closetSearch.toLowerCase().trim();
    if (!q) return candidateItems;
    return candidateItems.filter((it) => {
      const title = (it.title || it.name || '').toLowerCase();
      const category = (it.category || '').toLowerCase();
      return title.includes(q) || category.includes(q);
    });
  }, [candidateItems, closetSearch]);

  const handleSelectClosetItem = (targetMemberId) => {
    const targetItem = (closetState.items || []).find(x => x.id === targetMemberId);
    if (!targetItem) return;
    setAddedGroupMembers(prev => [...prev, targetItem]);
    setDeletedGroupMemberIds(prev => {
      const next = new Set(prev);
      next.delete(targetMemberId);
      return next;
    });
    setAddOpen(false);
    toast.success(t('common.success'));
  };

  const onMemberPhotoFileChosen = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const imageBase64 = await downscaleImageFileToB64(file, 1600, 0.85);
      const original_image_url = `data:image/jpeg;base64,${imageBase64}`;
      const tempId = `temp-upload-${Date.now()}`;
      setNewUploadedMembers((prev) => [
        ...prev,
        {
          id: tempId,
          image_base64: imageBase64,
          image_mime: 'image/jpeg',
          original_image_url: original_image_url,
        },
      ]);
      setAddOpen(false);
      toast.success(t('common.success'));
    } catch (err) {
      console.error(err);
      toast.error(t('common.error'));
    } finally {
      setUploadingPhoto(false);
    }
  };

  const onSetFront = (memberId) => {
    setHostIdState(memberId);
    toast.success(t('common.success'));
  };

  const onDeleteMember = (memberId) => {
    const confirmDelete = window.confirm(t('closet.confirmDeleteTitle'));
    if (!confirmDelete) return;

    setDeletedGroupMemberIds((prev) => {
      const next = new Set(prev);
      next.add(memberId);
      return next;
    });
    setAddedGroupMembers((prev) => prev.filter((x) => x.id !== memberId));
    setNewUploadedMembers((prev) => prev.filter((x) => x.id !== memberId));

    if (hostIdState === memberId) {
      const remaining = currentGroupItems.filter((x) => x.id !== memberId);
      if (remaining.length > 0) {
        setHostIdState(remaining[0].id);
      } else {
        setHostIdState(item.id);
      }
    }
    toast.success(t('common.success'));
  };

  const setField = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  /* ------------------- save / discard ------------------- */
  const executeSavePipeline = () => {
    setSaving(true);
    
    // 1. Optimistic update of frontend's closet state immediately
    const storeItems = closetStore.getSnapshot().items || [];
    const activeHostId = hostIdState || id;
    
    // Find host in the store
    const hostItem = storeItems.find(it => it.id === activeHostId) || item;
    
    // Update host fields with current form values
    const updatedHost = {
      ...hostItem,
      ...form,
      group_id: activeHostId,
      group_role: 'host',
      updated_at: new Date().toISOString()
    };
    
    // Compile members list
    const remainingMembers = [];
    const dbMembers = [item, ...(item.group_members || [])];
    for (const member of dbMembers) {
      if (member.id !== activeHostId && !deletedGroupMemberIds.has(member.id)) {
        remainingMembers.push({
          ...member,
          group_id: activeHostId,
          group_role: 'member'
        });
      }
    }
    
    for (const added of addedGroupMembers) {
      remainingMembers.push({
        ...added,
        group_id: activeHostId,
        group_role: 'member'
      });
    }
    
    for (const upload of newUploadedMembers) {
      remainingMembers.push({
        id: upload.id,
        user_id: user?.id,
        title: `${updatedHost.title || 'Garment'} (View)`,
        category: updatedHost.category,
        sub_category: updatedHost.sub_category,
        item_type: updatedHost.item_type,
        brand: updatedHost.brand,
        gender: updatedHost.gender,
        dress_code: updatedHost.dress_code,
        colors: updatedHost.colors || [],
        color: updatedHost.color,
        group_id: activeHostId,
        group_role: 'member',
        original_image_url: upload.original_image_url,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }
    
    updatedHost.group_members = remainingMembers;
    
    // Apply changes locally to the store immediately!
    closetStore.upsert(updatedHost);
    for (const m of remainingMembers) {
      closetStore.upsert(m);
    }
    
    // Restore deleted group members to the closet grid
    for (const removeId of deletedGroupMemberIds) {
      const removedItem = groupItemsState.find(it => it.id === removeId) || storeItems.find(it => it.id === removeId);
      if (removedItem) {
        closetStore.upsert({
          ...removedItem,
          group_id: null,
          group_role: null,
          updated_at: new Date().toISOString()
        });
      }
    }

    toast.success(t('itemDetail.group.savingInBackground', { defaultValue: 'Saving changes in background...' }));
    
    // Redirect user immediately so they see the refreshed modifications
    if (location.state?.fromOutfits) {
      nav('/stylist', { 
        replace: true, 
        state: { 
          tab: 'shuffle', 
          selectedOutfitId: location.state.returnToOutfitId 
        } 
      });
    } else {
      nav('/closet');
    }

    // Register all saved IDs with the poller
    const allSavedIds = [activeHostId, ...remainingMembers.map(m => m.id)];
    workStore.registerPolishItems(allSavedIds);

    // 2. Perform database updates in the background
    const savePromise = (async () => {
      let currentHostId = id;
      
      if (groupIsDirty) {
        const payload = {
          new_host_id: (hostIdState !== null && hostIdState !== initialHostId) ? hostIdState : null,
          ungroup_member_ids: Array.from(deletedGroupMemberIds),
          add_member_ids: addedGroupMembers.map(m => m.id),
          new_uploads: newUploadedMembers.map(up => ({
            image_base64: up.image_base64,
            image_mime: up.image_mime
          }))
        };
        const groupRes = await api.groupEdit(id, payload);
        if (groupRes.status === 'success' && groupRes.host) {
          currentHostId = groupRes.host.id;
        }
      }

      if (Object.keys(patch).length > 0) {
        await api.updateItem(currentHostId, patch);
      }
      
      const finalHost = await api.getItem(currentHostId);
      return finalHost;
    })();

    savePromise
      .then(async (finalHost) => {
        // Sync real DB records to the store (replaces temp IDs/images with final data)
        if (finalHost) {
          closetStore.upsert(finalHost);
          if (finalHost.group_members) {
            for (const m of finalHost.group_members) {
              closetStore.upsert(m);
            }
          }
        }
        await closetStore.incrementalSync({ force: true });
        toast.success(t('common.success'));
      })
      .catch((err) => {
        console.error('Background save failed:', err);
        toast.error(err?.response?.data?.detail || t('common.error'));
        // Revert store state on failure
        closetStore.prewarm({ force: true });
      })
      .finally(() => {
        setSaving(false);
      });
  };

  const onSave = () => {
    if (!isDirty || saving) return;

    // Check for taxonomy mismatches between host and members
    const hostObj = {
      category: form.category,
      sub_category: form.sub_category,
      brand: form.brand,
      gender: form.gender,
      dress_code: form.dress_code,
      season: form.season,
      tradition: form.tradition
    };

    const normCategory = (cat) => {
      const s = String(cat || '').trim().toLowerCase().replace(/\s+/g, '_');
      if (s === 'top' || s === 'tops') return 'top';
      if (s === 'bottom' || s === 'bottoms') return 'bottom';
      if (s === 'footwear' || s === 'shoes') return 'footwear';
      if (s === 'accessory' || s === 'accessories') return 'accessories';
      return s;
    };
    const members = currentGroupItems.filter(x => x.id !== (hostIdState || id));
    const allItemsInGroup = [hostObj, ...members].filter(Boolean);
    const categories = new Set(allItemsInGroup.map(it => normCategory(it.category)));
    const isGroupSet = categories.size > 1;

    const mismatchesSet = new Set();
    if (!isGroupSet) {
      for (const m of members) {
        const diffs = getTaxonomyMismatches(hostObj, m);
        for (const d of diffs) {
          mismatchesSet.add(d);
        }
      }
    }

    const mismatches = Array.from(mismatchesSet);
    if (mismatches.length > 0) {
      setGatekeeperMismatches(mismatches);
      setGatekeeperOpen(true);
    } else {
      executeSavePipeline();
    }
  };
  const onDiscard = () => {
    if (!item) return;
    setForm(toFormState(item, user));
    
    // Reset group edits
    setDeletedGroupMemberIds(new Set());
    setAddedGroupMembers([]);
    setNewUploadedMembers([]);
    setHostIdState(initialHostId);
    
    toast.message(t('itemDetail.changesDiscarded'));
  };

  /* ------------------- Re-analyse (rerun The Eyes) ------------------- */
  // Triggers POST /api/v1/closet/:id/reanalyze on the backend, which
  // pulls the item's stored image and rewrites the analysis-derived
  // fields (title, taxonomy, colours, materials, condition, …). We
  // surface a Progress bar with an asymptotic ramp because the API
  // is a single non-streaming POST and the user shouldn't be left
  // wondering whether anything is happening.
  const onReanalyze = async () => {
    if (analyzing) return;
    setAnalyzing(true);
    setAnalyzeProgress(4);
    const ticker = setInterval(() => {
      setAnalyzeProgress((p) => {
        if (p >= 92) return 92;
        const next = p + Math.max(1, Math.round((92 - p) * 0.07));
        return Math.min(92, next);
      });
    }, 350);
    try {
      // Phase R — receipt-sourced items must never have their receipt
      // data overwritten by The Eyes.  Detect via from_receipt flag or
      // the receipt_locked_fields list stored at creation time, then
      // pass fill_empty_only=true so the backend only fills in chips
      // that are currently empty/falsy.
      const isReceiptItem =
        item?.from_receipt ||
        (Array.isArray(item?.receipt_locked_fields) && item.receipt_locked_fields.length > 0);
      const res = await api.reanalyzeItem(id, { fill_empty_only: isReceiptItem });
      setForm(toFormState(res.item, user));
      toast.success(t('itemDetail.reanalyze.success') + " · Press Save to keep changes.");
    } catch (err) {
      toast.error(
        err?.response?.data?.detail || t('itemDetail.reanalyze.error'),
      );
    } finally {
      clearInterval(ticker);
      setAnalyzeProgress(100);
      setTimeout(() => {
        setAnalyzing(false);
        setAnalyzeProgress(0);
      }, 350);
    }
  };

  /* ------------------- Re-analyse AI Chat & Prompt Box ------------------- */
  const startPromptDictation = () => {
    if (!sttSupported.current) return;
    const rec = createRecognition({
      lang: (user?.preferred_language || 'en').toLowerCase(),
      onInterim: () => {},
      onFinal: (finalText) => {
        if (finalText) {
          setReanalyzePrompt((prev) =>
            prev ? `${prev} ${finalText}`.slice(0, 240) : finalText.slice(0, 240),
          );
        }
      },
      onEnd: () => {
        setReanalyzeDictating(false);
        reanalyzeRecRef.current = null;
      },
      onError: () => toast.error(t('stylist.micDenied')),
    });
    if (!rec) return;
    reanalyzeRecRef.current = rec;
    rec.start();
    setReanalyzeDictating(true);
  };

  const stopPromptDictation = () => {
    try { reanalyzeRecRef.current?.stop?.(); } catch { /* ignore */ }
  };

  const onSendReanalyzePrompt = async (customPrompt) => {
    const text = (typeof customPrompt === 'string' ? customPrompt : reanalyzePrompt).trim();
    if (!text || reanalyzeChatBusy) return;

    const userTurn = { role: 'user', content: text };
    const updatedHistory = [...reanalyzeChatHistory, userTurn];
    setReanalyzeChatHistory(updatedHistory);
    setReanalyzePrompt('');
    setReanalyzeChatBusy(true);
    setReanalyzeChatProgress(5);

    const ticker = setInterval(() => {
      setReanalyzeChatProgress((p) => {
        if (p >= 92) return 92;
        const next = p + Math.max(1, Math.round((92 - p) * 0.08));
        return Math.min(92, next);
      });
    }, 300);

    try {
      const isReceiptItem =
        item?.from_receipt ||
        (Array.isArray(item?.receipt_locked_fields) && item.receipt_locked_fields.length > 0);

      const res = await api.chatAnalyseItem(id, {
        message: text,
        history: updatedHistory.map((h) => ({ role: h.role, content: h.content })),
        fill_empty_only: isReceiptItem,
      });

      if (res?.item && (res.action_taken === 'metadata_update' || res.updated_fields)) {
        setForm(toFormState(res.item, user));
        toast.success(t('itemDetail.reanalyze.success') + " · Press Save to keep changes.");
      }

      const assistantTurn = {
        role: 'assistant',
        content: res.reply || t('itemDetail.reanalyze.success'),
        action_taken: res.action_taken,
        image_url: res.image_url,
        updated_fields: res.updated_fields,
      };

      setReanalyzeChatHistory((prev) => [...prev, assistantTurn]);

      if (res.action_taken === 'image_edit' && res.image_url) {
        toast.success(t('itemDetail.reanalyze.nanoBananaBadge') + "! Preview ready in chat.");
      }
    } catch (err) {
      const errMsg = err?.response?.data?.detail || t('itemDetail.reanalyze.error');
      toast.error(errMsg);
      setReanalyzeChatHistory((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: errMsg,
          error: true,
        },
      ]);
    } finally {
      clearInterval(ticker);
      setReanalyzeChatProgress(100);
      setTimeout(() => {
        setReanalyzeChatBusy(false);
        setReanalyzeChatProgress(0);
      }, 350);
    }
  };

  const onApplyReconstructedImage = (imgUrl) => {
    if (!imgUrl) return;
    setForm((prev) => ({
      ...prev,
      reconstructed_image_url: imgUrl,
    }));
    toast.success(t('itemDetail.reanalyze.imageApplied'));
  };


  /* ------------------- Clean background (rembg matte; Phase V Fix 2) ----- */
  const onCleanBackground = async () => {
    if (cleaningBackground) return;
    setCleaningBackground(true);
    setShowingOriginal(false);
    setCleanBackgroundProgress(4);
    // Asymptotic ramp: each tick closes ~7% of the remaining gap to 92%,
    // so the bar feels lively at the start and decelerates as it nears
    // the cap — never reaching 100% until the API actually returns.
    const ticker = setInterval(() => {
      setCleanBackgroundProgress((p) => {
        if (p >= 92) return 92;
        const next = p + Math.max(1, Math.round((92 - p) * 0.07));
        return Math.min(92, next);
      });
    }, 350);
    try {
      const res = await api.cleanItemBackground(id, true);
      if (res.applied) {
        toast.success(t('itemDetail.cleanBackground.success'));
        setForm(toFormState(res.item, user));
        setCleanBackgroundHint('');
      } else {
        toast.warning(res.detail || t('itemDetail.cleanBackground.rejected'));
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('itemDetail.cleanBackground.error'));
    } finally {
      clearInterval(ticker);
      setCleanBackgroundProgress(100);
      // Brief delay so the user sees the bar hit 100% before it
      // collapses — feels more "complete" than yanking it instantly.
      setTimeout(() => {
        setCleaningBackground(false);
        setCleanBackgroundProgress(0);
      }, 350);
    }
  };
  // Phase O.6 — opt-in "Repair photo" action. Triggers Nano-Banana
  // studio reshoot via the existing /closet/{id}/repair endpoint.
  // Only surfaced when the one-pass /analyze result advised it
  // (``item.reconstruction_advised === true``) AND the item doesn't
  // already carry a reconstructed image. The repair runs synchronously
  // — Nano Banana is fast (~5-10s) so we keep it as a foreground call
  // with a spinner rather than another background-poll round-trip.
  const onReshootPhoto = async () => {
    if (reshootingPhoto) return;
    setReshootingPhoto(true);
    try {
      const res = await api.repairItemImage(id, { preview: true });
      if (res?.applied && res.item) {
        setForm(toFormState(res.item, user));
        toast.success(
          t('item.reshootSuccess', { defaultValue: 'Photo restored.' }),
        );
      } else {
        toast.warning(
          res?.detail
            || t('item.reshootRejected', {
                 defaultValue: 'Restored photo was rejected — keeping the original.',
               }),
        );
      }
    } catch (err) {
      toast.error(
        err?.response?.data?.detail
          || t('item.reshootError', {
               defaultValue: 'Could not restore photo. Please try again.',
             }),
      );
    } finally {
      setReshootingPhoto(false);
    }
  };

  const startDictation = () => {
    if (!sttSupported.current) return;
    const rec = createRecognition({
      lang: (user?.preferred_language || 'en').toLowerCase(),
      onInterim: (txt) => setDictationInterim(txt || ''),
      onFinal: (finalText) => {
        if (finalText) {
          setCleanBackgroundHint((prev) =>
            prev ? `${prev} ${finalText}`.slice(0, 240) : finalText.slice(0, 240),
          );
        }
      },
      onEnd: () => {
        setDictating(false);
        setDictationInterim('');
        recognitionRef.current = null;
      },
      onError: () => toast.error(t('stylist.micDenied')),
    });
    if (!rec) return;
    recognitionRef.current = rec;
    rec.start();
    setDictating(true);
  };
  const stopDictation = () => {
    try { recognitionRef.current?.stop?.(); } catch { /* ignore */ }
  };



  const onDelete = async () => {
    // Optimistic-first delete: the closetStore is the user's "edge
    // database" — UI must reflect the change instantly, the
    // round-trip to MongoDB happens in the background, and we only
    // reverse the optimistic change if the server actually rejected
    // the delete. This restores the supercharged UX that turned
    // closet ops from "tap-and-wait-2s" into "tap-and-done".
    const snapshot = item;
    closetStore.remove(id);
    toast.success(t('itemDetail.deleted'));
    if (location.state?.fromOutfits) {
      nav('/stylist', { replace: true, state: { tab: 'shuffle' } });
    } else {
      nav('/closet');
    }
    // Fire-and-forget — we're already off the page. Reconcile on failure.
    api.deleteItem(id).catch((err) => {
      // Revert if API call fails, UNLESS it's a 404 (already deleted).
      // A 404 means the UI optimistic delete matched reality. Reverting it
      // causes a phantom duplicate in the closetStore that triggers false
      // duplicate warnings on subsequent uploads.
      if (err?.response?.status !== 404) {
        if (snapshot) {
          closetStore.upsert(snapshot);
        }
        toast.error(err?.response?.data?.detail || t('closet.deleteFailed'));
      }
    });
  };

  if (loading || !item || !form) {
    return (
      <div className="container-px max-w-5xl mx-auto pt-6">
        <div className="aspect-[3/4] w-full rounded-[calc(var(--radius)+6px)] shimmer" />
      </div>
    );
  }

  const activeViewItem = currentGroupItems.find(x => x.id === activeViewIdState) || item;
  const isViewingHost = !activeViewIdState || activeViewIdState === (hostIdState || id);
  const hasNewPreview = isViewingHost && (
    (form.reconstructed_image_url && form.reconstructed_image_url !== item.reconstructed_image_url) ||
    (form.clean_image_url && form.clean_image_url !== item.clean_image_url)
  );
  const mergedItem = {
    ...item,
    ...form,
    thumbnail_data_url: hasNewPreview ? null : item.thumbnail_data_url,
    original_image_url: activeViewItem?.original_image_url,
    segmented_image_url: activeViewItem?.segmented_image_url,
    reconstructed_image_url: isViewingHost ? (form.reconstructed_image_url || activeViewItem?.reconstructed_image_url) : activeViewItem?.reconstructed_image_url,
    clean_image_url: isViewingHost ? (form.clean_image_url || activeViewItem?.clean_image_url) : activeViewItem?.clean_image_url,
    clean_image_status: isViewingHost ? (form.clean_image_status || activeViewItem?.clean_image_status) : activeViewItem?.clean_image_status,
  };
  const hasReconstruction = !!mergedItem.reconstructed_image_url;
  // Phase O.6 — image priority centralised via ``lib/itemImage``. When
  // the user has toggled "Show original" we deliberately skip the
  // reconstruction layer so they can compare the un-restyled photo;
  // every other field (clean rembg PNG / segmented JPG / raw original)
  // still falls back in the canonical order.
  const preferredImage = bestImageUrl(mergedItem, {
    skipReconstruction: showingOriginal,
  });
  // "Repair photo" CTA visibility:
  //   • the one-pass /analyze response asked us to advise it
  //     (``reconstruction_advised: true``), AND
  //   • the user hasn't already accepted a reshoot for this item.
  // Hidden once the item carries a ``reconstructed_image_url`` so we
  // don't repeatedly nudge for a feature the user already used.
  const showRepairPhotoCta =
    (!!mergedItem.reconstruction_advised || !!mergedItem.from_receipt) && !mergedItem.reconstructed_image_url;
  const reconstructionReasons =
    (mergedItem.reconstruction_metadata && mergedItem.reconstruction_metadata.reasons) || [];

  /* ========================= RENDER ========================= */
  return (
    <div className="container-px max-w-5xl mx-auto pt-4 md:pt-8 pb-24">
      {/* Floating Action Bar */}
      <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-2.5 py-1.5 rounded-full border border-border bg-card/90 backdrop-blur-lg shadow-xl md:bottom-8 max-w-[calc(100vw-2rem)] shrink-0 animate-[slideUp_0.2s_ease-out]">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => {
            if (location.state?.fromOutfits) {
              nav('/stylist', { 
                replace: true, 
                state: { 
                  tab: 'shuffle', 
                  selectedOutfitId: location.state.returnToOutfitId 
                } 
              });
            } else if (window.history.state && window.history.state.idx > 0) {
              nav(-1);
            } else {
              nav('/closet', { replace: true });
            }
          }}
          className="rounded-full h-9 w-9 flex items-center justify-center"
          data-testid="item-back"
          title={t('common.back')}
          aria-label={t('common.back')}
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
        </Button>
        
        <div className="h-4 w-[1px] bg-border mx-0.5" />

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onDiscard}
          disabled={!isDirty || saving}
          className="rounded-full h-9 w-9 flex items-center justify-center"
          data-testid="item-edit-discard-button"
          title={t('itemDetail.edit.discard')}
          aria-label={t('itemDetail.edit.discard')}
        >
          <Undo2 className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          onClick={onSave}
          disabled={!isDirty || saving}
          size="icon"
          className="rounded-full h-9 w-9 flex items-center justify-center"
          data-testid="item-edit-save-button"
          title={saving ? t('itemDetail.edit.saving') : t('itemDetail.edit.save')}
          aria-label={saving ? t('itemDetail.edit.saving') : t('itemDetail.edit.save')}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
        </Button>

        {isDirty && (
          <Badge
            variant="outline"
            className="rounded-full text-[9px] px-2 h-5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 whitespace-nowrap"
            data-testid="item-edit-dirty-badge"
          >
            {Object.keys(patch).length}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        {/* ---------- Image column ---------- */}
        <div className="md:col-span-3 space-y-4">
          <Card className="rounded-[calc(var(--radius)+6px)] overflow-hidden shadow-editorial relative">
            <AspectRatio ratio={3 / 4} className="bg-secondary">
              {preferredImage ? (
                <img
                  src={preferredImage}
                  alt={form.title || item.title}
                  className="w-full h-full object-contain"
                  data-testid="item-detail-main-image"
                />
              ) : (
                <div
                  className="w-full h-full flex flex-col items-center justify-center gap-3 text-muted-foreground bg-gradient-to-br from-muted/50 to-muted/20 p-6 text-center"
                  data-testid="item-detail-no-image"
                >
                  {item.dpp_data ? (
                    <>
                      <QrCode className="h-10 w-10 text-[hsl(var(--accent))]/70" />
                      <div className="text-sm max-w-xs">
                        {t('itemDetail.photo.placeholderHint')}
                      </div>
                    </>
                  ) : (
                    <div className="text-sm">{t('itemDetail.noImage')}</div>
                  )}
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    className="rounded-xl mt-1"
                    onClick={openCameraCapture}
                    disabled={uploadingPhoto}
                    data-testid="item-detail-take-photo-btn"
                  >
                    {uploadingPhoto ? (
                      <Loader2 className="h-4 w-4 me-2 animate-spin" />
                    ) : (
                      <Camera className="h-4 w-4 me-2" />
                    )}
                    {t('itemDetail.photo.takeLabel', { defaultValue: 'Take photo' })}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    onClick={onPickPhoto}
                    disabled={uploadingPhoto}
                    data-testid="item-detail-add-photo-btn"
                  >
                    <Images className="h-4 w-4 me-2" />
                    {t('itemDetail.photo.addLabel')}
                  </Button>
                </div>
              )}
            </AspectRatio>
            {/* Replace photo controls (subtle pill row, shown only when an image exists).
                Mirrors the no-image state's two-button choice so the user always has
                "Take photo" (camera) and "Choose from library" (gallery) at hand.
                Phase O.6 adds an optional third pill: "Repair photo" — only shown
                when the one-pass /analyze response advised it (and the user hasn't
                already accepted a reshoot for this item). */}
            {preferredImage && (
              <div className="absolute bottom-3 end-3 inline-flex items-center gap-1.5 flex-wrap justify-end">
                {showRepairPhotoCta && (
                  <button
                    type="button"
                    onClick={onReshootPhoto}
                    disabled={reshootingPhoto || uploadingPhoto}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--accent))]/95 text-[hsl(var(--accent-foreground))] backdrop-blur border border-[hsl(var(--accent))]/70 px-2.5 py-1 text-[11px] font-medium hover:bg-[hsl(var(--accent))] transition-colors disabled:opacity-60 shadow-editorial"
                    data-testid="item-detail-repair-photo-btn"
                    aria-label={t('item.repairPhoto', { defaultValue: 'Repair photo' })}
                  >
                    {reshootingPhoto ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Sparkles className="h-3 w-3" />
                    )}
                    {reshootingPhoto
                      ? t('item.repairingPhoto', { defaultValue: 'Restoring…' })
                      : t('item.repairPhoto', { defaultValue: 'Repair photo' })}
                  </button>
                )}                <button
                  type="button"
                  onClick={openCameraCapture}
                  disabled={uploadingPhoto}
                  className="inline-flex items-center gap-1.5 rounded-full bg-background/90 backdrop-blur border border-border px-2.5 py-1 text-[11px] font-medium hover:bg-secondary transition-colors disabled:opacity-60"
                  data-testid="item-detail-take-photo-replace-btn"
                  aria-label={t('itemDetail.photo.takeLabel', { defaultValue: 'Take photo' })}
                >
                  {uploadingPhoto ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Camera className="h-3 w-3" />
                  )}
                  {t('itemDetail.photo.takeLabel', { defaultValue: 'Take photo' })}
                </button>
                <button
                  type="button"
                  onClick={onPickPhoto}
                  disabled={uploadingPhoto}
                  className="inline-flex items-center gap-1.5 rounded-full bg-background/90 backdrop-blur border border-border px-2.5 py-1 text-[11px] font-medium hover:bg-secondary transition-colors disabled:opacity-60"
                  data-testid="item-detail-replace-photo-btn"
                  aria-label={t('itemDetail.photo.replaceLabel')}
                >
                  <Images className="h-3 w-3" />
                  {t('itemDetail.photo.replaceLabel')}
                </button>
              </div>
            )}
            {/* Hidden inputs — one for the library picker, one for direct
                camera capture. Separate elements (rather than flipping a
                single input's ``capture`` attr) avoid race conditions on
                Android where the wrong dialog can open. */}
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              data-testid="item-detail-photo-input"
              onChange={onPhotoFileChosen}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              data-testid="item-detail-camera-input"
              onChange={onPhotoFileChosen}
            />
            {hasReconstruction && (
              <>
                <div
                  className="absolute top-3 start-3 inline-flex items-center gap-1.5 rounded-full bg-background/90 backdrop-blur border border-border px-2.5 py-1 text-[11px] font-semibold"
                  data-testid="item-detail-repaired-badge"
                >
                  <Wand2 className="h-3 w-3 text-[hsl(var(--accent))]" />
                  {showingOriginal
                    ? t('itemDetail.repair.showingOriginal')
                    : t('itemDetail.repair.showingRepaired')}
                </div>
                <button
                  type="button"
                  onClick={() => setShowingOriginal((s) => !s)}
                  className="absolute top-3 end-3 inline-flex items-center gap-1.5 rounded-full bg-background/90 backdrop-blur border border-border px-2.5 py-1 text-[11px] font-medium hover:bg-secondary transition-colors"
                  data-testid="item-detail-toggle-reconstruction"
                >
                  <RefreshCw className="h-3 w-3" />
                  {showingOriginal
                    ? t('itemDetail.repair.showRepaired')
                    : t('itemDetail.repair.showOriginal')}
                </button>
              </>
            )}
            <div className="absolute bottom-3 start-3 hidden md:flex items-center gap-2">
              <SourceTagBadge source={item.source} intent={item.marketplace_intent} />
              <Badge
                variant="outline"
                className="rounded-full text-[10px] bg-background/90 backdrop-blur"
              >
                {labelForCategory(form.category, t)}
              </Badge>
            </div>
          </Card>

          {/* Wardrobe Insights / Wear Stats */}
          <Card className="rounded-[calc(var(--radius)+6px)] shadow-editorial overflow-hidden" data-testid="item-insights-card">
            <CardContent className="p-5 space-y-3">
              <div className="caps-label text-muted-foreground">{t('itemDetail.stats.label', { defaultValue: 'Wardrobe Insights' })}</div>
              <div className="grid grid-cols-2 gap-4 pt-1">
                <div className="space-y-1">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{t('itemDetail.stats.timesWorn', { defaultValue: 'Times Worn' })}</div>
                  <div className="text-2xl font-display font-semibold text-[hsl(var(--accent))]">
                    {item.wear_count || 0}
                  </div>
                </div>
                {item.price_cents > 0 && (
                  <div className="space-y-1">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{t('itemDetail.stats.costPerWear', { defaultValue: 'Cost per Wear' })}</div>
                    <div className="text-2xl font-display font-semibold">
                      {new Intl.NumberFormat(i18n.language, { style: 'currency', currency: item.currency || 'USD' }).format(
                        ((item.price_cents || 0) / 100) / (item.wear_count || 1)
                      )}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Garment Views (Item Group) picker */}
          <Card className="rounded-[calc(var(--radius)+6px)] shadow-editorial overflow-hidden" data-testid="item-group-views-card">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="caps-label text-muted-foreground truncate max-w-[200px]" title={(() => {
                  const hostItem = currentGroupItems.find(x => x.group_role === 'host' || x.id === hostIdState) || currentGroupItems[0] || item;
                  return hostItem ? (hostItem.title || hostItem.name || 'Garment Views') : 'Garment Views';
                })()}>
                  {(() => {
                    const hostItem = currentGroupItems.find(x => x.group_role === 'host' || x.id === hostIdState) || currentGroupItems[0] || item;
                    return hostItem ? (hostItem.title || hostItem.name || t('profile.sections.photos')) : t('profile.sections.photos');
                  })()}
                </div>
                {item.group_id && (
                  <Badge variant="secondary" className="rounded-full text-[10px] flex-shrink-0">
                    {t('profile.sections.photos')}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                {t('closet.subtitle')}
              </p>

              {/* Member Action Bar */}
              <div className="h-10 mb-4 flex items-center gap-3">
                {activeViewIdState && activeViewIdState !== hostIdState && currentGroupItems.some(x => x.id === activeViewIdState) ? (
                  <>
                    <Button
                      type="button"
                      onClick={() => onSetFront(activeViewIdState)}
                      disabled={saving}
                      className="flex-1 bg-[hsl(var(--accent))] hover:bg-[hsl(var(--accent))]/90 text-white h-10"
                    >
                      <BadgeCheck className="h-4 w-4 me-2" />
                      {t('common.apply')}
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => onDeleteMember(activeViewIdState)}
                      disabled={saving}
                      className="flex-1 h-10"
                    >
                      <Trash2 className="h-4 w-4 me-2" />
                      {t('addItem.remove')}
                    </Button>
                  </>
                ) : (
                  <div className="flex-1 text-center text-xs text-muted-foreground italic flex items-center justify-center h-full">
                    {t('common.edit')}
                  </div>
                )}
              </div>

              <div className="flex items-start gap-3 overflow-x-auto pb-2 pt-1 scrollbar-thin">
                {currentGroupItems.map((gItem) => {
                  const isActive = gItem.id === activeViewIdState;
                  const isHost = gItem.id === hostIdState;

                  return (
                    <div
                      key={gItem.id}
                      className="flex flex-col items-center gap-1.5"
                    >
                      <div
                        onClick={() => {
                          setActiveViewIdState(gItem.id);
                        }}
                        className={`relative flex-shrink-0 group w-20 h-24 rounded-lg overflow-hidden border-2 cursor-pointer transition-all shadow-sm ${
                          isActive
                            ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                            : 'border-border hover:border-muted-foreground'
                        }`}
                      >
                        <img
                          src={bestImageUrl(gItem)}
                          alt={gItem.title || 'Garment view'}
                          className="w-full h-full object-cover"
                        />

                        {isHost && (
                          <div className="absolute inset-x-0 bottom-0 bg-background/80 backdrop-blur-[2px] py-0.5 text-center">
                            <span className="text-[9px] font-semibold text-[hsl(var(--accent))]">
                              {t('itemDetail.group.front', { defaultValue: 'Front (Main)' })}
                            </span>
                          </div>
                        )}
                      </div>

                      {(() => {
                        const tags = Array.isArray(gItem.tags) ? gItem.tags : [];
                        const isFront = tags.some(t => String(t).toLowerCase() === 'front');
                        const isBack = tags.some(t => String(t).toLowerCase() === 'back');
                        const isProfile = tags.some(t => String(t).toLowerCase() === 'profile');
                        
                        let tagText = '';
                        let tagKey = '';
                        if (isFront) {
                          tagText = 'Front';
                          tagKey = 'itemDetail.group.front';
                        } else if (isBack) {
                          tagText = 'Back';
                          tagKey = 'itemDetail.group.back';
                        } else if (isProfile) {
                          tagText = 'Profile';
                          tagKey = 'itemDetail.group.profile';
                        }
                        
                        if (!tagText) return <div className="h-4" />;
                        return (
                          <span 
                            className="text-[10px] font-medium text-muted-foreground"
                            data-testid={`view-tag-${tagText.toLowerCase()}`}
                          >
                            {t(tagKey, { defaultValue: tagText })}
                          </span>
                        );
                      })()}
                    </div>
                  );
                })}

                {/* Upload Member Button */}
                <button
                  type="button"
                  onClick={() => setAddOpen(true)}
                  disabled={uploadingPhoto}
                  className="relative flex-shrink-0 w-20 h-24 rounded-lg border-2 border-dashed border-border hover:border-muted-foreground flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground transition-colors bg-secondary/20 hover:bg-secondary/40"
                  data-testid="add-member-view-btn"
                >
                  {uploadingPhoto ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <Plus className="h-5 w-5" />
                      <span className="text-[10px] font-medium">{t('addItem.addPhotos')}</span>
                    </>
                  )}
                </button>
              </div>

              {/* Hidden file input for members */}
              <input
                ref={memberPhotoInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={onMemberPhotoFileChosen}
              />
            </CardContent>
          </Card>

          {/* Dialog for adding/picking closet items */}
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogContent className="max-w-lg rounded-2xl p-6 glassmorphic border border-white/20 max-h-[90dvh] flex flex-col">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                  <Images className="h-5 w-5 text-primary" />
                  {t('addItem.addPhotos')}
                </DialogTitle>
                <DialogDescription className="sr-only">
                  {t('closet.subtitle')}
                </DialogDescription>
              </DialogHeader>

              <div className="flex-1 flex flex-col min-h-0 space-y-6 mt-4">
                {/* Option 1: Upload New View */}
                <div className="space-y-2 shrink-0">
                  <h3 className="text-sm font-semibold text-foreground">{t('scanner.tabFile')}</h3>
                  <Button
                    type="button"
                    onClick={() => {
                      setAddOpen(false);
                      onAddMemberPhoto();
                    }}
                    disabled={uploadingPhoto}
                    className="w-full justify-start rounded-xl py-4 border-dashed h-auto"
                    variant="outline"
                  >
                    <Camera className="h-5 w-5 me-3 shrink-0 text-muted-foreground" />
                    <span className="text-start text-xs sm:text-sm whitespace-normal">{t('addItem.uploadPhotos')}</span>
                  </Button>
                </div>

                {/* Option 2: Select from Closet */}
                <div className="flex-1 flex flex-col min-h-0 space-y-3">
                  <div className="flex items-center justify-between shrink-0">
                    <h3 className="text-sm font-semibold text-foreground">{t('home.openCloset')}</h3>
                    <span className="text-xs text-muted-foreground">
                      {t('closet.selectedCount', { count: filteredCandidates.length })}
                    </span>
                  </div>

                  {/* Search bar inside picker */}
                  <div className="relative shrink-0">
                    <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={t('closet.searchPlaceholder')}
                      value={closetSearch}
                      onChange={(e) => setClosetSearch(e.target.value)}
                      className="ps-9 rounded-xl bg-secondary/50 focus-visible:ring-1 focus-visible:ring-emerald-500"
                    />
                  </div>

                  {/* Candidates Grid */}
                  <div className="flex-1 overflow-y-auto pe-1 space-y-2 scrollbar-thin min-h-0">
                    {filteredCandidates.length === 0 ? (
                      <div className="text-center py-8 text-sm text-muted-foreground">
                        {t('common.noResults')}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {filteredCandidates.map((cItem) => (
                          <div
                            key={cItem.id}
                            onClick={() => handleSelectClosetItem(cItem.id)}
                            className="group flex flex-col rounded-xl border border-border overflow-hidden cursor-pointer hover:border-emerald-500 hover:ring-2 hover:ring-emerald-500/20 transition-all bg-card shadow-sm"
                          >
                            <div className="aspect-[3/4] bg-secondary relative overflow-hidden flex items-center justify-center">
                              <img
                                src={bestImageUrl(cItem)}
                                alt={cItem.title || 'Closet item'}
                                className="w-full h-full object-contain transition-transform group-hover:scale-105"
                              />
                            </div>
                            <div className="p-2 text-start border-t border-border/50 bg-background/50">
                              <p className="text-[10px] font-semibold text-foreground truncate">
                                {cItem.title || cItem.name}
                              </p>
                              <p className="text-[8px] text-muted-foreground truncate mt-0.5">
                                {labelForCategory(cItem.category, t)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Variant carousel (existing) */}
          {item.variants && item.variants.length > 0 && (
            <div>
              <div className="caps-label text-muted-foreground mb-2">
                {t('itemDetail.variants')}
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2" data-testid="item-variant-carousel">
                {item.variants.map((v, i) => (
                  <a key={i} href={v.url} target="_blank" rel="noreferrer" className="flex-shrink-0 w-28">
                    <div className="aspect-[3/4] rounded-xl overflow-hidden border border-border">
                      <img src={v.url} alt={v.prompt} className="w-full h-full object-cover" />
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1 truncate">{v.prompt}</div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* DPP provenance panel (Phase V6) — shown when an item was imported via QR scan */}
          <DppPanel dppData={item.dpp_data} />

          {/* Clean background card (Phase V Fix 2) */}
          <Card className="rounded-[calc(var(--radius)+6px)] shadow-editorial border-t-2 border-[hsl(325_80%_65%)]" data-testid="item-clean-bg-card">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-3 mb-2 pb-2 border-b border-border/45">
                <div className="p-2 rounded-xl bg-[hsl(325_80%_95%)] text-[hsl(325_80%_50%)] dark:bg-[hsl(325_30%_18%)] dark:text-[hsl(325_80%_70%)] shrink-0">
                  <Wand2 className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-sm font-semibold tracking-wide block text-foreground uppercase">
                    {t('itemDetail.cleanBackground.label')}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-normal block mt-0.5 normal-case">
                    {t('itemDetail.edit.sectionCleanBgDesc', { defaultValue: 'Remove background using non-generative matting models' })}
                  </span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                {t('itemDetail.cleanBackground.subtitle')}
              </p>
              <Button
                onClick={onCleanBackground}
                disabled={cleaningBackground}
                className="w-full rounded-xl"
                data-testid="item-clean-bg-button"
              >
                {cleaningBackground ? (
                  <><Loader2 className="h-4 w-4 me-2 animate-spin" />{t('itemDetail.cleanBackground.running')}</>
                ) : (
                  <><Wand2 className="h-4 w-4 me-2" />{hasReconstruction ? t('itemDetail.cleanBackground.retryCta') : t('itemDetail.cleanBackground.cta')}</>
                )}
              </Button>
              {cleaningBackground && (
                <div className="space-y-2" data-testid="item-clean-bg-progress">
                  <Progress
                    value={cleanBackgroundProgress}
                    className="h-2 w-full"
                    data-testid="item-clean-bg-progress-bar"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] text-muted-foreground italic">
                      {t('itemDetail.cleanBackground.progressHint')}
                    </p>
                    <span
                      className="text-[11px] tabular-nums text-muted-foreground"
                      data-testid="item-clean-bg-progress-pct"
                    >
                      {Math.round(cleanBackgroundProgress)}%
                    </span>
                  </div>
                </div>
              )}
              <p className="text-[10px] text-muted-foreground/80 italic">
                {t('itemDetail.cleanBackground.disclaimer')}
              </p>
            </CardContent>
          </Card>

          {/* Re-analyse card — runs The Eyes against the item's stored
              image and rewrites the analysis-derived fields (title,
              taxonomy, colour/material percentages, condition, …).
              Useful after a "Replace photo" upload (which intentionally
              skips auto-analysis), or to recover from a bad first
              analysis without re-uploading. */}
          {/* Re-analyse & AI Eyes Assistant card — runs The Eyes against the
              item's stored image and executes conversational prompt instructions
              (e.g., "Remove the shoes", "Complete the hole where the hand was",
              "Remove the metal studs from the jacket's front"), calling Nano
              Banana image generation as needed. */}
          <Card
            className="rounded-[calc(var(--radius)+6px)] shadow-editorial border-t-2 border-[hsl(199_89%_65%)]"
            data-testid="item-reanalyze-card"
          >
            <CardContent className="p-5 space-y-3.5">
              <div className="flex items-center gap-3 mb-1 pb-2 border-b border-border/45">
                <div className="p-2 rounded-xl bg-[hsl(199_89%_95%)] text-[hsl(199_89%_48%)] dark:bg-[hsl(199_30%_18%)] dark:text-[hsl(199_89%_70%)] shrink-0">
                  <RefreshCw className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold tracking-wide block text-foreground uppercase">
                    {t('itemDetail.reanalyze.label')}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-normal block mt-0.5 normal-case">
                    {t('itemDetail.reanalyze.subtitle')}
                  </span>
                </div>
              </div>

              {/* Conversational Message Thread */}
              {reanalyzeChatHistory.length > 0 && (
                <div
                  className="max-h-80 overflow-y-auto space-y-2.5 p-3 rounded-xl bg-muted/20 border border-border/40 text-xs"
                  data-testid="item-reanalyze-chat-thread"
                >
                  {reanalyzeChatHistory.map((msg, idx) => (
                    <div key={idx} className="space-y-1">
                      {msg.role === 'user' ? (
                        <div className="flex justify-end">
                          <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-none px-3.5 py-2 max-w-[85%] shadow-sm leading-relaxed">
                            {msg.content}
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-start space-y-1.5 max-w-[92%]">
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className="text-[10px] h-4 px-1.5 gap-1 bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-200">
                              <Sparkles className="h-2.5 w-2.5" />
                              {t('itemDetail.reanalyze.eyesBadge', { defaultValue: 'The Eyes' })}
                            </Badge>
                            {msg.action_taken === 'image_edit' && (
                              <Badge variant="secondary" className="text-[9px] h-4 px-1.5 bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                                {t('itemDetail.reanalyze.nanoBananaBadge')}
                              </Badge>
                            )}
                            {msg.action_taken === 'metadata_update' && (
                              <Badge variant="secondary" className="text-[9px] h-4 px-1.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                                {t('itemDetail.reanalyze.refreshedAttributes', { defaultValue: 'Refreshed attributes' })}
                              </Badge>
                            )}
                          </div>
                          <div
                            className={`rounded-2xl rounded-tl-none p-3 shadow-sm border leading-relaxed space-y-2 w-full ${
                              msg.error
                                ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900 text-red-900 dark:text-red-200'
                                : 'bg-card border-border/60 text-foreground'
                            }`}
                          >
                            <p className="whitespace-pre-wrap">{msg.content}</p>

                            {/* Generated Image Preview Card */}
                            {msg.image_url && (
                              <div className="mt-2 rounded-lg border border-border/60 bg-muted/40 p-2 space-y-2">
                                <div className="relative aspect-square max-h-48 w-full flex items-center justify-center bg-background rounded overflow-hidden">
                                  <img
                                    src={msg.image_url}
                                    alt="Reconstructed preview"
                                    className="h-full w-full object-contain"
                                  />
                                </div>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={form.reconstructed_image_url === msg.image_url ? "secondary" : "default"}
                                  className="w-full text-xs h-7 rounded-lg"
                                  onClick={() => onApplyReconstructedImage(msg.image_url)}
                                  data-testid="item-reanalyze-apply-photo-btn"
                                >
                                  {form.reconstructed_image_url === msg.image_url ? (
                                    <>
                                      <Check className="h-3.5 w-3.5 me-1.5 text-emerald-500" />
                                      {t('itemDetail.reanalyze.applied', { defaultValue: 'Applied' })}
                                    </>
                                  ) : (
                                    <>
                                      <Sparkles className="h-3.5 w-3.5 me-1.5" />
                                      {t('itemDetail.reanalyze.applyImage')}
                                    </>
                                  )}
                                </Button>
                              </div>
                            )}

                            {/* Updated Metadata Chips */}
                            {msg.updated_fields && (
                              <div className="flex flex-wrap gap-1 pt-1">
                                {Object.keys(msg.updated_fields).map((k) => (
                                  <span key={k} className="text-[9px] px-1.5 py-0.5 rounded bg-muted font-medium text-muted-foreground">
                                    ✓ {k}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Quick Prompt Starters / Chips */}
              <div className="space-y-1.5">
                <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider block">
                  {t('itemDetail.reanalyze.promptStarters')}
                </span>
                <div className="flex flex-wrap gap-1.5" data-testid="item-reanalyze-prompt-chips">
                  <button
                    type="button"
                    onClick={() => onSendReanalyzePrompt(t('itemDetail.reanalyze.promptRemoveShoes'))}
                    disabled={reanalyzeChatBusy || analyzing}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-secondary/80 hover:bg-secondary text-secondary-foreground transition-colors border border-border/40 disabled:opacity-50"
                  >
                    🪄 {t('itemDetail.reanalyze.promptRemoveShoes')}
                  </button>
                  <button
                    type="button"
                    onClick={() => onSendReanalyzePrompt(t('itemDetail.reanalyze.promptCompleteHole'))}
                    disabled={reanalyzeChatBusy || analyzing}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-secondary/80 hover:bg-secondary text-secondary-foreground transition-colors border border-border/40 disabled:opacity-50"
                  >
                    ✂️ {t('itemDetail.reanalyze.promptCompleteHole')}
                  </button>
                  <button
                    type="button"
                    onClick={() => onSendReanalyzePrompt(t('itemDetail.reanalyze.promptRemoveStuds'))}
                    disabled={reanalyzeChatBusy || analyzing}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-secondary/80 hover:bg-secondary text-secondary-foreground transition-colors border border-border/40 disabled:opacity-50"
                  >
                    💎 {t('itemDetail.reanalyze.promptRemoveStuds')}
                  </button>
                  <button
                    type="button"
                    onClick={() => onSendReanalyzePrompt(t('itemDetail.reanalyze.promptFixMaterials'))}
                    disabled={reanalyzeChatBusy || analyzing}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-secondary/80 hover:bg-secondary text-secondary-foreground transition-colors border border-border/40 disabled:opacity-50"
                  >
                    🔍 {t('itemDetail.reanalyze.promptFixMaterials')}
                  </button>
                </div>
              </div>

              {/* Prompt Input Box */}
              <div className="relative flex items-center gap-1.5 border border-border/70 rounded-xl bg-background p-1.5 focus-within:ring-2 focus-within:ring-ring">
                <Input
                  value={reanalyzePrompt}
                  onChange={(e) => setReanalyzePrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      onSendReanalyzePrompt();
                    }
                  }}
                  placeholder={t('itemDetail.reanalyze.promptPlaceholder')}
                  disabled={reanalyzeChatBusy || analyzing}
                  className="border-0 shadow-none focus-visible:ring-0 text-xs px-2 py-1 h-8 bg-transparent"
                  data-testid="item-reanalyze-prompt-input"
                />
                {sttSupported.current && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={`h-7 w-7 rounded-lg shrink-0 ${
                      reanalyzeDictating
                        ? 'text-red-500 animate-pulse bg-red-50 dark:bg-red-950/40'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    onClick={reanalyzeDictating ? stopPromptDictation : startPromptDictation}
                    disabled={reanalyzeChatBusy || analyzing}
                    title="Voice prompt"
                    data-testid="item-reanalyze-mic-btn"
                  >
                    <Mic className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button
                  type="button"
                  size="icon"
                  className="h-7 w-7 rounded-lg shrink-0 bg-primary text-primary-foreground"
                  onClick={() => onSendReanalyzePrompt()}
                  disabled={!reanalyzePrompt.trim() || reanalyzeChatBusy || analyzing}
                  data-testid="item-reanalyze-send-btn"
                >
                  {reanalyzeChatBusy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>

              {/* Chat & Nano Banana progress bar */}
              {reanalyzeChatBusy && (
                <div className="space-y-1.5" data-testid="item-reanalyze-chat-progress">
                  <Progress value={reanalyzeChatProgress} className="h-1.5 w-full" />
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin text-primary" />
                      {t('itemDetail.reanalyze.eyesThinking')}
                    </span>
                    <span className="tabular-nums">{Math.round(reanalyzeChatProgress)}%</span>
                  </div>
                </div>
              )}

              {/* 1-Click Full Re-analyse fallback */}
              <div className="pt-2 flex items-center justify-between gap-2 border-t border-border/40">
                <Button
                  onClick={onReanalyze}
                  disabled={analyzing || reanalyzeChatBusy}
                  size="sm"
                  variant="ghost"
                  className="text-xs h-7 text-muted-foreground hover:text-foreground px-2"
                  data-testid="item-reanalyze-button"
                >
                  {analyzing ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 me-1.5 animate-spin" />
                      {t('itemDetail.reanalyze.running')}
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 me-1.5" />
                      {t('itemDetail.reanalyze.quickReanalyze')}
                    </>
                  )}
                </Button>
                <p className="text-[10px] text-muted-foreground/80 italic text-end">
                  {t('itemDetail.reanalyze.disclaimer')}
                </p>
              </div>
              {analyzing && (
                <div className="space-y-2" data-testid="item-reanalyze-progress">
                  <Progress
                    value={analyzeProgress}
                    className="h-2 w-full"
                    data-testid="item-reanalyze-progress-bar"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] text-muted-foreground italic">
                      {t('itemDetail.reanalyze.progressHint')}
                    </p>
                    <span
                      className="text-[11px] tabular-nums text-muted-foreground"
                      data-testid="item-reanalyze-progress-pct"
                    >
                      {Math.round(analyzeProgress)}%
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ---------- Edit form column ---------- */}
        <div className="md:col-span-2 space-y-4" data-testid="item-edit-form">

          {/* Identity */}
          <Card className="rounded-[calc(var(--radius)+6px)] shadow-editorial border-t-2 border-[hsl(271_81%_65%)]">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-3 mb-2 pb-2 border-b border-border/45">
                <div className="p-2 rounded-xl bg-[hsl(271_81%_95%)] text-[hsl(271_81%_56%)] dark:bg-[hsl(271_30%_18%)] dark:text-[hsl(271_81%_70%)] shrink-0">
                  <Tag className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-sm font-semibold tracking-wide block text-foreground uppercase">
                    {t('itemDetail.edit.sectionIdentity')}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-normal block mt-0.5 normal-case">
                    {t('itemDetail.edit.sectionIdentityDesc', { defaultValue: 'Item title, name, brand, and description details' })}
                  </span>
                </div>
              </div>
              <Field label={t('itemDetail.edit.title')} htmlFor="f-title" required>
                <Input
                  id="f-title"
                  value={form.title}
                  onChange={(e) => setField('title', e.target.value)}
                  className={`rounded-xl ${!form.title ? 'border-red-400 dark:border-red-900 focus-visible:ring-red-500' : ''}`}
                  data-testid="item-edit-field-title"
                />
              </Field>
              <Field label={t('itemDetail.edit.name')} htmlFor="f-name">
                <Input
                  id="f-name"
                  value={form.name}
                  onChange={(e) => setField('name', e.target.value)}
                  className={`rounded-xl ${!form.name ? 'border-red-400 dark:border-red-900 focus-visible:ring-red-500' : ''}`}
                  data-testid="item-edit-field-name"
                />
              </Field>
              <Field label={t('itemDetail.edit.brand')} htmlFor="f-brand">
                <Input
                  id="f-brand"
                  value={form.brand}
                  onChange={(e) => setField('brand', e.target.value)}
                  className={`rounded-xl ${!form.brand ? 'border-red-400 dark:border-red-900 focus-visible:ring-red-500' : ''}`}
                  data-testid="item-edit-field-brand"
                />
              </Field>
              <Field label={t('itemDetail.edit.caption')} htmlFor="f-caption">
                <Textarea
                  id="f-caption"
                  value={form.caption}
                  onChange={(e) => setField('caption', e.target.value)}
                  rows={2}
                  className={`rounded-xl resize-none ${!form.caption ? 'border-red-400 dark:border-red-900 focus-visible:ring-red-500' : ''}`}
                  data-testid="item-edit-field-caption"
                />
              </Field>
            </CardContent>
          </Card>

          {/* Taxonomy */}
          <Card className="rounded-[calc(var(--radius)+6px)] shadow-editorial border-t-2 border-[hsl(250_95%_70%)]">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-3 mb-2 pb-2 border-b border-border/45">
                <div className="p-2 rounded-xl bg-[hsl(250_95%_95%)] text-[hsl(250_95%_56%)] dark:bg-[hsl(250_30%_18%)] dark:text-[hsl(250_95%_75%)] shrink-0">
                  <Sliders className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-sm font-semibold tracking-wide block text-foreground uppercase">
                    {t('itemDetail.edit.sectionTaxonomy')}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-normal block mt-0.5 normal-case">
                    {t('itemDetail.edit.sectionTaxonomyDesc', { defaultValue: 'Category, item type, gender, and aesthetic styles' })}
                  </span>
                </div>
              </div>
              <Field label={t('itemDetail.edit.category')}>
                <NullableSelect
                  value={form.category}
                  onChange={(v) => setField('category', v || 'Top')}
                  options={CATEGORY_OPTIONS}
                  placeholder={t('itemDetail.edit.category')}
                  testid="item-edit-field-category"
                  format={(o) => labelForCategory(o, t)}
                  className={!form.category ? 'border-red-400 dark:border-red-900 focus:ring-red-500' : ''}
                />
              </Field>
              <Field label={t('itemDetail.edit.subCategory')} htmlFor="f-sub">
                <Input
                  id="f-sub"
                  value={form.sub_category}
                  onChange={(e) => setField('sub_category', e.target.value)}
                  className={`rounded-xl ${!form.sub_category ? 'border-red-400 dark:border-red-900 focus-visible:ring-red-500' : ''}`}
                  data-testid="item-edit-field-sub_category"
                />
                <LocalizedHint raw={form.sub_category} translated={labelForSubCategory(form.sub_category, t)} />
              </Field>
              <Field label={t('itemDetail.edit.itemType')} htmlFor="f-itemtype">
                <Input
                  id="f-itemtype"
                  value={form.item_type}
                  onChange={(e) => setField('item_type', e.target.value)}
                  className={`rounded-xl ${!form.item_type ? 'border-red-400 dark:border-red-900 focus-visible:ring-red-500' : ''}`}
                  data-testid="item-edit-field-item_type"
                />
                <LocalizedHint raw={form.item_type} translated={labelForItemType(form.item_type, t)} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t('itemDetail.edit.gender')}>
                  <NullableSelect
                    value={form.gender}
                    onChange={(v) => setField('gender', v)}
                    options={GENDER_OPTIONS}
                    placeholder="—"
                    testid="item-edit-field-gender"
                    format={(o) => labelForGender(o, t)}
                    className={!form.gender ? 'border-red-400 dark:border-red-900 focus:ring-red-500' : ''}
                  />
                </Field>
                <Field label={t('itemDetail.edit.dressCode')}>
                  <NullableSelect
                    value={form.dress_code}
                    onChange={(v) => setField('dress_code', v)}
                    options={DRESS_CODE_OPTIONS}
                    placeholder="—"
                    testid="item-edit-field-dress_code"
                    format={(o) => labelForDressCode(o, t)}
                    className={!form.dress_code ? 'border-red-400 dark:border-red-900 focus:ring-red-500' : ''}
                  />
                </Field>
              </div>
              <Field label={t('itemDetail.edit.season')}>
                <PillMultiSelect
                  value={form.season}
                  options={SEASON_OPTIONS}
                  onChange={(v) => setField('season', v)}
                  testidPrefix="item-edit-field-season"
                  format={(o) => labelForSeason(o, t)}
                />
              </Field>
              <Field label={t('itemDetail.edit.tradition')} htmlFor="f-tradition">
                <Input
                  id="f-tradition"
                  value={form.tradition}
                  onChange={(e) => setField('tradition', e.target.value)}
                  className={`rounded-xl ${!form.tradition ? 'border-red-400 dark:border-red-900 focus-visible:ring-red-500' : ''}`}
                  placeholder={t('itemDetail.edit.traditionPlaceholder')}
                  data-testid="item-edit-field-tradition"
                />
              </Field>
            </CardContent>
          </Card>

          {/* Composition */}
          <Card className="rounded-[calc(var(--radius)+6px)] shadow-editorial border-t-2 border-[hsl(187_92%_60%)]">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-3 mb-2 pb-2 border-b border-border/45">
                <div className="p-2 rounded-xl bg-[hsl(187_92%_95%)] text-[hsl(187_92%_45%)] dark:bg-[hsl(187_30%_18%)] dark:text-[hsl(187_92%_65%)] shrink-0">
                  <Palette className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-sm font-semibold tracking-wide block text-foreground uppercase">
                    {t('itemDetail.edit.sectionComposition')}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-normal block mt-0.5 normal-case">
                    {t('itemDetail.edit.sectionCompositionDesc', { defaultValue: 'Garment size, colors, patterns, and fabric materials' })}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t('itemDetail.edit.size')} htmlFor="f-size">
                  <Input
                    id="f-size"
                    value={form.size}
                    onChange={(e) => setField('size', e.target.value)}
                    className={`rounded-xl ${!form.size ? 'border-red-400 dark:border-red-900 focus-visible:ring-red-500' : ''}`}
                    data-testid="item-edit-field-size"
                  />
                </Field>
                <Field label={t('itemDetail.edit.color')} htmlFor="f-color">
                  <Input
                    id="f-color"
                    value={form.color}
                    onChange={(e) => setField('color', e.target.value)}
                    className={`rounded-xl ${!form.color ? 'border-red-400 dark:border-red-900 focus-visible:ring-red-500' : ''}`}
                    data-testid="item-edit-field-color"
                  />
                  <LocalizedHint raw={form.color} translated={labelForColor(form.color, t)} />
                </Field>

                <Field label={t('itemDetail.edit.pattern')}>
                  <NullableSelect
                    value={form.pattern}
                    onChange={(v) => setField('pattern', v)}
                    options={PATTERN_OPTIONS}
                    placeholder="—"
                    testid="item-edit-field-pattern"
                    format={(o) => labelForPattern(o, t)}
                    className={!form.pattern ? 'border-red-400 dark:border-red-900 focus:ring-red-500' : ''}
                  />
                </Field>
              </div>

              {/* Weighted taxonomies — these are what The Eyes actually
                  populates with percentages, so the user can see and
                  tweak the colour palette / fabric composition that
                  drives Stylist matching and Marketplace search. */}
              <WeightedList
                labelKey="addItem.color"
                items={form.colors}
                onChange={(v) => setField('colors', v)}
                placeholder={t('addItem.colorSlotPlaceholder')}
                testid="item-edit-colors"
              />
              <WeightedList
                labelKey="addItem.material"
                items={form.fabric_materials}
                onChange={(v) => setField('fabric_materials', v)}
                placeholder={t('addItem.fabricSlotPlaceholder')}
                testid="item-edit-fabrics"
              />
            </CardContent>
          </Card>

          {/* Quality */}
          <Card className="rounded-[calc(var(--radius)+6px)] shadow-editorial border-t-2 border-[hsl(142_72%_50%)]">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-3 mb-2 pb-2 border-b border-border/45">
                <div className="p-2 rounded-xl bg-[hsl(142_72%_95%)] text-[hsl(142_72%_33%)] dark:bg-[hsl(142_30%_18%)] dark:text-[hsl(142_72%_55%)] shrink-0">
                  <Ruler className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-sm font-semibold tracking-wide block text-foreground uppercase">
                    {t('itemDetail.edit.sectionQuality')}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-normal block mt-0.5 normal-case">
                    {t('itemDetail.edit.sectionQualityDesc', { defaultValue: 'Garment state, wear condition, and repair advice' })}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label={t('itemDetail.edit.state')}>
                  <NullableSelect
                    value={form.state}
                    onChange={(v) => setField('state', v)}
                    options={STATE_OPTIONS}
                    placeholder="—"
                    testid="item-edit-field-state"
                    format={(o) => labelForState(o, t)}
                    className={!form.state ? 'border-red-400 dark:border-red-900 focus:ring-red-500' : ''}
                  />
                </Field>
                <Field label={t('itemDetail.edit.condition')}>
                  <NullableSelect
                    value={form.condition}
                    onChange={(v) => setField('condition', v)}
                    options={CONDITION_OPTIONS}
                    placeholder="—"
                    testid="item-edit-field-condition"
                    format={(o) => labelForCondition(o, t)}
                    className={!form.condition ? 'border-red-400 dark:border-red-900 focus:ring-red-500' : ''}
                  />
                </Field>
                <Field label={t('itemDetail.edit.qualityTier')}>
                  <NullableSelect
                    value={form.quality}
                    onChange={(v) => setField('quality', v)}
                    options={QUALITY_OPTIONS}
                    placeholder="—"
                    testid="item-edit-field-quality"
                    format={(o) => labelForQuality(o, t)}
                    className={!form.quality ? 'border-red-400 dark:border-red-900 focus:ring-red-500' : ''}
                  />
                </Field>
              </div>
              <Field label={t('itemDetail.edit.repairAdvice')} htmlFor="f-repair">
                <Textarea
                  id="f-repair"
                  value={form.repair_advice}
                  onChange={(e) => setField('repair_advice', e.target.value)}
                  rows={2}
                  className={`rounded-xl resize-none ${!form.repair_advice ? 'border-red-400 dark:border-red-900 focus-visible:ring-red-500' : ''}`}
                  data-testid="item-edit-field-repair_advice"
                />
              </Field>
            </CardContent>
          </Card>

          {/* Pricing & intent */}
          <Card className="rounded-[calc(var(--radius)+6px)] shadow-editorial border-t-2 border-[hsl(174_44%_50%)]">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-3 mb-2 pb-2 border-b border-border/45">
                <div className="p-2 rounded-xl bg-[hsl(174_44%_93%)] text-[hsl(174_44%_33%)] dark:bg-[hsl(174_30%_18%)] dark:text-[hsl(174_44%_60%)] shrink-0">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-sm font-semibold tracking-wide block text-foreground uppercase">
                    {t('itemDetail.edit.sectionPricing')}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-normal block mt-0.5 normal-case">
                    {t('itemDetail.edit.sectionPricingDesc', { defaultValue: 'Item purchase or retail pricing and transaction intent' })}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field
                  label={`${t('itemDetail.edit.priceCents', { defaultValue: 'Price' })} (${form.currency || 'USD'})`}
                  htmlFor="f-price"
                >
                  <Input
                    id="f-price"
                    type="number"
                    min="0"
                    step="1"
                    inputMode="numeric"
                    value={form.price_cents === '' || form.price_cents == null || form.price_cents === 0 ? '' : form.price_cents}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw && !/^\d*$/.test(raw)) return;
                      setField(
                        'price_cents',
                        raw === '' ? 0 : Math.max(0, parseInt(raw, 10) || 0),
                      );
                    }}
                    placeholder="0"
                    className={`rounded-xl ${!form.price_cents ? 'border-red-400 dark:border-red-900 focus-visible:ring-red-500' : ''}`}
                    data-testid="item-edit-field-price_cents"
                  />
                </Field>
                <Field label={t('itemDetail.edit.currency')}>
                  <NullableSelect
                    value={form.currency}
                    onChange={(v) => setField('currency', v || 'USD')}
                    options={ALL_CURRENCY_OPTIONS}
                    placeholder={t('addItem.currencyPlaceholder', { defaultValue: 'USD' })}
                    testid="item-edit-field-currency"
                    format={(o) => o}
                    className={!form.currency ? 'border-red-400 dark:border-red-900 focus:ring-red-500' : ''}
                  />
                </Field>
                <Field label={t('itemDetail.edit.intent')}>
                  <NullableSelect
                    value={form.marketplace_intent}
                    onChange={(v) => setField('marketplace_intent', v || 'own')}
                    options={INTENT_OPTIONS}
                    placeholder={t('addItem.sourceTagPlaceholder', { defaultValue: 'own' })}
                    testid="item-edit-field-marketplace_intent"
                    format={(o) => labelForIntent(o, t)}
                    className={!form.marketplace_intent ? 'border-red-400 dark:border-red-900 focus:ring-red-500' : ''}
                  />
                </Field>
              </div>
            </CardContent>
          </Card>

          {/* Organization */}
          <Card className="rounded-[calc(var(--radius)+6px)] shadow-editorial border-t-2 border-[hsl(346_87%_60%)]">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-3 mb-2 pb-2 border-b border-border/45">
                <div className="p-2 rounded-xl bg-[hsl(346_87%_95%)] text-[hsl(346_87%_53%)] dark:bg-[hsl(346_30%_18%)] dark:text-[hsl(346_87%_70%)] shrink-0">
                  <Ruler className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-sm font-semibold tracking-wide block text-foreground uppercase">
                    {t('itemDetail.edit.sectionOrganization')}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-normal block mt-0.5 normal-case">
                    {t('itemDetail.edit.sectionOrganizationDesc', { defaultValue: 'Outfit formality level, tags, and cultural styling notes' })}
                  </span>
                </div>
              </div>

              <Field label={t('itemDetail.edit.tags')}>
                <ChipList
                  value={form.tags}
                  onChange={(v) => setField('tags', v)}
                  placeholder={t('itemDetail.edit.tagPlaceholder')}
                  testidPrefix="item-edit-field-tags"
                />
              </Field>
              <Field label={t('itemDetail.edit.culturalTags')}>
                <ChipList
                  value={form.cultural_tags}
                  onChange={(v) => setField('cultural_tags', v)}
                  placeholder={t('itemDetail.edit.culturalTagPlaceholder')}
                  testidPrefix="item-edit-field-cultural_tags"
                />
              </Field>
              <Field label={t('itemDetail.edit.notes')} htmlFor="f-notes">
                <Textarea
                  id="f-notes"
                  value={form.notes}
                  onChange={(e) => setField('notes', e.target.value)}
                  rows={3}
                  className={`rounded-xl resize-none ${!form.notes ? 'border-red-400 dark:border-red-900 focus-visible:ring-red-500' : ''}`}
                  data-testid="item-edit-field-notes"
                />
              </Field>
            </CardContent>
          </Card>



          {/* Bottom actions */}
          <div className="grid grid-cols-2 gap-3">
            <Button asChild variant="secondary" className="rounded-xl" data-testid="item-list-for-sale">
              <Link to={`/market/create?itemId=${item.id}`}>
                <Store className="h-4 w-4 me-2" />{t('itemDetail.listForSale')}
              </Link>
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="rounded-xl" data-testid="item-delete-button">
                  <Trash2 className="h-4 w-4 me-2" />{t('common.delete')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('itemDetail.removeTitle')}</AlertDialogTitle>
                  <AlertDialogDescription>{t('itemDetail.removeBody')}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('common.cancel', { defaultValue: 'Cancel' })}</AlertDialogCancel>
                  <AlertDialogAction onClick={onDelete} data-testid="item-delete-confirm">
                    {t('common.delete')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>

      {/* Taxonomy gatekeeper warning dialog */}
      <AlertDialog open={gatekeeperOpen} onOpenChange={setGatekeeperOpen}>
        <AlertDialogContent data-testid="item-edit-gatekeeper-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('itemDetail.gatekeeper.title', { defaultValue: 'Mismatched Properties Warning' })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('itemDetail.gatekeeper.body', { 
                defaultValue: 'This host item and its group members have mismatched properties: {{mismatches}}. Are you sure you want to save these changes?',
                mismatches: gatekeeperMismatches.map(field => getTaxonomyFieldLabel(field)).join(', ')
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="item-edit-gatekeeper-cancel" onClick={() => setGatekeeperOpen(false)}>
              {t('itemDetail.gatekeeper.cancel', { defaultValue: 'Cancel' })}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setGatekeeperOpen(false);
                executeSavePipeline();
              }}
              data-testid="item-edit-gatekeeper-confirm"
              className="bg-primary text-primary-foreground hover:opacity-90"
            >
              {t('itemDetail.gatekeeper.confirm', { defaultValue: 'Save anyway' })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <ScrollToTop />
    </div>
  );
}

/* -------------------- small field wrapper -------------------- */
function Field({ label, children, htmlFor, required }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={htmlFor} className="caps-label text-muted-foreground text-[10px]">
        {label}{required ? ' *' : ''}
      </Label>
      {children}
    </div>
  );
}
