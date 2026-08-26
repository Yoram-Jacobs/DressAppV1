import React, { useState, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Image, 
  I18nManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@mobile/theme';
import { spacing } from '@mobile/theme/tokens';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ClosetStackParamList } from '../../navigation/types';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Lucide from "lucide-react-native";

type NavProp = NativeStackNavigationProp<ClosetStackParamList>;

export function ScanningPipelineScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<NavProp>();
  
  const [permission, requestPermission] = useCameraPermissions();
  const [flash, setFlash] = useState<'on' | 'off'>('off');
  const [photo, setPhoto] = useState<{ uri: string; base64?: string } | null>(null);
  
  const cameraRef = useRef<CameraView>(null);

  const BackIcon = I18nManager.isRTL ? Lucide.ArrowRight : Lucide.ArrowLeft;

  if (!permission) {
    return <View style={[styles.root, { backgroundColor: colors.background }]} />;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.root, styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.permissionText, { color: colors.foreground }]}>
          {t('camera.permissionNeeded', { defaultValue: 'We need your permission to show the camera' })}
        </Text>
        <TouchableOpacity style={[styles.permissionButton, { backgroundColor: colors.primary }]} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>{t('camera.grantPermission', { defaultValue: 'Grant Permission' })}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleCapture = async () => {
    if (cameraRef.current) {
      const result = await cameraRef.current.takePictureAsync({ base64: true });
      if (result) {
        setPhoto({ uri: result.uri, base64: result.base64 });
      }
    }
  };

  const handlePickGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets[0]) {
      const asset = result.assets[0];
      setPhoto({ uri: asset.uri, base64: asset.base64 || undefined });
    }
  };

  const handleUsePhoto = () => {
    if (photo) {
      navigation.navigate('ClosetAdd', { source: 'camera', /* photoUri: photo.uri, photoBase64: photo.base64 */ });
    }
  };

  if (photo) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={['bottom']}>
        <Image source={{ uri: photo.uri }} style={styles.previewImage} />
        <View style={[styles.previewOverlay, { backgroundColor: colors.background }]}>
          <TouchableOpacity style={[styles.actionBtn, { borderColor: colors.border }]} onPress={() => setPhoto(null)}>
            <Text style={[styles.actionBtnText, { color: colors.foreground }]}>{t('camera.retake', { defaultValue: 'Retake' })}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]} onPress={handleUsePhoto}>
            <Text style={[styles.actionBtnText, { color: '#fff' }]}>{t('camera.usePhoto', { defaultValue: 'Use Photo' })}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['bottom', 'top']}>
      <CameraView 
        style={StyleSheet.absoluteFillObject} 
        facing="back"
        enableTorch={flash === 'on'}
        ref={cameraRef}
      />
      <View style={styles.overlay} pointerEvents="box-none">
        <View style={styles.topControls}>
          <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
            <BackIcon size={28} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={() => setFlash(f => f === 'on' ? 'off' : 'on')}>
            {flash === 'on' ? <Lucide.Zap size={28} color="#fff" /> : <Lucide.ZapOff size={28} color="#fff" />}
          </TouchableOpacity>
        </View>

        <View style={styles.bottomControls}>
          <TouchableOpacity style={styles.iconButton} onPress={handlePickGallery}>
            <Lucide.Image size={32} color="#fff" />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.captureButton} onPress={handleCapture}>
            <View style={styles.captureInner} />
          </TouchableOpacity>
          
          <View style={styles.spacer} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  center: { justifyContent: 'center', alignItems: 'center', padding: 32 },
  permissionText: { textAlign: 'center', marginBottom: 16, fontSize: 16 },
  permissionButton: { paddingHorizontal: 24, paddingVertical: 8, borderRadius: 8 },
  permissionButtonText: { color: '#fff', fontWeight: 'bold' },
  camera: { flex: 1, justifyContent: 'space-between' },
  topControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    marginTop: 16,
  },
  iconButton: {
    padding: 8,
  },
  bottomControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingBottom: 48,
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
  },
  spacer: {
    width: 48,
  },
  previewImage: {
    flex: 1,
    resizeMode: 'contain',
  },
  previewOverlay: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 24,
    borderTopWidth: 1,
  },
  actionBtn: {
    flex: 1,
    marginHorizontal: 8,
    paddingVertical: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  actionBtnText: {
    fontWeight: 'bold',
    fontSize: 16,
  },
});
