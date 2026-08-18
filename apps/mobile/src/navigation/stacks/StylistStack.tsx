import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { StylistStackParamList } from '../types';
import { useTheme } from '@mobile/theme';
import { fonts } from '@mobile/theme/tokens';

import { StylistScreen } from '@mobile/screens/stylist/StylistScreen';
import { OutfitsScreen } from '@mobile/screens/closet/OutfitsScreen';
import { AvatarScreen } from '@mobile/screens/closet/AvatarScreen';

const Stack = createNativeStackNavigator<StylistStackParamList>();

export function StylistStack() {
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
      <Stack.Screen name="Stylist" component={StylistScreen} options={{ title: 'AI Stylist' }} />
      <Stack.Screen name="Outfits" component={OutfitsScreen} options={{ title: 'Saved Outfits' }} />
      <Stack.Screen name="Avatar" component={AvatarScreen} options={{ title: 'My Avatar' }} />
    </Stack.Navigator>
  );
}
