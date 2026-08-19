/**
 * apps/mobile/src/screens/me/DeleteAccountScreen.tsx
 * Core loop: password confirmation → api.deleteAccount() → clear token → navigate to Auth.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TextInput } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii } from '@mobile/theme/tokens';
import { api } from '@mobile/lib/api';
import { emitAuthChange } from '@mobile/hooks/useAuthState';
import { tokenStore } from '@mobile/lib/api';

export function DeleteAccountScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [password, setPassword] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleDelete = () => {
    Alert.alert(
      t('deleteAccount.confirmTitle', 'Delete account'),
      t('deleteAccount.confirmMsg', 'This will permanently delete your account and all your data. This cannot be undone.'),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('deleteAccount.confirm', 'Delete permanently'),
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await api.deleteAccount({ password: password || undefined });
              tokenStore.clear();
              emitAuthChange(false);
            } catch (err: unknown) {
              setDeleting(false);
              Alert.alert(t('common.error', 'Error'), (err as { response?: { data?: { detail?: string } }; message?: string })?.response?.data?.detail ?? 'Failed to delete account');
            }
          },
        },
      ],
    );
  };

  const s = makeStyles(colors);

  return (
    <SafeAreaView style={[s.root, s.container]}>
      <Text style={s.icon}>⚠️</Text>
      <Text style={s.title}>{t('deleteAccount.title', 'Delete account')}</Text>
      <Text style={s.subtitle}>{t('deleteAccount.subtitle', 'This action is permanent and cannot be undone. All your closet items, outfits, and preferences will be deleted.')}</Text>

      <TextInput
        label={t('deleteAccount.passwordLabel', 'Confirm your password (optional)')}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        mode="outlined"
        outlineColor={colors.border}
        activeOutlineColor={colors.destructive}
        textColor={colors.foreground}
        style={s.input}
      />

      <TouchableOpacity
        style={[s.deleteBtn, deleting && s.deleteBtnDisabled]}
        onPress={handleDelete}
        disabled={deleting}
      >
        {deleting
          ? <ActivityIndicator color="#fff" size="small" />
          : <Text style={s.deleteBtnText}>{t('deleteAccount.confirm', 'Delete my account permanently')}</Text>}
      </TouchableOpacity>
    </SafeAreaView>
  );
}

function makeStyles(c: ReturnType<typeof import('@mobile/theme').useTheme>['colors']) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    container: { padding: spacing[6], gap: spacing[4], alignItems: 'center', justifyContent: 'center' },
    icon: { fontSize: 56 },
    title: { fontFamily: fonts.display, fontSize: fontSizes['2xl'], color: c.destructive, textAlign: 'center' },
    subtitle: { fontFamily: fonts.body, fontSize: fontSizes.base, color: c.mutedFg, textAlign: 'center', lineHeight: 24 },
    input: { backgroundColor: c.background, width: '100%' },
    deleteBtn: { backgroundColor: c.destructive, borderRadius: radii.md, paddingVertical: spacing[4], paddingHorizontal: spacing[6], alignItems: 'center', width: '100%' },
    deleteBtnDisabled: { opacity: 0.6 },
    deleteBtnText: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.base, color: '#fff' },
  });
}
