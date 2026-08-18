/**
 * apps/mobile/src/navigation/MainTabs.tsx
 *
 * Bottom tab navigator — mirrors DressApp web's BottomTabs.jsx.
 *
 * Tab structure:
 *   Closet | Stylist | [Capture FAB] | Market | Me
 *
 * The centre "Capture" tab is a floating action button (camera icon)
 * that navigates to ClosetAdd?source=camera. It has no real screen of
 * its own — pressing it triggers a navigation action via a custom
 * tabBarButton.
 */

import React from 'react';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';

import { useTheme } from '@mobile/theme';
import { fonts } from '@mobile/theme/tokens';
import type { MainTabsParamList } from './types';

import { ClosetStack } from './stacks/ClosetStack';
import { StylistStack } from './stacks/StylistStack';
import { MarketStack } from './stacks/MarketStack';
import { MeStack } from './stacks/MeStack';

// Icons via react-native-paper
import { Icon } from 'react-native-paper';

const Tab = createBottomTabNavigator<MainTabsParamList>();

// Dummy screen component for the Capture tab placeholder
const EmptyScreen = () => <View style={{ flex: 1 }} />;

// Floating capture FAB (centre tab placeholder)
function CaptureFab() {
  const nav = useNavigation<any>();
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={[styles.fab, { backgroundColor: colors.accent }]}
      onPress={() =>
        nav.navigate('ClosetTab', {
          screen: 'ClosetAdd',
          params: { source: 'camera' },
        })
      }
      accessibilityRole="button"
      accessibilityLabel="Add clothing item"
    >
      <Icon source="camera" size={28} color="#fff" />
    </TouchableOpacity>
  );
}

// Tab icon helper
function tabIcon(source: string, focused: boolean, color: string) {
  return <Icon source={focused ? source : `${source}-outline`} size={24} color={color} />;
}

// Main Tabs Navigator
export function MainTabs() {
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.mutedFg,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          paddingBottom: 4,
          paddingTop: 4,
          height: 60,
        },
        tabBarLabelStyle: {
          fontFamily: fonts.bodyMedium,
          fontSize: 11,
          marginTop: 2,
        },
      }}
    >
      <Tab.Screen
        name="ClosetTab"
        component={ClosetStack}
        options={{
          tabBarLabel: 'Closet',
          tabBarIcon: ({ focused, color }) => tabIcon('hanger', focused, color),
        }}
      />
      <Tab.Screen
        name="StylistTab"
        component={StylistStack}
        options={{
          tabBarLabel: 'Stylist',
          tabBarIcon: ({ focused, color }) => tabIcon('auto-fix', focused, color),
        }}
      />
      <Tab.Screen
        name="Capture"
        component={EmptyScreen}
        options={{
          tabBarLabel: '',
          tabBarButton: () => <CaptureFab />,
        }}
        listeners={() => ({
          tabPress: (e) => {
            e.preventDefault();
          },
        })}
      />
      <Tab.Screen
        name="MarketTab"
        component={MarketStack}
        options={{
          tabBarLabel: 'Market',
          tabBarIcon: ({ focused, color }) => tabIcon('store', focused, color),
        }}
      />
      <Tab.Screen
        name="MeTab"
        component={MeStack}
        options={{
          tabBarLabel: 'Me',
          tabBarIcon: ({ focused, color }) => tabIcon('account', focused, color),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
});
