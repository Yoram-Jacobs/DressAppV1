/**
 * apps/mobile/src/components/stylist/DailySuggestionView.tsx
 *
 * Daily Suggestion & Scheduled Outfits Monthly Calendar View.
 * Complete parity with apps/web/src/pages/Stylist.jsx Daily Suggestion tab:
 *   - Scheduler & Push Reminders status summary card with Edit button
 *   - Interactive Monthly Calendar Grid (Today button, Month switcher, 7-day grid)
 *   - Mini avatar thumbnails on calendar day cards displaying the complete layered outfit (Top, Bottom, Shoes, etc.)
 *   - Real user location & real closet items (zero hallucinated data)
 *   - Touching an outfit card directly launches the Virtual Try On screen
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  I18nManager,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import * as Lucide from 'lucide-react-native';

import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii } from '@mobile/theme/tokens';
import { useClosetStore, useUserStore, useOutfitStore } from '@mobile/lib/stores';
import { labelForDressCode } from '@mobile/lib/taxonomy';

interface DailySuggestionViewProps {
  onTryOn?: (outfit: any) => void;
}

// ─── Slot Resolution Helper (Multilingual + Category Priority) ─────────────

const resolveSlot = (role?: string, category?: string, name?: string, closetItem?: any): string => {
  const cCat = (closetItem?.category || '').toLowerCase().trim();
  const cSub = (closetItem?.sub_category || closetItem?.subcategory || closetItem?.item_type || '').toLowerCase().trim();
  const r = (role || category || '').toLowerCase().trim().replace(/[\s_-]+/g, '_');
  const n = `${name || ''} ${closetItem?.name || ''} ${closetItem?.title || ''}`.toLowerCase().trim();

  // 1. Footwear / Shoes (Checked first so shoes/sneakers are never mistaken for tops or accessories)
  if (
    cCat.includes('footwear') || cCat.includes('shoe') || cSub.includes('shoe') || cSub.includes('sneaker') ||
    r.includes('shoe') || r.includes('footwear') || r.includes('sneaker') || r.includes('boot') || r.includes('sandal') || r.includes('heel') ||
    n.includes('shoes') || n.includes('sneakers') || n.includes('boots') || n.includes('sandals') || n.includes('heels') ||
    n.includes('נעליים') || n.includes('סניקרס') || n.includes('סנדלים') || n.includes('מגפיים') || n.includes('עקבים') || n.includes('כפכפים') ||
    n.includes('حذاء') || n.includes('أحذية') || n.includes('صندل') || n.includes('بوت')
  ) {
    return 'shoes';
  }

  // 2. Headwear
  if (
    cCat.includes('headwear') || cCat.includes('hat') || cSub.includes('hat') || cSub.includes('cap') ||
    r.includes('headwear') || r.includes('hat') || r.includes('cap') || r.includes('beanie') ||
    n.includes('hat') || n.includes('cap') || n.includes('beanie') || n.includes('bandana') || n.includes('beret') ||
    n.includes('כובע') || n.includes('בנדנה') || n.includes('קסקט') || n.includes('קובע') || n.includes('ברט') || n.includes('قبعة')
  ) {
    return 'headwear';
  }

  // 3. Glasses / Eyewear
  if (
    cCat.includes('glasses') || cCat.includes('eyewear') || cSub.includes('glasses') ||
    r.includes('glass') || r.includes('sunglass') || r.includes('eyewear') ||
    n.includes('glasses') || n.includes('sunglasses') || n.includes('משקפיים') || n.includes('משקפי שמש') || n.includes('نظارات')
  ) {
    return 'glasses';
  }

  // 4. Dress / One-piece
  if (
    cCat.includes('dress') || cCat.includes('gown') || cCat.includes('jumpsuit') || cSub.includes('dress') ||
    r.includes('dress') || r.includes('gown') || r.includes('jumpsuit') ||
    n.includes('dress') || n.includes('gown') || n.includes('jumpsuit') || n.includes('שמלה') || n.includes('אוברול') || n.includes('סרבל') || n.includes('فستان')
  ) {
    return 'dress';
  }

  // 5. Outerwear / Jackets / Hoodies
  if (
    cCat.includes('outerwear') || cCat.includes('jacket') || cCat.includes('coat') || cSub.includes('jacket') || cSub.includes('coat') ||
    r.includes('outerwear') || r.includes('jacket') || r.includes('coat') || r.includes('blazer') || r.includes('hoodie') || r.includes('cardigan') ||
    n.includes('jacket') || n.includes('coat') || n.includes('blazer') || n.includes('hoodie') || n.includes('cardigan') ||
    n.includes('מעיל') || n.includes('ז\'קט') || n.includes('ג\'קט') || n.includes('בלייזר') || n.includes('קרדיגן') || n.includes('סווטשירט') ||
    n.includes('سترة') || n.includes('معطف') || n.includes('جاكيت')
  ) {
    return 'outerwear';
  }

  // 6. Bottoms / Pants / Shorts / Skirts
  if (
    cCat.includes('bottom') || cCat.includes('pant') || cCat.includes('short') || cSub.includes('pant') || cSub.includes('short') || cSub.includes('skirt') || cSub.includes('jean') ||
    r.includes('bottom') || r.includes('pant') || r.includes('short') || r.includes('jean') || r.includes('skirt') || r.includes('trouser') ||
    n.includes('pants') || n.includes('shorts') || n.includes('jeans') || n.includes('skirt') || n.includes('trousers') || n.includes('cargo') ||
    n.includes('מכנסיים') || n.includes('שורטס') || n.includes('חצאית') || n.includes('ברמודה') || n.includes('ג\'ינס') || n.includes('טייץ') ||
    n.includes('بنطال') || n.includes('سروال') || n.includes('تنورة') || n.includes('شورت')
  ) {
    return 'bottom';
  }

  // 7. Belt
  if (cCat.includes('belt') || cSub.includes('belt') || r.includes('belt') || n.includes('belt') || n.includes('חגורה') || n.includes('חגורת') || n.includes('حزام')) {
    return 'belt';
  }

  // 8. Bag
  if (
    cCat.includes('bag') || cSub.includes('bag') || cSub.includes('tote') || cSub.includes('purse') ||
    r.includes('bag') || r.includes('purse') || r.includes('backpack') ||
    n.includes('bag') || n.includes('purse') || n.includes('backpack') || n.includes('tote') || n.includes('clutch') ||
    n.includes('תיק') || n.includes('תרמיל') || n.includes('ארנק') || n.includes('حقيبة')
  ) {
    return 'bag';
  }

  // 9. Tops
  if (
    cCat.includes('top') || cCat.includes('shirt') || cSub.includes('shirt') || cSub.includes('tee') || cSub.includes('top') ||
    r.includes('top') || r.includes('shirt') || r.includes('tee') || r.includes('blouse') || r.includes('polo') ||
    n.includes('shirt') || n.includes('tee') || n.includes('t-shirt') || n.includes('top') || n.includes('polo') || n.includes('blouse') || n.includes('tank') ||
    n.includes('חולצה') || n.includes('טי שירט') || n.includes('גופייה') || n.includes('פולו') || n.includes('סוודר') || n.includes('قميص') || n.includes('تي شيرت')
  ) {
    return 'top';
  }

  return 'accessory';
};

// ─── Mini Avatar Outfit Component (Layered Outfit on Silhouette) ───────────

function MiniAvatarOutfit({
  outfit,
  closetItems,
  skinColor = '#C68642',
}: {
  outfit: any;
  closetItems: any[];
  skinColor?: string;
}) {
  const garments = outfit?.garments || outfit?.items || [];

  const pieceMap = useMemo(() => {
    const map: Record<string, string | null> = {
      headwear: null,
      top: null,
      bottom: null,
      shoes: null,
      outerwear: null,
      dress: null,
    };
    for (const g of garments) {
      const targetId = g.closet_item_id || g.id;
      const closetItem: any = closetItems.find(
        (it: any) => it && (it.id === targetId || it._id === targetId || String(it.id) === String(targetId))
      );
      const slot = resolveSlot(g.role, g.category, g.name, closetItem);
      const url =
        closetItem?.clean_image_url ||
        g.clean_image_url ||
        closetItem?.reconstructed_image_url ||
        closetItem?.cutout_url ||
        closetItem?.thumbnail_data_url ||
        g.thumbnail_data_url ||
        closetItem?.image_url ||
        g.image_url;
      if (url && slot in map && !map[slot]) {
        map[slot] = url;
      }
    }
    return map;
  }, [garments, closetItems]);

  return (
    <View style={miniStyles.avatarWrap}>
      {/* Silhouette Head */}
      <View style={[miniStyles.head, { backgroundColor: skinColor }]} />
      {/* Silhouette Torso */}
      <View style={[miniStyles.torso, { backgroundColor: skinColor }]} />
      {/* Silhouette Legs */}
      <View style={miniStyles.legsRow}>
        <View style={[miniStyles.leg, { backgroundColor: skinColor }]} />
        <View style={[miniStyles.leg, { backgroundColor: skinColor }]} />
      </View>

      {/* Layered Cutouts */}
      {pieceMap.dress ? (
        <Image source={{ uri: pieceMap.dress }} style={miniStyles.dressImg} resizeMode="contain" />
      ) : (
        <>
          {pieceMap.top && (
            <Image source={{ uri: pieceMap.top }} style={miniStyles.topImg} resizeMode="contain" />
          )}
          {pieceMap.bottom && (
            <Image source={{ uri: pieceMap.bottom }} style={miniStyles.bottomImg} resizeMode="contain" />
          )}
        </>
      )}

      {pieceMap.outerwear && (
        <Image source={{ uri: pieceMap.outerwear }} style={miniStyles.outerwearImg} resizeMode="contain" />
      )}

      {pieceMap.shoes && (
        <Image source={{ uri: pieceMap.shoes }} style={miniStyles.shoesImg} resizeMode="contain" />
      )}

      {pieceMap.headwear && (
        <Image source={{ uri: pieceMap.headwear }} style={miniStyles.headwearImg} resizeMode="contain" />
      )}
    </View>
  );
}

const miniStyles = StyleSheet.create({
  avatarWrap: {
    width: 34,
    height: 48,
    alignItems: 'center',
    position: 'relative',
    justifyContent: 'flex-start',
    direction: 'ltr',
  },
  head: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    position: 'absolute',
    top: 2,
    left: 12.5,
    zIndex: 1,
    direction: 'ltr',
  },
  torso: {
    width: 14,
    height: 16,
    borderRadius: 2,
    position: 'absolute',
    top: 11,
    left: 10,
    zIndex: 1,
    direction: 'ltr',
  },
  legsRow: {
    width: 11,
    height: 18,
    position: 'absolute',
    top: 27,
    left: 11.5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 1,
    direction: 'ltr',
  },
  leg: {
    width: 4,
    height: 18,
    borderRadius: 2,
  },
  headwearImg: {
    width: 16,
    height: 10,
    position: 'absolute',
    top: 0,
    left: 9,
    zIndex: 10,
    direction: 'ltr',
  },
  topImg: {
    width: 24,
    height: 18,
    position: 'absolute',
    top: 9,
    left: 5,
    zIndex: 5,
    direction: 'ltr',
  },
  outerwearImg: {
    width: 26,
    height: 20,
    position: 'absolute',
    top: 8,
    left: 4,
    zIndex: 6,
    direction: 'ltr',
  },
  bottomImg: {
    width: 18,
    height: 22,
    position: 'absolute',
    top: 21,
    left: 8,
    zIndex: 4,
    direction: 'ltr',
  },
  dressImg: {
    width: 22,
    height: 30,
    position: 'absolute',
    top: 9,
    left: 6,
    zIndex: 5,
    direction: 'ltr',
  },
  shoesImg: {
    width: 18,
    height: 10,
    position: 'absolute',
    bottom: 0,
    left: 8,
    zIndex: 7,
    direction: 'ltr',
  },
});

// ─── Calendar helper functions (identical to web) ───────────────────────────

const getWeekdayName = (day: string, locale: string): string => {
  const days: Record<string, number> = {
    monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sunday: 0,
  };
  const date = new Date(2026, 4, 24 + (days[day.toLowerCase()] ?? 0));
  try {
    return new Intl.DateTimeFormat(locale || 'en', { weekday: 'long' }).format(date);
  } catch {
    return day;
  }
};

const getWeekdayShortName = (dayIndex: number, locale: string): string => {
  const date = new Date(2026, 4, 24 + dayIndex); // May 24, 2026 is Sunday
  try {
    return new Intl.DateTimeFormat(locale || 'en', { weekday: 'short' }).format(date);
  } catch {
    const fallback = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    return fallback[dayIndex] || '';
  }
};

const formatLocalDate = (date: Date): string => {
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDaysInMonth = (date: Date) => {
  const year = date.getFullYear();
  const month = date.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const days: Array<{ date: Date; isCurrentMonth: boolean }> = [];
  const startDayOfWeek = firstDay.getDay();

  // Padding days from the previous month
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    days.push({ date: d, isCurrentMonth: false });
  }

  // Days of the current month
  for (let i = 1; i <= lastDay.getDate(); i++) {
    const d = new Date(year, month, i);
    days.push({ date: d, isCurrentMonth: true });
  }

  // Padding days from next month to make a complete 42-day (6-row) grid
  const remaining = 42 - days.length;
  for (let i = 1; i <= remaining; i++) {
    const d = new Date(year, month + 1, i);
    days.push({ date: d, isCurrentMonth: false });
  }

  return days;
};

const getFrequencyLabel = (freq: string | undefined, weekday: string | undefined, lang: string, t: any): string => {
  if (!freq) return '';
  switch (freq) {
    case 'everyday':
      return t('pages.admin.daily_utc', { defaultValue: 'Everyday' }).split(' ')[0].replace(':', '');
    case 'every_other_day':
      return t('profile.everyOtherDay', { defaultValue: 'Every Other Day' });
    case 'twice_a_week':
      return t('profile.twiceAWeek', { defaultValue: 'Twice a Week' });
    case 'on_weekday': {
      const dayName = getWeekdayName(weekday || 'monday', lang);
      return `${t('profile.onWeekday', { defaultValue: 'On' })} ${dayName}`;
    }
    default:
      return freq;
  }
};

const getStyleLabel = (styleOpt: string | undefined, customStyle: string | undefined, t: any): string => {
  if (!styleOpt) return '';
  if (styleOpt === 'custom') {
    return customStyle || t('credits.custom', { defaultValue: 'Custom' });
  }
  return labelForDressCode(styleOpt, t);
};

export function DailySuggestionView({ onTryOn }: DailySuggestionViewProps) {
  const { t, i18n } = useTranslation();
  const { colors, isDark } = useTheme();
  const navigation = useNavigation<any>();
  const isRtl = I18nManager.isRTL;

  const { items: closetItems } = useClosetStore({ prewarm: true });
  const { user } = useUserStore();
  const { items: outfits } = useOutfitStore({ prewarm: true });

  const [currentCalendarMonth, setCurrentCalendarMonth] = useState<Date>(new Date());

  // Format month name header
  const monthHeader = useMemo(() => {
    try {
      return currentCalendarMonth.toLocaleString(i18n.language || 'en', {
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return currentCalendarMonth.toDateString();
    }
  }, [currentCalendarMonth, i18n.language]);

  // Calendar cells
  const calendarDays = useMemo(() => {
    return getDaysInMonth(currentCalendarMonth);
  }, [currentCalendarMonth]);

  const todayStr = useMemo(() => formatLocalDate(new Date()), []);

  // Helper to find outfit for a specific date
  const getOutfitForDate = useCallback(
    (dateStr: string) => {
      return outfits.find((o) => {
        const uDate = o.usage?.date || (o.created_at ? o.created_at.split('T')[0] : '');
        return uDate === dateStr;
      });
    },
    [outfits]
  );

  // ── Render Monthly Calendar View ──────────────────────────────────────────
  const schedulerEnabled = user?.scheduler_settings?.enabled ?? true;
  const schedulerFreq = getFrequencyLabel(
    user?.scheduler_settings?.frequency || 'everyday',
    user?.scheduler_settings?.weekday,
    i18n.language,
    t
  );
  const schedulerTime = (() => {
    try {
      const tVal = (typeof user?.scheduler_settings?.time === 'string') ? user.scheduler_settings.time : '07:00';
      const [h, m] = tVal.split(':');
      const hInt = parseInt(h, 10) || 7;
      const mStr = m || '00';
      const ampm = hInt >= 12 ? 'PM' : 'AM';
      const h12 = hInt % 12 || 12;
      return `${h12.toString().padStart(2, '0')}:${mStr} ${ampm}`;
    } catch {
      return '07:00 AM';
    }
  })();
  const schedulerStyle = getStyleLabel(
    user?.scheduler_settings?.style_option || 'casual',
    user?.scheduler_settings?.custom_style,
    t
  );

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      {/* 1. Scheduler & Push Reminders Summary Card */}
      <View style={[styles.schedulerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.schedulerLeft}>
          <View style={[styles.bellCircle, { backgroundColor: 'rgba(31, 111, 107, 0.12)' }]}>
            <Lucide.Bell size={20} color={colors.accent} />
          </View>
          <View style={styles.schedulerTextCol}>
            <Text style={[styles.schedulerTitle, { color: colors.foreground }]}>
              {t('profile.schedulerPushReminders', { defaultValue: 'Scheduler & Push Reminders' })}
            </Text>
            <View style={styles.schedulerStatusRow}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: schedulerEnabled ? '#10b981' : colors.mutedFg },
                ]}
              />
              <Text style={[styles.schedulerSubtitle, { color: colors.mutedFg }]}>
                {schedulerEnabled
                  ? `${t('common.enabled', { defaultValue: 'Enabled' })}, ${schedulerFreq}, ${schedulerTime}, ${schedulerStyle}`
                  : t('common.unenabled', { defaultValue: 'Unenabled' })}
              </Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.editSchedulerBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
          onPress={() => navigation.navigate('MeTab', { screen: 'Profile' })}
          activeOpacity={0.8}
        >
          <Lucide.Pencil size={14} color={colors.foreground} />
          <Text style={[styles.editSchedulerBtnText, { color: colors.foreground }]}>
            {t('common.edit', { defaultValue: 'Edit' })}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 2. Monthly Scheduled Outfits Calendar Card */}
      <View style={[styles.calendarCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {/* Calendar Navigation Header */}
        <View style={styles.calendarHeaderRow}>
          <TouchableOpacity
            style={[styles.todayBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
            onPress={() => setCurrentCalendarMonth(new Date())}
            activeOpacity={0.8}
          >
            <Text style={[styles.todayBtnText, { color: colors.foreground }]}>
              {t('calendar.todayBtn', { defaultValue: 'Today' })}
            </Text>
          </TouchableOpacity>

          <View style={[styles.monthNavGroup, { borderColor: colors.border }]}>
            <TouchableOpacity
              style={styles.monthNavArrow}
              onPress={() =>
                setCurrentCalendarMonth(
                  (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
                )
              }
            >
              <Lucide.ChevronLeft size={16} color={colors.foreground} style={isRtl ? { transform: [{ rotate: '180deg' }] } : undefined} />
            </TouchableOpacity>

            <Text style={[styles.monthNavTitle, { color: colors.foreground }]}>{monthHeader}</Text>

            <TouchableOpacity
              style={styles.monthNavArrow}
              onPress={() =>
                setCurrentCalendarMonth(
                  (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
                )
              }
            >
              <Lucide.ChevronRight size={16} color={colors.foreground} style={isRtl ? { transform: [{ rotate: '180deg' }] } : undefined} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Weekday Column Headers */}
        <View style={styles.weekdaysRow}>
          {Array.from({ length: 7 }).map((_, idx) => (
            <Text key={idx} style={[styles.weekdayLabel, { color: colors.mutedFg }]}>
              {getWeekdayShortName(idx, i18n.language)}
            </Text>
          ))}
        </View>

        {/* 42-Cell Monthly Grid (with layered avatar thumbnails) */}
        <View style={styles.calendarGrid}>
          {calendarDays.map(({ date, isCurrentMonth }, idx) => {
            const dayStr = formatLocalDate(date);
            const isToday = dayStr === todayStr;
            const dayOutfit = getOutfitForDate(dayStr);

            return (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.dayCell,
                  {
                    backgroundColor: isToday
                      ? 'rgba(31, 111, 107, 0.08)'
                      : isCurrentMonth
                      ? colors.card
                      : colors.background,
                    borderColor: isToday ? colors.accent : colors.border,
                    borderWidth: isToday ? 1.5 : 1,
                    borderStyle: dayOutfit ? 'solid' : 'dashed',
                    opacity: isCurrentMonth ? 1 : 0.35,
                  },
                ]}
                onPress={() => {
                  if (dayOutfit && onTryOn) {
                    // Touching an outfit directly launches Try-On screen
                    onTryOn(dayOutfit);
                  }
                }}
                activeOpacity={dayOutfit ? 0.7 : 1}
              >
                {/* Day Number */}
                <View style={[styles.dayNumWrap, isToday && { backgroundColor: colors.accent }]}>
                  <Text
                    style={[
                      styles.dayNumText,
                      { color: isToday ? '#FFF' : colors.foreground },
                    ]}
                  >
                    {date.getDate()}
                  </Text>
                </View>

                {/* Day Outfit Avatar Thumbnail / Empty State */}
                <View style={styles.dayThumbArea}>
                  {dayOutfit ? (
                    <MiniAvatarOutfit
                      outfit={dayOutfit}
                      closetItems={closetItems}
                      skinColor={user?.avatar_shape_params?.skinTone || '#C68642'}
                    />
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing['2xl'],
  },
  // ── Scheduler Card ────────────────────────────────────────────────────────
  schedulerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: radii.xl,
    borderWidth: 1,
    gap: spacing.sm,
  },
  schedulerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  bellCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  schedulerTextCol: {
    flex: 1,
  },
  schedulerTitle: {
    fontFamily: fonts.displayBold,
    fontSize: fontSizes.sm,
  },
  schedulerStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  schedulerSubtitle: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
  },
  editSchedulerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  editSchedulerBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
  },
  // ── Monthly Calendar ──────────────────────────────────────────────────────
  calendarCard: {
    padding: spacing.md,
    borderRadius: radii.xl,
    borderWidth: 1,
  },
  calendarHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  todayBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  todayBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
  },
  monthNavGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  monthNavArrow: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  monthNavTitle: {
    fontFamily: fonts.displayBold,
    fontSize: fontSizes.xs,
    minWidth: 120,
    textAlign: 'center',
  },
  weekdaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  weekdayLabel: {
    width: '14.28%',
    textAlign: 'center',
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    textTransform: 'uppercase',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    height: 70,
    padding: 2,
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: radii.xl,
    marginVertical: 2,
  },
  dayNumWrap: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  dayNumText: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
  },
  dayThumbArea: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default DailySuggestionView;
