import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { ClosetStackParamList } from '../types';
import { useTheme } from '@mobile/theme';
import { fonts } from '@mobile/theme/tokens';

import { ClosetScreen } from '@mobile/screens/closet/ClosetScreen';
import { ItemDetailScreen } from '@mobile/screens/closet/ItemDetailScreen';
import { ClosetAddScreen } from '@mobile/screens/closet/ClosetAddScreen';
import { DppScannerScreen } from '@mobile/screens/closet/DppScannerScreen';
import { AvatarScreen } from '@mobile/screens/closet/AvatarScreen';
import { SharedOutfitScreen } from '@mobile/screens/closet/SharedOutfitScreen';

const Stack = createNativeStackNavigator<ClosetStackParamList>();

export function ClosetStack() {
  const { colors } = useTheme();
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Closet" component={ClosetScreen} />
      <Stack.Screen name="ItemDetail" component={ItemDetailScreen} />
      <Stack.Screen name="ClosetAdd" component={ClosetAddScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="DppScanner" component={DppScannerScreen} options={{ presentation: 'fullScreenModal' }} />
      <Stack.Screen name="Avatar" component={AvatarScreen} />
      <Stack.Screen name="SharedOutfit" component={SharedOutfitScreen} />
    </Stack.Navigator>
  );
}
