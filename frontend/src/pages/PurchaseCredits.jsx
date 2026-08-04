import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { 
  Loader2, 
  Coins, 
  Zap, 
  Sparkles, 
  ArrowLeft, 
  AlertTriangle, 
  CheckCircle2 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

const PurchaseCredits = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [creditPacks, setCreditPacks] = useState([]);
  const [selectedPack, setSelectedPack] = useState(null);
  const [purchaseResult, setPurchaseResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [error, setError] = useState(null);

  // Parse success / cancel callback states on mount
  useEffect(() => {
    const subStatus = searchParams.get('sub_status');
    const token = searchParams.get('token');
    
    if (subStatus === 'success' && token) {
      const capturePayment = async () => {
        setConfirmingPayment(true);
        try {
          const res = await api.aiCreditsCapture(token);
          if (res.ok) {
            toast.success(t('pricing.purchaseSuccessToast', { defaultValue: 'Credits purchased successfully!' }));
            setPurchaseResult({
              success: true,
              message: t('pricing.purchaseSuccessMsg', { defaultValue: 'Successfully purchased credit pack!' }),
              credits_added: res.purchase?.credits_amount || 0,
              total_cost: ((res.purchase?.amount_cents || 0) / 100).toFixed(2)
            });
          } else {
            setError(t('pricing.captureFailed', { defaultValue: 'Failed to confirm transaction.' }));
          }
        } catch (err) {
          console.error('Failed to capture credit pack purchase:', err);
          setError(err?.response?.data?.detail?.message || t('pricing.captureFailed', { defaultValue: 'Failed to confirm transaction.' }));
        } finally {
          setConfirmingPayment(false);
          // Clear query params to prevent double triggers
          const newParams = new URLSearchParams(searchParams);
          newParams.delete('sub_status');
          newParams.delete('token');
          setSearchParams(newParams);
        }
      };
      capturePayment();
    } else if (subStatus === 'cancel') {
      toast.info(t('pricing.checkoutCancelled', { defaultValue: 'Checkout cancelled.' }));
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('sub_status');
      if (newParams.has('token')) newParams.delete('token');
      setSearchParams(newParams);
    }
  }, [searchParams, setSearchParams, t]);

  // Fetch available credit packs on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const packsRes = await api.getPricingInfo();
        setCreditPacks(packsRes.credit_packs || []);
        
        // Auto-select pack if specified in query params or default to first pack
        const queryPackSize = searchParams.get('pack_size');
        if (queryPackSize) {
          const pack = packsRes.credit_packs.find(p => p.amount.toString() === queryPackSize);
          if (pack) setSelectedPack(pack);
        } else if (packsRes.credit_packs && packsRes.credit_packs.length > 0) {
          setSelectedPack(packsRes.credit_packs[0]);
        }
      } catch (err) {
        console.error('Failed to fetch pricing data:', err);
        setError(t('pricing.loadError', { defaultValue: 'Could not load pricing information. Please refresh the page.' }));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [searchParams, t]);

  // Handle checkout redirect to Atzmai
  const handlePurchase = async () => {
    if (!selectedPack || busy || confirmingPayment) return;

    try {
      setBusy(true);
      const res = await api.aiCreditsPurchase({
        pack: selectedPack.amount.toString(),
        currency: 'USD'
      });

      if (res.approve_url) {
        window.location.href = res.approve_url;
      } else {
        toast.error(t('pricing.failedToInitiatePayment', { defaultValue: 'Failed to initiate purchase payment.' }));
      }
    } catch (err) {
      console.error('Purchase failed:', err);
      toast.error(err?.response?.data?.detail?.message || t('pricing.errorPurchasing', { defaultValue: 'Error creating purchase order' }));
    } finally {
      setBusy(false);
    }
  };

  if (loading || confirmingPayment) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--accent))]" />
        <p className="text-sm text-muted-foreground animate-pulse">
          {confirmingPayment 
            ? t('pricing.confirmingPayment', { defaultValue: 'Confirming your purchase...' }) 
            : t('pricing.loadingPacks', { defaultValue: 'Loading purchase options...' })
          }
        </p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen pb-[calc(env(safe-area-inset-bottom)+88px)] px-4 sm:px-6 max-w-6xl mx-auto overflow-hidden space-y-12">
      {/* Visual background wash */}
      <div 
        className="absolute top-0 inset-x-0 h-[600px] pointer-events-none opacity-50 dark:opacity-20 animate-fade-in"
        style={{
          backgroundImage: `
            radial-gradient(900px circle at 15% 10%, rgba(31,111,107,0.14), transparent 55%),
            radial-gradient(700px circle at 85% 5%, rgba(232,96,60,0.10), transparent 50%)
          `
        }}
      />

      {/* Header section */}
      <div className="relative text-center pt-8 pb-4 max-w-2xl mx-auto">
        <Link 
          to="/pricing" 
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors mb-6"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t('pricing.backToPricing', { defaultValue: 'Back to Pricing Plans' })}
        </Link>
        <h1 className="text-3xl sm:text-4xl font-display tracking-tight text-primary mb-3">
          {t('pricing.purchaseCreditsHeader', { defaultValue: 'Purchase AI Credits' })}
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground font-body max-w-md mx-auto leading-relaxed">
          {t('pricing.purchaseCreditsDesc', { defaultValue: 'Top up your account with paid credit packs. Credits never expire and carry over monthly.' })}
        </p>
      </div>

      {/* Alerts */}
      {error && (
        <Alert variant="destructive" className="max-w-xl mx-auto border-destructive/20 bg-destructive/5">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{t('common.error', { defaultValue: 'Error' })}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {purchaseResult?.success && (
        <Alert className="max-w-xl mx-auto border-emerald-500/20 bg-emerald-500/5 text-emerald-800 dark:text-emerald-400 [&>svg]:text-emerald-600">
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>{t('pricing.purchaseSuccessful', { defaultValue: 'Purchase Successful!' })}</AlertTitle>
          <AlertDescription>
            {t('pricing.purchaseSuccessDetails', { 
              defaultValue: 'Successfully purchased {{count}} credits for ${{cost}}!', 
              count: purchaseResult.credits_added, 
              cost: purchaseResult.total_cost 
            })}
          </AlertDescription>
        </Alert>
      )}

      {/* Main Checkout View */}
      <div className="grid md:grid-cols-3 gap-8 items-start relative max-w-5xl mx-auto">
        {/* Left Column: Credit Pack Cards */}
        <div className="md:col-span-2 space-y-4">
          {creditPacks.map((pack) => {
            const isSelected = selectedPack?.amount === pack.amount;
            return (
              <div
                key={pack.amount}
                onClick={() => setSelectedPack(pack)}
                className={`cursor-pointer p-5 rounded-2xl border transition-all flex items-center justify-between group ${
                  isSelected
                    ? 'border-accent bg-accent/5 shadow-sm ring-1 ring-accent'
                    : 'border-border bg-card hover:bg-secondary/10'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl transition-colors ${
                    isSelected 
                      ? 'bg-accent/15 text-accent' 
                      : 'bg-primary/5 text-primary group-hover:bg-primary/10'
                  }`}>
                    <Coins className="h-6 w-6" />
                  </div>
                  <div className="text-start">
                    <span className="font-bold text-lg text-foreground block">
                      {pack.amount} {t('pricing.creditsLabel', { defaultValue: 'Credits' })}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t('pricing.noExpiration', { defaultValue: 'Paid pack - never expires' })}
                    </span>
                  </div>
                </div>
                
                <div className="text-right">
                  <span className="font-extrabold text-xl block text-foreground">
                    ${(pack.price_cents / 100).toFixed(2)}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block mt-0.5">
                    ${((pack.price_cents / 100) / pack.amount).toFixed(3)} / {t('pricing.creditLabelShort', { defaultValue: 'credit' })}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Column: Order Summary Card */}
        <Card className="border border-border shadow-sm p-6 rounded-2xl bg-card">
          <h3 className="font-bold text-lg text-foreground mb-4 text-start">
            {t('pricing.orderSummary', { defaultValue: 'Order Summary' })}
          </h3>
          <div className="space-y-3.5 text-sm text-muted-foreground border-b border-border pb-4 mb-4 text-start">
            <div className="flex justify-between">
              <span>{t('pricing.summaryItem', { defaultValue: 'Item:' })}</span>
              <span className="font-semibold text-foreground">{selectedPack?.amount} {t('pricing.creditsLabel', { defaultValue: 'Credits' })}</span>
            </div>
            <div className="flex justify-between">
              <span>{t('pricing.summaryMode', { defaultValue: 'Billing Mode:' })}</span>
              <span className="font-semibold text-foreground">{t('pricing.summaryOneTime', { defaultValue: 'One-time payment' })}</span>
            </div>
            <div className="flex justify-between">
              <span>{t('pricing.summaryTax', { defaultValue: 'Tax:' })}</span>
              <span className="font-semibold text-foreground">$0.00</span>
            </div>
          </div>
          
          <div className="flex justify-between items-baseline mb-6">
            <span className="font-semibold text-foreground">{t('pricing.summaryTotal', { defaultValue: 'Total:' })}</span>
            <span className="text-3xl font-extrabold text-foreground">
              ${selectedPack ? (selectedPack.price_cents / 100).toFixed(2) : '0.00'}
            </span>
          </div>

          <Button
            onClick={handlePurchase}
            disabled={busy || confirmingPayment}
            className="w-full h-11 rounded-xl bg-accent hover:bg-accent/90 text-white font-semibold transition-colors flex items-center justify-center gap-2"
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('pricing.redirectingToGateway', { defaultValue: 'Redirecting to checkout...' })}
              </>
            ) : (
              <>
                <Zap className="h-4 w-4" />
                {t('pricing.checkoutBtn', { defaultValue: 'Pay' })}
              </>
            )}
          </Button>

          <p className="text-[10px] text-muted-foreground text-center mt-3 leading-relaxed">
            {t('pricing.billingDisclaimer', { 
              defaultValue: 'Payments processed via Atzmai Sachir Gateway. By clicking buy, you agree to our Terms of Service.' 
            })}
          </p>
        </Card>
      </div>

      {/* Credit Pack Benefits Section */}
      <section className="pt-6 max-w-5xl mx-auto">
        <h2 className="text-xl sm:text-2xl font-display tracking-tight text-primary mb-6 text-start flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-accent" />
          {t('pricing.whyCreditsHeader', { defaultValue: 'Why Choose DressApp Credits?' })}
        </h2>
        <div className="grid sm:grid-cols-3 gap-6">
          <div className="p-5 rounded-2xl border border-border bg-card text-start space-y-2 hover:shadow-sm transition-shadow">
            <span className="text-2xl">🎯</span>
            <h4 className="font-bold text-sm text-foreground">
              {t('pricing.benefitAlwaysAvailable', { defaultValue: 'Always Available' })}
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t('pricing.benefitAlwaysAvailableDesc', { defaultValue: 'Paid credits never expire. Use them whenever you need, even months from now.' })}
            </p>
          </div>
          <div className="p-5 rounded-2xl border border-border bg-card text-start space-y-2 hover:shadow-sm transition-shadow">
            <span className="text-2xl">💰</span>
            <h4 className="font-bold text-sm text-foreground">
              {t('pricing.benefitBulkDiscounts', { defaultValue: 'Bulk Discounts' })}
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t('pricing.benefitBulkDiscountsDesc', { defaultValue: 'Buy larger packs and get better value per credit. The 100-credit pack offers the best unit value.' })}
            </p>
          </div>
          <div className="p-5 rounded-2xl border border-border bg-card text-start space-y-2 hover:shadow-sm transition-shadow">
            <span className="text-2xl">⚡</span>
            <h4 className="font-bold text-sm text-foreground">
              {t('pricing.benefitInstantAccess', { defaultValue: 'Instant Access' })}
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t('pricing.benefitInstantAccessDesc', { defaultValue: 'Purchase today and get immediate access to premium AI features like background removals and stylist suggestions.' })}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default PurchaseCredits;