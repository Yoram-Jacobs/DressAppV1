import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { MeStackParamList } from '../types';
import { useTheme } from '@mobile/theme';
import { fonts } from '@mobile/theme/tokens';

import { ProfileScreen } from '@mobile/screens/me/ProfileScreen';
import { WardrobeStatsScreen } from '@mobile/screens/me/WardrobeStatsScreen';
import { DeleteAccountScreen } from '@mobile/screens/me/DeleteAccountScreen';
import { PrivacyScreen } from '@mobile/screens/me/PrivacyScreen';
import { TermsScreen } from '@mobile/screens/me/TermsScreen';
import { PricingScreen } from '@mobile/screens/me/PricingScreen';
import { SuitcaseScreen } from '@mobile/screens/me/SuitcaseScreen';
import { TrendScoutScreen } from '@mobile/screens/me/TrendScoutScreen';
import { ExpertsDirectoryScreen } from '@mobile/screens/me/ExpertsDirectoryScreen';
import { MyCampaignsScreen } from '@mobile/screens/me/MyCampaignsScreen';
import { CreateCampaignScreen } from '@mobile/screens/me/CreateCampaignScreen';
import { CampaignDetailScreen } from '@mobile/screens/me/CampaignDetailScreen';
import { EyesDownloadScreen } from '@mobile/screens/settings/EyesDownloadScreen';

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
    <Stack.Navigator screenOptions={screenOpts}>
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
      <Stack.Screen name="WardrobeStats" component={WardrobeStatsScreen} options={{ title: 'Wardrobe Insights' }} />
      <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} options={{ title: 'Delete Account' }} />
      <Stack.Screen name="Privacy" component={PrivacyScreen} options={{ title: 'Privacy Policy' }} />
      <Stack.Screen name="Terms" component={TermsScreen} options={{ title: 'Terms of Service' }} />
      <Stack.Screen name="Pricing" component={PricingScreen} options={{ title: 'Pricing' }} />
      <Stack.Screen name="Suitcase" component={SuitcaseScreen} options={{ title: 'Suitcase Packing' }} />
      <Stack.Screen name="TrendScout" component={TrendScoutScreen} options={{ title: 'Trend Scout' }} />
      <Stack.Screen name="ExpertsDirectory" component={ExpertsDirectoryScreen} options={{ title: 'Style Experts' }} />
      <Stack.Screen name="Campaigns" component={MyCampaignsScreen} options={{ title: 'My Campaigns', headerShown: false }} />
      <Stack.Screen name="CreateCampaign" component={CreateCampaignScreen} options={{ title: 'Create Campaign', presentation: 'modal' }} />
      <Stack.Screen name="CampaignDetail" component={CampaignDetailScreen} options={{ title: '' }} />
      <Stack.Screen name="EyesDownload" component={EyesDownloadScreen} options={{ title: 'Eyes AI — On Device' }} />
    </Stack.Navigator>
  );
}
