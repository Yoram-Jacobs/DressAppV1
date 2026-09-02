import { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import html2canvas from 'html2canvas';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { closetStore } from '@/lib/closetStore';
import { bestImageUrl } from '@/lib/itemImage';
import OutfitAvatarViewer from '@/components/OutfitAvatarViewer';
import {
  Loader2,
  Copy,
  Download,
  Share2,
  Send,
  Sparkles,
  Check,
  Instagram,
} from 'lucide-react';

export default function ShareOutfitModal({ open, onOpenChange, outfit, sessionId }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const cardRef = useRef(null);

  const [shareUrl, setShareUrl] = useState('');
  const [shareId, setShareId] = useState('');
  const [minting, setMinting] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [copied, setCopied] = useState(false);
  const [images, setImages] = useState({});

  const items = useMemo(() => {
    // Standardize garments format between recommendation items and saved outfits
    return (outfit?.items || outfit?.garments || []).filter(Boolean);
  }, [outfit]);

  const ids = useMemo(() => {
    return items.map((it) => it.closet_item_id || it.id).filter(Boolean);
  }, [items]);

  // Fetch garment images on mount so they are loaded and ready for rendering
  useEffect(() => {
    let cancelled = false;
    if (ids.length === 0) return () => {};

    const localItems = (closetStore.getItemsSnapshot() || []).filter(Boolean);
    const localMap = new Map(localItems.map(it => [it.id, it]));

    const fetchedImages = {};
    const toFetch = [];

    for (const id of ids) {
      if (id in images) continue;
      const localItem = localMap.get(id);
      if (localItem) {
        fetchedImages[id] = bestImageUrl(localItem);
      } else {
        toFetch.push(id);
      }
    }

    if (Object.keys(fetchedImages).length > 0 && !cancelled) {
      setImages((prev) => ({ ...prev, ...fetchedImages }));
    }

    if (toFetch.length === 0) return () => {};

    (async () => {
      const netImages = {};
      await Promise.all(
        toFetch.map(async (id) => {
          try {
            const item = await api.getItem(id);
            netImages[id] = bestImageUrl(item);
          } catch {
            netImages[id] = null;
          }
        })
      );
      if (!cancelled) {
        setImages((prev) => ({ ...prev, ...netImages }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ids]);

  const outfitItemsMap = useMemo(() => {
    const map = {};
    items.forEach((it) => {
      const id = it.closet_item_id || it.id;
      if (it.role && id) {
        map[it.role] = {
          id,
          url: images[id] || it.image_url,
        };
      }
    });
    return map;
  }, [items, images]);

  // Mint a public shared link on mount / open
  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        setMinting(true);
        const snapshot = await api.createSharedOutfit({
          session_id: sessionId || null,
          outfit: {
            name: outfit.name || 'Suggested Outfit',
            why: outfit.why || outfit.description || '',
            items: items.map((it) => {
              const id = it.closet_item_id || it.id;
              // Look up candidate color if available
              const candidate = (outfit?.candidates || []).find(
                (c) => c.candidate_id === id || c.closet_item_id === id
              );
              return {
                closet_item_id: id,
                role: it.role,
                description: it.description || it.title || '',
                color: it.color || candidate?.color || candidate?.color_name || null,
                image_url: images[id] || it.image_url || null,
              };
            }),
          },
        });
        const url = snapshot?.share_url || `${window.location.origin}/shared/${snapshot.id}`;
        setShareUrl(url);
        setShareId(snapshot.id);
      } catch (err) {
        console.error('Failed to create shared outfit:', err);
        toast.error(t('stylist.shareOutfit.failedLink', { defaultValue: 'Failed to generate share link.' }));
      } finally {
        setMinting(false);
      }
    })();
  }, [open, outfit, sessionId, items, t]);

  // Trigger HTML2Canvas rendering and upload base64 card to backend
  const generateCardBlob = async () => {
    if (!cardRef.current) return null;
    try {
      setRendering(true);
      // Let images settle
      await new Promise((r) => setTimeout(r, 600));
      const canvas = await html2canvas(cardRef.current, {
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#111827', // dark mode slate background
        scale: 2, // high quality
      });
      const dataUrl = canvas.toDataURL('image/png');
      
      // Upload to backend
      if (shareId) {
        try {
          await api.saveSharedOutfitShareCard(shareId, dataUrl);
        } catch (uploadErr) {
          console.debug('Failed to upload share card to backend:', uploadErr);
        }
      }
      return dataUrl;
    } catch (err) {
      console.error('Failed to generate image card:', err);
      toast.error(t('stylist.shareOutfit.failedCard', { defaultValue: 'Failed to generate image card.' }));
      return null;
    } finally {
      setRendering(false);
    }
  };

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success(t('stylist.shareCopied'));
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error(t('common.error'));
    }
  };

  const handleDownload = async () => {
    const dataUrl = await generateCardBlob();
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `dressapp-outfit-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleWhatsApp = async () => {
    if (!shareUrl) return;
    const text = `${t('stylist.shareOutfitBody', { defaultValue: 'Check out this outfit suggested by my DressApp stylist!' })}: ${shareUrl}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleInstagram = async () => {
    const dataUrl = await generateCardBlob();
    if (!dataUrl) return;
    
    // Download image and show hint for stories
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `dressapp-outfit-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    toast.info(
      t('stylist.shareOutfit.instagramHint', {
        defaultValue: 'Image downloaded! Open Instagram and select the image for your Story.',
      }),
      { duration: 6000 }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-full bg-card border-border rounded-2xl overflow-hidden p-6 max-h-[96vh] flex flex-col">
        <DialogHeader className="pb-2 border-b border-border/60">
          <DialogTitle className="flex items-center gap-2 text-foreground font-display text-lg">
            <Share2 className="h-5 w-5 text-brand" />
            {t('stylist.shareOutfit', { defaultValue: 'Share Outfit' })}
          </DialogTitle>
        </DialogHeader>

        {/* Outer scroll area for layout preview */}
        <div className="flex-1 overflow-y-auto py-4 space-y-6 flex flex-col items-center">
          {/* Card to export (html2canvas targeting this ref) */}
          <div className="relative w-[320px] aspect-[9/16] bg-slate-950 text-white rounded-2xl overflow-hidden shadow-2xl flex flex-col border border-white/10" ref={cardRef}>
            {/* 65% Height: Avatar Viewer */}
            <div className="h-[65%] w-full relative bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 overflow-hidden flex items-center justify-center">
              <OutfitAvatarViewer
                shapeParams={user?.avatar_shape_params || {}}
                sex={user?.sex || 'female'}
                outfitItemsMap={outfitItemsMap}
                className="w-full h-full"
              />
              <div className="absolute top-4 start-4 flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] font-semibold text-brand-foreground/90 uppercase tracking-wide">
                <Sparkles className="h-3 w-3 text-brand" />
                {t('stylist.shareOutfit.myLook', { defaultValue: 'AI Suggested Look' })}
              </div>
            </div>

            {/* 20% Height: Garment Chips */}
            <div className="h-[20%] w-full px-4 py-3 bg-slate-900/60 backdrop-blur border-t border-white/5 flex flex-col justify-center gap-1.5">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                {t('stylist.shareOutfit.pieces', { defaultValue: 'Outfit Pieces' })}
              </div>
              <div className="flex flex-wrap gap-1 overflow-y-auto max-h-[70%] scrollbar-thin">
                {items.map((it, idx) => (
                  <span key={idx} className="inline-flex items-center text-[10px] font-medium bg-white/10 text-white px-2 py-0.5 rounded-full capitalize">
                    {it.role}: {it.title || it.description || 'Item'}
                  </span>
                ))}
              </div>
            </div>

            {/* 15% Height: DressApp branding + QR code */}
            <div className="h-[15%] w-full px-4 py-3 bg-slate-950 border-t border-white/5 flex items-center justify-between">
              <div className="space-y-1">
                <div className="text-sm font-bold tracking-tight text-white flex items-center gap-1">
                  <span className="text-brand">⬡</span> DressApp
                </div>
                <div className="text-[9px] text-muted-foreground uppercase tracking-wider leading-none">
                  {t('stylist.shareOutfit.tagline', { defaultValue: 'Your AI fashion editor' })}
                </div>
              </div>
              {/* QR Code Deep Link */}
              {shareUrl ? (
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
                    shareUrl + '?utm_source=outfit_share&utm_medium=app_share'
                  )}`}
                  alt="QR Link"
                  className="w-11 h-11 rounded bg-white p-0.5"
                  crossOrigin="anonymous"
                />
              ) : (
                <div className="w-11 h-11 rounded bg-white/10 flex items-center justify-center">
                  <Loader2 className="h-4 w-4 animate-spin text-white/40" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Share actions bar */}
        <div className="pt-4 border-t border-border/60 grid grid-cols-2 gap-2">
          <Button
            onClick={handleCopyLink}
            disabled={minting || copied}
            variant="outline"
            className="rounded-xl gap-2 font-medium text-xs py-5"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
            {copied ? t('common.copied', { defaultValue: 'Copied!' }) : t('stylist.shareOutfit.copyLink', { defaultValue: 'Copy Link' })}
          </Button>

          <Button
            onClick={handleWhatsApp}
            disabled={minting}
            variant="outline"
            className="rounded-xl gap-2 font-medium text-xs py-5"
          >
            <Send className="h-4 w-4 rotate-45 -translate-y-0.5" />
            WhatsApp
          </Button>

          <Button
            onClick={handleInstagram}
            disabled={minting || rendering}
            variant="outline"
            className="rounded-xl gap-2 font-medium text-xs py-5"
          >
            {rendering ? <Loader2 className="h-4 w-4 animate-spin" /> : <Instagram className="h-4 w-4" />}
            Instagram
          </Button>

          <Button
            onClick={handleDownload}
            disabled={minting || rendering}
            className="rounded-xl bg-brand text-brand-foreground hover:bg-brand/90 gap-2 font-semibold text-xs py-5"
          >
            {rendering ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {t('stylist.shareOutfit.downloadPng', { defaultValue: 'Download PNG' })}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
