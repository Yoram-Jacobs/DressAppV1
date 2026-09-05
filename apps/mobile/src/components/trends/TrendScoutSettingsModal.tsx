import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Lucide from 'lucide-react-native';

import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii } from '@mobile/theme/tokens';
import { api } from '@mobile/lib/api';

interface Platform {
  id: string;
  name: string;
  connected: boolean;
  active: boolean;
  username?: string;
}

interface ClosetProfile {
  lead_dress_code: string;
  lead_closet_style: string;
  effective_style: string;
  item_count: number;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onRefreshTriggered: () => Promise<void>;
  selectedGender: string;
  country: string;
}

const SUGGESTED_STYLES = [
  { id: 'vintage', label: 'Vintage' },
  { id: 'quiet_luxury', label: 'Quiet Luxury' },
  { id: 'minimalist', label: 'Minimalist' },
  { id: 'streetwear', label: 'Streetwear' },
  { id: 'old_money', label: 'Old Money' },
  { id: 'boho_casual', label: 'Boho & Casual' },
  { id: 'cyberpunk', label: 'Cyberpunk' },
  { id: 'y2k', label: 'Y2K' },
  { id: 'classic_business', label: 'Classic Business' },
  { id: 'athleisure', label: 'Athleisure' },
];

const PLATFORM_EMOJIS: Record<string, string> = {
  instagram: '📸',
  facebook: '📘',
  pinterest: '📌',
  tiktok: '🎵',
  x: '𝕏',
  threads: '🧵',
};

export const TrendScoutSettingsModal: React.FC<Props> = ({
  visible,
  onClose,
  onRefreshTriggered,
  selectedGender,
  country,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [customStyle, setCustomStyle] = useState('');
  const [socialPlatforms, setSocialPlatforms] = useState<Platform[]>([]);
  const [closetProfile, setClosetProfile] = useState<ClosetProfile | null>(null);
  const [connectingPlatform, setConnectingPlatform] = useState<Platform | null>(null);
  const [handleInput, setHandleInput] = useState('');

  useEffect(() => {
    if (!visible) return;
    loadSettings();
  }, [visible]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const res: any = await (api as any).getSettings?.();
      if (res && res.success) {
        setCustomStyle(res.settings?.custom_style || '');
        setSocialPlatforms(res.settings?.social_platforms || []);
        setClosetProfile(res.closet_profile || null);
      }
    } catch (err) {
      console.warn('Failed to load Trend Scout settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePlatform = (platformId: string) => {
    setSocialPlatforms((prev) =>
      prev.map((p) => (p.id === platformId ? { ...p, active: !p.active } : p))
    );
  };

  const handleOpenConnect = (platform: Platform) => {
    setConnectingPlatform(platform);
    setHandleInput(platform.username || '');
  };

  const handleSaveConnect = async () => {
    if (!connectingPlatform) return;
    try {
      await (api as any).connectSocial?.(connectingPlatform.id, handleInput.trim());
      setSocialPlatforms((prev) =>
        prev.map((p) =>
          p.id === connectingPlatform.id
            ? { ...p, connected: true, active: true, username: handleInput.trim() }
            : p
        )
      );
      setConnectingPlatform(null);
      setHandleInput('');
    } catch (err) {
      Alert.alert(t('common.error', { defaultValue: 'Error' }), t('trends.connectError', { defaultValue: 'Could not connect account' }));
    }
  };

  const handleDisconnect = async (platformId: string) => {
    try {
      await (api as any).disconnectSocial?.(platformId);
      setSocialPlatforms((prev) =>
        prev.map((p) =>
          p.id === platformId ? { ...p, connected: false, active: false, username: '' } : p
        )
      );
    } catch (err) {
      Alert.alert(t('common.error', { defaultValue: 'Error' }), t('trends.disconnectError', { defaultValue: 'Could not disconnect account' }));
    }
  };

  const handleSave = async (autoRefresh = false) => {
    if (saving || refreshing) return;
    setSaving(true);
    try {
      const payload = {
        custom_style: customStyle.trim() || null,
        social_platforms: socialPlatforms,
      };
      const res: any = await (api as any).updateSettings?.(payload);
      if (res && res.success) {
        setClosetProfile(res.closet_profile || null);
      }

      if (autoRefresh) {
        setRefreshing(true);
        try {
          await api.trendsRunNowDev(true, selectedGender, country);
          await onRefreshTriggered();
          onClose();
        } catch (err) {
          Alert.alert(t('common.error', { defaultValue: 'Error' }), t('trends.refreshFailed', { defaultValue: 'Scout refresh failed' }));
        } finally {
          setRefreshing(false);
        }
      } else {
        onClose();
      }
    } catch (err) {
      Alert.alert(t('common.error', { defaultValue: 'Error' }), t('trends.saveFailed', { defaultValue: 'Could not save settings' }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={styles.headerTitleRow}>
              <Lucide.Sparkles size={20} color={colors.primary} />
              <Text style={[styles.headerTitle, { color: colors.foreground }]}>
                {t('trends.settingsTitle', { defaultValue: 'Trend Scout Settings' })}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Lucide.X size={20} color={colors.mutedFg} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.mutedFg }]}>
                {t('trends.loadingSettings', { defaultValue: 'Analyzing closet profile...' })}
              </Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
              {/* Wardrobe Intelligence Card */}
              <View style={[styles.infoCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                <View style={styles.infoCardHeader}>
                  <View style={styles.inlineRow}>
                    <Lucide.Shirt size={16} color={colors.primary} />
                    <Text style={[styles.infoCardTitle, { color: colors.foreground }]}>
                      {t('trends.closetIntelligence', { defaultValue: 'Wardrobe Analysis' })}
                    </Text>
                  </View>
                  <Text style={[styles.itemCountText, { color: colors.mutedFg }]}>
                    {closetProfile?.item_count || 0} {t('trends.itemsAnalyzed', { defaultValue: 'items' })}
                  </Text>
                </View>

                <View style={styles.badgeRow}>
                  <View style={[styles.badgePill, { backgroundColor: 'rgba(99, 102, 241, 0.12)', borderColor: 'rgba(99, 102, 241, 0.3)' }]}>
                    <Text style={[styles.badgeText, { color: '#6366f1' }]}>
                      👔 {t('trends.leadDressCode', { defaultValue: 'Dress Code' })}: {closetProfile?.lead_dress_code || 'Casual'}
                    </Text>
                  </View>
                  <View style={[styles.badgePill, { backgroundColor: 'rgba(168, 85, 247, 0.12)', borderColor: 'rgba(168, 85, 247, 0.3)' }]}>
                    <Text style={[styles.badgeText, { color: '#a855f7' }]}>
                      ✨ {t('trends.leadClosetStyle', { defaultValue: 'Closet Style' })}: {closetProfile?.lead_closet_style || 'Classic'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Custom Style Input Section */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={styles.inlineRow}>
                    <Lucide.Layers size={16} color={colors.primary} />
                    <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                      {t('trends.customStyleField', { defaultValue: 'Style Preference' })}
                    </Text>
                  </View>
                  {customStyle ? (
                    <TouchableOpacity onPress={() => setCustomStyle('')}>
                      <Text style={[styles.resetText, { color: colors.primary }]}>
                        {t('common.clear', { defaultValue: 'Reset' })}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                  value={customStyle}
                  onChangeText={setCustomStyle}
                  placeholder={t('trends.stylePlaceholder', { defaultValue: 'e.g., Vintage, Quiet Luxury...' })}
                  placeholderTextColor={colors.mutedFg}
                />
                <Text style={[styles.hintText, { color: colors.mutedFg }]}>
                  {t('trends.styleFieldHint', { defaultValue: 'Enter any aesthetic to customize web crawler priorities.' })}
                </Text>

                {/* Preset Chips */}
                <View style={styles.chipsRow}>
                  {SUGGESTED_STYLES.map((st) => {
                    const localizedLabel = t(`trends.styles.${st.id}`, { defaultValue: st.label });
                    const isSelected = customStyle.toLowerCase() === st.label.toLowerCase() || customStyle.toLowerCase() === localizedLabel.toLowerCase();
                    return (
                      <TouchableOpacity
                        key={st.id}
                        onPress={() => setCustomStyle(localizedLabel)}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: isSelected ? colors.primary : colors.card,
                            borderColor: isSelected ? colors.primary : colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            { color: isSelected ? colors.primaryFg : colors.foreground },
                          ]}
                        >
                          {localizedLabel}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Social Media Section */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={styles.inlineRow}>
                    <Lucide.Share2 size={16} color={colors.primary} />
                    <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                      {t('trends.socialAccounts', { defaultValue: 'Social Media Feeds' })}
                    </Text>
                  </View>
                  <Text style={[styles.activeCounter, { color: colors.mutedFg }]}>
                    {socialPlatforms.filter((p) => p.active).length}/{socialPlatforms.length} {t('trends.active', { defaultValue: 'active' })}
                  </Text>
                </View>
                <Text style={[styles.hintText, { color: colors.mutedFg, marginBottom: spacing.sm }]}>
                  {t('trends.socialDesc', { defaultValue: 'Prioritize creators, viral trends, and aesthetics from your feeds.' })}
                </Text>

                <View style={styles.platformsList}>
                  {socialPlatforms.map((platform) => {
                    const emoji = PLATFORM_EMOJIS[platform.id] || '🌐';
                    return (
                      <View
                        key={platform.id}
                        style={[
                          styles.platformCard,
                          {
                            backgroundColor: platform.active ? 'rgba(99, 102, 241, 0.06)' : colors.card,
                            borderColor: platform.active ? 'rgba(99, 102, 241, 0.3)' : colors.border,
                          },
                        ]}
                      >
                        <View style={styles.platformLeft}>
                          <Text style={styles.platformEmoji}>{emoji}</Text>
                          <View>
                            <View style={styles.inlineRow}>
                              <Text style={[styles.platformName, { color: colors.foreground }]}>{platform.name}</Text>
                              {platform.connected && platform.username ? (
                                <Text style={[styles.platformHandle, { color: colors.mutedFg }]}>
                                  @{platform.username}
                                </Text>
                              ) : null}
                            </View>
                            <Text style={[styles.platformStatus, { color: platform.active ? colors.primary : colors.mutedFg }]}>
                              {platform.active
                                ? t('trends.platformActive', { defaultValue: 'Active' })
                                : t('trends.platformInactive', { defaultValue: 'Muted' })}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.platformRight}>
                          {platform.connected ? (
                            <View style={styles.connectedActions}>
                              <TouchableOpacity
                                style={[
                                  styles.toggleBtn,
                                  { backgroundColor: platform.active ? colors.primary : colors.secondary },
                                ]}
                                onPress={() => handleTogglePlatform(platform.id)}
                              >
                                <Text
                                  style={[
                                    styles.toggleBtnText,
                                    { color: platform.active ? colors.primaryFg : colors.foreground },
                                  ]}
                                >
                                  {platform.active ? '✓' : t('trends.enable', { defaultValue: 'On' })}
                                </Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.disconnectBtn}
                                onPress={() => handleDisconnect(platform.id)}
                              >
                                <Lucide.Unlink size={16} color={colors.mutedFg} />
                              </TouchableOpacity>
                            </View>
                          ) : (
                            <TouchableOpacity
                              style={[styles.connectBtn, { borderColor: colors.border }]}
                              onPress={() => handleOpenConnect(platform)}
                            >
                              <Lucide.Link2 size={13} color={colors.primary} />
                              <Text style={[styles.connectBtnText, { color: colors.primary }]}>
                                {t('trends.connectAccount', { defaultValue: 'Connect' })}
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>

                {/* Inline Connect Box */}
                {connectingPlatform ? (
                  <View style={[styles.connectBox, { backgroundColor: colors.secondary, borderColor: colors.primary }]}>
                    <Text style={[styles.connectBoxTitle, { color: colors.foreground }]}>
                      {t('trends.connectModalTitle', { defaultValue: 'Connect' })} {connectingPlatform.name}
                    </Text>
                    <View style={styles.connectBoxRow}>
                      <TextInput
                        style={[styles.handleInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                        value={handleInput}
                        onChangeText={setHandleInput}
                        placeholder={t('trends.handlePlaceholder', { defaultValue: '@username' })}
                        placeholderTextColor={colors.mutedFg}
                        autoCapitalize="none"
                      />
                      <TouchableOpacity style={[styles.saveHandleBtn, { backgroundColor: colors.primary }]} onPress={handleSaveConnect}>
                        <Text style={[styles.saveHandleBtnText, { color: colors.primaryFg }]}>
                          {t('common.save', { defaultValue: 'Save' })}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : null}
              </View>

              {/* Actions */}
              <View style={[styles.actionsRow, { borderTopColor: colors.border }]}>
                <TouchableOpacity
                  style={[styles.secondaryBtn, { borderColor: colors.border }]}
                  onPress={() => handleSave(false)}
                  disabled={saving || refreshing}
                >
                  <Text style={[styles.secondaryBtnText, { color: colors.foreground }]}>
                    {t('common.saveChanges', { defaultValue: 'Save' })}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
                  onPress={() => handleSave(true)}
                  disabled={saving || refreshing}
                >
                  {refreshing ? (
                    <ActivityIndicator size="small" color={colors.primaryFg} />
                  ) : (
                    <Lucide.RotateCw size={14} color={colors.primaryFg} />
                  )}
                  <Text style={[styles.primaryBtnText, { color: colors.primaryFg }]}>
                    {t('trends.saveAndRefreshInstant', { defaultValue: 'Save & Refresh' })}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    maxHeight: '85%',
    borderWidth: 1,
    borderBottomWidth: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-y-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  headerTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerTitle: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.lg,
  },
  loadingContainer: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
  },
  body: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  infoCard: {
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.sm,
  },
  infoCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  infoCardTitle: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.sm,
  },
  itemCountText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  badgePill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  badgeText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.xs,
  },
  section: {
    gap: spacing.xs,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.sm,
  },
  resetText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.xs,
  },
  activeCounter: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
  },
  input: {
    height: 42,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    marginTop: spacing.xs,
  },
  hintText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    marginTop: 2,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  chipText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.xs,
  },
  platformsList: {
    gap: spacing.xs,
  },
  platformCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  platformLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  platformEmoji: {
    fontSize: 22,
  },
  platformName: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.sm,
  },
  platformHandle: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    marginLeft: 4,
  },
  platformStatus: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
  },
  platformRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  connectedActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  toggleBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.md,
  },
  toggleBtnText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.xs,
  },
  disconnectBtn: {
    padding: spacing.xs,
  },
  connectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radii.md,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  connectBtnText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.xs,
  },
  connectBox: {
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  connectBoxTitle: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.xs,
  },
  connectBoxRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  handleInput: {
    flex: 1,
    height: 36,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    fontSize: fontSizes.xs,
    fontFamily: fonts.regular,
  },
  saveHandleBtn: {
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
  },
  saveHandleBtnText: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.xs,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
  },
  secondaryBtn: {
    flex: 1,
    height: 44,
    borderRadius: radii.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
  },
  primaryBtn: {
    flex: 1,
    height: 44,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  primaryBtnText: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.sm,
  },
});
