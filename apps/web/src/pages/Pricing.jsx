import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

import { QuotaMonitor } from '@/components/pricing/QuotaMonitor';
import { PricingDisplay } from '@/components/pricing/PricingDisplay';

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
        
        const quotaRes = await api.getQuotaStatus();
        setQuotaStatus(quotaRes);
      } catch (err) {
        console.error('Failed to fetch pricing data:', err);
        setError(t('pricing.loadError', { defaultValue: 'Failed to load pricing information. Please try again later.' }));
      } finally {
        setLoading(false);
      }
    };

    fetchPricingData();
  }, []);

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

  // Set up polling interval for quota updates
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const quotaRes = await api.getQuotaStatus();
        setQuotaStatus(quotaRes);
      } catch (err) {
        console.warn('Failed to refresh quota status:', err);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const subStatus = searchParams.get('sub_status');
    const token = searchParams.get('token');
    if (subStatus === 'success' && token) {
      const capture = async () => {
        setSubBusy(true);
        try {
          await api.captureSubscription(token);
          toast.success('Subscription activated successfully!');
          searchParams.delete('sub_status');
          searchParams.delete('token');
          setSearchParams(searchParams);
        } catch (err) {
          toast.error('Error activating subscription.');
        } finally {
          setSubBusy(false);
        }
      };
      capture();
    } else if (subStatus === 'cancel') {
      toast.info('Subscription checkout cancelled.');
      searchParams.delete('sub_status');
      setSearchParams(searchParams);
    }
  }, [searchParams, setSearchParams]);

  const handleUpgrade = async (tierName) => {
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
        toast.error('Failed to initiate subscription payment.');
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail?.message || 'Error creating subscription');
    } finally {
      setSubBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--accent))]" />
        <p className="text-sm text-muted-foreground animate-pulse">
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
    <div className="relative min-h-screen pb-[calc(env(safe-area-inset-bottom)+88px)] px-4 sm:px-6 max-w-6xl mx-auto overflow-hidden space-y-12">
      {/* Visual background wash */}
      <div 
        className="absolute top-0 inset-x-0 h-[600px] pointer-events-none opacity-50 dark:opacity-20"
        style={{
          backgroundImage: `
            radial-gradient(900px circle at 15% 10%, rgba(31,111,107,0.14), transparent 55%),
            radial-gradient(700px circle at 85% 5%, rgba(232,96,60,0.10), transparent 50%)
          `
        }}
      />

      {/* Noise overlay on hero section */}
      <div className="absolute top-0 inset-x-0 h-[300px] pointer-events-none opacity-[0.04] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-neutral-900 to-transparent" />

      {/* Pricing and tier display selection */}
      <PricingDisplay
        pricingData={pricingData}
        currentPlanName={currentPlanName}
        isAnnual={isAnnual}
        setIsAnnual={setIsAnnual}
        subBusy={subBusy}
        handleUpgrade={handleUpgrade}
      />

      {/* Quota status, warnings, and daily limits monitor */}
      <QuotaMonitor
        quotaStatus={quotaStatus}
        pricingData={pricingData}
      />
    </div>
  );
}