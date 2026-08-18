import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { ClosetStackParamList } from '../types';
import { useTheme } from '@mobile/theme';
import { fonts } from '@mobile/theme/tokens';
import { ScreenLoader } from '../ScreenLoader';

// Lazy imports — screens loaded on demand
const ClosetScreen = React.lazy(() => import('@mobile/screens/closet/ClosetScreen').then(m => ({ default: m.ClosetScreen })));
const ItemDetailScreen = React.lazy(() => import('@mobile/screens/closet/ItemDetailScreen').then(m => ({ default: m.ItemDetailScreen })));
const ClosetAddScreen = React.lazy(() => import('@mobile/screens/closet/ClosetAddScreen').then(m => ({ default: m.ClosetAddScreen })));
const DppScannerScreen = React.lazy(() => import('@mobile/screens/closet/DppScannerScreen').then(m => ({ default: m.DppScannerScreen })));
const AvatarScreen = React.lazy(() => import('@mobile/screens/closet/AvatarScreen').then(m => ({ default: m.AvatarScreen })));

const Stack = createNativeStackNavigator<ClosetStackParamList>();

export function ClosetStack() {
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
        <Stack.Screen name="Closet" component={ClosetScreen as any} options={{ title: 'My Closet' }} />
        <Stack.Screen name="ItemDetail" component={ItemDetailScreen as any} options={{ title: '' }} />
        <Stack.Screen name="ClosetAdd" component={ClosetAddScreen as any} options={{ title: 'Add Item', presentation: 'modal' }} />
        <Stack.Screen name="DppScanner" component={DppScannerScreen as any} options={{ title: '', headerTransparent: true, headerTintColor: '#fff', presentation: 'fullScreenModal' }} />
        <Stack.Screen name="Avatar" component={AvatarScreen as any} options={{ title: 'My Avatar' }} />
      </Stack.Navigator>
    </React.Suspense>
  );
}
