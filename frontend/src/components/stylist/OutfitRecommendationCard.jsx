import { useEffect, useState } from 'react';
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
import { useMemo } from 'react';
/**
 * Renders a single outfit recommendation. When recommendation items include
 * `closet_item_id`, we fetch and embed the item's image so the user sees
 * *proof* of the suggestion rather than just text.
 *
 * Image fetching is lazy and memoized per card instance to avoid hammering
 * the API when the chat thread re-renders.
 */
export function OutfitRecommendationCard({ rec, index, sessionId, onItemClick, onSave }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const items = (rec?.items || []).filter(Boolean);
  const ids = items
    .map((it) => it?.closet_item_id)
    .filter(Boolean);
  const [images, setImages] = useState({});

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
    const toFetch = ids.filter((id) => !(id in images));
    if (toFetch.length === 0) return () => {};
    (async () => {
      const fetched = {};
      await Promise.all(
        toFetch.map(async (id) => {
          try {
            const item = await api.getItem(id);
            fetched[id] =
              item?.reconstructed_image_url ||
              item?.segmented_image_url ||
              item?.image_url ||
              null;
          } catch {
            fetched[id] = null;
          }
        }),
      );
      if (!cancelled) setImages((prev) => ({ ...prev, ...fetched }));
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join('|')]);

  const withImages = items.filter((it) => images[it.closet_item_id]);
  const heroImage = withImages[0]
    ? images[withImages[0].closet_item_id]
    : null;

  if (!rec) return null;

  return (
    <div
      className="rounded-xl bg-[hsl(var(--accent))]/5 border border-[hsl(var(--accent))]/15 overflow-hidden shadow-sm"
      data-testid={`outfit-recommendation-${index}`}
    >
      <OutfitAvatarViewer
         shapeParams={user?.avatar_shape_params || {}}
         sex={user?.sex || 'female'}
         outfitItemsMap={outfitItemsMap}
         onItemClick={onItemClick}
      />
      <div className="p-3 text-left">
        <div className="caps-label text-[hsl(var(--accent))] font-semibold">
          {t('stylist.outfitN', { n: index + 1 })}
        </div>
        <div className="font-display text-base mt-1 text-foreground">{rec.name}</div>
        

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
