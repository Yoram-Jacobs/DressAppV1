/**
 * apps/mobile/src/screens/auth/LoginScreen.tsx
 *
 * Auth — Login screen.
 *
 * Mirrors apps/web/src/pages/Login.jsx for native.
 * Auth strategy: Google OAuth only (same as web).
 *   1. Call api.googleLoginStart() → get authorization_url from backend.
 *   2. Open the URL with expo-web-browser's openAuthSessionAsync.
 *   3. The backend redirects to dressapp://auth/callback?code=…&state=…
 *   4. AuthCallbackScreen handles the deep link and stores the token.
 *
 * No email/password form — the web app dropped it in favour of
 * Google-only sign-in too (Login.jsx only shows GoogleAuthButton).
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii, shadows } from '@mobile/theme/tokens';
import { api, tokenStore } from '@mobile/lib/api';
import { emitAuthChange } from '@mobile/lib/authEvents';
import type { AuthStackParamList } from '@mobile/navigation/types';

// Ensure the browser session is dismissed when the app regains focus (iOS).
WebBrowser.maybeCompleteAuthSession();

type LoginNavProp = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

// ─── Google "G" SVG mark ─────────────────────────────────────────────────────
// Inlined as a small unicode placeholder; replace with a proper <Svg> asset
// if the design system ships an SVG icon set.
const GOOGLE_LABEL = 'G  ';

export default function LoginScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<LoginNavProp>();
  const { colors } = useTheme();

  const [busy, setBusy] = useState(false);

  // ── Google OAuth flow ─────────────────────────────────────────────────────
  const handleGoogleSignIn = async () => {
    if (busy) return;
    setBusy(true);
    try {
      // BUG FIX: auth.js returns the parsed body directly (not an axios
      // response wrapper), so `const { data } = ...` gave data=undefined.
      const data = await api.googleLoginStart({ mobile: true });
      if (!data?.authorization_url) {
        throw new Error('No authorization URL returned from server.');
      }

      // Use Linking.createURL to get the correct return URL for the
      // current build type (dev client vs standalone vs Expo Go).
      const returnUrl = Linking.createURL('auth/callback');
      console.log('[LoginScreen] OAuth returnUrl:', returnUrl);
      console.log('[LoginScreen] Opening authorization_url:', data.authorization_url.substring(0, 100));

      // Opens Google's consent screen in Chrome Custom Tab.
      // Backend (mobile=true) redirects to dressapp://auth/callback#token=...
      // openAuthSessionAsync intercepts the dressapp:// URL and returns it.
      const result = await WebBrowser.openAuthSessionAsync(
        data.authorization_url,
        returnUrl,
      );

      if (result.type === 'success' && result.url) {
        const fragment = result.url.split('#')[1] ?? '';
        const params  = new URLSearchParams(fragment);
        const token   = params.get('token');
        const errCode = params.get('error');

        if (errCode) throw new Error(errCode);
        if (!token)  throw new Error('No token received from sign-in.');

        await tokenStore.set(token);
        emitAuthChange(true);
      }
      // result.type === 'cancel' | 'dismiss': user closed browser — silent.
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        ?? (err as { message?: string })?.message
        ?? t('auth.signInError', 'Sign-in failed. Please try again.');
      Alert.alert(t('common.error', 'Error'), detail);
    } finally {
      setBusy(false);
    }
  };

  const s = makeStyles(colors);

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        style={s.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Brand header ─────────────────────────────────────────── */}
          <View style={s.brandBlock}>
            <Text style={s.brandName} accessibilityRole="header">
              DressApp
            </Text>
            <Text style={s.tagline}>{t('auth.tagline', 'Your AI wardrobe')}</Text>
          </View>

          {/* ── Card ─────────────────────────────────────────────────── */}
          <View style={s.card}>
            <Text style={s.heading}>{t('auth.welcomeBack', 'Welcome back')}</Text>
            <Text style={s.sub}>{t('auth.signInSub', 'Sign in to continue to DressApp')}</Text>

            {/* Google button */}
            <Button
              testID="login-google-button"
              mode="outlined"
              icon={() => (
                <Text style={s.googleGlyph}>{GOOGLE_LABEL}</Text>
              )}
              onPress={handleGoogleSignIn}
              loading={busy}
              disabled={busy}
              style={s.googleBtn}
              contentStyle={s.googleBtnContent}
              labelStyle={s.googleBtnLabel}
            >
              {t('auth.continueWithGoogle', 'Continue with Google')}
            </Button>

            {/* Divider */}
            <View style={s.dividerRow}>
              <View style={s.dividerLine} />
              <Text style={s.dividerText}>{t('common.or', 'or')}</Text>
              <View style={s.dividerLine} />
            </View>

            {/* Navigate to register */}
            <Button
              testID="login-register-link-button"
              mode="text"
              onPress={() => navigation.navigate('Register')}
              labelStyle={s.ghostLabel}
              style={s.ghostBtn}
            >
              {t('auth.noAccount', "Don't have an account? Register")}
            </Button>
          </View>

          {/* ── Editorial footnote ───────────────────────────────────── */}
          <Text style={s.editorial}>{t('auth.editorial', '')}</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const makeStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.background,
    },
    kav: {
      flex: 1,
    },
    scroll: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingHorizontal: spacing[6],
      paddingVertical: spacing[10],
    },

    // Brand block
    brandBlock: {
      alignItems: 'center',
      marginBottom: spacing[8],
    },
    brandName: {
      fontFamily: fonts.displayBold,
      fontSize: fontSizes['4xl'],
      color: colors.foreground,
      letterSpacing: -1,
    },
    tagline: {
      fontFamily: fonts.body,
      fontSize: fontSizes.sm,
      color: colors.mutedFg,
      marginTop: spacing[1],
      textTransform: 'uppercase',
      letterSpacing: 1.2,
    },

    // Card
    card: {
      backgroundColor: colors.card,
      borderRadius: radii.xl,
      padding: spacing[7],
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.md,
    },
    heading: {
      fontFamily: fonts.displayBold,
      fontSize: fontSizes['3xl'],
      color: colors.foreground,
      lineHeight: fontSizes['3xl'] * 1.05,
      marginBottom: spacing[2],
    },
    sub: {
      fontFamily: fonts.body,
      fontSize: fontSizes.sm,
      color: colors.mutedFg,
      marginBottom: spacing[6],
    },

    // Google button
    googleBtn: {
      borderRadius: radii.md,
      borderColor: colors.border,
      borderWidth: 1,
    },
    googleBtnContent: {
      height: 48,
      flexDirection: 'row-reverse',
    },
    googleBtnLabel: {
      fontFamily: fonts.bodySemiBold,
      fontSize: fontSizes.base,
      color: colors.foreground,
    },
    googleGlyph: {
      fontFamily: fonts.bodySemiBold,
      fontSize: fontSizes.base,
      color: '#4285F4',
    },

    // Divider
    dividerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: spacing[5],
      gap: spacing[3],
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: colors.border,
    },
    dividerText: {
      fontFamily: fonts.body,
      fontSize: fontSizes.xs,
      color: colors.mutedFg,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },

    // Ghost / text buttons
    ghostBtn: {
      marginTop: spacing[1],
    },
    ghostLabel: {
      fontFamily: fonts.body,
      fontSize: fontSizes.sm,
      color: colors.accent,
    },

    // Editorial footnote
    editorial: {
      fontFamily: fonts.body,
      fontSize: fontSizes.xs,
      color: colors.mutedFg,
      textAlign: 'center',
      marginTop: spacing[8],
      paddingHorizontal: spacing[4],
    },
  });
