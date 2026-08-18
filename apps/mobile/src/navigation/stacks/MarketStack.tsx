import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { MarketStackParamList } from '../types';
import { useTheme } from '@mobile/theme';
import { fonts } from '@mobile/theme/tokens';
import { ScreenLoader } from '../ScreenLoader';

const MarketplaceScreen = React.lazy(() => import('@mobile/screens/market/MarketplaceScreen').then(m => ({ default: m.MarketplaceScreen })));
const ListingDetailScreen = React.lazy(() => import('@mobile/screens/market/ListingDetailScreen').then(m => ({ default: m.ListingDetailScreen })));
const CreateListingScreen = React.lazy(() => import('@mobile/screens/market/CreateListingScreen').then(m => ({ default: m.CreateListingScreen })));
const TransactionsScreen = React.lazy(() => import('@mobile/screens/market/TransactionsScreen').then(m => ({ default: m.TransactionsScreen })));
const TransactionLandingScreen = React.lazy(() => import('@mobile/screens/market/TransactionLandingScreen').then(m => ({ default: m.TransactionLandingScreen })));

const Stack = createNativeStackNavigator<MarketStackParamList>();

export function MarketStack() {
  const { colors } = useTheme();
  return (
    <React.Suspense fallback={<ScreenLoader />}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.foreground,
          headerTitleStyle: { fontFamily: fonts.display, fontSize: 18 },
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="Marketplace" component={MarketplaceScreen as any} options={{ title: 'Marketplace' }} />
        <Stack.Screen name="ListingDetail" component={ListingDetailScreen as any} options={{ title: '' }} />
        <Stack.Screen name="CreateListing" component={CreateListingScreen as any} options={{ title: 'Create Listing', presentation: 'modal' }} />
        <Stack.Screen name="Transactions" component={TransactionsScreen as any} options={{ title: 'Transactions' }} />
        <Stack.Screen name="TransactionLanding" component={TransactionLandingScreen as any} options={{ title: '' }} />
      </Stack.Navigator>
    </React.Suspense>
  );
}
