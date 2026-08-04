import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { api } from '@/lib/api';

export function useSubscriptionManager() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [subBusy, setSubBusy] = useState(false);
  const { t } = useTranslation();

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

  const handleUpgrade = async (tierName, isAnnual) => {
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

  return { subBusy, handleUpgrade };
}