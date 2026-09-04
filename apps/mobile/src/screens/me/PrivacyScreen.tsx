import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, I18nManager, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@mobile/theme';
import { spacing } from '@mobile/theme/tokens';
import { api } from '../../lib/api';
import { useNavigation } from '@react-navigation/native';
import * as Lucide from "lucide-react-native";

export function PrivacyScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation();
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const lang = i18n.language || 'en';
        const res = await (api as any).getPrivacyPolicy?.(lang);
        if (res?.text || res?.content) {
          setContent(res.text || res.content);
        } else {
          setContent(null);
        }
      } catch (err) {
        setContent(null); // Fallback to static
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [i18n.language]);

  const BackIcon = I18nManager.isRTL ? Lucide.ArrowRight : Lucide.ArrowLeft;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={['bottom']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <BackIcon size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          {t('privacy.title', { defaultValue: 'Privacy Policy' })}
        </Text>
      </View>
      
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={[styles.lastUpdated, { color: colors.foreground }]}>
            {t('privacy.lastUpdated', { defaultValue: 'Last updated: August 2026' })}
          </Text>

          {content ? (
            <Text style={[styles.body, { color: colors.foreground }]}>{content}</Text>
          ) : (
            <>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                {t('privacy.section1', { defaultValue: '1. Data Collection' })}
              </Text>
              <Text style={[styles.body, { color: colors.foreground }]}>
                {t('privacy.section1_body', { defaultValue: 'We collect information you provide directly to us...' })}
              </Text>

              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                {t('privacy.section2', { defaultValue: '2. Data Use' })}
              </Text>
              <Text style={[styles.body, { color: colors.foreground }]}>
                {t('privacy.section2_body', { defaultValue: 'We use the information we collect to provide, maintain, and improve our services...' })}
              </Text>

              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                {t('privacy.section3', { defaultValue: '3. Third Parties' })}
              </Text>
              <Text style={[styles.body, { color: colors.foreground }]}>
                {t('privacy.section3_body', { defaultValue: 'We may share information with third-party vendors, consultants, and other service providers...' })}
              </Text>

              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                {t('privacy.section4', { defaultValue: '4. Your Rights' })}
              </Text>
              <Text style={[styles.body, { color: colors.foreground }]}>
                {t('privacy.section4_body', { defaultValue: 'You have the right to access, correct, or delete your personal data...' })}
              </Text>

              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                {t('privacy.section5', { defaultValue: '5. Contact' })}
              </Text>
              <Text style={[styles.body, { color: colors.foreground }]}>
                {t('privacy.section5_body', { defaultValue: 'If you have any questions about this Privacy Policy, please contact us at support@dressapp.co' })}
              </Text>
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 24,
  },
  lastUpdated: {
    fontSize: 14,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 16,
  },
});
