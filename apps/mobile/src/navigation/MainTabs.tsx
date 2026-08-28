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
import { TouchableOpacity, View, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

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
function CaptureFab(props: any) {
  const nav = useNavigation<any>();
  const { colors } = useTheme();
  return (
    <View style={[props.style, { alignItems: 'center', justifyContent: 'center' }]} pointerEvents="box-none">
      <TouchableOpacity
        style={[
          styles.fab,
          {
            backgroundColor: colors.accent,
            marginBottom: Math.max(props.bottomInset || 0, 4) + 12,
          },
        ]}
        onPress={() =>
          nav.navigate('ClosetTab', {
            screen: 'ClosetAdd',
            params: { source: 'camera' },
          })
        }
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Add clothing item"
      >
        <Icon source="camera" size={26} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

// Tab icon helper
function tabIcon(source: string, focused: boolean, color: string) {
  let iconName = source;
  if (source === 'hanger') {
    iconName = 'hanger';
  } else if (source === 'stylist') {
    iconName = focused ? 'creation' : 'creation-outline';
  } else if (source === 'market') {
    iconName = focused ? 'store' : 'store-outline';
  } else if (source === 'me') {
    iconName = focused ? 'account' : 'account-outline';
  } else {
    iconName = focused ? source : `${source}-outline`;
  }
  return <Icon source={iconName} size={22} color={color} />;
}

// Main Tabs Navigator
export function MainTabs() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 0);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.mutedFg,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          paddingBottom: bottomInset > 0 ? bottomInset + 4 : 8,
          paddingTop: 8,
          height: 60 + bottomInset,
          elevation: 12,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.08,
          shadowRadius: 6,
        },
        tabBarLabelStyle: {
          fontFamily: fonts.bodyMedium,
          fontSize: 10.5,
          marginTop: 2,
        },
        tabBarItemStyle: {
          justifyContent: 'center',
          alignItems: 'center',
        },
      }}
    >
      <Tab.Screen
        name="ClosetTab"
        component={ClosetStack}
        options={{
          tabBarLabel: t('nav.closet', { defaultValue: 'Closet' }),
          tabBarIcon: ({ focused, color }) => tabIcon('hanger', focused, color),
        }}
      />
      <Tab.Screen
        name="StylistTab"
        component={StylistStack}
        options={{
          tabBarLabel: t('nav.stylist', { defaultValue: 'Stylist' }),
          tabBarIcon: ({ focused, color }) => tabIcon('stylist', focused, color),
        }}
      />
      <Tab.Screen
        name="Capture"
        component={EmptyScreen}
        options={{
          tabBarLabel: '',
          tabBarButton: (props) => <CaptureFab {...props} bottomInset={bottomInset} />,
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
          tabBarLabel: t('nav.market', { defaultValue: 'Market' }),
          tabBarIcon: ({ focused, color }) => tabIcon('market', focused, color),
        }}
      />
      <Tab.Screen
        name="MeTab"
        component={MeStack}
        options={{
          tabBarLabel: t('nav.me', { defaultValue: 'Me' }),
          tabBarIcon: ({ focused, color }) => tabIcon('me', focused, color),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  fab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
});
