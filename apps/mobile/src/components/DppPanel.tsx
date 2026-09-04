/**
 * apps/mobile/src/components/DppPanel.tsx
 *
 * EU Digital Product Passport data renderer for mobile.
 */

import React from 'react';
import { View, Text, StyleSheet, Linking, TouchableOpacity, I18nManager } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii } from '@mobile/theme/tokens';

export interface DppData {
  gtin?: string;
  country_of_origin?: string;
  materials_normalised?: Array<{ material: string; percentage?: number }>;
  carbon_footprint?: string | number | { value?: number; amount?: number; unit?: string };
  care_instructions?: string[];
  repair_instructions?: string[];
  certifications?: string[];
  source_url?: string;
  circularity_score?: number;
  parse_error?: string;
}

export function DppPanel({ dppData }: { dppData?: DppData | null }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const isRtl = I18nManager.isRTL;

  if (!dppData || dppData.parse_error) return null;

  const {
    gtin,
    country_of_origin: countryOfOrigin,
    materials_normalised: materials,
    carbon_footprint: carbonFootprint,
    care_instructions: careInstructions,
    repair_instructions: repairInstructions,
    certifications,
    source_url: sourceUrl,
    circularity_score: circularityScore,
  } = dppData;

  const hasAny =
    gtin ||
    countryOfOrigin ||
    (materials && materials.length > 0) ||
    carbonFootprint ||
    (careInstructions && careInstructions.length > 0) ||
    (repairInstructions && repairInstructions.length > 0) ||
    (certifications && certifications.length > 0) ||
    circularityScore != null ||
    sourceUrl;

  if (!hasAny) return null;

  const formatCarbon = () => {
    if (!carbonFootprint) return null;
    if (typeof carbonFootprint === 'string') return carbonFootprint;
    if (typeof carbonFootprint === 'number') return `${carbonFootprint} kg CO₂e`;
    if (typeof carbonFootprint === 'object') {
      const val = carbonFootprint.value ?? carbonFootprint.amount;
      const unit = carbonFootprint.unit || 'kg CO₂e';
      if (val != null) return `${val} ${unit}`;
    }
    return null;
  };

  const carbon = formatCarbon();
  const s = makeStyles(colors);

  return (
    <View style={s.card}>
      <View style={s.header}>
        <Text style={s.title}>🏷️ {t('dpp.panel.title', { defaultValue: 'Digital Product Passport (DPP)' })}</Text>
        <Text style={s.subtitle}>{t('dpp.panel.subtitle', { defaultValue: 'Verified garment origin, composition & circularity' })}</Text>
      </View>

      {/* Circularity Score bar */}
      {circularityScore != null && (
        <View style={s.metricBlock}>
          <View style={[s.rowBetween, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
            <Text style={s.metricLabel}>{t('dpp.circularityScore', { defaultValue: 'Circularity Score' })}</Text>
            <Text style={s.metricValue}>{Math.round(circularityScore)}/100</Text>
          </View>
          <View style={s.progressBarTrack}>
            <View
              style={[
                s.progressBarFill,
                {
                  width: `${Math.min(Math.max(circularityScore, 5), 100)}%`,
                  backgroundColor: circularityScore > 70 ? '#10B981' : circularityScore > 40 ? '#F59E0B' : '#6B7280',
                },
              ]}
            />
          </View>
        </View>
      )}

      {/* Attributes grid */}
      <View style={s.grid}>
        {gtin && (
          <View style={s.gridItem}>
            <Text style={s.label}>{t('dpp.panel.gtin', { defaultValue: 'GTIN / Barcode' })}</Text>
            <Text style={s.monoValue}>{gtin}</Text>
          </View>
        )}

        {countryOfOrigin && (
          <View style={s.gridItem}>
            <Text style={s.label}>🌍 {t('dpp.panel.countryOfOrigin', { defaultValue: 'Country of Origin' })}</Text>
            <Text style={s.value}>{countryOfOrigin}</Text>
          </View>
        )}

        {carbon && (
          <View style={s.gridItem}>
            <Text style={s.label}>🌱 {t('dpp.panel.carbonFootprint', { defaultValue: 'Carbon Footprint' })}</Text>
            <Text style={s.value}>{carbon}</Text>
          </View>
        )}
      </View>

      {/* Materials breakdown */}
      {materials && materials.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>{t('dpp.panel.materials', { defaultValue: 'Materials & Composition' })}</Text>
          <View style={s.chipRow}>
            {materials.map((m, idx) => (
              <View key={idx} style={s.chip}>
                <Text style={s.chipText}>
                  {m.material} {m.percentage != null ? `${m.percentage}%` : ''}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Care instructions */}
      {careInstructions && careInstructions.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>{t('dpp.panel.care', { defaultValue: 'Care Instructions' })}</Text>
          {careInstructions.map((c, idx) => (
            <Text key={idx} style={s.bulletText}>• {c}</Text>
          ))}
        </View>
      )}

      {/* Certifications */}
      {certifications && certifications.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>🛡️ {t('dpp.panel.certifications', { defaultValue: 'Certifications' })}</Text>
          <View style={s.chipRow}>
            {certifications.map((cert, idx) => (
              <View key={idx} style={[s.chip, s.certChip]}>
                <Text style={[s.chipText, s.certChipText]}>{cert}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* External source link */}
      {sourceUrl && (
        <TouchableOpacity
          style={s.linkBtn}
          onPress={() => Linking.openURL(sourceUrl)}
          activeOpacity={0.7}
        >
          <Text style={s.linkText}>🔗 {t('dpp.panel.viewSource', { defaultValue: 'View Original Passport' })}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const makeStyles = (c: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.card,
      borderRadius: radii.xl,
      borderWidth: 1,
      borderColor: c.accent,
      padding: spacing[4],
      marginVertical: spacing[3],
      gap: spacing[3],
    },
    header: {
      gap: 2,
    },
    title: {
      fontFamily: fonts.display,
      fontSize: fontSizes.base,
      color: c.foreground,
    },
    subtitle: {
      fontFamily: fonts.body,
      fontSize: fontSizes.xs,
      color: c.mutedFg,
    },
    metricBlock: {
      backgroundColor: c.background,
      padding: spacing[3],
      borderRadius: radii.lg,
      gap: spacing[2],
    },
    rowBetween: {
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    metricLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: fontSizes.xs,
      color: c.foreground,
    },
    metricValue: {
      fontFamily: fonts.bodyBold,
      fontSize: fontSizes.sm,
      color: c.foreground,
    },
    progressBarTrack: {
      height: 6,
      backgroundColor: c.border,
      borderRadius: 3,
      overflow: 'hidden',
    },
    progressBarFill: {
      height: '100%',
      borderRadius: 3,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing[3],
    },
    gridItem: {
      minWidth: '45%',
      flex: 1,
    },
    label: {
      fontFamily: fonts.bodyMedium,
      fontSize: fontSizes.xs,
      color: c.mutedFg,
    },
    value: {
      fontFamily: fonts.body,
      fontSize: fontSizes.sm,
      color: c.foreground,
      marginTop: 2,
    },
    monoValue: {
      fontFamily: fonts.bodyMedium,
      fontSize: fontSizes.sm,
      color: c.foreground,
      marginTop: 2,
      letterSpacing: 0.5,
    },
    section: {
      gap: spacing[1],
    },
    sectionTitle: {
      fontFamily: fonts.bodyMedium,
      fontSize: fontSizes.xs,
      color: c.mutedFg,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing[1],
      marginTop: 2,
    },
    chip: {
      backgroundColor: c.background,
      paddingHorizontal: spacing[2],
      paddingVertical: 4,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: c.border,
    },
    chipText: {
      fontFamily: fonts.body,
      fontSize: fontSizes.xs,
      color: c.foreground,
    },
    certChip: {
      backgroundColor: '#ECFDF5',
      borderColor: '#A7F3D0',
    },
    certChipText: {
      color: '#065F46',
    },
    bulletText: {
      fontFamily: fonts.body,
      fontSize: fontSizes.xs,
      color: c.foreground,
    },
    linkBtn: {
      alignItems: 'center',
      paddingVertical: spacing[2],
      borderTopWidth: 1,
      borderTopColor: c.border,
      marginTop: spacing[1],
    },
    linkText: {
      fontFamily: fonts.bodyMedium,
      fontSize: fontSizes.xs,
      color: c.accent,
    },
  });
