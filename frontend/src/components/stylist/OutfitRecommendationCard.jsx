import { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ImageOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { labelForRole } from '@/lib/taxonomy';
import { cn } from '@/lib/utils';
import { ShareOutfitButton } from '@/components/stylist/ShareOutfitButton';
import { useAuth } from '@/lib/auth';
import OutfitAvatarViewer from '@/components/OutfitAvatarViewer';
import { HarmonyBadge } from '@/components/stylist/HarmonyBadge';
import { closetStore } from '@/lib/closetStore';
import { bestImageUrl } from '@/lib/itemImage';
/**
 * Renders a single outfit recommendation. When recommendation items include
 * `closet_item_id`, we fetch and embed the item's image so the user sees
 * *proof* of the suggestion rather than just text.
 *
 * Image fetching is lazy and memoized per card instance to avoid hammering
 * the API when the chat thread re-renders.
 */
export function OutfitRecommendationCard({ rec, index, sessionId, onItemClick, onSave, draggable, onDragStart }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const items = (rec?.items || []).filter(Boolean);
  const ids = items
    .map((it) => it?.closet_item_id)
    .filter(Boolean);
  const [images, setImages] = useState({});
  // Map of closet_item_id → fetched item object (for color extraction)
  const [itemData, setItemData] = useState({});

  const outfitItemsMap = useMemo(() => {
    const map = {};
    items.forEach(it => {
      if (it && it.role) {
        map[it.role] = {
           id: it.closet_item_id,
           url: images[it.closet_item_id]
        };
      }
    });
    return map;
  }, [items, images]);

  useEffect(() => {
    let cancelled = false;
    const localItems = (closetStore.getItemsSnapshot() || []).filter(Boolean);
    const localMap = new Map(localItems.map(it => [it.id, it]));

    const fetchedImages = {};
    const fetchedData = {};
    const toFetch = [];

    for (const id of ids) {
      if (id in images) continue;
      const localItem = localMap.get(id);
      if (localItem) {
        fetchedImages[id] = bestImageUrl(localItem);
        fetchedData[id] = localItem;
      } else {
        toFetch.push(id);
      }
    }

    if (Object.keys(fetchedImages).length > 0 && !cancelled) {
      setImages((prev) => ({ ...prev, ...fetchedImages }));
      setItemData((prev) => ({ ...prev, ...fetchedData }));
    }

    if (toFetch.length === 0) return () => {};

    (async () => {
      const netImages = {};
      const netData = {};
      await Promise.all(
        toFetch.map(async (id) => {
          try {
            const item = await api.getItem(id);
            netImages[id] = bestImageUrl(item);
            netData[id] = item || null;
          } catch {
            netImages[id] = null;
            netData[id] = null;
          }
        }),
      );
      if (!cancelled) {
        setImages((prev) => ({ ...prev, ...netImages }));
        setItemData((prev) => ({ ...prev, ...netData }));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join('|')]);

  // Collect dominant colour of each item (colors[0] or color field)
  const outfitColors = useMemo(() => {
    return items
      .map((it) => {
        if (!it?.closet_item_id) return null;
        const data = itemData[it.closet_item_id];
        if (!data) return null;
        // WeightedTag: {name, pct} — take the first (highest-pct) entry
        const colorObj = Array.isArray(data.colors) && data.colors.length > 0
          ? data.colors[0]
          : null;
        const name = colorObj?.name || data.color || null;
        return name ? { name } : null;
      })
      .filter(Boolean);
  }, [items, itemData]);

  const withImages = items.filter((it) => images[it.closet_item_id]);
  const heroImage = withImages[0]
    ? images[withImages[0].closet_item_id]
    : null;

  if (!rec) return null;

  return (
    <div
      className={cn(
        "rounded-xl bg-[hsl(var(--accent))]/5 border border-[hsl(var(--accent))]/15 overflow-hidden shadow-sm transition-all duration-200",
        draggable ? "cursor-grab active:cursor-grabbing hover:shadow-md select-none" : ""
      )}
      data-testid={`outfit-recommendation-${index}`}
      draggable={draggable}
      onDragStart={onDragStart}
    >
      <OutfitAvatarViewer
         shapeParams={user?.avatar_shape_params || {}}
         sex={user?.sex || 'female'}
         outfitItemsMap={outfitItemsMap}
         onItemClick={onItemClick}
      />
      <div className="p-3 text-start">
        <div className="caps-label text-[hsl(var(--accent))] font-semibold">
          {t('stylist.outfitN', { n: index + 1 })}
        </div>
        <div className="font-display text-base mt-1 text-foreground">{rec.name}</div>
        {/* F1 — Colour Harmony Score Badge */}
        {outfitColors.length >= 2 && (
          <HarmonyBadge colors={outfitColors} />
        )}
        {rec.why ? <p className="text-xs mt-2.5 italic break-words text-muted-foreground/95">{rec.why}</p> : null}
        <div className="mt-4 flex items-center justify-between gap-2 pt-2 border-t border-[hsl(var(--accent))]/10">
          {onSave ? (
            <Button
              size="sm"
              onClick={() => onSave(rec)}
              className="rounded-xl text-xs font-semibold bg-brand text-brand-foreground hover:bg-brand/90 shadow-sm"
              data-testid={`outfit-recommendation-${index}-save-btn`}
            >
              {t('stylist.saveOutfit', { defaultValue: 'Save Outfit' })}
            </Button>
          ) : <div />}
          <ShareOutfitButton rec={rec} sessionId={sessionId} />
        </div>
      </div>
    </div>
  );
}
