import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  TextInput,
  I18nManager,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@mobile/theme';
import { spacing, radii, fontSizes } from '@mobile/theme/tokens';
import { api } from '@mobile/lib/api';

export function ExpertsDirectoryScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const [experts, setExperts] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchExperts = async (q: string) => {
    try {
      setLoading(true);
      const res = await (api as any).getExperts?.({ query: q });
      if (res && Array.isArray(res.items)) {
        setExperts(res.items);
      } else if (Array.isArray(res)) {
        setExperts(res);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => fetchExperts(query), 500);
    return () => clearTimeout(timer);
  }, [query]);

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors?.background || '#fff' },
    header: { padding: spacing[4] },
    title: { fontSize: fontSizes.xl, fontWeight: 'bold', color: theme.colors?.foreground || '#000' },
    search: { borderWidth: 1, borderColor: theme.colors?.border || '#ccc', borderRadius: radii.md, padding: spacing[3], marginHorizontal: spacing[4], marginBottom: spacing[4], textAlign: I18nManager.isRTL ? 'right' : 'left', color: theme.colors?.foreground || '#000' },
    card: { padding: spacing[4], borderBottomWidth: 1, borderColor: theme.colors?.border || '#eee', flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row', alignItems: 'center' },
    cardInfo: { flex: 1 },
    name: { fontSize: fontSizes.md, fontWeight: 'bold', color: theme.colors?.foreground || '#000' },
    prof: { fontSize: 12, color: theme.colors?.mutedFg || '#888' },
  });

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('experts.title', 'Experts')}</Text>
      </View>
      <TextInput
        style={styles.search}
        placeholder={t('experts.filters.search', 'Search')}
        placeholderTextColor={theme.colors?.mutedFg || '#888'}
        value={query}
        onChangeText={setQuery}
      />
      <FlatList
        data={experts}
        keyExtractor={item => String(item.id)}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => {
            const url = item.professional?.business?.website;
            if (url) Linking.openURL(url);
          }}>
            <View style={styles.cardInfo}>
              <Text style={styles.name}>{item.display_name}</Text>
              <Text style={styles.prof}>{item.professional?.profession || 'Expert'}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}
