import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, I18nManager, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@mobile/theme';
import { spacing } from '@mobile/theme/tokens';
import { api } from '../../lib/api';
import { useNavigation } from '@react-navigation/native';
import * as Lucide from "lucide-react-native";

export function TermsScreen() {
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
        const res = await (api as any).getTermsOfService?.(lang);
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
          {t('terms.title', { defaultValue: 'Terms of Service' })}
        </Text>
      </View>
      
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={[styles.lastUpdated, { color: colors.foreground }]}>
            {t('terms.lastUpdated', { defaultValue: 'Last updated: August 2026' })}
          </Text>

          {content ? (
            <Text style={[styles.body, { color: colors.foreground }]}>{content}</Text>
          ) : (
            <>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                {t('terms.section1', { defaultValue: '1. Acceptance' })}
              </Text>
              <Text style={[styles.body, { color: colors.foreground }]}>
                {t('terms.section1_body', { defaultValue: 'By accessing or using our service, you agree to be bound by these terms...' })}
              </Text>

              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                {t('terms.section2', { defaultValue: '2. Use of Service' })}
              </Text>
              <Text style={[styles.body, { color: colors.foreground }]}>
                {t('terms.section2_body', { defaultValue: 'You must use the service in accordance with all applicable laws and regulations...' })}
              </Text>

              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                {t('terms.section3', { defaultValue: '3. Intellectual Property' })}
              </Text>
              <Text style={[styles.body, { color: colors.foreground }]}>
                {t('terms.section3_body', { defaultValue: 'The service and its original content, features, and functionality are owned by DressApp...' })}
              </Text>

              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                {t('terms.section4', { defaultValue: '4. Limitation of Liability' })}
              </Text>
              <Text style={[styles.body, { color: colors.foreground }]}>
                {t('terms.section4_body', { defaultValue: 'In no event shall DressApp be liable for any indirect, incidental, special, consequential, or punitive damages...' })}
              </Text>

              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                {t('terms.section5', { defaultValue: '5. Governing Law' })}
              </Text>
              <Text style={[styles.body, { color: colors.foreground }]}>
                {t('terms.section5_body', { defaultValue: 'These terms shall be governed and construed in accordance with the laws of your jurisdiction...' })}
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
