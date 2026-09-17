/**
 * apps/mobile/src/components/profile/SchedulerSettings.tsx
 *
 * Outfit Scheduler accordion section for DressApp mobile.
 * Features:
 *   - "Daily Outfit Alert" toggle switch
 *   - "Delivery Time" customizable time input (HH:mm)
 *   - "Frequency" chips (Everyday, Workdays, Weekly)
 *   - "Style" chips (Casual, Smart Casual, Formal, Business, Sporty, Night Out, Custom)
 *   - "Dress For Demands (Costume)" text input field
 *   - Weekend sync, Weather sync, and Calendar sync toggles
 *   - Framed borders selection feedback throughout
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Switch,
  StyleSheet,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Lucide from 'lucide-react-native';
import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii } from '@mobile/theme/tokens';
import { useClosetStore } from '@mobile/lib/stores';

const FREQUENCIES = [
  { id: 'everyday', label: 'Everyday' },
  { id: 'workdays', label: 'Workdays' },
  { id: 'weekly', label: 'Weekly' },
];

const STYLES = [
  { id: 'casual', label: 'Casual' },
  { id: 'smart_casual', label: 'Smart Casual' },
  { id: 'formal', label: 'Formal' },
  { id: 'business', label: 'Business' },
  { id: 'sporty', label: 'Sporty' },
  { id: 'tags', label: 'Tags' },
  { id: 'night_out', label: 'Night Out' },
  { id: 'custom', label: 'Custom' },
];

interface SchedulerProps {
  enabled: boolean;
  setEnabled: (val: boolean) => void;
  time: string;
  setTime: (val: string) => void;
  frequency: string;
  setFrequency: (val: string) => void;
  styleOption: string;
  setStyleOption: (val: string) => void;
  customStyle: string;
  setCustomStyle: (val: string) => void;
  weatherSync: boolean;
  setWeatherSync: (val: boolean) => void;
  calendarSync: boolean;
  setCalendarSync: (val: boolean) => void;
}

export function SchedulerSettings({
  enabled,
  setEnabled,
  time = '07:30',
  setTime,
  frequency = 'everyday',
  setFrequency,
  styleOption = 'casual',
  setStyleOption,
  customStyle,
  setCustomStyle,
  weatherSync,
  setWeatherSync,
  calendarSync,
  setCalendarSync,
}: SchedulerProps) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();

  const { items: closetItems } = useClosetStore({ prewarm: true });
  const [tagDraft, setTagDraft] = useState('');

  const selectedTags = useMemo(() => {
    if (styleOption !== 'tags') return [];
    return (customStyle || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }, [styleOption, customStyle]);

  const availableClosetTags = useMemo(() => {
    const tagsSet = new Set<string>();
    (closetItems || []).forEach((it: any) => {
      (it?.tags || []).forEach((t: any) => {
        const tr = String(t || '').trim();
        if (tr) tagsSet.add(tr);
      });
      (it?.custom_tags || []).forEach((t: any) => {
        const tr = String(t || '').trim();
        if (tr) tagsSet.add(tr);
      });
    });
    return Array.from(tagsSet).sort((a, b) => a.localeCompare(b));
  }, [closetItems]);

  const addTag = (tagToAdd?: string) => {
    const raw = String(tagToAdd || tagDraft).trim();
    if (!raw) return;
    const pieces = raw.split(',').map((s) => s.trim()).filter(Boolean);
    const next = [...selectedTags];
    pieces.forEach((p) => {
      if (!next.some((t) => t.toLowerCase() === p.toLowerCase())) {
        next.push(p);
      }
    });
    setCustomStyle(next.join(', '));
    setTagDraft('');
  };

  const removeTag = (tagToRemove: string) => {
    const updated = selectedTags.filter((t) => t.toLowerCase() !== tagToRemove.toLowerCase());
    setCustomStyle(updated.join(', '));
  };

  return (
    <View style={styles.container}>
      {/* Daily Outfit Alert Master Switch */}
      <View style={[styles.switchRow, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
        <View style={styles.switchTextCol}>
          <Text style={[styles.switchTitle, { color: colors.foreground }]}>
            {t('profile.dailyOutfitAlert', { defaultValue: 'Daily Outfit Alert' })}
          </Text>
          <Text style={[styles.switchSub, { color: colors.mutedFg }]}>
            {t('profile.dailyOutfitAlertDesc', { defaultValue: 'Receive personalized outfit proposals every morning.' })}
          </Text>
        </View>
        <Switch
          value={enabled}
          onValueChange={setEnabled}
          trackColor={{ false: colors.border, true: colors.accent }}
        />
      </View>

      {/* Customizable Delivery Time */}
      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.foreground }]}>
          {t('profile.deliveryTime', { defaultValue: 'Delivery Time (Notification Time)' })}
        </Text>
        <View style={styles.timeInputRow}>
          <Lucide.Clock size={16} color={colors.mutedFg} />
          <TextInput
            style={[styles.input, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border, flex: 1 }]}
            value={time}
            onChangeText={setTime}
            placeholder="07:30"
            placeholderTextColor={colors.mutedFg}
          />
        </View>
      </View>

      {/* Frequency Selector */}
      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.foreground }]}>
          {t('profile.frequency', { defaultValue: 'Frequency' })}
        </Text>
        <View style={styles.chipsContainer}>
          {FREQUENCIES.map((f) => {
            const isSelected = (frequency || '').toLowerCase() === f.id.toLowerCase();
            return (
              <TouchableOpacity
                key={f.id}
                style={[
                  styles.chip,
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
                onPress={() => setFrequency(f.id)}
              >
                <Text
                  style={[
                    styles.chipText,
                    {
                      color: isSelected ? colors.foreground : colors.mutedFg,
                      fontFamily: isSelected ? fonts.bodyBold : fonts.bodyMedium,
                    },
                  ]}
                >
                  {t(`profile.scheduler.${f.id}`, { defaultValue: f.label })}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Style Option Selector */}
      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.foreground }]}>
          {t('profile.defaultStyle', { defaultValue: 'Outfit Style Preference' })}
        </Text>
        <View style={styles.chipsContainer}>
          {STYLES.map((st) => {
            const isSelected = (styleOption || '').toLowerCase() === st.id.toLowerCase();
            return (
              <TouchableOpacity
                key={st.id}
                style={[
                  styles.chip,
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
                onPress={() => setStyleOption(st.id)}
              >
                <Text
                  style={[
                    styles.chipText,
                    {
                      color: isSelected ? colors.foreground : colors.mutedFg,
                      fontFamily: isSelected ? fonts.bodyBold : fonts.bodyMedium,
                    },
                  ]}
                >
                  {t(`profile.scheduler.${st.id}`, { defaultValue: st.label })}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Tags Selector UI */}
      {styleOption === 'tags' && (
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.foreground }]}>
            {t('profile.selectOrWriteTags', { defaultValue: 'Select or write tags' })}
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.xs, alignItems: 'center' }}>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border, flex: 1 },
              ]}
              value={tagDraft}
              onChangeText={setTagDraft}
              onSubmitEditing={() => addTag()}
              placeholder={t('profile.tagsPlaceholder', { defaultValue: 'Type a tag and press Enter (e.g. Work, Summer, Solid)' })}
              placeholderTextColor={colors.mutedFg}
              returnKeyType="done"
            />
            {tagDraft.trim().length > 0 && (
              <TouchableOpacity
                onPress={() => addTag()}
                style={{
                  backgroundColor: colors.accent,
                  paddingHorizontal: spacing.sm,
                  paddingVertical: spacing.xs + 3,
                  borderRadius: radii.md,
                }}
              >
                <Lucide.Plus size={16} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </View>

          {/* Selected Tags */}
          {selectedTags.length > 0 && (
            <View style={[styles.chipsContainer, { marginTop: spacing.xs }]}>
              {selectedTags.map((tag) => (
                <View
                  key={tag}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: 'rgba(31, 111, 107, 0.16)',
                      borderColor: colors.accent,
                      borderWidth: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                    },
                  ]}
                >
                  <Text style={[styles.chipText, { color: colors.foreground, fontFamily: fonts.bodyBold }]}>
                    {tag}
                  </Text>
                  <TouchableOpacity onPress={() => removeTag(tag)}>
                    <Lucide.X size={12} color={colors.mutedFg} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Available Closet Tags */}
          {availableClosetTags.filter((t) => !selectedTags.some((st) => st.toLowerCase() === t.toLowerCase())).length > 0 && (
            <View style={{ marginTop: spacing.xs + 2 }}>
              <Text style={{ fontSize: 11, color: colors.mutedFg, marginBottom: 4, fontFamily: fonts.bodyMedium }}>
                {t('profile.availableTags', { defaultValue: 'From your closet:' })}
              </Text>
              <View style={styles.chipsContainer}>
                {availableClosetTags
                  .filter((t) => !selectedTags.some((st) => st.toLowerCase() === t.toLowerCase()))
                  .map((tag) => (
                    <TouchableOpacity
                      key={tag}
                      onPress={() => addTag(tag)}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: colors.secondary,
                          borderColor: colors.border,
                          borderWidth: 1,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 2,
                        },
                      ]}
                    >
                      <Lucide.Plus size={10} color={colors.mutedFg} />
                      <Text style={[styles.chipText, { color: colors.mutedFg }]}>{tag}</Text>
                    </TouchableOpacity>
                  ))}
              </View>
            </View>
          )}
        </View>
      )}

      {/* Dress For Demands (Costume) Field */}
      {styleOption === 'custom' && (
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.foreground }]}>
            {t('profile.dressForDemands', { defaultValue: 'Dress For Demands (Custom Occasion / Costume)' })}
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
            value={customStyle}
            onChangeText={setCustomStyle}
            placeholder={t('profile.dressForDemandsPlaceholder', { defaultValue: 'e.g. Rainy day client presentation, Creative pitch, Wedding guest' })}
            placeholderTextColor={colors.mutedFg}
          />
        </View>
      )}

      {/* Environment & Sync Toggles */}
      <View style={styles.togglesList}>
        <View style={[styles.toggleItem, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <View style={styles.toggleTextCol}>
            <Text style={[styles.toggleLabel, { color: colors.foreground }]}>
              {t('profile.weatherSync', { defaultValue: 'Weather Synchronization' })}
            </Text>
            <Text style={[styles.toggleSub, { color: colors.mutedFg }]}>
              {t('profile.weatherSyncDesc', { defaultValue: 'Adjust recommendations dynamically for rain, temperature, and sun.' })}
            </Text>
          </View>
          <Switch
            value={weatherSync}
            onValueChange={setWeatherSync}
            trackColor={{ false: colors.border, true: colors.accent }}
          />
        </View>

        <View style={[styles.toggleItem, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <View style={styles.toggleTextCol}>
            <Text style={[styles.toggleLabel, { color: colors.foreground }]}>
              {t('profile.calendarSync', { defaultValue: 'Calendar Event Sync' })}
            </Text>
            <Text style={[styles.toggleSub, { color: colors.mutedFg }]}>
              {t('profile.calendarSyncDesc', { defaultValue: 'Sync outfits with meetings and upcoming calendar schedules.' })}
            </Text>
          </View>
          <Switch
            value={calendarSync}
            onValueChange={setCalendarSync}
            trackColor={{ false: colors.border, true: colors.accent }}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.sm,
  },
  switchTextCol: {
    flex: 1,
    gap: 2,
  },
  switchTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.sm,
  },
  switchSub: {
    fontFamily: fonts.body,
    fontSize: 10.5,
  },
  field: {
    gap: spacing.xs,
  },
  label: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
  },
  timeInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    fontSize: fontSizes.sm,
    fontFamily: fonts.body,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radii.full,
  },
  chipText: {
    fontSize: fontSizes.xs,
  },
  togglesList: {
    gap: spacing.xs,
  },
  toggleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.sm,
  },
  toggleTextCol: {
    flex: 1,
    gap: 2,
  },
  toggleLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
  },
  toggleSub: {
    fontFamily: fonts.body,
    fontSize: 10,
  },
});
