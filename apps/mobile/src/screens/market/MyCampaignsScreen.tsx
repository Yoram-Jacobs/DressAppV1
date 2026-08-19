import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  I18nManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@mobile/theme';
import { spacing, radii, fontSizes } from '@mobile/theme/tokens';
import { api } from '@mobile/lib/api';
import { useNavigation } from '@react-navigation/native';

export function MyCampaignsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCampaigns();
  }, []);

  const loadCampaigns = async () => {
    try {
      setLoading(true);
      const res = await (api as any).listMyCampaigns?.({ limit: 50 });
      if (res && res.items) {
        setCampaigns(res.items);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors?.background || '#fff' },
    header: { flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', padding: spacing[4], alignItems: 'center' },
    title: { fontSize: fontSizes.xl, fontWeight: 'bold', color: theme.colors?.foreground || '#000' },
    card: { padding: spacing[4], borderBottomWidth: 1, borderColor: theme.colors?.border || '#eee' },
    cardTitle: { fontSize: fontSizes.md, fontWeight: 'bold', color: theme.colors?.foreground || '#000' },
    cardStatus: { fontSize: 12, color: theme.colors?.mutedFg || '#888', marginTop: spacing[2] },
    fab: { position: 'absolute', bottom: spacing[8], right: spacing[8], backgroundColor: theme.colors?.primary || '#000', width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
    fabText: { color: '#fff', fontSize: 24 }
  });

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('campaigns.mine.title', 'My Campaigns')}</Text>
      </View>
      <FlatList
        data={campaigns}
        keyExtractor={c => String(c.id)}
        onRefresh={loadCampaigns}
        refreshing={loading}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('CampaignDetailScreen', { id: item.id })}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardStatus}>{item.status}</Text>
          </TouchableOpacity>
        )}
      />
      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('CreateCampaignScreen')}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}
