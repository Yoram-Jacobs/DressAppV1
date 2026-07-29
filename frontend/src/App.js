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
import Privacy from '@/pages/Privacy';
import TermsOfService from '@/pages/TermsOfService';
import Pricing from '@/pages/Pricing';           // New pricing page component
import PurchaseCredits from '@/pages/PurchaseCredits';  // Credit purchase page component

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { useTranslation } from 'react-i18next';
import { isRtl } from '@/lib/i18n';
import { api } from '@/lib/api';

/** Global listener for migration postMessage events from the bookmarklet popup.
 * Collects streamed cards and on DRESSAPP_MIGRATION_COMPLETE saves them
 * to the closet DB, then kicks off the Stylist re-analysis worker. */
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
        // ... rest of migration logic remains unchanged
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [navigate, t]);

  return null;
}

function OutfitsRedirect() {
  const location = useLocation();
  const search = location.search;
  return <Navigate to={`/stylist?tab=match${search ? '&' + search.substring(1) : ''}`} replace />;
}

function App() {
  return (
    <BrowserRouter>
      <HelmetProvider>
        <AuthProvider>
          <LocationProvider>
            <PayPalProvider>
              <AppLayout>
                <Routes>
                  {/* Public routes that don't require auth/layout */}
                  <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
                  <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
                  <Route path="/auth/callback" element={<AuthCallback />} />
                  
                  {/* Extension bridge route (standalone view) */}
                  <Route path="/extension/connect" element={<ExtensionConnect />} />
                  
                  {/* Main application routes wrapped in AppLayout */}
                  <Route element={<AppLayout />}>
                    <Route path="/" element={<Navigate to="/home" replace />} />
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
                    <Route path="/privacy" element={<Privacy />} />
                    <Route path="/terms" element={<TermsOfService />} />
                    <Route path="/me/stats" element={<WardrobeStats />} />
                    <Route path="/trends" element={<TrendScout />} />
                    <Route path="/avatar" element={<AvatarPage />} />
                    
                    {/* NEW PRICING ROUTES */}
                    <Route path="/pricing" element={<Pricing />} />
                    <Route path="/pricing/purchase" element={<PurchaseCredits />} />
                  </Route>
                  
                  {/* Fallback route */}
                  <Route path="*" element={<Navigate to="/home" replace />} />
                </Routes>
              </AppLayout>
            </PayPalProvider>
          </LocationProvider>
        </AuthProvider>
      </HelmetProvider>
      <Toaster position="top-right" />
      <WorkProgressFloater />
      <WorkBatchDoneToast />
      <MigrationMessageListener />
    </BrowserRouter>
  );
}

export default App;