import { Outlet, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
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

export const AppLayout = () => {
  const { user, loading } = useAuth();

  // Eager warm-up for closet, marketplace browse + my-listings,
  // experts directory, and traveling suitcase.
  //
  // We fire these the moment auth resolves, **before** the user
  // navigates anywhere. By the time they tap any of those tabs the
  // store is already hydrated and the page paints instantly. All
  // prewarms are idempotent + best-effort — failures don't surface
  // to the UI, the page-driven ``ensure`` call retries.
  //
  // We also reset every store on logout so a different user's data
  // never leaks across sessions on the same browser.
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
      resetNavigation();
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

          const registerSub = async (subscription) => {
            try {
              await api.subscribeWebPush(subscription.toJSON());
            } catch (err) {
              console.warn('Failed to register web push on server', err);
            }
          };

          if (sub) {
            // Already subscribed on this device, ensure it's registered on the server
            await registerSub(sub);
          } else if (
            Notification.permission === 'granted' || 
            (user?.scheduler_settings?.enabled && Notification.permission === 'default')
          ) {
            // Either already granted permission, OR scheduler is enabled and permission is default (prompt).
            if (Notification.permission === 'default') {
              const permission = await Notification.requestPermission();
              if (permission !== 'granted') return;
            }
            const res = await api.getVapidKey();
            const pubKey = urlBase64ToUint8Array(res.public_key);
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

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="page-shell">
      <LanguageSync />
      <TopNav />
      <LocationBanner />
      <main id="main-content" tabIndex={-1} className="flex-1 pb-safe-tabs md:pb-10">
        <Outlet />
      </main>
      <BottomTabs />
    </div>
  );
};
