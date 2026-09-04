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
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { setNavigationRef } from '@mobile/lib/api';
import type { RootStackParamList } from './types';

import { AuthStack } from './stacks/AuthStack';
import { MainTabs } from './MainTabs';
import { useAuthState } from '@mobile/hooks/useAuthState';
import { WorkProgressFloater } from '@mobile/components/WorkProgressFloater';
import { WorkBatchDoneToast } from '@mobile/components/WorkBatchDoneToast';
import { HelpModal } from '@mobile/components/help';
import { prewarmAllStores, resetAllStores } from '@mobile/lib/stores';
import { useUniversalSync } from '@mobile/hooks/useUniversalSync';

const Root = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { t } = useTranslation();
  const navRef = useNavigationContainerRef<RootStackParamList>();
  const { isAuthenticated, isLoading } = useAuthState();
  const prevAuthRef = React.useRef<boolean | null>(null);

  // Global cross-device real-time sync
  useUniversalSync(isAuthenticated);

  // Eager prewarm all database loading screens when authenticated
  useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated) {
      prewarmAllStores().catch(() => {});
    } else {
      resetAllStores();
    }
  }, [isAuthenticated, isLoading]);

  // Wire the API adapter so onUnauthorized can navigate to Auth
  useEffect(() => {
    setNavigationRef(navRef);
  }, [navRef]);

  // Atomically reset navigation stack ONLY when auth state actually transitions
  useEffect(() => {
    if (!isLoading && navRef.isReady()) {
      if (prevAuthRef.current !== null && prevAuthRef.current !== isAuthenticated) {
        const targetRoute = isAuthenticated ? 'Main' : 'Auth';
        navRef.reset({
          index: 0,
          routes: [{ name: targetRoute }],
        });
      }
      prevAuthRef.current = isAuthenticated;
    }
  }, [isAuthenticated, isLoading, navRef]);

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#2F7972" />
        <Text style={styles.loadingText}>
          {t('common.loadingDressApp', { defaultValue: 'Loading DressApp…' })}
        </Text>
      </View>
    );
  }

  return (
    <NavigationContainer ref={navRef}>
      <Root.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
        {isAuthenticated ? (
          <Root.Screen name="Main" component={MainTabs} />
        ) : (
          <Root.Screen name="Auth" component={AuthStack} />
        )}
      </Root.Navigator>
      <WorkProgressFloater />
      <WorkBatchDoneToast />
      <HelpModal />
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
