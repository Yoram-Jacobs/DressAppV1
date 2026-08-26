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
import { OutfitsScreen } from '@mobile/screens/closet/OutfitsScreen';
import { AvatarScreen } from '@mobile/screens/closet/AvatarScreen';
import { SharedOutfitScreen } from '@mobile/screens/closet/SharedOutfitScreen';
import { ItemDetailScreen } from '@mobile/screens/closet/ItemDetailScreen';
import { StylistScreen } from '@mobile/screens/stylist/StylistScreen';
import { MyCampaignsScreen } from '@mobile/screens/me/MyCampaignsScreen';
import { CreateCampaignScreen } from '@mobile/screens/me/CreateCampaignScreen';
import { CampaignDetailScreen } from '@mobile/screens/me/CampaignDetailScreen';
import { EyesDownloadScreen } from '@mobile/screens/settings/EyesDownloadScreen';
import { AdminScreen } from '@mobile/screens/me/AdminScreen';
import { ExtensionConnectScreen } from '@mobile/screens/me/ExtensionConnectScreen';
import { AdsManagerScreen } from '@mobile/screens/market/AdsManagerScreen';
import { MockAtzmaiPaymentScreen } from '@mobile/screens/market/MockAtzmaiPaymentScreen';

const Stack = createNativeStackNavigator<MeStackParamList>();

export function MeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="WardrobeStats" component={WardrobeStatsScreen} />
      <Stack.Screen name="Stats" component={WardrobeStatsScreen} />
      <Stack.Screen name="Outfits" component={OutfitsScreen} />
      <Stack.Screen name="Avatar" component={AvatarScreen} />
      <Stack.Screen name="SharedOutfit" component={SharedOutfitScreen} />
      <Stack.Screen name="ItemDetail" component={ItemDetailScreen} />
      <Stack.Screen name="Stylist" component={StylistScreen} />
      <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} />
      <Stack.Screen name="Privacy" component={PrivacyScreen} />
      <Stack.Screen name="Terms" component={TermsScreen} />
      <Stack.Screen name="Pricing" component={PricingScreen} />
      <Stack.Screen name="Suitcase" component={SuitcaseScreen} />
      <Stack.Screen name="TrendScout" component={TrendScoutScreen} />
      <Stack.Screen name="ExpertsDirectory" component={ExpertsDirectoryScreen} />
      <Stack.Screen name="Experts" component={ExpertsDirectoryScreen} />
      <Stack.Screen name="Campaigns" component={MyCampaignsScreen} />
      <Stack.Screen name="CreateCampaign" component={CreateCampaignScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="CampaignDetail" component={CampaignDetailScreen} />
      <Stack.Screen name="EyesDownload" component={EyesDownloadScreen} />
      <Stack.Screen name="Admin" component={AdminScreen} />
      <Stack.Screen name="ExtensionConnect" component={ExtensionConnectScreen} />
      <Stack.Screen name="AdsManager" component={AdsManagerScreen} />
      <Stack.Screen name="MockAtzmaiPayment" component={MockAtzmaiPaymentScreen} options={{ presentation: 'modal' }} />
    </Stack.Navigator>
  );
}
