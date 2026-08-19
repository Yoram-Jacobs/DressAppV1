/**
 * apps/mobile/src/screens/settings/EyesDownloadScreen.tsx
 *
 * "Eyes AI on your device" — lets users download the 4.1 GB GGUF model
 * pair for fully offline, on-device garment analysis.
 *
 * States:
 *   not-supported  → device has < 5 GB RAM; politely explains why
 *   not-downloaded → shows size warning + Download button
 *   downloading    → animated progress bar (file-level + overall)
 *   ready          → shows model info + Delete button to free disk space
 *
 * Navigation: MeStack "EyesDownload" (accessed from ProfileScreen)
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Animated,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii } from '@mobile/theme/tokens';

// Lazy-require @dressapp/eyes-native to prevent a module-load crash from
// breaking the entire MeStack tree. If eyes-native fails, the screen
// shows "not-supported" status gracefully.
let sharedEyes: any = null;
let isDeviceSupported: () => boolean = () => false;
type DownloadProgress = { phase: string; filename?: string; totalBytes: number; downloadedBytes: number; overallFraction: number };
try {
  const eyesNative = require('@dressapp/eyes-native');
  sharedEyes = eyesNative.sharedEyes;
  isDeviceSupported = eyesNative.isDeviceSupported;
} catch (e) {
  console.warn('[EyesDownloadScreen] eyes-native not available:', e);
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Status = 'checking' | 'not-supported' | 'not-downloaded' | 'downloading' | 'ready';

// ── Screen ────────────────────────────────────────────────────────────────────

export function EyesDownloadScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { colors } = useTheme();

  const [status, setStatus] = useState<Status>('checking');
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const progressAnim = useRef(new Animated.Value(0)).current;

  // ── Init ───────────────────────────────────────────────────────────────────

  const checkStatus = useCallback(async () => {
    setStatus('checking');
    if (!isDeviceSupported()) { setStatus('not-supported'); return; }
    const ready = await sharedEyes.modelDownloader.isComplete();
    setStatus(ready ? 'ready' : 'not-downloaded');
  }, []);

  useEffect(() => { checkStatus(); }, [checkStatus]);

  // ── Animate progress bar ───────────────────────────────────────────────────

  useEffect(() => {
    if (progress) {
      Animated.timing(progressAnim, {
        toValue: progress.overallFraction,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  }, [progress, progressAnim]);

  // ── Download ───────────────────────────────────────────────────────────────

  const startDownload = useCallback(async () => {
    setStatus('downloading');
    const off = sharedEyes.modelDownloader.onProgress((p) => {
      setProgress(p);
      if (p.phase === 'done')   { setStatus('ready');          off(); }
      if (p.phase === 'error')  { setStatus('not-downloaded'); off(); Alert.alert(t('common.error', 'Error'), p.error ?? 'Download failed'); }
    });
    try {
      await sharedEyes.modelDownloader.download();
    } catch (err: unknown) {
      setStatus('not-downloaded');
      off();
      Alert.alert(t('common.error', 'Error'), (err as Error)?.message ?? 'Download failed');
    }
  }, [t]);

  // ── Delete ─────────────────────────────────────────────────────────────────

  const deleteModels = useCallback(() => {
    Alert.alert(
      t('eyes.deleteTitle', 'Remove on-device model?'),
      t('eyes.deleteBody', 'This frees ~4.1 GB. You can re-download later. Garment scanning will use the cloud instead.'),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('eyes.deleteConfirm', 'Remove'),
          style: 'destructive',
          onPress: async () => {
            await sharedEyes.unload();
            await sharedEyes.modelDownloader.deleteModels();
            progressAnim.setValue(0);
            setProgress(null);
            setStatus('not-downloaded');
          },
        },
      ],
    );
  }, [t, progressAnim]);

  const s = makeStyles(colors);

  // ── Render helpers ─────────────────────────────────────────────────────────

  const renderProgress = () => {
    if (!progress) return null;
    const phaseName =
      progress.phase === 'main-model' ? t('eyes.downloadingModel', 'Downloading model weights…')
        : progress.phase === 'mmproj'    ? t('eyes.downloadingMmproj', 'Downloading vision projector…')
        : t('eyes.downloadingDone', 'Finalising…');

    const overallPct = Math.round(progress.overallFraction * 100);
    const filePct    = Math.round(progress.fileFraction    * 100);
    const mbLoaded   = (progress.bytesLoaded / (1024 * 1024)).toFixed(0);
    const mbTotal    = (progress.bytesTotal  / (1024 * 1024)).toFixed(0);

    return (
      <View style={s.progressContainer}>
        <Text style={s.progressPhase}>{phaseName}</Text>
        <View style={s.progressBarBg}>
          <Animated.View
            style={[
              s.progressBarFill,
              { width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
            ]}
          />
        </View>
        <Text style={s.progressStats}>
          {overallPct}% overall · {filePct}% this file · {mbLoaded} / {mbTotal} MB
        </Text>
      </View>
    );
  };

  // ── Main render ────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.root} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={s.iconRow}>
          <Text style={s.icon}>👁️</Text>
        </View>
        <Text style={s.title}>{t('eyes.title', 'Eyes AI — On Device')}</Text>
        <Text style={s.subtitle}>
          {t('eyes.subtitle', 'Run garment analysis privately on your device — no photos sent to the cloud during scanning.')}
        </Text>

        {/* Status card */}
        {status === 'checking' && (
          <View style={s.card}>
            <Text style={s.cardText}>{t('common.loading', 'Loading…')}</Text>
          </View>
        )}

        {status === 'not-supported' && (
          <View style={[s.card, s.cardWarning]}>
            <Text style={s.cardIcon}>⚠️</Text>
            <Text style={s.cardTitle}>{t('eyes.notSupported', 'Device not supported')}</Text>
            <Text style={s.cardText}>
              {t('eyes.notSupportedBody', 'Your device has less than 5 GB of RAM. The model requires ~4.1 GB to run. Cloud analysis is used automatically.')}
            </Text>
          </View>
        )}

        {(status === 'not-downloaded' || status === 'downloading') && (
          <>
            <View style={s.card}>
              <Text style={s.cardTitle}>{t('eyes.modelTitle', 'Gemma 4 E2B · Q4_K_M')}</Text>
              <View style={s.specRow}>
                <View style={s.spec}><Text style={s.specLabel}>{t('eyes.specMain', 'LLM weights')}</Text><Text style={s.specValue}>3.27 GB</Text></View>
                <View style={s.spec}><Text style={s.specLabel}>{t('eyes.specMmproj', 'Vision encoder')}</Text><Text style={s.specValue}>941 MB</Text></View>
                <View style={s.spec}><Text style={s.specLabel}>{t('eyes.specTotal', 'Total')}</Text><Text style={s.specValue}>~4.1 GB</Text></View>
              </View>
              <Text style={s.cardNote}>
                {t('eyes.wifiNote', '⚡ Download over Wi-Fi recommended. Existing partial downloads resume automatically.')}
              </Text>
            </View>

            {status === 'downloading' ? (
              renderProgress()
            ) : (
              <TouchableOpacity style={s.primaryBtn} onPress={startDownload}>
                <Text style={s.primaryBtnText}>{t('eyes.downloadBtn', 'Download Eyes model')}</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {status === 'ready' && (
          <>
            <View style={[s.card, s.cardReady]}>
              <Text style={s.cardIcon}>✅</Text>
              <Text style={s.cardTitle}>{t('eyes.readyTitle', 'On-device model ready')}</Text>
              <Text style={s.cardText}>
                {t('eyes.readyBody', 'Garment photos are analysed on your device. No photo data leaves the app during scanning.')}
              </Text>
              <View style={s.specRow}>
                <View style={s.spec}><Text style={s.specLabel}>{t('eyes.specModel', 'Model')}</Text><Text style={s.specValue}>Gemma 4 E2B Q4</Text></View>
                <View style={s.spec}><Text style={s.specLabel}>{t('eyes.specDisk', 'Disk usage')}</Text><Text style={s.specValue}>~4.1 GB</Text></View>
              </View>
            </View>
            <TouchableOpacity style={s.dangerBtn} onPress={deleteModels}>
              <Text style={s.dangerBtnText}>{t('eyes.deleteBtn', 'Remove model (free ~4.1 GB)')}</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

function makeStyles(c: ReturnType<typeof import('@mobile/theme').useTheme>['colors']) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    content: { padding: spacing[6], gap: spacing[4] },
    iconRow: { alignItems: 'center', paddingTop: spacing[4] },
    icon: { fontSize: 56 },
    title: { fontFamily: fonts.display, fontSize: fontSizes['2xl'], color: c.foreground, textAlign: 'center' },
    subtitle: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: c.mutedFg, textAlign: 'center', lineHeight: 20 },
    card: {
      backgroundColor: c.card,
      borderRadius: radii.xl,
      borderWidth: 1,
      borderColor: c.border,
      padding: spacing[5],
      gap: spacing[3],
    },
    cardWarning: { borderColor: '#f59e0b' },
    cardReady:   { borderColor: '#22c55e' },
    cardIcon:    { fontSize: 28, textAlign: 'center' },
    cardTitle:   { fontFamily: fonts.displayBold, fontSize: fontSizes.lg, color: c.foreground },
    cardText:    { fontFamily: fonts.body, fontSize: fontSizes.sm, color: c.mutedFg, lineHeight: 20 },
    cardNote:    { fontFamily: fonts.body, fontSize: fontSizes.xs, color: c.mutedFg, lineHeight: 18 },
    specRow:     { flexDirection: 'row', gap: spacing[3], flexWrap: 'wrap' },
    spec:        { flex: 1, minWidth: 90, backgroundColor: c.muted, borderRadius: radii.md, padding: spacing[2], alignItems: 'center' },
    specLabel:   { fontFamily: fonts.body, fontSize: fontSizes.xs, color: c.mutedFg },
    specValue:   { fontFamily: fonts.displayBold, fontSize: fontSizes.sm, color: c.foreground },
    primaryBtn:  { backgroundColor: c.foreground, borderRadius: radii.xl, padding: spacing[4], alignItems: 'center' },
    primaryBtnText: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.base, color: c.background },
    dangerBtn:   { borderWidth: 1, borderColor: '#ef4444', borderRadius: radii.xl, padding: spacing[4], alignItems: 'center' },
    dangerBtnText: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.base, color: '#ef4444' },
    progressContainer: { gap: spacing[2] },
    progressPhase: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: c.foreground },
    progressBarBg: { height: 8, backgroundColor: c.muted, borderRadius: radii.xl, overflow: 'hidden' },
    progressBarFill: { height: '100%', backgroundColor: c.foreground, borderRadius: radii.xl },
    progressStats: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: c.mutedFg },
  });
}
