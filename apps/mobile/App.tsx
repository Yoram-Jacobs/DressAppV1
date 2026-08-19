/**
 * apps/mobile/App.tsx
 *
 * DressApp Expo entry point.
 *
 * Boot sequence:
 * 1. Load fonts (Playfair Display + Manrope via expo-google-fonts)
 * 2. Hydrate i18n language from AsyncStorage + apply RTL if needed
 * 3. Render RootNavigator (auth-gated)
 */

import React, { useEffect, useState, Component } from 'react';
import { View, Text, ScrollView, StyleSheet, Appearance, AppState, AppStateStatus } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PaperProvider, MD3LightTheme, MD3DarkTheme } from 'react-native-paper';
import { I18nextProvider } from 'react-i18next';

// Fonts
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

// App providers & navigation
import { ThemeProvider, lightColors, darkColors } from './src/theme';
import { RootNavigator } from './src/navigation/RootNavigator';
import i18n, { hydrateLanguage } from './src/lib/i18n';

// ─── Global Error Boundary ────────────────────────────────────────────────────
// Catches any render-time JS error and shows a readable crash screen
// instead of a blank black screen. Critical for diagnosing boot failures.
interface EBState { error: Error | null }
class AppErrorBoundary extends Component<{ children: React.ReactNode }, EBState> {
  state: EBState = { error: null };
  static getDerivedStateFromError(error: Error): EBState { return { error }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[DressApp] Fatal render error:', error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <View style={eb.root}>
          <Text style={eb.title}>DressApp crashed</Text>
          <ScrollView style={eb.scroll}>
            <Text style={eb.msg}>{this.state.error.message}</Text>
            <Text style={eb.stack}>{this.state.error.stack}</Text>
          </ScrollView>
        </View>
      );
    }
    return this.props.children;
  }
}
const eb = StyleSheet.create({
  root:  { flex: 1, backgroundColor: '#1a0a0a', alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { color: '#ff6b6b', fontSize: 20, fontWeight: 'bold', marginBottom: 16 },
  scroll:{ width: '100%' },
  msg:   { color: '#ffcccc', fontSize: 14, marginBottom: 12 },
  stack: { color: '#888', fontSize: 11, fontFamily: 'monospace' },
});

// ─── Eyes unload helper (lazy to avoid module-init crash) ─────────────────────
let _eyesUnload: (() => Promise<void>) | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { sharedEyes } = require('@dressapp/eyes-native') as typeof import('@dressapp/eyes-native');
  _eyesUnload = () => sharedEyes.unload();
} catch (e) {
  console.warn('[DressApp] eyes-native not available:', e);
}

export default function App() {
  const colorScheme = Appearance.getColorScheme();
  const [scheme, setScheme] = useState(colorScheme);
  const [i18nReady, setI18nReady] = useState(false);

  // Load Google Fonts — capture fontError so we don't block forever
  const [fontsLoaded, fontError] = useFonts({
    PlayfairDisplay_400Regular,
    PlayfairDisplay_400Regular_Italic,
    PlayfairDisplay_700Bold,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });

  // Hydrate language from AsyncStorage
  useEffect(() => {
    hydrateLanguage().finally(() => setI18nReady(true));
  }, []);

  // Safety timeout — never block the splash for more than 3 seconds
  useEffect(() => {
    const timer = setTimeout(() => setI18nReady(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  // Unload Eyes model when app goes to background (frees ~4 GB RAM)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if ((next === 'background' || next === 'inactive') && _eyesUnload) {
        _eyesUnload().catch(() => {/* ignore */});
      }
    });
    return () => sub.remove();
  }, []);

  // Proceed when fonts loaded (or errored) AND i18n is ready
  const isReady = (fontsLoaded || !!fontError) && i18nReady;
  if (!isReady) {
    return <View style={styles.splash} />;
  }

  // Wire react-native-paper theme to DressApp design tokens
  const isDark = scheme === 'dark';
  const colors = isDark ? darkColors : lightColors;
  const paperTheme = {
    ...(isDark ? MD3DarkTheme : MD3LightTheme),
    colors: {
      ...(isDark ? MD3DarkTheme.colors : MD3LightTheme.colors),
      primary: colors.accent,
      secondary: colors.brand,
      surface: colors.card,
      background: colors.background,
      error: colors.destructive,
      onSurface: colors.foreground,
      outline: colors.border,
    },
  };

  return (
    <AppErrorBoundary>
      <SafeAreaProvider>
        <ThemeProvider>
          <PaperProvider theme={paperTheme}>
            <I18nextProvider i18n={i18n}>
              <StatusBar style={isDark ? 'light' : 'dark'} />
              <RootNavigator />
            </I18nextProvider>
          </PaperProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </AppErrorBoundary>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: '#FAF8F5', // --background light (hsl 40 20% 98%)
  },
});
