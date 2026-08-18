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

const Stack = createNativeStackNavigator<ClosetStackParamList>();

export function ClosetStack() {
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
      <Stack.Screen name="Closet" component={ClosetScreen} options={{ title: 'My Closet' }} />
      <Stack.Screen name="ItemDetail" component={ItemDetailScreen} options={{ title: '' }} />
      <Stack.Screen name="ClosetAdd" component={ClosetAddScreen} options={{ title: 'Add Item', presentation: 'modal' }} />
      <Stack.Screen name="DppScanner" component={DppScannerScreen} options={{ title: '', headerTransparent: true, headerTintColor: '#fff', presentation: 'fullScreenModal' }} />
      <Stack.Screen name="Avatar" component={AvatarScreen} options={{ title: 'My Avatar' }} />
    </Stack.Navigator>
  );
}
