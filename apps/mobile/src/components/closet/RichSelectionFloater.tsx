/**
 * apps/mobile/src/components/closet/RichSelectionFloater.tsx
 *
 * Floating multi-action capsule for Closet Studio batch operations.
 * Matches DressApp-web Rich Selection Floater:
 *   - Selected count badge (✔ N)
 *   - Select All / Clear toggle (CheckSquare / Square)
 *   - Complete Outfit AI magic wand (Wand2 / Sparkles)
 *   - Group selected items into sets (ListChecks)
 *   - Batch Tag items (Tag)
 *   - Batch Delete items (Trash2)
 *   - Dismiss / Exit select mode (X)
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  I18nManager,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Lucide from 'lucide-react-native';

import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii, shadows } from '@mobile/theme/tokens';

export interface RichSelectionFloaterProps {
  selectedCount: number;
  totalVisibleCount: number;
  isAllSelected: boolean;
  onToggleSelectAll: () => void;
  onCompleteOutfit: () => void;
  onGroupSelected: () => void;
  onTagSelected: () => void;
  onDeleteSelected: () => void;
  onClose: () => void;
  deleting?: boolean;
}

export function RichSelectionFloater({
  selectedCount,
  totalVisibleCount,
  isAllSelected,
  onToggleSelectAll,
  onCompleteOutfit,
  onGroupSelected,
  onTagSelected,
  onDeleteSelected,
  onClose,
  deleting = false,
}: RichSelectionFloaterProps) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const isRtl = I18nManager.isRTL;

  const hasSelection = selectedCount > 0;
  const canGroup = selectedCount >= 2;

  return (
    <View
      style={[
        styles.floaterContainer,
        isRtl ? styles.floaterLeft : styles.floaterRight,
        {
          backgroundColor: isDark ? 'rgba(24, 24, 27, 0.94)' : 'rgba(255, 255, 255, 0.94)',
          borderColor: colors.border,
        },
      ]}
    >
      {/* 1. Counter Badge */}
      <TouchableOpacity
        style={styles.countBadge}
        onPress={onToggleSelectAll}
        activeOpacity={0.7}
        accessibilityLabel={t('closet.selectedCount', { count: selectedCount, defaultValue: '{{count}} selected' })}
      >
        <Lucide.CheckCircle2 size={16} color={colors.accent} />
        <Text style={[styles.countText, { color: colors.foreground }]}>
          {selectedCount}
        </Text>
      </TouchableOpacity>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      {/* 2. Select All / Clear */}
      <TouchableOpacity
        style={styles.actionBtn}
        onPress={onToggleSelectAll}
        activeOpacity={0.7}
        accessibilityLabel={isAllSelected ? t('common.clear', { defaultValue: 'Clear' }) : t('common.selectAll', { defaultValue: 'Select All' })}
      >
        {isAllSelected ? (
          <Lucide.Square size={18} color={colors.foreground} />
        ) : (
          <Lucide.CheckSquare size={18} color={colors.foreground} />
        )}
      </TouchableOpacity>

      {/* 3. Magic Wand (Outfit Completion) */}
      <TouchableOpacity
        style={[styles.actionBtn, !hasSelection && styles.disabledBtn]}
        onPress={onCompleteOutfit}
        disabled={!hasSelection}
        activeOpacity={0.7}
        accessibilityLabel={t('outfitCompletion.cta', { defaultValue: 'Complete Look' })}
      >
        <View style={hasSelection ? [styles.iconCircle, { backgroundColor: 'rgba(31, 111, 107, 0.12)' }] : null}>
          <Lucide.Sparkles
            size={18}
            color={hasSelection ? colors.accent : colors.mutedFg}
          />
        </View>
      </TouchableOpacity>

      {/* 4. Group Selected Items (Coordinated Set) */}
      <TouchableOpacity
        style={[styles.actionBtn, !canGroup && styles.disabledBtn]}
        onPress={onGroupSelected}
        disabled={!canGroup}
        activeOpacity={0.7}
        accessibilityLabel={t('closet.groupSelected', { defaultValue: 'Group' })}
      >
        <View style={canGroup ? [styles.iconCircle, { backgroundColor: isDark ? '#27272a' : '#f4f4f5' }] : null}>
          <Lucide.ListChecks
            size={18}
            color={canGroup ? colors.foreground : colors.mutedFg}
          />
        </View>
      </TouchableOpacity>

      {/* 5. Batch Tag Items */}
      <TouchableOpacity
        style={[styles.actionBtn, !hasSelection && styles.disabledBtn]}
        onPress={onTagSelected}
        disabled={!hasSelection}
        activeOpacity={0.7}
        accessibilityLabel={t('closet.tagSelected', { defaultValue: 'Tag' })}
      >
        <View style={hasSelection ? [styles.iconCircle, { backgroundColor: isDark ? '#27272a' : '#f4f4f5' }] : null}>
          <Lucide.Tag
            size={17}
            color={hasSelection ? colors.foreground : colors.mutedFg}
          />
        </View>
      </TouchableOpacity>

      {/* 6. Batch Delete Items */}
      <TouchableOpacity
        style={[
          styles.actionBtn,
          styles.deleteBtn,
          !hasSelection && styles.disabledDeleteBtn,
        ]}
        onPress={onDeleteSelected}
        disabled={!hasSelection || deleting}
        activeOpacity={0.8}
        accessibilityLabel={t('common.delete', { defaultValue: 'Delete' })}
      >
        {deleting ? (
          <ActivityIndicator size="small" color="#FFF" />
        ) : (
          <Lucide.Trash2 size={17} color="#FFF" />
        )}
      </TouchableOpacity>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      {/* 7. Close / Exit Select Mode */}
      <TouchableOpacity
        style={styles.closeBtn}
        onPress={onClose}
        activeOpacity={0.7}
        accessibilityLabel={t('common.cancel', { defaultValue: 'Cancel' })}
      >
        <Lucide.X size={18} color={colors.mutedFg} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  floaterContainer: {
    position: 'absolute',
    top: 148,
    zIndex: 100,
    width: 52,
    borderRadius: 26,
    borderWidth: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    ...shadows.lg,
    elevation: 8,
  },
  floaterRight: {
    right: 14,
  },
  floaterLeft: {
    left: 14,
  },
  countBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 3,
  },
  countText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
  },
  divider: {
    width: 28,
    height: 1,
  },
  actionBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 19,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledBtn: {
    opacity: 0.35,
  },
  deleteBtn: {
    backgroundColor: '#ef4444',
  },
  disabledDeleteBtn: {
    backgroundColor: '#fca5a5',
    opacity: 0.5,
  },
  closeBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
  },
});
