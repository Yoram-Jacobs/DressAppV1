import { Outlet, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { TopNav } from '@/components/TopNav';
import { BottomTabs } from '@/components/BottomTabs';
import { LanguageSync } from '@/components/LanguageSync';
import { LocationBanner } from '@/components/LocationBanner';
import { useAuth } from '@/lib/auth';
import { closetStore } from '@/lib/closetStore';
import { prewarmMarketplace, resetMarketplace, myListingsStore } from '@/lib/marketplaceStore';
import { prewarmExperts, resetExperts } from '@/lib/expertsStore';
import { prewarmSuitcase, resetSuitcase } from '@/lib/suitcaseStore';
import { outfitStore } from '@/lib/outfitStore';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

import OnboardingMigrationModal from '@/components/OnboardingMigrationModal';
import LoginClosetReminderModal from '@/components/LoginClosetReminderModal';
import { useClosetStore } from '@/lib/useClosetStore';
import { useState } from 'react';

export const AppLayout = () => {
  const { t } = useTranslation();
  const { user, loading, refresh } = useAuth();
  const { items } = useClosetStore();
  const [dismissedLoginReminder, setDismissedLoginReminder] = useState(() => {
    return sessionStorage.getItem('dressapp_dismissed_login_reminder') === 'true';
  });

  // Eager warm-up for closet, marketplace browse + my-listings,
  // experts directory, and traveling suitcase.
  useEffect(() => {
    if (loading) return;
    if (user) {
      closetStore.prewarm().catch(() => {});
      prewarmMarketplace(user.id).catch(() => {});
      prewarmExperts().catch(() => {});
      prewarmSuitcase().catch(() => {});
      outfitStore.prewarm().catch(() => {});
    } else {
      closetStore.reset();
      resetMarketplace();
      resetExperts();
      resetSuitcase();
      outfitStore.reset();
    }
  }, [user, loading]);

  // Tab visibility revalidation to keep devices in sync (Closet, Suitcase, and User Listings)
  useEffect(() => {
    if (loading || !user) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        closetStore.incrementalSync().catch(() => {});
        prewarmSuitcase().catch(() => {});
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [user, loading]);

  // Web Push device synchronization logic
  useEffect(() => {
    if (loading || !user) return;

    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.ready.then(async (reg) => {
        try {
          let sub = await reg.pushManager.getSubscription();
          const res = await api.getVapidKey();
          const pubKey = urlBase64ToUint8Array(res.public_key);

          const registerSub = async (subscription) => {
            try {
              await api.subscribeWebPush(subscription.toJSON());
            } catch (err) {
              console.warn('Failed to register web push on server', err);
            }
          };

          // If there is an existing subscription, verify if its key matches the current VAPID public key
          if (sub && sub.options && sub.options.applicationServerKey) {
            try {
              const currentSubKey = new Uint8Array(sub.options.applicationServerKey);
              let match = currentSubKey.length === pubKey.length;
              if (match) {
                for (let i = 0; i < pubKey.length; i++) {
                  if (currentSubKey[i] !== pubKey[i]) {
                    match = false;
                    break;
                  }
                }
              }
              if (!match) {
                console.log("VAPID public key changed. Unsubscribing old subscription...");
                await sub.unsubscribe();
                sub = null;
              }
            } catch (e) {
              console.warn("Error checking VAPID key mismatch:", e);
            }
          }

          if (sub) {
            await registerSub(sub);
          } else if (
            Notification.permission === 'granted' || 
            (user?.scheduler_settings?.enabled && Notification.permission === 'default')
          ) {
            if (Notification.permission === 'default') {
              const permission = await Notification.requestPermission();
              if (permission !== 'granted') return;
            }
            sub = await reg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: pubKey,
            });
            await registerSub(sub);
          }
        } catch (err) {
          console.warn('Auto Web Push subscription failed', err);
        }
      });
    }
  }, [user, loading]);

  useEffect(() => {
    if (user && !user.migration_flag && 'ontouchstart' in window) {
      toast.info(t('profile.mobileDesktopGuide', { defaultValue: 'Wardrobe import is available on the desktop version of DressApp. Please open your account on a desktop browser to continue.' }), { duration: 8000 });
    }
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;

  const showOnboardingMigration = user && !user.migration_flag;
  const showLoginReminder = user && user.migration_flag && items.length === 0 && !dismissedLoginReminder && !showOnboardingMigration;

  return (
    <div className="page-shell">
      <LanguageSync />
      <TopNav />
      <LocationBanner />
      <main id="main-content" tabIndex={-1} className="flex-1 pb-safe-tabs md:pb-10">
        <Outlet />
      </main>
      <BottomTabs />

      {/* Onboarding Migration Question Modal — desktop only */}
      {showOnboardingMigration && !('ontouchstart' in window) && (
        <OnboardingMigrationModal
          isOpen={true}
          onClose={() => { refresh().catch(() => {}); }}
          onFlagUpdated={() => { refresh().catch(() => {}); }}
        />
      )}

      {/* Login 0-Item Closet Reminder Modal */}
      {showLoginReminder && (
        <LoginClosetReminderModal
          isOpen={true}
          user={user}
          onClose={() => {
            setDismissedLoginReminder(true);
            sessionStorage.setItem('dressapp_dismissed_login_reminder', 'true');
          }}
        />
      )}
    </div>
  );
};
