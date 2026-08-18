import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { MeStackParamList } from '../types';
import { useTheme } from '@mobile/theme';
import { fonts } from '@mobile/theme/tokens';
import { ScreenLoader } from '../ScreenLoader';

const ProfileScreen = React.lazy(() => import('@mobile/screens/me/ProfileScreen').then(m => ({ default: m.ProfileScreen })));
const WardrobeStatsScreen = React.lazy(() => import('@mobile/screens/me/WardrobeStatsScreen').then(m => ({ default: m.WardrobeStatsScreen })));
const DeleteAccountScreen = React.lazy(() => import('@mobile/screens/me/DeleteAccountScreen').then(m => ({ default: m.DeleteAccountScreen })));
const PrivacyScreen = React.lazy(() => import('@mobile/screens/me/PrivacyScreen').then(m => ({ default: m.PrivacyScreen })));
const TermsScreen = React.lazy(() => import('@mobile/screens/me/TermsScreen').then(m => ({ default: m.TermsScreen })));
const PricingScreen = React.lazy(() => import('@mobile/screens/me/PricingScreen').then(m => ({ default: m.PricingScreen })));
const SuitcaseScreen = React.lazy(() => import('@mobile/screens/me/SuitcaseScreen').then(m => ({ default: m.SuitcaseScreen })));
const TrendScoutScreen = React.lazy(() => import('@mobile/screens/me/TrendScoutScreen').then(m => ({ default: m.TrendScoutScreen })));
const ExpertsDirectoryScreen = React.lazy(() => import('@mobile/screens/me/ExpertsDirectoryScreen').then(m => ({ default: m.ExpertsDirectoryScreen })));
const MyCampaignsScreen = React.lazy(() => import('@mobile/screens/me/MyCampaignsScreen').then(m => ({ default: m.MyCampaignsScreen })));
const CreateCampaignScreen = React.lazy(() => import('@mobile/screens/me/CreateCampaignScreen').then(m => ({ default: m.CreateCampaignScreen })));
const CampaignDetailScreen = React.lazy(() => import('@mobile/screens/me/CampaignDetailScreen').then(m => ({ default: m.CampaignDetailScreen })));
const EyesDownloadScreen = React.lazy(() => import('@mobile/screens/settings/EyesDownloadScreen').then(m => ({ default: m.EyesDownloadScreen })));

const Stack = createNativeStackNavigator<MeStackParamList>();

export function MeStack() {
  const { colors } = useTheme();
  const screenOpts = {
    headerStyle: { backgroundColor: colors.background },
    headerTintColor: colors.foreground,
    headerTitleStyle: { fontFamily: fonts.display, fontSize: 18 },
    headerShadowVisible: false,
  };
  return (
    <React.Suspense fallback={<ScreenLoader />}>
      <Stack.Navigator screenOptions={screenOpts}>
        <Stack.Screen name="Profile" component={ProfileScreen as any} options={{ title: 'Profile' }} />
        <Stack.Screen name="WardrobeStats" component={WardrobeStatsScreen as any} options={{ title: 'Wardrobe Insights' }} />
        <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen as any} options={{ title: 'Delete Account' }} />
        <Stack.Screen name="Privacy" component={PrivacyScreen as any} options={{ title: 'Privacy Policy' }} />
        <Stack.Screen name="Terms" component={TermsScreen as any} options={{ title: 'Terms of Service' }} />
        <Stack.Screen name="Pricing" component={PricingScreen as any} options={{ title: 'Pricing' }} />
        <Stack.Screen name="Suitcase" component={SuitcaseScreen as any} options={{ title: 'Suitcase Packing' }} />
        <Stack.Screen name="TrendScout" component={TrendScoutScreen as any} options={{ title: 'Trend Scout' }} />
        <Stack.Screen name="ExpertsDirectory" component={ExpertsDirectoryScreen as any} options={{ title: 'Style Experts' }} />
        <Stack.Screen name="Campaigns" component={MyCampaignsScreen as any} options={{ title: 'My Campaigns', headerShown: false }} />
        <Stack.Screen name="CreateCampaign" component={CreateCampaignScreen as any} options={{ title: 'Create Campaign', presentation: 'modal' }} />
        <Stack.Screen name="CampaignDetail" component={CampaignDetailScreen as any} options={{ title: '' }} />
        <Stack.Screen name="EyesDownload" component={EyesDownloadScreen as any} options={{ title: 'Eyes AI — On Device' }} />
      </Stack.Navigator>
    </React.Suspense>
  );
}
