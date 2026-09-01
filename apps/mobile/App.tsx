/**
 * apps/mobile/App.tsx
 *
 * DressApp — Native Android Application Entry Point.
 * Targets Android 16 (API Level 36).
 * Sets up safe area context, theme provider, paper provider,
 * custom Google Fonts, language hydration, and the root navigation tree.
 */

import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, LogBox } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider as PaperProvider } from 'react-native-paper';
import {
  useFonts,
  PlayfairDisplay_400Regular,
  PlayfairDisplay_400Regular_Italic,
  PlayfairDisplay_700Bold,
} from '@expo-google-fonts/playfair-display';
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import {
  Heebo_400Regular,
  Heebo_500Medium,
  Heebo_600SemiBold,
  Heebo_700Bold,
  Heebo_800ExtraBold,
} from '@expo-google-fonts/heebo';
import {
  Cairo_400Regular,
  Cairo_600SemiBold,
  Cairo_700Bold,
} from '@expo-google-fonts/cairo';

import { ThemeProvider, useTheme } from './src/theme';
import { RootNavigator } from './src/navigation/RootNavigator';
import { hydrateLanguage } from './src/lib/i18n';
import './src/lib/i18n';

LogBox.ignoreLogs([
  '[expo-av]: Expo AV has been deprecated',
  'Expo AV has been deprecated',
]);

function AppContent() {
  const { isDark, colors } = useTheme();

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} translucent />
      <PaperProvider>
        <RootNavigator />
      </PaperProvider>
    </>
  );
}

export function App() {
  const [fontsLoaded, fontError] = useFonts({
    PlayfairDisplay_400Regular,
    PlayfairDisplay_400Regular_Italic,
    PlayfairDisplay_700Bold,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
    Heebo_400Regular,
    Heebo_500Medium,
    Heebo_600SemiBold,
    Heebo_700Bold,
    Heebo_800ExtraBold,
    Cairo_400Regular,
    Cairo_600SemiBold,
    Cairo_700Bold,
  });

  const [langHydrated, setLangHydrated] = useState(false);

  useEffect(() => {
    let mounted = true;
    const fallbackTimer = setTimeout(() => {
      if (mounted) setLangHydrated(true);
    }, 1200);

    hydrateLanguage().finally(() => {
      if (mounted) {
        clearTimeout(fallbackTimer);
        setLangHydrated(true);
      }
    });

    return () => {
      mounted = false;
      clearTimeout(fallbackTimer);
    };
  }, []);

  if (!fontsLoaded && !fontError && !langHydrated) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2d8f7f" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#FAF8F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default App;
