import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { StylistStackParamList } from '../types';
import { useTheme } from '@mobile/theme';
import { fonts } from '@mobile/theme/tokens';

import { StylistScreen } from '@mobile/screens/stylist/StylistScreen';
import { OutfitsScreen } from '@mobile/screens/closet/OutfitsScreen';
import { AvatarScreen } from '@mobile/screens/closet/AvatarScreen';
import { SharedOutfitScreen } from '@mobile/screens/closet/SharedOutfitScreen';
import { ItemDetailScreen } from '@mobile/screens/closet/ItemDetailScreen';

const Stack = createNativeStackNavigator<StylistStackParamList>();

export function StylistStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Stylist" component={StylistScreen} />
      <Stack.Screen name="Outfits" component={OutfitsScreen} />
      <Stack.Screen name="Avatar" component={AvatarScreen} />
      <Stack.Screen name="SharedOutfit" component={SharedOutfitScreen} />
      <Stack.Screen name="ItemDetail" component={ItemDetailScreen} />
    </Stack.Navigator>
  );
}
