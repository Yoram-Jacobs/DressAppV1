/**
 * apps/mobile/src/components/profile/ImportWardrobeSection.tsx
 *
 * Import Wardrobe accordion section for DressApp mobile.
 * Features:
 *   - Preset app migration cards (Whering, Acloset, Stylebook, Smartli)
 *   - Guidance and import assistant message
 *   - Framed borders and themed styling
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Lucide from 'lucide-react-native';

import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii } from '@mobile/theme/tokens';

const PRESET_APPS = [
  { name: 'Whering', icon: '👗', items: '95+ items' },
  { name: 'Acloset', icon: '📱', items: '48+ items' },
  { name: 'Stylebook', icon: '🎨', items: '65+ items' },
  { name: 'Smartli', icon: '⚡', items: '32+ items' },
];

export function ImportWardrobeSection() {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();

  const handleStartImport = (appName: string) => {
    Alert.alert(
      t('profile.importFromApp', { defaultValue: 'Import from {{app}}', app: appName }),
      t('profile.importFromAppDesc', {
        defaultValue: 'To import your entire {{app}} closet, open DressApp Web or use the Bulk Photo Importer in your Closet tab to import your collection automatically.',
        app: appName,
      })
    );
  };

  return (
    <View style={styles.container}>
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
            onPress={() => handleStartImport(app.name)}
            activeOpacity={0.8}
          >
            <Text style={styles.appIcon}>{app.icon}</Text>
            <View style={styles.appInfo}>
              <Text style={[styles.appName, { color: colors.foreground }]}>{app.name}</Text>
              <Text style={[styles.appItems, { color: colors.mutedFg }]}>{app.items}</Text>
            </View>
            <Lucide.ArrowRight size={14} color={colors.accent} />
          </TouchableOpacity>
        ))}
      </View>
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
});
