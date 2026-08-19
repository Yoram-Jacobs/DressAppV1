/**
 * apps/mobile/src/navigation/RootNavigator.tsx
 *
 * Root navigation tree. Chooses between AuthStack and MainTabs
 * based on authentication state. Wires the navigation ref for the
 * API adapter's onUnauthorized callback.
 *
 * NOTE: Deep link handling (`linking` prop) was REMOVED because it caused
 * a blank screen after OAuth. The OAuth redirect URL (dressapp://auth/callback)
 * maps to Auth.AuthCallback in the linking config, but after login
 * isAuthenticated=true removes the Auth stack from the tree. NavigationContainer
 * can't resolve the pending deep link to any screen → empty state → black screen.
 * OAuth deep links are handled directly by openAuthSessionAsync in LoginScreen.
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { setNavigationRef } from '@mobile/lib/api';
import type { RootStackParamList } from './types';

import { AuthStack } from './stacks/AuthStack';
import { MainTabs } from './MainTabs';
import { useAuthState } from '@mobile/hooks/useAuthState';

const Root = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const navRef = useNavigationContainerRef<RootStackParamList>();
  const { isAuthenticated, isLoading } = useAuthState();

  // Wire the API adapter so onUnauthorized can navigate to Auth
  useEffect(() => {
    setNavigationRef(navRef);
  }, [navRef]);

  // Show a visible loading state instead of null (prevents black screen)
  if (isLoading) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  return (
    <NavigationContainer ref={navRef}>
      <Root.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <Root.Screen name="Main" component={MainTabs} />
        ) : (
          <Root.Screen name="Auth" component={AuthStack} />
        )}
      </Root.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: '#FAF8F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
});
