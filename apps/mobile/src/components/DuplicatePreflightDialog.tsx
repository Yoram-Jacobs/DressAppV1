/**
 * apps/mobile/src/components/DuplicatePreflightDialog.tsx
 *
 * Pre-flight duplicate confirmation modal for photos before AI segmentation.
 * Parity with apps/web/src/components/DuplicatePreflightDialog.jsx.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Lucide from 'lucide-react-native';

import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii } from '@mobile/theme/tokens';
import { labelForItemType, labelForColor } from '@mobile/lib/taxonomy';

export interface DuplicateMatch {
  matchKey: string;
  filename?: string;
  size_bytes?: number;
  previewUrl?: string;
  existing?: {
    id: string;
    title?: string;
    item_type?: string;
    color?: string;
    thumbnail_data_url?: string;
  };
}

interface DuplicatePreflightDialogProps {
  open: boolean;
  matches: DuplicateMatch[];
  onResolve: (decisions: Record<string, 'skip' | 'add'>) => void;
}

export function DuplicatePreflightDialog({
  open,
  matches,
  onResolve,
}: DuplicatePreflightDialogProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [decisions, setDecisions] = useState<Record<string, 'skip' | 'add'>>({});

  useEffect(() => {
    if (!open) return;
    const init: Record<string, 'skip' | 'add'> = {};
    (matches || []).forEach((m) => {
      init[m.matchKey] = 'skip';
    });
    setDecisions(init);
  }, [open, matches]);

  const handleRow = (key: string, choice: 'skip' | 'add') => {
    setDecisions((prev) => ({ ...prev, [key]: choice }));
  };

  const skipAll = () => {
    const all: Record<string, 'skip' | 'add'> = {};
    (matches || []).forEach((m) => (all[m.matchKey] = 'skip'));
    onResolve(all);
  };

  const addAll = () => {
    const all: Record<string, 'skip' | 'add'> = {};
    (matches || []).forEach((m) => (all[m.matchKey] = 'add'));
    onResolve(all);
  };

  const total = (matches || []).length;
  const willAdd = Object.values(decisions).filter((v) => v === 'add').length;

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={skipAll}>
      <View style={styles.overlay}>
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Lucide.AlertTriangle size={22} color="#f59e0b" />
            <View style={styles.headerTextCol}>
              <Text style={[styles.title, { color: colors.foreground }]}>
                {t('addItem.preflight.title', {
                  count: total,
                  defaultValue: `${total} photo(s) look like duplicates`,
                })}
              </Text>
              <Text style={[styles.desc, { color: colors.mutedFg }]}>
                {t('addItem.preflight.body', {
                  defaultValue:
                    'These photos look very similar to items already in your closet. Skip them or choose Add anyway.',
                })}
              </Text>
            </View>
          </View>

          {/* List of matches */}
          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {(matches || []).map((m) => {
              const decision = decisions[m.matchKey] || 'skip';
              return (
                <View
                  key={m.matchKey}
                  style={[
                    styles.matchRow,
                    { backgroundColor: colors.secondary, borderColor: colors.border },
                  ]}
                >
                  {/* Existing thumbnail */}
                  <View style={styles.thumbBox}>
                    {m.existing?.thumbnail_data_url ? (
                      <Image
                        source={{ uri: m.existing.thumbnail_data_url }}
                        style={styles.thumb}
                      />
                    ) : (
                      <View style={[styles.thumb, styles.thumbPlaceholder]}>
                        <Text style={styles.thumbPlaceholderText}>
                          {t('addItem.preflight.noThumb', { defaultValue: 'No preview' })}
                        </Text>
                      </View>
                    )}
                    <Text style={[styles.thumbLabel, { color: colors.mutedFg }]}>
                      {t('addItem.preflight.existing', { defaultValue: 'In closet' })}
                    </Text>
                  </View>

                  {/* Incoming thumbnail */}
                  <View style={styles.thumbBox}>
                    {m.previewUrl ? (
                      <Image source={{ uri: m.previewUrl }} style={styles.thumb} />
                    ) : (
                      <View style={[styles.thumb, styles.thumbPlaceholder]}>
                        <Text style={styles.thumbPlaceholderText}>
                          {t('addItem.preflight.incoming', { defaultValue: 'New photo' })}
                        </Text>
                      </View>
                    )}
                    <Text style={[styles.thumbLabel, { color: colors.mutedFg }]}>
                      {t('addItem.preflight.incoming', { defaultValue: 'New upload' })}
                    </Text>
                  </View>

                  {/* Row Controls */}
                  <View style={styles.rowControls}>
                    <Text
                      style={[styles.itemName, { color: colors.foreground }]}
                      numberOfLines={1}
                    >
                      {m.existing?.title || t('addItem.preflight.untitled', { defaultValue: 'Item' })}
                    </Text>

                    <View style={styles.actionBtns}>
                      <TouchableOpacity
                        style={[
                          styles.choiceBtn,
                          decision === 'skip'
                            ? { backgroundColor: colors.primary }
                            : { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
                        ]}
                        onPress={() => handleRow(m.matchKey, 'skip')}
                      >
                        <Text
                          style={[
                            styles.choiceBtnText,
                            { color: decision === 'skip' ? colors.primaryFg : colors.foreground },
                          ]}
                        >
                          {t('addItem.preflight.rowSkip', { defaultValue: 'Skip' })}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.choiceBtn,
                          decision === 'add'
                            ? { backgroundColor: '#ef4444' }
                            : { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
                        ]}
                        onPress={() => handleRow(m.matchKey, 'add')}
                      >
                        <Text
                          style={[
                            styles.choiceBtnText,
                            { color: decision === 'add' ? '#fff' : '#ef4444' },
                          ]}
                        >
                          {t('addItem.preflight.rowAdd', { defaultValue: 'Add anyway' })}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.footer}>
            <View style={styles.bulkRow}>
              <TouchableOpacity
                onPress={skipAll}
                style={[styles.bulkBtn, { backgroundColor: colors.secondary }]}
              >
                <Text style={[styles.bulkBtnText, { color: colors.foreground }]}>
                  {t('addItem.preflight.skipAll', { defaultValue: 'Skip all' })}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={addAll}
                style={[styles.bulkBtn, { backgroundColor: colors.secondary }]}
              >
                <Text style={[styles.bulkBtnText, { color: '#ef4444' }]}>
                  {t('addItem.preflight.addAll', { defaultValue: 'Add all anyway' })}
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={() => onResolve(decisions)}
              style={[styles.confirmBtn, { backgroundColor: colors.accent }]}
            >
              <Text style={styles.confirmBtnText}>
                {t('addItem.preflight.confirm', { defaultValue: 'Continue' })}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[4],
  },
  card: {
    width: '100%',
    maxHeight: '85%',
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: spacing[4],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    marginBottom: spacing[3],
  },
  headerTextCol: {
    flex: 1,
  },
  title: {
    fontFamily: fonts.displayBold,
    fontSize: fontSizes.lg,
  },
  desc: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    lineHeight: fontSizes.xs * 1.4,
    marginTop: 2,
  },
  scroll: {
    maxHeight: 340,
    marginVertical: spacing[2],
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[3],
    borderRadius: radii.lg,
    borderWidth: 1,
    marginBottom: spacing[2],
    gap: spacing[2],
  },
  thumbBox: {
    alignItems: 'center',
  },
  thumb: {
    width: 54,
    height: 54,
    borderRadius: radii.md,
    backgroundColor: '#000',
  },
  thumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbPlaceholderText: {
    fontSize: 9,
    color: '#888',
    textAlign: 'center',
  },
  thumbLabel: {
    fontFamily: fonts.body,
    fontSize: 9,
    marginTop: 2,
  },
  rowControls: {
    flex: 1,
    marginLeft: spacing[2],
    justifyContent: 'space-between',
  },
  itemName: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.xs,
    marginBottom: spacing[2],
  },
  actionBtns: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  choiceBtn: {
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[1],
    borderRadius: radii.md,
  },
  choiceBtnText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.xs,
  },
  footer: {
    marginTop: spacing[3],
    gap: spacing[2],
  },
  bulkRow: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  bulkBtn: {
    flex: 1,
    paddingVertical: spacing[2],
    alignItems: 'center',
    borderRadius: radii.md,
  },
  bulkBtnText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.xs,
  },
  confirmBtn: {
    width: '100%',
    paddingVertical: spacing[3],
    alignItems: 'center',
    borderRadius: radii.lg,
  },
  confirmBtnText: {
    color: '#fff',
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.sm,
  },
});
