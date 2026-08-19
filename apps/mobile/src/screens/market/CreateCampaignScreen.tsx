import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  I18nManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@mobile/theme';
import { spacing, radii, fontSizes } from '@mobile/theme/tokens';
import { api } from '@mobile/lib/api';
import { useNavigation } from '@react-navigation/native';

export function CreateCampaignScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigation = useNavigation();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [discountPct, setDiscountPct] = useState('');
  const [loading, setLoading] = useState(false);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors?.background || '#fff',
    },
    header: {
      flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
      padding: spacing[4],
      alignItems: 'center',
    },
    titleText: {
      fontSize: fontSizes.xl,
      fontWeight: 'bold',
      color: theme.colors?.foreground || '#000',
    },
    content: {
      padding: spacing[4],
    },
    input: {
      borderWidth: 1,
      borderColor: theme.colors?.border || '#ccc',
      borderRadius: radii.md,
      padding: spacing[3],
      marginBottom: spacing[4],
      color: theme.colors?.foreground || '#000',
      textAlign: I18nManager.isRTL ? 'right' : 'left',
    },
    button: {
      backgroundColor: theme.colors?.primary || '#000',
      padding: spacing[4],
      borderRadius: radii.md,
      alignItems: 'center',
    },
    buttonText: {
      color: '#fff',
      fontWeight: 'bold',
    },
  });

  const handleSubmit = async () => {
    try {
      setLoading(true);
      await (api as any).createCampaign({
        title,
        short_description: description,
        discount_pct: Number(discountPct) || 0,
      });
      navigation.goBack();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: spacing[3] }}>
          <Text style={{ color: theme.colors?.foreground }}>{t('common.back', 'Back')}</Text>
        </TouchableOpacity>
        <Text style={styles.titleText}>{t('campaigns.create.title', 'Create Campaign')}</Text>
      </View>
      <ScrollView style={styles.content}>
        <TextInput
          style={styles.input}
          placeholder={t('campaigns.create.basic.titlePlaceholder', 'Campaign Name')}
          value={title}
          onChangeText={setTitle}
        />
        <TextInput
          style={[styles.input, { height: 100 }]}
          placeholder={t('campaigns.create.basic.shortDescriptionPlaceholder', 'Description')}
          multiline
          value={description}
          onChangeText={setDescription}
        />
        <TextInput
          style={styles.input}
          placeholder={t('campaigns.create.promotion.discountPct', 'Discount %')}
          keyboardType="numeric"
          value={discountPct}
          onChangeText={setDiscountPct}
        />
        <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? '...' : t('campaigns.mine.submit', 'Submit')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
