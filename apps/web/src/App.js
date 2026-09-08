import '@/App.css';
import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/lib/auth';
import { LocationProvider } from '@/lib/location';
import { PayPalProvider } from '@/lib/paypal';
import { AppLayout } from '@/components/AppLayout';
import { PublicOnly } from '@/components/PublicOnly';
import { PageLoadingFallback } from '@/components/ui/PageLoadingFallback';
import { WorkProgressFloater } from '@/components/WorkProgressFloater';
import { WorkBatchDoneToast } from '@/components/WorkBatchDoneToast';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { isRtl } from '@/lib/i18n';
import { api } from '@/lib/api';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ScrollRestoration } from '@/components/ScrollRestoration';

// Synchronously loaded core routes for zero-latency initial load
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import AuthCallback from '@/pages/AuthCallback';
import Home from '@/pages/Home';
import Closet from '@/pages/Closet';

// Lazy-loaded secondary routes for optimal code-splitting
const AddItem = lazy(() => import('@/pages/AddItem'));
const ItemDetail = lazy(() => import('@/pages/ItemDetail'));
const Stylist = lazy(() => import('@/pages/Stylist'));
const Marketplace = lazy(() => import('@/pages/Marketplace'));
const CreateListing = lazy(() => import('@/pages/CreateListing'));
const ListingDetail = lazy(() => import('@/pages/ListingDetail'));
const Profile = lazy(() => import('@/pages/Profile'));
const WardrobeStats = lazy(() => import('@/pages/WardrobeStats'));
const Transactions = lazy(() => import('@/pages/Transactions'));
const TransactionLanding = lazy(() => import('@/pages/TransactionLanding'));
const Admin = lazy(() => import('@/pages/Admin'));
const ExpertsDirectory = lazy(() => import('@/pages/ExpertsDirectory'));
const AdsManager = lazy(() => import('@/pages/AdsManager'));
const ExtensionConnect = lazy(() => import('@/pages/ExtensionConnect'));
const AvatarPage = lazy(() => import('@/pages/AvatarPage'));
const TrendScout = lazy(() => import('@/pages/TrendScout'));
const CampaignDetail = lazy(() => import('@/pages/CampaignDetail'));
const CreateCampaign = lazy(() => import('@/pages/CreateCampaign'));
const MyCampaigns = lazy(() => import('@/pages/MyCampaigns'));
const Suitcase = lazy(() => import('@/pages/Suitcase'));
const SharedOutfit = lazy(() => import('@/pages/SharedOutfit'));
const DeleteAccount = lazy(() => import('@/pages/DeleteAccount'));
const Privacy = lazy(() => import('@/pages/Privacy'));
const TermsOfService = lazy(() => import('@/pages/TermsOfService'));
const Pricing = lazy(() => import('@/pages/Pricing'));
const MockAtzmaiPayment = lazy(() => import('@/pages/MockAtzmaiPayment'));

/** Global listener for migration postMessage events from the bookmarklet popup. */
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
        }
        return;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [navigate, t]);

  return null;
}

/** Global listener to capture referral ID from ?ref= query parameter on landing */
function ReferralParamListener() {
  useEffect(() => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const refId = searchParams.get('ref');
      if (refId && refId !== 'invite') {
        localStorage.setItem('dressapp_ref_id', refId);
      }
    } catch {
      /* noop */
    }
  }, []);
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
      <ScrollRestoration />
      <ReferralParamListener />
      <HelmetProvider>
        <AuthProvider>
          <LocationProvider>
            <PayPalProvider>
              <ErrorBoundary>
                <Suspense fallback={<PageLoadingFallback />}>
                  <Routes>
                    {/* Public routes that don't require auth/layout */}
                    <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
                    <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
                    <Route path="/auth/callback" element={<AuthCallback />} />
                    <Route path="/mock-atzmai-payment-link" element={<MockAtzmaiPayment />} />
                    
                    {/* Extension bridge route */}
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
                      <Route path="/pricing" element={<Pricing />} />
                    </Route>
                    
                    {/* Fallback route */}
                    <Route path="*" element={<Navigate to="/home" replace />} />
                  </Routes>
                </Suspense>
              </ErrorBoundary>
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