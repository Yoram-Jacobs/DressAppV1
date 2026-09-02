/**
 * apps/mobile/src/components/LanguagePicker.tsx
 *
 * Floating language switcher bulb with modal selector for all 13 supported languages.
 * Automatically triggers RTL flipping and updates user profile and AsyncStorage.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  I18nManager,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Lucide from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii } from '@mobile/theme/tokens';
import { SUPPORTED_LANGUAGES } from '@mobile/lib/i18n';
import { applyRtl } from '@mobile/lib/rtl';
import { api } from '@mobile/lib/api';

interface LanguagePickerProps {
  style?: any;
  testIdSuffix?: string;
}

export function LanguagePicker({ style, testIdSuffix }: LanguagePickerProps) {
  const { i18n, t } = useTranslation();
  const { colors } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);

  const currentLang = (i18n.language || 'en').split('-')[0];

  const handleSelectLanguage = async (code: string) => {
    setModalVisible(false);
    if (code === currentLang) return;

    try {
      await i18n.changeLanguage(code);
      await AsyncStorage.setItem('dressapp.lang', code);
      await applyRtl(code);
      api.patchMe({ preferred_language: code }).catch(() => {});
    } catch (e) {
      console.warn('Language switch error:', e);
    }
  };

  return (
    <>
      <TouchableOpacity
        style={[
          styles.bulbBtn,
          { backgroundColor: colors.card, borderColor: colors.border },
          style,
        ]}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.8}
        testID={`language-picker-trigger${testIdSuffix ? '-' + testIdSuffix : ''}`}
        accessibilityRole="button"
        accessibilityLabel={t('language.change', { defaultValue: 'Change language' })}
      >
        <Lucide.Globe size={18} color={colors.accent} />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View
            style={[
              styles.modalCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                {t('language.label', { defaultValue: 'Select Language' })}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Lucide.X size={20} color={colors.mutedFg} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.langList} showsVerticalScrollIndicator={false}>
              {SUPPORTED_LANGUAGES.map((lang) => {
                const isSelected = lang.code === currentLang;
                return (
                  <TouchableOpacity
                    key={lang.code}
                    style={[
                      styles.langRow,
                      {
                        backgroundColor: isSelected ? colors.secondary : 'transparent',
                        borderColor: colors.border,
                      },
                    ]}
                    onPress={() => handleSelectLanguage(lang.code)}
                  >
                    <Text
                      style={[
                        styles.langName,
                        { color: isSelected ? colors.accent : colors.foreground },
                      ]}
                    >
                      {lang.nativeName}
                    </Text>
                    {isSelected ? (
                      <Lucide.Check size={18} color={colors.accent} />
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bulbBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[4],
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    maxHeight: '70%',
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: spacing[4],
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[3],
    paddingBottom: spacing[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
  },
  modalTitle: {
    fontFamily: fonts.displayBold,
    fontSize: fontSizes.lg,
  },
  langList: {
    maxHeight: 380,
  },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
    borderRadius: radii.md,
    marginBottom: 4,
  },
  langName: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.base,
  },
});
