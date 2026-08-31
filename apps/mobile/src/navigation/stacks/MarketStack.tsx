import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { MarketStackParamList } from '../types';
import { useTheme } from '@mobile/theme';
import { fonts } from '@mobile/theme/tokens';

import { MarketplaceScreen } from '@mobile/screens/market/MarketplaceScreen';
import { ListingDetailScreen } from '@mobile/screens/market/ListingDetailScreen';
import { CreateListingScreen } from '@mobile/screens/market/CreateListingScreen';
import { TransactionsScreen } from '@mobile/screens/market/TransactionsScreen';
import { TransactionLandingScreen } from '@mobile/screens/market/TransactionLandingScreen';
import { AdsManagerScreen } from '@mobile/screens/market/AdsManagerScreen';
import { MockAtzmaiPaymentScreen } from '@mobile/screens/market/MockAtzmaiPaymentScreen';

const Stack = createNativeStackNavigator<MarketStackParamList>();

export function MarketStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Marketplace" component={MarketplaceScreen} />
      <Stack.Screen name="ListingDetail" component={ListingDetailScreen} />
      <Stack.Screen name="CreateListing" component={CreateListingScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="Transactions" component={TransactionsScreen} />
      <Stack.Screen name="TransactionLanding" component={TransactionLandingScreen} />
      <Stack.Screen name="AdsManager" component={AdsManagerScreen} />
      <Stack.Screen name="MockAtzmaiPayment" component={MockAtzmaiPaymentScreen} options={{ presentation: 'modal' }} />
    </Stack.Navigator>
  );
}
