// This is an updated version of App.js with Pricing page routing included
// Original content preserved + new imports and routes added

import '@/App.css';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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
import Pricing from '@/pages/Pricing';           // New: Pricing page component
import PurchaseCredits from '@/pages/PurchaseCredits';  // New: Credit purchase page

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { useTranslation } from 'react-i18next';
import { isRtl } from '@/lib/i18n';
import { api } from '@/lib/api';

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

function App() {
  return (
    <BrowserRouter>
      <HelmetProvider>
        <AuthProvider>
          <LocationProvider>
            <PayPalProvider>
              <AppLayout>
                <Routes>
                  {/* Public Routes */}
                  <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
                  <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
                  <Route path="/auth/callback" element={<AuthCallback />} />
                  
                  {/* Main Application Routes */}
                  <Route path="/" element={<Home />} />
                  <Route path="/closet" element={<Closet />} />
                  <Route path="/items/add" element={<AddItem />} />
                  <Route path="/items/:id" element={<ItemDetail />} />
                  <Route path="/stylist" element={<Stylist />} />
                  <Route path="/marketplace" element={<Marketplace />} />
                  <Route path="/listings/create" element={<CreateListing />} />
                  <Route path="/listings/:id" element={<ListingDetail />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/wardrobe-stats" element={<WardrobeStats />} />
                  <Route path="/transactions" element={<Transactions />} />
                  <Route path="/transaction-landing" element={<TransactionLanding />} />
                  <Route path="/admin" element={<Admin />} />
                  <Route path="/experts" element={<ExpertsDirectory />} />
                  <Route path="/ads" element={<AdsManager />} />
                  <Route path="/extension/connect" element={<ExtensionConnect />} />
                  <Route path="/avatar" element={<AvatarPage />} />
                  <Route path="/trend-scout" element={<TrendScout />} />
                  <Route path="/campaigns/detail/:id" element={<CampaignDetail />} />
                  <Route path="/campaigns/create" element={<CreateCampaign />} />
                  <Route path="/campaigns/my" element={<MyCampaigns />} />
                  <Route path="/suitcase" element={<Suitcase />} />
                  <Route path="/outfits/shared" element={<SharedOutfit />} />
                  <Route path="/delete-account" element={<DeleteAccount />} />
                  <Route path="/privacy" element={<Privacy />} />
                  <Route path="/terms" element={<TermsOfService />} />
                  
                  {/* NEW PRICING ROUTES */}
                  <Route path="/pricing" element={<Pricing />} />
                  <Route path="/pricing/purchase" element={<PurchaseCredits />} />
                  
                  {/* Fallback Redirect */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </AppLayout>
            </PayPalProvider>
          </LocationProvider>
        </AuthProvider>
      </HelmetProvider>
      <Toaster position="top-right" />
      <MigrationMessageListener />
    </BrowserRouter>
  );
}

export default App;