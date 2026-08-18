/**
 * apps/mobile/src/screens/auth/AuthCallbackScreen.tsx
 *
 * Auth — OAuth callback screen (deep-link landing).
 *
 * Mirrors apps/web/src/pages/AuthCallback.jsx for native.
 *
 * ── How the flow works ───────────────────────────────────────────────────────
 *  1. LoginScreen opens Google OAuth via expo-web-browser.
 *  2. The backend exchanges the Google code for a DressApp JWT and redirects
 *     the user to the deep link:
 *       dressapp://auth/callback#token=<jwt>&next=...
 *     OR (on error):
 *       dressapp://auth/callback#error=<error_code>
 *  3. Expo-web-browser / Linking detects the redirect, dismisses the browser,
 *     and routes to this screen.
 *  4. We read `token` from the URL hash fragment via Linking.getInitialURL(),
 *     store the token in SecureStore, and emit the auth-change event so the
 *     RootNavigator switches to the Main stack.
 *
 * ── Key differences from web ──────────────────────────────────────────────
 *  - No window.location.hash — we use Linking.getInitialURL() to get the raw
 *    deep-link URL, then manually parse the fragment with URLSearchParams.
 *  - No window.history.replaceState — not needed on native.
 *  - No `toast` (sonner) — we use Alert for errors; success is silent.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii, shadows } from '@mobile/theme/tokens';
import { tokenStore } from '@mobile/lib/api';
import { emitAuthChange } from '@mobile/hooks/useAuthState';
import type { AuthStackParamList } from '@mobile/navigation/types';

type CallbackNavProp = NativeStackNavigationProp<AuthStackParamList, 'AuthCallback'>;

export default function AuthCallbackScreen({ route }: { route?: { params?: Record<string, string> } }) {
  const { t } = useTranslation();
  const navigation = useNavigation<CallbackNavProp>();
  const { colors }  = useTheme();

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // StrictMode / Suspense double-invoke guard (mirrors web's ranRef).
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const processUrlOrParams = (rawUrl?: string | null, routeParams?: Record<string, string>) => {
      try {
        let token = routeParams?.token;
        let errCode = routeParams?.error;

        if (!token && !errCode && rawUrl) {
          // Parse fragment first, fallback to query string
          const fragment = rawUrl.includes('#') ? rawUrl.split('#')[1] : '';
          const query = rawUrl.includes('?') ? rawUrl.split('?')[1].split('#')[0] : '';
          const fragmentParams = new URLSearchParams(fragment);
          const queryParams = new URLSearchParams(query);

          token = fragmentParams.get('token') || queryParams.get('token') || undefined;
          errCode = fragmentParams.get('error') || queryParams.get('error') || undefined;
        }

        if (errCode) {
          setErrorMsg(errCode);
          return true;
        }
        if (token) {
          tokenStore.set(token);
          emitAuthChange(true);
          return true;
        }
      } catch (err: unknown) {
        const detail =
          (err as { message?: string })?.message ?? 'callback_failed';
        setErrorMsg(detail);
        tokenStore.clear();
        return true;
      }
      return false;
    };

    // 1. Check route params directly (from React Navigation linking)
    if (route?.params && processUrlOrParams(undefined, route.params)) {
      return;
    }

    // 2. Check initial launch URL
    Linking.getInitialURL().then((initialUrl) => {
      if (initialUrl && processUrlOrParams(initialUrl)) {
        return;
      }

      // If no initial URL processed, wait briefly for incoming URL event
      const timer = setTimeout(() => {
        setErrorMsg((prev) => (prev === null ? 'missing_token' : prev));
      }, 2000);

      return () => clearTimeout(timer);
    });

    // 3. Listen for incoming deep link events while app is open
    const subscription = Linking.addEventListener('url', ({ url }) => {
      processUrlOrParams(url);
    });

    return () => {
      subscription.remove();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route?.params]);

  const s = makeStyles(colors);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe} testID="auth-callback-screen">
      <View style={s.center}>
        <View style={s.card}>
          {errorMsg === null ? (
            // ── Loading state ─────────────────────────────────────────────
            <>
              <ActivityIndicator
                testID="auth-callback-spinner"
                size="large"
                color={colors.accent}
                style={s.spinner}
              />
              <Text style={s.heading}>
                {t('auth.finishingSignIn', 'Finishing sign-in…')}
              </Text>
              <Text style={s.sub}>
                {t(
                  'auth.finishingSignInSub',
                  'Hang tight, we\'re setting up your account.',
                )}
              </Text>
            </>
          ) : (
            // ── Error state ───────────────────────────────────────────────
            <>
              {/* Error icon — text glyph as a lightweight stand-in */}
              <Text
                testID="auth-callback-error-icon"
                style={s.errorIcon}
                accessibilityLabel={t('auth.signInFailed', 'Sign-in failed')}
              >
                ⚠️
              </Text>
              <Text style={s.heading}>
                {t('auth.signInFailed', 'Sign-in failed')}
              </Text>
              <Text
                testID="auth-callback-error-message"
                style={s.errorCode}
              >
                {errorMsg}
              </Text>
              <Button
                testID="auth-callback-back-to-login"
                mode="contained"
                onPress={() => navigation.navigate('Login')}
                style={s.backBtn}
                labelStyle={s.backBtnLabel}
              >
                {t('auth.backToLogin', 'Back to sign-in')}
              </Button>
            </>
          )}
        </View>
      </View>
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
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing[6],
    },
    card: {
      width: '100%',
      maxWidth: 400,
      backgroundColor: colors.card,
      borderRadius: radii.xl,
      padding: spacing[8],
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.md,
    },

    // Loading state
    spinner: {
      marginBottom: spacing[5],
    },
    heading: {
      fontFamily: fonts.displayBold,
      fontSize: fontSizes['2xl'],
      color: colors.foreground,
      textAlign: 'center',
      marginBottom: spacing[2],
    },
    sub: {
      fontFamily: fonts.body,
      fontSize: fontSizes.sm,
      color: colors.mutedFg,
      textAlign: 'center',
    },

    // Error state
    errorIcon: {
      fontSize: 40,
      marginBottom: spacing[4],
    },
    errorCode: {
      fontFamily: fonts.body,
      fontSize: fontSizes.sm,
      color: colors.destructive,
      textAlign: 'center',
      marginVertical: spacing[4],
      paddingHorizontal: spacing[2],
    },
    backBtn: {
      marginTop: spacing[2],
      borderRadius: radii.md,
      backgroundColor: colors.accent,
      minWidth: 180,
    },
    backBtnLabel: {
      fontFamily: fonts.bodySemiBold,
      fontSize: fontSizes.base,
      color: colors.accentFg,
    },
  });
