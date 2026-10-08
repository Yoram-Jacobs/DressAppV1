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
        const itemObj = itemData[it.closet_item_id];
        map[it.role] = {
          id: it.closet_item_id,
          url: images[it.closet_item_id],
          placeholder: itemObj?.placeholder_data_url || null
        };
      }
    });
    return map;
  }, [items, images, itemData]);

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

    if (toFetch.length === 0) return () => { };

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
        'relative overflow-hidden bg-white rounded-[12px] border border-border shadow-sm hover:shadow-md',
        draggable && 'cursor-grab select-none active:cursor-grabbing'
      )}
      data-testid={`outfit-recommendation-${index}`}
      draggable={draggable}
      onDragStart={onDragStart}
    >
      <div className="relative">
        <OutfitAvatarViewer
          shapeParams={user?.avatar_shape_params || {}}
          sex={user?.sex || 'female'}
          outfitItemsMap={outfitItemsMap}
          onItemClick={onItemClick}
        />
      </div>
      <div className="p-5">
        <div className="text-[var(--primary-color)] font-extrabold text-sm leading-6 mb-[3px]">
          {t('stylist.outfitN', { n: index + 1 })}
        </div>
        <div className="font-display text-base font-semibold text-black">
          {rec.name}
        </div>
        {/* F1 — Colour Harmony Score Badge */}
        {outfitColors.length >= 2 && (
          <div className="mt-2">
            <HarmonyBadge colors={outfitColors} />
          </div>
        )}

        {/* Pieces in this Outfit — Thumbnails & Quick View */}
        {items.length > 0 && (
          <div className="mt-3">
            <div className="text-[12px] font-semibold text-muted-foreground mb-1.5 flex items-center justify-between">
              <span>{t('stylist.outfitPieces', { defaultValue: 'Outfit Pieces' })}</span>
              <span className="text-[10px] text-muted-foreground font-normal">{t('stylist.tapToInspect', { defaultValue: 'Tap to inspect' })}</span>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-thin">
              {items.map((it, idx) => {
                const itId = it.closet_item_id || it.id;
                const itObj = itemData[itId];
                const itImg = images[itId] || (itObj ? bestImageUrl(itObj) : null);
                const roleLabel = labelForRole(it.role, t);
                const itTitle = itObj?.title || itObj?.name || it.description || roleLabel;
                return (
                  <button
                    key={itId || `piece-${idx}`}
                    type="button"
                    onClick={() => itId && onItemClick?.(itId)}
                    disabled={!itId}
                    className="flex items-center gap-2 p-1.5 pe-2.5 rounded-lg border border-border bg-card hover:bg-accent/10 hover:border-primary-brand/40 transition-all text-start shrink-0 group focus:outline-none focus:ring-1 focus:ring-primary-brand"
                    title={itTitle}
                  >
                    <div className="w-10 h-10 rounded-md overflow-hidden bg-secondary/20 shrink-0 border border-border/50 flex items-center justify-center">
                      {itImg ? (
                        <img src={itImg} alt={itTitle} className="w-full h-full object-contain group-hover:scale-105 transition-transform" />
                      ) : (
                        <span className="text-[10px] text-muted-foreground font-semibold">{it.role?.[0]?.toUpperCase()}</span>
                      )}
                    </div>
                    <div className="min-w-0 max-w-[110px]">
                      <span className="block text-[10px] font-semibold text-primary-brand leading-tight uppercase truncate">
                        {roleLabel}
                      </span>
                      <span className="block text-xs font-medium text-foreground leading-tight truncate">
                        {itTitle}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {rec.designer_notes && (
          <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-[var(--primary-color)]">
              {t('stylist.designerNote', { defaultValue: 'Designer Note:' })}
            </span>
            <span>
              {(() => {
                const clean = (s) => (s && typeof s === 'string')
                  ? s.replace(/^\s*(?:60[-/:]30[-/:]10|70[-/:]20[-/:]10|1:2(?:\s*Ratio)?|\d+[-/:]\d+[-/:]\d+)\s*[-—:]*\s*/i, '').trim()
                  : '';
                if (typeof rec.designer_notes === 'string') {
                  return clean(rec.designer_notes);
                }
                return [
                  clean(rec.designer_notes.color_harmony),
                  clean(rec.designer_notes.texture_balance),
                  clean(rec.designer_notes.silhouette),
                ].filter(Boolean).join(' • ');
              })()}
            </span>
          </div>
        )}
        {rec.why ? (
          <p className="relative mt-2.5 text-xs leading-[22px] text-[var(--text-color)] border-l-2 border-[var(--primary-color)] p-[15px] italic font-semibold rounded-lg bg-[var(--accent-beige)] tracking-[0.5px]">
            {rec.why}
          </p>
        ) : null}
        <div className="flex items-center justify-between mt-[15px] flex-wrap gap-3">
          {onSave ? (
            <Button
              size="sm"
              onClick={() => onSave(rec)}
              className="rounded-full text-xs font-semibold !bg-[var(--primary-color)] text-white !shadow-none px-[15px] py-[5px] transition-[background-color,transform] duration-150 ease-in-out hover:!bg-[var(--dark-color)] hover:-translate-y-px"
              data-testid={`outfit-recommendation-${index}-save-btn`}
            >
              {t('stylist.saveOutfit', { defaultValue: 'Save Outfit' })}
            </Button>
          ) : (
            <div className="w-px" />
          )}
          <ShareOutfitButton rec={rec} sessionId={sessionId} />
        </div>
      </div>
    </div>
  );
}