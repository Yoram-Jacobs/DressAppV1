import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Sparkles,
  ExternalLink,
  Shirt,
  Ruler,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  RotateCcw,
  Camera,
  Upload,
  ShoppingBag,
  Loader2,
  Check,
  Percent,
} from 'lucide-react';

import { getSharedMediaFromStorage } from '@/lib/shareTargetStorage';

export default function ShareTarget() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Incoming parameters from Web Share Target or deep-link
  const sharedUrl = searchParams.get('url') || '';
  const sharedText = searchParams.get('text') || '';
  const sharedTitle = searchParams.get('title') || '';
  const hasSharedMedia = searchParams.get('shared_media');

  const [inputUrl, setInputUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [addingToCloset, setAddingToCloset] = useState(false);
  const [addedItem, setAddedItem] = useState(null);

  // Manual fallback state (for screenshot upload if bot protection blocks direct fetch)
  const [manualUploading, setManualUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Extract clean URL from text or URL query
  const extractUrl = useCallback((rawUrl, rawText) => {
    const combined = `${rawUrl || ''} ${rawText || ''}`.trim();
    const match = combined.match(/https?:\/\/[^\s"'<>]+/i);
    return match ? match[0] : (rawUrl || '').trim();
  }, []);

  const runAnalysis = useCallback(async (targetUrl, targetTitle = '') => {
    if (!targetUrl || (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://'))) {
      setError(t('shareTarget.invalidUrl', { defaultValue: 'Please enter a valid product URL (e.g. https://www.zara.com/...)' }));
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setAddedItem(null);

    try {
      const data = await api.misc.analyzeUrl({
        url: targetUrl,
        title: targetTitle || undefined,
        user_preferred_units: user?.profile?.preferred_units || 'cm',
      });
      setResult(data);
    } catch (err) {
      console.error('[ShareTarget] Analysis failed:', err);
      const detail = err.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : t('shareTarget.errorGeneric', { defaultValue: 'Could not analyze this store link. Please try uploading a size chart screenshot.' }));
    } finally {
      setLoading(false);
    }
  }, [t, user]);

  // Manual screenshot or direct image share analysis
  const processScreenshotFile = useCallback(async (file) => {
    if (!file) return;

    setManualUploading(true);
    setError(null);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const b64Data = reader.result.split(',')[1];
        try {
          const chartData = await api.misc.analyzeChart({
            chart_screenshot_b64: b64Data,
            garment_type: result?.product?.garment_type || undefined,
            store: result?.product?.brand || undefined,
            user_preferred_units: user?.profile?.preferred_units || 'cm',
          });
          setResult((prev) => ({
            product: prev?.product || {
              url: inputUrl,
              title: t('shareTarget.customChartTitle', { defaultValue: 'Shared Size Chart' }),
              brand: prev?.product?.brand || 'Store',
              store: prev?.product?.brand || 'Store',
            },
            recommendation: chartData,
          }));
          toast.success(t('shareTarget.chartAnalyzed', { defaultValue: 'Size chart analyzed successfully!' }));
        } catch (chartErr) {
          console.error('[ShareTarget] Chart analysis failed:', chartErr);
          toast.error(t('shareTarget.chartError', { defaultValue: 'Could not parse size chart from image. Please try a clearer screenshot.' }));
        } finally {
          setManualUploading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch {
      setManualUploading(false);
    }
  }, [inputUrl, result?.product?.brand, result?.product?.garment_type, t, user?.profile?.preferred_units]);

  // Auto-trigger when landing with shared URL/text or shared screenshot from native OS Share sheet
  useEffect(() => {
    if (hasSharedMedia) {
      getSharedMediaFromStorage().then((file) => {
        if (file) {
          processScreenshotFile(file);
        }
      });
      return;
    }

    const clean = extractUrl(sharedUrl, sharedText);
    if (clean) {
      setInputUrl(clean);
      runAnalysis(clean, sharedTitle);
    }
  }, [hasSharedMedia, sharedUrl, sharedText, sharedTitle, extractUrl, runAnalysis, processScreenshotFile]);

  const handleSubmit = (e) => {
    e?.preventDefault();
    const clean = extractUrl(inputUrl);
    if (clean) {
      runAnalysis(clean);
    }
  };

  const handlePasteClipboard = async () => {
    try {
      if (navigator.clipboard?.readText) {
        const clipText = await navigator.clipboard.readText();
        const clean = extractUrl('', clipText);
        if (clean) {
          setInputUrl(clean);
          runAnalysis(clean);
        } else {
          setInputUrl(clipText);
          toast.info(t('shareTarget.pastedClipboard', { defaultValue: 'Pasted from clipboard. Tap Analyze to proceed.' }));
        }
      }
    } catch {
      toast.error(t('shareTarget.clipboardError', { defaultValue: 'Clipboard access denied. Please paste manually.' }));
    }
  };

  // Add the recommended garment to user's Closet
  const handleAddToCloset = async () => {
    if (!result?.product) return;
    const { product, recommendation } = result;

    setAddingToCloset(true);
    try {
      const category = product.garment_type || 'top';
      const created = await api.closet.createItem({
        title: product.title || `${product.brand || 'Store'} Garment`,
        name: product.title,
        brand: product.brand || 'Retailer',
        category: category,
        size: recommendation?.recommended_size || '',
        price_cents: product.price ? Math.round(parseFloat(product.price) * 100) : undefined,
        currency: product.currency || 'USD',
        source: 'Retail',
        marketplace_intent: 'own',
        image_url: product.image_url || undefined,
      });

      setAddedItem(created);
      toast.success(
        t('shareTarget.addedSuccess', {
          size: recommendation?.recommended_size || 'item',
          defaultValue: `Added to your closet in size ${recommendation?.recommended_size || ''}!`,
        }),
        {
          action: {
            label: t('shareTarget.viewInCloset', { defaultValue: 'View in Closet' }),
            onClick: () => navigate(created?.id ? `/closet/${created.id}` : '/closet'),
          },
        }
      );
    } catch (err) {
      console.error('[ShareTarget] Add to closet failed:', err);
      toast.error(t('shareTarget.addError', { defaultValue: 'Failed to add item to closet.' }));
    } finally {
      setAddingToCloset(false);
    }
  };

  // Triggered when user selects a file from the mobile photo picker / gallery
  const handleScreenshotUpload = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      await processScreenshotFile(file);
    }
  };

  const measurements = user?.body_measurements || {};
  const hasMeasurements = Object.keys(measurements).length > 0;

  return (
    <div className="min-h-screen bg-sand pb-12 pt-4 px-4 sm:px-6 max-w-2xl mx-auto" data-testid="share-target-container">
      {/* Top Bar / Navigation */}
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="text-text-brand hover:text-dark-brand -ms-2"
          data-testid="share-target-back-btn"
        >
          <ArrowLeft className="w-4 h-4 me-1.5 rtl:rotate-180" />
          {t('common.back', { defaultValue: 'Back' })}
        </Button>
        <Badge variant="outline" className="bg-white/80 border-border text-xs gap-1.5 py-1">
          <ShoppingBag className="w-3.5 h-3.5 text-primary-brand" />
          <span>{t('shareTarget.badge', { defaultValue: 'Mobile Size Assistant' })}</span>
        </Badge>
      </div>

      {/* Main Sheet Card */}
      <Card className="rounded-[16px] border border-border bg-white shadow-md overflow-hidden">
        {/* Header Banner */}
        <div className="p-5 border-b border-border bg-gradient-to-r from-primary-shadow/60 to-accent-beige/40">
          <div className="flex items-start gap-3.5">
            <div className="h-11 w-11 rounded-2xl bg-primary-brand text-white flex items-center justify-center shrink-0 shadow-sm">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-dark-brand leading-tight" dir="auto">
                {t('shareTarget.title', { defaultValue: 'Check Size from Retail Link' })}
              </h1>
              <p className="text-xs text-text-brand mt-1" dir="auto">
                {t('shareTarget.subtitle', {
                  defaultValue: 'Shared from Zara, ASOS, SHEIN, H&M, or any store via your mobile share sheet.',
                })}
              </p>
            </div>
          </div>
        </div>

        <CardContent className="p-5 space-y-5">
          {/* Link Input Section */}
          <form onSubmit={handleSubmit} className="space-y-2.5">
            <label className="text-xs font-semibold text-dark-brand block text-start" dir="auto">
              {t('shareTarget.inputLabel', { defaultValue: 'Store Product Link' })}
            </label>
            <div className="flex gap-2">
              <Input
                type="url"
                dir="ltr"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="https://www.zara.com/product/..."
                className="text-xs bg-sand/30 border-border h-10 text-start"
                disabled={loading}
                data-testid="share-target-input"
              />
              <Button
                type="submit"
                disabled={loading || !inputUrl.trim()}
                className="bg-primary-brand hover:bg-primary-hover text-white h-10 px-4 shrink-0 font-medium text-xs"
                data-testid="share-target-submit-btn"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 me-1.5" />
                    {t('shareTarget.checkSize', { defaultValue: 'Check Size' })}
                  </>
                )}
              </Button>
            </div>
            <div className="flex items-center justify-between text-[11px] text-text-brand pt-1">
              <span dir="auto">{t('shareTarget.supportedStores', { defaultValue: 'Works with Zara, ASOS, H&M, SHEIN, Mango, Uniqlo & more' })}</span>
              <button
                type="button"
                onClick={handlePasteClipboard}
                className="text-primary-brand font-semibold hover:underline inline-flex items-center gap-1"
                data-testid="share-target-paste-btn"
              >
                {t('shareTarget.pasteLink', { defaultValue: 'Paste Link' })}
              </button>
            </div>
          </form>

          {/* Measurements Status Bar */}
          <div className="rounded-[10px] p-3 bg-secondary/50 border border-border flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Ruler className="w-4 h-4 text-primary-brand shrink-0" />
              {hasMeasurements ? (
                <span className="text-dark-brand font-medium truncate" dir="auto">
                  {t('shareTarget.measurementsActive', {
                    defaultValue: 'Using stored body measurements: ',
                  })}
                  <span className="text-muted-foreground font-normal" dir="auto">
                    {measurements.chest && `${t('profile.chest', { defaultValue: 'Chest' })} ${measurements.chest}cm `}
                    {measurements.waist && `· ${t('profile.waist', { defaultValue: 'Waist' })} ${measurements.waist}cm `}
                    {measurements.hip && `· ${t('profile.hips', { defaultValue: 'Hips' })} ${measurements.hip}cm`}
                  </span>
                </span>
              ) : (
                <span className="text-amber-800 font-medium" dir="auto">
                  {t('shareTarget.noMeasurements', {
                    defaultValue: 'No body measurements found. Add them to your profile for exact sizing.',
                  })}
                </span>
              )}
            </div>
            <Link
              to="/me"
              className="text-primary-brand font-bold text-xs hover:underline shrink-0 ms-2"
            >
              {t('shareTarget.editMeasurements', { defaultValue: 'Edit' })}
            </Link>
          </div>

          {/* Loading Animation */}
          {(loading || manualUploading) && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-3" data-testid="share-target-loading">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-primary-brand/20 border-t-primary-brand animate-spin" />
                <Sparkles className="w-6 h-6 text-primary-brand absolute inset-0 m-auto animate-pulse" />
              </div>
              <div className="space-y-1">
                <p className="font-bold text-sm text-dark-brand">
                  {manualUploading
                    ? t('shareTarget.analyzingScreenshot', { defaultValue: 'Scanning size chart screenshot with Gemini AI…' })
                    : t('shareTarget.readingSizeChart', { defaultValue: 'Connecting to store & scanning size chart…' })}
                </p>
                <p className="text-xs text-text-brand">
                  {t('shareTarget.matchingMeasurements', { defaultValue: 'AI is cross-referencing your body measurements' })}
                </p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && !loading && !manualUploading && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex items-start gap-3" data-testid="share-target-error">
              <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-xs text-destructive">{error}</p>
                <p className="text-[11px] text-text-brand">
                  {t('shareTarget.errorHint', { defaultValue: 'Tip: You can take a screenshot of the size chart on the retailer page and upload it below.' })}
                </p>
              </div>
            </div>
          )}

          {/* Result View */}
          {result && !loading && !manualUploading && (
            <div className="space-y-5 animate-in fade-in duration-300" data-testid="share-target-result">
              {/* Product Header Card */}
              <div className="flex gap-4 p-3.5 rounded-[12px] bg-sand/30 border border-border">
                {result.product?.image_url ? (
                  <img
                    src={result.product.image_url}
                    alt={result.product.title}
                    className="w-20 h-24 object-cover rounded-lg border border-border shadow-xs shrink-0 bg-white"
                  />
                ) : (
                  <div className="w-20 h-24 rounded-lg border border-border bg-white flex items-center justify-center text-muted-foreground shrink-0">
                    <Shirt className="w-8 h-8 opacity-40" />
                  </div>
                )}
                <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.2">
                        {result.product?.brand || 'Store'}
                      </Badge>
                      {result.product?.garment_type && (
                        <span className="text-[11px] text-muted-foreground capitalize">
                          {result.product.garment_type}
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-sm text-dark-brand line-clamp-2 leading-tight">
                      {result.product?.title || 'Retail Garment'}
                    </h3>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    {result.product?.price && (
                      <span className="font-bold text-sm text-primary-brand">
                        {result.product.currency === 'USD' ? '$' : result.product.currency}{result.product.price}
                      </span>
                    )}
                    <a
                      href={result.product?.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-text-brand hover:text-dark-brand inline-flex items-center gap-1 font-medium"
                    >
                      <span>{t('shareTarget.openStore', { defaultValue: 'Store Link' })}</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </div>

              {/* Recommendation Card */}
              {result.recommendation?.recommended_size ? (
                <div className="rounded-[14px] p-5 border-2 border-emerald-500/40 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-white shadow-sm space-y-4" data-testid="share-target-recommendation">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold shadow-xs">
                        <Check className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider block">
                          {t('shareTarget.recommendationTitle', { defaultValue: 'Best Fit for You' })}
                        </span>
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-extrabold text-dark-brand">
                            {t('shareTarget.sizePrefix', { defaultValue: 'Size' })} {result.recommendation.recommended_size}
                          </span>
                        </div>
                      </div>
                    </div>

                    {result.recommendation.confidence > 0 && (
                      <Badge className="bg-emerald-600 text-white border-0 text-xs px-2.5 py-1">
                        <Percent className="w-3 h-3 me-1 inline" />
                        {Math.round(result.recommendation.confidence * 100)}% {t('shareTarget.fitConfidence', { defaultValue: 'Match' })}
                      </Badge>
                    )}
                  </div>

                  {/* Reasoning */}
                  {result.recommendation.reasoning && (
                    <div className="rounded-lg p-3 bg-white/80 border border-emerald-500/20 text-xs text-dark-brand leading-relaxed">
                      {result.recommendation.reasoning}
                    </div>
                  )}

                  {/* Matched Columns & Alternatives */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {result.recommendation.matched_columns?.map((col) => (
                      <span
                        key={col}
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"
                      >
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        {col}
                      </span>
                    ))}

                    {result.recommendation.alternatives?.map((alt, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-secondary text-text-brand border border-border"
                      >
                        {alt.size} ({alt.fit || 'alt'})
                      </span>
                    ))}
                  </div>

                  {/* One-Tap Action Buttons */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                    <Button
                      type="button"
                      onClick={handleAddToCloset}
                      disabled={addingToCloset || !!addedItem}
                      className="w-full bg-primary-brand hover:bg-primary-hover text-white font-semibold text-xs h-10 shadow-xs"
                      data-testid="share-target-add-closet-btn"
                    >
                      {addingToCloset ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : addedItem ? (
                        <>
                          <Check className="w-4 h-4 me-1.5 text-emerald-300" />
                          {t('shareTarget.inYourCloset', { defaultValue: 'Added to Closet' })}
                        </>
                      ) : (
                        <>
                          <Shirt className="w-4 h-4 me-1.5" />
                          {t('shareTarget.addToCloset', { defaultValue: 'Add to My Closet' })}
                        </>
                      )}
                    </Button>

                    <a
                      href={result.product?.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full"
                    >
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full border-border hover:bg-secondary font-semibold text-xs h-10 text-dark-brand"
                        data-testid="share-target-buy-store-btn"
                      >
                        <ExternalLink className="w-4 h-4 me-1.5" />
                        {t('shareTarget.buyOnStore', {
                          store: result.product?.brand || 'Store',
                          defaultValue: `Buy on ${result.product?.brand || 'Store'}`,
                        })}
                      </Button>
                    </a>
                  </div>
                </div>
              ) : (
                /* Fallback when chart was not found or retailer blocks bots */
                <div className="rounded-[14px] p-5 border border-amber-300 bg-amber-50/60 shadow-xs space-y-4" data-testid="share-target-chart-fallback">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                      <Camera className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-amber-900">
                        {t('shareTarget.manualNeededTitle', { defaultValue: 'Size Chart Protected by Retailer' })}
                      </h4>
                      <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                        {result.recommendation?.reasoning ||
                          t('shareTarget.manualNeededDesc', {
                            defaultValue: 'This store uses anti-bot shields or dynamic popups. Simply take a screenshot of the size chart on their site and upload it below!',
                          })}
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 flex flex-col sm:flex-row items-center gap-2.5">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleScreenshotUpload}
                    />
                    <Button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={manualUploading}
                      className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs h-9"
                      data-testid="share-target-upload-chart-btn"
                    >
                      {manualUploading ? (
                        <Loader2 className="w-4 h-4 animate-spin me-1.5" />
                      ) : (
                        <Upload className="w-4 h-4 me-1.5" />
                      )}
                      {t('shareTarget.uploadScreenshot', { defaultValue: 'Upload Size Chart Screenshot' })}
                    </Button>
                    <a
                      href={result.product?.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-amber-800 hover:underline inline-flex items-center gap-1 font-medium"
                    >
                      {t('shareTarget.viewOnStore', { defaultValue: 'View Size Chart on Store Site' })}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              )}

              {/* Reset / Check Another Garment */}
              <div className="pt-2 text-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setResult(null);
                    setInputUrl('');
                    setError(null);
                  }}
                  className="text-xs text-text-brand hover:text-dark-brand"
                  data-testid="share-target-reset-btn"
                >
                  <RotateCcw className="w-3.5 h-3.5 me-1.5" />
                  {t('shareTarget.checkAnother', { defaultValue: 'Check Another Link' })}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
