/**
 * apps/mobile/src/components/WorkBatchDoneToast.tsx
 *
 * Toast notification triggered when an AI batch segmentation job finishes.
 * Parity with apps/web/src/components/WorkBatchDoneToast.jsx.
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Lucide from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';

import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii } from '@mobile/theme/tokens';
import { useWorkStore } from '@mobile/lib/stores/workStore';

export function WorkBatchDoneToast() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const { lastCompletedBatch, completedCount } = useWorkStore();
  const [visible, setVisible] = React.useState(false);
  const prevBatchRef = useRef(lastCompletedBatch);

  useEffect(() => {
    if (lastCompletedBatch && lastCompletedBatch !== prevBatchRef.current) {
      prevBatchRef.current = lastCompletedBatch;
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [lastCompletedBatch]);

  if (!visible) return null;

  const handleOpenCloset = () => {
    setVisible(false);
    try {
      navigation.navigate('ClosetTab', { screen: 'Closet' });
    } catch {
      // ignore
    }
  };

  return (
    <View style={styles.container} pointerEvents="box-none">
      <TouchableOpacity
        style={[
          styles.toast,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
        onPress={handleOpenCloset}
        activeOpacity={0.9}
      >
        <Lucide.Sparkles size={20} color={colors.accent} />
        <View style={styles.textCol}>
          <Text style={[styles.title, { color: colors.foreground }]}>
            {t('floater.batchDoneTitle', { defaultValue: 'You have news in your closet' })}
          </Text>
          <Text style={[styles.desc, { color: colors.mutedFg }]}>
            {t('floater.batchDoneDescription', {
              defaultValue: '{{n}} item(s) ready to view',
              n: completedCount,
            })}
          </Text>
        </View>
        <Text style={[styles.cta, { color: colors.accent }]}>
          {t('floater.batchDoneCta', { defaultValue: 'Open' })} →
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    zIndex: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius: radii.xl,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 10,
    gap: spacing[3],
  },
  textCol: {
    flex: 1,
  },
  title: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
  },
  desc: {
    fontFamily: fonts.body,
    fontSize: 11,
  },
  cta: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
  },
});
