/**
 * apps/mobile/src/screens/auth/RegisterScreen.tsx
 *
 * Auth — Register screen.
 *
 * Mirrors apps/web/src/pages/Register.jsx for native.
 *
 * The web Register.jsx is intentionally minimal — it only exposes the
 * same GoogleAuthButton as Login.jsx (no email/password form).
 * We honour that here: register == initiate Google OAuth.
 * On success the deep-link lands in AuthCallbackScreen which stores the
 * token and emits the auth change event; from there RootNavigator
 * switches to the Main stack automatically.
 *
 * The "already have an account?" link navigates back to Login.
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as WebBrowser from 'expo-web-browser';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii, shadows } from '@mobile/theme/tokens';
import { api, tokenStore } from '@mobile/lib/api';
import { emitAuthChange } from '@mobile/lib/authEvents';
import type { AuthStackParamList } from '@mobile/navigation/types';

WebBrowser.maybeCompleteAuthSession();

type RegisterNavProp = NativeStackNavigationProp<AuthStackParamList, 'Register'>;

const GOOGLE_LABEL = 'G  ';

export default function RegisterScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<RegisterNavProp>();
  const { colors } = useTheme();

  const [busy, setBusy] = useState(false);

  // ── Google OAuth flow (same as login — backend creates account on first use) ──
  const handleGoogleSignUp = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const storedRef = await AsyncStorage.getItem('dressapp_ref_id').catch(() => null);
      const data = await api.googleLoginStart({ mobile: true, ref: storedRef || '' });
      if (!data?.authorization_url) {
        throw new Error('No authorization URL returned from server.');
      }
      const result = await WebBrowser.openAuthSessionAsync(
        data.authorization_url,
        'dressapp://auth/callback',
      );

      if (result.type === 'success' && result.url) {
        const fragment = result.url.split('#')[1] ?? '';
        const params = new URLSearchParams(fragment);
        const token = params.get('token');
        const errCode = params.get('error');

        if (errCode) throw new Error(errCode);
        if (!token) throw new Error('No token received from sign-up.');

        await tokenStore.set(token);
        emitAuthChange(true);
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ??
        (err as { message?: string })?.message ??
        t('auth.signInError', { defaultValue: 'Sign-up failed. Please try again.' });
      Alert.alert(t('common.error', { defaultValue: 'Error' }), msg);
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
            <Text style={s.tagline}>{t('auth.tagline', { defaultValue: 'Your AI wardrobe' })}</Text>
          </View>

          {/* ── Card ─────────────────────────────────────────────────── */}
          <View style={s.card}>
            <Text style={s.heading}>
              {t('auth.createAccount', { defaultValue: 'Create account' })}
            </Text>
            <Text style={s.sub}>
              {t('auth.registerSub', { defaultValue: 'Join DressApp — it only takes a second' })}
            </Text>

            {/* Google sign-up */}
            <Button
              testID="register-google-button"
              mode="outlined"
              icon={() => (
                <Text style={s.googleGlyph}>{GOOGLE_LABEL}</Text>
              )}
              onPress={handleGoogleSignUp}
              loading={busy}
              disabled={busy}
              style={s.googleBtn}
              contentStyle={s.googleBtnContent}
              labelStyle={s.googleBtnLabel}
            >
              {t('auth.continueWithGoogle', { defaultValue: 'Continue with Google' })}
            </Button>

            {/* Back to login */}
            <View style={s.loginRow}>
              <Text style={s.loginPrompt}>
                {t('auth.alreadyHaveAccount', { defaultValue: 'Already have an account?' })}{' '}
              </Text>
              <Button
                testID="register-login-link"
                mode="text"
                compact
                onPress={() => navigation.navigate('Login')}
                labelStyle={s.loginLinkLabel}
                style={s.loginLinkBtn}
              >
                {t('auth.signInLink', { defaultValue: 'Sign in' })}
              </Button>
            </View>
          </View>

          {/* ── Terms footnote ───────────────────────────────────────── */}
          <Text style={s.terms}>
            {t('auth.termsBySigningUp', { defaultValue: 'By signing up you agree to our Terms of Service and Privacy Policy.' })}
          </Text>
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

    // Login row
    loginRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing[6],
      flexWrap: 'wrap',
    },
    loginPrompt: {
      fontFamily: fonts.body,
      fontSize: fontSizes.sm,
      color: colors.mutedFg,
    },
    loginLinkBtn: {
      marginVertical: 0,
      marginHorizontal: 0,
      padding: 0,
      minWidth: 0,
    },
    loginLinkLabel: {
      fontFamily: fonts.bodySemiBold,
      fontSize: fontSizes.sm,
      color: colors.accent,
      textDecorationLine: 'underline',
    },

    // Terms
    terms: {
      fontFamily: fonts.body,
      fontSize: fontSizes.xs,
      color: colors.mutedFg,
      textAlign: 'center',
      marginTop: spacing[8],
      paddingHorizontal: spacing[4],
      lineHeight: fontSizes.xs * 1.6,
    },
  });
