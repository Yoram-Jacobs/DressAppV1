/**
 * apps/mobile/src/screens/closet/ClosetAddScreen.tsx
 *
 * Closet — add new item. Two entry paths:
 *
 *  TAB A — Gallery: pick from photo library (expo-image-picker)
 *  TAB B — Camera: live viewfinder (expo-camera) with shutter button
 *
 * After an image is captured/selected:
 *  1. Preview shown with a ScanningPipelineOverlay during AI processing
 *  2. api.createItem() skeleton → api.setItemPhoto() (triggers Eyes/segmentation)
 *  3. Attributes form (name, category, color, brand, size) pre-filled if AI returns data
 *  4. Submit → navigation.goBack()
 *
 * Route param: source?: 'camera' | 'manual' — starts on the correct tab.
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  I18nManager,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TextInput } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii } from '@mobile/theme/tokens';
import { api } from '@mobile/lib/api';
import type { ClosetStackParamList } from '@mobile/navigation/types';
import { ScanningPipelineOverlay } from '@mobile/components/ScanningPipelineOverlay';

// Lazy-require @dressapp/eyes-native to prevent a module-load crash from
// breaking the entire MainTabs tree. If eyes-native fails (e.g. llama.rn
// stub issue on EAS), the screen still renders and falls back to server API.
let sharedEyes: any = null;
let isDeviceSupported: () => boolean = () => false;
try {
  const eyesNative = require('@dressapp/eyes-native');
  sharedEyes = eyesNative.sharedEyes;
  isDeviceSupported = eyesNative.isDeviceSupported;
} catch (e) {
  console.warn('[ClosetAddScreen] eyes-native not available:', e);
}
type ClosetAddNavProp = NativeStackNavigationProp<ClosetStackParamList, 'ClosetAdd'>;
type ClosetAddRouteProp = RouteProp<ClosetStackParamList, 'ClosetAdd'>;

// ── Constants ──────────────────────────────────────────────────────────────
const CATEGORIES = [
  'Top', 'Bottom', 'Outerwear', 'Full Body', 'Footwear', 'Accessories', 'Underwear',
];

const addItemSchema = z.object({
  name:     z.string().min(1, 'Name is required').max(120),
  category: z.string().min(1, 'Category is required'),
  color:    z.string().optional(),
  brand:    z.string().optional(),
  size:     z.string().optional(),
});
type AddItemForm = z.infer<typeof addItemSchema>;

const { width: SCREEN_W } = Dimensions.get('window');

// ── Component ──────────────────────────────────────────────────────────────
export function ClosetAddScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<ClosetAddNavProp>();
  const route = useRoute<ClosetAddRouteProp>();
  const { colors } = useTheme();

  const startOnCamera = route.params?.source === 'camera';
  const [activeTab, setActiveTab] = useState<'gallery' | 'camera'>(startOnCamera ? 'camera' : 'gallery');

  // Image state
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);

  // Processing state
  const [scanning, setScanning] = useState(false);   // ScanningPipeline overlay
  const [submitting, setSubmitting] = useState(false);

  // Camera
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  // Category picker
  const [showCategories, setShowCategories] = useState(false);

  const { control, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<AddItemForm>({
    resolver: zodResolver(addItemSchema),
    defaultValues: { name: '', category: '', color: '', brand: '', size: '' },
  });
  const selectedCategory = watch('category');

  // ── Gallery picker ─────────────────────────────────────────────────────────
  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('common.permissionRequired', 'Permission required'), t('closetAdd.photoPermission', 'Please allow access to your photo library.'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.85,
      base64: true,
    });
    if (!result.canceled && result.assets && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setImageBase64(result.assets[0].base64 ?? null);
    }
  };

  // ── Camera capture ─────────────────────────────────────────────────────────
  const captureFromCamera = useCallback(async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.85 });
      if (photo) {
        setImageUri(photo.uri);
        setImageBase64(photo.base64 ?? null);
        setActiveTab('gallery'); // show preview on gallery tab
      }
    } catch (err: unknown) {
      Alert.alert(t('common.error', 'Error'), (err as { message?: string })?.message ?? 'Failed to capture');
    }
  }, [t]);

  // ── Submit ─────────────────────────────────────────────────────────────────
  const onSubmit = async (values: AddItemForm) => {
    if (!imageBase64) {
      Alert.alert(t('closetAdd.imageRequired', 'Image required'), t('closetAdd.pleaseAddImage', 'Please add a photo of your item.'));
      return;
    }
    setSubmitting(true);
    setScanning(true);
    try {
      // 1. Create item skeleton
      const created = await api.createItem({
        name: values.name,
        category: values.category,
        color:  values.color  || undefined,
        brand:  values.brand  || undefined,
        size:   values.size   || undefined,
      });
      const itemId = created?.id ?? created?._id;
      if (!itemId) throw new Error('No item ID returned');

      // 1b. Optional: on-device Eyes pre-analysis (auto-fills form fields)
      //     Runs silently — any error falls through to server-side Eyes.
      try {
        if (isDeviceSupported() && (await sharedEyes.isModelReady())) {
          if (!sharedEyes.isLoaded) await sharedEyes.load();
          const eyesResult = await sharedEyes.analyze(imageBase64);
          if (eyesResult) {
            // Pre-fill form fields that the user hasn't already filled in
            if (!values.name && eyesResult.title)    setValue('name',     eyesResult.title);
            if (!values.category && eyesResult.category) setValue('category', eyesResult.category);
            if (!values.brand && eyesResult.brand)   setValue('brand',    eyesResult.brand ?? '');
          }
        }
      } catch {
        // On-device analysis failed — continue with server-side Eyes
      }

      // 2. Upload + server-side Eyes AI segmentation
      await api.setItemPhoto(itemId, {
        imageBase64,
        imageMime: 'image/jpeg',
        autoSegment: true,
        language: undefined,
      });

      setScanning(false);
      navigation.goBack();
    } catch (err: unknown) {
      setScanning(false);
      const msg = (err as { response?: { data?: { detail?: string } }; message?: string })
        ?.response?.data?.detail ?? (err as { message?: string })?.message ?? 'Failed to add item';
      Alert.alert(t('common.error', 'Error'), msg);
    } finally {
      setSubmitting(false);
    }
  };

  const resetImage = () => {
    setImageUri(null);
    setImageBase64(null);
    reset({ name: '', category: '', color: '', brand: '', size: '' });
  };

  const s = makeStyles(colors);
  const isRtl = I18nManager.isRTL;

  // ── Camera tab ─────────────────────────────────────────────────────────────
  const renderCameraTab = () => {
    if (!cameraPermission?.granted) {
      return (
        <View style={s.permissionBlock}>
          <Text style={s.permissionIcon}>📷</Text>
          <Text style={s.permissionTitle}>{t('closetAdd.cameraPermTitle', 'Camera access needed')}</Text>
          <Text style={s.permissionBody}>{t('closetAdd.cameraPermBody', 'Allow camera access to Lucide.Scan garments instantly.')}</Text>
          <TouchableOpacity style={s.permissionBtn} onPress={requestCameraPermission}>
            <Text style={s.permissionBtnText}>{t('closetAdd.allowCamera', 'Allow camera')}</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (imageUri) {
      // Show preview + re-shoot option
      return (
        <View style={s.previewWrap}>
          <Image source={{ uri: imageUri }} style={s.previewFull} resizeMode="cover" />
          <TouchableOpacity style={s.reshootBtn} onPress={resetImage}>
            <Text style={s.reshootBtnText}>🔄 {t('closetAdd.retake', 'Retake')}</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={s.cameraWrap}>
        <CameraView
          ref={cameraRef}
          style={s.camera}
          facing="back"
        >
          {/* Garment guide overlay */}
          <View style={s.cameraGuideFrame}>
            <View style={[s.guideCorner, s.guideCornerTL]} />
            <View style={[s.guideCorner, s.guideCornerTR]} />
            <View style={[s.guideCorner, s.guideCornerBL]} />
            <View style={[s.guideCorner, s.guideCornerBR]} />
          </View>
          <Text style={s.cameraHint}>{t('closetAdd.cameraHint', 'Frame the garment within the guides')}</Text>
          {/* Shutter */}
          <TouchableOpacity style={s.shutter} onPress={captureFromCamera} accessibilityRole="button" accessibilityLabel="Capture photo">
            <View style={s.shutterInner} />
          </TouchableOpacity>
        </CameraView>
      </View>
    );
  };

  // ── Gallery tab ─────────────────────────────────────────────────────────────
  const renderGalleryTab = () => (
    <>
      <TouchableOpacity style={s.imagePicker} onPress={pickFromGallery} accessibilityRole="button">
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={s.previewImage} resizeMode="cover" />
        ) : (
          <View style={s.imagePickerPlaceholder}>
            <Text style={s.imagePickerIcon}>🖼</Text>
            <Text style={s.imagePickerLabel}>{t('closetAdd.addPhoto', 'Add photo')}</Text>
            <Text style={s.imagePickerSub}>{t('closetAdd.tapToSelect', 'Tap to select from library')}</Text>
          </View>
        )}
      </TouchableOpacity>
      {imageUri && (
        <View style={[s.photoActions, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
          <TouchableOpacity onPress={pickFromGallery}><Text style={s.linkText}>{t('closetAdd.changePhoto', 'Change photo')}</Text></TouchableOpacity>
          <TouchableOpacity onPress={resetImage}><Text style={[s.linkText, { color: colors.destructive }]}>{t('common.remove', 'Remove')}</Text></TouchableOpacity>
        </View>
      )}
    </>
  );

  return (
    <SafeAreaView style={s.root} edges={['bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          {/* ── Tab switcher ── */}
          <View style={[s.tabs, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
            {(['gallery', 'camera'] as const).map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[s.tab, activeTab === tab && s.tabActive]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[s.tabText, activeTab === tab && s.tabTextActive]}>
                  {tab === 'gallery' ? `🖼 ${t('closetAdd.gallery', 'Gallery')}` : `📷 ${t('closetAdd.camera', 'Camera')}`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Image source ── */}
          {activeTab === 'camera' ? renderCameraTab() : renderGalleryTab()}

          {/* ── Inline scanning indicator (shown while upload is in progress) ── */}
          {scanning && <ScanningPipelineOverlay visible variant="inline" />}

          {/* ── Form — shown once an image is selected ── */}
          {imageUri && (
            <View style={s.form}>
              <Text style={s.formTitle}>{t('closetAdd.itemDetails', 'Item details')}</Text>

              {/* Name */}
              <Controller control={control} name="name" render={({ field: { onChange, value } }) => (
                <View style={s.fieldWrap}>
                  <TextInput label={`${t('closetAdd.name', 'Item name')} *`} value={value} onChangeText={onChange}
                    mode="outlined" outlineColor={colors.border} activeOutlineColor={colors.accent}
                    textColor={colors.foreground} style={s.input} error={!!errors.name} />
                  {errors.name && <Text style={s.fieldError}>{errors.name.message}</Text>}
                </View>
              )} />

              {/* Category */}
              <Controller control={control} name="category" render={() => (
                <View style={s.fieldWrap}>
                  <TouchableOpacity
                    style={[s.categoryBtn, errors.category && s.categoryBtnError]}
                    onPress={() => setShowCategories(!showCategories)}
                  >
                    <Text style={selectedCategory ? s.categorySelected : s.categoryPlaceholder}>
                      {selectedCategory || `${t('closetAdd.selectCategory', 'Select category')} *`}
                    </Text>
                    <Text style={s.categoryChevron}>{showCategories ? '▲' : '▼'}</Text>
                  </TouchableOpacity>
                  {errors.category && <Text style={s.fieldError}>{errors.category.message}</Text>}
                  {showCategories && (
                    <View style={s.categoryList}>
                      {CATEGORIES.map((cat) => (
                        <TouchableOpacity key={cat} style={[s.categoryOption, cat === selectedCategory && s.categoryOptionActive]}
                          onPress={() => { setValue('category', cat, { shouldValidate: true }); setShowCategories(false); }}>
                          <Text style={[s.categoryOptionText, cat === selectedCategory && s.categoryOptionTextActive]}>{cat}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              )} />

              {/* Color / Brand / Size — row layout */}
              <View style={[s.metaRow, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
                <Controller control={control} name="color" render={({ field: { onChange, value } }) => (
                  <TextInput label={t('closetAdd.color', 'Color')} value={value} onChangeText={onChange}
                    mode="outlined" outlineColor={colors.border} activeOutlineColor={colors.accent}
                    textColor={colors.foreground} style={[s.input, s.metaInput]} />
                )} />
                <Controller control={control} name="size" render={({ field: { onChange, value } }) => (
                  <TextInput label={t('closetAdd.size', 'Size')} value={value} onChangeText={onChange}
                    mode="outlined" outlineColor={colors.border} activeOutlineColor={colors.accent}
                    textColor={colors.foreground} style={[s.input, s.metaInput]} />
                )} />
              </View>

              <Controller control={control} name="brand" render={({ field: { onChange, value } }) => (
                <TextInput label={t('closetAdd.brand', 'Brand')} value={value} onChangeText={onChange}
                  mode="outlined" outlineColor={colors.border} activeOutlineColor={colors.accent}
                  textColor={colors.foreground} style={s.input} />
              )} />

              {/* Submit */}
              <TouchableOpacity
                style={[s.submitBtn, submitting && s.submitBtnDisabled]}
                onPress={handleSubmit(onSubmit)}
                disabled={submitting}
                accessibilityRole="button"
              >
                {submitting
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={s.submitBtnText}>{t('closetAdd.submit', 'Add to closet')}</Text>}
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Full-screen block overlay during AI segmentation */}
      <ScanningPipelineOverlay visible={scanning} variant="block" />
    </SafeAreaView>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────
function makeStyles(colors: ReturnType<typeof import('@mobile/theme').useTheme>['colors']) {
  const isRtl = I18nManager.isRTL;
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    scroll: { padding: spacing[5], gap: spacing[4], paddingBottom: spacing[10] },

    // Tabs
    tabs: { borderRadius: radii.xl, backgroundColor: colors.muted, padding: 4, gap: 4 },
    tab: { flex: 1, paddingVertical: spacing[2], borderRadius: radii.lg, alignItems: 'center' },
    tabActive: { backgroundColor: colors.card, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
    tabText: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.mutedFg },
    tabTextActive: { fontFamily: fonts.bodyMedium, color: colors.foreground },

    // Gallery
    imagePicker: { width: '100%', aspectRatio: 3 / 4, borderRadius: radii.xl, overflow: 'hidden', backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed' },
    previewImage: { width: '100%', height: '100%' },
    imagePickerPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[2] },
    imagePickerIcon: { fontSize: 48 },
    imagePickerLabel: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.base, color: colors.foreground },
    imagePickerSub: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.mutedFg },
    photoActions: { justifyContent: 'center', gap: spacing[5] },
    linkText: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.accent },

    // Camera
    cameraWrap: { width: '100%', aspectRatio: 3 / 4, borderRadius: radii.xl, overflow: 'hidden', backgroundColor: '#000' },
    camera: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
    cameraGuideFrame: { position: 'absolute', top: '10%', left: '10%', right: '10%', bottom: '20%' },
    guideCorner: { position: 'absolute', width: 24, height: 24, borderColor: 'rgba(255,255,255,0.8)', borderWidth: 3 },
    guideCornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
    guideCornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
    guideCornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
    guideCornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
    cameraHint: { position: 'absolute', top: '5%', fontFamily: fonts.bodyMedium, fontSize: fontSizes.xs, color: 'rgba(255,255,255,0.8)', textAlign: 'center', paddingHorizontal: spacing[6] },
    shutter: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.25)', borderWidth: 3, borderColor: '#fff', alignItems: 'center', justifyContent: 'center', marginBottom: spacing[6] },
    shutterInner: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#fff' },

    // Preview + retake
    previewWrap: { width: '100%', aspectRatio: 3 / 4, borderRadius: radii.xl, overflow: 'hidden', backgroundColor: '#000' },
    previewFull: { width: '100%', height: '100%' },
    reshootBtn: { position: 'absolute', bottom: spacing[4], alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: spacing[4], paddingVertical: spacing[2], borderRadius: radii.xl },
    reshootBtnText: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: '#fff' },

    // Permission request
    permissionBlock: { alignItems: 'center', gap: spacing[3], paddingVertical: spacing[8] },
    permissionIcon: { fontSize: 56 },
    permissionTitle: { fontFamily: fonts.display, fontSize: fontSizes.xl, color: colors.foreground },
    permissionBody: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.mutedFg, textAlign: 'center', paddingHorizontal: spacing[4] },
    permissionBtn: { backgroundColor: colors.foreground, paddingHorizontal: spacing[5], paddingVertical: spacing[3], borderRadius: radii.md },
    permissionBtnText: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.base, color: colors.background },

    // Form
    form: { gap: spacing[3] },
    formTitle: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.xs, color: colors.mutedFg, textTransform: 'uppercase', letterSpacing: 0.8 },
    fieldWrap: { gap: 4 },
    input: { backgroundColor: colors.background },
    fieldError: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.destructive },
    metaRow: { gap: spacing[3] },
    metaInput: { flex: 1 },
    categoryBtn: { flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[3], paddingVertical: spacing[4], borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm, backgroundColor: colors.background },
    categoryBtnError: { borderColor: colors.destructive },
    categorySelected: { fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.foreground },
    categoryPlaceholder: { fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.mutedFg },
    categoryChevron: { fontSize: 12, color: colors.mutedFg },
    categoryList: { marginTop: 4, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, backgroundColor: colors.card, overflow: 'hidden' },
    categoryOption: { padding: spacing[3] },
    categoryOptionActive: { backgroundColor: colors.muted },
    categoryOptionText: { fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.foreground },
    categoryOptionTextActive: { fontFamily: fonts.bodyMedium, color: colors.accent },

    // Submit
    submitBtn: { backgroundColor: colors.foreground, borderRadius: radii.md, paddingVertical: spacing[4], alignItems: 'center', marginTop: spacing[2] },
    submitBtnDisabled: { opacity: 0.6 },
    submitBtnText: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.base, color: colors.background },
  });
}
