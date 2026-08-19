// @ts-nocheck
import React, { useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Linking, ScrollView, I18nManager } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@mobile/theme';
import { spacing } from '@mobile/theme/tokens';
import { useNavigation } from '@react-navigation/native';
import * as Lucide from "lucide-react-native";

export function PricingScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const handleOpenBrowser = () => {
    Linking.openURL('https://dressapp.co/pricing');
  };

  const BackIcon = I18nManager.isRTL ? Lucide.ArrowRight : Lucide.ArrowLeft;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={['bottom']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <BackIcon size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          {t('pricing.title', 'Pricing & Plans')}
        </Text>
      </View>

      {!hasError ? (
        <View style={styles.webContainer}>
          <WebView
            source={{ uri: 'https://dressapp.co/pricing' }}
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            onError={() => setHasError(true)}
            style={{ backgroundColor: colors.background }}
          />
          {loading && (
            <View style={[styles.loading, { backgroundColor: colors.background }]}>
              <ActivityIndicator color={colors.primary} size="large" />
            </View>
          )}
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.fallbackContainer}>
          <Text style={[styles.fallbackTitle, { color: colors.foreground }]}>
            {t('pricing.fallbackTitle', 'Choose Your Plan')}
          </Text>
          
          <View style={[styles.tierCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.tierName, { color: colors.foreground }]}>Free</Text>
            <Text style={[styles.tierPrice, { color: colors.foreground }]}>$0 / month</Text>
            <Text style={[styles.tierFeature, { color: colors.foreground }]}>• Basic wardrobe management</Text>
            <Text style={[styles.tierFeature, { color: colors.foreground }]}>• Up to 100 items</Text>
            <Text style={[styles.tierFeature, { color: colors.foreground }]}>• Standard support</Text>
          </View>

          <View style={[styles.tierCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.tierName, { color: colors.foreground }]}>Pro</Text>
            <Text style={[styles.tierPrice, { color: colors.foreground }]}>$4.99 / month</Text>
            <Text style={[styles.tierFeature, { color: colors.foreground }]}>• Unlimited items</Text>
            <Text style={[styles.tierFeature, { color: colors.foreground }]}>• AI Outfit recommendations</Text>
            <Text style={[styles.tierFeature, { color: colors.foreground }]}>• Priority support</Text>
          </View>

          <View style={[styles.tierCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.tierName, { color: colors.foreground }]}>Studio</Text>
            <Text style={[styles.tierPrice, { color: colors.foreground }]}>$12.99 / month</Text>
            <Text style={[styles.tierFeature, { color: colors.foreground }]}>• Everything in Pro</Text>
            <Text style={[styles.tierFeature, { color: colors.foreground }]}>• Connect with stylists</Text>
            <Text style={[styles.tierFeature, { color: colors.foreground }]}>• Professional analytics</Text>
          </View>

          <TouchableOpacity 
            style={[styles.webButton, { backgroundColor: colors.primary }]} 
            onPress={handleOpenBrowser}
          >
            <Text style={styles.webButtonText}>
              {t('pricing.viewOnline', 'View Online')}
            </Text>
          </TouchableOpacity>
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
  webContainer: {
    flex: 1,
  },
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackContainer: {
    padding: 24,
    alignItems: 'center',
  },
  fallbackTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 32,
  },
  tierCard: {
    width: '100%',
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  tierName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  tierPrice: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  tierFeature: {
    fontSize: 14,
    marginBottom: 4,
  },
  webButton: {
    marginTop: 24,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  webButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
