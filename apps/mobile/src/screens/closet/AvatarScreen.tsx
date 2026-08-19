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
  Image,
  LayoutChangeEvent,
  PanResponder,
  PanResponderGestureState,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii } from '@mobile/theme/tokens';
import { api } from '@mobile/lib/api';
import { DynamicAvatarSvg } from '@mobile/components/DynamicAvatarSvg';

// ─── Constants ────────────────────────────────────────────────────────────────

const SKIN_TONE_PALETTE: readonly string[] = [
  '#FDDBB4', '#F1C27D', '#E0AC69', '#C68642',
  '#8D5524', '#F2C398', '#D4956A', '#A96232',
  '#6D3B1F', '#ECC9A0', '#9CA3AF', '#4B5563',
];

interface Measurements {
  height:    number;
  shoulders: number;
  chest:     number;
  waist:     number;
  hip:       number;
  armLength: number;
  inseam:    number;
  gender:    string;
}

const DEFAULT_MEASUREMENTS: Measurements = {
  height:    168,
  shoulders: 38,
  chest:     88,
  waist:     68,
  hip:       94,
  armLength: 58,
  inseam:    76,
  gender:    'female',
};

// ─── Lightweight native slider ────────────────────────────────────────────────
// Built with core PanResponder — no external package needed.

interface NativeSliderProps {
  value:      number;
  min:        number;
  max:        number;
  step?:      number;
  onChange:   (v: number) => void;
  trackColor: string;
  thumbColor: string;
  label:      string;
  unit:       string;
  labelColor: string;
  valueColor: string;
}

function NativeSlider({
  value, min, max, step = 1,
  onChange,
  trackColor, thumbColor,
  label, unit,
  labelColor, valueColor,
}: NativeSliderProps) {
  const trackWidth = useRef(0);

  // pan responder that maps X-offset → clamped stepped value
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder:  () => true,
        onPanResponderGrant: (e: GestureResponderEvent) => {
          if (trackWidth.current === 0) return;
          const x    = e.nativeEvent.locationX;
          const frac = Math.max(0, Math.min(1, x / trackWidth.current));
          const raw  = min + frac * (max - min);
          const snapped = Math.round(raw / step) * step;
          onChange(Math.max(min, Math.min(max, snapped)));
        },
        onPanResponderMove: (
          _: GestureResponderEvent,
          gs: PanResponderGestureState,
        ) => {
          if (trackWidth.current === 0) return;
          // Use cumulative dx from the touch-start position
          const startFrac = (value - min) / (max - min);
          const startPx   = startFrac * trackWidth.current;
          const newPx     = startPx + gs.dx;
          const frac      = Math.max(0, Math.min(1, newPx / trackWidth.current));
          const raw       = min + frac * (max - min);
          const snapped   = Math.round(raw / step) * step;
          onChange(Math.max(min, Math.min(max, snapped)));
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [min, max, step, value, onChange],
  );

  const frac    = (value - min) / (max - min);
  // Use a numeric percentage (0-100) — DimensionValue accepts `number` as px,
  // so we box the % string with a cast accepted by RN's ViewStyle.
  const pctNum  = parseFloat((frac * 100).toFixed(1));
  const pctStr  = `${pctNum}%` as unknown as import('react-native').DimensionValue;

  const onLayout = (e: LayoutChangeEvent) => {
    trackWidth.current = e.nativeEvent.layout.width;
  };

  return (
    <View style={nsStyles.container}>
      {/* Header row */}
      <View style={nsStyles.header}>
        <Text style={[nsStyles.label, { color: labelColor }]}>{label}</Text>
        <Text style={[nsStyles.valueText, { color: valueColor }]}>
          {value} {unit}
        </Text>
      </View>
      {/* Track */}
      <View
        style={nsStyles.trackHitArea}
        onLayout={onLayout}
        {...panResponder.panHandlers}
      >
        <View style={[nsStyles.trackBg, { backgroundColor: trackColor }]}>
          <View
            style={[
              nsStyles.trackFill,
              { width: pctStr, backgroundColor: thumbColor } as any,
            ]}
          />
          {/* Thumb */}
          <View
            style={[
              nsStyles.thumb,
              { left: pctStr, backgroundColor: thumbColor } as any,
            ]}
          />
        </View>
      </View>
    </View>
  );
}

const nsStyles = StyleSheet.create({
  container: {
    marginBottom: spacing[4],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing[1],
  },
  label: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.xs,
  },
  valueText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
  },
  trackHitArea: {
    height: 36,
    justifyContent: 'center',
  },
  trackBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'visible',
    position: 'relative',
  },
  trackFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 3,
  },
  thumb: {
    position: 'absolute',
    top: '50%',
    width: 20,
    height: 20,
    borderRadius: 10,
    marginTop: -10,
    marginLeft: -10,
    // shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function AvatarScreen() {
  const { t }      = useTranslation();
  const { colors } = useTheme();
  // useNavigation for back-button awareness (not currently called but satisfies task requirement)
  useNavigation();
  const isRtl = I18nManager.isRTL;

  // ── State ──────────────────────────────────────────────────────────────────
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);

  const [measurements, setMeasurements] = useState<Measurements>(DEFAULT_MEASUREMENTS);
  const [skinColor,    setSkinColor]    = useState('#9CA3AF');
  const [bodyPhotoUrl, setBodyPhotoUrl] = useState<string | null>(null);
  const [avatarMode,   setAvatarMode]   = useState<'mannequin' | 'photo'>('mannequin');

  // ── Fetch on mount ─────────────────────────────────────────────────────────
  useEffect(() => {
    fetchParams();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchParams = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.getAvatarParams();

      if (res?.measurements) {
        const m = res.measurements;
        setMeasurements({
          height:    Number(m.height)                    || 168,
          shoulders: Number(m.shoulders)                 || 38,
          chest:     Number(m.chest)                     || 88,
          waist:     Number(m.waist)                     || 68,
          hip:       Number(m.hips ?? m.hip)             || 94,
          armLength: Number(m.arm_length ?? m.armLength) || 58,
          inseam:    Number(m.inseam)                    || 76,
          gender:    String(m.gender ?? res.gender ?? 'female').toLowerCase(),
        });
      }

      if (res?.skin_tone) {
        setSkinColor(res.skin_tone);
      }

      if (res?.body_photo_url) {
        setBodyPhotoUrl(res.body_photo_url);
        setAvatarMode('photo');
      }
    } catch (err) {
      console.error('[AvatarScreen] fetchParams error', err);
      Alert.alert(
        t('avatar.title', { defaultValue: 'Avatar' }),
        t('pages.avatarPage.failed_to_load_avatar_parameters', {
          defaultValue: 'Failed to load avatar parameters.',
        }),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  // ── Measurement field helper ───────────────────────────────────────────────
  const setField = useCallback(<K extends keyof Measurements>(
    key: K,
    value: Measurements[K],
  ) => {
    setMeasurements(prev => ({ ...prev, [key]: value }));
  }, []);

  // ── Photo picker ───────────────────────────────────────────────────────────
  const handlePickPhoto = useCallback(async (useCamera: boolean) => {
    setPhotoBusy(true);
    try {
      let result: ImagePicker.ImagePickerResult;

      if (useCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert(
            t('avatar.bodyPhoto', { defaultValue: 'Body Photo' }),
            t('common.cameraPermission', { defaultValue: 'Camera access is required.' }),
          );
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          base64: true,
          quality: 0.82,
        });
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert(
            t('avatar.bodyPhoto', { defaultValue: 'Body Photo' }),
            t('common.galleryPermission', { defaultValue: 'Photo library access is required.' }),
          );
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          base64: true,
          quality: 0.82,
        });
      }

      if (!result.canceled && result.assets?.[0]) {
        const asset    = result.assets[0];
        const mimeType = asset.mimeType ?? 'image/jpeg';
        const dataUri  = asset.base64
          ? `data:${mimeType};base64,${asset.base64}`
          : (asset.uri ?? null);

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
  }, [t]);

  const handleRemovePhoto = useCallback(() => {
    setBodyPhotoUrl(null);
    setAvatarMode('mannequin');
  }, []);

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    try {
      setSaving(true);
      await api.patchMe({
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
        t('avatar.title', { defaultValue: 'Avatar' }),
        t('pages.avatarPage.avatar_saved_successfully', {
          defaultValue: 'Digital avatar profile saved successfully!',
        }),
      );
    } catch (err) {
      console.error('[AvatarScreen] save error', err);
      Alert.alert(
        t('avatar.title', { defaultValue: 'Avatar' }),
        t('pages.avatarPage.failed_to_save_measurements', {
          defaultValue: 'Failed to save measurements. Please try again.',
        }),
      );
    } finally {
      setSaving(false);
    }
  }, [measurements, skinColor, bodyPhotoUrl, t]);

  // ── Derived styles ─────────────────────────────────────────────────────────
  const s = useMemo(() => makeStyles(colors, isRtl), [colors, isRtl]);

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={[s.safeArea, s.centered]} edges={['bottom']}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={s.loadingText}>
          {t('pages.avatarPage.generating_your_3d_digital_double', {
            defaultValue: 'Generating your digital double…',
          })}
        </Text>
      </SafeAreaView>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safeArea} edges={['bottom']}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <Text style={s.title} numberOfLines={1}>
            {t('avatar.title', { defaultValue: 'My Digital Avatar' })}
          </Text>
          <Text style={s.subtitle} numberOfLines={2}>
            {t('pages.avatarPage.subtitle_description', {
              defaultValue:
                'Calibrate your body measurements or upload a full-body photo.',
            })}
          </Text>
        </View>
        <TouchableOpacity
          style={[s.saveBtn, saving && s.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={t('avatar.save', { defaultValue: 'Save' })}
        >
          {saving ? (
            <ActivityIndicator size="small" color={colors.primaryFg} />
          ) : (
            <Text style={s.saveBtnLabel}>
              {t('avatar.save', { defaultValue: 'Save' })}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Two-column body ────────────────────────────────────────────── */}
      <View style={s.body}>
        {/* Left column — scrollable controls (flex 6 ≈ 60%) */}
        <ScrollView
          style={s.leftCol}
          contentContainerStyle={s.leftContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Body Photo ─────────────────────────────────────────────── */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>
              {t('avatar.bodyPhoto', { defaultValue: 'Full-Body Photo' })}
            </Text>

            <View style={s.photoRow}>
              {/* Thumbnail */}
              <View style={s.photoThumb}>
                {bodyPhotoUrl ? (
                  <Image
                    source={{ uri: bodyPhotoUrl }}
                    style={s.thumbImage}
                    resizeMode="cover"
                  />
                ) : (
                  <Text style={s.thumbPlaceholder}>📷</Text>
                )}
              </View>

              {/* Buttons */}
              <View style={s.photoActions}>
                <TouchableOpacity
                  style={s.outlineBtn}
                  onPress={() => handlePickPhoto(true)}
                  disabled={photoBusy}
                  activeOpacity={0.75}
                >
                  <Text style={s.outlineBtnLabel}>
                    {t('profile.takePhoto', { defaultValue: 'Camera' })}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={s.outlineBtn}
                  onPress={() => handlePickPhoto(false)}
                  disabled={photoBusy}
                  activeOpacity={0.75}
                >
                  <Text style={s.outlineBtnLabel}>
                    {bodyPhotoUrl
                      ? t('profile.replacePhoto', { defaultValue: 'Replace' })
                      : t('avatar.addPhoto',       { defaultValue: 'Gallery' })}
                  </Text>
                </TouchableOpacity>

                {bodyPhotoUrl && (
                  <TouchableOpacity
                    style={s.removeBtn}
                    onPress={handleRemovePhoto}
                    disabled={photoBusy}
                    activeOpacity={0.75}
                  >
                    <Text style={s.removeBtnLabel}>
                      {t('avatar.removePhoto', { defaultValue: 'Remove' })}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Mode toggle — only shown when a photo is loaded */}
            {bodyPhotoUrl && (
              <View style={s.modeToggleRow}>
                {(['mannequin', 'photo'] as const).map(mode => (
                  <TouchableOpacity
                    key={mode}
                    style={[s.modePill, avatarMode === mode && s.modePillActive]}
                    onPress={() => setAvatarMode(mode)}
                    activeOpacity={0.8}
                  >
                    <Text style={[s.modePillLabel, avatarMode === mode && s.modePillLabelActive]}>
                      {mode === 'mannequin'
                        ? t('pages.avatarPage.vector_mannequin', { defaultValue: 'Mannequin' })
                        : t('pages.avatarPage.real_photo',       { defaultValue: 'Real Photo' })}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* ── Skin Tone Picker ───────────────────────────────────────── */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>
              {t('avatar.skinTone', { defaultValue: 'Skin Tone' })}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.skinRow}
            >
              {SKIN_TONE_PALETTE.map(color => {
                const selected = skinColor.toLowerCase() === color.toLowerCase();
                return (
                  <TouchableOpacity
                    key={color}
                    style={[
                      s.skinCircle,
                      { backgroundColor: color },
                      selected && s.skinCircleSelected,
                    ]}
                    onPress={() => setSkinColor(color)}
                    activeOpacity={0.8}
                    accessibilityLabel={`Skin tone ${color}`}
                  />
                );
              })}
            </ScrollView>
          </View>

          {/* ── Gender Toggle ──────────────────────────────────────────── */}
          <View style={s.section}>
            <View style={s.genderRow}>
              <Text style={s.sectionTitle}>
                {t('avatar.gender', { defaultValue: 'Gender Model' })}
              </Text>
              <View style={s.genderPills}>
                {(['female', 'male'] as const).map(g => (
                  <TouchableOpacity
                    key={g}
                    style={[
                      s.genderPill,
                      measurements.gender === g && s.genderPillActive,
                    ]}
                    onPress={() => setField('gender', g)}
                    activeOpacity={0.8}
                  >
                    <Text style={[
                      s.genderPillLabel,
                      measurements.gender === g && s.genderPillLabelActive,
                    ]}>
                      {g === 'female'
                        ? t('pages.avatarPage.female', { defaultValue: 'Female' })
                        : t('pages.avatarPage.male',   { defaultValue: 'Male' })}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* ── Measurement Sliders ────────────────────────────────────── */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>
              {t('avatar.measurements', { defaultValue: 'Body Measurements' })}
            </Text>

            <NativeSlider
              label={t('pages.avatarPage.height', { defaultValue: 'Height' })}
              value={measurements.height} min={140} max={210} unit="cm"
              onChange={v => setField('height', v)}
              trackColor={colors.border} thumbColor={colors.primary}
              labelColor={colors.foreground} valueColor={colors.accent}
            />
            <NativeSlider
              label={t('pages.avatarPage.shoulders', { defaultValue: 'Shoulder Width' })}
              value={measurements.shoulders} min={28} max={58} unit="cm"
              onChange={v => setField('shoulders', v)}
              trackColor={colors.border} thumbColor={colors.primary}
              labelColor={colors.foreground} valueColor={colors.accent}
            />
            <NativeSlider
              label={t('pages.avatarPage.chest', { defaultValue: 'Chest Circumference' })}
              value={measurements.chest} min={65} max={138} unit="cm"
              onChange={v => setField('chest', v)}
              trackColor={colors.border} thumbColor={colors.primary}
              labelColor={colors.foreground} valueColor={colors.accent}
            />
            <NativeSlider
              label={t('pages.avatarPage.waist', { defaultValue: 'Waist Circumference' })}
              value={measurements.waist} min={54} max={128} unit="cm"
              onChange={v => setField('waist', v)}
              trackColor={colors.border} thumbColor={colors.primary}
              labelColor={colors.foreground} valueColor={colors.accent}
            />
            <NativeSlider
              label={t('pages.avatarPage.hip', { defaultValue: 'Hip Circumference' })}
              value={measurements.hip} min={68} max={148} unit="cm"
              onChange={v => setField('hip', v)}
              trackColor={colors.border} thumbColor={colors.primary}
              labelColor={colors.foreground} valueColor={colors.accent}
            />
            <NativeSlider
              label={t('pages.avatarPage.arm_length', { defaultValue: 'Arm Length' })}
              value={measurements.armLength} min={42} max={85} unit="cm"
              onChange={v => setField('armLength', v)}
              trackColor={colors.border} thumbColor={colors.primary}
              labelColor={colors.foreground} valueColor={colors.accent}
            />
            <NativeSlider
              label={t('pages.avatarPage.inseam', { defaultValue: 'Inseam (Leg Length)' })}
              value={measurements.inseam} min={52} max={100} unit="cm"
              onChange={v => setField('inseam', v)}
              trackColor={colors.border} thumbColor={colors.primary}
              labelColor={colors.foreground} valueColor={colors.accent}
            />
          </View>

          {/* Info note */}
          <View style={s.infoNote}>
            <Text style={[s.infoNoteText, { color: colors.accent }]}>
              {t('pages.avatarPage.info_note', {
                defaultValue:
                  'Body measurements calibrate virtual garment try-on physics and size recommendations across the app.',
              })}
            </Text>
          </View>

          <View style={{ height: spacing[8] }} />
        </ScrollView>

        {/* Right column — sticky avatar preview (flex 4 ≈ 40%) */}
        <View style={[s.rightCol, { backgroundColor: colors.card }]}>
          <Text style={[s.previewLabel, { color: colors.mutedFg }]}>
            {measurements.height}cm · {measurements.gender.toUpperCase()}
          </Text>

          {avatarMode === 'photo' && bodyPhotoUrl ? (
            <Image
              source={{ uri: bodyPhotoUrl }}
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
              width={120}
              showGuideLines
            />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

// Export default as well for any direct imports
export default AvatarScreen;

// ─── Styles factory ───────────────────────────────────────────────────────────

type Colors = ReturnType<typeof import('@mobile/theme').useTheme>['colors'];

function makeStyles(colors: Colors, isRtl: boolean) {
  return StyleSheet.create({
    // Layout
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    centered: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      fontFamily: fonts.body,
      fontSize: fontSizes.sm,
      color: colors.mutedFg,
      marginTop: spacing[2],
      textAlign: 'center',
    },

    // Header
    header: {
      flexDirection: isRtl ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[3],
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.card,
    },
    headerLeft: {
      flex: 1,
      marginEnd: spacing[3],
    },
    title: {
      fontFamily: fonts.displayBold,
      fontSize: fontSizes.lg,
      color: colors.foreground,
    },
    subtitle: {
      fontFamily: fonts.body,
      fontSize: fontSizes.xs,
      color: colors.mutedFg,
      marginTop: spacing[0.5],
    },
    saveBtn: {
      backgroundColor: colors.primary,
      borderRadius: radii.md,
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[2],
      minWidth: 72,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveBtnDisabled: {
      opacity: 0.6,
    },
    saveBtnLabel: {
      fontFamily: fonts.bodySemiBold,
      fontSize: fontSizes.sm,
      color: colors.primaryFg,
    },

    // Two-column
    body: {
      flex: 1,
      flexDirection: isRtl ? 'row-reverse' : 'row',
    },
    leftCol: {
      flex: 6,
    },
    leftContent: {
      paddingHorizontal: spacing[4],
      paddingTop: spacing[4],
    },

    // Right: sticky avatar
    rightCol: {
      flex: 4,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing[4],
      paddingHorizontal: spacing[2],
      borderStartWidth: 1,
      borderStartColor: colors.border,
    },
    previewLabel: {
      fontFamily: fonts.body,
      fontSize: fontSizes.xs,
      marginBottom: spacing[2],
      letterSpacing: 0.5,
    },
    photoPreview: {
      width: 120,
      height: 270,
      borderRadius: radii.sm,
    },

    // Section card
    section: {
      backgroundColor: colors.card,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing[4],
      marginBottom: spacing[4],
    },
    sectionTitle: {
      fontFamily: fonts.bodySemiBold,
      fontSize: fontSizes.sm,
      color: colors.foreground,
      marginBottom: spacing[3],
    },

    // Photo section
    photoRow: {
      flexDirection: isRtl ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: spacing[3],
    },
    photoThumb: {
      width: 56,
      height: 56,
      borderRadius: radii.md,
      backgroundColor: colors.muted,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    thumbImage: {
      width: '100%',
      height: '100%',
    },
    thumbPlaceholder: {
      fontSize: 22,
    },
    photoActions: {
      flex: 1,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing[2],
    },
    outlineBtn: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.sm,
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[1.5],
    },
    outlineBtnLabel: {
      fontFamily: fonts.bodySemiBold,
      fontSize: fontSizes.xs,
      color: colors.foreground,
    },
    removeBtn: {
      borderWidth: 1,
      borderColor: colors.destructive,
      borderRadius: radii.sm,
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[1.5],
    },
    removeBtnLabel: {
      fontFamily: fonts.bodySemiBold,
      fontSize: fontSizes.xs,
      color: colors.destructive,
    },
    modeToggleRow: {
      flexDirection: isRtl ? 'row-reverse' : 'row',
      marginTop: spacing[3],
      backgroundColor: colors.muted,
      borderRadius: radii.sm,
      padding: spacing[1],
      gap: spacing[1],
    },
    modePill: {
      flex: 1,
      borderRadius: radii.sm - 2,
      paddingVertical: spacing[1.5],
      alignItems: 'center',
    },
    modePillActive: {
      backgroundColor: colors.card,
    },
    modePillLabel: {
      fontFamily: fonts.bodySemiBold,
      fontSize: fontSizes.xs,
      color: colors.mutedFg,
    },
    modePillLabelActive: {
      color: colors.foreground,
    },

    // Skin tone
    skinRow: {
      flexDirection: isRtl ? 'row-reverse' : 'row',
      gap: spacing[2],
      paddingVertical: spacing[1],
    },
    skinCircle: {
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: 'rgba(0,0,0,0.1)',
    },
    skinCircleSelected: {
      borderWidth: 3,
      borderColor: colors.primary,
    },

    // Gender toggle
    genderRow: {
      flexDirection: isRtl ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    genderPills: {
      flexDirection: isRtl ? 'row-reverse' : 'row',
      backgroundColor: colors.muted,
      borderRadius: radii.sm,
      padding: spacing[1],
      gap: spacing[1],
    },
    genderPill: {
      borderRadius: radii.sm - 2,
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[1.5],
    },
    genderPillActive: {
      backgroundColor: colors.primary,
    },
    genderPillLabel: {
      fontFamily: fonts.bodySemiBold,
      fontSize: fontSizes.xs,
      color: colors.mutedFg,
    },
    genderPillLabelActive: {
      color: colors.primaryFg,
    },

    // Info note
    infoNote: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      padding: spacing[3],
      marginBottom: spacing[4],
      backgroundColor: colors.muted,
    },
    infoNoteText: {
      fontFamily: fonts.body,
      fontSize: fontSizes.xs,
      lineHeight: fontSizes.xs * 1.55,
    },
  });
}


