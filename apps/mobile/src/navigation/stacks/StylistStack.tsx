import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { StylistStackParamList } from '../types';
import { useTheme } from '@mobile/theme';
import { fonts } from '@mobile/theme/tokens';
import { ScreenLoader } from '../ScreenLoader';

const StylistScreen = React.lazy(() => import('@mobile/screens/stylist/StylistScreen').then(m => ({ default: m.StylistScreen })));
const OutfitsScreen = React.lazy(() => import('@mobile/screens/closet/OutfitsScreen').then(m => ({ default: m.OutfitsScreen })));
const AvatarScreen = React.lazy(() => import('@mobile/screens/closet/AvatarScreen').then(m => ({ default: m.AvatarScreen })));

const Stack = createNativeStackNavigator<StylistStackParamList>();

export function StylistStack() {
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
        <Stack.Screen name="Stylist" component={StylistScreen as any} options={{ title: 'AI Stylist' }} />
        <Stack.Screen name="Outfits" component={OutfitsScreen as any} options={{ title: 'Saved Outfits' }} />
        <Stack.Screen name="Avatar" component={AvatarScreen as any} options={{ title: 'My Avatar' }} />
      </Stack.Navigator>
    </React.Suspense>
  );
}
