/**
 * apps/mobile/src/components/profile/DemographicsSection.tsx
 *
 * Identity & Demographics accordion section for DressApp mobile.
 * Features:
 *   - First Name, Last Name, Display Name (@handle)
 *   - Email (read-only), Phone Number
 *   - Birthday (YYYY-MM-DD)
 *   - Gender Identity (Female, Male) with framed selection
 *   - Marital Status (Single, Married, Divorced, Widowed) dropdown / chips with framed selection
 *   - Occupation field
 *   - Framed borders selection feedback throughout
 */

import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii } from '@mobile/theme/tokens';

const GENDER_OPTIONS = ['female', 'male'];
const MARITAL_STATUS_OPTIONS = ['single', 'married', 'divorced', 'widowed'];

interface DemographicsProps {
  firstName: string;
  setFirstName: (val: string) => void;
  lastName: string;
  setLastName: (val: string) => void;
  displayName: string;
  setDisplayName: (val: string) => void;
  email: string;
  phone: string;
  setPhone: (val: string) => void;
  birthday: string;
  setBirthday: (val: string) => void;
  gender: string;
  setGender: (val: string) => void;
  maritalStatus: string;
  setMaritalStatus: (val: string) => void;
  occupation: string;
  setOccupation: (val: string) => void;
  city: string;
  setCity: (val: string) => void;
  country: string;
  setCountry: (val: string) => void;
  googleConnected?: boolean;
  onSyncGoogle?: () => void;
  syncingGoogle?: boolean;
}

export function DemographicsSection({
  firstName,
  setFirstName,
  lastName,
  setLastName,
  displayName,
  setDisplayName,
  email,
  phone,
  setPhone,
  birthday,
  setBirthday,
  gender,
  setGender,
  maritalStatus,
  setMaritalStatus,
  occupation,
  setOccupation,
  city,
  setCity,
  country,
  setCountry,
  googleConnected,
  onSyncGoogle,
  syncingGoogle,
}: DemographicsProps) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();

  return (
    <View style={styles.container}>
      {/* Google Profile Autofill Button */}
      {onSyncGoogle && (
        <TouchableOpacity
          style={[styles.googleSyncBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
          onPress={onSyncGoogle}
          disabled={syncingGoogle}
        >
          <Text style={[styles.googleSyncText, { color: colors.accent }]}>
            {syncingGoogle
              ? t('common.loading', { defaultValue: 'Syncing...' })
              : `✨ ${t('profile.syncGoogle', { defaultValue: 'Auto-fill from Google Profile' })}`}
          </Text>
        </TouchableOpacity>
      )}

      {/* Name row */}
      <View style={styles.row}>
        <View style={styles.halfField}>
          <Text style={[styles.label, { color: colors.foreground }]}>
            {t('profile.firstName', { defaultValue: 'First Name' })}
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
            value={firstName}
            onChangeText={setFirstName}
            placeholder={t('profile.firstNamePlaceholder', { defaultValue: 'First name' })}
            placeholderTextColor={colors.mutedFg}
          />
        </View>
        <View style={styles.halfField}>
          <Text style={[styles.label, { color: colors.foreground }]}>
            {t('profile.lastName', { defaultValue: 'Last Name' })}
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
            value={lastName}
            onChangeText={setLastName}
            placeholder={t('profile.lastNamePlaceholder', { defaultValue: 'Last name' })}
            placeholderTextColor={colors.mutedFg}
          />
        </View>
      </View>

      {/* Display Name */}
      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.foreground }]}>
          {t('profile.displayName', { defaultValue: 'Display Name / Handle' })}
        </Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
          value={displayName}
          onChangeText={setDisplayName}
          placeholder={t('profile.handlePlaceholder', { defaultValue: '@yourhandle' })}
          placeholderTextColor={colors.mutedFg}
        />
      </View>

      {/* Email (read-only) */}
      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.foreground }]}>
          {t('profile.email', { defaultValue: 'Email Address' })}
        </Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.muted, color: colors.mutedFg, borderColor: colors.border }]}
          value={email}
          editable={false}
        />
      </View>

      {/* Phone */}
      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.foreground }]}>
          {t('profile.phone', { defaultValue: 'Phone Number' })}
        </Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholder={t('profile.phonePlaceholder', { defaultValue: '+1 555-0199' })}
          placeholderTextColor={colors.mutedFg}
        />
      </View>

      {/* Birthday & Occupation */}
      <View style={styles.row}>
        <View style={styles.halfField}>
          <Text style={[styles.label, { color: colors.foreground }]}>
            {t('profile.birthday', { defaultValue: 'Birthday (YYYY-MM-DD)' })}
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
            value={birthday}
            onChangeText={setBirthday}
            placeholder={t('profile.birthdayPlaceholder', { defaultValue: 'YYYY-MM-DD' })}
            placeholderTextColor={colors.mutedFg}
          />
        </View>
        <View style={styles.halfField}>
          <Text style={[styles.label, { color: colors.foreground }]}>
            {t('profile.occupation', { defaultValue: 'Occupation' })}
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
            value={occupation}
            onChangeText={setOccupation}
            placeholder={t('profile.occupationPlaceholder', { defaultValue: 'Designer, Engineer, etc.' })}
            placeholderTextColor={colors.mutedFg}
          />
        </View>
      </View>

      {/* Gender Identity Chips */}
      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.foreground }]}>
          {t('profile.gender', { defaultValue: 'Gender Identity' })}
        </Text>
        <View style={styles.chipsContainer}>
          {GENDER_OPTIONS.map((g) => {
            const isSelected = (gender || '').toLowerCase() === g.toLowerCase();
            return (
              <TouchableOpacity
                key={g}
                style={[
                  styles.chip,
                  {
                    backgroundColor: isSelected
                      ? isDark
                        ? 'rgba(35, 139, 130, 0.22)'
                        : 'rgba(31, 111, 107, 0.12)'
                      : colors.secondary,
                    borderColor: isSelected ? colors.accent : colors.border,
                    borderWidth: isSelected ? 2 : 1,
                  },
                ]}
                onPress={() => setGender(g)}
              >
                <Text
                  style={[
                    styles.chipText,
                    {
                      color: isSelected ? colors.foreground : colors.mutedFg,
                      fontFamily: isSelected ? fonts.bodyBold : fonts.bodyMedium,
                    },
                  ]}
                >
                  {g === 'female' ? `👗 ${t('taxonomy.gender.female', { defaultValue: 'Female' })}` : `👔 ${t('taxonomy.gender.male', { defaultValue: 'Male' })}`}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Marital Status Chips (replaces pronouns) */}
      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.foreground }]}>
          {t('profile.maritalStatus', { defaultValue: 'Marital Status' })}
        </Text>
        <View style={styles.chipsContainer}>
          {MARITAL_STATUS_OPTIONS.map((s) => {
            const isSelected = (maritalStatus || '').toLowerCase() === s.toLowerCase();
            return (
              <TouchableOpacity
                key={s}
                style={[
                  styles.chip,
                  {
                    backgroundColor: isSelected
                      ? isDark
                        ? 'rgba(35, 139, 130, 0.22)'
                        : 'rgba(31, 111, 107, 0.12)'
                      : colors.secondary,
                    borderColor: isSelected ? colors.accent : colors.border,
                    borderWidth: isSelected ? 2 : 1,
                  },
                ]}
                onPress={() => setMaritalStatus(s)}
              >
                <Text
                  style={[
                    styles.chipText,
                    {
                      color: isSelected ? colors.foreground : colors.mutedFg,
                      fontFamily: isSelected ? fonts.bodyBold : fonts.bodyMedium,
                    },
                  ]}
                >
                  {t(`profile.status_${s}`, { defaultValue: s.charAt(0).toUpperCase() + s.slice(1) })}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* City & Country */}
      <View style={styles.row}>
        <View style={styles.halfField}>
          <Text style={[styles.label, { color: colors.foreground }]}>
            {t('profile.city', { defaultValue: 'City' })}
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
            value={city}
            onChangeText={setCity}
            placeholder={t('profile.cityPlaceholder', { defaultValue: 'Tel Aviv, New York...' })}
            placeholderTextColor={colors.mutedFg}
          />
        </View>
        <View style={styles.halfField}>
          <Text style={[styles.label, { color: colors.foreground }]}>
            {t('profile.country', { defaultValue: 'Country' })}
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
            value={country}
            onChangeText={setCountry}
            placeholder={t('profile.countryPlaceholder', { defaultValue: 'Israel, USA...' })}
            placeholderTextColor={colors.mutedFg}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  googleSyncBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  googleSyncText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  halfField: {
    flex: 1,
    gap: 4,
  },
  field: {
    gap: 4,
  },
  label: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
  },
  input: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    fontSize: fontSizes.sm,
    fontFamily: fonts.body,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radii.full,
  },
  chipText: {
    fontSize: fontSizes.xs,
  },
});
