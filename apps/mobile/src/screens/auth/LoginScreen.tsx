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
import { Image } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

  // ── Process OAuth token from URL (either openAuthSessionAsync or OS deep link) ──
  const processAuthUrl = async (url: string) => {
    if (!url) return false;
    try {
      console.log('[LoginScreen] Processing auth URL:', url);
      let token: string | null = null;
      let errCode: string | null = null;

      if (url.includes('#')) {
        const fragment = url.split('#')[1] ?? '';
        const params = new URLSearchParams(fragment);
        token = params.get('token');
        errCode = params.get('error');
      }
      if (!token && url.includes('?')) {
        const query = url.split('?')[1]?.split('#')[0] ?? '';
        const params = new URLSearchParams(query);
        token = params.get('token');
        errCode = params.get('error');
      }

      // Regex fallback if query parser missed it
      if (!token) {
        const tokenMatch = url.match(/[?&#]token=([^&#]+)/);
        if (tokenMatch) token = decodeURIComponent(tokenMatch[1]);
      }
      if (!errCode) {
        const errMatch = url.match(/[?&#]error=([^&#]+)/);
        if (errMatch) errCode = decodeURIComponent(errMatch[1]);
      }

      if (errCode) {
        Alert.alert(t('common.error', { defaultValue: 'Error' }), errCode);
        return true;
      }
      if (token) {
        try {
          WebBrowser.dismissBrowser();
        } catch {}
        await tokenStore.set(token);
        emitAuthChange(true);
        return true;
      }
    } catch (e) {
      console.warn('[LoginScreen] processAuthUrl error:', e);
    }
    return false;
  };

  // ── Deep link listener ───────────────────────────────────────────────────
  React.useEffect(() => {
    const handleUrl = (url: string | null) => {
      if (!url) return;
      // Capture ?ref= or &ref= from deep link or invitation
      try {
        const refMatch = url.match(/[?&]ref=([^&#]+)/);
        if (refMatch && refMatch[1] && refMatch[1] !== 'invite') {
          AsyncStorage.setItem('dressapp_ref_id', decodeURIComponent(refMatch[1])).catch(() => {});
        }
      } catch {}
      processAuthUrl(url);
    };

    // Check initial cold launch URL
    Linking.getInitialURL().then(handleUrl);

    // Listen for incoming URLs while app is open
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));

    return () => sub.remove();
  }, []);

  // ── Google OAuth flow ─────────────────────────────────────────────────────
  const handleGoogleSignIn = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const returnUrl = Linking.createURL('auth/callback');
      console.log('[LoginScreen] OAuth returnUrl:', returnUrl);
      const storedRef = await AsyncStorage.getItem('dressapp_ref_id').catch(() => null);
      const data = await api.googleLoginStart({ mobile: true, returnUrl, ref: storedRef || '' });
      if (!data?.authorization_url) {
        throw new Error('No authorization URL returned from server.');
      }
      console.log('[LoginScreen] Opening authorization_url:', data.authorization_url.substring(0, 100));

      const result = await WebBrowser.openAuthSessionAsync(
        data.authorization_url,
        returnUrl,
      );

      if (result.type === 'success' && result.url) {
        await processAuthUrl(result.url);
      }
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        ?? (err as { message?: string })?.message
        ?? t('auth.signInError', { defaultValue: 'Sign-in failed. Please try again.' });
      Alert.alert(t('common.error', { defaultValue: 'Error' }), detail);
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
          {/* ── Editorial Image Hero ───────────────────────────────── */}
          <View style={s.heroContainer}>
            <Image
              source={require('@mobile/assets/img/loginimg.webp')}
              style={s.heroImage}
              contentFit="cover"
            />
            <View style={s.heroOverlay} />
            <View style={s.taglineCard}>
              <Text style={s.taglineTitle}>
                {t('auth.tagline', { defaultValue: 'Your AI wardrobe' })}
              </Text>
              <Text style={s.taglineSubtitle} numberOfLines={2}>
                {t('auth.editorial', { defaultValue: 'Effortless style powered by artificial intelligence.' })}
              </Text>
            </View>
          </View>

          {/* ── Brand header ─────────────────────────────────────────── */}
          <View style={s.brandBlock}>
            <Text style={s.brandName} accessibilityRole="header">
              DressApp
            </Text>
          </View>

          {/* ── Card ─────────────────────────────────────────────────── */}
          <View style={s.card}>
            <Text style={s.heading}>{t('auth.welcomeBack', { defaultValue: 'Welcome back' })}</Text>
            <Text style={s.sub}>{t('auth.signInSub', { defaultValue: 'Sign in to continue to DressApp' })}</Text>

            {/* Google button */}
            <Button
              testID="login-google-button"
              mode="contained"
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
              {t('auth.continueWithGoogle', { defaultValue: 'Continue with Google' })}
            </Button>

            {/* Divider */}
            <View style={s.dividerRow}>
              <View style={s.dividerLine} />
              <Text style={s.dividerText}>{t('common.or', { defaultValue: 'or' })}</Text>
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
              {t('auth.noAccount', { defaultValue: "Don't have an account? Register" })}
            </Button>
          </View>
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
      paddingHorizontal: spacing[5],
      paddingVertical: spacing[6],
      justifyContent: 'center',
    },

    // Hero image
    heroContainer: {
      width: '100%',
      height: 190,
      borderRadius: radii.xl,
      overflow: 'hidden',
      marginBottom: spacing[5],
      position: 'relative',
      ...shadows.md,
    },
    heroImage: {
      width: '100%',
      height: '100%',
    },
    heroOverlay: {
      ...StyleSheet.absoluteFill,
      backgroundColor: 'rgba(0,0,0,0.25)',
    },
    taglineCard: {
      position: 'absolute',
      bottom: 12,
      left: 12,
      right: 12,
      backgroundColor: 'rgba(255, 255, 255, 0.92)',
      borderRadius: radii.lg,
      paddingHorizontal: 14,
      paddingVertical: 10,
      shadowColor: '#000',
      shadowOpacity: 0.1,
      shadowOffset: { width: 0, height: 2 },
      shadowRadius: 4,
      elevation: 3,
    },
    taglineTitle: {
      fontFamily: fonts.bodyBold,
      fontSize: 13,
      fontWeight: '700',
      color: '#1F5C45',
      marginBottom: 2,
    },
    taglineSubtitle: {
      fontFamily: fonts.bodyMedium,
      fontSize: 11,
      fontStyle: 'italic',
      color: '#666666',
      lineHeight: 15,
    },

    // Brand block
    brandBlock: {
      alignItems: 'center',
      marginBottom: spacing[4],
    },
    brandName: {
      fontFamily: fonts.displayBold,
      fontSize: fontSizes['3xl'],
      color: '#1F5C45',
      fontWeight: '800',
      letterSpacing: -0.5,
    },

    // Card
    card: {
      backgroundColor: colors.card,
      borderRadius: radii.xl,
      padding: spacing[6],
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.md,
    },
    heading: {
      fontFamily: fonts.displayBold,
      fontSize: fontSizes['2xl'],
      fontWeight: '700',
      color: colors.foreground,
      marginBottom: spacing[1],
    },
    sub: {
      fontFamily: fonts.body,
      fontSize: fontSizes.xs,
      color: colors.mutedFg,
      marginBottom: spacing[5],
    },

    // Google button
    googleBtn: {
      borderRadius: radii.full,
      backgroundColor: '#1F5C45',
      shadowColor: '#1F5C45',
      shadowOpacity: 0.25,
      shadowOffset: { width: 0, height: 2 },
      shadowRadius: 4,
      elevation: 2,
    },
    googleBtnContent: {
      height: 48,
      flexDirection: 'row-reverse',
    },
    googleBtnLabel: {
      fontFamily: fonts.bodyBold,
      fontSize: fontSizes.sm,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    googleGlyph: {
      fontFamily: fonts.bodySemiBold,
      fontSize: fontSizes.base,
      color: '#FAD459',
    },

    // Divider
    dividerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: spacing[4],
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
      borderRadius: radii.full,
    },
    ghostLabel: {
      fontFamily: fonts.bodySemiBold,
      fontSize: fontSizes.xs,
      color: '#1F5C45',
    },
  });
