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
} from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import * as Lucide from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii } from '@mobile/theme/tokens';
import { DynamicAvatarSvg } from '@mobile/components/DynamicAvatarSvg';
import { api } from '@mobile/lib/api';

import { resolveImageUrl } from '@mobile/lib/imageUtils';
import { userStore } from '@mobile/lib/stores';
import { Modal } from 'react-native';

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
  const [processing, setProcessing] = useState<'face' | 'body' | null>(null);
  const [pickerModalType, setPickerModalType] = useState<'face' | 'body' | null>(null);
  const [viewMode, setViewMode] = useState<'real' | 'mannequin'>('real');
  const silhouette = (userGender || '').toLowerCase() === 'male' ? 'male' : 'female';

  const compressImage = async (uri: string, maxDim: number): Promise<string> => {
    try {
      const manipResult = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: maxDim } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      return manipResult.base64 ? `data:image/jpeg;base64,${manipResult.base64}` : manipResult.uri;
    } catch (e) {
      console.warn('Image manipulation failed, falling back to raw uri:', e);
      return uri;
    }
  };

  const handlePickFromSource = async (type: 'face' | 'body', source: 'camera' | 'library') => {
    setPickerModalType(null);
    try {
      setProcessing(type);
      let result: ImagePicker.ImagePickerResult;

      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert(
            t('common.permissionDenied', { defaultValue: 'Permission Denied' }),
            t('common.cameraPermissionDesc', { defaultValue: 'Camera permission is required.' })
          );
          setProcessing(null);
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          aspect: type === 'face' ? [1, 1] : [3, 4],
          quality: 0.8,
        });
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert(
            t('common.permissionDenied', { defaultValue: 'Permission Denied' }),
            t('common.photoLibraryPermissionDesc', { defaultValue: 'Photo library access is needed to select an image.' })
          );
          setProcessing(null);
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: type === 'face' ? [1, 1] : [3, 4],
          quality: 0.8,
        });
      }

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const compressedDataUrl = await compressImage(asset.uri, type === 'face' ? 800 : 1024);
        if (type === 'face') {
          setFacePhotoUrl(compressedDataUrl);
        } else {
          setBodyPhotoUrl(compressedDataUrl);
          setViewMode('real');
        }
      }
    } catch (err) {
      console.warn('Image picker error:', err);
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('avatar.selectImageFailed', { defaultValue: 'Failed to select image.' })
      );
    } finally {
      setProcessing(null);
    }
  };

  const handleRemovePhoto = (type: 'face' | 'body') => {
    setPickerModalType(null);
    if (type === 'face') {
      setFacePhotoUrl('');
    } else {
      setBodyPhotoUrl('');
      setViewMode('mannequin');
    }
  };

  const handleSaveAvatar = async () => {
    setSaving(true);
    try {
      const res = await api.patchMe({
        avatar_url: facePhotoUrl || undefined,
        face_photo_url: facePhotoUrl || undefined,
        body_photo_url: bodyPhotoUrl || undefined,
        avatar_gender: silhouette,
        skin_tone: skinTone,
      });
      if (res) {
        userStore.setUser(res);
        if (res.face_photo_url || res.avatar_url) setFacePhotoUrl(res.face_photo_url || res.avatar_url || '');
        if (res.body_photo_url) setBodyPhotoUrl(res.body_photo_url);
      }
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

  const resolvedFaceUrl = resolveImageUrl(facePhotoUrl);
  const resolvedBodyUrl = resolveImageUrl(bodyPhotoUrl);

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
            onPress={() => setPickerModalType('face')}
            activeOpacity={0.8}
            disabled={processing === 'face'}
          >
            {processing === 'face' ? (
              <View style={styles.photoPlaceholder}>
                <ActivityIndicator size="small" color={colors.accent} />
                <Text style={[styles.photoPlaceholderText, { color: colors.mutedFg }]}>
                  {t('common.processing', { defaultValue: 'Compressing...' })}
                </Text>
              </View>
            ) : resolvedFaceUrl ? (
              <>
                <Image source={{ uri: resolvedFaceUrl }} style={styles.photoImage} resizeMode="cover" />
                <View style={[styles.photoOverlayBadge, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
                  <Lucide.Camera size={12} color="#FFF" />
                </View>
              </>
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
            onPress={() => setPickerModalType('body')}
            activeOpacity={0.8}
            disabled={processing === 'body'}
          >
            {processing === 'body' ? (
              <View style={styles.photoPlaceholder}>
                <ActivityIndicator size="small" color={colors.accent} />
                <Text style={[styles.photoPlaceholderText, { color: colors.mutedFg }]}>
                  {t('common.processing', { defaultValue: 'Compressing...' })}
                </Text>
              </View>
            ) : resolvedBodyUrl ? (
              <>
                <Image source={{ uri: resolvedBodyUrl }} style={styles.photoImage} resizeMode="cover" />
                <View style={[styles.photoOverlayBadge, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
                  <Lucide.User size={12} color="#FFF" />
                </View>
              </>
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
          {resolvedBodyUrl && viewMode === 'real' ? (
            <View style={styles.bodyCutoutWrap}>
              <Image
                source={{ uri: resolvedBodyUrl }}
                style={styles.bodyCutoutImage}
                resizeMode="contain"
              />
              <TouchableOpacity
                style={[styles.avatarTogglePill, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => setViewMode('mannequin')}
              >
                <Lucide.Layers size={12} color={colors.accent} />
                <Text style={[styles.avatarToggleText, { color: colors.foreground }]}>
                  {t('avatar.showMannequin', { defaultValue: 'Mannequin' })}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.mannequinWrap}>
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
              {!!resolvedBodyUrl && (
                <TouchableOpacity
                  style={[styles.avatarTogglePill, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => setViewMode('real')}
                >
                  <Lucide.User size={12} color={colors.accent} />
                  <Text style={[styles.avatarToggleText, { color: colors.foreground }]}>
                    {t('avatar.showRealBody', { defaultValue: 'Real Body' })}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
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

      {/* ── Photo Action Sheet Modal with 'X' Close Button ── */}
      <Modal
        visible={pickerModalType !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerModalType(null)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setPickerModalType(null)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                {pickerModalType === 'face'
                  ? t('profile.facePhoto', { defaultValue: 'Face Photo' })
                  : t('profile.bodyPhoto', { defaultValue: 'Full-body Photo' })}
              </Text>
              <TouchableOpacity
                onPress={() => setPickerModalType(null)}
                style={[styles.modalCloseBtn, { backgroundColor: colors.secondary, borderColor: colors.border, borderWidth: 1 }]}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Lucide.X size={18} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalOptionsList}>
              <TouchableOpacity
                style={[styles.modalOptionItem, { borderColor: colors.border }]}
                onPress={() => pickerModalType && handlePickFromSource(pickerModalType, 'camera')}
              >
                <View style={[styles.modalOptionIconWrap, { backgroundColor: colors.secondary }]}>
                  <Lucide.Camera size={18} color={colors.accent} />
                </View>
                <Text style={[styles.modalOptionText, { color: colors.foreground }]}>
                  {t('profile.takePhoto', { defaultValue: 'Take photo' })}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalOptionItem, { borderColor: colors.border }]}
                onPress={() => pickerModalType && handlePickFromSource(pickerModalType, 'library')}
              >
                <View style={[styles.modalOptionIconWrap, { backgroundColor: colors.secondary }]}>
                  <Lucide.Image size={18} color={colors.accent} />
                </View>
                <Text style={[styles.modalOptionText, { color: colors.foreground }]}>
                  {t('profile.uploadPhoto', { defaultValue: 'Upload from gallery' })}
                </Text>
              </TouchableOpacity>

              {((pickerModalType === 'face' && !!facePhotoUrl) || (pickerModalType === 'body' && !!bodyPhotoUrl)) && (
                <TouchableOpacity
                  style={[styles.modalOptionItem, { borderColor: 'rgba(239,68,68,0.25)' }]}
                  onPress={() => pickerModalType && handleRemovePhoto(pickerModalType)}
                >
                  <View style={[styles.modalOptionIconWrap, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
                    <Lucide.Trash2 size={18} color="#EF4444" />
                  </View>
                  <Text style={[styles.modalOptionText, { color: '#EF4444' }]}>
                    {t('profile.removePhoto', { defaultValue: 'Remove photo' })}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
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
  photoOverlayBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
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
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  bodyCutoutWrap: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xs,
  },
  bodyCutoutImage: {
    width: '100%',
    height: '100%',
  },
  mannequinWrap: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTogglePill: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.full,
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  avatarToggleText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    borderWidth: 1,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.md,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOptionsList: {
    gap: spacing.sm,
  },
  modalOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  modalOptionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOptionText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.sm,
  },
});
