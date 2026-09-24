import { useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Sparkles,
  ShoppingBag,
  X,
  Loader2,
  ExternalLink,
  Volume2,
  VolumeX,
  CloudSun,
  ArrowUp,
  ArrowDown,
  User,
  BookmarkPlus,
  Check,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { api, outfits } from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { isTTSSupported, speak, cancelSpeak } from "@/lib/speech";
import { ItemFloater } from "@/components/stylist/ItemFloater";
import { bestImageUrl } from "@/lib/itemImage";
import { closetStore } from "@/lib/closetStore";
import AvatarViewer from "@/components/AvatarViewer";
import { prewarmOutfits } from "@/lib/useOutfitStore";

/**
 * Outfit Completion bottom sheet.
 *
 * Given 1..N anchor items selected in the closet, fetches complementary
 * pieces (ranked by FashionCLIP similarity + category diversity) and
 * renders them alongside a Stylist-generated rationale. Optionally
 * extends the search to active marketplace listings.
 */
function ItemThumb({
  item,
  showScore = false,
  scoreLabel = null,
  linkTo = null,
  onClick = null,
}) {
  const src = bestImageUrl(item);
  const title = item?.title || item?.name || item?.category || "Item";
  const cat = item?.category;
  const inner = (
    <div className="group">
      <div className="aspect-square rounded-tl-[12px] rounded-tr-[12px] overflow-hidden bg-accent-beige relative">
        {src ? (
          <img
            src={src}
            alt={title}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-muted-foreground text-xs">
            {cat || "—"}
          </div>
        )}
        {showScore && scoreLabel != null && (
          <Badge
            variant="secondary"
            className="absolute top-2 end-2 text-[10px] bg-background/90 backdrop-blur"
          >
            {scoreLabel}
          </Badge>
        )}
      </div>
      <div className="p-2">
        <h6 className="text-[12px] text-dark-brand font-bold truncate">{title}</h6>
        {cat && (
          <p className="text-[12px] text-text-brand font-semibold">{cat}</p>
        )}
      </div>
    </div>
  );
  // Phase S3: onClick wins over linkTo so we can open the floater
  // instead of hard-navigating. Marketplace items keep linkTo so they
  // still navigate (the floater only knows about closet items).
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="block text-start w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--accent))] rounded-xl"
        data-testid={`item-thumb-button-${item?.id || "unknown"}`}
      >
        {inner}
      </button>
    );
  }
  if (linkTo) {
    return (
      <Link to={linkTo} className="block">
        {inner}
      </Link>
    );
  }
  return inner;
}

const normCat = (cat) => {
  const s = String(cat || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (
    [
      "top", "tops", "shirt", "shirts", "t_shirt", "tshirt", "tshirts",
      "polo", "sweater", "sweaters", "blouse", "blouses", "hoodie",
      "tank", "tank_top", "tanktop", "crop_top", "sweatshirt",
      "cardigan", "knitwear", "topwear"
    ].includes(s)
  ) return "top";
  if (
    [
      "bottom", "bottoms", "pants", "shorts", "jeans", "skirt", "skirts",
      "trousers", "joggers", "leggings", "sweatpants", "chinos", "slacks",
      "bottomwear"
    ].includes(s)
  ) return "bottom";
  if (
    [
      "footwear", "shoes", "shoe", "sneakers", "sneaker", "boots", "boot",
      "sandals", "sandal", "heels", "heel", "loafers", "loafer", "slides",
      "slippers", "flats"
    ].includes(s)
  ) return "shoes";
  if (
    [
      "dress", "dresses", "jumpsuit", "jumpsuits", "suit", "suits", "overall",
      "overalls", "full_body", "full_body_suit", "romper", "gown"
    ].includes(s)
  ) return "dress";
  if (
    [
      "outerwear", "jacket", "jackets", "coat", "coats", "blazer", "blazers",
      "parka", "overcoat", "vest"
    ].includes(s)
  ) return "outerwear";
  return "accessory";
};

export function OutfitCompletionSheet({
  open,
  onOpenChange,
  anchorIds = [],
  anchorsHint = [],
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [includeMarketplace, setIncludeMarketplace] = useState(false);
  const [occasion, setOccasion] = useState("");
  const [speaking, setSpeaking] = useState(false);
  // Phase S3: ItemFloater state for closet thumbnails inside this sheet.
  const [floaterItemId, setFloaterItemId] = useState(null);
  // Order-aware anchor list (1st = highest centroid weight server-side).
  // Seeded from anchorsHint each time the sheet opens so the user can
  // reshuffle priority without leaving Closet.
  const [orderedAnchors, setOrderedAnchors] = useState([]);

  const allClosetItems = (closetStore.getSnapshot().items || []).filter(
    Boolean,
  );
  const getGroupItems = (item) => {
    if (!item || !item.group_id) return [item];
    return allClosetItems.filter((it) => it && it.group_id === item.group_id);
  };
  const isSet = (item) => {
    if (!item) return false;
    const gItems = getGroupItems(item);
    if (gItems.length <= 1) return false;
    const categories = new Set(gItems.map((it) => normCat(it.category)));
    return categories.size > 1;
  };

  const ttsSupported = isTTSSupported();
  const userLang = (user?.preferred_language || "en").toLowerCase();

  // Re-seed the order every time the caller passes a new anchor set.
  // We key off the joined ids so drifting React re-renders don't wipe
  // the user's manual reorder while the sheet stays open.
  useEffect(() => {
    if (!open) return;
    const hintIds = anchorsHint.map((a) => a.id).join("|");
    const currentIds = orderedAnchors.map((a) => a.id).join("|");
    if (hintIds !== currentIds) {
      setOrderedAnchors(anchorsHint);
      setResult(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, anchorsHint]);

  const moveAnchor = (idx, dir) => {
    setOrderedAnchors((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const runCompletion = async () => {
    const ids = orderedAnchors.length
      ? orderedAnchors.map((a) => a.id)
      : anchorIds;
    if (!ids.length) return;
    setLoading(true);
    setResult(null);
    try {
      const data = await api.completeOutfit({
        itemIds: ids,
        includeMarketplace,
        occasion: occasion.trim() || null,
        limit: 6,
      });
      setResult(data);
      if (
        !data.rationale &&
        !data.closet_suggestions?.length &&
        !data.market_suggestions?.length
      ) {
        toast.message(t("outfitCompletion.empty"));
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || t("outfitCompletion.error"));
    } finally {
      setLoading(false);
    }
  };

  const toggleSpeak = () => {
    if (!ttsSupported || !result) return;
    const textToSpeak = result.spoken_reply || result.rationale;
    if (!textToSpeak) return;
    if (speaking) {
      cancelSpeak();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    speak(textToSpeak, userLang, {
      onEnd: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });
  };

  const [avatarTryOnOutfit, setAvatarTryOnOutfit] = useState(null);
  const [savingOutfitTarget, setSavingOutfitTarget] = useState(null);
  const [saveNameInput, setSaveNameInput] = useState("");
  const [saveDescInput, setSaveDescInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [savedOutfitNames, setSavedOutfitNames] = useState(() => new Set());

  const buildOutfitPiecesMap = (rec) => {
    if (!rec) return { map: {}, resolvedGarments: [] };
    const map = {};
    const resolvedGarments = [];
    const anchors = result?.anchors || orderedAnchors || [];
    const suggestions = result?.closet_suggestions || [];
    const pool = [...anchors, ...suggestions, ...allClosetItems];

    const findItem = (cid, role, desc) => {
      if (cid) {
        const match = pool.find((p) => p && (p.id === cid || p._id === cid));
        if (match) return match;
      }
      if (desc) {
        const descLower = desc.toLowerCase().trim();
        const match = pool.find((p) => {
          const title = (p.title || p.name || "").toLowerCase().trim();
          return title && (descLower.includes(title) || title.includes(descLower));
        });
        if (match) return match;
      }
      if (role) {
        const targetNorm = normCat(role);
        const match = pool.find((p) => {
          return p && normCat(p.category) === targetNorm;
        });
        if (match) return match;
      }
      return null;
    };

    // 1. Explicitly items in rec.items
    (rec.items || []).forEach((it) => {
      const matched = findItem(it.closet_item_id, it.role, it.description || it.title);
      const roleKey = normCat(it.role || matched?.category || "accessory");
      const img = matched
        ? (bestImageUrl(matched) || matched.clean_image_url || matched.image_url || matched.thumbnail_data_url)
        : null;
      const itemData = {
        id: matched?.id || it.closet_item_id || null,
        closet_item_id: matched?.id || it.closet_item_id || null,
        role: roleKey,
        title: matched?.title || matched?.name || it.description || it.role,
        image_url: img,
        category: matched?.category || it.role,
      };
      map[roleKey] = itemData;
      resolvedGarments.push(itemData);
    });

    // 2. Ensure all anchors are included in the outfit map
    anchors.forEach((a) => {
      const roleKey = normCat(a.category || "item");
      if (!map[roleKey]) {
        const img = bestImageUrl(a) || a.clean_image_url || a.image_url || a.thumbnail_data_url;
        const itemData = {
          id: a.id,
          closet_item_id: a.id,
          role: roleKey,
          title: a.title || a.name,
          image_url: img,
          category: a.category,
        };
        map[roleKey] = itemData;
        resolvedGarments.push(itemData);
      }
    });

    return { map, resolvedGarments };
  };

  const handleTryOnAvatar = (rec) => {
    const { map, resolvedGarments } = buildOutfitPiecesMap(rec);
    setAvatarTryOnOutfit({
      ...rec,
      resolvedGarments,
      piecesMap: map,
    });
  };

  const openSaveDialog = (rec) => {
    const { resolvedGarments } = buildOutfitPiecesMap(rec);
    setSavingOutfitTarget({
      ...rec,
      resolvedGarments,
    });
    setSaveNameInput(rec.name || t("outfitCompletion.outfitName", { defaultValue: "My Stylish Look" }));
    setSaveDescInput(rec.why || result?.rationale || occasion || "");
  };

  const executeSaveOutfit = async () => {
    if (!savingOutfitTarget || !saveNameInput.trim()) return;
    setIsSaving(true);
    try {
      const garmentsToSave = (savingOutfitTarget.resolvedGarments || []).map((g) => ({
        closet_item_id: g.closet_item_id || g.id,
        role: g.role || "item",
        title: g.title || g.name,
        image_url: g.image_url || null,
      }));

      const payload = {
        name: saveNameInput.trim(),
        description: saveDescInput.trim() || null,
        source_workflow: "complete_outfit",
        prompt: occasion.trim() || null,
        garments: garmentsToSave,
        usage: {
          date: new Date().toISOString().split("T")[0],
          time: "12:00",
          event_name: saveNameInput.trim(),
        },
      };

      const saveFn = api.saveOutfit || api.outfits?.saveOutfit || outfits?.saveOutfit;
      if (!saveFn) {
        throw new Error("Save outfit API function not found");
      }
      await saveFn(payload);
      setSavedOutfitNames((prev) => new Set([...prev, savingOutfitTarget.name, saveNameInput.trim()]));
      // Trigger store prewarm so Outfit Canvas updates immediately
      prewarmOutfits({ force: true }).catch(() => {});
      toast.success(
        t("outfitCompletion.savedSuccess", {
          name: saveNameInput.trim(),
          defaultValue: `Outfit "${saveNameInput.trim()}" saved to your Outfit Canvas!`,
        })
      );
      setSavingOutfitTarget(null);
    } catch (err) {
      toast.error(err?.response?.data?.detail || err?.message || t("common.error", { defaultValue: "Failed to save outfit." }));
    } finally {
      setIsSaving(false);
    }
  };

  const constructingClosetItems = useMemo(() => {
    if (!result) return [];
    const recs = result.outfit_recommendations || result.recommendations || [];
    if (recs.length === 0) return result.closet_suggestions || [];

    const anchorIds = new Set((result?.anchors || orderedAnchors || []).map((a) => a.id));
    const usedIds = new Set();
    const usedText = new Set();

    recs.forEach((rec) => {
      const { resolvedGarments } = buildOutfitPiecesMap(rec);
      resolvedGarments.forEach((g) => {
        if (g.closet_item_id && !anchorIds.has(g.closet_item_id)) {
          usedIds.add(g.closet_item_id);
        }
      });
      (rec.items || []).forEach((it) => {
        if (it.closet_item_id && !anchorIds.has(it.closet_item_id)) usedIds.add(it.closet_item_id);
        if (it.id && !anchorIds.has(it.id)) usedIds.add(it.id);
        if (it.description) usedText.add(it.description.toLowerCase().trim());
        if (it.title) usedText.add(it.title.toLowerCase().trim());
        if (it.name) usedText.add(it.name.toLowerCase().trim());
      });
    });

    const pool = [...(result.closet_suggestions || []), ...allClosetItems];
    const items = [];
    const seen = new Set();

    for (const item of pool) {
      if (!item || !item.id || seen.has(item.id) || anchorIds.has(item.id)) continue;
      const titleLower = (item.title || item.name || "").toLowerCase().trim();
      const isIdUsed = usedIds.has(item.id) || usedIds.has(item._id);
      const isTextUsed =
        usedText.has(titleLower) ||
        Array.from(usedText).some(
          (t) => t.includes(titleLower) || titleLower.includes(t)
        );

      if (isIdUsed || isTextUsed) {
        seen.add(item.id);
        items.push(item);
      }
    }
    return items;
  }, [result, allClosetItems, orderedAnchors]);

  const constructingMarketItems = useMemo(() => {
    if (!result || !result.market_suggestions?.length) return [];
    const recs = result.outfit_recommendations || result.recommendations || [];
    if (recs.length === 0) return result.market_suggestions;

    const usedText = new Set();
    recs.forEach((rec) => {
      (rec.items || []).forEach((it) => {
        if (it.description) usedText.add(it.description.toLowerCase().trim());
        if (it.title) usedText.add(it.title.toLowerCase().trim());
      });
    });

    return result.market_suggestions.filter((m) => {
      const titleLower = (m.title || m.name || "").toLowerCase().trim();
      return Array.from(usedText).some(
        (t) => t.includes(titleLower) || titleLower.includes(t)
      );
    });
  }, [result]);

  const handleOpenChange = (next) => {
    if (!next) {
      cancelSpeak();
      setSpeaking(false);
    }
    onOpenChange?.(next);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-xl lg:max-w-2xl p-0 flex flex-col"
          data-testid="outfit-completion-sheet"
        >
          <SheetHeader className="p-5 border-b border-border">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary-brand" />
              <SheetTitle>{t("outfitCompletion.title")}</SheetTitle>
            </div>
            <SheetDescription>
              {t("outfitCompletion.subtitle", { count: anchorIds.length })}
            </SheetDescription>
          </SheetHeader>
          <div className="p-5 space-y-5 max-h-[80vh] overflow-y-auto">
            {/* Anchors preview (order-aware — first anchor has highest weight) */}
            {orderedAnchors.length > 0 && (
              <>
                <div className="flex items-baseline justify-between mb-2">
                  <div className="text-[12px] font-semibold text-text-brand">
                    {t("outfitCompletion.anchorsLabel")}
                  </div>
                  {orderedAnchors.length > 1 && (
                    <div className="text-[12px] text-text-brand font-semibold italic">
                      {t("outfitCompletion.priorityHint")}
                    </div>
                  )}
                </div>
                <div
                  className="grid grid-cols-3 sm:grid-cols-4 gap-3"
                  data-testid="outfit-completion-anchor-grid"
                >
                  {orderedAnchors.map((a, idx) => {
                    const itemIsSet = isSet(a);
                    return (
                      <div key={a.id} className="relative flex flex-col border-dashed border border-accent-beige rounded-[12px]">
                        <ItemThumb item={a} />
                        {/* Priority pill */}
                        <div
                          className="absolute top-2 start-2 h-5 min-w-[20px] px-1.5 rounded-full bg-primary-brand text-white text-[10px] font-semibold flex items-center justify-center"
                          aria-label={t("outfitCompletion.priorityLabel", {
                            n: idx + 1,
                          })}
                          data-testid={`outfit-completion-anchor-priority-${idx}`}
                        >
                          {idx + 1}
                        </div>
                        {/* Remove button */}
                        <button
                          type="button"
                          onClick={() => {
                            setOrderedAnchors((prev) =>
                              prev.filter((_, i) => i !== idx),
                            );
                          }}
                          aria-label={t("common.remove", {
                            defaultValue: "Remove",
                          })}
                          className="absolute -top-1.5 -end-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-sm z-30"
                          data-testid={`outfit-completion-anchor-remove-${idx}`}
                        >
                          <X className="h-3 w-3" strokeWidth={3} />
                        </button>
                        {/* Reorder controls (only when >1 anchors) */}
                        {orderedAnchors.length > 1 && (
                          <div className="absolute top-2 end-2 flex flex-col gap-1">
                            <button
                              type="button"
                              onClick={() => moveAnchor(idx, -1)}
                              disabled={idx === 0}
                              aria-label={t("outfitCompletion.moveUp")}
                              data-testid={`outfit-completion-anchor-up-${idx}`}
                              className="h-6 w-6 rounded-full bg-white border border-border backdrop-blur flex items-center justify-center disabled:opacity-40 hover:bg-secondary transition-colors"
                            >
                              <ArrowUp className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveAnchor(idx, 1)}
                              disabled={idx === orderedAnchors.length - 1}
                              aria-label={t("outfitCompletion.moveDown")}
                              data-testid={`outfit-completion-anchor-down-${idx}`}
                              className="h-6 w-6 rounded-full bg-white border border-border backdrop-blur flex items-center justify-center disabled:opacity-40 hover:bg-secondary transition-colors"
                            >
                              <ArrowDown className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                        {/* Divide set button */}
                        {itemIsSet && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            onClick={() => {
                              const gItems = getGroupItems(a);
                              setOrderedAnchors((prev) => {
                                const next = [...prev];
                                const existingIds = new Set(
                                  next
                                    .filter((item) => item && item.id !== a.id)
                                    .map((item) => item.id),
                                );
                                const uniqueGItems = gItems.filter(
                                  (item) => item && !existingIds.has(item.id),
                                );
                                next.splice(idx, 1, ...uniqueGItems);
                                return next;
                              });
                            }}
                            className="mt-1.5 w-full h-6 text-[10px] uppercase font-semibold text-[hsl(var(--accent))] hover:bg-[hsl(var(--accent))]/10 border border-[hsl(var(--accent))]/25 rounded-md flex items-center justify-center gap-1 shrink-0"
                            data-testid={`outfit-completion-anchor-divide-${idx}`}
                          >
                            <Sparkles className="h-2.5 w-2.5" />
                            {t("closet.divideSet", {
                              defaultValue: "Divide Set",
                            })}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
            {/* Controls */}
            <div className="rounded-[12px] border border-border bg-primary-shadow p-3 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <label
                  htmlFor="oc-marketplace"
                  className="text-[14px] inline-flex items-center gap-2 cursor-pointer text-text-brand font-semibold"
                >
                  <ShoppingBag className="h-4 w-4 text-primary-brand" />
                  {t("outfitCompletion.includeMarketplace")}
                </label>
                <Switch
                  id="oc-marketplace"
                  checked={includeMarketplace}
                  onCheckedChange={setIncludeMarketplace}
                  data-testid="outfit-completion-marketplace-switch"
                />
              </div>
              <Input
                value={occasion}
                onChange={(e) => setOccasion(e.target.value)}
                placeholder={t("outfitCompletion.occasionPlaceholder")}
                data-testid="outfit-completion-occasion-input"
              />
              <Button
                onClick={runCompletion}
                disabled={loading || anchorIds.length === 0}
                className="w-full"
                data-testid="outfit-completion-run-button"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 me-2 animate-spin" />
                    {t("outfitCompletion.thinking")}
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    {t("outfitCompletion.cta")}
                  </>
                )}
              </Button>
            </div>
            {loading && (
              <div
                className="space-y-3"
                data-testid="outfit-completion-loading"
              >
                <div className="h-4 rounded shimmer w-3/4" />
                <div className="h-4 rounded shimmer w-1/2" />
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={`skeleton-${i}`}
                      className="aspect-square rounded-xl shimmer"
                    />
                  ))}
                </div>
              </div>
            )}
            {result && !loading && (
              <div className="space-y-5" data-testid="outfit-completion-result">
                {result.weather_summary && (
                  <div
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-3 py-1.5 text-xs"
                    data-testid="outfit-completion-weather-badge"
                  >
                    <CloudSun className="h-3.5 w-3.5 text-[hsl(var(--accent))]" />
                    <span className="caps-label text-muted-foreground">
                      {t("stylist.weatherAware")}
                    </span>
                    <span className="font-medium">
                      {result.weather_summary}
                    </span>
                  </div>
                )}
                {/* Rationale */}
                {result.rationale && (
                  <div className="rounded-2xl border border-border bg-card p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="caps-label text-[hsl(var(--accent))]">
                        {t("outfitCompletion.rationaleLabel")}
                      </div>
                      {ttsSupported && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={toggleSpeak}
                          className="h-7 rounded-full"
                          data-testid="outfit-completion-speak-button"
                          aria-label={
                            speaking
                              ? t("stylist.stopSpeaking")
                              : t("stylist.playReply")
                          }
                        >
                          {speaking ? (
                            <VolumeX className="h-3.5 w-3.5" />
                          ) : (
                            <Volume2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      )}
                    </div>
                    <p className="text-sm whitespace-pre-wrap">
                      {result.rationale}
                    </p>
                    {result.do_dont?.length > 0 && (
                      <ul className="text-xs text-muted-foreground list-disc ps-5 mt-3 space-y-0.5">
                        {result.do_dont.map((d, i) => (
                          <li key={`dd-${i}-${String(d).slice(0, 24)}`}>{d}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {/* Outfit recommendations from the stylist */}
                {result.outfit_recommendations?.length > 0 && (
                  <div className="space-y-3">
                    {result.outfit_recommendations.map((rec, i) => (
                      <div
                        key={rec.id || `rec-${i}-${rec.name || "outfit"}`}
                        className="rounded-2xl border border-border bg-secondary/60 p-4"
                      >
                        <div className="caps-label text-[hsl(var(--accent))]">
                          {t("stylist.outfitN", { n: i + 1 })}
                        </div>
                        <div className="font-display text-base mt-1">
                          {rec.name}
                        </div>
                        <ul className="text-xs text-muted-foreground list-disc ps-5 mt-2 space-y-1">
                          {(rec.items || []).map((it, j) => {
                            const canonicalSlot = normCat(it.role || it.category);
                            const roleLabel = t(`taxonomy.categories.${canonicalSlot}`, {
                              defaultValue: it.role || "item",
                            });
                            return (
                              <li
                                key={`${rec.id || i}-item-${j}-${it.role || ""}`}
                              >
                                <span className="font-semibold text-foreground/90 capitalize me-1.5 inline-block">
                                  [{roleLabel}]:
                                </span>
                                <span>{it.description || it.title || it.role}</span>
                              </li>
                            );
                          })}
                        </ul>
                        {rec.why && (
                          <p className="text-xs mt-2 italic">{rec.why}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-border/50">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleTryOnAvatar(rec)}
                            className="rounded-xl text-xs font-semibold gap-1.5 h-8 bg-background/80 hover:bg-background"
                            data-testid={`outfit-try-on-${i}`}
                          >
                            <User className="h-3.5 w-3.5 text-primary-brand" />
                            <span>{t("outfitCompletion.tryOnAvatar", { defaultValue: "Try on avatar" })}</span>
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => openSaveDialog(rec)}
                            disabled={savedOutfitNames.has(rec.name)}
                            className="rounded-xl text-xs font-semibold gap-1.5 h-8"
                            data-testid={`outfit-save-${i}`}
                          >
                            {savedOutfitNames.has(rec.name) ? (
                              <>
                                <Check className="h-3.5 w-3.5 text-green-500" />
                                <span>{t("outfits.saved", { defaultValue: "Saved" })}</span>
                              </>
                            ) : (
                              <>
                                <BookmarkPlus className="h-3.5 w-3.5" />
                                <span>{t("outfitCompletion.saveOutfit", { defaultValue: "Save the Outfit" })}</span>
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Closet suggestions - only pieces constructing the outfit */}
                {constructingClosetItems.length > 0 ? (
                  <div>
                    <div className="caps-label text-muted-foreground mb-2">
                      {t("outfitCompletion.fromClosetLabel")}
                    </div>
                    <div
                      className="grid grid-cols-3 sm:grid-cols-4 gap-3"
                      data-testid="outfit-completion-closet-grid"
                    >
                      {constructingClosetItems.map((s) => (
                        <ItemThumb
                          key={s.id}
                          item={s}
                          showScore
                          scoreLabel={`${Math.round((s._score || 0.69) * 100)}%`}
                          onClick={() => setFloaterItemId(s.id)}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground italic">
                    {t("outfitCompletion.noClosetSuggestions")}
                  </div>
                )}

                {/* Marketplace suggestions - only pieces constructing the outfit */}
                {constructingMarketItems.length > 0 && (
                  <div>
                    <div className="caps-label text-muted-foreground mb-2 inline-flex items-center gap-1.5">
                      <ShoppingBag className="h-3.5 w-3.5" />
                      {t("outfitCompletion.fromMarketplaceLabel")}
                    </div>
                    <div
                      className="grid grid-cols-3 sm:grid-cols-4 gap-3"
                      data-testid="outfit-completion-marketplace-grid"
                    >
                      {constructingMarketItems.map((lg) => (
                        <ItemThumb
                          key={lg.id}
                          item={{
                            ...lg,
                            original_image_url: (lg.images || [])[0] || null,
                          }}
                          showScore
                          scoreLabel={`${Math.round((lg._score || 0.69) * 100)}%`}
                          linkTo={`/marketplace/${lg.id}`}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {!result.has_embeddings && (
                  <div
                    className="rounded-xl border border-dashed border-border bg-secondary/30 p-3 text-xs text-muted-foreground"
                    data-testid="outfit-completion-no-embeddings-hint"
                  >
                    <ExternalLink className="h-3.5 w-3.5 inline me-1" />
                    {t("outfitCompletion.embeddingsMissingHint")}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 p-5 border-t border-border">
            <Button
              onClick={() => handleOpenChange(false)}
              data-testid="outfit-completion-close-button"
            >
              <X className="h-4 w-4" />
              {t("common.close")}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
      {/* Phase S3: item floater renders via portal — sits over the
          completion sheet so users can preview a closet match without
          leaving the rationale view. */}
      <ItemFloater
        itemId={floaterItemId}
        onClose={() => setFloaterItemId(null)}
      />

      {/* Try-on Avatar Dialog */}
      <Dialog open={!!avatarTryOnOutfit} onOpenChange={(open) => !open && setAvatarTryOnOutfit(null)}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto p-5 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-dark-brand flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary-brand" />
              {avatarTryOnOutfit?.name || t("outfitCompletion.tryOnAvatar", { defaultValue: "Try on avatar" })}
            </DialogTitle>
            {avatarTryOnOutfit?.why && (
              <DialogDescription className="text-xs text-muted-foreground italic">
                {avatarTryOnOutfit.why}
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="relative w-full aspect-[4/5] bg-[#eae6df] rounded-2xl overflow-hidden shadow-inner my-2 flex items-center justify-center">
            <AvatarViewer
              shapeParams={user?.avatar_shape_params || {}}
              sex={user?.sex || "female"}
              outfitItems={avatarTryOnOutfit?.piecesMap || {}}
            />
          </div>

          {/* Included pieces */}
          <div className="space-y-2 mt-2">
            <div className="caps-label text-xs text-muted-foreground">
              {t("outfitCompletion.includedPieces", { defaultValue: "Included pieces" })}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {avatarTryOnOutfit?.resolvedGarments?.map((g, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs py-1 px-2.5 rounded-full font-medium">
                  <span className="capitalize text-muted-foreground me-1">
                    [{t(`taxonomy.categories.${(g.role || '').toLowerCase()}`, { defaultValue: g.role })}]:
                  </span>{" "}
                  {g.title || g.name}
                </Badge>
              ))}
            </div>
          </div>

          <DialogFooter className="mt-4 flex sm:justify-between items-center gap-2">
            <Button variant="outline" onClick={() => setAvatarTryOnOutfit(null)}>
              {t("common.close", { defaultValue: "Close" })}
            </Button>
            <Button
              onClick={() => openSaveDialog(avatarTryOnOutfit)}
              disabled={savedOutfitNames.has(avatarTryOnOutfit?.name)}
              className="gap-2 font-bold"
            >
              {savedOutfitNames.has(avatarTryOnOutfit?.name) ? (
                <>
                  <Check className="h-4 w-4 text-green-500" />
                  {t("outfits.saved", { defaultValue: "Saved" })}
                </>
              ) : (
                <>
                  <BookmarkPlus className="h-4 w-4" />
                  {t("outfitCompletion.saveOutfit", { defaultValue: "Save the Outfit" })}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save Outfit Dialog */}
      <Dialog open={!!savingOutfitTarget} onOpenChange={(open) => !open && setSavingOutfitTarget(null)}>
        <DialogContent className="sm:max-w-md p-5 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <BookmarkPlus className="h-5 w-5 text-primary-brand" />
              {t("outfitCompletion.saveOutfitTitle", { defaultValue: "Save Outfit" })}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {t("outfitCompletion.saveOutfitDesc", { defaultValue: "Save this recommended look with a descriptive name to access it anytime in your Outfit Canvas." })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                {t("outfitCompletion.outfitName", { defaultValue: "Outfit Name" })}
              </label>
              <Input
                value={saveNameInput}
                onChange={(e) => setSaveNameInput(e.target.value)}
                placeholder={t("outfitCompletion.outfitName", { defaultValue: "Outfit Name" })}
                className="rounded-xl font-medium"
                data-testid="save-outfit-name-input"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                {t("outfitCompletion.notes", { defaultValue: "Stylist Notes / Occasion" })}
              </label>
              <Input
                value={saveDescInput}
                onChange={(e) => setSaveDescInput(e.target.value)}
                placeholder={t("outfitCompletion.notes", { defaultValue: "Stylist Notes / Occasion" })}
                className="rounded-xl text-xs"
                data-testid="save-outfit-desc-input"
              />
            </div>
            {savingOutfitTarget?.resolvedGarments?.length > 0 && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  {t("outfitCompletion.includedPieces", { defaultValue: "Included pieces" })} ({savingOutfitTarget.resolvedGarments.length})
                </label>
                <div className="flex flex-wrap gap-1">
                  {savingOutfitTarget.resolvedGarments.map((g, idx) => (
                    <Badge key={idx} variant="outline" className="text-[11px] py-0.5 px-2">
                      {g.title || g.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex sm:justify-end gap-2">
            <Button variant="ghost" onClick={() => setSavingOutfitTarget(null)}>
              {t("common.cancel", { defaultValue: "Cancel" })}
            </Button>
            <Button
              onClick={executeSaveOutfit}
              disabled={!saveNameInput.trim() || isSaving}
              className="font-bold gap-2"
              data-testid="save-outfit-confirm-button"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookmarkPlus className="h-4 w-4" />}
              {t("common.save", { defaultValue: "Save" })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default OutfitCompletionSheet;
