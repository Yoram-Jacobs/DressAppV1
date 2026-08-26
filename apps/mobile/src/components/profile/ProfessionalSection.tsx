/**
 * apps/mobile/src/components/profile/ProfessionalSection.tsx
 *
 * Professional Directory (Fashion Expert) accordion section for DressApp mobile.
 * Features:
 *   - "Are you a Fashion Expert / Stylist?" switch
 *   - Profession title
 *   - Business Name, Business Address
 *   - Business Phone, Business Email, Business Website URL
 *   - Short description / bio
 *   - Hourly rate & Booking URL
 *   - Specialties selector with framed selection
 *   - Framed borders selection feedback throughout
 */

import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Switch,
  StyleSheet,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Lucide from 'lucide-react-native';
import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii } from '@mobile/theme/tokens';

const SPECIALTIES_LIST = [
  'Personal Shopping',
  'Wardrobe Audit',
  'Color Analysis',
  'Event Styling',
  'Bridal Styling',
  'Editorial & Commercial',
  'Sustainable & Vintage',
];

interface ProfessionalProps {
  isStylist: boolean;
  setIsStylist: (val: boolean) => void;
  profession: string;
  setProfession: (val: string) => void;
  businessName: string;
  setBusinessName: (val: string) => void;
  businessAddress: string;
  setBusinessAddress: (val: string) => void;
  businessPhone: string;
  setBusinessPhone: (val: string) => void;
  businessEmail: string;
  setBusinessEmail: (val: string) => void;
  businessWebsite: string;
  setBusinessWebsite: (val: string) => void;
  stylistBio: string;
  setStylistBio: (val: string) => void;
  hourlyRate: string;
  setHourlyRate: (val: string) => void;
  bookingUrl: string;
  setBookingUrl: (val: string) => void;
  specialties: string[];
  toggleSpecialty: (val: string) => void;
}

export function ProfessionalSection({
  isStylist,
  setIsStylist,
  profession,
  setProfession,
  businessName,
  setBusinessName,
  businessAddress,
  setBusinessAddress,
  businessPhone,
  setBusinessPhone,
  businessEmail,
  setBusinessEmail,
  businessWebsite,
  setBusinessWebsite,
  stylistBio,
  setStylistBio,
  hourlyRate,
  setHourlyRate,
  bookingUrl,
  setBookingUrl,
  specialties,
  toggleSpecialty,
}: ProfessionalProps) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();

  return (
    <View style={styles.container}>
      {/* Enable Professional Listing Switch */}
      <View style={[styles.switchRow, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
        <View style={styles.switchTextCol}>
          <Text style={[styles.switchTitle, { color: colors.foreground }]}>
            {t('profile.professional.checkboxLabel', { defaultValue: 'Listed in Professional Directory' })}
          </Text>
          <Text style={[styles.switchSub, { color: colors.mutedFg }]}>
            {t('profile.professional.checkboxHint', { defaultValue: 'Publish your styling portfolio to the global directory.' })}
          </Text>
        </View>
        <Switch
          value={isStylist}
          onValueChange={setIsStylist}
          trackColor={{ false: colors.border, true: colors.accent }}
        />
      </View>

      {isStylist && (
        <View style={styles.formFields}>
          {/* Profession Title */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.foreground }]}>
              {t('profile.professional.profession', { defaultValue: 'Profession' })}
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
              value={profession}
              onChangeText={setProfession}
              placeholder={t('profile.professional.professionPlaceholder', { defaultValue: 'e.g. Certified Wardrobe Stylist, Color Consultant' })}
              placeholderTextColor={colors.mutedFg}
            />
          </View>

          {/* Business Name */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.foreground }]}>
              {t('profile.professional.businessName', { defaultValue: 'Business Name' })}
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
              value={businessName}
              onChangeText={setBusinessName}
              placeholder={t('profile.professional.businessNamePlaceholder', { defaultValue: 'e.g. Studio Atelier Style' })}
              placeholderTextColor={colors.mutedFg}
            />
          </View>

          {/* Business Address */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.foreground }]}>
              {t('profile.professional.businessAddress', { defaultValue: 'Business Address' })}
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
              value={businessAddress}
              onChangeText={setBusinessAddress}
              placeholder={t('profile.professional.businessAddressPlaceholder', { defaultValue: '123 Fashion Blvd, Suite 400, Paris' })}
              placeholderTextColor={colors.mutedFg}
            />
          </View>

          {/* Business Phone & Email */}
          <View style={styles.row}>
            <View style={styles.halfField}>
              <Text style={[styles.label, { color: colors.foreground }]}>
                {t('profile.professional.businessPhone', { defaultValue: 'Business Phone' })}
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
                value={businessPhone}
                onChangeText={setBusinessPhone}
                keyboardType="phone-pad"
                placeholder="+1 555 019 283"
                placeholderTextColor={colors.mutedFg}
              />
            </View>
            <View style={styles.halfField}>
              <Text style={[styles.label, { color: colors.foreground }]}>
                {t('profile.professional.businessEmail', { defaultValue: 'Business Email' })}
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
                value={businessEmail}
                onChangeText={setBusinessEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="contact@studio.com"
                placeholderTextColor={colors.mutedFg}
              />
            </View>
          </View>

          {/* Business Website URL */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.foreground }]}>
              {t('profile.professional.businessWebsite', { defaultValue: 'Business Website URL' })}
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
              value={businessWebsite}
              onChangeText={setBusinessWebsite}
              placeholder="https://myatelier.com"
              autoCapitalize="none"
              placeholderTextColor={colors.mutedFg}
            />
          </View>

          {/* Short description */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.foreground }]}>
              {t('profile.professional.businessDescription', { defaultValue: 'Short Description' })}
            </Text>
            <TextInput
              style={[styles.textArea, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
              value={stylistBio}
              onChangeText={setStylistBio}
              placeholder={t('profile.professional.bioPlaceholder', { defaultValue: 'Describe your styling approach, certifications, and experience...' })}
              placeholderTextColor={colors.mutedFg}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Hourly Rate & Booking URL */}
          <View style={styles.row}>
            <View style={styles.halfField}>
              <Text style={[styles.label, { color: colors.foreground }]}>
                {t('profile.hourlyRate', { defaultValue: 'Hourly Rate ($)' })}
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
                value={hourlyRate}
                onChangeText={setHourlyRate}
                placeholder="120"
                keyboardType="numeric"
                placeholderTextColor={colors.mutedFg}
              />
            </View>
            <View style={styles.halfField}>
              <Text style={[styles.label, { color: colors.foreground }]}>
                {t('profile.bookingUrl', { defaultValue: 'Booking / Cal Link' })}
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
                value={bookingUrl}
                onChangeText={setBookingUrl}
                placeholder={t('profile.professional.calendlyPlaceholder', { defaultValue: 'calendly.com/your-name' })}
                autoCapitalize="none"
                placeholderTextColor={colors.mutedFg}
              />
            </View>
          </View>

          {/* Styling Specialties */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.foreground }]}>
              {t('profile.specialties', { defaultValue: 'Styling Specialties' })}
            </Text>
            <View style={styles.chipsContainer}>
              {SPECIALTIES_LIST.map((spec) => {
                const isSelected = specialties.includes(spec);
                return (
                  <TouchableOpacity
                    key={spec}
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
                    onPress={() => toggleSpecialty(spec)}
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
                      {spec}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.sm,
  },
  switchTextCol: {
    flex: 1,
    gap: 2,
  },
  switchTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.sm,
  },
  switchSub: {
    fontFamily: fonts.body,
    fontSize: 10.5,
  },
  formFields: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  field: {
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  halfField: {
    flex: 1,
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
  textArea: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    fontSize: fontSizes.sm,
    fontFamily: fonts.body,
    minHeight: 65,
    textAlignVertical: 'top',
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
