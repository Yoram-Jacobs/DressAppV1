import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
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
import { useNavigation, useRoute } from '@react-navigation/native';

export function CampaignDetailScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigation = useNavigation();
  const route = useRoute<any>();
  const id = route.params?.id;

  const [campaign, setCampaign] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      (api as any).getCampaign?.(id)
        .then((data: any) => setCampaign(data))
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [id]);

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors?.background || '#fff' },
    header: { flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row', padding: spacing[4], alignItems: 'center' },
    title: { fontSize: fontSizes.xl, fontWeight: 'bold', color: theme.colors?.foreground || '#000', marginVertical: spacing[3] },
    desc: { fontSize: fontSizes.md, color: theme.colors?.foreground || '#000' },
    content: { padding: spacing[4] }
  });

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: spacing[3] }}>
          <Text style={{ color: theme.colors?.foreground }}>{t('common.back', 'Back')}</Text>
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.content}>
        {loading ? <Text>{t('common.loading', 'Loading...')}</Text> : null}
        {campaign ? (
          <>
            <Text style={styles.title}>{campaign.title}</Text>
            <Text style={styles.desc}>{campaign.short_description}</Text>
            <Text style={styles.desc}>{campaign.discount_pct}% OFF</Text>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
