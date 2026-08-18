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

const Stack = createNativeStackNavigator<MarketStackParamList>();

export function MarketStack() {
  const { colors } = useTheme();
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.foreground,
        headerTitleStyle: { fontFamily: fonts.display, fontSize: 18 },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="Marketplace" component={MarketplaceScreen} options={{ title: 'Marketplace' }} />
      <Stack.Screen name="ListingDetail" component={ListingDetailScreen} options={{ title: '' }} />
      <Stack.Screen name="CreateListing" component={CreateListingScreen} options={{ title: 'Create Listing', presentation: 'modal' }} />
      <Stack.Screen name="Transactions" component={TransactionsScreen} options={{ title: 'Transactions' }} />
      <Stack.Screen name="TransactionLanding" component={TransactionLandingScreen} options={{ title: '' }} />
    </Stack.Navigator>
  );
}
