import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { Loader2, AlertTriangle,Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { QuotaMonitor } from '@/components/pricing/QuotaMonitor';
import { PricingDisplay } from '@/components/pricing/PricingDisplay';
import PricingBanner from '../assets/img/inner6.webp';
import { PageHeroBanner } from '@/components/ui/PageHeroBanner';
export default function Pricing() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [pricingData, setPricingData] = useState(null);
  const [quotaStatus, setQuotaStatus] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAnnual, setIsAnnual] = useState(false);
  const [subBusy, setSubBusy] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  // Fetch comprehensive pricing information and quota status on mount
  useEffect(() => {
    const fetchPricingData = async () => {
      try {
        const pricingRes = await api.getPricingInfo();
        setPricingData(pricingRes);

        if (user) {
          try {
            const quotaRes = await api.getQuotaStatus();
            setQuotaStatus(quotaRes || {});
          } catch (_) {
            /* quota status is optional */
          }
        }
      } catch (err) {
        console.error('Failed to fetch pricing data:', err);
        setError(t('pricing.loadError', { defaultValue: 'Failed to load pricing information. Please try again later.' }));
      } finally {
        setLoading(false);
      }
    };
    fetchPricingData();
  }, [user, t]);

  // Scroll to hash-anchor if present on page load
  useEffect(() => {
    if (location.hash && pricingData) {
      const timer = setTimeout(() => {
        const id = location.hash.substring(1);
        const element = document.getElementById(id);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [location.hash, pricingData]);

  // Set up polling interval for quota updates (logged-in users only)
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(async () => {
      try {
        const quotaRes = await api.getQuotaStatus();
        setQuotaStatus(quotaRes || {});
      } catch (err) {
        console.warn('Failed to refresh quota status:', err);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    const subStatus = searchParams.get('sub_status');
    const creditStatus = searchParams.get('credit_status');
    const token = searchParams.get('token');

    if (subStatus === 'success' && token) {
      const capture = async () => {
        setSubBusy(true);
        try {
          await api.captureSubscription(token);
          toast.success(t('pricing.subscriptionActivated', { defaultValue: 'Subscription activated successfully!' }));
          searchParams.delete('sub_status');
          searchParams.delete('token');
          setSearchParams(searchParams);
          const pricingRes = await api.getPricingInfo();
          setPricingData(pricingRes);
        } catch (err) {
          toast.error(t('pricing.subscriptionActivateError', { defaultValue: 'Error activating subscription.' }));
        } finally {
          setSubBusy(false);
        }
      };
      capture();
    } else if (subStatus === 'cancel') {
      toast.info(t('pricing.subscriptionCancelled', { defaultValue: 'Subscription checkout cancelled.' }));
      searchParams.delete('sub_status');
      setSearchParams(searchParams);
    } else if (creditStatus === 'success' && token) {
      const captureCredit = async () => {
        setSubBusy(true);
        try {
          await api.aiCreditsCapture(token);
          toast.success(t('pricing.purchaseSuccessToast', { defaultValue: 'Credits purchased successfully!' }));
          searchParams.delete('credit_status');
          searchParams.delete('token');
          setSearchParams(searchParams);
          const pricingRes = await api.getPricingInfo();
          setPricingData(pricingRes);
        } catch (err) {
          toast.error(t('pricing.captureFailed', { defaultValue: 'Failed to confirm transaction.' }));
        } finally {
          setSubBusy(false);
        }
      };
      captureCredit();
    } else if (creditStatus === 'cancel') {
      toast.info(t('pricing.checkoutCancelled', { defaultValue: 'Checkout cancelled.' }));
      searchParams.delete('credit_status');
      setSearchParams(searchParams);
    }
  }, [searchParams, setSearchParams, t]);

  const handleUpgrade = async (tierName) => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (subBusy) return;
    setSubBusy(true);
    try {
      const planType = isAnnual ? 'yearly' : 'monthly';
      const res = await api.createSubscription({
        plan_type: planType,
        tier: tierName.toLowerCase(),
        return_url: `${window.location.origin}/pricing?sub_status=success`,
        cancel_url: `${window.location.origin}/pricing?sub_status=cancel`,
      });
      if (res.approve_url) {
        window.location.href = res.approve_url;
      } else {
        toast.error(t('pricing.paymentInitFailed', { defaultValue: 'Failed to initiate subscription payment.' }));
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail?.message || err?.response?.data?.detail || t('pricing.subscriptionError', { defaultValue: 'Error creating subscription' }));
    } finally {
      setSubBusy(false);
    }
  };

  const handleBuyCreditPack = async (packId) => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (subBusy) return;
    setSubBusy(true);
    try {
      const res = await api.aiCreditsPurchase({
        pack: packId,
        currency: 'USD',
        return_url: `${window.location.origin}/pricing?credit_status=success`,
        cancel_url: `${window.location.origin}/pricing?credit_status=cancel`,
      });
      if (res?.approve_url) {
        window.location.href = res.approve_url;
      } else {
        toast.error(t('pricing.purchasePackError', { defaultValue: 'Failed to purchase credit pack.' }));
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail?.message || err?.response?.data?.detail || t('pricing.purchasePackError', { defaultValue: 'Failed to purchase credit pack.' }));
    } finally {
      setSubBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary-brand" />
        <p className="text-sm text-text-brand animate-pulse">
          {t('common.loading', { defaultValue: 'Loading pricing plans...' })}
        </p>
      </div>
    );
  }

  if (error || !pricingData) {
    return (
      <div className="max-w-md mx-auto my-12 px-6 py-8 text-center bg-rose-50/50 border border-rose-100 rounded-2xl">
        <AlertTriangle className="h-10 w-10 text-rose-500 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-rose-950 mb-2">{t('common.error', { defaultValue: 'Error' })}</h3>
        <p className="text-sm text-rose-800/80 mb-6">{error || t('pricing.loadErrorFallback', { defaultValue: 'Failed to load pricing information.' })}</p>
        <Button onClick={() => window.location.reload()} variant="outline" className="border-rose-200 hover:bg-rose-50">
          {t('common.retry', { defaultValue: 'Retry' })}
        </Button>
      </div>
    );
  }
  const currentPlanName = pricingData?.pricing_plan?.plan_type || 'free';
  return (
    <>
      {/* Banner Section */}
      <PageHeroBanner image={PricingBanner}>
        <div className="relative z-10 w-full">
          <div
            className="
              px-10 py-20
              max-[991px]:px-[15px] max-[991px]:py-[30px]
            max-[767px]:px-[15px] max-[767px]:py-[30px]
            max-[480px]:px-[15px] max-[480px]:py-[30px]
            "
          >
            <div className="max-w-[520px]">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold tracking-wider uppercase bg-accent/10 text-accent border border-accent/25 mb-4">
          <Sparkles className="h-3 w-3 animate-pulse" />
          {t('pricing.membershipTitle', { defaultValue: 'DressApp Club' })}
        </span>
              {/* Title */}
              <h1
                className="
                  m-0 mb-0
                  text-[40px] leading-[40px]
                  font-bold
                  tracking-normal
                  text-white
                  max-[767px]:text-[30px]
                max-[480px]:text-[20px]
                max-[480px]:leading-[30px]
                max-[480px]:mb-3
                "
              >
                      {t('pricing.title', { defaultValue: 'Membership Pricing Plans' })}
              </h1>
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
                 {t('pricing.subtitle', { defaultValue: 'Choose the plan that fits your style. Upgrade, downgrade, or cancel at any time.' })}
              </p>
            </div>
          </div>
        </div>
      </PageHeroBanner>
      <section className="px-[40px] py-[40px] bg-accent-beige  max-[991px]:px-[15px] max-[991px]:py-[30px]
            max-[767px]:px-[15px] max-[767px]:py-[30px]
            max-[480px]:px-[15px] max-[480px]:py-[30px]">
        {/* Rest of the page content wrapped with side padding */}
          {/* Pricing and tier display selection */}
          <PricingDisplay
            pricingData={pricingData}
            currentPlanName={currentPlanName}
            isAnnual={isAnnual}
            setIsAnnual={setIsAnnual}
            subBusy={subBusy}
            handleUpgrade={handleUpgrade}
            handleBuyCreditPack={handleBuyCreditPack}
          />
          {/* Quota status, warnings, and daily limits monitor (authenticated users only) */}
          {user && (
            <QuotaMonitor
              quotaStatus={quotaStatus}
              pricingData={pricingData}
            />
          )}
      </section>
    </>
  );
}