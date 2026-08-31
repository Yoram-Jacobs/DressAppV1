/**
 * apps/mobile/src/screens/closet/AvatarScreen.tsx
 *
 * Full native port of apps/web/src/pages/AvatarPage.jsx.
 *
 * Layout: two-column row — left (60%) = scrollable controls, right (40%) =
 * sticky avatar preview panel.
 *
 * Features
 * ────────
 *   - Fetch avatar params on mount via api.getAvatarParams()
 *   - Body measurement sliders (7 axes) — custom PanResponder implementation
 *     (no external slider package required; react-native core only)
 *   - Gender toggle (female / male) pill buttons
 *   - Skin-tone picker: horizontal ScrollView of 12 colour circles
 *   - Full-body photo: gallery or camera via expo-image-picker (base64)
 *   - DynamicAvatarSvg preview — sticky right panel
 *   - Save via api.patchMe(payload) — same payload structure as web
 *   - i18n with useTranslation() + fallback defaultValue strings
 *   - RTL awareness via I18nManager.isRTL
 *   - SafeAreaView edges={['bottom']}
 *   - No web-only APIs (no document, canvas, FileReader)
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  GestureResponderEvent,
  I18nManager,
  LayoutChangeEvent,
  PanResponder,
  PanResponderGestureState,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import * as Lucide from 'lucide-react-native';

import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii, shadows } from '@mobile/theme/tokens';
import { api } from '@mobile/lib/api';
import { resolveImageUrl } from '@mobile/lib/imageUtils';
import { useUserStore } from '@mobile/lib/stores';
import { DynamicAvatarSvg } from '@mobile/components/DynamicAvatarSvg';

// ─── Constants ────────────────────────────────────────────────────────────────

const SKIN_TONE_PALETTE: readonly string[] = [
  '#FDDBB4', '#F1C27D', '#E0AC69', '#C68642',
  '#8D5524', '#F2C398', '#D4956A', '#A96232',
  '#6D3B1F', '#ECC9A0', '#9CA3AF', '#4B5563',
];

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Measurements {
  height: number;
  shoulders: number;
  chest: number;
  waist: number;
  hip: number;
  armLength: number;
  inseam: number;
  gender: string;
}

const DEFAULT_MEASUREMENTS: Measurements = {
  height: 168,
  shoulders: 38,
  chest: 88,
  waist: 68,
  hip: 94,
  armLength: 58,
  inseam: 76,
  gender: 'female',
};

// ─── Native Slider Component ──────────────────────────────────────────────────

interface NativeSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (val: number) => void;
  trackColor?: string;
  thumbColor?: string;
  labelColor?: string;
  valueColor?: string;
}

function NativeSlider({
  label,
  value,
  min,
  max,
  step = 1,
  unit = 'cm',
  onChange,
  trackColor = '#e4e4e7',
  thumbColor = '#2d8f7f',
  labelColor = '#000',
  valueColor = '#2d8f7f',
}: NativeSliderProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const trackWidthRef = useRef(0);
  const valueRef = useRef(value);
  valueRef.current = value;

  const fraction = Math.max(0, Math.min(1, (value - min) / (max - min)));

  const handleLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setTrackWidth(w);
    trackWidthRef.current = w;
  };

  const updateFromX = (x: number) => {
    const tw = trackWidthRef.current;
    if (tw <= 0) return;
    const clampedX = Math.max(0, Math.min(tw, x));
    const rawVal = min + (clampedX / tw) * (max - min);
    const stepped = Math.round(rawVal / step) * step;
    const clamped = Math.max(min, Math.min(max, stepped));
    if (clamped !== valueRef.current) {
      onChange(clamped);
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e: GestureResponderEvent) => {
        updateFromX(e.nativeEvent.locationX);
      },
      onPanResponderMove: (e: GestureResponderEvent) => {
        updateFromX(e.nativeEvent.locationX);
      },
    })
  ).current;

  return (
    <View style={sliderStyles.container}>
      <View style={sliderStyles.labelRow}>
        <Text style={[sliderStyles.label, { color: labelColor }]}>{label}</Text>
        <Text style={[sliderStyles.value, { color: valueColor }]}>
          {value} {unit}
        </Text>
      </View>
      <View
        style={sliderStyles.trackWrapper}
        onLayout={handleLayout}
        {...panResponder.panHandlers}
      >
        <View style={[sliderStyles.trackBg, { backgroundColor: trackColor }]} />
        <View
          style={[
            sliderStyles.trackFill,
            {
              backgroundColor: thumbColor,
              width: `${fraction * 100}%`,
            },
          ]}
        />
        {trackWidth > 0 && (
          <View
            style={[
              sliderStyles.thumb,
              {
                backgroundColor: thumbColor,
                left: Math.max(0, Math.min(trackWidth - 20, fraction * trackWidth - 10)),
              },
            ]}
          />
        )}
      </View>
    </View>
  );
}

const sliderStyles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  label: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
  },
  value: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.sm,
  },
  trackWrapper: {
    height: 36,
    justifyContent: 'center',
  },
  trackBg: {
    height: 6,
    borderRadius: radii.full,
    width: '100%',
  },
  trackFill: {
    height: 6,
    borderRadius: radii.full,
    position: 'absolute',
  },
  thumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    ...shadows.sm,
  },
});

export function AvatarScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const isRtl = I18nManager.isRTL;

  const { user, avatarParams, loading, patchUser } = useUserStore();

  const [saving,    setSaving]    = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);

  // Initialize from store snapshot
  const initialMeasurements: Measurements = useMemo(() => {
    const p = avatarParams?.measurements || avatarParams || user?.avatar_shape_params || user?.body_measurements;
    if (!p) return DEFAULT_MEASUREMENTS;
    return {
      height:    Number(p.height)                    || 168,
      shoulders: Number(p.shoulders)                 || 38,
      chest:     Number(p.chest)                     || 88,
      waist:     Number(p.waist)                     || 68,
      hip:       Number(p.hips ?? p.hip)             || 94,
      armLength: Number(p.arm_length ?? p.armLength) || 58,
      inseam:    Number(p.inseam)                    || 76,
      gender:    String(p.gender ?? user?.sex ?? 'female').toLowerCase(),
    };
  }, [avatarParams, user]);

  const [measurements, setMeasurements] = useState<Measurements>(initialMeasurements);
  const [skinColor,    setSkinColor]    = useState(avatarParams?.skin_tone || user?.skin_tone || '#E0AC69');
  const [bodyPhotoUrl, setBodyPhotoUrl] = useState<string | null>(avatarParams?.body_photo_url || user?.body_photo_url || null);
  const [avatarMode,   setAvatarMode]   = useState<'mannequin' | 'photo'>(
    avatarParams?.body_photo_url || user?.body_photo_url ? 'photo' : 'mannequin'
  );

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('MeTab');
    }
  };

  const setField = useCallback(<K extends keyof Measurements>(
    key: K,
    value: Measurements[K],
  ) => {
    setMeasurements(prev => ({ ...prev, [key]: value }));
  }, []);

  const handlePickPhoto = useCallback(async (useCamera: boolean) => {
    setPhotoBusy(true);
    try {
      let result: ImagePicker.ImagePickerResult;

      if (useCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) return;
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          base64: true,
          quality: 0.8,
        });
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) return;
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          base64: true,
          quality: 0.8,
        });
      }

      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        const dataUri = asset.base64 ? `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}` : asset.uri;
        if (dataUri) {
          setBodyPhotoUrl(dataUri);
          setAvatarMode('photo');
        }
      }
    } catch (err) {
      console.error('[AvatarScreen] photo picker error', err);
    } finally {
      setPhotoBusy(false);
    }
  }, []);

  const handleRemovePhoto = useCallback(() => {
    setBodyPhotoUrl(null);
    setAvatarMode('mannequin');
  }, []);

  const handleSave = useCallback(async () => {
    try {
      setSaving(true);
      await patchUser({
        sex:            measurements.gender,
        skin_tone:      skinColor,
        body_photo_url: bodyPhotoUrl,
        body_measurements: {
          height:     Number(measurements.height),
          shoulders:  Number(measurements.shoulders),
          chest:      Number(measurements.chest),
          waist:      Number(measurements.waist),
          hips:       Number(measurements.hip),
          arm_length: Number(measurements.armLength),
          inseam:     Number(measurements.inseam),
          gender:     measurements.gender,
        },
      });
      Alert.alert(
        t('common.success', { defaultValue: 'Saved' }),
        t('avatar.saveSuccess', { defaultValue: 'Your mannequin profile has been updated.' }),
        [{ text: t('common.ok', { defaultValue: 'OK' }), onPress: handleBack }]
      );
    } catch (err: any) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        err?.message || t('avatar.saveError', { defaultValue: 'Failed to save changes.' })
      );
    } finally {
      setSaving(false);
    }
  }, [measurements, skinColor, bodyPhotoUrl, t]);

  const s = useMemo(() => makeStyles(colors, isRtl), [colors, isRtl]);

  if (loading) {
    return (
      <SafeAreaView style={[s.safeArea, s.centered]} edges={['top', 'bottom']}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={s.loadingText}>
          {t('pages.avatarPage.generating_your_3d_digital_double', {
            defaultValue: 'Generating your digital double…',
          })}
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safeArea} edges={['top']}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View style={s.header}>
        <TouchableOpacity onPress={handleBack} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Lucide.ArrowLeft size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.title} numberOfLines={1}>
            {t('avatar.title', { defaultValue: 'My Digital Avatar' })}
          </Text>
        </View>
        <TouchableOpacity
          style={[s.saveBtn, saving && s.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={s.saveBtnLabel}>
              {t('avatar.save', { defaultValue: 'Save' })}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── 1. Avatar Visual Hero Card ───────────────────────────────── */}
        <View style={[s.avatarHeroCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={s.previewMetaRow}>
            <View style={[s.badge, { backgroundColor: colors.secondary }]}>
              <Lucide.Ruler size={12} color={colors.accent} />
              <Text style={[s.badgeText, { color: colors.foreground }]}>
                {measurements.height} cm
              </Text>
            </View>
            <View style={[s.badge, { backgroundColor: colors.secondary }]}>
              <Lucide.User size={12} color={colors.accent} />
              <Text style={[s.badgeText, { color: colors.foreground }]}>
                {measurements.gender.toUpperCase()}
              </Text>
            </View>
          </View>

          <View style={s.avatarViewport}>
            {avatarMode === 'photo' && resolveImageUrl(bodyPhotoUrl) ? (
              <Image
                source={{ uri: resolveImageUrl(bodyPhotoUrl) }}
                style={s.photoPreview}
                resizeMode="contain"
              />
            ) : (
              <DynamicAvatarSvg
                height={measurements.height}
                shoulders={measurements.shoulders}
                chest={measurements.chest}
                waist={measurements.waist}
                hip={measurements.hip}
                armLength={measurements.armLength}
                inseam={measurements.inseam}
                gender={measurements.gender}
                skinColor={skinColor}
                width={200}
                showGuideLines
              />
            )}
          </View>

          {bodyPhotoUrl && (
            <View style={s.modeToggleRow}>
              {(['mannequin', 'photo'] as const).map((mode) => (
                <TouchableOpacity
                  key={mode}
                  style={[s.modePill, avatarMode === mode && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                  onPress={() => setAvatarMode(mode)}
                  activeOpacity={0.8}
                >
                  <Text style={[s.modePillLabel, { color: avatarMode === mode ? '#FFF' : colors.foreground }]}>
                    {mode === 'mannequin'
                      ? t('pages.avatarPage.vector_mannequin', { defaultValue: 'Mannequin' })
                      : t('pages.avatarPage.real_photo', { defaultValue: 'Real Photo' })}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* ── 2. Full-Body Photo Card ──────────────────────────────────── */}
        <View style={[s.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[s.sectionTitle, { color: colors.foreground }]}>
            {t('avatar.bodyPhoto', { defaultValue: 'Full-Body Photo' })}
          </Text>
          <View style={s.photoRow}>
            <View style={[s.photoThumb, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              {resolveImageUrl(bodyPhotoUrl) ? (
                <Image source={{ uri: resolveImageUrl(bodyPhotoUrl) }} style={s.thumbImage} resizeMode="cover" />
              ) : (
                <Lucide.Camera size={24} color={colors.mutedFg} />
              )}
            </View>
            <View style={s.photoActions}>
              <TouchableOpacity
                style={[s.actionBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
                onPress={() => handlePickPhoto(true)}
                disabled={photoBusy}
              >
                <Lucide.Camera size={14} color={colors.foreground} />
                <Text style={[s.actionBtnText, { color: colors.foreground }]}>
                  {t('profile.takePhoto', { defaultValue: 'Camera' })}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.actionBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
                onPress={() => handlePickPhoto(false)}
                disabled={photoBusy}
              >
                <Lucide.Image size={14} color={colors.foreground} />
                <Text style={[s.actionBtnText, { color: colors.foreground }]}>
                  {bodyPhotoUrl ? t('profile.replacePhoto', { defaultValue: 'Replace' }) : t('avatar.addPhoto', { defaultValue: 'Gallery' })}
                </Text>
              </TouchableOpacity>
              {bodyPhotoUrl && (
                <TouchableOpacity
                  style={[s.actionBtn, { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: '#ef4444' }]}
                  onPress={handleRemovePhoto}
                  disabled={photoBusy}
                >
                  <Lucide.Trash2 size={14} color="#ef4444" />
                  <Text style={[s.actionBtnText, { color: '#ef4444' }]}>
                    {t('avatar.removePhoto', { defaultValue: 'Remove' })}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* ── 3. Skin Tone Palette Card ─────────────────────────────────── */}
        <View style={[s.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[s.sectionTitle, { color: colors.foreground }]}>
            {t('avatar.skinTone', { defaultValue: 'Skin Tone' })}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.skinRow}>
            {SKIN_TONE_PALETTE.map((color) => {
              const selected = skinColor.toLowerCase() === color.toLowerCase();
              return (
                <TouchableOpacity
                  key={color}
                  style={[
                    s.skinCircle,
                    { backgroundColor: color, borderColor: selected ? colors.primary : colors.border },
                    selected && s.skinCircleSelected,
                  ]}
                  onPress={() => setSkinColor(color)}
                  activeOpacity={0.8}
                />
              );
            })}
          </ScrollView>
        </View>

        {/* ── 4. Gender Model Card ──────────────────────────────────────── */}
        <View style={[s.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[s.sectionTitle, { color: colors.foreground }]}>
            {t('avatar.gender', { defaultValue: 'Gender Model' })}
          </Text>
          <View style={s.genderRow}>
            {(['female', 'male'] as const).map((g) => {
              const isSel = measurements.gender === g;
              return (
                <TouchableOpacity
                  key={g}
                  style={[
                    s.genderBtn,
                    {
                      backgroundColor: isSel ? colors.primary : colors.secondary,
                      borderColor: isSel ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setField('gender', g)}
                  activeOpacity={0.8}
                >
                  <Text style={[s.genderBtnText, { color: isSel ? '#FFF' : colors.foreground }]}>
                    {g === 'female'
                      ? t('pages.avatarPage.female', { defaultValue: 'Female' })
                      : t('pages.avatarPage.male', { defaultValue: 'Male' })}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── 5. Body Measurement Sliders Card ──────────────────────────── */}
        <View style={[s.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[s.sectionTitle, { color: colors.foreground }]}>
            {t('avatar.measurements', { defaultValue: 'Body Measurements' })}
          </Text>

          <NativeSlider
            label={t('pages.avatarPage.height', { defaultValue: 'Height' })}
            value={measurements.height} min={140} max={210} unit="cm"
            onChange={(v) => setField('height', v)}
            trackColor={colors.border} thumbColor={colors.primary}
            labelColor={colors.foreground} valueColor={colors.accent}
          />
          <NativeSlider
            label={t('pages.avatarPage.shoulders', { defaultValue: 'Shoulder Width' })}
            value={measurements.shoulders} min={28} max={58} unit="cm"
            onChange={(v) => setField('shoulders', v)}
            trackColor={colors.border} thumbColor={colors.primary}
            labelColor={colors.foreground} valueColor={colors.accent}
          />
          <NativeSlider
            label={t('pages.avatarPage.chest', { defaultValue: 'Chest Circumference' })}
            value={measurements.chest} min={65} max={138} unit="cm"
            onChange={(v) => setField('chest', v)}
            trackColor={colors.border} thumbColor={colors.primary}
            labelColor={colors.foreground} valueColor={colors.accent}
          />
          <NativeSlider
            label={t('pages.avatarPage.waist', { defaultValue: 'Waist Circumference' })}
            value={measurements.waist} min={54} max={128} unit="cm"
            onChange={(v) => setField('waist', v)}
            trackColor={colors.border} thumbColor={colors.primary}
            labelColor={colors.foreground} valueColor={colors.accent}
          />
          <NativeSlider
            label={t('pages.avatarPage.hip', { defaultValue: 'Hip Circumference' })}
            value={measurements.hip} min={68} max={148} unit="cm"
            onChange={(v) => setField('hip', v)}
            trackColor={colors.border} thumbColor={colors.primary}
            labelColor={colors.foreground} valueColor={colors.accent}
          />
          <NativeSlider
            label={t('pages.avatarPage.arm_length', { defaultValue: 'Arm Length' })}
            value={measurements.armLength} min={42} max={85} unit="cm"
            onChange={(v) => setField('armLength', v)}
            trackColor={colors.border} thumbColor={colors.primary}
            labelColor={colors.foreground} valueColor={colors.accent}
          />
          <NativeSlider
            label={t('pages.avatarPage.inseam', { defaultValue: 'Inseam (Leg Length)' })}
            value={measurements.inseam} min={52} max={100} unit="cm"
            onChange={(v) => setField('inseam', v)}
            trackColor={colors.border} thumbColor={colors.primary}
            labelColor={colors.foreground} valueColor={colors.accent}
          />
        </View>

        {/* ── 6. Info Note ─────────────────────────────────────────────── */}
        <View style={[s.infoCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <Lucide.Info size={16} color={colors.accent} style={{ marginTop: 2 }} />
          <Text style={[s.infoText, { color: colors.foreground }]}>
            {t('pages.avatarPage.info_note', {
              defaultValue:
                'Body measurements calibrate virtual garment try-on physics and size recommendations across the app.',
            })}
          </Text>
        </View>

        {/* ── 7. Save CTA Button ───────────────────────────────────────── */}
        <TouchableOpacity
          style={[s.bottomSaveBtn, { backgroundColor: colors.primary }]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <Lucide.Save size={18} color="#FFF" />
              <Text style={s.bottomSaveBtnText}>
                {t('pages.avatarPage.save_measurements', { defaultValue: 'Save Profile' })}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

export default AvatarScreen;

// ─── Styles factory ───────────────────────────────────────────────────────────

type Colors = ReturnType<typeof import('@mobile/theme').useTheme>['colors'];

function makeStyles(colors: Colors, isRtl: boolean) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    centered: {
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing[6],
    },
    loadingText: {
      fontFamily: fonts.body,
      fontSize: fontSizes.sm,
      color: colors.mutedFg,
      marginTop: spacing[3],
      textAlign: 'center',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[3],
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.card,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: radii.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerCenter: {
      flex: 1,
      marginHorizontal: spacing[2],
    },
    title: {
      fontFamily: fonts.displayBold,
      fontSize: fontSizes.base,
      color: colors.foreground,
    },
    saveBtn: {
      backgroundColor: colors.primary,
      borderRadius: radii.md,
      paddingHorizontal: spacing[3.5],
      paddingVertical: spacing[1.5],
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveBtnDisabled: {
      opacity: 0.6,
    },
    saveBtnLabel: {
      fontFamily: fonts.bodySemiBold,
      fontSize: fontSizes.xs,
      color: '#FFF',
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      padding: spacing[4],
      gap: spacing[4],
      paddingBottom: spacing[12],
    },
    avatarHeroCard: {
      borderRadius: radii.xl,
      borderWidth: 1,
      padding: spacing[4],
      alignItems: 'center',
      justifyContent: 'center',
      ...shadows.sm,
    },
    previewMetaRow: {
      flexDirection: 'row',
      gap: spacing[2],
      marginBottom: spacing[3],
    },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[1],
      borderRadius: radii.full,
    },
    badgeText: {
      fontFamily: fonts.bodyMedium,
      fontSize: fontSizes.xs,
    },
    avatarViewport: {
      width: '100%',
      height: 300,
      alignItems: 'center',
      justifyContent: 'center',
    },
    photoPreview: {
      width: 180,
      height: 280,
      borderRadius: radii.md,
    },
    modeToggleRow: {
      flexDirection: 'row',
      gap: spacing[2],
      marginTop: spacing[3],
    },
    modePill: {
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[1.5],
      borderRadius: radii.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.secondary,
    },
    modePillLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: fontSizes.xs,
    },
    section: {
      borderRadius: radii.xl,
      borderWidth: 1,
      padding: spacing[4],
      gap: spacing[3],
      ...shadows.sm,
    },
    sectionTitle: {
      fontFamily: fonts.bodyBold,
      fontSize: fontSizes.base,
    },
    photoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[3],
    },
    photoThumb: {
      width: 64,
      height: 64,
      borderRadius: radii.lg,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    thumbImage: {
      width: '100%',
      height: '100%',
    },
    photoActions: {
      flex: 1,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing[2],
    },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[2],
      borderRadius: radii.lg,
      borderWidth: 1,
    },
    actionBtnText: {
      fontFamily: fonts.bodyMedium,
      fontSize: fontSizes.xs,
    },
    skinRow: {
      flexDirection: 'row',
      gap: spacing[2.5],
      paddingVertical: spacing[1],
    },
    skinCircle: {
      width: 34,
      height: 34,
      borderRadius: 17,
      borderWidth: 2,
    },
    skinCircleSelected: {
      borderWidth: 3,
      transform: [{ scale: 1.15 }],
      ...shadows.sm,
    },
    genderRow: {
      flexDirection: 'row',
      gap: spacing[3],
    },
    genderBtn: {
      flex: 1,
      height: 40,
      borderRadius: radii.lg,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    genderBtnText: {
      fontFamily: fonts.bodySemiBold,
      fontSize: fontSizes.sm,
    },
    infoCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing[2.5],
      padding: spacing[3.5],
      borderRadius: radii.lg,
      borderWidth: 1,
    },
    infoText: {
      flex: 1,
      fontFamily: fonts.body,
      fontSize: fontSizes.xs,
      lineHeight: 18,
    },
    bottomSaveBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing[2],
      height: 48,
      borderRadius: radii.xl,
      marginTop: spacing[2],
      ...shadows.md,
    },
    bottomSaveBtnText: {
      color: '#FFF',
      fontFamily: fonts.bodyBold,
      fontSize: fontSizes.base,
    },
  });
}


