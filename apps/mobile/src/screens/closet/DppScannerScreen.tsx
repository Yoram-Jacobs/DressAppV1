/**
 * apps/mobile/src/screens/closet/DppScannerScreen.tsx
 *
 * EU Digital Product Passport — QR code scanner.
 * Ports apps/web/src/components/DppScanner.jsx to React Native.
 *
 * Flow:
 *  1. expo-camera CameraView with barcode scanning enabled
 *  2. On Scan: calls api.importDpp(qrPayload) → { item, dpp_data, source }
 *  3. On success → navigates to ItemDetail of the newly created item
 *     (or goBack() if no item was created — parse error)
 *
 * Accessed via ClosetStack "DppScanner" route, typically triggered
 * from ClosetAdd or a floating "Scan DPP" button.
 *
 * Navigation: registered in ClosetStack as "DppScanner"
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Vibration,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import type { BarcodeScanningResult } from 'expo-camera';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii } from '@mobile/theme/tokens';
import { api } from '@mobile/lib/api';
import type { ClosetStackParamList } from '@mobile/navigation/types';

type ClosetNavProp = NativeStackNavigationProp<ClosetStackParamList>;

export function DppScannerScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<ClosetNavProp>();
  const { colors } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);  // lock out duplicate scans
  const lastPayload = useRef<string | null>(null);

  const onBarcodeScanned = useCallback(async (result: BarcodeScanningResult) => {
    if (scanned || scanning) return;
    const payload = result.data;
    if (!payload || payload === lastPayload.current) return;

    lastPayload.current = payload;
    setScanned(true);
    setScanning(true);
    Vibration.vibrate(80);

    try {
      const data = await api.importDpp(payload);
      const itemId: string | undefined = data?.item?.id ?? data?.item?._id ?? data?.id;

      if (itemId) {
        // Navigate to the newly-created item for photo attachment
        navigation.replace('ItemDetail', { itemId });
      } else {
        // parse_error or no item created
        const errMsg = data?.parse_error ?? data?.message ?? t('dpp.noItemCreated', { defaultValue: 'Could not create item from this QR code.' });
        Alert.alert(
          t('dpp.scanResult', { defaultValue: 'Scan result' }),
          errMsg,
          [{ text: 'OK', onPress: () => { setScanned(false); lastPayload.current = null; } }],
        );
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } }; message?: string })
        ?.response?.data?.detail ?? (err as { message?: string })?.message ?? 'Import failed';
      Alert.alert(t('common.error', { defaultValue: 'Error' }), msg, [
        { text: 'OK', onPress: () => { setScanned(false); lastPayload.current = null; } },
      ]);
    } finally {
      setScanning(false);
    }
  }, [scanned, scanning, navigation, t]);

  const s = makeStyles(colors);

  // ── Permission gate ───────────────────────────────────────────────────────
  if (!permission?.granted) {
    return (
      <SafeAreaView style={[s.root, s.center]}>
        <Text style={s.permIcon}>📷</Text>
        <Text style={s.permTitle}>{t('closetAdd.cameraPermTitle', { defaultValue: 'Camera access needed' })}</Text>
        <Text style={s.permBody}>{t('dpp.cameraPermBody', { defaultValue: 'Allow camera access to scan Digital Product Passport QR codes.' })}</Text>
        <TouchableOpacity style={s.permBtn} onPress={requestPermission}>
          <Text style={s.permBtnText}>{t('closetAdd.allowCamera', { defaultValue: 'Allow camera' })}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.cancelLink}>
          <Text style={s.cancelLinkText}>{t('common.cancel', { defaultValue: 'Cancel' })}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root} edges={['bottom']}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanned ? undefined : onBarcodeScanned}
      />
      {/* Dimmed overlay with clear scan window */}
      <View style={s.overlay}>
        {/* Top dim */}
        <View style={[s.dimBand, { backgroundColor: 'rgba(0,0,0,0.55)' }]} />
        {/* Middle row: left dim | scan box | right dim */}
        <View style={s.middleRow}>
          <View style={[s.dimSide, { backgroundColor: 'rgba(0,0,0,0.55)' }]} />
          <View style={s.scanBox}>
            {/* Corner brackets */}
            <View style={[s.corner, s.cornerTL]} />
            <View style={[s.corner, s.cornerTR]} />
            <View style={[s.corner, s.cornerBL]} />
            <View style={[s.corner, s.cornerBR]} />
            {/* Animated scanning line */}
            <View style={s.scanLine} />
          </View>
          <View style={[s.dimSide, { backgroundColor: 'rgba(0,0,0,0.55)' }]} />
        </View>
        {/* Bottom dim */}
        <View style={[s.dimBand, { backgroundColor: 'rgba(0,0,0,0.55)' }]}>
          <Text style={s.hintText}>{t('dpp.hint', { defaultValue: 'Point at a Digital Product Passport QR code' })}</Text>
          {scanning && (
            <View style={s.processingRow}>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={s.processingText}>{t('dpp.processing', { defaultValue: 'Reading passport…' })}</Text>
            </View>
          )}
          <TouchableOpacity style={s.cancelBtn} onPress={() => navigation.goBack()}>
            <Text style={s.cancelBtnText}>{t('common.cancel', { defaultValue: 'Cancel' })}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const SCAN_BOX_SIZE = 260;

function makeStyles(c: ReturnType<typeof import('@mobile/theme').useTheme>['colors']) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: '#000' },
    center: { backgroundColor: c.background, alignItems: 'center', justifyContent: 'center', gap: spacing[3], padding: spacing[6] },
    // Permission
    permIcon: { fontSize: 56 },
    permTitle: { fontFamily: fonts.display, fontSize: fontSizes.xl, color: c.foreground, textAlign: 'center' },
    permBody: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: c.mutedFg, textAlign: 'center' },
    permBtn: { backgroundColor: c.foreground, paddingHorizontal: spacing[6], paddingVertical: spacing[3], borderRadius: radii.md },
    permBtnText: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.base, color: c.background },
    cancelLink: { marginTop: spacing[2] },
    cancelLinkText: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: c.mutedFg },
    // Scanner overlay
    overlay: { flex: 1 },
    dimBand: { width: '100%', flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: spacing[5] },
    middleRow: { flexDirection: 'row', height: SCAN_BOX_SIZE },
    dimSide: { flex: 1 },
    scanBox: {
      width: SCAN_BOX_SIZE,
      height: SCAN_BOX_SIZE,
      position: 'relative',
    },
    corner: {
      position: 'absolute',
      width: 28,
      height: 28,
      borderColor: '#fff',
      borderWidth: 3,
    },
    cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
    cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
    cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
    cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
    scanLine: {
      position: 'absolute',
      top: '50%',
      left: 8,
      right: 8,
      height: 2,
      backgroundColor: 'rgba(255,255,255,0.6)',
      borderRadius: 1,
    },
    hintText: {
      fontFamily: fonts.bodyMedium,
      fontSize: fontSizes.sm,
      color: '#fff',
      textAlign: 'center',
      paddingHorizontal: spacing[6],
      marginBottom: spacing[3],
    },
    processingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[3] },
    processingText: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: '#fff' },
    cancelBtn: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: spacing[6], paddingVertical: spacing[3], borderRadius: radii.xl, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
    cancelBtnText: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.base, color: '#fff' },
  });
}
