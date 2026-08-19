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

export function SuitcaseScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigation = useNavigation();

  const [destination, setDestination] = useState('');
  const [departureDate, setDepartureDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [purpose, setPurpose] = useState('casual');
  
  const [packingList, setPackingList] = useState<any[]>([]);
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
    backButton: {
      padding: spacing[3],
    },
    title: {
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
      marginBottom: spacing[4],
    },
    buttonText: {
      color: '#fff',
      fontWeight: 'bold',
    },
    itemCard: {
      flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      padding: spacing[3],
      borderBottomWidth: 1,
      borderBottomColor: theme.colors?.border || '#eee',
    },
    itemText: {
      color: theme.colors?.foreground || '#000',
      flex: 1,
      textAlign: I18nManager.isRTL ? 'right' : 'left',
    }
  });

  const handlePack = async () => {
    try {
      setLoading(true);
      const res = await (api as any).packSuitcase({
        destinations: destination,
        purpose,
        departure_time: departureDate,
        return_time: returnDate,
      });
      if (res && res.packing_list) {
        setPackingList(res.packing_list);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const toggleCheck = (id: string) => {
    setPackingList(prev => prev.map(item => item.id === id ? { ...item, checked: !item.checked } : item));
  };

  const handleSave = async () => {
    try {
      await (api as any).approveSuitcase({
        destinations: destination,
        purpose,
        departure_time: departureDate,
        return_time: returnDate,
        packing_list: packingList,
      });
      navigation.goBack();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={{ color: theme.colors?.foreground }}>{t('common.back', 'Back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('suitcase.title', 'Suitcase')}</Text>
      </View>
      <ScrollView style={styles.content}>
        <TextInput
          style={styles.input}
          placeholder={t('suitcase.destination', 'Destination')}
          placeholderTextColor={theme.colors?.mutedFg || '#888'}
          value={destination}
          onChangeText={setDestination}
        />
        <TextInput
          style={styles.input}
          placeholder={t('suitcase.departure', 'Departure Date')}
          placeholderTextColor={theme.colors?.mutedFg || '#888'}
          value={departureDate}
          onChangeText={setDepartureDate}
        />
        <TextInput
          style={styles.input}
          placeholder={t('suitcase.return', 'Return Date')}
          placeholderTextColor={theme.colors?.mutedFg || '#888'}
          value={returnDate}
          onChangeText={setReturnDate}
        />
        <TouchableOpacity style={styles.button} onPress={handlePack} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? '...' : t('suitcase.pack', 'Generate List')}</Text>
        </TouchableOpacity>
        {packingList.map(item => (
          <TouchableOpacity key={String(item.id)} style={styles.itemCard} onPress={() => toggleCheck(item.id)}>
            <Text style={styles.itemText}>{item.checked ? '☑ ' : '☐ '}{item.title || item.name || 'Item'}</Text>
          </TouchableOpacity>
        ))}
        {packingList.length > 0 && (
          <TouchableOpacity style={styles.button} onPress={handleSave}>
            <Text style={styles.buttonText}>{t('suitcase.save', 'Save Suitcase')}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
