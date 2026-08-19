/**
 * apps/mobile/src/screens/me/ProfileScreen.tsx
 *
 * Core loop: api.getMe() → show name, email, subscription tier.
 * Quick links to WardrobeStats, Suitcase, TrendScout, Pricing, Terms, Privacy, DeleteAccount.
 * api.patchMe() for name/language editing — basic inline form.
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, I18nManager, TextInput as RNTextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii } from '@mobile/theme/tokens';
import { api } from '@mobile/lib/api';
import { emitAuthChange } from '@mobile/hooks/useAuthState';
import { tokenStore } from '@mobile/lib/api';
import type { MeStackParamList } from '@mobile/navigation/types';

type MeNavProp = NativeStackNavigationProp<MeStackParamList, 'Profile'>;

interface User {
  id?: string;
  name?: string;
  email?: string;
  subscription_tier?: string;
  language?: string;
  credits?: number;
}

function NavRow({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) {
  const { colors } = useTheme();
  const isRtl = I18nManager.isRTL;
  return (
    <TouchableOpacity
      style={[navRowStyles.row, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[navRowStyles.label, { color: danger ? colors.destructive : colors.foreground }]}>{label}</Text>
      <Text style={navRowStyles.chevron}>›</Text>
    </TouchableOpacity>
  );
}
const navRowStyles = StyleSheet.create({
  row: { alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing[4], borderBottomWidth: 1, borderBottomColor: 'transparent' },
  label: { fontFamily: 'Manrope_400Regular', fontSize: 15 },
  chevron: { fontSize: 20, color: 'hsl(240,5%,45%)' },
});

export function ProfileScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<MeNavProp>();
  const { colors } = useTheme();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getMe().then((data) => { setUser(data); setNameInput(data?.name ?? ''); }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleSaveName = async () => {
    setSaving(true);
    try {
      const updated = await api.patchMe({ name: nameInput });
      setUser(updated ?? { ...user, name: nameInput });
      setEditingName(false);
    } catch (err: unknown) {
      Alert.alert(t('common.error', 'Error'), (err as { message?: string })?.message ?? 'Failed to save');
    } finally { setSaving(false); }
  };

  const handleLogout = () => {
    Alert.alert(t('profile.logoutTitle', 'Sign out'), t('profile.logoutMessage', 'Are you sure you want to sign out?'), [
      { text: t('common.cancel', 'Cancel'), style: 'cancel' },
      {
        text: t('profile.logout', 'Sign out'), style: 'destructive', onPress: () => {
          tokenStore.clear();
          emitAuthChange(false);
        },
      },
    ]);
  };

  const s = makeStyles(colors);
  const isRtl = I18nManager.isRTL;

  if (loading) return <SafeAreaView style={[s.root, s.center]}><ActivityIndicator color={colors.accent} size="large" /></SafeAreaView>;

  const initials = user?.name?.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2) ?? '?';

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Avatar + name */}
        <View style={s.avatarBlock}>
          <View style={s.avatar}><Text style={s.avatarText}>{initials}</Text></View>
          {editingName ? (
            <View style={[s.nameEditRow, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
              <RNTextInput
                style={s.nameInput}
                value={nameInput}
                onChangeText={setNameInput}
                autoFocus
                textAlign={isRtl ? 'right' : 'left'}
              />
              <TouchableOpacity style={s.saveBtn} onPress={handleSaveName} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.saveBtnText}>{t('common.save', 'Save')}</Text>}
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={() => setEditingName(true)}>
              <Text style={s.userName}>{user?.name ?? t('profile.noName', 'Tap to set name')}</Text>
            </TouchableOpacity>
          )}
          <Text style={s.userEmail}>{user?.email ?? ''}</Text>
          {user?.subscription_tier && (
            <View style={s.tierBadge}>
              <Text style={s.tierText}>{user.subscription_tier.toUpperCase()}</Text>
            </View>
          )}
          {user?.credits != null && (
            <Text style={s.credits}>{user.credits} {t('profile.credits', 'credits')}</Text>
          )}
        </View>

        {/* Navigation links */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>{t('profile.wardrobe', 'Wardrobe')}</Text>
          <NavRow label={t('profile.wardrobeStats', 'Wardrobe Insights')} onPress={() => navigation.navigate('WardrobeStats')} />
          <NavRow label={t('suitcase.title', 'Suitcase Packing')} onPress={() => navigation.navigate('Suitcase')} />
          <NavRow label={t('experts.title', 'Style Experts')} onPress={() => navigation.navigate('ExpertsDirectory')} />
          <NavRow label={t('campaigns.my', 'My Campaigns')} onPress={() => navigation.navigate('Campaigns')} />
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>{t('profile.account', 'Account')}</Text>
          <NavRow label={t('profile.pricing', 'Subscription & Pricing')} onPress={() => navigation.navigate('Pricing')} />
          <NavRow label={t('profile.trendScout', 'Trend Scout')} onPress={() => navigation.navigate('TrendScout')} />
          <NavRow label={t('profile.eyesAI', 'Eyes AI — On Device')} onPress={() => navigation.navigate('EyesDownload')} />
          <NavRow label={t('profile.privacy', 'Privacy Policy')} onPress={() => navigation.navigate('Privacy')} />
          <NavRow label={t('profile.terms', 'Terms of Service')} onPress={() => navigation.navigate('Terms')} />
        </View>

        <View style={s.section}>
          <NavRow label={t('profile.logout', 'Sign out')} onPress={handleLogout} danger />
          <NavRow label={t('profile.deleteAccount', 'Delete account')} onPress={() => navigation.navigate('DeleteAccount')} danger />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(c: ReturnType<typeof import('@mobile/theme').useTheme>['colors']) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    scroll: { padding: spacing[5], gap: spacing[6] },
    avatarBlock: { alignItems: 'center', gap: spacing[2] },
    avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontFamily: fonts.display, fontSize: fontSizes['3xl'], color: '#fff' },
    userName: { fontFamily: fonts.display, fontSize: fontSizes.xl, color: c.foreground },
    userEmail: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: c.mutedFg },
    tierBadge: { backgroundColor: c.accent, paddingHorizontal: spacing[3], paddingVertical: 3, borderRadius: radii.xl },
    tierText: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.xs, color: '#fff', letterSpacing: 1 },
    credits: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: c.mutedFg },
    nameEditRow: { gap: spacing[2], alignItems: 'center' },
    nameInput: {
      borderWidth: 1, borderColor: c.border, borderRadius: radii.md,
      paddingHorizontal: spacing[3], paddingVertical: spacing[2],
      fontFamily: fonts.body, fontSize: fontSizes.base, color: c.foreground,
      backgroundColor: c.background, minWidth: 160,
    },
    saveBtn: { backgroundColor: c.foreground, paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radii.md },
    saveBtnText: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: c.background },
    section: { gap: 0, borderWidth: 1, borderColor: c.border, borderRadius: radii.xl, paddingHorizontal: spacing[4], backgroundColor: c.card, overflow: 'hidden' },
    sectionTitle: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.xs, color: c.mutedFg, textTransform: 'uppercase', letterSpacing: 0.8, paddingTop: spacing[3], paddingBottom: spacing[1] },
  });
}
