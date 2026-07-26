import '@/App.css';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/lib/auth';
import { LocationProvider } from '@/lib/location';
import { PayPalProvider } from '@/lib/paypal';
import { AppLayout } from '@/components/AppLayout';
import { PublicOnly } from '@/components/PublicOnly';
import { SeoBase } from '@/components/SeoBase';
import { LanguageSwitchOverlay } from '@/components/LanguageSwitchOverlay';
import { WorkProgressFloater } from '@/components/WorkProgressFloater';
import { WorkBatchDoneToast } from '@/components/WorkBatchDoneToast';

import Login from '@/pages/Login';
import Register from '@/pages/Register';
import AuthCallback from '@/pages/AuthCallback';
import Home from '@/pages/Home';
import Closet from '@/pages/Closet';
import AddItem from '@/pages/AddItem';
import ItemDetail from '@/pages/ItemDetail';
import Stylist from '@/pages/Stylist';
import Marketplace from '@/pages/Marketplace';
import CreateListing from '@/pages/CreateListing';
import ListingDetail from '@/pages/ListingDetail';
import Profile from '@/pages/Profile';
import WardrobeStats from '@/pages/WardrobeStats';
import Transactions from '@/pages/Transactions';
import TransactionLanding from '@/pages/TransactionLanding';
import Admin from '@/pages/Admin';
import ExpertsDirectory from '@/pages/ExpertsDirectory';
import AdsManager from '@/pages/AdsManager';
import ExtensionConnect from '@/pages/ExtensionConnect';
import AvatarPage from '@/pages/AvatarPage';
import TrendScout from '@/pages/TrendScout';
import CampaignDetail from '@/pages/CampaignDetail';
import CreateCampaign from '@/pages/CreateCampaign';
import MyCampaigns from '@/pages/MyCampaigns';
import Suitcase from '@/pages/Suitcase';
import SharedOutfit from '@/pages/SharedOutfit';
import DeleteAccount from '@/pages/DeleteAccount';

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { useTranslation } from 'react-i18next';
import { isRtl } from '@/lib/i18n';
import { api } from '@/lib/api';

/** Global listener for migration postMessage events from the bookmarklet popup.
 *  Collects streamed cards and on DRESSAPP_MIGRATION_COMPLETE saves them
 *  to the closet DB, then kicks off the Stylist re-analysis worker. */
function MigrationMessageListener() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    const collectedCards = [];

    const handleMessage = (event) => {
      const msg = event.data;
      if (!msg || !msg.type) return;

      if (msg.type === 'DRESSAPP_MIGRATION_STREAM') {
        const { cards } = msg;
        if (cards && cards.length > 0) {
          collectedCards.push(...cards);
          console.log(`[MigrationListener] STREAM batch: ${cards.length} cards (total: ${collectedCards.length})`);
        }
        return;
      }

      if (msg.type === 'DRESSAPP_MIGRATION_COMPLETE') {
        const { total_cards, app_name } = msg;
        if (!total_cards || total_cards === 0) return;

        const cardsWithImages = collectedCards.filter(c => c.crop_base64);
        const appName = app_name || 'Competitor App';
        console.log(`[MigrationListener] COMPLETE: total_cards=${total_cards}, collected=${collectedCards.length}, withImages=${cardsWithImages.length}, app=${appName}`);
        collectedCards.length = 0;

        if (cardsWithImages.length > 0) {
          // DB-backed pipeline: save crops + kick off Stylist re-analyze in ONE call
          (async () => {
            try {
              toast.info(t('migration.saving', { defaultValue: `Saving ${cardsWithImages.length} items to your closet...` }));

              // Single atomic call: saves crops to DB AND starts Stylist worker
              const result = await api.saveMigrationCrops({ app_name: appName, cards: cardsWithImages });
              console.log(`[MigrationListener] Saved ${result.items_saved} items, Stylist job: ${result.job_id}`);

              toast.success(t('migration.saved', { defaultValue: `${result.items_saved} items saved. Stylist is analysing them — details update automatically.` }));

              // Navigate to closet so user can see items appearing
              navigate('/closet');
            } catch (err) {
              console.error('[MigrationListener] Pipeline error:', err);
              toast.error(t('migration.error', { defaultValue: 'Migration failed. Please try again.' }));
            }
          })();
        }
        return;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [navigate, t]);

  return null;
}
function GlobalScrollListener() {
  useEffect(() => {
    const handleScroll = () => {
      toast.dismiss();
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);
  return null;
}

function OutfitsRedirect() {
  const location = useLocation();
  const search = location.search;
  return <Navigate to={`/stylist?tab=match${search ? '&' + search.substring(1) : ''}`} replace />;
}

function ReferrerTracker() {
  const location = useLocation();
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const ref = params.get('ref');
    if (ref && ref !== 'invite') {
      sessionStorage.setItem('referrer_id', ref);
    }
  }, [location]);
  return null;
}

function App() {
  const { t, i18n } = useTranslation();

  useEffect(() => {
    document.documentElement.dir = isRtl(i18n.language) ? 'rtl' : 'ltr';
  }, [i18n.language]);

  return (
    <HelmetProvider>
      <AuthProvider>
        <LocationProvider>
          <PayPalProvider>
            <BrowserRouter>
              <ReferrerTracker />
              <GlobalScrollListener />
              <MigrationMessageListener />
              <SeoBase />
              <LanguageSwitchOverlay />
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:start-2 focus:z-[1000] focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:rounded-lg"
            data-testid="skip-to-content-link"
          >
            {t('nav.skipToContent', { defaultValue: 'Skip to main content' })}
          </a>
          <Routes>
            <Route element={<PublicOnly />}>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
            </Route>
            {/* OAuth callback — outside PublicOnly so it can install the
                token and forward, regardless of current auth state. */}
            <Route path="/auth/callback" element={<AuthCallback />} />
            {/* Public Shared Outfit view */}
            <Route path="/shared/:id" element={<SharedOutfit />} />
            {/*
             * Chrome-extension auth bridge: rendered standalone (no
             * AppLayout chrome) so it works when opened from the
             * extension popup as a tiny window.
             */}
            <Route path="/extension/connect" element={<ExtensionConnect />} />
            <Route element={<AppLayout />}>
              <Route path="/home" element={<Home />} />
              <Route path="/closet" element={<Closet />} />
              <Route path="/suitcase" element={<Suitcase />} />
              <Route path="/closet/add" element={<AddItem />} />
              <Route path="/closet/:id" element={<ItemDetail />} />
              <Route path="/stylist" element={<Stylist />} />
              <Route path="/outfits" element={<OutfitsRedirect />} />
              <Route path="/market" element={<Marketplace />} />
              <Route path="/market/create" element={<CreateListing />} />
              <Route path="/market/:id" element={<ListingDetail />} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/transactions/:id/landing" element={<TransactionLanding />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/experts" element={<ExpertsDirectory />} />
              <Route path="/campaigns/create" element={<CreateCampaign />} />
              <Route path="/campaigns/mine" element={<MyCampaigns />} />
              <Route path="/campaigns/:id" element={<CampaignDetail />} />
              <Route path="/ads" element={<AdsManager />} />
              <Route path="/me" element={<Profile />} />
              <Route path="/delete-account" element={<DeleteAccount />} />
              <Route path="/me/stats" element={<WardrobeStats />} />
              <Route path="/trends" element={<TrendScout />} />
              <Route path="/avatar" element={<AvatarPage />} />
              <Route path="/" element={<Navigate to="/home" replace />} />
            </Route>
            <Route path="*" element={<Navigate to="/home" replace />} />
          </Routes>
          <Toaster position="top-center" richColors closeButton className="mt-14 sm:mt-0" />
          <WorkProgressFloater />
          <WorkBatchDoneToast />
          </BrowserRouter>
          </PayPalProvider>
        </LocationProvider>
      </AuthProvider>
    </HelmetProvider>
  );
}

export default App;
