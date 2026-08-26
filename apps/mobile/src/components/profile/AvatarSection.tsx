/**
 * apps/mobile/src/components/profile/AvatarSection.tsx
 *
 * Avatar & Virtual Fitting accordion section for DressApp mobile (matching Web PhotosSection).
 * Features:
 *   - Face Photo slot with image picker (updates user profile avatar)
 *   - Full-body Photo slot with image picker
 *   - Digital Avatar preview matching body measurements & skin tone
 *   - 12-shade skin tone palette picker with framed selection
 *   - Framed borders selection feedback throughout
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  Image,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Lucide from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';

import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii } from '@mobile/theme/tokens';
import { DynamicAvatarSvg } from '@mobile/components/DynamicAvatarSvg';
import { api } from '@mobile/lib/api';

const SKIN_TONE_PALETTE = [
  '#FDDBB4', '#F1C27D', '#E0AC69', '#C68642',
  '#8D5524', '#F2C398', '#D4956A', '#A96232',
  '#6D3B1F', '#ECC9A0', '#9CA3AF', '#4B5563',
];

interface AvatarSectionProps {
  facePhotoUrl: string;
  setFacePhotoUrl: (val: string) => void;
  bodyPhotoUrl: string;
  setBodyPhotoUrl: (val: string) => void;
  skinTone: string;
  setSkinTone: (val: string) => void;
  userGender?: string;
  bodyMeasurements?: {
    height?: number;
    chest?: number;
    waist?: number;
    hip?: number;
    shoulders?: number;
    armLength?: number;
    inseam?: number;
  };
  onSaveSuccess?: () => void;
}

export function AvatarSection({
  facePhotoUrl,
  setFacePhotoUrl,
  bodyPhotoUrl,
  setBodyPhotoUrl,
  skinTone = '#E0AC69',
  setSkinTone,
  userGender = 'female',
  bodyMeasurements,
  onSaveSuccess,
}: AvatarSectionProps) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();

  const [saving, setSaving] = useState(false);
  const silhouette = (userGender || '').toLowerCase() === 'male' ? 'male' : 'female';

  const pickImage = async (type: 'face' | 'body') => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert(
          t('common.permissionDenied', { defaultValue: 'Permission Denied' }),
          t('common.photoLibraryPermissionDesc', { defaultValue: 'Photo library access is needed to select an image.' })
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: type === 'face' ? [1, 1] : [3, 4],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const dataUrl = asset.base64
          ? `data:image/jpeg;base64,${asset.base64}`
          : asset.uri;

        if (type === 'face') {
          setFacePhotoUrl(dataUrl);
        } else {
          setBodyPhotoUrl(dataUrl);
        }
      }
    } catch {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('avatar.selectImageFailed', { defaultValue: 'Failed to select image.' })
      );
    }
  };

  const handleSaveAvatar = async () => {
    setSaving(true);
    try {
      await api.patchMe({
        avatar_url: facePhotoUrl || undefined,
        face_photo_url: facePhotoUrl || undefined,
        body_photo_url: bodyPhotoUrl || undefined,
        avatar_gender: silhouette,
        skin_tone: skinTone,
      });
      Alert.alert(
        t('common.success', { defaultValue: 'Saved' }),
        t('avatar.savedSuccess', { defaultValue: 'Avatar & visual profile saved!' })
      );
      onSaveSuccess?.();
    } catch {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('avatar.saveAvatarFailed', { defaultValue: 'Failed to save avatar settings.' })
      );
    } finally {
      setSaving(false);
    }
  };

  const h = bodyMeasurements?.height || 168;
  const ch = bodyMeasurements?.chest || 88;
  const w = bodyMeasurements?.waist || 68;
  const hp = bodyMeasurements?.hip || 94;
  const sh = bodyMeasurements?.shoulders || 38;
  const arm = bodyMeasurements?.armLength || 58;
  const ins = bodyMeasurements?.inseam || 76;

  return (
    <View style={styles.container}>
      {/* 2 Photo Upload Slots (Face & Body) */}
      <View style={styles.photosRow}>
        {/* Face Photo */}
        <View style={styles.photoSlotCol}>
          <Text style={[styles.photoSlotLabel, { color: colors.foreground }]}>
            {t('profile.facePhoto', { defaultValue: 'Face Photo' })}
          </Text>
          <TouchableOpacity
            style={[
              styles.photoCard,
              {
                backgroundColor: colors.secondary,
                borderColor: facePhotoUrl ? colors.accent : colors.border,
                borderWidth: facePhotoUrl ? 2 : 1,
              },
            ]}
            onPress={() => pickImage('face')}
            activeOpacity={0.8}
          >
            {facePhotoUrl ? (
              <Image source={{ uri: facePhotoUrl }} style={styles.photoImage} resizeMode="cover" />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Lucide.Camera size={26} color={colors.mutedFg} />
                <Text style={[styles.photoPlaceholderText, { color: colors.mutedFg }]}>
                  {t('profile.uploadFace', { defaultValue: 'Upload Face' })}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Body Photo */}
        <View style={styles.photoSlotCol}>
          <Text style={[styles.photoSlotLabel, { color: colors.foreground }]}>
            {t('profile.bodyPhoto', { defaultValue: 'Full-body Photo' })}
          </Text>
          <TouchableOpacity
            style={[
              styles.photoCard,
              {
                backgroundColor: colors.secondary,
                borderColor: bodyPhotoUrl ? colors.accent : colors.border,
                borderWidth: bodyPhotoUrl ? 2 : 1,
              },
            ]}
            onPress={() => pickImage('body')}
            activeOpacity={0.8}
          >
            {bodyPhotoUrl ? (
              <Image source={{ uri: bodyPhotoUrl }} style={styles.photoImage} resizeMode="cover" />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Lucide.User size={26} color={colors.mutedFg} />
                <Text style={[styles.photoPlaceholderText, { color: colors.mutedFg }]}>
                  {t('profile.uploadBody', { defaultValue: 'Upload Body' })}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Digital Avatar Box with Skin Tone Picker */}
      <View style={[styles.avatarBox, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
        <View style={styles.avatarHeader}>
          <Text style={[styles.avatarBoxTitle, { color: colors.foreground }]}>
            {t('profile.sections.digitalAvatar', { defaultValue: 'Digital Avatar' })}
          </Text>
          <View style={styles.skinTonePickerRow}>
            <Text style={[styles.skinToneLabel, { color: colors.mutedFg }]}>
              {t('profile.skinTone', { defaultValue: 'Skin Tone' })}:
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.skinScroll}>
              {SKIN_TONE_PALETTE.map((hex) => {
                const isSelected = (skinTone || '').toLowerCase() === hex.toLowerCase();
                return (
                  <TouchableOpacity
                    key={hex}
                    style={[
                      styles.skinCircle,
                      { backgroundColor: hex },
                      isSelected && [styles.skinCircleSelected, { borderColor: colors.accent }],
                    ]}
                    onPress={() => setSkinTone(hex)}
                  >
                    {isSelected && <Lucide.Check size={12} color="#FFF" />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>

        <View style={[styles.svgWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <DynamicAvatarSvg
            height={h}
            shoulders={sh}
            chest={ch}
            waist={w}
            hip={hp}
            armLength={arm}
            inseam={ins}
            skinColor={skinTone}
            gender={silhouette}
            width={170}
          />
        </View>

        <Text style={[styles.avatarFootnote, { color: colors.mutedFg }]}>
          {t('avatar.silhouetteConfigured', {
            defaultValue: '{{gender}} silhouette automatically configured from measurements ({{height}}cm)',
            gender: silhouette === 'male' ? t('profile.male', { defaultValue: 'Male' }) : t('profile.female', { defaultValue: 'Female' }),
            height: h,
          })}
        </Text>
      </View>

      {/* Save Button */}
      <TouchableOpacity
        style={[styles.saveBtn, { backgroundColor: colors.accent }]}
        onPress={handleSaveAvatar}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator size="small" color="#FFF" />
        ) : (
          <>
            <Lucide.Save size={15} color="#FFF" />
            <Text style={styles.saveBtnText}>{t('avatar.saveVisuals', { defaultValue: 'Save Visuals & Avatar' })}</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  photosRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  photoSlotCol: {
    flex: 1,
    gap: 4,
  },
  photoSlotLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
  },
  photoCard: {
    height: 140,
    borderRadius: radii.lg,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: spacing.xs,
  },
  photoPlaceholderText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.xs,
    textAlign: 'center',
  },
  avatarBox: {
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    gap: spacing.sm,
  },
  avatarHeader: {
    gap: 6,
  },
  avatarBoxTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
    textTransform: 'uppercase',
  },
  skinTonePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  skinToneLabel: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
  },
  skinScroll: {
    gap: 6,
    paddingVertical: 2,
  },
  skinCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skinCircleSelected: {
    borderWidth: 2.5,
  },
  svgWrap: {
    borderRadius: radii.md,
    borderWidth: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFootnote: {
    fontFamily: fonts.body,
    fontSize: 10,
    textAlign: 'center',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: radii.full,
    marginTop: spacing.xs,
  },
  saveBtnText: {
    color: '#FFF',
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.sm,
  },
});
