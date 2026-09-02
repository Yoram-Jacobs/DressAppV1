import { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BrandLogo } from '@/components/BrandLogo';
import { LanguagePicker } from '@/components/LanguagePicker';
import { api } from '@/lib/api';
import { Loader2, AlertCircle, Sparkles, ImageOff } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import HarmonyBadge from '@/components/stylist/HarmonyBadge';

export default function SharedOutfit() {
  const { id } = useParams();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sharedData, setSharedData] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await api.getSharedOutfit(id);
        setSharedData(res);
      } catch (err) {
        console.error('Failed to load shared outfit:', err);
        setError(t('stylist.shareOutfit.notFound', { defaultValue: 'Shared outfit not found or has expired.' }));
      } finally {
        setLoading(false);
      }
    })();
  }, [id, t]);

  const outfit = sharedData?.outfit || {};
  const outfitName = outfit.name || t('stylist.untitledConversation', { defaultValue: 'Untitled outfit' });
  const outfitWhy = outfit.why || outfit.description || '';
  const shareCardImage = sharedData?.share_card_b64 || outfit.share_card_b64 || null;

  const outfitColors = useMemo(() => {
    const itemsList = outfit.items || outfit.garments || [];
    return itemsList
      .map((it) => {
        const name = it.color || null;
        return name ? { name } : null;
      })
      .filter(Boolean);
  }, [outfit]);

  return (
    <div className="min-h-screen bg-background flex flex-col relative noise">
      <Helmet>
        <title>{`${outfitName} | DressApp`}</title>
        <meta property="og:title" content={`${outfitName} | DressApp`} />
        {outfitWhy && <meta property="og:description" content={outfitWhy} />}
        {id && (
          <meta property="og:image" content={`${window.location.origin}/api/v1/share/outfit/${id}/image`} />
        )}
        <meta property="og:type" content="website" />
      </Helmet>

      {/* Header */}
      <header className="w-full flex items-center justify-between px-6 py-4 border-b border-border/60 bg-background/60 backdrop-blur-md sticky top-0 z-40">
        <Link to="/" className="flex items-center gap-2">
          <BrandLogo className="h-7" />
        </Link>
        <LanguagePicker
          className="rounded-full bg-card/85 backdrop-blur-sm border-border shadow-sm hover:bg-card"
          testIdSuffix="shared-outfit"
        />
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 max-w-xl mx-auto w-full py-10">
        {loading ? (
          <div className="flex flex-col items-center gap-3 py-20">
            <Loader2 className="h-8 w-8 animate-spin text-brand" />
            <p className="text-sm text-muted-foreground">{t('stylist.thinking', { defaultValue: 'Loading your look...' })}</p>
          </div>
        ) : error ? (
          <Card className="w-full border-destructive/20 bg-destructive/5">
            <CardContent className="flex flex-col items-center text-center p-6 space-y-3">
              <AlertCircle className="h-10 w-10 text-destructive" />
              <h3 className="font-semibold text-foreground">{t('common.error', { defaultValue: 'Error' })}</h3>
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button asChild variant="outline" className="mt-2 rounded-xl">
                <Link to="/">{t('common.backToHome', { defaultValue: 'Back to Home' })}</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="w-full space-y-6">
            {/* Title / Summary */}
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-brand/10 text-brand">
                <Sparkles className="h-3 w-3" />
                {t('stylist.shareOutfit.suggestedLook', { defaultValue: 'Suggested Look' })}
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">{outfitName}</h1>
              {outfitColors.length >= 2 && (
                <div className="flex justify-center mt-1">
                  <HarmonyBadge colors={outfitColors} />
                </div>
              )}
              {outfitWhy && <p className="text-sm text-muted-foreground italic px-4">"{outfitWhy}"</p>}
            </div>

            {/* Share Card Image Display */}
            <Card className="overflow-hidden border border-border shadow-xl rounded-2xl bg-card">
              <CardContent className="p-0">
                {shareCardImage ? (
                  <img
                    src={shareCardImage}
                    alt={outfitName}
                    className="w-full h-auto object-contain block max-h-[70vh]"
                    data-testid="shared-outfit-card-img"
                  />
                ) : (
                  <div className="py-20 flex flex-col items-center gap-2 text-muted-foreground">
                    <ImageOff className="h-10 w-10 opacity-40" />
                    <p className="text-xs">{t('stylist.shareOutfit.noImage', { defaultValue: 'Preview not generated' })}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Call to Actions */}
            <div className="flex flex-col gap-2 pt-2">
              <Button asChild className="w-full rounded-xl bg-brand text-brand-foreground hover:bg-brand/90 font-semibold py-6 text-sm">
                <Link to="/register">
                  {t('stylist.shareOutfit.createCloset', { defaultValue: 'Digitize Your Closet' })}
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full rounded-xl py-6 text-sm">
                <Link to="/login">
                  {t('stylist.shareOutfit.openInApp', { defaultValue: 'Open in DressApp' })}
                </Link>
              </Button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="py-6 text-center border-t border-border/40 text-xs text-muted-foreground">
        © {new Date().getFullYear()} DressApp. {t('stylist.shareOutfit.tagline', { defaultValue: 'Your AI fashion editor.' })}
      </footer>
    </div>
  );
}
