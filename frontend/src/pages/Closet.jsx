/* global setTimeout, clearTimeout */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation, Trans } from "react-i18next";
import {
  Plus,
  Search,
  Trash2,
  CheckCircle2,
  Circle,
  X,
  CheckSquare,
  Square,
  Loader2,
  ListChecks,
  Sparkles,
  Wand2,
  QrCode,
  Star,
  AlertTriangle,
  Tag,
  Luggage,
  Layers3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SourceTagBadge } from "@/components/SourceTagBadge";
import { OutfitCompletionSheet } from "@/components/OutfitCompletionSheet";
import { HashRepairChip } from "@/components/closet/HashRepairChip";
import { ThumbRepairChip } from "@/components/closet/ThumbRepairChip";
import { api } from "@/lib/api";
import { bestImageUrl, isCleanImagePending } from "@/lib/itemImage";
import ProgressiveImage from "@/components/ui/ProgressiveImage";
import ImageWithPlaceholder from "@/components/ImageWithPlaceholder";
import {
  labelForCategory,
  labelForSource,
  labelForIntent,
  labelForColor,
  getTaxonomyMismatches,
} from "@/lib/taxonomy";
import { useClosetStore } from "@/lib/useClosetStore";
import { useLocalStorageSync } from "@/lib/useLocalStorageSync";
import { closetStore } from "@/lib/closetStore";
import { workStore } from "@/lib/workStore";
import { toast } from "sonner";
import { ScrollToTop } from "@/components/ScrollToTop";
import closet4 from "../assets/img/closet4.png";
import ClosetBanner from "../assets/img/inner6.webp";
const CATEGORIES = [
  "all",
  "top",
  "bottom",
  "outerwear",
  "shoes",
  "accessory",
  "dress",
];
// Filter dropdown options. We replaced the catch-all "Shared" with the
// three concrete marketplace intents so users can drill straight to
// items by their actual marketplace decision.
//
// Values in {Private, Retail} key on the closet item's ``source`` field;
// values in {for_sale, swap, donate} key on ``marketplace_intent``.
// "all" means no filter.
const SOURCES = ["all", "Private", "for_sale", "swap", "donate", "Retail"];
const _SOURCE_VALUES = new Set(["Private", "Shared", "Retail"]);
const _INTENT_VALUES = new Set(["for_sale", "swap", "donate"]);

// Category synonyms — keep parity with the backend's matcher in
// closet.list_items so client-side filtering yields the same set of
// items as a server-side ``?category=`` would. This matters because
// we now filter the in-memory store rather than re-fetching.
const _CATEGORY_SYNONYMS = {
  top: new Set(["top", "tops"]),
  bottom: new Set(["bottom", "bottoms"]),
  outerwear: new Set(["outerwear"]),
  shoes: new Set(["shoes", "footwear"]),
  accessory: new Set(["accessory", "accessories"]),
  dress: new Set(["dress", "dresses", "full body"]),
};

function _matchesCategory(item, requested) {
  if (!requested || requested === "all") return true;
  const synonyms = _CATEGORY_SYNONYMS[requested] || new Set([requested]);
  const cat = (item?.category || "").toLowerCase();
  return synonyms.has(cat);
}

function _matchesSource(item, requested) {
  if (!requested || requested === "all") return true;
  if (_SOURCE_VALUES.has(requested)) return item?.source === requested;
  if (_INTENT_VALUES.has(requested))
    return item?.marketplace_intent === requested;
  return true;
}

function _matchesSearch(item, q) {
  if (!q) return true;
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  // Mirror backend $text loosely: match any substring across the
  // user-visible string fields. Cheap on a 300-item closet.
  const haystack = [
    item?.title,
    item?.name,
    item?.category,
    item?.sub_category,
    item?.color,
    item?.brand,
    item?.material,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}

const INITIAL_FILTERS = { category: "all", source: "all", search: "" };

export default function Closet() {
  const { t } = useTranslation();
  // Single source of truth: the global closet store. Reading from it
  // means navigating to /closet paints **instantly** (no network) —
  // the prewarm in AppLayout has already populated the snapshot.
  const store = useClosetStore();
  const [filters, setFilters] = useLocalStorageSync(
    "dressapp.closet.filters",
    INITIAL_FILTERS,
  );
  const activeFilters =
    filters && typeof filters === "object" && !Array.isArray(filters)
      ? { ...INITIAL_FILTERS, ...filters }
      : INITIAL_FILTERS;
  // Search mode: 'keyword' uses Mongo text search, 'meaning' calls FashionCLIP.
  const [searchMode, setSearchMode] = useLocalStorageSync(
    "dressapp.closet.searchMode",
    "keyword",
  );
  const [semanticActive, setSemanticActive] = useState(false);
  const [semanticItems, setSemanticItems] = useState([]);
  const [semanticIndexed, setSemanticIndexed] = useState(0);
  const [semanticLoading, setSemanticLoading] = useState(false);

  // Apply filters client-side over the store snapshot. Wrapped in a
  // memo so re-renders triggered by other state (selection, etc.)
  // don't re-walk a 300-item list unnecessarily.
  const filteredItems = useMemo(() => {
    if (semanticActive)
      return semanticItems.filter((it) => it && it.group_role !== "member");
    return (store.items || []).filter(
      (it) =>
        it &&
        it.group_role !== "member" &&
        _matchesCategory(it, activeFilters.category) &&
        _matchesSource(it, activeFilters.source) &&
        _matchesSearch(it, activeFilters.search),
    );
  }, [
    store.items,
    activeFilters.category,
    activeFilters.source,
    activeFilters.search,
    semanticActive,
    semanticItems,
  ]);

  const items = filteredItems;
  const total = semanticActive
    ? semanticItems.length
    : activeFilters.category === "all" &&
        activeFilters.source === "all" &&
        !activeFilters.search
      ? store.total
      : filteredItems.length;
  // Show the skeleton in either of two cases:
  //   * the store is mid-prewarm and we have no cached items yet
  //     (very first visit after sign-in), OR
  //   * a semantic search is in flight (those override ``items``).
  const loading =
    (store.loading && (store.items?.length || 0) === 0) || semanticLoading;

  // Selection state
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Outfit completion sheet (Phase P)
  const [completionOpen, setCompletionOpen] = useState(false);
  const [completionAnchors, setCompletionAnchors] = useState([]);

  // Grouping state
  const [groupOpen, setGroupOpen] = useState(false);
  const [groupHostId, setGroupHostId] = useState("");
  const [grouping, setGrouping] = useState(false);
  const [gatekeeperOpen, setGatekeeperOpen] = useState(false);
  const [gatekeeperMismatches, setGatekeeperMismatches] = useState([]);
  const [gatekeeperPendingAction, setGatekeeperPendingAction] = useState(null);

  // Group tagging state
  const [tagOpen, setTagOpen] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [tagging, setTagging] = useState(false);

  const getTaxonomyFieldLabel = (field) => {
    switch (field) {
      case "category":
        return t("itemDetail.edit.category", { defaultValue: "Category" });
      case "sub_category":
        return t("itemDetail.edit.subCategory", {
          defaultValue: "Sub-category",
        });
      case "brand":
        return t("itemDetail.edit.brand", { defaultValue: "Brand" });
      case "gender":
        return t("itemDetail.edit.gender", { defaultValue: "Gender" });
      case "dress_code":
        return t("itemDetail.edit.dressCode", { defaultValue: "Dress Code" });
      case "season":
        return t("itemDetail.edit.season", { defaultValue: "Season" });
      case "tradition":
        return t("itemDetail.edit.tradition", { defaultValue: "Tradition" });
      default:
        return field;
    }
  };

  // Drag and drop grouping (Multi-view Garment Support)
  const [draggedId, setDraggedId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const touchTimeoutRef = useRef(null);
  const touchStartPosRef = useRef({ x: 0, y: 0 });
  const touchLastPosRef = useRef({ x: 0, y: 0 });
  const [isTouchDragging, setIsTouchDragging] = useState(false);
  const [touchPos, setTouchPos] = useState({ x: 0, y: 0 });

  const touchCurrentPosRef = useRef({ x: 0, y: 0 });
  const scrollIntervalRef = useRef(null);
  const draggedIdRef = useRef(null);
  const isTouchDraggingRef = useRef(false);

  // Sync state values to refs for the interval loop
  useEffect(() => {
    draggedIdRef.current = draggedId;
  }, [draggedId]);

  const evaluateDragOver = () => {
    const x = touchCurrentPosRef.current.x;
    const y = touchCurrentPosRef.current.y;
    const element = document.elementFromPoint(x, y);
    if (!element) return;
    const cardEl = element.closest('[data-testid="closet-item-card"]');
    if (cardEl) {
      const targetId = cardEl.getAttribute("data-item-id");
      if (targetId && targetId !== draggedIdRef.current) {
        setDragOverId(targetId);
        return;
      }
    }
    setDragOverId(null);
  };

  const dragCurrentYRef = useRef(0);

  // Track the mouse Y position globally during desktop dragover events
  useEffect(() => {
    const handleDragOverGlobal = (e) => {
      dragCurrentYRef.current = e.clientY;
    };
    window.addEventListener("dragover", handleDragOverGlobal);
    return () => {
      window.removeEventListener("dragover", handleDragOverGlobal);
    };
  }, []);

  const startAutoScroll = () => {
    if (scrollIntervalRef.current) return;
    scrollIntervalRef.current = setInterval(() => {
      if (!isTouchDraggingRef.current && !draggedIdRef.current) {
        stopAutoScroll();
        return;
      }

      const threshold = window.innerHeight / 6; // 1/6 of screen height
      const speed = 12; // scroll speed

      if (isTouchDraggingRef.current) {
        const touchY = touchCurrentPosRef.current.y;
        if (touchY < threshold) {
          window.scrollBy(0, -speed);
          evaluateDragOver();
        } else if (touchY > window.innerHeight - threshold) {
          window.scrollBy(0, speed);
          evaluateDragOver();
        }
      } else if (draggedIdRef.current) {
        const dragY = dragCurrentYRef.current;
        if (dragY < threshold) {
          window.scrollBy(0, -speed);
        } else if (dragY > window.innerHeight - threshold) {
          window.scrollBy(0, speed);
        }
      }
    }, 30);
  };

  const stopAutoScroll = () => {
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }
  };

  useEffect(() => {
    isTouchDraggingRef.current = isTouchDragging;
    if (isTouchDragging || draggedId) {
      startAutoScroll();
    } else {
      stopAutoScroll();
    }
  }, [isTouchDragging, draggedId]);

  useEffect(() => {
    return () => {
      stopAutoScroll();
    };
  }, []);

  // Disable native touchscreen vertical scrolling when dragging is active
  // by using a non-passive event listener on window.
  useEffect(() => {
    if (!isTouchDragging) return;
    const preventDefault = (e) => {
      if (e.cancelable) {
        e.preventDefault();
      }
    };
    window.addEventListener("touchmove", preventDefault, { passive: false });
    return () => {
      window.removeEventListener("touchmove", preventDefault);
    };
  }, [isTouchDragging]);

  const handleDragStart = (e, id) => {
    setDraggedId(id);
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e, id) => {
    e.preventDefault();
    if (draggedId && draggedId !== id) {
      setDragOverId(id);
    }
  };

  const handleDragLeave = (e, id) => {
    if (dragOverId === id) {
      setDragOverId(null);
    }
  };

  const handleDragEnd = (e) => {
    setDraggedId(null);
    setDragOverId(null);
  };

  const handleDrop = (e, targetId) => {
    e.preventDefault();
    setDragOverId(null);
    const sourceId = e.dataTransfer.getData("text/plain") || draggedId;
    setDraggedId(null);
    if (!sourceId || sourceId === targetId) return;
    const sourceItem = (store.items || []).find(
      (it) => it && it.id === sourceId,
    );
    const targetItem = (store.items || []).find(
      (it) => it && it.id === targetId,
    );
    const backupSource = sourceItem ? { ...sourceItem } : null;
    const backupTarget = targetItem ? { ...targetItem } : null;
    const runGrouping = () => {
      if (sourceItem && targetItem) {
        const groupId = targetItem.group_id || targetId;
        store.upsert({ ...targetItem, group_id: groupId, group_role: "host" });
        store.upsert({
          ...sourceItem,
          group_id: groupId,
          group_role: "member",
        });
      }

      api
        .groupItems({ host_id: targetId, member_id: sourceId })
        .then(async (res) => {
          if (res.status === "success") {
            if (res.host) store.upsert(res.host);
            if (res.member) store.upsert(res.member);
            await store.incrementalSync();
            workStore.registerPolishItems([targetId, sourceId]);
            toast.success(t("common.success"));
          } else {
            if (backupSource) store.upsert(backupSource);
            if (backupTarget) store.upsert(backupTarget);
            toast.error(t("common.error"));
          }
        })
        .catch((err) => {
          console.error("Failed to group items:", err);
          if (backupSource) store.upsert(backupSource);
          if (backupTarget) store.upsert(backupTarget);
          toast.error(err?.response?.data?.detail || t("common.error"));
        });
    };

    const normCategory = (cat) => {
      const s = String(cat || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "_");
      if (s === "top" || s === "tops") return "top";
      if (s === "bottom" || s === "bottoms") return "bottom";
      if (s === "footwear" || s === "shoes") return "footwear";
      if (s === "accessory" || s === "accessories") return "accessories";
      return s;
    };
    const sourceCategory = normCategory(sourceItem?.category);
    const targetCategory = normCategory(targetItem?.category);
    const isSameCategory = sourceCategory === targetCategory;

    if (isSameCategory) {
      const mismatches = getTaxonomyMismatches(sourceItem, targetItem);
      if (mismatches.length > 0) {
        setGatekeeperMismatches(mismatches);
        setGatekeeperPendingAction({
          onApprove: runGrouping,
        });
        setGatekeeperOpen(true);
      } else {
        runGrouping();
      }
    } else {
      // Auto-recognized as a set, group directly!
      runGrouping();
    }
  };

  const handleTouchStart = (e, id) => {
    const touch = e.touches[0];
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
    touchLastPosRef.current = { x: touch.clientX, y: touch.clientY };
    touchCurrentPosRef.current = { x: touch.clientX, y: touch.clientY };
    setTouchPos({ x: touch.clientX, y: touch.clientY });
    setIsTouchDragging(false);

    touchTimeoutRef.current = setTimeout(() => {
      setIsTouchDragging(true);
      setDraggedId(id);
      if (navigator.vibrate) {
        navigator.vibrate(45);
      }
    }, 350);
  };

  const handleTouchMove = (e) => {
    const touch = e.touches[0];
    const dx = touch.clientX - touchStartPosRef.current.x;
    const dy = touch.clientY - touchStartPosRef.current.y;
    const deltaY = touch.clientY - touchLastPosRef.current.y;
    touchLastPosRef.current = { x: touch.clientX, y: touch.clientY };
    touchCurrentPosRef.current = { x: touch.clientX, y: touch.clientY };
    setTouchPos({ x: touch.clientX, y: touch.clientY });

    if (!isTouchDragging) {
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        if (touchTimeoutRef.current) {
          clearTimeout(touchTimeoutRef.current);
          touchTimeoutRef.current = null;
        }
      }
      return;
    }

    if (e.cancelable) {
      e.preventDefault();
    }

    // Programmatically scroll the page in the direction of the drag (reversed relative to normal swipe)
    // Moving finger up (deltaY < 0) scrolls page up (content down).
    // Moving finger down (deltaY > 0) scrolls page down (content up).
    if (Math.abs(deltaY) > 0.5) {
      window.scrollBy(0, deltaY);
    }

    evaluateDragOver();
  };

  const handleTouchEnd = (e) => {
    if (touchTimeoutRef.current) {
      clearTimeout(touchTimeoutRef.current);
      touchTimeoutRef.current = null;
    }

    stopAutoScroll();

    if (!isTouchDragging) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }

    e.preventDefault();
    const targetId = dragOverId;
    const sourceId = draggedId;
    setDraggedId(null);
    setDragOverId(null);
    setIsTouchDragging(false);

    if (targetId && sourceId && sourceId !== targetId) {
      const sourceItem = (store.items || []).find(
        (it) => it && it.id === sourceId,
      );
      const targetItem = (store.items || []).find(
        (it) => it && it.id === targetId,
      );

      const backupSource = sourceItem ? { ...sourceItem } : null;
      const backupTarget = targetItem ? { ...targetItem } : null;

      const runGrouping = () => {
        if (sourceItem && targetItem) {
          const groupId = targetItem.group_id || targetId;
          store.upsert({
            ...targetItem,
            group_id: groupId,
            group_role: "host",
          });
          store.upsert({
            ...sourceItem,
            group_id: groupId,
            group_role: "member",
          });
        }

        api
          .groupItems({ host_id: targetId, member_id: sourceId })
          .then(async (res) => {
            if (res.status === "success") {
              if (res.host) store.upsert(res.host);
              if (res.member) store.upsert(res.member);
              await store.incrementalSync();
              workStore.registerPolishItems([targetId, sourceId]);
              toast.success(t("common.success"));
            } else {
              if (backupSource) store.upsert(backupSource);
              if (backupTarget) store.upsert(backupTarget);
              toast.error(t("common.error"));
            }
          })
          .catch((err) => {
            console.error("Failed to group items:", err);
            if (backupSource) store.upsert(backupSource);
            if (backupTarget) store.upsert(backupTarget);
            toast.error(err?.response?.data?.detail || t("common.error"));
          });
      };

      const normCategory = (cat) => {
        const s = String(cat || "")
          .trim()
          .toLowerCase()
          .replace(/\s+/g, "_");
        if (s === "top" || s === "tops") return "top";
        if (s === "bottom" || s === "bottoms") return "bottom";
        if (s === "footwear" || s === "shoes") return "footwear";
        if (s === "accessory" || s === "accessories") return "accessories";
        return s;
      };
      const sourceCategory = normCategory(sourceItem?.category);
      const targetCategory = normCategory(targetItem?.category);
      const isSameCategory = sourceCategory === targetCategory;

      if (isSameCategory) {
        const mismatches = getTaxonomyMismatches(sourceItem, targetItem);
        if (mismatches.length > 0) {
          setGatekeeperMismatches(mismatches);
          setGatekeeperPendingAction({
            onApprove: runGrouping,
          });
          setGatekeeperOpen(true);
        } else {
          runGrouping();
        }
      } else {
        // Auto-recognized as a set, group directly!
        runGrouping();
      }
    }
  };

  // No-op compat shim. Some downstream code (e.g. the delete handler)
  // calls ``fetchItems`` after a mutation to refresh the grid; with
  // the store-based design we instead call ``store.remove`` /
  // ``store.upsert`` and let React re-render. The shim lets us leave
  // those code paths untouched while we land this refactor.
  const fetchItems = useCallback(async () => {
    return store.incrementalSync();
  }, [store]);

  // ──────────────────────────────────────────────────────────────────
  // Phase O.6 — poll for background-rembg completion.
  //
  // After ``POST /closet`` with ``from_one_pass=true`` (or
  // ``defer_matte=true``) the server immediately returns the document
  // with ``clean_image_status: "pending"`` and queues rembg as a
  // fire-and-forget BackgroundTask. The closet grid initially renders
  // the bbox-cropped JPEG; we poll ``GET /closet/{id}`` here on a
  // gentle backoff so the moment the alpha-PNG cutout is ready we
  // ``store.upsert(updated)`` and the thumbnail swaps in-place — no
  // full grid refetch, no flash.
  //
  // Patch M20 (May 2026) — Robustness rewrite, motivated by user
  // reports of "the last item stays on 'Polishing photo…' forever".
  // Two structural issues in the previous polling loop:
  //
  //   1. ``live = store.items`` inside ``tick`` captured the closure's
  //      ``store`` object, which is the React snapshot from the
  //      render that mounted this effect — STALE relative to mutations
  //      that landed in ``closetStore`` between scheduling and tick
  //      execution (e.g. ``settle()`` finishing in AddItem after the
  //      user navigated to /closet, or a parallel incremental sync).
  //      Fix: read ``closetStore.getSnapshot().items`` directly so we
  //      always see the live state.
  //
  //   2. ``attempt`` reset to 0 on every effect re-mount (each upsert
  //      triggers a re-mount), so the backoff array was never
  //      traversed and polling effectively ran at 3 s flat forever
  //      with no upper bound. On a backend that genuinely failed to
  //      write ``clean_image_status="ready"`` (rare but possible — e.g.
  //      silent rembg crash, process restart mid-task), the poll would
  //      hammer the API indefinitely. Fix: persist ``attempt`` in a
  //      ref keyed by the pending-id signature; reset only when the
  //      pending SET changes. Also cap lifetime at
  //      ``POLL_MAX_ATTEMPTS`` after which we fire one final
  //      ``incrementalSync()`` and give up.
  // ──────────────────────────────────────────────────────────────────
  const pollAttemptRef = useRef(0);
  const pollSignatureRef = useRef("");
  useEffect(() => {
    const pendingIds = (store.items || [])
      .filter((it) => it && it.clean_image_status === "pending")
      .map((it) => it.id);
    if (pendingIds.length === 0) {
      pollAttemptRef.current = 0;
      pollSignatureRef.current = "";
      return undefined;
    }

    // Patch M20 (May 2026) — also register these pending items with
    // the global ``workStore`` so the cross-page floater
    // (``WorkProgressFloater``) and the completion toast
    // (``WorkBatchDoneToast``) cover items the user inherits on a
    // fresh visit to /closet (e.g. previous-session items whose
    // BackgroundTask was still running when the user closed the tab).
    // ``registerPolishItems`` is idempotent — re-registering an
    // already-tracked id is a no-op.
    workStore.registerPolishItems(pendingIds);

    // Backoff schedule (ms). After we exhaust the array, polling
    // continues at the final entry (18 s) up to POLL_MAX_ATTEMPTS.
    const POLL_STEPS_MS = [3000, 4000, 6000, 9000, 12000, 18000];
    const POLL_MAX_ATTEMPTS = 30; // ~5 minutes wall clock at the tail.

    // Reset per-pass counter ONLY when the pending-id SET changes
    // (new items appeared / set shrank). We don't reset on every
    // items mutation \u2014 upsert-from-poll changes items[] but not the
    // pending set, and resetting there would defeat the backoff.
    const pendingSignature = pendingIds.slice().sort().join(",");
    if (pollSignatureRef.current !== pendingSignature) {
      pollSignatureRef.current = pendingSignature;
      pollAttemptRef.current = 0;
    }

    let cancelled = false;
    let timer;

    const scheduleNext = () => {
      const idx = Math.min(pollAttemptRef.current, POLL_STEPS_MS.length - 1);
      timer = setTimeout(tick, POLL_STEPS_MS[idx]);
    };

    const tick = async () => {
      if (cancelled) return;

      // Read the LIVE store snapshot, not the stale closure. ``store``
      // captured at effect-mount can be many ticks behind by the time
      // this runs (settle() finishing, parallel incremental sync, etc.).
      const liveItems = (closetStore.getSnapshot().items || []).filter(Boolean);
      const stillPending = pendingIds.filter((id) =>
        liveItems.find(
          (it) => it && it.id === id && it.clean_image_status === "pending",
        ),
      );
      if (stillPending.length === 0) {
        pollAttemptRef.current = 0;
        return; // all matched items resolved \u2014 stop the loop
      }

      // Hard cap: after POLL_MAX_ATTEMPTS, fire one last incremental
      // sync (the last items-list-level chance to pull the latest)
      // and give up. Prevents runaway polling if the backend
      // BackgroundTask genuinely failed without writing a terminal
      // status.
      if (pollAttemptRef.current >= POLL_MAX_ATTEMPTS) {
        // eslint-disable-next-line no-console
        console.info(
          "closet poll giving up after %d attempts (%d still pending)",
          POLL_MAX_ATTEMPTS,
          stillPending.length,
        );
        closetStore.incrementalSync().catch(() => {
          /* best-effort */
        });
        return;
      }

      try {
        const results = await Promise.all(
          stillPending.map((id) => api.getItem(id).catch(() => null)),
        );
        // Apply upserts EVEN IF the effect was cancelled while we
        // awaited \u2014 the data is fresh; dropping it would force the
        // next mount to refetch unnecessarily.
        results.forEach((it) => {
          if (it && it.id) closetStore.upsert(it);
        });
      } catch {
        /* swallow \u2014 polling is best-effort */
      }

      if (cancelled) return;
      pollAttemptRef.current += 1;
      scheduleNext();
    };

    scheduleNext();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [((store.items || []).filter((it) => it && it.clean_image_status === 'pending').map((it) => it.id).sort().join(','))]);

  const fetchSemantic = useCallback(async (text) => {
    setSemanticLoading(true);
    try {
      const res = await api.searchCloset({ text, limit: 48, min_score: 0.18 });
      const sItems = res.items || [];
      setSemanticItems(sItems);
      setSemanticIndexed(res.indexed || 0);
      setSemanticActive(true);
      if (sItems.length === 0) {
        toast.message(t("pages.closet.no_meaningful_matches_found_u2014"));
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Semantic search failed.");
      setSemanticActive(false);
    } finally {
      setSemanticLoading(false);
    }
  }, []);

  // Mount: incremental sync only (the eager prewarm in AppLayout
  // already populated the store). Filter changes no longer trigger
  // any network — they re-filter the in-memory list. This is the
  // core of the "don't fully reload on navigation" UX win.
  useEffect(() => {
    store.incrementalSync().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh on focus / visibility — picks up changes the user made
  // in another tab. Throttled inside the store itself.
  useEffect(() => {
    const onFocus = () => {
      store.incrementalSync().catch(() => {});
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") onFocus();
    });
    return () => {
      window.removeEventListener("focus", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced semantic-search trigger; keyword search is now purely
  // client-side over the store snapshot, so no network involvement.
  useEffect(() => {
    if (searchMode !== "meaning") return undefined;
    const q = (activeFilters.search || "").trim();
    if (!q) return undefined;
    const handle = setTimeout(() => {
      fetchSemantic(q);
    }, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilters.search, searchMode]);

  const onSearch = (e) => {
    e.preventDefault();
    const q = (activeFilters.search || "").trim();
    if (searchMode === "meaning" && q) {
      fetchSemantic(q);
    } else {
      fetchItems();
    }
  };

  // "x" button inside the search input — clears the query and
  // re-fetches without needing an extra trip through Enter / Search.
  const clearSearch = () => {
    setSemanticActive(false);
    setFilters((f) => ({ ...(f || {}), search: "" }));
    // Let the debounced effect handle the actual re-fetch on the
    // next tick so we don't double-fire.
  };

  const clearSemantic = () => {
    setSemanticActive(false);
    setFilters((f) => ({ ...(f || {}), search: "" }));
    fetchItems();
  };

  const empty = !loading && items.length === 0;

  // ------- selection helpers -------
  const enterSelect = () => {
    setSelectMode(true);
    setSelected(new Set());
  };
  const cancelSelect = () => {
    setSelectMode(false);
    setSelected(new Set());
  };

  const toggleOne = useCallback((id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAllVisible = () => {
    setSelected(new Set(items.map((i) => i.id)));
  };
  const clearSelection = () => setSelected(new Set());

  const allVisibleSelected =
    items.length > 0 &&
    selected.size >= items.length &&
    items.every((i) => selected.has(i.id));

  const handleDelete = async () => {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    // Snapshot the items we're about to remove so we can roll back
    // any whose backend DELETE later fails. The closetStore is the
    // UI's source of truth — once we remove from it the user sees
    // the items gone in the grid, the count tile, the bottom tab
    // badge, and the duplicate-detector on AddItem. The MongoDB
    // round-trip happens in the background, restoring the original
    // "tap-and-done" feel.
    const snapshots = items.filter((it) => selected.has(it.id));

    // Optimistic: remove from store, close the dialog, exit select
    // mode. The UI now reflects the deletion instantly.
    snapshots.forEach((it) => store.remove(it.id));
    setSelected(new Set());
    setConfirmOpen(false);
    setSelectMode(false);

    // Background reconciliation. We mark the page as `deleting` only
    // for the duration of the round-trip so any error state can
    // surface a spinner if needed (most users will already be doing
    // something else by the time this resolves).
    setDeleting(true);
    const results = await Promise.allSettled(
      ids.map((id) => api.deleteItem(id)),
    );
    setDeleting(false);

    const failedIds = ids.filter((_, idx) => {
      const res = results[idx];
      // 404 means it's already gone; treat as success so we don't revert it
      return res.status === "rejected" && res.reason?.response?.status !== 404;
    });
    if (failedIds.length === 0) {
      toast.success(`${ids.length} item${ids.length === 1 ? '' : 's'} deleted`);
      return;
    }
    // Roll back the failed ones so the UI matches reality again.
    const failedSet = new Set(failedIds);
    snapshots
      .filter((it) => failedSet.has(it.id))
      .forEach((it) => store.upsert(it));
    const okCount = ids.length - failedIds.length;
    if (okCount > 0) {
      toast.message(`Deleted ${okCount}, failed ${failedIds.length}`);
    } else {
      toast.error(t("pages.closet.could_not_delete_the_selected"));
    }
  };

  const onCardClick = (e, item) => {
    if (!selectMode) return; // let the <Link> navigate normally
    e.preventDefault();
    e.stopPropagation();
    toggleOne(item.id);
  };

  // Keyboard shortcut: Esc exits selection mode
  useEffect(() => {
    if (!selectMode) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") cancelSelect();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectMode]);

  return (
    <>
      {/* closet banner */}
      <section
        className="
    relative isolate overflow-hidden
    bg-cover bg-center bg-no-repeat
     mt-[var(--header-height)]
  "
        style={{
          backgroundImage: `url(${ClosetBanner})`,
        }}
      >
        {/* Dark gradient overlay */}
        <div
          className="
      absolute inset-0 -z-0
      bg-[linear-gradient(90deg,#080b09_0%,#101612_43%,rgba(16,22,18,0.48)_67%,rgba(16,22,18,0.08)_100%)]
    "
        />

        <div className="relative z-10 w-full">
          <div
            className="
        px-10 py-20
        max-[991px]:px-[35px] max-[991px]:py-[45px]
        max-[767px]:px-5 max-[767px]:py-[38px]
        max-[480px]:px-4 max-[480px]:py-8
      "
          >
            <div className="max-w-[520px]">
              {/* Title */}
              <h1
                className="
            m-0 mb-5
            text-[40px] leading-[50px]
            font-bold
            tracking-normal
            text-white
            max-[767px]:text-[42px]
            max-[480px]:text-[35px]
          "
              >
                {t("closet.title")}
              </h1>

              {/* Item count */}
              <div
                data-testid="closet-total"
                className="
            inline-flex
            items-center justify-center
            gap-[5px]
            rounded-full
            border border-[#666]
            px-[15px] py-[5px]
            text-[12px]
            font-bold
            text-white
          "
              >
                {typeof total === "number" || typeof total === "string"
                  ? total
                  : 0}

                <span className="text-[#666]">Items</span>
              </div>

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
                Organize your wardrobe, explore every piece and create better
                outfits effortlessly.
              </p>

              {/* Buttons */}
              <div className="flex items-center gap-2">
                {/* Add item */}
                <Link
                  to="/closet/add"
                  data-testid="closet-empty-add-button"
                  className="
              inline-flex
              items-center
              justify-center
              rounded-full
              bg-[var(--primary-color)]
              px-5 py-3.5
              text-[14px]
              font-bold
              leading-none
              text-white
              no-underline
              shadow-[var(--primary-shadow)]
              transition-all duration-300
              hover:-translate-y-[2px]
              hover:bg-[var(--primary-hover)]
              hover:text-white
            "
                >
                  <i className="fa-solid fa-plus mr-2" />
                  {t("closet.addItem")}
                </Link>

                {/* Suitcase */}
                <Link
                  to="/suitcase"
                  data-testid="closet-suitcase-link"
                  title={t("suitcase.title", {
                    defaultValue: "Suitcase",
                  })}
                  className="
              flex
              h-10 w-10
              shrink-0
              items-center justify-center
              rounded-full
              border border-[#666]
              text-white/60
              no-underline
              transition-all duration-300
              hover:border-[var(--primary-color)]
              hover:text-[var(--primary-color)]
            "
                >
                  <Luggage className="h-5 w-5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="w-full overflow-hidden bg-[var(--accent-beige)] px-[40px] py-[80px] max-[991px]:px-[5px] max-[991px]:py-[40px]">
        {/* Phase Z2.3 + Z2.6 — two ambient progress chips, side-by-side.
              ``HashRepairChip`` ticks during the duplicate-detector
              tune-up (fires first after prewarm). ``ThumbRepairChip``
              ticks during the post-Z2.6 stale-thumbnail regeneration
              (fires immediately after the hash repair completes).
              Both render nothing while idle, both fade out a few
              seconds after completion. Chained, not concurrent, so
              the user reads them as a coherent sequence. The flex
              wrap keeps phones happy when both chips are visible. */}
        <div className="mt-2 flex flex-wrap items-center gap-2 min-h-5">
          <HashRepairChip progress={store.repairProgress} />
          <ThumbRepairChip progress={store.thumbProgress} />
        </div>
        <div className="w-full">
          <div className="rounded-[12px] border-0 bg-white p-[20px] shadow-sm mb-[20px]">
            <form
              onSubmit={onSearch}
              data-testid="closet-filter-bar"
              className="flex flex-col gap-3 lg:flex-row lg:items-center"
            >
              {/* Search Field */}
              <div className="relative min-w-0 flex-1">
                {searchMode === "meaning" ? (
                  <Sparkles className="absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[hsl(var(--accent))]" />
                ) : (
                  <Search className="absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-gray-500" />
                )}

                <Input
                  value={activeFilters.search || ""}
                  onChange={(e) =>
                    setFilters((f) => ({
                      ...(f || {}),
                      search: e.target.value,
                    }))
                  }
                  placeholder={
                    searchMode === "meaning"
                      ? t("closet.semanticHint")
                      : t("closet.searchPlaceholder")
                  }
                  data-testid="closet-search-input"
                  className="
                      h-11 w-full rounded-[8px]
                      border border-gray-200
                      bg-white pl-10 pr-10
                      text-sm text-gray-900
                      shadow-none outline-none
                      placeholder:text-gray-400
                      focus:border-primary-brand
                      focus:outline-none
                      focus:ring-0
                      focus-visible:outline-none
                      focus-visible:ring-0
                      "
                />

                {/* Clear Search */}
                {activeFilters.search && (
                  <button
                    type="button"
                    onClick={clearSearch}
                    aria-label={t("closet.clearSearch", {
                      defaultValue: "Clear search",
                    })}
                    data-testid="closet-search-clear"
                    className="
                            absolute right-3 top-1/2 z-10
                            flex h-6 w-6 -translate-y-1/2
                            items-center justify-center
                            rounded-full text-gray-400
                            transition-colors
                            hover:bg-gray-100 hover:text-gray-700
                          ">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Category Select */}
              <Select
                value={activeFilters.category}
                onValueChange={(v) =>
                  setFilters((f) => ({
                    ...(f || {}),
                    category: v,
                  }))
                }
              >
                <SelectTrigger
                  data-testid="closet-category-select"
                  className="
                          h-11 w-full rounded-[8px] border border-gray-200
                          bg-white px-3 text-sm
                          lg:w-[130px]
                        "
                >
                  <SelectValue placeholder={t("closet.category")} />
                </SelectTrigger>

                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {labelForCategory(c, t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Source Select */}
              <Select
                value={activeFilters.source}
                onValueChange={(v) =>
                  setFilters((f) => ({
                    ...(f || {}),
                    source: v,
                  }))
                }
              >
                <SelectTrigger
                  data-testid="closet-source-select"
                  className="
                          h-11 w-full rounded-[8px] border border-gray-200
                          bg-white px-3 text-sm
                          lg:w-[140px]
                        "
                >
                  <SelectValue placeholder={labelForSource("all", t)} />
                </SelectTrigger>

                <SelectContent>
                  {SOURCES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {_INTENT_VALUES.has(s)
                        ? labelForIntent(s, t)
                        : labelForSource(s, t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Keyword / Meaning Toggle */}
              <div
                className="
                              flex h-11 shrink-0 items-center
                              rounded-[8px] bg-primary-shadow p-1
                              ring-1 ring-gray-100
                            "
                role="radiogroup"
                aria-label={t("common.search")}
              >
                <button
                  type="button"
                  onClick={() => setSearchMode("keyword")}
                  aria-pressed={searchMode === "keyword"}
                  data-testid="closet-search-mode-keyword"
                  className={`
                                  h-full rounded-[8px] px-3 text-xs font-medium
                                  transition-all duration-200
                                  ${
                                    searchMode === "keyword"
                                      ? "bg-white text-gray-900 shadow-sm"
                                      : "text-gray-500 hover:text-gray-800"
                                  }
                                `}
                >
                  {t("closet.keywordSearch")}
                </button>
                <button
                  type="button"
                  aria-pressed={searchMode === "meaning"}
                  data-testid="closet-search-mode-meaning"
                  onClick={() => setSearchMode("meaning")}
                  className={`
                                  flex h-full items-center gap-1.5
                                  rounded-[8px] px-3 text-xs font-medium
                                  transition-all duration-200
                                  ${
                                    searchMode === "meaning"
                                      ? "bg-white text-primary-brand shadow-sm"
                                      : "text-gray-500 hover:text-gray-800"
                                  }
                                `}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {t("closet.meaningSearch")}
                </button>
              </div>

              {/* Search Button */}
              <Button
                type="submit"
                data-testid="closet-search-button"
                className="
                                inline-flex
                                items-center
                                justify-center
                                rounded-[8px]
                                bg-[var(--primary-color)]
                                px-[20px] py-[20px]
                                text-[12px]
                                font-bold
                                leading-[22px]
                                text-white
                                no-underline
                                shadow-[var(--primary-shadow)]
                                transition-smooth
                                hover:-translate-y-[2px]
                                hover:bg-[var(--primary-hover)]
                                hover:text-white
                              "
              >
                {t("common.search")}
              </Button>
            </form>
          </div>
        </div>
        {/* Always render the floater, but change contents based on selectMode */}
        {/* <div className='col-md-12'>
              <div className="">
                {!selectMode ? (
                  <>
                    <Button
                      variant="outline"
                      className="rounded-xl shadow-sm"
                      onClick={enterSelect}
                      disabled={items.length === 0}
                      data-testid="closet-select-mode-button"
                    >
                      <ListChecks className="h-4 w-4 me-0 md:me-2" /> <span className="hidden md:inline">{t('closet.bulkSelect')}</span>
                    </Button>
                    <Button
                      asChild
                      className="hidden md:flex rounded-xl shadow-sm bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-950 dark:hover:bg-neutral-200"
                      data-testid="closet-add-item-floater-button"
                    >
                      <Link to="/closet/add">
                        <Plus className="h-4 w-4 me-2 text-yellow-400 animate-pulse drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]" />
                        <span className="text-yellow-400 animate-pulse drop-shadow-[0_0_8px_rgba(250,204,21,0.8)] font-semibold">{t('closet.addItem', { defaultValue: 'Add item' })}</span>
                      </Link>
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 px-2 text-sm font-medium">
                      <CheckCircle2 className="h-4 w-4 text-[hsl(var(--accent))]" />
                      <span data-testid="closet-selected-count">
                        {selected.size}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={allVisibleSelected ? clearSelection : selectAllVisible}
                      data-testid="closet-select-all-button"
                      className="rounded-lg"
                    >
                      {allVisibleSelected ? (
                        <><Square className="h-4 w-4 md:me-1.5" /> <span className="hidden md:inline">{t('common.clear')}</span></>
                      ) : (
                        <><CheckSquare className="h-4 w-4 md:me-1.5" /> <span className="hidden md:inline">{t('common.selectAll')}</span></>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="rounded-lg"
                      disabled={selected.size === 0}
                      onClick={() => {
                        const hints = items.filter((i) => selected.has(i.id));
                        setCompletionAnchors(hints);
                        setCompletionOpen(true);
                      }}
                      data-testid="closet-complete-outfit-button"
                    >
                      <Wand2 className="h-4 w-4 md:me-1.5" />
                      <span className="hidden md:inline">{t('outfitCompletion.cta')}</span>
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="rounded-lg"
                      disabled={selected.size < 2 || deleting}
                      onClick={() => {
                        setGroupOpen(true);
                        setGroupHostId(Array.from(selected)[0] || '');
                      }}
                      data-testid="closet-group-selected-button"
                    >
                      <ListChecks className="h-4 w-4 md:me-1.5" />
                      <span className="hidden md:inline">{t('closet.groupSelected', { defaultValue: 'Group' })}</span>
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="rounded-lg"
                      disabled={selected.size === 0 || deleting}
                      onClick={() => {
                        setTagInput('');
                        setTagOpen(true);
                      }}
                      data-testid="closet-tag-selected-button"
                    >
                      <Tag className="h-4 w-4 md:me-1.5" />
                      <span className="hidden md:inline">{t('closet.tagSelected', { defaultValue: 'Tag' })}</span>
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="rounded-lg"
                      disabled={selected.size === 0 || deleting}
                      onClick={() => setConfirmOpen(true)}
                      data-testid="closet-delete-selected-button"
                    >
                      {deleting ? (
                        <Loader2 className="h-4 w-4 md:me-1.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 md:me-1.5" />
                      )}
                      <span className="hidden md:inline">{t('common.delete')}</span>
                    </Button>
                    <div className="w-px h-6 bg-border mx-1 hidden md:block"></div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={cancelSelect}
                      data-testid="closet-select-cancel-button"
                      className="rounded-lg"
                    >
                      <X className="h-4 w-4 md:me-1.5" />
                      <span className="hidden md:inline">{t('common.cancel', { defaultValue: 'Cancel' })}</span>
                    </Button>
                  </>
                )}
              </div>
            </div> */}
        {/* Semantic-results banner \u2014 only shown after a successful meaning search */}
        {semanticActive && (
          <div
            className="mt-4 flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-2xl border border-border bg-[hsl(var(--accent))]/10"
            data-testid="closet-semantic-banner"
          >
            <div className="flex items-center gap-2 text-sm">
              <Sparkles className="h-4 w-4 text-[hsl(var(--accent))]" />
              <span>
                <Trans
                  i18nKey="pages.closet.semantic_matches"
                  defaultValue="Showing <0>{{count}}</0> semantic matches across <1>{{total}}</1> indexed items."
                  values={{ count: items.length, total: semanticIndexed }}
                  components={[
                    <span key="count" className="font-medium" />,
                    <span key="total" className="font-medium" />,
                  ]}
                />
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearSemantic}
              className="rounded-lg"
              data-testid="closet-semantic-clear"
            >
              <X className="h-4 w-4 me-1.5" />{" "}
              {t("pages.closet.back_to_full_closet")}
            </Button>
          </div>
        )}
        {loading && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="rounded-[calc(var(--radius)+6px)] overflow-hidden"
              >
                <Skeleton className="aspect-[3/4] w-full" />
                <Skeleton className="h-4 w-3/4 mt-3" />
                <Skeleton className="h-3 w-1/2 mt-2" />
              </div>
            ))}
          </div>
        )}
        {empty && (
          <div className="w-full">
            <div
              className="flex w-full items-center justify-center rounded-[12px] mt-[20px] bg-white px-4 py-10 sm:py-12 md:py-14"
              data-testid="closet-empty-state"
            >
              <div className="flex w-full max-w-4xl flex-col items-center text-center">
                {/* Image */}
                <div className="mb-4 flex justify-center">
                  <img
                    src={closet4}
                    alt={t("pages.closet.flat_lay_empty_state")}
                    className="h-auto w-[220px] object-contain sm:w-[250px] md:w-[280px]"
                  />
                </div>

                {/* Content */}
                <div className="flex w-full flex-col items-center">
                  {/* Heading */}
                  <h2 className="mb-1 text-2xl font-bold tracking-tight text-black sm:text-[28px]">
                    {t("closet.emptyTitle", {
                      defaultValue: "Your closet is empty",
                    })}
                  </h2>

                  {/* Description */}
                  <p className="mb-4 max-w-xl text-sm leading-6 text-gray-500 sm:text-[15px]">
                    {t("closet.emptySub", {
                      defaultValue:
                        "Add your first clothing item and let AI help you discover amazing outfit combinations.",
                    })}
                  </p>

                  {/* Features */}
                  <div className="mb-5 flex flex-col items-center justify-center gap-3 text-sm text-gray-600 sm:flex-row sm:gap-8">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-[18px] w-[18px] text-primary-brand" />
                      <span>
                        {t("closet.autoCategory", {
                          defaultValue: "Auto-categorize with AI",
                        })}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Wand2 className="h-[18px] w-[18px] text-primary-brand" />
                      <span>
                        {t("closet.detectDetails", {
                          defaultValue: "Detect colors and patterns",
                        })}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Layers3 className="h-[18px] w-[18px] text-primary-brand" />
                      <span>
                        {t("closet.smartSuggestions", {
                          defaultValue: "Smart outfit suggestions",
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Add Item Button */}
                  <Link
                    to="/closet/add"
                    data-testid="closet-empty-add-button"
                    className="
               inline-flex
              items-center
              justify-center
              rounded-full
              bg-[var(--primary-color)]
              px-5 py-3.5
              text-[14px]
              font-bold
              leading-none
              text-white
              no-underline
              shadow-[var(--primary-shadow)]
              transition-all duration-300
              hover:-translate-y-[2px]
              hover:bg-[var(--primary-hover)]
              hover:text-white
            "
                  >
                    <i className="fa-solid fa-plus mr-2"></i>

                    {t("closet.addItem", {
                      defaultValue: "Add Your First Item",
                    })}
                  </Link>
                </div>
              </div>
            </div>
          </div>
          // <div className="mt-10 text-center max-w-md mx-auto" data-testid="closet-empty-state">
          //   <div className="mx-auto w-40 h-40 rounded-full bg-secondary/70 mb-6 overflow-hidden">
          //     <img
          //       src="https://images.unsplash.com/photo-1654773125909-6d73f0c12407?w=600&q=80"
          //       alt={t('pages.closet.flat_lay_empty_state')}
          //       className="w-full h-full object-cover"
          //     />
          //   </div>
          //   <h2 className="font-display text-2xl">{t('closet.emptyTitle')}</h2>
          //   <p className="text-sm text-muted-foreground mt-2">
          //     {t('closet.emptySub')}
          //   </p>
          //   <Button asChild className="mt-5 rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 group" data-testid="closet-empty-add-button">
          //     <Link to="/closet/add"><Plus className="h-4 w-4 me-2 text-yellow-400 group-hover:drop-shadow-[0_0_8px_rgba(250,204,21,0.8)] transition-all duration-200" /> <span className="text-yellow-400 group-hover:drop-shadow-[0_0_8px_rgba(250,204,21,0.8)] transition-all duration-200">{t('closet.addItem')}</span></Link>
          //   </Button>
          // </div>
        )}
        {!loading && items.length > 0 && (
          <div
            className="
                  grid w-full
                  grid-cols-5
                  gap-4
                  sm:grid-cols-3
                  lg:grid-cols-4
                  xl:grid-cols-5
                "
            data-testid="closet-grid"
          >
            {items.map((it) => {
              const isSelected = selected.has(it.id);

              if (selectMode) {
                return (
                  <button
                    key={it.id}
                    type="button"
                    onClick={(e) => onCardClick(e, it)}
                    aria-pressed={isSelected}
                    aria-label={`${isSelected ? "Deselect" : "Select"} ${
                      it.title || "item"
                    }`}
                    data-testid="closet-item-card"
                    data-selected={isSelected}
                    onContextMenu={(e) => e.preventDefault()}
                    className={`
              relative block w-full cursor-pointer
              overflow-hidden rounded-2xl
              border bg-white p-0 text-left
              shadow-none
              transition-all duration-200
              focus:outline-none
              focus-visible:ring-2
              focus-visible:ring-[hsl(var(--accent))]
              focus-visible:ring-offset-2

              ${
                isSelected
                  ? `
                    border-[hsl(var(--accent))]
                    ring-2 ring-[hsl(var(--accent))]/20
                  `
                  : `
                    border-gray-200
                    hover:border-gray-300
                  `
              }
            `}
                    style={{
                      WebkitTouchCallout: "none",
                      touchAction: isTouchDragging ? "none" : "pan-y",
                    }}
                  >
                    <ItemCardInner
                      item={it}
                      isSelected={isSelected}
                      showCheckbox
                      score={it._score}
                    />
                  </button>
                );
              }

              return (
                <Link
                  key={it.id}
                  to={`/closet/${it.id}`}
                  className={`h-full
                      relative block w-full
                      overflow-hidden rounded-[12px]
                      bg-white
                      hover:shadow-xl
                      transition-smooth
                      hover:-translate-y-0.5
                      hover:border-gray-300

                    ${draggedId === it.id ? "scale-[0.98] opacity-50" : ""}

                    ${
                      dragOverId === it.id
                        ? `
                          border-[hsl(var(--accent))]
                          ring-2 ring-[hsl(var(--accent))]/20
                        `
                        : ""
                    }
                  `}
                  style={{
                    WebkitTouchCallout: "none",
                    touchAction: isTouchDragging ? "none" : "pan-y",
                  }}
                  data-testid="closet-item-card"
                  data-item-id={it.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, it.id)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => handleDragOver(e, it.id)}
                  onDragLeave={(e) => handleDragLeave(e, it.id)}
                  onDrop={(e) => handleDrop(e, it.id)}
                  onTouchStart={(e) => handleTouchStart(e, it.id)}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  onContextMenu={(e) => e.preventDefault()}
                >
                  <ItemCardInner item={it} score={it._score} />
                </Link>
              );
            })}
          </div>
        )}

        {/* Confirm delete dialog */}
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent data-testid="closet-delete-confirm-dialog">
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t("closet.confirmDeleteTitle")}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t("closet.confirmDeleteBody", { count: selected.size })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="closet-delete-cancel">
                {t("common.cancel", { defaultValue: "Cancel" })}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={deleting}
                data-testid="closet-delete-confirm"
                className="bg-[hsl(var(--destructive,0_84%_60%))] text-white hover:opacity-90"
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 me-1.5 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 me-1.5" />
                )}
                {t("common.delete")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {/* Grouping confirmation dialog */}
        <AlertDialog open={groupOpen} onOpenChange={setGroupOpen}>
          <AlertDialogContent data-testid="closet-group-confirm-dialog">
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t("closet.groupConfirmTitle", {
                  defaultValue: "Group Selected Items",
                })}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t("closet.groupConfirmBody", {
                  defaultValue:
                    "Choose which item will be the primary (host) item. All other selected items will be grouped under it.",
                })}
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="py-4">
              <label className="caps-label text-xs text-muted-foreground block mb-2">
                {t("closet.primaryItemLabel", {
                  defaultValue: "Primary Item",
                })}
              </label>
              <Select value={groupHostId} onValueChange={setGroupHostId}>
                <SelectTrigger className="w-full rounded-xl">
                  <SelectValue
                    placeholder={t("closet.selectPrimaryPlaceholder", {
                      defaultValue: "Select primary item...",
                    })}
                  />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {Array.from(selected).map((id) => {
                    const item = (store.items || []).find(
                      (it) => it && it.id === id,
                    );
                    return (
                      <SelectItem key={id} value={id}>
                        <div className="flex items-center gap-2">
                          <span className="truncate">
                            {item?.name || item?.title || id}
                          </span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel
                data-testid="closet-group-cancel"
                onClick={() => setGroupOpen(false)}
              >
                {t("common.cancel", { defaultValue: "Cancel" })}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={async (e) => {
                  e.preventDefault();
                  if (!groupHostId) return;
                  const hostId = groupHostId;
                  const memberIds = Array.from(selected).filter(
                    (id) => id !== hostId,
                  );

                  const hostItem = (store.items || []).find(
                    (it) => it && it.id === hostId,
                  );
                  const memberItems = memberIds
                    .map((mid) =>
                      (store.items || []).find((it) => it && it.id === mid),
                    )
                    .filter(Boolean);

                  const normCategory = (cat) => {
                    const s = String(cat || "")
                      .trim()
                      .toLowerCase()
                      .replace(/\s+/g, "_");
                    if (s === "top" || s === "tops") return "top";
                    if (s === "bottom" || s === "bottoms") return "bottom";
                    if (s === "footwear" || s === "shoes") return "footwear";
                    if (s === "accessory" || s === "accessories")
                      return "accessories";
                    return s;
                  };
                  const allItemsInGroup = [hostItem, ...memberItems].filter(
                    Boolean,
                  );
                  const categories = new Set(
                    allItemsInGroup.map((it) => normCategory(it.category)),
                  );
                  const isBulkSet = categories.size > 1;

                  const mismatchesSet = new Set();
                  if (!isBulkSet) {
                    for (const m of memberItems) {
                      const diffs = getTaxonomyMismatches(hostItem, m);
                      for (const d of diffs) {
                        mismatchesSet.add(d);
                      }
                    }
                  }
                  const mismatches = Array.from(mismatchesSet);

                  const runBulkGrouping = async () => {
                    setGrouping(true);
                    const backups = [
                      {
                        id: hostId,
                        data: hostItem ? { ...hostItem } : null,
                      },
                      ...memberIds.map((mid) => {
                        const it = (store.items || []).find(
                          (x) => x && x.id === mid,
                        );
                        return { id: mid, data: it ? { ...it } : null };
                      }),
                    ];

                    const groupId = hostItem?.group_id || hostId;
                    if (hostItem) {
                      store.upsert({
                        ...hostItem,
                        group_id: groupId,
                        group_role: "host",
                      });
                    }
                    memberItems.forEach((it) => {
                      store.upsert({
                        ...it,
                        group_id: groupId,
                        group_role: "member",
                      });
                    });

                    setSelected(new Set());
                    setSelectMode(false);

                    try {
                      const responses = await Promise.all(
                        memberIds.map((mid) =>
                          api.groupItems({
                            host_id: hostId,
                            member_id: mid,
                          }),
                        ),
                      );
                      const allSuccess = responses.every(
                        (res) => res.status === "success",
                      );
                      if (allSuccess) {
                        responses.forEach((res) => {
                          if (res.host) store.upsert(res.host);
                          if (res.member) store.upsert(res.member);
                        });
                        await store.incrementalSync();
                        workStore.registerPolishItems([hostId, ...memberIds]);
                        toast.success(t("common.success"));
                      } else {
                        backups.forEach((b) => {
                          if (b.data) store.upsert(b.data);
                        });
                        toast.error(t("common.error"));
                      }
                    } catch (err) {
                      console.error("Failed to group items:", err);
                      backups.forEach((b) => {
                        if (b.data) store.upsert(b.data);
                      });
                      toast.error(
                        err?.response?.data?.detail || t("common.error"),
                      );
                    } finally {
                      setGrouping(false);
                    }
                  };

                  if (mismatches.length > 0) {
                    setGroupOpen(false);
                    setGatekeeperMismatches(mismatches);
                    setGatekeeperPendingAction({
                      onApprove: runBulkGrouping,
                    });
                    setGatekeeperOpen(true);
                  } else {
                    await runBulkGrouping();
                  }
                }}
                disabled={grouping || !groupHostId}
                data-testid="closet-group-confirm"
                className="bg-primary text-primary-foreground hover:opacity-90"
              >
                {grouping ? (
                  <Loader2 className="h-4 w-4 me-1.5 animate-spin" />
                ) : (
                  <ListChecks className="h-4 w-4 me-1.5" />
                )}
                {t("closet.confirmGroup", { defaultValue: "Group" })}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {/* Taxonomy gatekeeper warning dialog */}
        <AlertDialog open={gatekeeperOpen} onOpenChange={setGatekeeperOpen}>
          <AlertDialogContent data-testid="closet-gatekeeper-dialog">
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t("closet.gatekeeper.title", {
                  defaultValue: "Mismatched Properties Warning",
                })}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t("closet.gatekeeper.body", {
                  defaultValue:
                    "The items you are grouping have mismatched properties: {{mismatches}}. Are you sure you want to group them?",
                  mismatches: gatekeeperMismatches
                    .map((field) => getTaxonomyFieldLabel(field))
                    .join(", "),
                })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                data-testid="closet-gatekeeper-cancel"
                onClick={() => {
                  setGatekeeperOpen(false);
                  setGatekeeperPendingAction(null);
                }}
              >
                {t("closet.gatekeeper.cancel", { defaultValue: "Cancel" })}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setGatekeeperOpen(false);
                  if (gatekeeperPendingAction?.onApprove) {
                    gatekeeperPendingAction.onApprove();
                  }
                  setGatekeeperPendingAction(null);
                }}
                data-testid="closet-gatekeeper-confirm"
                className="bg-primary text-primary-foreground hover:opacity-90"
              >
                {t("closet.gatekeeper.confirm", {
                  defaultValue: "Group anyway",
                })}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {/* Group tagging dialog */}
        <AlertDialog open={tagOpen} onOpenChange={setTagOpen}>
          <AlertDialogContent data-testid="closet-tag-dialog">
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t("closet.tagConfirmTitle", {
                  defaultValue: "Tag Selected Items",
                })}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t("closet.tagConfirmBody", {
                  defaultValue:
                    "Enter tags separated by commas to add them to all selected garments.",
                })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4">
              <Input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder={t("closet.customTagPlaceholder", {
                  defaultValue: "e.g. Work, GYM, Swimwear",
                })}
                className="rounded-xl"
                data-testid="closet-tag-input"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel
                data-testid="closet-tag-cancel"
                onClick={() => setTagOpen(false)}
              >
                {t("common.cancel", { defaultValue: "Cancel" })}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={async (e) => {
                  e.preventDefault();
                  const newTags = tagInput
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean);
                  if (newTags.length === 0) {
                    setTagOpen(false);
                    return;
                  }
                  setTagging(true);

                  // 1. First, add the new tags to the selected frontend Closet items
                  const selectedIds = Array.from(selected);
                  selectedIds.forEach((id) => {
                    const item = (store.items || []).find(
                      (it) => it && it.id === id,
                    );
                    if (item) {
                      const existingTags = Array.isArray(item.tags)
                        ? item.tags
                        : [];
                      const mergedTags = Array.from(
                        new Set([...existingTags, ...newTags]),
                      );
                      closetStore.upsert({ ...item, tags: mergedTags });
                    }
                  });

                  // Clear selection and close/exit select mode
                  setSelected(new Set());
                  setSelectMode(false);
                  setTagOpen(false);

                  // 2. Update the DB in the background
                  try {
                    const tagPromises = selectedIds.map(async (id) => {
                      const item = (store.items || []).find(
                        (it) => it && it.id === id,
                      );
                      if (!item) return;
                      const existingTags = Array.isArray(item.tags)
                        ? item.tags
                        : [];
                      const mergedTags = Array.from(
                        new Set([...existingTags, ...newTags]),
                      );
                      await api.patchItem(id, { tags: mergedTags });
                    });
                    await Promise.all(tagPromises);
                    toast.success(
                      t("closet.tagsAppliedSuccess", {
                        defaultValue: "Tags applied successfully",
                      }),
                    );
                    // Background sync to sync everything with the backend state
                    await store.incrementalSync();
                  } catch (err) {
                    console.error("Failed to update tags in background:", err);
                    toast.error(
                      t("closet.tagsAppliedError", {
                        defaultValue: "Some tags failed to sync to the server",
                      }),
                    );
                  } finally {
                    setTagging(false);
                  }
                }}
                disabled={tagging}
                data-testid="closet-tag-confirm"
                className="bg-primary text-primary-foreground hover:opacity-90"
              >
                {tagging ? (
                  <Loader2 className="h-4 w-4 me-1.5 animate-spin" />
                ) : (
                  <Tag className="h-4 w-4 me-1.5" />
                )}
                {t("closet.tagSelected", { defaultValue: "Tag" })}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {/* Phase Z4 — post-"Save all" failures dialog. Reads
          ``store.lastSaveFailures`` (populated by AddItem.saveAll's
          background-sync reconciler when one or more parallel
          createItem calls reject). Shows the user a single warning
          with every failed photo's thumbnail + filename so they
          know exactly what didn't make it into the cloud closet. */}
        <SaveFailuresDialog
          failures={store.lastSaveFailures || []}
          onDismiss={() => closetStore.dismissSaveFailures()}
        />
        {/* Phase P: Outfit Completion sheet */}
        <OutfitCompletionSheet
          open={completionOpen}
          onOpenChange={setCompletionOpen}
          anchorIds={Array.from(selected)}
          anchorsHint={completionAnchors}
        />
        {/* Touch drag preview overlay */}
        {isTouchDragging && draggedId && (
          <div
            className="fixed pointer-events-none z-50 w-16 h-20 rounded-lg overflow-hidden border-2 border-emerald-500 shadow-lg opacity-90"
            style={{
              left: touchPos.x - 32,
              top: touchPos.y - 40,
              transform: "scale(1.15)",
              boxShadow: "0 8px 16px rgba(0,0,0,0.3)",
            }}
          >
            {(() => {
              const draggedItem = (store.items || []).find(
                (x) => x && x.id === draggedId,
              );
              return draggedItem ? (
                <img
                  src={bestImageUrl(draggedItem)}
                  alt={t("addItem.preflight.noThumb")}
                  className="w-full h-full object-cover"
                />
              ) : null;
            })()}
          </div>
        )}
      </section>
    </>
  );
}

/* -------------------- shared card body -------------------- */
function ItemCardInner({ item, isSelected, showCheckbox, score }) {
  const { t } = useTranslation();
  const groupItems = useMemo(() => {
    if (!item.group_id) return [];
    const allItems = (closetStore.getSnapshot().items || []).filter(Boolean);
    return allItems.filter((it) => it && it.group_id === item.group_id);
  }, [item.group_id]);

  const isSet = useMemo(() => {
    if (groupItems.length <= 1) return false;
    const normCategory = (cat) => {
      const s = String(cat || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "_");
      if (s === "top" || s === "tops") return "top";
      if (s === "bottom" || s === "bottoms") return "bottom";
      if (s === "footwear" || s === "shoes") return "footwear";
      if (s === "accessory" || s === "accessories") return "accessories";
      return s;
    };
    const categories = new Set(
      groupItems.filter(Boolean).map((it) => normCategory(it.category)),
    );
    return categories.size > 1;
  }, [groupItems]);

  return (
    // <AspectRatio ratio={3 / 4} className="bg-secondary relative">
    //   {(() => {
    //     const thumbUrl = bestImageUrl(item);
    //     const polishing = isCleanImagePending(item);
    //     if (thumbUrl) {
    //       return (
    //         <>
    //           <ProgressiveImage
    //             variants={item.image_variants}
    //             originalSrc={thumbUrl}
    //             alt={item.title}
    //             objectFit="contain"
    //             className="w-full h-full select-none"
    //             draggable={false}
    //             style={{ WebkitTouchCallout: 'none' }}
    //             data-testid="closet-item-thumb"
    //           />
    //           {polishing && (
    //             // Phase O.6 — subtle "polishing photo…" affordance
    //             // while the backend's background rembg matte is
    //             // running. The closet poll (Closet.jsx top-level)
    //             // will swap the image in-place when status flips
    //             // to "ready".
    //             //
    //             // Patch M20.1 (May 2026, user feedback) — Kept as
    //             // a per-card textual badge alongside the global
    //             // ``WorkProgressFloater``. The floater shows
    //             // aggregate "Polishing N/M photos" progress; this
    //             // badge identifies WHICH specific cards are still
    //             // mid-polish so the user can scan and know what's
    //             // about to update. Both indicators co-exist by
    //             // design.
    //             <div
    //               className="absolute inset-0 flex items-end justify-start p-2 pointer-events-none"
    //               data-testid="closet-item-polishing"
    //             >
    //               <Badge
    //                 variant="outline"
    //                 className="bg-background/85 backdrop-blur text-[10px] border-[hsl(var(--accent))]/40 animate-pulse"
    //               >
    //                 {t('item.polishingPhoto', { defaultValue: 'Polishing photo…' })}
    //               </Badge>
    //             </div>
    //           )}
    //         </>
    //       );
    //     }
    //     if (item.dpp_data) {
    //       return (
    //         <div
    //           className="w-full h-full flex flex-col items-center justify-center gap-1.5 bg-gradient-to-br from-[hsl(var(--accent))]/10 to-muted text-muted-foreground"
    //           data-testid="closet-item-dpp-placeholder"
    //         >
    //           <QrCode className="h-7 w-7 text-[hsl(var(--accent))]/70" />
    //           <span className="caps-label text-[10px]">{t('closet.dpp', { defaultValue: 'DPP' })}</span>
    //         </div>
    //       );
    //     }
    //     return (
    //       <div className="w-full h-full flex items-center justify-center text-muted-foreground caps-label">
    //         {t('market.noImage')}
    //       </div>
    //     );
    //   })()}
    //   {typeof score === 'number' && (
    //     <Badge
    //       variant="outline"
    //       className="absolute top-2 end-2 bg-background/85 backdrop-blur text-[10px] border-[hsl(var(--accent))]/50 flex items-center gap-1"
    //       data-testid="closet-item-score"
    //     >
    //       <Sparkles className="h-2.5 w-2.5 text-[hsl(var(--accent))]" />
    //       {Math.round(score * 100)}%
    //     </Badge>
    //   )}
    //   {showCheckbox && (
    //     <div
    //       className={`absolute top-2 start-2 h-6 w-6 rounded-full flex items-center justify-center border-2 transition-colors ${isSelected
    //         ? 'bg-[hsl(var(--accent))] border-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]'
    //         : 'bg-background/80 border-border backdrop-blur'
    //         }`}
    //       aria-hidden="true"
    //       data-testid={isSelected ? 'closet-item-selected-mark' : 'closet-item-unselected-mark'}
    //     >
    //       {isSelected ? (
    //         <CheckCircle2 className="h-4 w-4" />
    //       ) : (
    //         <Circle className="h-4 w-4 text-muted-foreground opacity-0" />
    //       )}
    //     </div>
    //   )}
    //   {showCheckbox && isSelected && (
    //     <div className="absolute inset-0 bg-[hsl(var(--accent))]/10 pointer-events-none" />
    //   )}
    //   {/* Phase Z2 — red ⭐ overlay marks items the user explicitly
    //       kept as duplicates of an existing closet entry. The
    //       Stylist Brain filters these out of recommendations, so
    //       this badge tells the user "yes, I have this twice, but
    //       outfit suggestions won't double-count it." */}
    //   {item.is_duplicate && (
    //     <div
    //       className={`absolute ${typeof score === 'number' ? 'top-10' : 'top-2'} end-2 h-7 w-7 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-md ring-2 ring-background`}
    //       title={t('closet.duplicateBadge', {
    //         defaultValue:
    //           'Marked as a duplicate — kept on purpose, hidden from outfit suggestions.',
    //       })}
    //       data-testid="closet-item-duplicate-star"
    //     >
    //       <Star className="h-3.5 w-3.5 fill-white" />
    //     </div>
    //   )}
    //   {/* Phase Z4 — pulsing sparkle marks items that were just
    //       saved optimistically and are still syncing to the server.
    //       Disappears the moment the canonical server item replaces
    //       the ghost in ``closetStore``. The animation is a soft
    //       opacity/scale pulse (not a spin, which reads as "error"
    //       in fashion-app context); pointer-events-none so it never
    //       blocks the card's link. */}
    //   {item._pendingSync && (
    //     <div
    //       className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 px-2 py-1.5 pointer-events-none bg-gradient-to-t from-background/95 via-background/80 to-transparent"
    //       data-testid="closet-item-pending-sync"
    //       aria-live="polite"
    //       aria-label={t('closet.pendingSync', { defaultValue: 'Syncing…' })}
    //     >
    //       <span className="relative inline-flex h-3 w-3">
    //         <span className="absolute inset-0 rounded-full bg-[hsl(var(--accent))] opacity-60 animate-ping" />
    //         <Sparkles className="relative h-3 w-3 text-[hsl(var(--accent))] animate-pulse" />
    //       </span>
    //       <span className="text-[10px] font-medium uppercase tracking-wider text-[hsl(var(--accent))]">
    //         {t('closet.pendingSync', { defaultValue: 'Syncing' })}
    //       </span>
    //     </div>
    //   )}
    // </AspectRatio>
    // <CardContent className="p-3">
    //   <div className="flex items-center justify-between gap-2">
    //     <div className="font-medium text-sm truncate">{item.title}</div>
    //     <div className="flex items-center gap-1.5 shrink-0">
    //       {isSet && (
    //         <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[10px] caps-label px-1.5 py-0.5 rounded">
    //           {t('closet.outfitSet', { defaultValue: 'Outfit set' })}
    //         </Badge>
    //       )}
    //       <SourceTagBadge source={item.source} intent={item.marketplace_intent} className="hidden md:inline-flex" />
    //     </div>
    //   </div>
    //   <div className="text-xs text-muted-foreground mt-1 flex justify-between items-center gap-2">
    //     <span className="truncate">
    //       {isSet ? (
    //         (() => {
    //           const sorted = [...groupItems].sort((a, b) => (a.group_role === 'host' ? -1 : 1));
    //           const categoryNames = sorted.map(it => labelForCategory(it.category, t));
    //           return categoryNames.join(' · ');
    //         })()
    //       ) : (
    //         [labelForCategory(item.category, t), labelForColor(item.color, t)].filter(Boolean).join(' · ')
    //       )}
    //     </span>
    //     {typeof item.wear_count === 'number' && (
    //       <span className="text-[10px] font-medium bg-secondary/80 px-1.5 py-0.5 rounded-full text-foreground whitespace-nowrap shrink-0" title={t('item.timesWorn', { count: item.wear_count, defaultValue: `Worn ${item.wear_count} times` })}>
    //         {t('item.wearsCount', { count: item.wear_count, defaultValue: `${item.wear_count} wear${item.wear_count === 1 ? '' : 's'}` })}
    //       </span>
    //     )}
    //   </div>
    //   {/* Auto-list "Complete listing" CTA — appears when an item
    //       has been auto-listed (Private→Shared toggle) and the user
    //       hasn't yet refined the listing's price / mode / description.
    //       One tap takes them to the edit-listing form. */}
    //   {item.auto_listing_needs_completion && item.auto_listing_id && (
    //     <Link
    //       to={`/marketplace/listing/${item.auto_listing_id}/edit`}
    //       data-testid="closet-item-complete-listing-cta"
    //       className="mt-2 flex items-center justify-center gap-1.5 text-[11px] uppercase tracking-wider font-semibold py-1.5 rounded-md bg-[hsl(var(--accent))]/12 text-[hsl(var(--accent))] hover:bg-[hsl(var(--accent))]/20 transition-colors"
    //     >
    //       <Sparkles className="h-3 w-3" />
    //       {t('closet.completeListingCta', { defaultValue: 'Complete listing' })}
    //     </Link>
    //   )}
    // </CardContent>

    <Card
      className={`h-full relative overflow-hidden rounded-[12px] border border-gray-200 bg-white shadow-none transition-smooth ${
        isSelected
          ? "border-[hsl(var(--accent))] ring-2 ring-[hsl(var(--accent))]/20"
          : ""
      }`}
    >
      {/* IMAGE / MEDIA */}
      <div className="relative h-[280px] w-full overflow-hidden bg-white">
        {(() => {
          const thumbUrl = bestImageUrl(item);
          const polishing = isCleanImagePending(item);

          if (thumbUrl) {
            return (
              <>
                <ProgressiveImage
                  variants={item.image_variants}
                  originalSrc={thumbUrl}
                  alt={item.title}
                  objectFit="contain"
                  className="h-full w-full object-contain select-none"
                  draggable={false}
                  style={{ WebkitTouchCallout: "none" }}
                  data-testid="closet-item-thumb"
                />

                {polishing && (
                  <div
                    className="absolute left-3 top-3 z-20"
                    data-testid="closet-item-polishing"
                  >
                    <Badge
                      variant="outline"
                      className="rounded-full border-gray-300 bg-white/90 px-2.5 py-1 text-[11px] font-medium text-gray-700 shadow-none backdrop-blur-sm"
                    >
                      {t("item.polishingPhoto", {
                        defaultValue: "Polishing photo…",
                      })}
                    </Badge>
                  </div>
                )}
              </>
            );
          }

          if (item.dpp_data) {
            return (
              <div
                className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gray-50"
                data-testid="closet-item-dpp-placeholder"
              >
                <QrCode className="h-10 w-10 text-gray-400" />

                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-500">
                  {t("closet.dpp", {
                    defaultValue: "DPP",
                  })}
                </span>
              </div>
            );
          }

          return (
            <div className="flex h-full w-full items-center justify-center bg-gray-50 text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-400">
              {t("market.noImage")}
            </div>
          );
        })()}

        {/* SCORE */}
        {typeof score === "number" && (
          <span
            className="absolute right-3 top-3 z-20 inline-flex items-center gap-1 rounded-full bg-[hsl(var(--accent))] px-2.5 py-1 text-[11px] font-semibold text-white"
            data-testid="closet-item-score"
          >
            <Sparkles size={12} />
            {Math.round(score * 100)}%
          </span>
        )}

        {/* CHECKBOX */}
        {showCheckbox && (
          <div
            className={`absolute left-3 top-3 z-20 flex h-6 w-6 items-center justify-center rounded-full ${
              isSelected ? "text-[hsl(var(--accent))]" : "text-gray-300"
            }`}
            aria-hidden="true"
            data-testid={
              isSelected
                ? "closet-item-selected-mark"
                : "closet-item-unselected-mark"
            }
          >
            {isSelected ? (
              <CheckCircle2 className="h-6 w-6" />
            ) : (
              <Circle className="h-6 w-6 opacity-70" />
            )}
          </div>
        )}

        {/* SELECTED OVERLAY */}
        {showCheckbox && isSelected && (
          <div className="pointer-events-none absolute inset-0 z-10 bg-[hsl(var(--accent))]/5" />
        )}

        {/* DUPLICATE */}
        {item.is_duplicate && (
          <div
            className={`absolute right-3 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-white bg-white/90 text-gray-700 shadow-none backdrop-blur-sm ${
              typeof score === "number" ? "top-12" : "top-3"
            }`}
            title={t("closet.duplicateBadge", {
              defaultValue:
                "Marked as a duplicate — kept on purpose, hidden from outfit suggestions.",
            })}
            data-testid="closet-item-duplicate-star"
          >
            <Star className="h-4 w-4" />
          </div>
        )}

        {/* PENDING SYNC */}
        {item._pendingSync && (
          <div
            className="absolute bottom-3 left-3 z-20 inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-gray-700 backdrop-blur-sm"
            data-testid="closet-item-pending-sync"
            aria-live="polite"
            aria-label={t("closet.pendingSync", {
              defaultValue: "Syncing…",
            })}
          >
            <span className="relative flex h-4 w-4 items-center justify-center">
              <span className="absolute h-4 w-4 animate-ping rounded-full bg-[hsl(var(--accent))]/30" />

              <Sparkles className="relative z-10 h-3.5 w-3.5 text-[hsl(var(--accent))]" />
            </span>

            <span>
              {t("closet.pendingSync", {
                defaultValue: "Syncing",
              })}
            </span>
          </div>
        )}
      </div>

      {/* CONTENT */}
      <CardContent className="p-4">
        {/* TITLE + BADGES */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 text-sm font-semibold leading-5 text-[#14161B]">
            {item.title}
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {isSet && (
              <Badge
                variant="secondary"
                className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-600 shadow-none"
              >
                {t("closet.outfitSet", {
                  defaultValue: "Outfit set",
                })}
              </Badge>
            )}

            <SourceTagBadge
              source={item.source}
              intent={item.marketplace_intent}
              className="rounded-full"
            />
          </div>
        </div>

        {/* CATEGORY / COLOR + WEAR COUNT */}
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-xs text-gray-500">
            {isSet
              ? (() => {
                  const sorted = [...groupItems].sort((a, b) =>
                    a.group_role === "host" ? -1 : 1,
                  );

                  const categoryNames = sorted.map((it) =>
                    labelForCategory(it.category, t),
                  );

                  return categoryNames.join(" · ");
                })()
              : [
                  labelForCategory(item.category, t),
                  labelForColor(item.color, t),
                ]
                  .filter(Boolean)
                  .join(" · ")}
          </span>

          {typeof item.wear_count === "number" && (
            <span
              className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600"
              title={t("item.timesWorn", {
                count: item.wear_count,
                defaultValue: `Worn ${item.wear_count} times`,
              })}
            >
              {t("item.wearsCount", {
                count: item.wear_count,
                defaultValue: `${item.wear_count} wear${
                  item.wear_count === 1 ? "" : "s"
                }`,
              })}
            </span>
          )}
        </div>

        {/* COMPLETE LISTING */}
        {item.auto_listing_needs_completion && item.auto_listing_id && (
          <Link
            to={`/marketplace/listing/${item.auto_listing_id}/edit`}
            data-testid="closet-item-complete-listing-cta"
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[hsl(var(--accent))] transition-colors hover:opacity-80"
          >
            <Sparkles className="h-3.5 w-3.5" />

            {t("closet.completeListingCta", {
              defaultValue: "Complete listing",
            })}
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

/* -------------------- Save-all failures dialog (Phase Z4) -------------------- */
/**
 * One-shot warning surfaced on the Closet page when one or more
 * items from the most recent "Save all" batch couldn't be persisted
 * to the server. The optimistic ghosts have already been pulled
 * from ``closetStore`` by the reconciler; this dialog is the
 * acknowledgement step that tells the user *which* photos didn't
 * make it, with thumbnails so they recognise them at a glance.
 *
 * Closes on dismiss; the underlying ``lastSaveFailures`` array on
 * the store is then cleared. Idempotent — re-rendering with an
 * empty array no-ops.
 */
function SaveFailuresDialog({ failures, onDismiss }) {
  const { t } = useTranslation();
  const open = Array.isArray(failures) && failures.length > 0;
  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onDismiss();
      }}
    >
      <AlertDialogContent
        className="max-w-md"
        data-testid="closet-save-failures-dialog"
      >
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" aria-hidden />
            {t("closet.saveFailuresTitle", {
              count: failures.length,
              defaultValue:
                failures.length === 1
                  ? "1 photo didn't make it"
                  : `${failures.length} photos didn't make it`,
            })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("closet.saveFailuresBody", {
              defaultValue:
                "These items couldn\u2019t be saved to your closet. Please try uploading them again.",
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <ul
          className="max-h-72 overflow-y-auto -mx-2 px-2 space-y-2 py-1"
          data-testid="closet-save-failures-list"
        >
          {failures.map((f) => (
            <li
              key={f.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-card/50 p-2"
            >
              <div className="relative shrink-0 h-14 w-14 overflow-hidden rounded-md bg-muted">
                {f.thumbnail ? (
                  <img
                    src={f.thumbnail}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                    <AlertTriangle className="h-5 w-5" aria-hidden />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium" title={f.title}>
                  {f.title ||
                    t("closet.saveFailuresUnnamed", {
                      defaultValue: "Untitled item",
                    })}
                </div>
                {f.filename && (
                  <div
                    className="truncate text-[11px] text-muted-foreground"
                    title={f.filename}
                  >
                    {f.filename}
                  </div>
                )}
                {f.error && (
                  <div
                    className="truncate text-[11px] text-amber-600 dark:text-amber-400"
                    title={f.error}
                  >
                    {f.error}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>

        <AlertDialogFooter>
          <AlertDialogAction
            onClick={onDismiss}
            data-testid="closet-save-failures-dismiss"
          >
            {t("common.gotIt", { defaultValue: "Got it" })}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
