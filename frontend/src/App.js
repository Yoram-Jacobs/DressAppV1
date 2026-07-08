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
import Suitcase from '@/pages/Suitcase';
import SharedOutfit from '@/pages/SharedOutfit';

import { useEffect } from 'react';
import { toast } from 'sonner';

import { useTranslation } from 'react-i18next';
import { isRtl } from '@/lib/i18n';
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
              <Route path="/ads" element={<AdsManager />} />
              <Route path="/me" element={<Profile />} />
              <Route path="/me/stats" element={<WardrobeStats />} />
              <Route path="/trends" element={<TrendScout />} />
              <Route path="/avatar" element={<AvatarPage />} />
              <Route path="/" element={<Navigate to="/home" replace />} />
            </Route>
            <Route path="*" element={<Navigate to="/home" replace />} />
          </Routes>
          <Toaster position="top-center" richColors closeButton className="mt-14 sm:mt-0" />
          <GlobalScrollListener />
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
