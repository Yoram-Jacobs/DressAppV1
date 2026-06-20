import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Upload, Plus, Loader2, Eye, Wand2, Shirt, Store,
  HandCoins, Gift, Repeat, Trash2, Save, Tag, AlertTriangle,
  X, Sparkles, Camera, RefreshCw, QrCode, ChevronDown, ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { api } from '@/lib/api';
import { sha256File, aHashFile, colorSignatureFile } from '@/lib/utils';
import { findDuplicatesInCloset } from '@/lib/duplicateDetection';
import { closetStore } from '@/lib/closetStore';
import { workStore } from '@/lib/workStore';
import DuplicatePreflightDialog from '@/components/DuplicatePreflightDialog';
import { DppScanner } from '@/components/DppScanner';
import { WeightedList } from '@/components/WeightedList';
import { useAuth } from '@/lib/auth';
import { deriveSizeFromPreferences } from '@/lib/size_preferences';
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
  labelForItemType,
} from '@/lib/taxonomy';
import { toast } from 'sonner';

/* -------------------- constants -------------------- */
const CATEGORY_OPTIONS = [
  'Top', 'Bottom', 'Outerwear', 'Full Body', 'Footwear', 'Accessories', 'Underwear',
];
const DRESS_CODE_OPTIONS = [
  'casual', 'smart-casual', 'business', 'formal', 'athletic', 'loungewear',
];
const GENDER_OPTIONS = ['men', 'women', 'unisex', 'kids'];
const SEASON_OPTIONS = ['spring', 'summer', 'fall', 'winter', 'all'];
const STATE_OPTIONS = ['new', 'used'];
const CONDITION_OPTIONS = ['bad', 'fair', 'good', 'excellent'];
const QUALITY_OPTIONS = ['budget', 'mid', 'premium', 'luxury'];
const PATTERN_OPTIONS = [
  'solid', 'striped', 'plaid', 'floral', 'herringbone', 'polka', 'paisley',
  'geometric', 'abstract',
];
const INTENT_OPTIONS = [
  { value: 'own', icon: Shirt, tone: 'bg-slate-100 text-slate-900 border-slate-200' },
  { value: 'for_sale', icon: HandCoins, tone: 'bg-amber-100 text-amber-900 border-amber-200' },
  { value: 'donate', icon: Gift, tone: 'bg-emerald-100 text-emerald-900 border-emerald-200' },
  { value: 'swap', icon: Repeat, tone: 'bg-sky-100 text-sky-900 border-sky-200' },
];

const fileToBase64 = async (file, maxSide = 1024, quality = 0.8) => {
  let img = null;
  if (typeof createImageBitmap === 'function') {
    try {
      img = await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch (_) {}
  }
  
  if (!img) {
    img = await new Promise((resolve, reject) => {
      const i = new Image();
      const objectUrl = URL.createObjectURL(file);
      i.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(i);
      };
      i.onerror = (e) => {
        URL.revokeObjectURL(objectUrl);
        reject(e);
      };
      i.src = objectUrl;
    });
  }

  let { width, height } = img;
  if (width > maxSide || height > maxSide) {
    if (width > height) {
      height = Math.round((height * maxSide) / width);
      width = maxSide;
    } else {
      width = Math.round((width * maxSide) / height);
      height = maxSide;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  
  // Fill white background in case it's a transparent image being saved as JPEG
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);
  
  ctx.drawImage(img, 0, 0, width, height);
  
  // Free memory
  if (img.close) img.close();
  else img.src = '';

  // Use webp if supported by the browser, fallback to jpeg.
  // Actually, standardizing on jpeg is safer for the backend since webp support in some older backend libraries can be spotty.
  // The request says "(e.g. jpeg/webp)", so jpeg is standard.
  const outDataUrl = canvas.toDataURL('image/jpeg', quality);
  
  // Clear canvas memory
  canvas.width = 0;
  canvas.height = 0;

  const comma = outDataUrl.indexOf(',');
  return comma >= 0 ? outDataUrl.slice(comma + 1) : outDataUrl;
};

const fmtCents = (cents, cur = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: cur || 'USD' }).format(
    (cents || 0) / 100
  );

const blankFields = () => ({
  name: '', title: '', caption: '',
  category: '', sub_category: '', item_type: '', brand: '',
  gender: '', dress_code: '', season: [], tradition: '',
  colors: [], fabric_materials: [], pattern: '',
  state: '', condition: '', quality: '',
  // Price defaults to 0 (whole-unit display) — was empty before
  // which surfaced as "—" everywhere downstream and forced users
  // through an awkward "first time you set a price" path. ``currency``
  // defaults to USD but ItemDetail lets the user change it later;
  // the marketplace card now honours whatever's on the item.
  size: '', price_cents: 0, currency: 'USD',
  marketplace_intent: 'own',
  repair_advice: '',
  tags: [],
});

/** Coerce analyze payload into a plain, editable form dict.
 *
 * When ``user`` is provided and the analyser didn't return a usable
 * ``size`` (couldn't read a tag, blank crop, …), we fall back to
 * the user's stored body-measurement preference for the relevant
 * garment category — Top→shirt_size, Bottom→pants_size,
 * Footwear→shoe_size, etc. The user can still type any size they
 * want; this only fills the field instead of leaving it empty.
 */
const hydrate = (a, user) => {
  const out = {
    ...blankFields(),
    ...Object.fromEntries(
      Object.entries(a || {}).filter(([k]) => k in blankFields()),
    ),
  };
  if (user && (!out.size || String(out.size).trim() === '')) {
    const pref = deriveSizeFromPreferences(user, out);
    if (pref) out.size = pref;
  }
  return out;
};

/* -------------------- Stepper Component -------------------- */
function Stepper({ cards, saving, bgBatch }) {
  const { t } = useTranslation();
  
  // Calculate states
  const total = cards.length || (bgBatch ? bgBatch.total : 0);
  const scanned = cards.filter(c => c.status !== 'scanning' && c.status !== 'error').length;
  
  let currentStep = 1;
  if (saving || (bgBatch && bgBatch.processed === bgBatch.total)) {
    currentStep = 3;
  } else if (total > 0) {
    currentStep = 2;
  }
  
  return (
    <div className="w-full max-w-2xl mx-auto mb-8 px-4" data-testid="capture-stepper">
      <div className="relative flex items-center justify-between">
        {/* Progress Line */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 right-0 h-0.5 bg-border -z-10">
          <motion.div 
            className="h-full bg-[hsl(var(--accent))]"
            initial={false}
            animate={{ 
              width: currentStep === 1 ? '0%' : currentStep === 2 ? '50%' : '100%' 
            }}
            transition={{ duration: 0.3 }}
          />
        </div>
        
        {/* Step 1: Capture */}
        <div className="flex flex-col items-center">
          <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-colors duration-300 ${
            currentStep >= 1 
              ? 'bg-[hsl(var(--accent))] text-white border-[hsl(var(--accent))] shadow-[0_0_10px_rgba(31,111,107,0.3)]' 
              : 'bg-background text-muted-foreground border-border'
          }`}>
            {currentStep > 1 ? '✓' : '1'}
          </div>
          <span className={`text-[10px] caps-label mt-2 font-medium text-center ${currentStep >= 1 ? 'text-foreground' : 'text-muted-foreground'}`}>
            {t('addItem.step.capture', { defaultValue: 'Capture' })}
          </span>
        </div>

        {/* Step 2: Refine Details */}
        <div className="flex flex-col items-center">
          <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-colors duration-300 ${
            currentStep >= 2
              ? currentStep > 2 
                ? 'bg-[hsl(var(--accent))] text-white border-[hsl(var(--accent))] shadow-[0_0_10px_rgba(31,111,107,0.3)]'
                : 'bg-background text-[hsl(var(--accent))] border-[hsl(var(--accent))] font-bold shadow-[0_0_10px_rgba(31,111,107,0.15)]'
              : 'bg-background text-muted-foreground border-border'
          }`}>
            {currentStep > 2 ? '✓' : '2'}
          </div>
          <span className={`text-[10px] caps-label mt-2 font-medium text-center ${currentStep >= 2 ? 'text-foreground' : 'text-muted-foreground'}`}>
            {t('addItem.step.refinement', { defaultValue: 'Refine' })}
            {currentStep === 2 && total > 0 && ` (${scanned}/${total})`}
          </span>
        </div>

        {/* Step 3: Save */}
        <div className="flex flex-col items-center">
          <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-colors duration-300 ${
            currentStep === 3 
              ? 'bg-brand text-brand-foreground border-brand shadow-[0_0_12px_rgba(232,96,60,0.4)] animate-pulse' 
              : 'bg-background text-muted-foreground border-border'
          }`}>
            3
          </div>
          <span className={`text-[10px] caps-label mt-2 font-medium text-center ${currentStep === 3 ? 'text-foreground' : 'text-muted-foreground'}`}>
            {t('addItem.step.save', { defaultValue: 'Integrate' })}
          </span>
        </div>
      </div>
    </div>
  );
}

/* -------------------- page -------------------- */
export default function AddItem() {
  const { t, i18n } = useTranslation();
  const nav = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const isSuitcase = searchParams.get('from') === 'suitcase';
  const [cards, setCards] = useState([]); // [{id,file,previewUrl,base64,status,progress,fields,error,dppData?}]
  const [saving, setSaving] = useState(false);
  // Patch M20.2 (May 2026) — auto-save queue.
  //
  // Problem: user uploads N photos, presses Save the moment the FIRST
  // one finishes analysing. The previous ``saveAll`` filtered cards
  // by ``status in {ready, error}`` and silently dropped the others,
  // then navigated to /closet — so the still-scanning N-1 photos
  // vanished.
  //
  // Fix: when Save is pressed while some cards are still ``scanning``,
  // persist the ready ones AND flip ``pendingAutoSave=true``. The
  // user stays on /add, sees a small banner explaining the queue, and
  // when all scanning cards reach a terminal state an effect re-fires
  // ``saveAll`` to flush them too and then navigates.
  const [pendingAutoSave, setPendingAutoSave] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  // Background batch state — shown instead of cards when user uploads
  // more than BG_THRESHOLD photos at once. Auto-analyzes + auto-saves
  // each item with sane defaults; user is told to fix any misfits in
  // /closet afterwards.
  const [bgBatch, setBgBatch] = useState(null);
  // Phase Z3 — pre-flight duplicate dialog state. Holds the
  // ``matches`` array returned by ``findDuplicatesInCloset`` plus a
  // continuation closure that resumes the upload flow once the user
  // function that the dialog calls once the user has decided
  // skip/add per row. Null when the dialog is closed.
  const [preflight, setPreflight] = useState(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  // Patch 12 (May 2026) — analyzeCard in-flight guard. The user reported
  // a single upload producing two `/analyze` passes 90 s apart (saving
  // 8 items where 4 were expected). The exact trigger was elusive
  // — possibly a `useEffect` double-fire under React StrictMode, a
  // network-layer retry, or a manual "Try again" click that landed
  // before the original promise resolved. Regardless, ``analyzeCard``
  // must be idempotent per card: ``analyzeInFlight.current`` tracks
  // the set of card IDs currently being analysed and short-circuits any
  // duplicate invocation. Cleared in the ``finally`` block.
  const analyzeInFlight = useRef(new Set());

  const pickFiles = () => fileInputRef.current?.click();
  const openCamera = () => cameraInputRef.current?.click();
  const openScanner = () => setScanOpen(true);

  // Hydrate from a DPP scan (e.g. user hit "Scan QR" in TopNav → we're
  // now opening AddItem with ?source=dpp and a draft in sessionStorage).
  useEffect(() => {
    if (searchParams.get('source') !== 'dpp') return;
    let raw = null;
    try {
      raw = sessionStorage.getItem('dpp_draft');
      sessionStorage.removeItem('dpp_draft');
    } catch (_) { /* ignore */ }
    // Always clear the query string so a browser refresh doesn't replay.
    searchParams.delete('source');
    setSearchParams(searchParams, { replace: true });
    if (!raw) return;
    let parsed = null;
    try { parsed = JSON.parse(raw); } catch (_) { return; }
    const res = parsed?.payload;
    if (!res) return;
    hydrateFromDpp(res);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hydrateFromDpp = (res) => {
    const items = res?.items || [];
    const first = items[0] || {};
    const analysis = first.analysis || {};
    const dppData = first.dpp_data || null;
    const hasImage = !!first.crop_base64;
    const mime = first.crop_mime || 'image/png';
    const previewUrl = hasImage
      ? `data:${mime};base64,${first.crop_base64}`
      : null;
    const draft = {
      id: `dpp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      file: null,
      mime: hasImage ? mime : null,
      previewUrl,
      base64: hasImage ? first.crop_base64 : null,
      status: 'ready',
      progress: 100,
      fields: hydrate(analysis, user),
      error: null,
      label: first.label || analysis.item_type || null,
      dppData,
      source: 'dpp',
    };
    setCards((prev) => [draft, ...prev]);
    toast.success(t('dpp.scanner.imported'));
  };

  const handleScanDecoded = async (payload) => {
    setScanOpen(false);
    if (!payload) return;
    const loadingId = toast.loading(t('dpp.scanner.importing'));
    try {
      const res = await api.importDpp(payload);
      toast.dismiss(loadingId);
      if (res?.parse_error) {
        toast.error(
          t(`dpp.scanner.errors.${res.parse_error}`, {
            defaultValue: t('dpp.scanner.noData'),
          }),
        );
        return;
      }
      hydrateFromDpp(res);
    } catch (err) {
      toast.dismiss(loadingId);
      toast.error(err?.response?.data?.detail || t('dpp.scanner.importFailed'));
    }
  };

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;

    // ----------------------------------------------------------------
    // Phase Z3 — pre-flight duplicate detection (client-side).
    //
    // Compute the SHA-256 / aHash / colour-sig of every selected file
    // in-browser (~150–250 ms per file in parallel) then check them
    // against the locally-cached closet snapshot (``closetStore``)
    // using ``findDuplicatesInCloset`` — a 1:1 port of the backend's
    // ``is_duplicate_match``. Either prompts the user (≤5 photos) or
    // silently drops the duplicates (>5 photos, batch path) before
    // any analyze / Gemini / SegFormer cost is incurred.
    //
    // Previous version round-tripped to ``POST /closet/preflight``
    // for the same information that was already in the cache —
    // 300–1500 ms of pure overhead. Endpoint is now deprecated, kept
    // mounted as a fallback for older clients.
    // ----------------------------------------------------------------
    const fingerprints = [];
    for (const rawF of files) {
      try {
        const b64 = await fileToBase64(rawF);
        if (!b64) continue;
        
        // Convert base64 to Blob synchronously to bypass CSP connection blocks on data URLs
        const byteCharacters = atob(b64);
        const byteArrays = [];
        const sliceSize = 512;
        for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
          const slice = byteCharacters.slice(offset, offset + sliceSize);
          const byteNumbers = new Array(slice.length);
          for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          byteArrays.push(byteArray);
        }
        const blob = new Blob(byteArrays, { type: 'image/jpeg' });
        
        // Use a safe File constructor wrapper that falls back to Blob to avoid TypeError: File constructor is not supported on certain WebView/mobile browsers
        let f;
        try {
          f = new File([blob], rawF.name || 'image.jpg', { type: 'image/jpeg' });
        } catch (_) {
          f = blob;
          try {
            Object.defineProperty(f, 'name', {
              value: rawF.name || 'image.jpg',
              writable: false,
              configurable: true
            });
          } catch (_) {
            f.name = rawF.name || 'image.jpg';
          }
        }

        const sha256 = await sha256File(f);
        const phash = await aHashFile(f);
        const color_sig = await colorSignatureFile(f);
        
        fingerprints.push({
          file: f,
          originalFile: rawF,
          sha256,
          phash,
          color_sig,
          filename: rawF.name || null,
          size_bytes: blob.size,
          _b64: b64,
        });
      } catch (err) {
        console.error('[handleFiles] Error processing image file:', rawF.name, err);
      }
    }

    let matches = [];
    try {
      const fpForLookup = fingerprints
        .filter((fp) => fp.sha256 || fp.phash)
        .map((fp) => ({
          sha256: fp.sha256 || null,
          phash: fp.phash || null,
          color_sig: fp.color_sig || null,
          filename: fp.filename,
          size_bytes: fp.size_bytes,
        }));
      if (fpForLookup.length) {
        // Phase Z3 — duplicate detection runs CLIENT-SIDE against the
        // already-cached closet snapshot. Eliminates a 300–1500 ms
        // round-trip per upload batch. Logic is a 1:1 port of the
        // backend's ``is_duplicate_match``; trade-off (Q1a): legacy
        // closet items without ``source_phash`` are silently skipped
        // and rely on the backend's post-save guard. See
        // ``lib/duplicateDetection.js`` for the porting notes.
        const closetItems = closetStore.getSnapshot().items || [];
        const res = findDuplicatesInCloset(fpForLookup, closetItems);
        matches = Array.isArray(res?.matches) ? res.matches : [];
      }
    } catch (err) {
      // Pre-flight is purely advisory — never block the upload on a
      // local lookup error. Treat as "no duplicates found" and let
      // the post-analysis duplicate detector still catch obvious hits.
      matches = [];
    }

    // BG_THRESHOLD: above this we skip the per-card editor and run
    // the auto-save batch path. Anything above 5 is clearly a "dump
    // my whole wardrobe" moment.
    const BG_THRESHOLD = 5;
    const isBatch = files.length > BG_THRESHOLD;

    // No duplicates → straight through.
    if (!matches.length) {
      if (isBatch) return handleBatchBackground(fingerprints, 0);
      return continueInteractive(fingerprints, /* duplicateAcks */ {});
    }

    // BATCH path (>5 photos): silently drop duplicates per the user's
    // chosen behaviour (option 2B). Track the count so the final
    // toast can mention them.
    if (isBatch) {
      // A photo is a duplicate if the backend returned a match keyed
      // by EITHER its sha256 OR its phash. Build the lookup against
      // both fingerprints so we can correlate back to the surviving
      // file list.
      const dupShas = new Set(matches.map((m) => m.sha256).filter(Boolean));
      const dupPhashes = new Set(matches.map((m) => m.phash).filter(Boolean));
      const survivors = fingerprints
        .filter(
          (fp) =>
            !(fp.sha256 && dupShas.has(fp.sha256)) &&
            !(fp.phash && dupPhashes.has(fp.phash)),
        )
        .map((fp) => fp.file);
      const skipped = files.length - survivors.length;
      if (!survivors.length) {
        toast.message(
          t('addItem.preflight.allDuplicatesSkippedBatch', {
            count: skipped,
            defaultValue: `Skipped ${skipped} photos already in your closet — nothing new to upload.`,
          }),
        );
        return;
      }
      return handleBatchBackground(survivors.map(f => fingerprints.find(x => x.file === f)), skipped);
    }

    // INTERACTIVE path (≤5 photos): open the scrollable confirm
    // dialog. We need previewUrls *now* (data: URLs computed from the
    // already-read base64) so the dialog can show side-by-side
    // thumbnails without a network round-trip.
    //
    // Each match gets a stable composite key (sha256 || phash) so
    // the dialog's per-row decision map can survive matches that
    // only carry one fingerprint or the other (sha256-only for
    // post-Z2 items, phash-only for legacy items).
    const matchesEnriched = matches.map((m) => {
      const fp = fingerprints.find(
        (x) =>
          (m.sha256 && x.sha256 === m.sha256) ||
          (m.phash && x.phash === m.phash),
      );
      const file = fp?.file;
      const previewUrl = fp?._b64 ? `data:${file?.type || 'image/jpeg'};base64,${fp._b64}` : null;
      const matchKey = m.sha256 || m.phash || `${m.filename}-${m.size_bytes}`;
      return { ...m, previewUrl, matchKey };
    });

    setPreflight({
      matches: matchesEnriched,
      onResolve: (decisions) => {
        // Free the temporary object URLs we created for the dialog.
        matchesEnriched.forEach((m) => {
          if (m.previewUrl?.startsWith('blob:')) {
            URL.revokeObjectURL(m.previewUrl);
          }
        });
        setPreflight(null);

        // ``decisions`` is { matchKey: 'add' | 'skip' }.
        // Map back onto fingerprints by either sha256 or phash.
        const decisionFor = (fp) => {
          for (const m of matchesEnriched) {
            const matched =
              (m.sha256 && fp.sha256 === m.sha256) ||
              (m.phash && fp.phash === m.phash);
            if (matched) return decisions[m.matchKey];
          }
          return undefined;
        };

        const survivors = fingerprints.filter((fp) => {
          const choice = decisionFor(fp);
          if (choice === undefined) return true; // wasn't a duplicate
          return choice === 'add';
        });
        if (!survivors.length) {
          toast.message(
            t('addItem.preflight.allSkipped', {
              defaultValue:
                'All selected photos were duplicates and were skipped.',
            }),
          );
          return;
        }
        // Per-photo "this one is a known duplicate" map so cards can
        // carry it through to /closet POST and the closet UI can
        // paint the red ⭐. Indexed by both sha256 and phash for
        // robust lookup.
        const acks = { sha: new Set(), ph: new Set() };
        matchesEnriched.forEach((m) => {
          if (decisions[m.matchKey] === 'add') {
            if (m.sha256) acks.sha.add(m.sha256);
            if (m.phash) acks.ph.add(m.phash);
          }
        });
        continueInteractive(survivors, acks);
      },
    });
  };

  // Carved out of handleFiles so the pre-flight dialog can call it
  // after the user resolves the duplicates list. ``fingerprints`` is
  // the post-filter array of {file, sha256, phash, filename, size_bytes};
  // ``duplicateAcks`` is {sha:Set, ph:Set} of fingerprints the user
  // explicitly approved as duplicates.
  const continueInteractive = async (fingerprints, duplicateAcks) => {
    // Normalise the empty-call case from the no-duplicates path.
    const acks =
      duplicateAcks && (duplicateAcks.sha || duplicateAcks.ph)
        ? duplicateAcks
        : { sha: new Set(), ph: new Set() };
    const drafts = [];
    for (const fp of fingerprints) {
      const file = fp.file;
      const b64 = fp._b64 || await fileToBase64(file);
      const isDup =
        (fp.sha256 && acks.sha.has(fp.sha256)) ||
        (fp.phash && acks.ph.has(fp.phash));
      drafts.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        mime: file.type || 'image/jpeg',
        previewUrl: b64 ? `data:${file.type || 'image/jpeg'};base64,${b64}` : null,
        base64: b64,
        status: 'scanning', // scanning | ready | error | saving | saved
        progress: 4,
        fields: blankFields(),
        error: null,
        label: null,
        // Phase Z2 — fingerprint passthrough. Stored on the card so
        // buildCreatePayload can hand them to /closet POST and the
        // backend can persist them on the ClosetItem document.
        sourceSha256: fp.sha256 || null,
        sourcePhash: fp.phash || null,
        sourceColorSig: fp.color_sig || null,
        sourceFilename: fp.filename || null,
        sourceSizeBytes: fp.size_bytes || null,
        isDuplicate: !!isDup,
      });
    }
    setCards((prev) => [...prev, ...drafts]);
    analyzeCards(drafts);
  };

  // ------------------------------------------------------------------
  // Background batch upload (>5 photos): analyze + auto-save each one
  // with whatever the analyzer returns. We process **strictly
  // sequentially** because the analyze pipeline (SegFormer + rembg +
  // Gemini) is RAM-heavy: running multiple in parallel on a small
  // production VPS reliably OOMs the second/third call. With one at a
  // time, items 2..N actually get analysed instead of silently
  // falling through to the "save raw image" branch.
  // ------------------------------------------------------------------
    const handleBatchBackground = async (fingerprints, skippedDuplicates = 0) => {
    setBgBatch({
      total: fingerprints.length,
      processed: 0,
      saved: 0,
      failed: 0,
      fallbackSaves: 0,
      skippedDuplicates,
      pendingDuplicates: 0,
      analyzeFailed: 0,
    });

    const requestLang = (i18n.language || '').split('-')[0] || 'en';
    const b64List = [];
    for (const fp of fingerprints) {
      b64List.push(fp._b64 || await fileToBase64(fp.file));
    }
    
    let detectMetas = [];
    let totalItemsExpected = 0;
    const savePromises = [];
    
    const handleDetect = (frame) => {
      // detect frame gives us total items across all images
      const metas = frame.items_meta || [];
      detectMetas = metas;
      totalItemsExpected = metas.length;
      // We can bump processed to something to show it started
      setBgBatch(b => b ? { ...b, processed: 1 } : null);
    };

    const handleItem = (frame) => {
      const p = (async () => {
      const meta = detectMetas[frame.index] || {};
      const idx = meta.image_index ?? frame.image_index ?? 0;
      const fp = fingerprints[idx];
      const sourceMeta = {
        sourceSha256: fp.sha256 || null,
        sourcePhash: fp.phash || null,
        sourceColorSig: fp.color_sig || null,
        sourceFilename: fp.file?.name || null,
        sourceSizeBytes: typeof fp.file?.size === 'number' ? fp.file.size : null,
      };
      
      const analysis = frame.analysis || {};
      const cropB64 = meta.crop_base64 || b64List[idx];
      const mime = meta.crop_mime || fp.file?.type || 'image/jpeg';
      
      const cardLike = {
        base64: b64List[idx],
        cropBase64: meta.crop_base64 || undefined,
        mime,
        file: null,
        fields: hydrate(analysis, user),
        useReconstructed: false,
        deferMatte: !!meta.defer_matte,
        ...sourceMeta,
      };

      if (frame.potential_duplicate) {
        const dupCard = {
          id: `bgdup-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          file: null,
          mime,
          previewUrl: `data:${mime};base64,${cropB64}`,
          base64: cropB64,
          originalCropUrl: `data:${mime};base64,${cropB64}`,
          status: 'ready',
          progress: 100,
          fields: cardLike.fields,
          potentialDuplicate: frame.potential_duplicate,
          pendingBatchSave: true,
        };
        setCards((prev) => [...prev, dupCard]);
        setBgBatch((b) => b ? { ...b, pendingDuplicates: (b.pendingDuplicates || 0) + 1, processed: b.processed + 1 } : b);
        return;
      }

      try {
        const created = await api.createItem(buildCreatePayload(cardLike, isSuitcase));
        if (created && created.id) {
          try {
            const { closetStore } = await import('@/lib/closetStore');
            closetStore.upsert(created);
          } catch { /* ignore */ }
        }
        setBgBatch(b => b ? { ...b, saved: b.saved + 1, processed: b.processed + 1 } : null);
      } catch (_) {
        setBgBatch(b => b ? { ...b, failed: b.failed + 1, processed: b.processed + 1 } : null);
      }
      })();
      savePromises.push(p);
      return p;
    };

    const handleItemSkip = (frame) => {
      setBgBatch(b => b ? { ...b, processed: b.processed + 1 } : null);
    };

    try {
      await api.analyzeItemImage(
        { images_base64: b64List, language: requestLang },
        { onDetect: handleDetect, onItem: handleItem, onItemSkip: handleItemSkip }
      );
    } catch (err) {
      // Stream failed. Try to save all remaining as fallbacks?
      // For now just error out gracefully
      setBgBatch(b => b ? { ...b, failed: b.failed + (b.total - b.processed) } : null);
    }

    await Promise.all(savePromises);

    // Final checks and navigation
    setBgBatch((b) => {
      const saved = b?.saved ?? 0;
      const failed = b?.failed ?? 0;
      const analyzeFailed = b?.analyzeFailed ?? 0;
      const pendingDuplicates = b?.pendingDuplicates ?? 0;
      const skippedDups = b?.skippedDuplicates ?? 0;
      
      const dupTrailer = skippedDups ? ' (skipped ' + skippedDups + ' already in closet)' : '';
      
      if (pendingDuplicates) {
        toast.message(`Saved ${saved} new items. ${pendingDuplicates} duplicates pending.` + dupTrailer);
      } else if (saved && !failed) {
        toast.success(`Saved ${saved} items.` + dupTrailer);
      } else if (saved && failed) {
        toast.message(`Saved ${saved} · ${failed} failed` + dupTrailer);
      } else if (!saved && !pendingDuplicates && !skippedDups) {
        toast.error(t('addItem.bgUpload.failed', { defaultValue: 'Could not save any items. Please try again.' }));
      }
      
      setTimeout(() => {
        if (saved && !pendingDuplicates) nav(isSuitcase ? '/suitcase' : '/closet');
      }, 1200);
      return null;
    });
  };

  const analyzeCards = async (cardsList) => {
    const cardsToProcess = cardsList.filter((card) => {
      if (analyzeInFlight.current.has(card.id)) {
        console.warn(`[analyzeCards] skipped duplicate analyze for card ${card.id} — already in flight`);
        return false;
      }
      analyzeInFlight.current.add(card.id);
      workStore.registerAnalyze(card.id, card.sourceFilename || card.file?.name || null);
      return true;
    });

    if (cardsToProcess.length === 0) return;

    const startedAt = Date.now();
    const tick = setInterval(() => {
      const elapsed = (Date.now() - startedAt) / 1000;
      const target = Math.min(92, 4 + elapsed * 5);
      setCards((prev) =>
        prev.map((c) =>
          cardsToProcess.some(cp => cp.id === c.id) && c.status === 'scanning'
            ? { ...c, progress: target }
            : c
        )
      );
    }, 250);

    let perCardIds = {};
    cardsToProcess.forEach(c => { perCardIds[c.id] = []; });
    let flatSlotIds = [];

    try {
      const requestLang = (i18n.language || '').split('-')[0] || 'en';

      const buildBaseCard = (meta, cardId, originalCard) => ({
        id: cardId,
        file: null,
        mime: meta.crop_mime || 'image/jpeg',
        previewUrl: meta.crop_base64
          ? `data:${meta.crop_mime || 'image/jpeg'};base64,${meta.crop_base64}`
          : originalCard.previewUrl,
        base64: originalCard.base64,
        cropBase64: meta.crop_base64 || undefined,
        originalCropUrl: meta.crop_base64
          ? `data:${meta.crop_mime || 'image/jpeg'};base64,${meta.crop_base64}`
          : null,
        reconstructedUrl: null,
        reconstructedB64: null,
        reconstructionMeta: null,
        useReconstructed: false,
        status: 'scanning',
        progress: 60,
        fields: hydrate({}, user),
        error: null,
        label: meta.label || null,
        potentialDuplicate: null,
        fromOnePass: false,
        reconstructionAdvised: false,
        deferMatte: !!meta.defer_matte,
        _streamSlot: meta._slot,
      });

      const handleDetect = (frame) => {
        const metas = (frame.items_meta || []).map((m, i) => ({ ...m, _slot: i }));
        if (metas.length === 0) return;

        const counts = {};
        metas.forEach(m => {
          const imgIdx = m.image_index ?? 0;
          counts[imgIdx] = (counts[imgIdx] || 0) + 1;
        });

        const newCards = [];
        metas.forEach((m) => {
           const imgIdx = m.image_index ?? 0;
           const origCard = cardsToProcess[imgIdx];
           if (!origCard) {
               flatSlotIds.push(null);
               return;
           }
           const newId = `${origCard.id}-${perCardIds[origCard.id].length}`;
           perCardIds[origCard.id].push(newId);
           flatSlotIds.push({ id: newId, origCard });
           newCards.push(buildBaseCard(m, newId, origCard));
        });

        cardsToProcess.forEach((origCard, idx) => {
           const count = counts[idx] || 0;
           if (count > 0) {
               workStore.updateAnalyze(origCard.id, { items: 0, total: count });
           } else {
               // No items detected for this card. We should probably mark it as error later, but for now we skip.
               // We don't remove it from DOM yet, we just leave it.
           }
        });

        setCards((prev) => {
          const idsToRemove = new Set(cardsToProcess.map(c => c.id));
          const filtered = prev.filter(c => !idsToRemove.has(c.id));
          return [...filtered, ...newCards];
        });

        cardsToProcess.forEach(c => {
           if (c.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(c.previewUrl);
        });
      };

      const handleItem = (frame) => {
        const slot = flatSlotIds[frame.index];
        if (!slot) return;
        const { id: slotId, origCard } = slot;

        const job = workStore.getSnapshot().analyzeJobs[origCard.id];
        if (job) {
          workStore.updateAnalyze(origCard.id, {
            items: Math.min((job.items || 0) + 1, job.total || (job.items + 1)),
          });
        }

        const rec = frame.reconstruction;
        const recValidated = !!(rec && rec.validated && rec.image_b64);
        const reconstructedUrl = recValidated
          ? `data:${rec.mime_type || 'image/png'};base64,${rec.image_b64}`
          : null;

        setCards((prev) =>
          prev.map((c) =>
            c.id === slotId
              ? {
                  ...c,
                  status: 'ready',
                  progress: 100,
                  fields: hydrate(frame.analysis || {}, user),
                  label: frame.label || c.label,
                  potentialDuplicate: frame.potential_duplicate || null,
                  fromOnePass: !!frame.one_pass,
                  reconstructionAdvised: !!frame.reconstruction_advised,
                  deferMatte: !!frame.defer_matte,
                  needsReconstruction: !!frame.needs_reconstruction,
                  reconstructionReasons: frame.reconstruction_reasons || [],
                  reconstructedUrl,
                  reconstructedB64: recValidated ? rec.image_b64 : null,
                  reconstructionMeta: recValidated
                    ? {
                        reasons: rec.reasons || [],
                        prompt: rec.prompt,
                        model: rec.model,
                        mime_type: rec.mime_type,
                      }
                    : null,
                  useReconstructed: recValidated,
                  previewUrl: recValidated ? reconstructedUrl : c.previewUrl,
                }
              : c
          )
        );
      };

      const handleItemSkip = (frame) => {
        const slot = flatSlotIds[frame.index];
        if (!slot) return;
        setCards((prev) => prev.filter((c) => c.id !== slot.id));
      };

      const images_base64 = cardsToProcess.map(c => c.base64);
      const payload = { images_base64, language: requestLang };

      const resp = await api.analyzeItemImage(
        payload,
        {
          onDetect: handleDetect,
          onItem: handleItem,
          onItemSkip: handleItemSkip,
        }
      );
      clearInterval(tick);

      const finalCount = resp?.count || (resp?.items || []).length;
      if (finalCount === 0) {
        setCards((prev) =>
          prev.map((c) =>
            cardsToProcess.some(cp => cp.id === c.id)
              ? {
                  ...c,
                  status: 'error',
                  progress: 0,
                  error: t('addItem.analyzeFailed'),
                }
              : c
          )
        );
        toast.error(t('addItem.analyzeFailed'));
        return;
      }

      toast.success(t('addItem.detected', { count: finalCount }));
    } catch (err) {
      clearInterval(tick);
      const msg = err?.response?.data?.detail || err?.message || t('addItem.analyzeFailed');

      const erroredIds = new Set();
      cardsToProcess.forEach(origCard => {
         const children = perCardIds[origCard.id] || [];
         if (children.length > 0) {
             children.forEach(cid => erroredIds.add(cid));
         } else {
             erroredIds.add(origCard.id);
         }
      });

      setCards((prev) =>
        prev.map((c) =>
          erroredIds.has(c.id)
            ? { ...c, status: 'error', progress: 0, error: msg }
            : c
        )
      );
      toast.error(msg);
    } finally {
      cardsToProcess.forEach(origCard => {
         analyzeInFlight.current.delete(origCard.id);
         workStore.completeAnalyze(origCard.id);
      });
    }
  };

  const analyzeCard = (card) => analyzeCards([card]);

  const _analyzeCard = async (card) => {
    // Patch 12 (May 2026) — idempotency guard. If an analyze for this
    // card is already mid-flight, refuse to start another one.
    // Prevents the "8 items saved from one upload" duplication where
    // the same card got analysed twice and both result sets persisted.
    if (analyzeInFlight.current.has(card.id)) {
      // eslint-disable-next-line no-console
      console.warn(
        `[analyzeCard] skipped duplicate analyze for card ${card.id} — already in flight`,
      );
      return;
    }
    analyzeInFlight.current.add(card.id);
    // Patch M20 (May 2026) — Register this analyze job with the
    // global ``workStore`` so the cross-page progress floater
    // (``WorkProgressFloater`` mounted at App root) can show "Analysing
    // N photos…" even if the user navigates away from /add mid-batch.
    // The label uses the source filename when available so a multi-
    // upload batch shows recognisable progress.
    workStore.registerAnalyze(card.id, card.sourceFilename || card.file?.name || null);
    // Faux-progress timer so the scanning animation paces with the API call.
    const startedAt = Date.now();
    const tick = setInterval(() => {
      const elapsed = (Date.now() - startedAt) / 1000;
      const target = Math.min(92, 4 + elapsed * 5); // reaches ~92 by 18s
      setCards((prev) =>
        prev.map((c) => (c.id === card.id && c.status === 'scanning' ? { ...c, progress: target } : c))
      );
    }, 250);
    // Hoisted above the try/catch so the catch handler can read
    // ``perCardIds`` after ``handleDetect`` has expanded the original
    // card into per-item slot cards. Originally declared inside the
    // try block (May 2026 patch M19) — that was correct for the
    // happy path, but left ``perCardIds`` out of scope for the catch
    // and produced a ``ReferenceError: perCardIds is not defined``
    // when the stream raised after ``detect`` (production 403 case).
    let detectMeta = null;
    let perCardIds = [];
    try {
      // Pass current UI locale so Gemini name/caption come back in the
      // language the user is reading the app in — see ``AnalyzeIn.language``.
      const requestLang = (i18n.language || '').split('-')[0] || 'en';

      // Patch M19 (May 2026) — streaming NDJSON path. The backend's
      // /closet/analyze emits frames as Gemini's batched call streams
      // back: a ``detect`` frame within ~5-7 s carrying placeholder
      // crops for every garment, then one ``item`` frame per analysed
      // crop (~1-2 s apart) until the final ``done`` marker. We split
      // the single card into N placeholder cards on ``detect`` and
      // hydrate them on ``item`` so the user sees progress instead of
      // staring at a single spinner for 17+ s. Single-item uploads
      // take the same path: ``detect`` count=1 → one placeholder →
      // ``item`` hydrates it.

      const buildBaseCard = (meta, cardId) => ({
        id: cardId,
        file: null,
        mime: meta.crop_mime || 'image/jpeg',
        previewUrl: meta.crop_base64
          ? `data:${meta.crop_mime || 'image/jpeg'};base64,${meta.crop_base64}`
          : card.previewUrl,
        base64: card.base64,
        cropBase64: meta.crop_base64 || undefined,
        originalCropUrl: meta.crop_base64
          ? `data:${meta.crop_mime || 'image/jpeg'};base64,${meta.crop_base64}`
          : null,
        reconstructedUrl: null,
        reconstructedB64: null,
        reconstructionMeta: null,
        useReconstructed: false,
        // Still scanning until the matching ``item`` frame lands.
        status: 'scanning',
        progress: 60,
        fields: hydrate({}, user),
        error: null,
        label: meta.label || null,
        potentialDuplicate: null,
        fromOnePass: false,
        reconstructionAdvised: false,
        deferMatte: !!meta.defer_matte,
        // Tracked so onItem can locate the right card in state.
        _streamSlot: meta._slot,
      });

      const handleDetect = (frame) => {
        detectMeta = frame;
        const metas = (frame.items_meta || []).map((m, i) => ({
          ...m,
          _slot: i,
        }));
        if (metas.length === 0) {
          // No usable crops — backend will follow with an `error`
          // frame; let the streaming wrapper throw, the catch
          // handler below will set card status=error.
          return;
        }
        // Patch M20 — surface the expected item count on the global
        // floater so the user can see "Analysing 0/N items" tick
        // up as the per-item frames arrive.
        workStore.updateAnalyze(card.id, { items: 0, total: metas.length });
        const newIds = metas.map((m, i) => `${card.id}-${i}`);
        perCardIds = newIds;
        const newCards = metas.map((m, i) => buildBaseCard(m, newIds[i]));
        setCards((prev) => {
          const idx = prev.findIndex((c) => c.id === card.id);
          if (idx < 0) return prev;
          return [...prev.slice(0, idx), ...newCards, ...prev.slice(idx + 1)];
        });
        if (card.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(card.previewUrl);
      };

      const handleItem = (frame) => {
        const slotId = perCardIds[frame.index];
        if (!slotId) return;
        // Patch M20 — bump the global analyze progress one tick.
        // We use a functional update on the local job snapshot so
        // concurrent uploads don't clobber each other.
        const job = workStore.getSnapshot().analyzeJobs[card.id];
        if (job) {
          workStore.updateAnalyze(card.id, {
            items: Math.min((job.items || 0) + 1, job.total || (job.items + 1)),
          });
        }
        // Reconstruction (Nano Banana) is disabled by the backend
        // (ENABLE_RECONSTRUCTION=false), but echo the metadata
        // forward so re-enabling it later is a no-op on this side.
        const rec = frame.reconstruction;
        const recValidated = !!(rec && rec.validated && rec.image_b64);
        const reconstructedUrl = recValidated
          ? `data:${rec.mime_type || 'image/png'};base64,${rec.image_b64}`
          : null;
        setCards((prev) =>
          prev.map((c) =>
            c.id === slotId
              ? {
                  ...c,
                  status: 'ready',
                  progress: 100,
                  fields: hydrate(frame.analysis || {}, user),
                  label: frame.label || c.label,
                  potentialDuplicate: frame.potential_duplicate || null,
                  fromOnePass: !!frame.one_pass,
                  reconstructionAdvised: !!frame.reconstruction_advised,
                  deferMatte: frame.defer_matte !== undefined ? !!frame.defer_matte : c.deferMatte,
                  needsReconstruction: !!frame.needs_reconstruction,
                  reconstructionReasons: frame.reconstruction_reasons || [],
                  reconstructedUrl,
                  reconstructedB64: recValidated ? rec.image_b64 : null,
                  reconstructionMeta: recValidated
                    ? {
                        reasons: rec.reasons || [],
                        prompt: rec.prompt,
                        model: rec.model,
                        mime_type: rec.mime_type,
                      }
                    : null,
                  useReconstructed: recValidated,
                  previewUrl: recValidated ? reconstructedUrl : c.previewUrl,
                }
              : c
          )
        );
      };

      const handleItemSkip = (frame) => {
        const slotId = perCardIds[frame.index];
        if (!slotId) return;
        setCards((prev) => prev.filter((c) => c.id !== slotId));
      };

      const resp = await api.analyzeItemImage(
        { image_base64: card.base64, language: requestLang },
        {
          onDetect: handleDetect,
          onItem: handleItem,
          onItemSkip: handleItemSkip,
        }
      );
      clearInterval(tick);

      const finalCount = resp?.count || (resp?.items || []).length;
      if (finalCount === 0) {
        // Backend produced a detect with all-skipped items — surface
        // the same UX as the legacy 422 path.
        setCards((prev) =>
          prev.map((c) =>
            c.id === card.id
              ? {
                  ...c,
                  status: 'error',
                  progress: 0,
                  error: t('addItem.analyzeFailed'),
                }
              : c
          )
        );
        toast.error(t('addItem.analyzeFailed'));
        return;
      }

      toast.success(t('addItem.detected', { count: finalCount }));
    } catch (err) {
      clearInterval(tick);
      const msg = err?.response?.data?.detail || err?.message || t('addItem.analyzeFailed');
      // Bug-fix May 2026 — when ``handleDetect`` has already replaced
      // the original ``card.id`` with per-item slot cards
      // (``perCardIds`` populated), the stream error that follows
      // (e.g. production Gemini 403) must be written onto THOSE new
      // cards. Otherwise ``prev.map((c) => c.id === card.id)`` would
      // match nothing (the original id is gone) and the per-item
      // cards would stay in ``status: 'scanning'`` forever, showing
      // placeholder values like "Cream Linen Blazer" as if Gemini
      // had populated them — the exact mis-state reported on
      // production after the May 18 outage.
      const erroredIds = perCardIds && perCardIds.length > 0
        ? new Set(perCardIds)
        : new Set([card.id]);
      setCards((prev) =>
        prev.map((c) =>
          erroredIds.has(c.id)
            ? { ...c, status: 'error', progress: 0, error: msg }
            : c
        )
      );
      toast.error(msg);
    } finally {
      // Patch 12 — release in-flight slot regardless of success/failure
      // so the user can legitimately retry via the "Try again" button.
      analyzeInFlight.current.delete(card.id);
      // Patch M20 — clear the global floater entry for this job.
      // Done in ``finally`` so a thrown stream error (network blip,
      // 4xx, malformed frame) doesn't leave a phantom job ticking
      // forever on the floater.
      workStore.completeAnalyze(card.id);
    }
  };

  const retryCard = (card) => {
    setCards((prev) =>
      prev.map((c) => (c.id === card.id ? { ...c, status: 'scanning', progress: 4, error: null } : c))
    );
    analyzeCard(card);
  };

  const removeCard = (cardId) => {
    setCards((prev) => {
      const target = prev.find((c) => c.id === cardId);
      if (target?.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((c) => c.id !== cardId);
    });
  };

  const updateField = (cardId, patch) => {
    setCards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, fields: { ...c.fields, ...patch } } : c))
    );
  };

  const createItemWithTimeout = async (body, timeoutMs = 45000) => {
    let timer;
    try {
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Save timed out')), timeoutMs);
      });
      return await Promise.race([api.createItem(body), timeout]);
    } finally {
      clearTimeout(timer);
    }
  };

  // Phase Q: patch top-level card props (e.g., `useReconstructed` toggle).
  const patchCard = (cardId, patch) => {
    setCards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, ...patch } : c))
    );
  };

  const saveAll = async () => {
    const ready = cards.filter((c) => c.status === 'ready' || c.status === 'error' /* still savable if user fills */);
    const scanning = cards.filter((c) => c.status === 'scanning');

    // Patch M20.2 — neither ready nor scanning → nothing to save.
    if (!ready.length && !scanning.length) {
      toast.error(t('addItem.nothingToSave'));
      return;
    }

    // Patch M20.2 — All cards still scanning. Mark the batch as
    // queued and bail — the ``pendingAutoSave`` effect below will
    // re-fire ``saveAll`` once they all finish.
    if (!ready.length) {
      setPendingAutoSave(true);
      toast.info(
        t('addItem.queuedForAutoSave', {
          count: scanning.length,
          defaultValue:
            scanning.length === 1
              ? 'Waiting for 1 photo to finish analysing — will save automatically.'
              : `Waiting for ${scanning.length} photos to finish analysing — will save automatically.`,
        }),
      );
      return;
    }

    // Phase Z4 — optimistic-first "Save all".
    //
    // The previous implementation serialised every ``api.createItem``
    // call behind ``await`` and only navigated once the last one
    // returned (5-30 s for a typical batch). For an add-flow that's
    // already vouched-for by the analyse step, the network round-trip
    // is pure dead time the user spends staring at spinners.
    //
    // The new flow:
    //   1. Build an OPTIMISTIC ClosetItem for every card (real UUID,
    //      data-URL image, ``_pendingSync: true`` marker for the card
    //      sparkle overlay).
    //   2. Push every optimistic item into ``closetStore`` immediately
    //      so the Closet page paints them on the very next render.
    //   3. Toast "saved" and navigate to /closet so the user sees
    //      their new pieces inside ~16 ms.
    //   4. Fire all ``api.createItem`` calls in PARALLEL via
    //      ``Promise.allSettled`` (was sequential — also a free win).
    //   5. Reconcile per result: on success replace the optimistic
    //      ghost with the canonical server item; on failure pull the
    //      ghost and stash the failure descriptor on the store. The
    //      Closet page reads that and renders a single warning dialog
    //      listing every failed item with its thumbnail + filename so
    //      the user knows exactly what didn't make it (Q1a + thumbs).

    setSaving(true);

    const validCards = [];
    const skipped = [];
    for (const card of ready) {
      if (card.status === 'error' && !card.fields?.title) {
        skipped.push(card);
        continue;
      }
      try {
        const body = buildCreatePayload(card, isSuitcase);
        if (!body.title) throw new Error('Title is required');
        validCards.push({ card, body });
      } catch (err) {
        skipped.push({ ...card, _buildErr: err });
      }
    }

    if (skipped.length) {
      setCards((prev) => prev.map((c) =>
        skipped.find((s) => s.id === c.id)
          ? { ...c, status: 'error', error: c.error || 'Title is required' }
          : c,
      ));
    }
    if (!validCards.length) {
      setSaving(false);
      toast.error(t('addItem.noneSaved'));
      return;
    }

    // Step 1+2 — build optimistic items and push into closetStore.
    // We hold ``ghosts`` in a small map keyed by tempId so the
    // reconciliation phase below can find each card's filename /
    // thumbnail without holding a closure over the AddItem state
    // tree (which is about to unmount on navigation).
    const ghosts = new Map();
    const nowIso = new Date().toISOString();
    for (const { card, body } of validCards) {
      const tempId =
        (typeof crypto !== 'undefined' && crypto.randomUUID)
          ? crypto.randomUUID()
          : `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      // Use a data URL (not blob:) so the thumbnail survives the
      // AddItem unmount. blob: URLs are document-scoped and would
      // 404 the moment the user lands on /closet.
      const dataUrl =
        card.base64
          ? `data:${card.mime || card.file?.type || 'image/jpeg'};base64,${card.base64}`
          : (card.previewUrl || null);
      const filename = card.sourceFilename || card.file?.name || null;
      const optimisticItem = {
        id: tempId,
        user_id: undefined,         // server fills on create; never rendered
        source: body.source || 'Private',
        name: body.name || body.title,
        title: body.title,
        caption: body.caption || null,
        category: body.category || 'Top',
        sub_category: body.sub_category || null,
        item_type: body.item_type || null,
        brand: body.brand || null,
        gender: body.gender || null,
        dress_code: body.dress_code || null,
        season: body.season || [],
        size: body.size || null,
        color: body.color || null,
        colors: body.colors || [],
        fabric_materials: body.fabric_materials || [],
        pattern: body.pattern || null,
        state: body.state || null,
        condition: body.condition || null,
        quality: body.quality || null,
        price_cents: body.price_cents || 0,
        currency: body.currency || 'USD',
        marketplace_intent: body.marketplace_intent || 'own',
        tags: body.tags || [],
        original_image_url: dataUrl,
        thumbnail_data_url: dataUrl,
        created_at: nowIso,
        updated_at: nowIso,
        source_sha256: body.source_sha256 || null,
        source_filename: filename,
        source_phash: body.source_phash || null,
        source_color_sig: body.source_color_sig || null,
        is_duplicate: !!body.is_duplicate,
        // Phase Z4 marker — Closet card paints a sparkling overlay
        // while this is truthy; cleared the moment the server item
        // replaces the ghost in ``closetStore``.
        _pendingSync: true,
      };
      ghosts.set(tempId, {
        body,
        title: optimisticItem.title,
        thumbnail: dataUrl,
        filename,
      });
      closetStore.upsert(optimisticItem);
      // Visual state on the AddItem cards in case the user doesn't
      // navigate immediately (e.g. nav blocked by an unsaved-changes
      // guard somewhere upstream).
      setCards((prev) => prev.map((c) => (c.id === card.id ? { ...c, status: 'saved' } : c)));
    }

    // Step 3 — instant feedback + (conditional) navigate.
    //
    // Patch M20.2 — If any cards are still ``scanning``, we DON'T
    // navigate yet. The user stays on /add and watches the remaining
    // analyses complete; the ``pendingAutoSave`` effect below will
    // re-fire ``saveAll`` once they finish to flush the rest into
    // the closet, then navigate.
    const stillScanning = cards.some((c) => c.status === 'scanning');
    if (stillScanning) {
      toast.info(
        t('addItem.savedSomeWaitingForRest', {
          saved: validCards.length,
          remaining: cards.filter((c) => c.status === 'scanning').length,
          defaultValue:
            `Saved ${validCards.length} — waiting for ${cards.filter((c) => c.status === 'scanning').length} more to finish analysing.`,
        }),
      );
      setPendingAutoSave(true);
      setSaving(false);
      // settle() still fires below for the just-saved cards; only
      // the navigation is deferred.
    } else {
      toast.success(
        t('addItem.savedOptimistic', {
          count: validCards.length,
          defaultValue:
            validCards.length === 1
              ? 'Added to your closet — syncing in background'
              : `${validCards.length} items added to your closet — syncing in background`,
        }),
      );
      setSaving(false);
      setPendingAutoSave(false);
      nav(isSuitcase ? '/suitcase' : '/closet');
    }
    
    // Step 4+5 — parallel persistence + reconciliation. Runs after
    // navigation; failures surface via ``closetStore.recordSaveFailures``
    // which the Closet page renders as a single end-of-batch dialog.
    const settle = async () => {
      const tempIds = Array.from(ghosts.keys());
      const results = await Promise.allSettled(
        tempIds.map((tid) => createItemWithTimeout(ghosts.get(tid).body)),
      );
      const failures = [];
      const polishCandidates = [];
      for (let i = 0; i < results.length; i += 1) {
        const tid = tempIds[i];
        const g = ghosts.get(tid);
        const r = results[i];
        if (r.status === 'fulfilled' && r.value && r.value.id) {
          // Swap ghost → canonical. We remove first so a server item
          // that re-uses the temp UUID by coincidence (impossible —
          // server mints its own — but defensive) doesn't collide.
          closetStore.remove(tid);
          closetStore.upsert(r.value);
          // Patch M20 — items returned with ``clean_image_status:
          // "pending"`` have a deferred matte BackgroundTask running
          // on the backend. Register them with the global workStore
          // so the cross-page floater + the completion toast
          // ("You have news in your closet") fire when the last one
          // drains, regardless of which page the user is on.
          if (r.value.clean_image_status === 'pending') {
            polishCandidates.push(r.value);
          }
        } else {
          closetStore.remove(tid);
          const detail =
            (r.reason && (r.reason.response?.data?.detail || r.reason.message))
            || 'Save failed';
          failures.push({
            id: tid,
            title: g.title,
            filename: g.filename,
            thumbnail: g.thumbnail,
            error: detail,
          });
        }
      }
      if (polishCandidates.length) {
        workStore.registerPolishItems(polishCandidates);
      }
      if (failures.length) {
        closetStore.recordSaveFailures(failures);
      }
      closetStore.triggerRepair();
    };
    // Don't await — let it run in the background. The Closet page
    // is a separate React tree at this point.
    settle().catch(() => { /* recorded individually above */ });
  };
  
  // Patch M20.2 — Auto-save queue driver.
  //
  // When the user pressed Save mid-batch, ``pendingAutoSave`` is set
  // and ready cards are already on their way to the closet. We stay
  // on /add and watch the remaining ``scanning`` cards. As soon as
  // none are left scanning we re-fire ``saveAll`` to flush the cards
  // that just finished, and ``saveAll`` itself navigates once there's
  // nothing left to do.
  //
  // We use a ref to call the LATEST ``saveAll`` (which closes over
  // the latest ``cards`` snapshot). Without the ref the effect would
  // capture the saveAll from the render it was scheduled on, which
  // would still see ``status='scanning'`` for the cards we're waiting
  // on and re-queue forever.
  const saveAllRef = useRef(null);
  useEffect(() => {
    saveAllRef.current = saveAll;
  });
  useEffect(() => {
    if (!pendingAutoSave) return;
    const stillScanning = cards.some((c) => c.status === 'scanning');
    if (stillScanning) return;
    // Drain — flush whatever's ready/error now. saveAll handles the
    // navigation if no scanning cards remain after this pass.
    if (typeof saveAllRef.current === 'function') {
      saveAllRef.current();
    }
  }, [cards, pendingAutoSave]);

  return (
    <div className="container-px max-w-6xl mx-auto pt-6 md:pt-10 pb-28" data-testid="add-item-page">
      <div
        className="sticky top-0 z-30 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 mb-6 bg-background/85 backdrop-blur-md border-b border-border/40 supports-[backdrop-filter]:bg-background/70"
        data-testid="add-item-action-bar"
      >
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => nav(isSuitcase ? '/suitcase' : -1)} className="rounded-full" data-testid="add-item-back">
            <ArrowLeft className="h-4 w-4 me-2 rtl:rotate-180" /> {t('common.back')}
          </Button>
          <div className="flex-1" />
          <Button onClick={pickFiles} variant="outline" className="rounded-xl" disabled={!!bgBatch} data-testid="add-item-add-more">
            <Plus className="h-4 w-4 me-2" /> {t('addItem.addPhotos')}
          </Button>
          <Button
            onClick={saveAll}
            disabled={
              saving
              || !!bgBatch
              // Patch M20.2 — Allow Save while some cards are still
              // scanning (so the user can queue the batch); keep
              // disabled while a previous queue is still draining
              // (``pendingAutoSave``) to avoid re-entrant calls.
              || pendingAutoSave
              || (!cards.some((c) => c.status === 'ready') && !cards.some((c) => c.status === 'scanning'))
            }
            className="rounded-xl"
            data-testid="add-item-save-all"
          >
            {(saving || pendingAutoSave) ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Save className="h-4 w-4 me-2" />}
            {pendingAutoSave
              ? t('addItem.saveAllPending', { defaultValue: 'Saving — waiting for analysis…' })
              : t('addItem.saveAll')}
          </Button>
        </div>
      </div>

      <Stepper cards={cards} saving={saving} bgBatch={bgBatch} />

      <div className="mb-6">
        <div className="caps-label text-muted-foreground">{t('addItem.label')}</div>
        <h1 className="font-display text-3xl sm:text-4xl mt-1">{t('addItem.title')}</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
          {t('addItem.subtitle')}
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        data-testid="add-item-file-input"
        onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
      />
      {/* Native camera capture — on mobile, `capture="environment"` opens
          the rear camera directly; on desktop, falls back to a file
          picker so the button is safe to show everywhere. */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        data-testid="add-item-camera-input"
        onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
      />

      {/* Phase Z2 — pre-flight duplicate dialog. Pops up BEFORE any
          analyze / Gemini cost when the user has selected ≤5 photos
          and at least one of them collides on SHA-256 with an item
          already in their closet. Multi-row, scrollable, per-row
          Skip / "Add anyway ⭐" — see component for full spec. */}
      <DuplicatePreflightDialog
        open={!!preflight}
        matches={preflight?.matches || []}
        onResolve={(decisions) => {
          if (preflight?.onResolve) {
            preflight.onResolve(decisions);
          } else {
            setPreflight(null);
          }
        }}
      />

      {/* Duplicate-detection modal (post-analysis fallback). Pops one
          first card with an unconfirmed potentialDuplicate becomes the
          active question. "Cancel" discards that card; "Add anyway"
          stamps it as confirmed and moves on (or, for cards that came
          from the batch path, immediately POSTs /closet so the
          fire-and-forget batch flow stays fire-and-forget). */}
      <DuplicateConfirmDialog
        cards={cards}
        onCancel={(cardId) => {
          setCards((prev) => {
            const removed = prev.find((c) => c.id === cardId);
            if (removed?.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(removed.previewUrl);
            // Decrement the batch's pendingDuplicates counter so the
            // final toast / nav logic stays accurate after a discard.
            if (removed?.pendingBatchSave) {
              setBgBatch((b) =>
                b
                  ? {
                      ...b,
                      pendingDuplicates: Math.max(
                        0,
                        (b.pendingDuplicates || 0) - 1,
                      ),
                    }
                  : b,
              );
            }
            return prev.filter((c) => c.id !== cardId);
          });
        }}
        onConfirm={async (cardId) => {
          // Snapshot the card so we don't lose state to the
          // setCards stamp below if we have to read from it after.
          const card = cards.find((c) => c.id === cardId);
          if (!card) return;

          // Cards that came through the foreground / interactive path
          // just get stamped — the user clicks "Save All" afterwards.
          if (!card.pendingBatchSave) {
            setCards((prev) =>
              prev.map((c) =>
                c.id === cardId ? { ...c, duplicateConfirmed: true } : c,
              ),
            );
            return;
          }

          // Batch-origin cards: save immediately and remove from the
          // cards list. This restores the "uploads continue in the
          // background" UX while still requiring an explicit user
          // confirmation for each duplicate.
          try {
            await api.createItem(buildCreatePayload(card, isSuitcase));
            setCards((prev) => prev.filter((c) => c.id !== cardId));
            setBgBatch((b) =>
              b
                ? {
                    ...b,
                    saved: (b.saved || 0) + 1,
                    pendingDuplicates: Math.max(
                      0,
                      (b.pendingDuplicates || 0) - 1,
                    ),
                  }
                : b,
            );
          } catch (err) {
            // Saving failed — keep the card visible so the user can
            // edit + retry through the normal Save All flow. We stamp
            // duplicateConfirmed so the dialog doesn't pop again for
            // this card.
            setCards((prev) =>
              prev.map((c) =>
                c.id === cardId
                  ? { ...c, duplicateConfirmed: true, pendingBatchSave: false }
                  : c,
              ),
            );
            toast.error(
              err?.response?.data?.detail ||
                t('addItem.duplicate.saveFailed', {
                  defaultValue:
                    'Could not save the duplicate item. Please review and use Save All.',
                }),
            );
          }
        }}
      />

      {bgBatch ? (
        <div
          className="w-full border border-border rounded-[calc(var(--radius)+10px)] p-8 sm:p-10 bg-card flex flex-col items-center text-center"
          data-testid="add-item-bg-batch-card"
          aria-live="polite"
        >
          <div className="h-14 w-14 rounded-full bg-secondary flex items-center justify-center mb-3">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
          <div className="font-display text-xl">
            {t('addItem.bgUpload.processingTitle', { defaultValue: 'Processing your photos…' })}
          </div>
          <div className="text-sm text-muted-foreground mt-1 max-w-md">
            {t('addItem.bgUpload.processingBody', {
              defaultValue: 'You can leave this page — we’ll keep going in the background. Edit any misfits in your closet when we’re done.',
            })}
          </div>
          <div className="mt-5 w-full max-w-md">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span data-testid="bg-batch-counter">
                {bgBatch.processed} / {bgBatch.total}
              </span>
              <span>
                {t('addItem.bgUpload.savedFailed', {
                  saved: bgBatch.saved,
                  failed: bgBatch.failed,
                  defaultValue: `saved ${bgBatch.saved} · failed ${bgBatch.failed}`,
                })}
              </span>
            </div>
            <Progress
              value={bgBatch.total ? (bgBatch.processed / bgBatch.total) * 100 : 0}
              className="h-2"
              data-testid="bg-batch-progress"
            />
            {bgBatch.pendingDuplicates ? (
              // Surfaced inline so the user knows the modal popping
              // up over the progress card is intentional — these
              // are uploads that matched something already in the
              // closet and need their explicit OK before saving.
              <div
                className="mt-3 text-xs text-amber-700 dark:text-amber-400"
                data-testid="bg-batch-duplicates"
              >
                {t('addItem.bgUpload.duplicatesInline', {
                  count: bgBatch.pendingDuplicates,
                  defaultValue: `${bgBatch.pendingDuplicates} item(s) need your confirmation — they look like duplicates of items already in your closet.`,
                })}
              </div>
            ) : null}
          </div>
        </div>
      ) : cards.length === 0 ? (
        <div
          className="w-full border-2 border-dashed border-border rounded-[calc(var(--radius)+10px)] p-10 sm:p-12 bg-card flex flex-col items-center text-center"
          data-testid="add-item-dropzone"
        >
          <div className="h-14 w-14 rounded-full bg-secondary flex items-center justify-center mb-3">
            <Eye className="h-6 w-6" />
          </div>
          <div className="font-display text-xl">{t('addItem.dropzoneTitle')}</div>
          <div className="text-sm text-muted-foreground mt-1 max-w-md">
            {t('addItem.dropzoneBody')}
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <Button
              type="button"
              className="rounded-xl"
              onClick={openCamera}
              data-testid="add-item-open-camera-button"
            >
              <Camera className="h-4 w-4 me-2" /> {t('addItem.takePhoto')}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={pickFiles}
              data-testid="add-item-pick-files-button"
            >
              <Upload className="h-4 w-4 me-2" /> {t('addItem.uploadPhotos')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="rounded-xl"
              onClick={openScanner}
              data-testid="add-item-scan-dpp-button"
            >
              <QrCode className="h-4 w-4 me-2" /> {t('dpp.nav.scanLabel')}
            </Button>
          </div>
          <div className="mt-4 flex items-center justify-center">
            <div className="text-xs text-muted-foreground flex items-center gap-2 max-w-md">
              <Badge variant="outline" className="border-[hsl(var(--accent))] text-[hsl(var(--accent))]">
                {t('dpp.addItem.tileBadge')}
              </Badge>
              <span>{t('dpp.addItem.tileSubtitle')}</span>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-end gap-2 mb-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-lg"
              onClick={openCamera}
              data-testid="add-item-camera-more-button"
            >
              <Camera className="h-4 w-4 me-1.5" /> {t('addItem.takePhoto')}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-lg"
              onClick={pickFiles}
              data-testid="add-item-upload-more-button"
            >
              <Plus className="h-4 w-4 me-1.5" /> {t('addItem.addPhotos')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="rounded-lg"
              onClick={openScanner}
              data-testid="add-item-scan-dpp-more-button"
            >
              <QrCode className="h-4 w-4 me-1.5" /> {t('dpp.nav.scanLabel')}
            </Button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" data-testid="add-item-cards-grid">
            {cards.map((card) => (
              <ItemCard
                key={card.id}
                card={card}
                onRetry={() => retryCard(card)}
                onRemove={() => removeCard(card.id)}
                onChange={(patch) => updateField(card.id, patch)}
                onCardPatch={(patch) => patchCard(card.id, patch)}
              />
            ))}
          </div>
        </>
      )}
      <DppScanner
        open={scanOpen}
        onOpenChange={setScanOpen}
        onDecoded={handleScanDecoded}
      />
    </div>
  );
}

/* -------------------- item card -------------------- */
function ItemCard({ card, onRetry, onRemove, onChange, onCardPatch }) {
  const { t } = useTranslation();
  const { fields, status, progress, previewUrl, error } = card;
  const isBusy = status === 'scanning';
  const saved = status === 'saved';
  const hasReconstruction = !!(card.reconstructedUrl && card.reconstructionMeta);
  const showingReconstructed = hasReconstruction && card.useReconstructed;

  const [sections, setSections] = useState({
    basic: true,
    styling: false,
    care: false,
  });

  const toggleSection = (sec) => {
    setSections((prev) => ({ ...prev, [sec]: !prev[sec] }));
  };

  return (
    <Card
      className={`rounded-[calc(var(--radius)+10px)] shadow-editorial overflow-hidden ${saved ? 'opacity-75' : ''}`}
      data-testid="add-item-card"
    >
      <CardContent className="p-0">
        <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-0">
          {/* Photo + scanning */}
          <div className="relative bg-secondary/40">
            <div
              className={`aspect-[3/4] md:aspect-auto md:h-full w-full ${isBusy ? 'scanning' : ''}`}
              data-testid="add-item-card-photo"
            >
              <img
                src={previewUrl}
                alt={fields.name || fields.title || 'Pending garment'}
                className="w-full h-full object-cover"
              />
            </div>
            {hasReconstruction && !isBusy && (
              <div
                className="absolute top-2 start-2 inline-flex items-center gap-1.5 rounded-full bg-background/90 backdrop-blur border border-border px-2 py-1 text-[10px] font-semibold"
                data-testid="add-item-repaired-badge"
              >
                <Wand2 className="h-3 w-3 text-[hsl(var(--accent))]" />
                {showingReconstructed
                  ? t('itemDetail.repair.showingRepaired')
                  : t('itemDetail.repair.showingOriginal')}
              </div>
            )}
            {hasReconstruction && !isBusy && (
              <button
                type="button"
                onClick={() => onCardPatch?.({
                  useReconstructed: !showingReconstructed,
                  previewUrl: showingReconstructed
                    ? card.originalCropUrl
                    : card.reconstructedUrl,
                })}
                className="absolute top-2 end-2 inline-flex items-center gap-1 rounded-full bg-background/90 backdrop-blur border border-border px-2 py-1 text-[10px] font-medium hover:bg-secondary transition-colors"
                data-testid="add-item-toggle-reconstruction"
                aria-label={showingReconstructed
                  ? t('itemDetail.repair.ariaShowOriginal')
                  : t('itemDetail.repair.ariaShowRepaired')}
              >
                {showingReconstructed ? (
                  <><RefreshCw className="h-3 w-3" /> {t('itemDetail.repair.toggleOriginal')}</>
                ) : (
                  <><Wand2 className="h-3 w-3" /> {t('itemDetail.repair.toggleAI')}</>
                )}
              </button>
            )}
            {isBusy && (
              <div
                className="absolute bottom-0 left-0 right-0 bg-background/80 backdrop-blur-sm px-3 py-2"
                data-testid="add-item-scanning-overlay"
              >
                <div className="flex items-center gap-2 text-xs">
                  <Eye className="h-3.5 w-3.5 text-[hsl(var(--accent))] animate-pulse" />
                  <span className="font-medium">{t('addItem.scanning')}…</span>
                </div>
                <Progress value={progress} className="h-1 mt-1.5" />
              </div>
            )}
            {status === 'error' && !isBusy && (
              <div className="absolute bottom-0 left-0 right-0 bg-rose-50/95 text-rose-900 px-3 py-2 text-xs flex items-start gap-2">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span className="flex-1">{error || t('addItem.analyzeFailed')}</span>
                <button onClick={onRetry} className="underline shrink-0" data-testid="add-item-retry">
                  {t('addItem.tryAgain')}
                </button>
              </div>
            )}
            {saved && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-[2px]">
                <Badge className="bg-emerald-600 text-white">{t('addItem.saved')}</Badge>
              </div>
            )}
            {!saved && (
              <button
                type="button"
                onClick={onRemove}
                className="absolute top-2 right-2 h-8 w-8 rounded-full bg-background/80 backdrop-blur flex items-center justify-center hover:bg-background"
                aria-label={t('addItem.removePhoto')}
                data-testid="add-item-remove"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            {card.label && !isBusy && status !== 'error' && (
              <div
                className="absolute top-2 left-2 max-w-[70%]"
                data-testid="add-item-detected-label"
              >
                <Badge
                  variant="outline"
                  className="bg-background/85 backdrop-blur text-[10px] capitalize border-border/60 flex items-center gap-1"
                >
                  <Sparkles className="h-2.5 w-2.5 text-[hsl(var(--accent))]" />
                  {labelForItemType(card.label, t)}
                </Badge>
              </div>
            )}
          </div>

          {/* Fields */}
          <div className="p-5 space-y-4">
            {/* 1. Basic Info Section */}
            <div className="border border-border rounded-xl overflow-hidden bg-card shadow-sm">
              <button
                type="button"
                onClick={() => toggleSection('basic')}
                className="w-full flex items-center justify-between p-3 bg-secondary/10 hover:bg-secondary/20 transition-colors text-left focus:outline-none"
              >
                <div className="flex-1 min-w-0 pr-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
                    {t('addItem.section.basic', { defaultValue: 'Basic Info' })}
                  </span>
                  {!sections.basic && (
                    <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                      {[fields.category, fields.brand, fields.size].filter(Boolean).join(' · ') || '—'}
                    </div>
                  )}
                </div>
                {sections.basic ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>
              
              <AnimatePresence initial={false}>
                {sections.basic && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="border-t border-border p-4 space-y-4 overflow-hidden"
                  >
                    <NameCaption idPrefix={card.id} fields={fields} onChange={onChange} disabled={saved} />
                    <BasicTaxonomyGrid idPrefix={card.id} fields={fields} onChange={onChange} disabled={saved} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* 2. Styling Details Section */}
            <div className="border border-border rounded-xl overflow-hidden bg-card shadow-sm">
              <button
                type="button"
                onClick={() => toggleSection('styling')}
                className="w-full flex items-center justify-between p-3 bg-secondary/10 hover:bg-secondary/20 transition-colors text-left focus:outline-none"
              >
                <div className="flex-1 min-w-0 pr-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
                    {t('addItem.section.styling', { defaultValue: 'Styling Details' })}
                  </span>
                  {!sections.styling && (
                    <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                      {[
                        fields.gender, 
                        fields.dress_code, 
                        fields.season && fields.season.length ? fields.season.join('/') : null
                      ].filter(Boolean).join(' · ') || '—'}
                    </div>
                  )}
                </div>
                {sections.styling ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>
              
              <AnimatePresence initial={false}>
                {sections.styling && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="border-t border-border p-4 space-y-4 overflow-hidden"
                  >
                    <StylingTaxonomyGrid idPrefix={card.id} fields={fields} onChange={onChange} disabled={saved} />
                    <SeasonPicker idPrefix={card.id} fields={fields} onChange={onChange} disabled={saved} />
                    <WeightedList
                      idPrefix={card.id}
                      labelKey="addItem.color"
                      items={fields.colors}
                      onChange={(v) => onChange({ colors: v })}
                      placeholder={t('addItem.colorSlotPlaceholder')}
                      disabled={saved}
                      testid="add-item-colors"
                    />
                    <TagsEditor
                      idPrefix={card.id}
                      items={fields.tags}
                      onChange={(v) => onChange({ tags: v })}
                      disabled={saved}
                    />
                    <IntentSelector idPrefix={card.id} fields={fields} onChange={onChange} disabled={saved} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* 3. Care & Repair Section */}
            <div className="border border-border rounded-xl overflow-hidden bg-card shadow-sm">
              <button
                type="button"
                onClick={() => toggleSection('care')}
                className="w-full flex items-center justify-between p-3 bg-secondary/10 hover:bg-secondary/20 transition-colors text-left focus:outline-none"
              >
                <div className="flex-1 min-w-0 pr-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
                    {t('addItem.section.care', { defaultValue: 'Care & Repair' })}
                  </span>
                  {!sections.care && (
                    <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                      {[fields.state, fields.condition, fields.quality].filter(Boolean).join(' · ') || '—'}
                    </div>
                  )}
                </div>
                {sections.care ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>
              
              <AnimatePresence initial={false}>
                {sections.care && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="border-t border-border p-4 space-y-4 overflow-hidden"
                  >
                    {fields.repair_advice && (
                      <div
                        className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 text-amber-900 text-xs"
                        data-testid="add-item-repair-advice"
                      >
                        <Wand2 className="h-4 w-4 mt-0.5 shrink-0" />
                        <div>
                          <div className="font-medium">{t('addItem.repairTip')}</div>
                          <div className="mt-0.5">{fields.repair_advice}</div>
                        </div>
                      </div>
                    )}
                    <QualityRow idPrefix={card.id} fields={fields} onChange={onChange} disabled={saved} />
                    <WeightedList
                      idPrefix={card.id}
                      labelKey="addItem.material"
                      items={fields.fabric_materials}
                      onChange={(v) => onChange({ fabric_materials: v })}
                      placeholder={t('addItem.fabricSlotPlaceholder')}
                      disabled={saved}
                      testid="add-item-fabrics"
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* -------------------- sub-sections -------------------- */
function NameCaption({ idPrefix, fields, onChange, disabled }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor={`${idPrefix}-name`} className="caps-label text-muted-foreground">{t('addItem.itemName')}</Label>
        <Input
          id={`${idPrefix}-name`}
          value={fields.name || ''}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder={t('addItem.namePlaceholder')}
          disabled={disabled}
          data-testid="add-item-name"
          className="mt-1 font-display text-xl bg-transparent border-0 border-b rounded-none px-0 focus-visible:ring-0 focus-visible:border-[hsl(var(--accent))]"
        />
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-caption`} className="caps-label text-muted-foreground">{t('addItem.caption')}</Label>
        <Textarea
          id={`${idPrefix}-caption`}
          value={fields.caption || ''}
          onChange={(e) => onChange({ caption: e.target.value })}
          rows={2}
          placeholder={t('addItem.captionPlaceholder')}
          disabled={disabled}
          data-testid="add-item-caption"
          className="mt-1 resize-none"
        />
      </div>
    </div>
  );
}

function IntentSelector({ idPrefix, fields, onChange, disabled }) {
  const { t } = useTranslation();
  const intent = fields.marketplace_intent || 'own';
  // Only compute preview for 'for_sale'
  const priceCents = Number(fields.price_cents) || 0;
  const stripeFee = intent === 'for_sale' ? Math.round(priceCents * 0.029) + (priceCents > 0 ? 30 : 0) : 0;
  const netAfterStripe = Math.max(0, priceCents - stripeFee);
  const platformFee = Math.round(netAfterStripe * 0.07);
  const sellerNet = netAfterStripe - platformFee;

  return (
    <div className="rounded-2xl border border-border p-3 bg-secondary/30">
      <div className="flex items-center justify-between mb-2">
        <Label className="caps-label text-muted-foreground flex items-center gap-1">
          <Tag className="h-3 w-3" /> {t('addItem.marketplaceIntent')}
        </Label>
        <Badge variant="outline" className="text-[10px]">
          {t('addItem.intent_own')}
        </Badge>
      </div>
      <div
        className="grid grid-cols-2 sm:grid-cols-4 gap-2"
        role="radiogroup"
        aria-label={t('addItem.marketplaceIntent')}
      >
        {INTENT_OPTIONS.map((o) => {
          const active = intent === o.value;
          const Icon = o.icon;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => onChange({ marketplace_intent: o.value })}
              data-testid={`add-item-intent-${o.value}`}
              className={`rounded-xl border px-3 py-2 text-sm flex items-center justify-center gap-1.5 transition-colors ${
                active ? `${o.tone} font-medium` : 'bg-background text-muted-foreground hover:text-foreground border-border'
              }`}
            >
              <Icon className="h-3.5 w-3.5" /> {labelForIntent(o.value, t)}
            </button>
          );
        })}
      </div>
      {intent === 'for_sale' && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="add-item-fee-preview">
          <div>
            <Label htmlFor={`${idPrefix}-price`} className="caps-label text-muted-foreground">
              {t('addItem.price')} ({fields.currency || 'USD'})
            </Label>
            <Input
              id={`${idPrefix}-price`}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              // Whole-unit pricing: the input represents currency
              // *units* (e.g. ``100`` = $100 / ₪100), no fractional
              // cents. We still persist as ``price_cents`` on the
              // wire so all downstream fee math stays in cents — the
              // ×100 happens in the change handler. Fractions were
              // intentionally dropped after users reported the
              // previous decimal flow felt like the system "divided
              // their price by 100" (typing 100 in ItemDetail saved
              // it as 100 cents = $1). Whole-unit semantics are now
              // identical between AddItem and ItemDetail.
              value={
                fields.price_cents != null && fields.price_cents !== ''
                  ? String(Math.round(Number(fields.price_cents) / 100))
                  : '0'
              }
              onChange={(e) => {
                const raw = e.target.value;
                // Integer-only: drop anything that isn't a digit. An
                // empty field collapses to 0 so the user can never
                // accidentally save a "no price" listing.
                if (raw && !/^\d*$/.test(raw)) return;
                const units = raw === '' ? 0 : Math.max(0, parseInt(raw, 10) || 0);
                onChange({ price_cents: units * 100 });
              }}
              placeholder="0"
              disabled={disabled}
              data-testid="add-item-price"
              className="mt-1 rounded-xl"
            />
          </div>
          <div className="text-xs text-muted-foreground self-end">
            <div className="flex justify-between"><span>{t('addItem.stripeFee')}</span><span className="font-mono">{fmtCents(stripeFee)}</span></div>
            <div className="flex justify-between"><span>{t('transactions.platform7')}</span><span className="font-mono">{fmtCents(platformFee)}</span></div>
            <div className="flex justify-between font-medium text-foreground"><span>{t('addItem.youReceive')}</span><span className="font-mono">{fmtCents(sellerNet)}</span></div>
          </div>
        </div>
      )}
    </div>
  );
}

function BasicTaxonomyGrid({ idPrefix, fields, onChange, disabled }) {
  const { t } = useTranslation();
  const row = (label, value, setter, options, testid, placeholder, formatter) => {
    const fieldId = `${idPrefix}-${testid}`;
    return (
    <div>
      <Label htmlFor={fieldId} className="caps-label text-muted-foreground">{label}</Label>
      {options ? (
        <Select value={value || ''} onValueChange={(v) => setter(v === '__clear' ? '' : v)} disabled={disabled}>
          <SelectTrigger id={fieldId} className="mt-1 rounded-xl" data-testid={testid}>
            <SelectValue placeholder={placeholder || t('addItem.selectPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o} value={o}>
                {formatter ? formatter(o, t) : o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          id={fieldId}
          value={value || ''}
          onChange={(e) => setter(e.target.value)}
          placeholder={placeholder || ''}
          disabled={disabled}
          data-testid={testid}
          className="mt-1 rounded-xl"
        />
      )}
    </div>
  )};

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {row(t('addItem.category'), fields.category, (v) => onChange({ category: v }), CATEGORY_OPTIONS, 'add-item-category', t('addItem.categoryPlaceholder'), labelForCategory)}
      {row(t('addItem.subCategory'), fields.sub_category, (v) => onChange({ sub_category: v }), null, 'add-item-subcategory', t('addItem.subCategoryPlaceholder'))}
      {row(t('addItem.itemType'), fields.item_type, (v) => onChange({ item_type: v }), null, 'add-item-itemtype', t('addItem.itemTypePlaceholder'))}
      {row(t('addItem.brand'), fields.brand, (v) => onChange({ brand: v }), null, 'add-item-brand', t('addItem.brandPlaceholder'))}
      {row(t('addItem.size'), fields.size, (v) => onChange({ size: v }), null, 'add-item-size', t('addItem.sizePlaceholder'))}
    </div>
  );
}

function StylingTaxonomyGrid({ idPrefix, fields, onChange, disabled }) {
  const { t } = useTranslation();
  const row = (label, value, setter, options, testid, placeholder, formatter) => {
    const fieldId = `${idPrefix}-${testid}`;
    return (
    <div>
      <Label htmlFor={fieldId} className="caps-label text-muted-foreground">{label}</Label>
      {options ? (
        <Select value={value || ''} onValueChange={(v) => setter(v === '__clear' ? '' : v)} disabled={disabled}>
          <SelectTrigger id={fieldId} className="mt-1 rounded-xl" data-testid={testid}>
            <SelectValue placeholder={placeholder || t('addItem.selectPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o} value={o}>
                {formatter ? formatter(o, t) : o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          id={fieldId}
          value={value || ''}
          onChange={(e) => setter(e.target.value)}
          placeholder={placeholder || ''}
          disabled={disabled}
          data-testid={testid}
          className="mt-1 rounded-xl"
        />
      )}
    </div>
  )};

  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 gap-3">
      {row(t('itemDetail.edit.gender'), fields.gender, (v) => onChange({ gender: v }), GENDER_OPTIONS, 'add-item-gender', t('addItem.genderPlaceholder'), labelForGender)}
      {row(t('addItem.dressCode'), fields.dress_code, (v) => onChange({ dress_code: v }), DRESS_CODE_OPTIONS, 'add-item-dresscode', t('addItem.dressCodePlaceholder'), labelForDressCode)}
      {row(t('addItem.pattern'), fields.pattern, (v) => onChange({ pattern: v }), PATTERN_OPTIONS, 'add-item-pattern', t('addItem.patternPlaceholder'), labelForPattern)}
      {row(t('addItem.tradition'), fields.tradition, (v) => onChange({ tradition: v }), null, 'add-item-tradition', t('addItem.traditionPlaceholder'))}
    </div>
  );
}

function QualityRow({ idPrefix, fields, onChange, disabled }) {
  const { t } = useTranslation();
  const cell = (label, value, setter, options, testid, formatter) => {
    const fieldId = `${idPrefix}-${testid}`;
    return (
    <div>
      <Label htmlFor={fieldId} className="caps-label text-muted-foreground">{label}</Label>
      <Select value={value || ''} onValueChange={(v) => setter(v === '__clear' ? '' : v)} disabled={disabled}>
        <SelectTrigger id={fieldId} className="mt-1 rounded-xl" data-testid={testid}>
          <SelectValue placeholder={t('addItem.selectPlaceholder')} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {formatter ? formatter(o, t) : o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )};
  return (
    <div className="grid grid-cols-3 gap-3">
      {cell(t('addItem.state'), fields.state, (v) => onChange({ state: v }), STATE_OPTIONS, 'add-item-state', labelForState)}
      {cell(t('addItem.condition'), fields.condition, (v) => onChange({ condition: v }), CONDITION_OPTIONS, 'add-item-condition', labelForCondition)}
      {cell(t('addItem.qualityLabel'), fields.quality, (v) => onChange({ quality: v }), QUALITY_OPTIONS, 'add-item-quality', labelForQuality)}
    </div>
  );
}

function SeasonPicker({ idPrefix, fields, onChange, disabled }) {
  const { t } = useTranslation();
  const active = new Set(fields.season || []);
  const toggle = (s) => {
    const next = new Set(active);
    if (s === 'all') { next.clear(); next.add('all'); }
    else {
      next.delete('all');
      if (next.has(s)) next.delete(s); else next.add(s);
    }
    onChange({ season: Array.from(next) });
  };
  const labelId = `${idPrefix}-season`;
  return (
    <div>
      <Label id={labelId} className="caps-label text-muted-foreground">{t('addItem.season')}</Label>
      <div className="mt-1 flex flex-wrap gap-1.5" role="group" aria-labelledby={labelId} data-testid="add-item-season">
        {SEASON_OPTIONS.map((s) => {
          const on = active.has(s);
          return (
            <button
              key={s}
              type="button"
              disabled={disabled}
              onClick={() => toggle(s)}
              aria-pressed={on}
              data-testid={`add-item-season-${s}`}
              className={`rounded-full px-3 py-1 text-xs border ${
                on ? 'bg-[hsl(var(--accent))] text-white border-[hsl(var(--accent))]' : 'bg-background border-border text-muted-foreground'
              }`}
            >
              {labelForSeason(s, t)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// `WeightedList` (colour & fabric percentage editor) now lives in
// `components/WeightedList.jsx` so the Item Detail edit page can
// reuse the exact same control. See top-of-file imports.
function TagsEditor({ idPrefix, items, onChange, disabled }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (!items.includes(v)) onChange([...items, v]);
    setDraft('');
  };
  const fieldId = `${idPrefix}-tag-input`;
  return (
    <div>
      <Label htmlFor={fieldId} className="caps-label text-muted-foreground">{t('addItem.tags')}</Label>
      <div className="mt-1 flex flex-wrap gap-1.5" data-testid="add-item-tags">
        {items.map((tag) => (
          <Badge key={tag} variant="outline" className="text-[11px] pl-2 pr-1 flex items-center gap-1">
            {tag}
            <button
              type="button"
              onClick={() => onChange(items.filter((x) => x !== tag))}
              disabled={disabled}
              className="h-4 w-4 rounded-full hover:bg-secondary flex items-center justify-center"
              aria-label={t('addItem.removeTagAria', { label: tag })}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <div className="flex items-center gap-1">
          <Input
            id={fieldId}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
            placeholder={t('addItem.addTag')}
            disabled={disabled}
            className="h-8 text-xs rounded-full w-32"
            data-testid="add-item-tag-input"
          />
          <Button type="button" size="sm" variant="ghost" className="text-xs h-8" onClick={add} disabled={disabled || !draft.trim()}>
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/* -------------------- payload builder -------------------- */
function buildCreatePayload(card, inSuitcase = false) {
  const f = card.fields || {};
  const asBase64 = card.base64;
  // Drop empty/falsy optional keys to satisfy enum validators on the backend.
  const body = {
    source: f.marketplace_intent && f.marketplace_intent !== 'own' ? 'Shared' : 'Private',
    name: f.name || undefined,
    title: f.name || f.title || 'Unnamed garment',
    caption: f.caption || undefined,
    category: f.category || 'Top',
    sub_category: f.sub_category || undefined,
    item_type: f.item_type || undefined,
    brand: f.brand || undefined,
    gender: f.gender || undefined,
    dress_code: f.dress_code || undefined,
    season: f.season || [],
    tradition: f.tradition || undefined,
    size: f.size || undefined,
    color: (f.colors && f.colors[0]?.name) || undefined,
    colors: (f.colors || []).filter((c) => c.name),
    fabric_materials: (f.fabric_materials || []).filter((c) => c.name),
    pattern: f.pattern || undefined,
    state: f.state || undefined,
    condition: f.condition || undefined,
    quality: f.quality || undefined,
    repair_advice: f.repair_advice || undefined,
    price_cents: f.price_cents === '' || f.price_cents == null ? 0 : Number(f.price_cents),
    currency: f.currency || 'USD',
    marketplace_intent: f.marketplace_intent || 'own',
    tags: f.tags || [],
    image_base64: asBase64 || undefined,
    crop_base64: card.cropBase64 || undefined,
    image_mime: asBase64 ? (card.mime || card.file?.type || 'image/jpeg') : undefined,
    // Phase Q: forward the reconstructed image when the user kept it
    reconstructed_image_b64: card.useReconstructed && card.reconstructedB64
      ? card.reconstructedB64
      : undefined,
    reconstruction_metadata: card.useReconstructed && card.reconstructionMeta
      ? card.reconstructionMeta
      : undefined,
    // Phase V6: preserve DPP provenance imported via QR scan.
    dpp_data: card.dppData || undefined,
    // Phase Z2 — photo fingerprint passthrough so future uploads of
    // the same JPEG get caught by the Phase-Z3 client-side duplicate
    // check (was /closet/preflight before), and the closet card knows
    // whether to paint the red ⭐ overlay.
    source_sha256: card.sourceSha256 || undefined,
    source_phash: card.sourcePhash || undefined,
    source_color_sig: card.sourceColorSig || undefined,
    source_filename: card.sourceFilename || undefined,
    source_size_bytes:
      typeof card.sourceSizeBytes === 'number' ? card.sourceSizeBytes : undefined,
    is_duplicate: card.isDuplicate ? true : undefined,
    in_suitcase: inSuitcase ? true : undefined,
    // Phase O.6 — flag the backend so it skips the synchronous
    // SegFormer cutout (the photo is already bbox-cropped to a single
    // garment) and queues rembg as a BackgroundTask that populates
    // ``clean_image_url`` asynchronously. Legacy clients that didn't
    // receive ``one_pass: true`` on the /analyze response simply omit
    // the field and keep the existing synchronous SegFormer path.
    from_one_pass: card.fromOnePass ? true : undefined,
    // Patch 8 (May 2026) — same code path as ``from_one_pass`` but
    // signals that we came through the *legacy* (multi-crop SegFormer)
    // /analyze flow with rembg deferred. The backend queues
    // ``_run_background_matte`` either way.
    defer_matte: card.deferMatte ? true : undefined,
  };
  // Strip undefined to keep payload clean (Pydantic `extra=forbid` still accepts unset fields).
  return Object.fromEntries(Object.entries(body).filter(([, v]) => v !== undefined));
}


/* -------------------- DuplicateConfirmDialog -------------------- */
/**
 * Surfaces a confirm dialog the moment ``analyze`` returns a card whose
 * matched garment already exists in the user's closet. Pops one card at
 * a time — the first card in the list with an unconfirmed
 * ``potentialDuplicate`` becomes the active question. This avoids a
 * stack of overlays when the user uploads a batch of dupes.
 *
 * Pure UI — all state lives on the cards array passed in. Parent owns
 * the cancel/confirm handlers (which mutate ``cards`` to either remove
 * the offending entry or stamp it ``duplicateConfirmed: true``).
 */
function DuplicateConfirmDialog({ cards, onCancel, onConfirm }) {
  const { t } = useTranslation();
  const active = cards.find(
    (c) => c.potentialDuplicate && !c.duplicateConfirmed
  );
  const open = !!active;
  const dup = active?.potentialDuplicate;
  const newTitle =
    active?.fields?.title ||
    active?.fields?.name ||
    active?.fields?.item_type ||
    t('addItem.duplicate.thisItem', { defaultValue: 'this item' });
  const existingTitle =
    dup?.title ||
    dup?.name ||
    dup?.item_type ||
    t('addItem.duplicate.thisItem', { defaultValue: 'this item' });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        // Treat a backdrop-click / ESC the same as Cancel — discard the
        // upload to keep behaviour predictable.
        if (!o && active) onCancel(active.id);
      }}
    >
      <DialogContent
        className="sm:max-w-md rounded-[calc(var(--radius)+4px)]"
        data-testid="duplicate-confirm-dialog"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            {t('addItem.duplicate.title', {
              defaultValue: 'Already in your closet',
            })}
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            {t('addItem.duplicate.body', {
              defaultValue:
                'It looks like “{{existing}}” is already in your closet. Do you want to add this new “{{incoming}}” as a duplicate?',
              existing: existingTitle,
              incoming: newTitle,
            })}
          </DialogDescription>
        </DialogHeader>

        {/* Side-by-side preview helps the user confirm visually that
            it's actually the same garment vs a similar-looking one. */}
        <div className="flex items-center gap-3 my-2">
          {dup?.thumbnail_data_url ? (
            <div className="flex-1 flex flex-col items-center gap-1">
              <img
                src={dup.thumbnail_data_url}
                alt={existingTitle}
                className="h-28 w-28 object-contain rounded-lg border border-border bg-secondary/30"
                data-testid="duplicate-existing-thumb"
              />
              <span className="caps-label text-muted-foreground">
                {t('addItem.duplicate.existing', { defaultValue: 'Existing' })}
              </span>
            </div>
          ) : null}
          {active?.previewUrl ? (
            <div className="flex-1 flex flex-col items-center gap-1">
              <img
                src={active.previewUrl}
                alt={newTitle}
                className="h-28 w-28 object-contain rounded-lg border border-border bg-secondary/30"
                data-testid="duplicate-incoming-thumb"
              />
              <span className="caps-label text-muted-foreground">
                {t('addItem.duplicate.incoming', { defaultValue: 'New upload' })}
              </span>
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            onClick={() => active && onCancel(active.id)}
            data-testid="duplicate-cancel-button"
          >
            <X className="h-4 w-4 me-2" />
            {t('addItem.duplicate.cancel', { defaultValue: 'Discard upload' })}
          </Button>
          <Button
            type="button"
            className="rounded-xl"
            onClick={() => active && onConfirm(active.id)}
            data-testid="duplicate-confirm-button"
          >
            <Plus className="h-4 w-4 me-2" />
            {t('addItem.duplicate.confirm', { defaultValue: 'Add anyway' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
