import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  daysInMonth,
  fromDayKey,
  longDate,
  monthLabel,
  toDayKey,
  WEEKDAY_INITIALS,
  type DayKey,
} from '../date';
import { calories, sumDay, type Log, type Totals } from '../storage';
import { formatGrams, formatNumber, MACROS, useTheme } from '../theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  log: Log;
  today: DayKey;
};

type DayStat = { totals: Totals; kcal: number };

export function CalendarSheet({ visible, onClose, log, today }: Props) {
  const { c, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const [cursor, setCursor] = useState(() => {
    const d = fromDayKey(today);
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [selected, setSelected] = useState<DayKey>(today);

  // Every open starts on the current month with today selected.
  const resetToToday = () => {
    const d = fromDayKey(today);
    setCursor({ year: d.getFullYear(), month: d.getMonth() });
    setSelected(today);
  };

  const cells = useMemo(() => {
    const lead = new Date(cursor.year, cursor.month, 1).getDay();
    const count = daysInMonth(cursor.year, cursor.month);
    const arr: (DayKey | null)[] = new Array(lead).fill(null);
    for (let d = 1; d <= count; d++) arr.push(toDayKey(new Date(cursor.year, cursor.month, d)));
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [cursor]);

  const month = useMemo(() => {
    const stats = new Map<DayKey, DayStat>();
    let max = 0;
    let sum = 0;
    for (const key of cells) {
      if (!key) continue;
      const totals = sumDay(log[key]);
      const kcal = calories(totals);
      if (kcal <= 0) continue;
      stats.set(key, { totals, kcal });
      if (kcal > max) max = kcal;
      sum += kcal;
    }
    return { stats, max, logged: stats.size, average: stats.size ? sum / stats.size : 0 };
  }, [cells, log]);

  const atCurrentMonth = useMemo(() => {
    const d = fromDayKey(today);
    return cursor.year === d.getFullYear() && cursor.month === d.getMonth();
  }, [cursor, today]);

  const step = (delta: number) => {
    setCursor((prev) => {
      const d = new Date(prev.year, prev.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  // Heat tint: the bigger a day's calorie total, the more the cell stands out.
  const tint = (kcal: number) => {
    if (!kcal || !month.max) return 'transparent';
    const intensity = 0.25 + 0.75 * (kcal / month.max);
    const alpha = isDark ? 0.05 + 0.13 * intensity : 0.03 + 0.1 * intensity;
    return isDark
      ? 'rgba(243, 245, 249, ' + alpha.toFixed(3) + ')'
      : 'rgba(13, 17, 23, ' + alpha.toFixed(3) + ')';
  };

  const selectedStat = month.stats.get(selected) ?? null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onShow={resetToToday}
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.sheet,
          { backgroundColor: c.bg, paddingTop: Platform.OS === 'android' ? insets.top : 0 },
        ]}
      >
        <View style={[styles.sheetHeader, { borderBottomColor: c.border }]}>
          <Text style={[styles.sheetTitle, { color: c.text }]}>Calendar</Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button">
            <Text style={[styles.done, { color: c.text }]}>Done</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.monthNav}>
            <NavButton
              icon="chevron-back"
              onPress={() => step(-1)}
              color={c.text}
              surface={c.surface}
              border={c.border}
            />
            <Text style={[styles.monthTitle, { color: c.text }]}>
              {monthLabel(cursor.year, cursor.month)}
            </Text>
            <NavButton
              icon="chevron-forward"
              onPress={() => step(1)}
              disabled={atCurrentMonth}
              color={atCurrentMonth ? c.faint : c.text}
              surface={c.surface}
              border={c.border}
            />
          </View>

          <View style={styles.weekdays}>
            {WEEKDAY_INITIALS.map((label, i) => (
              <Text key={i} style={[styles.weekday, { color: c.faint }]}>
                {label}
              </Text>
            ))}
          </View>

          <View style={styles.grid}>
            {cells.map((key, i) => {
              if (!key) return <View key={'pad-' + i} style={styles.cell} />;
              const stat = month.stats.get(key);
              const isToday = key === today;
              const isSelected = key === selected;
              const isFuture = key > today;
              return (
                <Pressable
                  key={key}
                  style={styles.cell}
                  onPress={() => setSelected(key)}
                  accessibilityRole="button"
                  accessibilityLabel={
                    longDate(key) +
                    (stat ? ', ' + Math.round(stat.kcal) + ' calories' : ', nothing logged')
                  }
                >
                  <View
                    style={[
                      styles.cellInner,
                      { backgroundColor: tint(stat ? stat.kcal : 0) },
                      isToday && { borderWidth: 1.5, borderColor: c.macro.p },
                      isSelected && { borderWidth: 2, borderColor: c.text },
                    ]}
                  >
                    <Text
                      style={[
                        styles.cellDay,
                        { color: isFuture ? c.faint : stat ? c.text : c.muted },
                      ]}
                    >
                      {fromDayKey(key).getDate()}
                    </Text>
                    <Text style={[styles.cellKcal, { color: stat ? c.muted : 'transparent' }]}>
                      {stat ? formatNumber(stat.kcal) : '0'}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <View style={[styles.detail, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={[styles.detailDate, { color: c.text }]}>{longDate(selected)}</Text>
            {selectedStat ? (
              <>
                <View style={styles.detailRow}>
                  {MACROS.map((m) => (
                    <View key={m.key} style={styles.detailCol}>
                      <Text style={[styles.detailLetter, { color: c.macro[m.key] }]}>
                        {m.letter}
                      </Text>
                      <Text style={[styles.detailValue, { color: c.text }]}>
                        {formatGrams(selectedStat.totals[m.key])}
                        <Text style={[styles.detailUnit, { color: c.faint }]}>g</Text>
                      </Text>
                    </View>
                  ))}
                </View>
                <View style={[styles.detailDivider, { backgroundColor: c.border }]} />
                <View style={styles.detailCalories}>
                  <Text style={[styles.detailEyebrow, { color: c.muted }]}>TOTAL CALORIES</Text>
                  <Text style={[styles.detailKcal, { color: c.text }]}>
                    {formatNumber(selectedStat.kcal)}
                    <Text style={[styles.detailUnit, { color: c.faint }]}> kcal</Text>
                  </Text>
                </View>
              </>
            ) : (
              <Text style={[styles.empty, { color: c.faint }]}>Nothing logged</Text>
            )}
          </View>

          <Text style={[styles.summary, { color: c.faint }]}>
            {month.logged === 0
              ? 'No days logged this month'
              : month.logged +
                (month.logged === 1 ? ' day logged' : ' days logged') +
                '  ·  ' +
                formatNumber(month.average) +
                ' kcal average'}
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

function NavButton({
  icon,
  onPress,
  disabled,
  color,
  surface,
  border,
}: {
  icon: 'chevron-back' | 'chevron-forward';
  onPress: () => void;
  disabled?: boolean;
  color: string;
  surface: string;
  border: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={10}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.navButton,
        { backgroundColor: surface, borderColor: border, opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <Ionicons name={icon} size={18} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1 },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetTitle: { fontSize: 18, fontWeight: '700' },
  done: { fontSize: 16, fontWeight: '600' },
  scroll: { paddingHorizontal: 16, paddingTop: 8 },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  navButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthTitle: { fontSize: 17, fontWeight: '700' },
  weekdays: { flexDirection: 'row', marginBottom: 4 },
  weekday: {
    width: '14.2857%',
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.2857%', aspectRatio: 0.92, padding: 2.5 },
  cellInner: {
    flex: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellDay: { fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] },
  cellKcal: { fontSize: 9, fontWeight: '600', marginTop: 1, fontVariant: ['tabular-nums'] },
  detail: {
    marginTop: 18,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  detailDate: { fontSize: 15, fontWeight: '700' },
  detailRow: { flexDirection: 'row', marginTop: 12, marginBottom: 12 },
  detailCol: { flex: 1, alignItems: 'center' },
  detailLetter: { fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 2 },
  detailValue: { fontSize: 20, fontWeight: '700', fontVariant: ['tabular-nums'] },
  detailUnit: { fontSize: 12, fontWeight: '600' },
  detailDivider: { height: StyleSheet.hairlineWidth },
  detailCalories: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  detailEyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  detailKcal: { fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] },
  empty: { marginTop: 10, fontSize: 14, fontWeight: '500' },
  summary: { marginTop: 16, textAlign: 'center', fontSize: 12, fontWeight: '600' },
});
