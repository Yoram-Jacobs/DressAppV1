/**
 * apps/mobile/src/components/profile/ImportWardrobeSection.tsx
 *
 * Mobile Wardrobe Migration section & full-screen modal for DressApp mobile.
 * Supports two native mobile migration flows:
 *   - #2: Closet Screenshots & Screen-Recording Upload (GridSlicer + DedupEngine)
 *   - #3: In-App <WebView> Auto-Scanner (react-native-webview DOM harvester)
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  ScrollView,
  Image,
  ActivityIndicator,
  I18nManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';
import * as Lucide from 'lucide-react-native';
import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii } from '@mobile/theme/tokens';
import { useTierLimits } from '@mobile/hooks/useTierLimits';
import { api } from '@mobile/lib/api';
import { closetStore } from '@mobile/lib/stores/closetStore';

interface PresetApp {
  name: string;
  domain: string;
  loginUrl: string;
  icon: string;
  items: string;
}

const PRESET_APPS: PresetApp[] = [
  { name: 'Whering', domain: 'app.whering.co.uk', loginUrl: 'https://app.whering.co.uk/login', icon: '👗', items: '95+ items' },
  { name: 'Acloset', domain: 'web.acloset.app', loginUrl: 'https://web.acloset.app/login', icon: '📱', items: '48+ items' },
  { name: 'Stylebook', domain: 'www.stylebookapp.com', loginUrl: 'https://www.stylebookapp.com', icon: '🎨', items: '65+ items' },
  { name: 'Smartli', domain: 'smartli.app', loginUrl: 'https://smartli.app', icon: '⚡', items: '32+ items' },
  { name: 'Indyx', domain: 'myindyx.com', loginUrl: 'https://www.myindyx.com', icon: '✨', items: '60+ items' },
];

const WEBVIEW_HARVESTER_SCRIPT = `
(function() {
  if (window.__dressAppScanning) return;
  window.__dressAppScanning = true;

  var post = function(payload) {
    try {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      }
    } catch (e) {}
  };

  var tryImgToBase64 = function(imgEl) {
    try {
      var cvs = document.createElement('canvas');
      var w = Math.min(640, imgEl.naturalWidth || imgEl.width || 300);
      var h = Math.min(640, imgEl.naturalHeight || imgEl.height || 300);
      if (w < 40 || h < 40) return null;
      cvs.width = w;
      cvs.height = h;
      var ctx = cvs.getContext('2d');
      ctx.drawImage(imgEl, 0, 0, w, h);
      return cvs.toDataURL('image/jpeg', 0.84).split(',')[1];
    } catch (err) {
      return null;
    }
  };

  (async function() {
    var seen = {};
    var totalFound = 0;
    var idlePasses = 0;

    post({ type: 'DRESSAPP_WEBVIEW_STATUS', phase: 'scanning', found: 0 });

    for (var pass = 0; pass < 35; pass++) {
      var batch = [];
      var imgs = Array.prototype.slice.call(document.querySelectorAll('img'));
      for (var i = 0; i < imgs.length; i++) {
        var img = imgs[i];
        var r = img.getBoundingClientRect();
        if (r.width < 55 || r.height < 55) continue;
        var src = img.currentSrc || img.src || '';
        if (!src || seen[src]) continue;

        var p = img.parentElement;
        var inChrome = false;
        while (p && p !== document.body) {
          var tag = (p.tagName || '').toLowerCase();
          if (tag === 'header' || tag === 'nav' || tag === 'footer') {
            inChrome = true;
            break;
          }
          p = p.parentElement;
        }
        if (inChrome) continue;

        seen[src] = true;
        var b64 = tryImgToBase64(img);
        batch.push({
          crop_base64: b64 || undefined,
          image_url: src.indexOf('http') === 0 ? src : undefined,
          title: img.alt || ''
        });
        totalFound++;
      }

      if (batch.length === 0) {
        var nodes = Array.prototype.slice.call(document.querySelectorAll('div, li, a, article'));
        for (var j = 0; j < nodes.length; j++) {
          var el = nodes[j];
          var rect = el.getBoundingClientRect();
          if (rect.width < 70 || rect.height < 70 || rect.width > 500 || rect.height > 650) continue;
          var bg = window.getComputedStyle(el).backgroundImage || '';
          var m = bg.match(/url\\(["']?(https?:\\/\\/[^"')]+)["']?\\)/i);
          if (m && m[1] && !seen[m[1]]) {
            seen[m[1]] = true;
            batch.push({ image_url: m[1], title: '' });
            totalFound++;
          }
        }
      }

      if (batch.length > 0) {
        idlePasses = 0;
        post({ type: 'DRESSAPP_WEBVIEW_BATCH', cards: batch, totalFound: totalFound });
      } else {
        idlePasses++;
        if (idlePasses >= 3) break;
      }

      window.scrollBy({ top: Math.round(window.innerHeight * 0.72), behavior: 'smooth' });
      await new Promise(function(res) { setTimeout(res, 950); });
    }

    window.__dressAppScanning = false;
    post({ type: 'DRESSAPP_WEBVIEW_DONE', totalFound: totalFound });
  })();
})();
true;
`;

interface SelectedMediaAsset {
  uri: string;
  type: 'image' | 'video';
  base64?: string | null;
}

export function ImportWardrobeSection() {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const navigation = useNavigation<any>();
  const { canAccessMigration, showUpgradeAlert } = useTierLimits();
  const isRTL = I18nManager.isRTL;

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedApp, setSelectedApp] = useState<PresetApp>(PRESET_APPS[0]);
  const [activeTab, setActiveTab] = useState<'screenshots' | 'webview'>('screenshots');

  // Tab #2 state: Screenshots / Screen-Recording
  const [mediaAssets, setMediaAssets] = useState<SelectedMediaAsset[]>([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  // Tab #3 state: In-App WebView Scanner
  const webViewRef = useRef<WebView>(null);
  const [webScanning, setWebScanning] = useState(false);
  const [webFoundCount, setWebFoundCount] = useState(0);
  const [webSavedCount, setWebSavedCount] = useState(0);

  const handleStartImport = (app: PresetApp) => {
    if (!canAccessMigration) {
      showUpgradeAlert(t('common.features.migration'), false, () => navigation.navigate('Pricing'));
      return;
    }
    setSelectedApp(app);
    setActiveTab('screenshots');
    setMediaAssets([]);
    setWebScanning(false);
    setWebFoundCount(0);
    setWebSavedCount(0);
    setModalVisible(true);
  };

  const handlePickScreenshotsOrVideo = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          t('common.permissionRequired', { defaultValue: 'Permission Required' }),
          t('migration.mediaPermissionDesc', { defaultValue: 'Please allow photo library access to select closet screenshots or screen recordings.' })
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsMultipleSelection: true,
        selectionLimit: 25,
        quality: 0.85,
        base64: true,
      });

      if (result.canceled || !result.assets?.length) return;

      const added: SelectedMediaAsset[] = result.assets.map((a) => ({
        uri: a.uri,
        type: a.type === 'video' ? 'video' : 'image',
        base64: a.base64 ?? null,
      }));
      setMediaAssets((prev) => [...prev, ...added].slice(0, 30));
    } catch {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('common.errorOccurred', { defaultValue: 'An error occurred.' })
      );
    }
  };

  const handleSliceAndImport = async () => {
    if (!mediaAssets.length || uploadingMedia) return;
    setUploadingMedia(true);
    try {
      const framesBase64: string[] = [];
      let videoBase64: string | undefined;

      for (const asset of mediaAssets) {
        if (asset.type === 'video') {
          if (!videoBase64) {
            if (asset.base64) {
              videoBase64 = asset.base64;
            } else {
              const b64 = await FileSystem.readAsStringAsync(asset.uri, {
                encoding: (FileSystem as any).EncodingType?.Base64 ?? 'base64',
              });
              if (b64) videoBase64 = b64;
            }
          }
        } else {
          if (asset.base64) {
            framesBase64.push(asset.base64);
          } else {
            const b64 = await FileSystem.readAsStringAsync(asset.uri, {
              encoding: (FileSystem as any).EncodingType?.Base64 ?? 'base64',
            });
            if (b64) framesBase64.push(b64);
          }
        }
      }

      const res = await (api as any).uploadMigrationScreenshots({
        app_name: selectedApp.name,
        frames_base64: framesBase64,
        video_base64: videoBase64,
      });

      const savedCount = res?.items_saved ?? 0;
      await (api as any).updateMigrationFlag?.({ migration_flag: 'Migrated' }).catch(() => {});
      await closetStore.refresh({ force: true }).catch(() => {});

      setModalVisible(false);
      setMediaAssets([]);
      Alert.alert(
        t('migration.importCompleteTitle', { defaultValue: 'Wardrobe Imported!' }),
        t('migration.screenshotsImportedSuccess', {
          count: savedCount,
          appName: selectedApp.name,
          defaultValue: 'Imported {{count}} garments from {{appName}}! AI analysis is running in the background.',
        })
      );
    } catch (err: any) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        err?.response?.data?.detail || t('common.errorOccurred', { defaultValue: 'An error occurred.' })
      );
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleStartWebViewScan = () => {
    if (webScanning) return;
    setWebScanning(true);
    setWebFoundCount(0);
    setWebSavedCount(0);
    webViewRef.current?.injectJavaScript(WEBVIEW_HARVESTER_SCRIPT);
  };

  const handleWebViewMessage = async (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data || '{}');
      if (data.type === 'DRESSAPP_WEBVIEW_BATCH' && Array.isArray(data.cards)) {
        setWebFoundCount(data.totalFound || data.cards.length);
        const res = await (api as any).saveMigrationCrops({
          app_name: selectedApp.name,
          cards: data.cards,
        });
        const newlySaved = res?.items_saved ?? 0;
        if (newlySaved > 0) {
          setWebSavedCount((prev) => prev + newlySaved);
        }
      } else if (data.type === 'DRESSAPP_WEBVIEW_DONE') {
        setWebScanning(false);
        await (api as any).updateMigrationFlag?.({ migration_flag: 'Migrated' }).catch(() => {});
        await closetStore.refresh({ force: true }).catch(() => {});
        Alert.alert(
          t('migration.importCompleteTitle', { defaultValue: 'Wardrobe Imported!' }),
          t('migration.webviewScanCompleteDesc', {
            count: data.totalFound || webSavedCount,
            appName: selectedApp.name,
            defaultValue: 'Finished scanning {{appName}} ({{count}} garments detected). Your closet is updating now!',
          })
        );
      }
    } catch {
      // ignore non-JSON messages from third-party scripts
    }
  };

  return (
    <View style={styles.container}>
      {!canAccessMigration && (
        <View style={[styles.upgradeBanner, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <Lucide.Sparkles size={20} color={colors.primary} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[styles.upgradeBannerTitle, { color: colors.foreground }]}>
              {t('common.upgradeToUse', { feature: t('common.features.migration') })}
            </Text>
            <Text style={[styles.upgradeBannerDesc, { color: colors.mutedFg }]}>
              {t('migration.upgradePrompt', { defaultValue: 'Wardrobe migration from other apps is available on Manager and Professional plans.' })}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.upgradeBannerBtn, { backgroundColor: colors.primary }]}
            onPress={() => navigation.navigate('Pricing')}
          >
            <Text style={[styles.upgradeBannerBtnText, { color: colors.primaryFg }]}>
              {t('common.upgrade', { defaultValue: 'Upgrade' })}
            </Text>
          </TouchableOpacity>
        </View>
      )}
      <View
        style={[
          styles.infoBox,
          {
            backgroundColor: isDark
              ? 'rgba(35, 139, 130, 0.15)'
              : 'rgba(31, 111, 107, 0.08)',
            borderColor: colors.accent,
          },
        ]}
      >
        <View style={styles.header}>
          <Lucide.Sparkles size={20} color={colors.accent} />
          <View style={styles.headerTextCol}>
            <Text style={[styles.title, { color: colors.foreground }]}>
              {t('profile.importWardrobeTitle', { defaultValue: 'Import Wardrobe From Other Apps' })}
            </Text>
            <Text style={[styles.sub, { color: colors.mutedFg }]}>
              {t('profile.importWardrobeDesc', { defaultValue: 'Migrate your existing catalog seamlessly from Whering, Acloset, Stylebook, and other digital wardrobe apps.' })}
            </Text>
          </View>
        </View>
      </View>

      <Text style={[styles.sectionSubtitle, { color: colors.foreground }]}>
        {t('profile.supportedPlatforms', { defaultValue: 'Supported Wardrobe Platforms' })}
      </Text>

      <View style={styles.appsGrid}>
        {PRESET_APPS.map((app) => (
          <TouchableOpacity
            key={app.name}
            style={[
              styles.appCard,
              {
                backgroundColor: colors.secondary,
                borderColor: colors.border,
              },
            ]}
            onPress={() => handleStartImport(app)}
            activeOpacity={0.8}
          >
            <Text style={styles.appIcon}>{app.icon}</Text>
            <View style={styles.appInfo}>
              <Text style={[styles.appName, { color: colors.foreground }]}>{app.name}</Text>
              <Text style={[styles.appItems, { color: colors.mutedFg }]}>{app.items}</Text>
            </View>
            <Lucide.ArrowRight
              size={14}
              color={colors.accent}
              style={isRTL ? { transform: [{ scaleX: -1 }] } : undefined}
            />
          </TouchableOpacity>
        ))}
      </View>

      {/* Full-Screen Native Mobile Migration Modal (#2 Screenshots/Video + #3 In-App WebView Scanner) */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => !uploadingMedia && setModalVisible(false)}
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          {/* Modal Header */}
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <View style={styles.modalHeaderTitleRow}>
              <Text style={styles.modalAppIcon}>{selectedApp.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                  {t('migration.connectToAppTitle', { appName: selectedApp.name, defaultValue: `Connect to ${selectedApp.name}` })}
                </Text>
                <Text style={[styles.modalSubtitle, { color: colors.mutedFg }]}>
                  {t('migration.screenshotPipelineTitle', { defaultValue: 'Wardrobe Migration Agent' })}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => !uploadingMedia && setModalVisible(false)}
                style={[styles.closeBtn, { backgroundColor: colors.secondary }]}
              >
                <Lucide.X size={18} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            {/* Mode Switcher Tabs */}
            <View style={[styles.tabBar, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <TouchableOpacity
                style={[
                  styles.tabButton,
                  activeTab === 'screenshots' && { backgroundColor: colors.background },
                ]}
                onPress={() => setActiveTab('screenshots')}
              >
                <Lucide.ImagePlus
                  size={15}
                  color={activeTab === 'screenshots' ? colors.primary : colors.mutedFg}
                />
                <Text
                  style={[
                    styles.tabButtonText,
                    { color: activeTab === 'screenshots' ? colors.primary : colors.mutedFg },
                  ]}
                  numberOfLines={1}
                >
                  {t('migration.modeScreenshotsTab', { defaultValue: 'Screenshots / Video' })}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.tabButton,
                  activeTab === 'webview' && { backgroundColor: colors.background },
                ]}
                onPress={() => setActiveTab('webview')}
              >
                <Lucide.Globe
                  size={15}
                  color={activeTab === 'webview' ? colors.primary : colors.mutedFg}
                />
                <Text
                  style={[
                    styles.tabButtonText,
                    { color: activeTab === 'webview' ? colors.primary : colors.mutedFg },
                  ]}
                  numberOfLines={1}
                >
                  {t('migration.modeWebViewScannerTab', { defaultValue: 'In-App Web Scanner' })}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {activeTab === 'screenshots' ? (
            <ScrollView contentContainerStyle={styles.screenshotsBody}>
              <View style={[styles.instructionCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                <Text style={[styles.instructionText, { color: colors.foreground }]}>
                  {t('migration.screenshotsInstructions', {
                    appName: selectedApp.name,
                    defaultValue: `Take screenshots of your ${selectedApp.name} closet grid (or record your screen while scrolling through your closet) and upload them below. DressApp will automatically slice and deduplicate every garment card.`,
                  })}
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.dropzone,
                  {
                    backgroundColor: colors.secondary,
                    borderColor: colors.primary,
                  },
                ]}
                onPress={handlePickScreenshotsOrVideo}
                disabled={uploadingMedia}
                activeOpacity={0.85}
              >
                <View style={styles.dropzoneIcons}>
                  <Lucide.ImagePlus size={26} color={colors.primary} />
                  <Lucide.Video size={26} color={colors.primary} />
                </View>
                <Text style={[styles.dropzoneTitle, { color: colors.primary }]}>
                  {t('migration.selectScreenshotsOrVideoBtn', { defaultValue: 'Select Screenshots or Screen Recording' })}
                </Text>
                <Text style={[styles.dropzoneHint, { color: colors.mutedFg }]}>
                  {t('migration.screenshotsSupportHint', { defaultValue: 'Works on iOS & Android with any wardrobe app (PNG, JPG, MP4, MOV)' })}
                </Text>
              </TouchableOpacity>

              {mediaAssets.length > 0 && (
                <View style={styles.previewSection}>
                  <View style={styles.previewHeader}>
                    <Text style={[styles.previewCountText, { color: colors.foreground }]}>
                      {t('migration.framesReadyBadge', {
                        count: mediaAssets.length,
                        defaultValue: `${mediaAssets.length} closet frames ready to slice`,
                      })}
                    </Text>
                    <TouchableOpacity onPress={() => setMediaAssets([])} disabled={uploadingMedia}>
                      <Text style={[styles.clearText, { color: colors.destructive || '#ef4444' }]}>
                        {t('common.clear', { defaultValue: 'Clear' })}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.previewStrip}>
                    {mediaAssets.map((item, idx) => (
                      <View key={`${item.uri}_${idx}`} style={[styles.previewThumbWrap, { borderColor: colors.border }]}>
                        <Image source={{ uri: item.uri }} style={styles.previewThumb} resizeMode="cover" />
                        {item.type === 'video' && (
                          <View style={styles.videoBadge}>
                            <Lucide.Video size={12} color="#fff" />
                          </View>
                        )}
                      </View>
                    ))}
                  </ScrollView>
                </View>
              )}

              <TouchableOpacity
                style={[
                  styles.primaryActionBtn,
                  {
                    backgroundColor: mediaAssets.length > 0 && !uploadingMedia ? colors.primary : colors.border,
                  },
                ]}
                disabled={mediaAssets.length === 0 || uploadingMedia}
                onPress={handleSliceAndImport}
              >
                {uploadingMedia ? (
                  <>
                    <ActivityIndicator size="small" color={colors.primaryFg} />
                    <Text style={[styles.primaryActionBtnText, { color: colors.primaryFg }]}>
                      {t('migration.slicingAndImporting', { defaultValue: 'Slicing & Importing...' })}
                    </Text>
                  </>
                ) : (
                  <>
                    <Lucide.Sparkles size={16} color={colors.primaryFg} />
                    <Text style={[styles.primaryActionBtnText, { color: colors.primaryFg }]}>
                      {t('migration.sliceAndImportBtn', { defaultValue: 'Slice & Import Closet' })}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          ) : (
            <View style={styles.webViewContainer}>
              <View style={[styles.webViewHintBanner, { backgroundColor: colors.secondary, borderBottomColor: colors.border }]}>
                <Text style={[styles.webViewHintText, { color: colors.mutedFg }]}>
                  {t('migration.webviewInstructions', {
                    appName: selectedApp.name,
                    defaultValue: `Log in to ${selectedApp.name} below and open your closet page, then tap "Scan & Import Closet".`,
                  })}
                </Text>
              </View>

              <WebView
                ref={webViewRef}
                source={{ uri: selectedApp.loginUrl }}
                style={{ flex: 1 }}
                onMessage={handleWebViewMessage}
                javaScriptEnabled
                domStorageEnabled
                sharedCookiesEnabled
                startInLoadingState
              />

              <View style={[styles.webViewFooter, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.webViewStatusTitle, { color: colors.foreground }]}>
                    {webScanning
                      ? t('migration.agentScanningCount', {
                          count: webFoundCount,
                          defaultValue: `Scanning... ${webFoundCount} cards found`,
                        })
                      : t('migration.garmentVisionReady', { defaultValue: 'Agentic Ingestion Ready' })}
                  </Text>
                  {webSavedCount > 0 && (
                    <Text style={[styles.webViewSavedSub, { color: colors.accent }]}>
                      {t('migration.agentSavedSuccess', {
                        count: webSavedCount,
                        defaultValue: `✓ ${webSavedCount} Items Saved to Closet!`,
                      })}
                    </Text>
                  )}
                </View>

                <TouchableOpacity
                  style={[
                    styles.scanNowBtn,
                    { backgroundColor: webScanning ? colors.border : colors.primary },
                  ]}
                  onPress={handleStartWebViewScan}
                  disabled={webScanning}
                >
                  {webScanning ? (
                    <ActivityIndicator size="small" color={colors.primaryFg} />
                  ) : (
                    <Lucide.Sparkles size={15} color={colors.primaryFg} />
                  )}
                  <Text style={[styles.scanNowBtnText, { color: colors.primaryFg }]}>
                    {webScanning
                      ? t('migration.scanningInProgressBtn', { defaultValue: 'Scanning...' })
                      : t('migration.scanAndImportClosetBtn', { defaultValue: 'Scan & Import Closet' })}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  infoBox: {
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1.5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  headerTextCol: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.sm,
  },
  sub: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    lineHeight: 16,
  },
  sectionSubtitle: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
    marginTop: 4,
  },
  appsGrid: {
    gap: spacing.xs,
  },
  appCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.sm,
  },
  appIcon: {
    fontSize: 20,
  },
  appInfo: {
    flex: 1,
    gap: 2,
  },
  appName: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
  },
  appItems: {
    fontFamily: fonts.body,
    fontSize: 10.5,
  },
  upgradeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  upgradeBannerTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
  },
  upgradeBannerDesc: {
    fontFamily: fonts.body,
    fontSize: 11,
    lineHeight: 14,
  },
  upgradeBannerBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.full,
  },
  upgradeBannerBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    gap: spacing.sm,
  },
  modalHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  modalAppIcon: {
    fontSize: 24,
  },
  modalTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.md,
  },
  modalSubtitle: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: 6,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: radii.sm,
    gap: 6,
  },
  tabButtonText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
  },
  screenshotsBody: {
    padding: spacing.md,
    gap: spacing.md,
  },
  instructionCard: {
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  instructionText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    lineHeight: 18,
  },
  dropzone: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  dropzoneIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dropzoneTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.sm,
    textAlign: 'center',
  },
  dropzoneHint: {
    fontFamily: fonts.body,
    fontSize: 11,
    textAlign: 'center',
  },
  previewSection: {
    gap: spacing.xs,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previewCountText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
  },
  clearText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
  },
  previewStrip: {
    gap: spacing.xs,
    paddingVertical: 4,
  },
  previewThumbWrap: {
    width: 68,
    height: 96,
    borderRadius: radii.sm,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  previewThumb: {
    width: '100%',
    height: '100%',
  },
  videoBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 10,
    padding: 4,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: radii.lg,
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  primaryActionBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.sm,
  },
  webViewContainer: {
    flex: 1,
  },
  webViewHintBanner: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  webViewHintText: {
    fontFamily: fonts.body,
    fontSize: 11.5,
    lineHeight: 16,
  },
  webViewFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    gap: spacing.sm,
  },
  webViewStatusTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
  },
  webViewSavedSub: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    marginTop: 2,
  },
  scanNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radii.full,
    gap: 6,
  },
  scanNowBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
  },
});
