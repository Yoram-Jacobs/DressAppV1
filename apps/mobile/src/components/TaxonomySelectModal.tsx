/**
 * apps/mobile/src/components/TaxonomySelectModal.tsx
 *
 * Bottom-sheet / modal picker for taxonomy fields.
 */

import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  I18nManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as Lucide from 'lucide-react-native';
import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii } from '@mobile/theme/tokens';

export interface Option {
  label: string;
  value?: string;
  id?: string;
}

export interface TaxonomySelectModalProps {
  visible: boolean;
  title: string;
  options: Option[];
  selectedValue?: string;
  selectedId?: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}

export function TaxonomySelectModal({
  visible,
  title,
  options,
  selectedValue,
  selectedId,
  onSelect,
  onClose,
}: TaxonomySelectModalProps) {
  const currentVal = selectedValue ?? selectedId;
  const { t } = useTranslation();
  const { colors } = useTheme();
  const isRtl = I18nManager.isRTL;
  const s = makeStyles(colors);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose} />
        <SafeAreaView style={s.sheetContainer} edges={['bottom']}>
          <View style={s.sheet}>
            <View style={[s.header, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
              <Text style={s.title}>{title}</Text>
              <TouchableOpacity onPress={onClose} style={s.closeBtn}>
                <Lucide.X size={20} color={colors.mutedFg} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>
              {options.map((opt) => {
                const optVal = opt.value ?? opt.id ?? '';
                const isSelected = currentVal === optVal;
                return (
                  <TouchableOpacity
                    key={optVal}
                    style={[
                      s.optionRow,
                      isSelected && s.selectedOptionRow,
                      { flexDirection: isRtl ? 'row-reverse' : 'row' },
                    ]}
                    onPress={() => {
                      onSelect(optVal);
                      onClose();
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.optionText, isSelected && s.selectedOptionText]}>
                      {opt.label}
                    </Text>
                    {isSelected && (
                      <View style={s.checkBadge}>
                        <Lucide.Check size={14} color="#FFF" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const makeStyles = (c: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    backdrop: {
      flex: 1,
    },
    sheetContainer: {
      backgroundColor: c.card,
      borderTopLeftRadius: radii['2xl'],
      borderTopRightRadius: radii['2xl'],
      maxHeight: '70%',
    },
    sheet: {
      padding: spacing[5],
      gap: spacing[3],
    },
    header: {
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingBottom: spacing[3],
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    title: {
      fontFamily: fonts.displayBold,
      fontSize: fontSizes.lg,
      color: c.foreground,
    },
    closeBtn: {
      padding: spacing[1],
    },
    list: {
      paddingVertical: spacing[2],
      gap: spacing[2],
    },
    optionRow: {
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing[3],
      paddingHorizontal: spacing[4],
      borderRadius: radii.xl,
      borderWidth: 1.5,
      borderColor: 'transparent',
      backgroundColor: c.secondary + '60',
    },
    selectedOptionRow: {
      backgroundColor: c.secondary,
      borderColor: c.accent,
    },
    optionText: {
      fontFamily: fonts.bodyMedium,
      fontSize: fontSizes.sm,
      color: c.foreground,
      flex: 1,
    },
    selectedOptionText: {
      fontFamily: fonts.bodyBold,
      color: c.foreground,
    },
    checkBadge: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 8,
    },
  });

