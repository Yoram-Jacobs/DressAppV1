/**
 * apps/mobile/src/components/profile/MeasurementsSection.tsx
 *
 * Sizing & Body Measurements with Metric / Imperial toggling,
 * complete field coverage, smart AI measurement predictor,
 * and high-contrast frame selection feedback.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Lucide from 'lucide-react-native';

import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii } from '@mobile/theme/tokens';
import { api } from '@mobile/lib/api';

export interface MeasurementsProps {
  height: string;
  setHeight: (val: string) => void;
  weight: string;
  setWeight: (val: string) => void;
  waist: string;
  setWaist: (val: string) => void;
  footLength: string;
  setFootLength: (val: string) => void;
  chest: string;
  setChest: (val: string) => void;
  hips: string;
  setHips: (val: string) => void;
  shoulders: string;
  setShoulders: (val: string) => void;
  sleeve: string;
  setSleeve: (val: string) => void;
  inseam: string;
  setInseam: (val: string) => void;
  outseam: string;
  setOutseam: (val: string) => void;
  shoeSize: string;
  setShoeSize: (val: string) => void;
  topSize: string;
  setTopSize: (val: string) => void;
  bottomSize: string;
  setBottomSize: (val: string) => void;
  dressSize?: string;
  setDressSize?: (val: string) => void;
  braSize?: string;
  setBraSize?: (val: string) => void;
  gender?: string;
}

const TOP_SIZES = ['XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];
const BOTTOM_SIZES = ['26', '28', '30', '32', '34', '36', '38', '40', '42'];

export function MeasurementsSection({
  height,
  setHeight,
  weight,
  setWeight,
  waist,
  setWaist,
  footLength,
  setFootLength,
  chest,
  setChest,
  hips,
  setHips,
  shoulders,
  setShoulders,
  sleeve,
  setSleeve,
  inseam,
  setInseam,
  outseam,
  setOutseam,
  shoeSize,
  setShoeSize,
  topSize,
  setTopSize,
  bottomSize,
  setBottomSize,
  dressSize,
  setDressSize,
  braSize,
  setBraSize,
  gender = 'female',
}: MeasurementsProps) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const [unitSystem, setUnitSystem] = useState<'metric' | 'imperial'>('metric');
  const [predicting, setPredicting] = useState(false);
  const [predictedSuccess, setPredictedSuccess] = useState(false);
  const lastCallRef = useRef('');

  const lengthUnit = unitSystem === 'metric' ? 'cm' : 'in';
  const weightUnit = unitSystem === 'metric' ? 'kg' : 'lbs';

  const hasCoreBiometrics = !!(height && weight && waist && footLength);

  const runPredictMeasurements = useCallback(async (manual = false) => {
    let h_cm = parseFloat(height);
    let w_kg = parseFloat(weight);
    let wa_cm = parseFloat(waist);
    let fl_cm = parseFloat(footLength);

    if (isNaN(h_cm) || isNaN(w_kg) || isNaN(wa_cm) || isNaN(fl_cm)) {
      if (manual) {
        Alert.alert(
          t('profile.missingCore', { defaultValue: 'Missing Core Measurements' }),
          t('profile.missingCoreDesc', { defaultValue: 'Please fill Height, Weight, Waist, and Foot Length to run smart AI prediction.' })
        );
      }
      return;
    }

    if (unitSystem === 'imperial') {
      h_cm *= 2.54;
      wa_cm *= 2.54;
      fl_cm *= 2.54;
      w_kg *= 0.45359237;
    }

    setPredicting(true);
    try {
      const res = await api.predictMeasurements({
        height: h_cm,
        weight: w_kg,
        waist: wa_cm,
        foot_length: fl_cm,
        gender: gender === 'male' ? 'male' : 'female',
      });

      const convertVal = (val: number | undefined) => {
        if (val === undefined || isNaN(val)) return '';
        if (unitSystem === 'imperial') {
          return String(Math.round((val / 2.54) * 10) / 10);
        }
        return String(Math.round(val * 10) / 10);
      };

      if (res.chest) setChest(convertVal(res.chest));
      if (res.hip) setHips(convertVal(res.hip));
      if (res.shoulders) setShoulders(convertVal(res.shoulders));
      if (res.sleeve) setSleeve(convertVal(res.sleeve));
      if (res.inseam) setInseam(convertVal(res.inseam));
      if (res.outseam) setOutseam(convertVal(res.outseam));

      if (res.recommended_sizes) {
        if (res.recommended_sizes.shirt_size) setTopSize(res.recommended_sizes.shirt_size);
        if (res.recommended_sizes.pants_size) setBottomSize(String(res.recommended_sizes.pants_size));
        if (res.recommended_sizes.shoe_size_us) setShoeSize(`US ${res.recommended_sizes.shoe_size_us}`);
        if (res.recommended_sizes.dress_size && res.recommended_sizes.dress_size !== 'N/A' && setDressSize) {
          setDressSize(res.recommended_sizes.dress_size);
        }
        if (res.recommended_sizes.bra_size && res.recommended_sizes.bra_size !== 'N/A' && setBraSize) {
          setBraSize(res.recommended_sizes.bra_size);
        }
      }
      setPredictedSuccess(true);
    } catch (err) {
      console.warn('Prediction error:', err);
    } finally {
      setPredicting(false);
    }
  }, [height, weight, waist, footLength, gender, unitSystem, setChest, setHips, setShoulders, setSleeve, setInseam, setOutseam, setTopSize, setBottomSize, setShoeSize, setDressSize, setBraSize, t]);

  // Auto trigger prediction with debounce when all 4 core values are present
  useEffect(() => {
    if (!height || !weight || !waist || !footLength) return;
    const sig = `${height}_${weight}_${waist}_${footLength}_${gender}_${unitSystem}`;
    if (sig === lastCallRef.current) return;

    const timer = setTimeout(() => {
      lastCallRef.current = sig;
      runPredictMeasurements(false);
    }, 600);

    return () => clearTimeout(timer);
  }, [height, weight, waist, footLength, gender, unitSystem, runPredictMeasurements]);

  return (
    <View style={styles.container}>
      {/* Unit switch & Description */}
      <View style={styles.unitHeader}>
        <Text style={[styles.sectionSubtitle, { color: colors.mutedFg }]}>
          {t('profile.measurementsDesc', {
            defaultValue: 'Enter 4 core biometrics to automatically calculate full body proportions and sizing.',
          })}
        </Text>

        <View style={[styles.unitToggle, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <TouchableOpacity
            style={[
              styles.unitBtn,
              unitSystem === 'metric' && [
                styles.unitBtnActive,
                {
                  backgroundColor: isDark ? 'rgba(35, 139, 130, 0.22)' : 'rgba(31, 111, 107, 0.12)',
                  borderColor: colors.accent,
                },
              ],
            ]}
            onPress={() => setUnitSystem('metric')}
          >
            <Text
              style={[
                styles.unitBtnText,
                { color: unitSystem === 'metric' ? colors.foreground : colors.mutedFg },
                unitSystem === 'metric' && styles.unitBtnTextActive,
              ]}
            >
              Metric (cm/kg)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.unitBtn,
              unitSystem === 'imperial' && [
                styles.unitBtnActive,
                {
                  backgroundColor: isDark ? 'rgba(35, 139, 130, 0.22)' : 'rgba(31, 111, 107, 0.12)',
                  borderColor: colors.accent,
                },
              ],
            ]}
            onPress={() => setUnitSystem('imperial')}
          >
            <Text
              style={[
                styles.unitBtnText,
                { color: unitSystem === 'imperial' ? colors.foreground : colors.mutedFg },
                unitSystem === 'imperial' && styles.unitBtnTextActive,
              ]}
            >
              Imperial (in/lbs)
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Core 4 Biometrics Card */}
      <View style={[styles.coreCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
        <View style={styles.coreCardHeader}>
          <View style={styles.coreTagRow}>
            <Lucide.Sparkles size={14} color={colors.accent} />
            <Text style={[styles.coreCardTitle, { color: colors.foreground }]}>
              {t('profile.coreSizingBiometrics', { defaultValue: 'Core Sizing Biometrics' })}
            </Text>
          </View>
          {predictedSuccess && (
            <View style={[styles.predictedBadge, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
              <Lucide.Check size={11} color="#10B981" />
              <Text style={styles.predictedBadgeText}>
                {t('profile.aiCalculated', { defaultValue: 'AI Calculated' })}
              </Text>
            </View>
          )}
        </View>

        {/* 1. Height & Weight */}
        <View style={styles.row}>
          <View style={styles.halfField}>
            <Text style={[styles.label, { color: colors.foreground }]}>
              {t('profile.height', { defaultValue: 'Height' })} ({lengthUnit}) *
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]}
              value={height}
              onChangeText={setHeight}
              keyboardType="numeric"
              placeholder={unitSystem === 'metric' ? '170' : '67'}
              placeholderTextColor={colors.mutedFg}
            />
          </View>
          <View style={styles.halfField}>
            <Text style={[styles.label, { color: colors.foreground }]}>
              {t('profile.weight', { defaultValue: 'Weight' })} ({weightUnit}) *
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]}
              value={weight}
              onChangeText={setWeight}
              keyboardType="numeric"
              placeholder={unitSystem === 'metric' ? '65' : '143'}
              placeholderTextColor={colors.mutedFg}
            />
          </View>
        </View>

        {/* 2. Waist & Foot Length */}
        <View style={styles.row}>
          <View style={styles.halfField}>
            <Text style={[styles.label, { color: colors.foreground }]}>
              {t('profile.waist', { defaultValue: 'Waist' })} ({lengthUnit}) *
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]}
              value={waist}
              onChangeText={setWaist}
              keyboardType="numeric"
              placeholder={unitSystem === 'metric' ? '74' : '29'}
              placeholderTextColor={colors.mutedFg}
            />
          </View>
          <View style={styles.halfField}>
            <Text style={[styles.label, { color: colors.foreground }]}>
              {t('profile.footLength', { defaultValue: 'Foot Length' })} ({lengthUnit}) *
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]}
              value={footLength}
              onChangeText={setFootLength}
              keyboardType="numeric"
              placeholder={unitSystem === 'metric' ? '25.5' : '10'}
              placeholderTextColor={colors.mutedFg}
            />
          </View>
        </View>

        {/* Predict Action Button */}
        <TouchableOpacity
          style={[
            styles.calcBtn,
            {
              backgroundColor: colors.accent,
            },
          ]}
          onPress={() => runPredictMeasurements(true)}
          disabled={predicting}
        >
          {predicting ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <Lucide.Wand2 size={15} color="#FFF" />
              <Text style={styles.calcBtnText}>
                {predictedSuccess
                  ? '✨ Recalculate Body Measurements'
                  : '✨ Smart Calculate Sizing with AI'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Standard Recommended Top Size */}
      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.foreground }]}>
          {t('profile.standardTopSize', { defaultValue: 'Standard Top / Shirt Size' })}
        </Text>
        <View style={styles.sizeChips}>
          {TOP_SIZES.map((sz) => {
            const isSelected = topSize === sz;
            return (
              <TouchableOpacity
                key={sz}
                style={[
                  styles.sizeChip,
                  {
                    backgroundColor: isSelected
                      ? isDark
                        ? 'rgba(35, 139, 130, 0.22)'
                        : 'rgba(31, 111, 107, 0.12)'
                      : colors.secondary,
                    borderColor: isSelected ? colors.accent : colors.border,
                    borderWidth: isSelected ? 2 : 1,
                  },
                ]}
                onPress={() => setTopSize(sz)}
              >
                <Text
                  style={[
                    styles.sizeChipText,
                    {
                      color: isSelected ? colors.foreground : colors.mutedFg,
                      fontFamily: isSelected ? fonts.bodyBold : fonts.bodyMedium,
                    },
                  ]}
                >
                  {sz}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Standard Recommended Bottom Size */}
      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.foreground }]}>
          {t('profile.standardBottomSize', { defaultValue: 'Standard Bottom / Waist Size' })}
        </Text>
        <View style={styles.sizeChips}>
          {BOTTOM_SIZES.map((sz) => {
            const isSelected = bottomSize === sz;
            return (
              <TouchableOpacity
                key={sz}
                style={[
                  styles.sizeChip,
                  {
                    backgroundColor: isSelected
                      ? isDark
                        ? 'rgba(35, 139, 130, 0.22)'
                        : 'rgba(31, 111, 107, 0.12)'
                      : colors.secondary,
                    borderColor: isSelected ? colors.accent : colors.border,
                    borderWidth: isSelected ? 2 : 1,
                  },
                ]}
                onPress={() => setBottomSize(sz)}
              >
                <Text
                  style={[
                    styles.sizeChipText,
                    {
                      color: isSelected ? colors.foreground : colors.mutedFg,
                      fontFamily: isSelected ? fonts.bodyBold : fonts.bodyMedium,
                    },
                  ]}
                >
                  {sz}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Detailed Body Measurements */}
      <Text style={[styles.subSectionTitle, { color: colors.foreground }]}>
        Detailed Body Proportions ({lengthUnit})
      </Text>

      {/* Chest, Hips, Shoulders */}
      <View style={styles.threeColRow}>
        <View style={styles.thirdField}>
          <Text style={[styles.label, { color: colors.foreground }]}>
            {t('profile.chest', { defaultValue: 'Chest/Bust' })}
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
            value={chest}
            onChangeText={setChest}
            keyboardType="numeric"
            placeholder={unitSystem === 'metric' ? '92' : '36'}
            placeholderTextColor={colors.mutedFg}
          />
        </View>
        <View style={styles.thirdField}>
          <Text style={[styles.label, { color: colors.foreground }]}>
            {t('profile.hips', { defaultValue: 'Hips' })}
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
            value={hips}
            onChangeText={setHips}
            keyboardType="numeric"
            placeholder={unitSystem === 'metric' ? '98' : '38'}
            placeholderTextColor={colors.mutedFg}
          />
        </View>
        <View style={styles.thirdField}>
          <Text style={[styles.label, { color: colors.foreground }]}>
            {t('profile.shoulders', { defaultValue: 'Shoulders' })}
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
            value={shoulders}
            onChangeText={setShoulders}
            keyboardType="numeric"
            placeholder={unitSystem === 'metric' ? '40' : '16'}
            placeholderTextColor={colors.mutedFg}
          />
        </View>
      </View>

      {/* Sleeve, Inseam, Outseam */}
      <View style={styles.threeColRow}>
        <View style={styles.thirdField}>
          <Text style={[styles.label, { color: colors.foreground }]}>
            {t('profile.sleeve', { defaultValue: 'Sleeve' })}
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
            value={sleeve}
            onChangeText={setSleeve}
            keyboardType="numeric"
            placeholder={unitSystem === 'metric' ? '60' : '24'}
            placeholderTextColor={colors.mutedFg}
          />
        </View>
        <View style={styles.thirdField}>
          <Text style={[styles.label, { color: colors.foreground }]}>
            {t('profile.inseam', { defaultValue: 'Inseam' })}
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
            value={inseam}
            onChangeText={setInseam}
            keyboardType="numeric"
            placeholder={unitSystem === 'metric' ? '78' : '31'}
            placeholderTextColor={colors.mutedFg}
          />
        </View>
        <View style={styles.thirdField}>
          <Text style={[styles.label, { color: colors.foreground }]}>
            {t('profile.outseam', { defaultValue: 'Outseam' })}
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
            value={outseam}
            onChangeText={setOutseam}
            keyboardType="numeric"
            placeholder={unitSystem === 'metric' ? '102' : '40'}
            placeholderTextColor={colors.mutedFg}
          />
        </View>
      </View>

      {/* Shoe Size & Optional Sizes */}
      <View style={styles.row}>
        <View style={styles.halfField}>
          <Text style={[styles.label, { color: colors.foreground }]}>
            {t('profile.shoeSize', { defaultValue: 'Shoe Size (EU/US)' })}
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
            value={shoeSize}
            onChangeText={setShoeSize}
            placeholder={t('profile.shoeSizePlaceholder', { defaultValue: 'EU 42 / US 9' })}
            placeholderTextColor={colors.mutedFg}
          />
        </View>

        {gender === 'female' && setDressSize && (
          <View style={styles.halfField}>
            <Text style={[styles.label, { color: colors.foreground }]}>
              {t('profile.dressSize', { defaultValue: 'Dress Size' })}
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
              value={dressSize || ''}
              onChangeText={setDressSize}
              placeholder={t('profile.dressSizePlaceholder', { defaultValue: 'US 6 / EU 38' })}
              placeholderTextColor={colors.mutedFg}
            />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  unitHeader: {
    gap: spacing.xs,
  },
  sectionSubtitle: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    lineHeight: 18,
  },
  unitToggle: {
    flexDirection: 'row',
    borderRadius: radii.full,
    padding: 3,
    borderWidth: 1,
    marginTop: spacing.xs,
  },
  unitBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: radii.full,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  unitBtnActive: {},
  unitBtnText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.xs,
  },
  unitBtnTextActive: {
    fontFamily: fonts.bodyBold,
  },
  coreCard: {
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    gap: spacing.sm,
  },
  coreCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  coreTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  coreCardTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs + 1,
  },
  predictedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  predictedBadgeText: {
    color: '#10B981',
    fontFamily: fonts.bodyBold,
    fontSize: 9.5,
  },
  calcBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: radii.full,
    marginTop: 4,
  },
  calcBtnText: {
    color: '#FFF',
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
  },
  subSectionTitle: {
    fontFamily: fonts.displayBold,
    fontSize: fontSizes.sm,
    marginTop: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  threeColRow: {
    flexDirection: 'row',
    gap: spacing.xs + 2,
  },
  halfField: {
    flex: 1,
    gap: 4,
  },
  thirdField: {
    flex: 1,
    gap: 4,
  },
  field: {
    gap: 6,
  },
  label: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
  },
  input: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 8,
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
  },
  sizeChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  sizeChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 42,
  },
  sizeChipText: {
    fontSize: fontSizes.xs,
  },
});
