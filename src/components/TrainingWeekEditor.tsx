import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { fromDayKey, shortDate, toDayKey, WEEKDAY_INITIALS, type DayKey } from '../date';
import type { Units } from '../fueling/profile';
import type { DayType } from '../fueling/rules';
import {
  checkWeek,
  EMPTY_WEEK,
  KM_PER_MI,
  setDayType,
  weekFor,
  weekKey,
  type Week,
  type Weeks,
} from '../fueling/training';
import { useTheme } from '../theme';

type Props = {
  weeks: Weeks;
  today: DayKey;
  units: Units;
  onChange: (key: DayKey, week: Week) => void;
};

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const shiftWeek = (key: DayKey, weeks: number) => {
  const d = fromDayKey(key);
  d.setDate(d.getDate() + weeks * 7);
  return toDayKey(d);
};

export function TrainingWeekEditor({ weeks, today, units, onChange }: Props) {
  const { c } = useTheme();
  const thisWeek = weekKey(today);
  const [viewKey, setViewKey] = useState(thisWeek);

  const found = weekFor(weeks, viewKey);
  const entered = weeks[viewKey];
  // A week with no entry shows the one it's carrying forward; the first edit
  // turns that copy into this week's own entry.
  const week: Week = entered ?? found?.week ?? EMPTY_WEEK;
  const carried = !entered && !!found;

  const perKm = units === 'imperial' ? 1 / KM_PER_MI : 1;
  const unit = units === 'imperial' ? 'mi' : 'km';
  const show = (km: number) => (km > 0 ? String(Math.round(km * perKm * 10) / 10) : '');

  // The text fields hold what's being typed, so "12." survives until the next
  // digit. They only reload from the stored week when the week or the units
  // change — not when the first keystroke turns a carried week into its own.
  const [mileage, setMileage] = useState(show(week.km));
  const [longRun, setLongRun] = useState(show(week.longRunKm));
  useEffect(() => {
    setMileage(show(week.km));
    setLongRun(show(week.longRunKm));
  }, [viewKey, units]);

  const commit = (next: Week) => onChange(viewKey, next);
  const toKm = (text: string) => {
    const n = parseFloat(text);
    return Number.isFinite(n) && n > 0 ? n / perKm : 0;
  };

  const hasLong = week.days.includes('long');
  const problem = checkWeek(week);

  const rows: { type: Exclude<DayType, 'easy'>; label: string; color: string }[] = [
    { type: 'workout', label: 'Workouts', color: c.macro.p },
    { type: 'long', label: 'Long run', color: c.macro.f },
    { type: 'rest', label: 'Rest', color: c.muted },
  ];

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={styles.nav}>
        <Pressable
          onPress={() => setViewKey((k) => shiftWeek(k, -1))}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Previous week"
        >
          <Ionicons name="chevron-back" size={20} color={c.text} />
        </Pressable>
        <Text style={[styles.title, { color: c.text }]}>
          {viewKey === thisWeek ? 'This week' : `Week of ${shortDate(viewKey)}`}
        </Text>
        <Pressable
          onPress={() => setViewKey((k) => shiftWeek(k, 1))}
          disabled={viewKey >= thisWeek}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Next week"
        >
          <Ionicons name="chevron-forward" size={20} color={viewKey >= thisWeek ? c.faint : c.text} />
        </Pressable>
      </View>

      {carried ? (
        <Text style={[styles.note, { color: c.muted }]}>
          Same as the week of {shortDate(found!.key)} — change anything to make it this week&apos;s own.
        </Text>
      ) : !found ? (
        <Text style={[styles.note, { color: c.muted }]}>
          Enter this week&apos;s mileage and tap the days to set it up.
        </Text>
      ) : null}

      <View style={styles.fields}>
        <Field
          label={`Weekly ${unit}`}
          value={mileage}
          onChange={(v) => {
            setMileage(v);
            commit({ ...week, km: toKm(v) });
          }}
        />
        {hasLong ? (
          <Field
            label={`Long run ${unit}`}
            value={longRun}
            onChange={(v) => {
              setLongRun(v);
              commit({ ...week, longRunKm: toKm(v) });
            }}
          />
        ) : (
          <View style={styles.flex} />
        )}
      </View>

      {rows.map((row) => (
        <View key={row.type} style={styles.chipRow}>
          <Text style={[styles.rowLabel, { color: c.muted }]}>{row.label}</Text>
          <View style={styles.chips}>
            {WEEKDAY_INITIALS.map((initial, i) => {
              const on = week.days[i] === row.type;
              return (
                <Pressable
                  key={i}
                  onPress={() => commit({ ...week, days: setDayType(week.days, i, row.type) })}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${row.label}: ${WEEKDAY_NAMES[i]}`}
                  style={({ pressed }) => [
                    styles.chip,
                    {
                      borderColor: on ? row.color : c.border,
                      backgroundColor: on ? row.color + '2E' : 'transparent',
                      opacity: pressed ? 0.6 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.chipText, { color: on ? row.color : c.muted }]}>{initial}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}

      <Text style={[styles.hint, { color: c.faint }]}>
        Days you don&apos;t mark are easy days.
      </Text>
      {problem ? (
        <Text style={[styles.error, { color: c.macro.c }]}>
          {problem === 'longRunMissing'
            ? 'Enter how far the long run is.'
            : 'The long run is longer than the whole week.'}
        </Text>
      ) : null}
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const { c } = useTheme();
  return (
    <View style={styles.flex}>
      <Text style={[styles.fieldLabel, { color: c.muted }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={(v) => onChange(v.replace(/[^0-9.]/g, ''))}
        keyboardType="decimal-pad"
        inputMode="decimal"
        placeholder="0"
        placeholderTextColor={c.faint}
        maxLength={5}
        accessibilityLabel={label}
        style={[
          styles.fieldInput,
          { color: c.text, backgroundColor: c.surfaceAlt, borderColor: c.border },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 14,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 15, fontWeight: '700' },
  note: { fontSize: 12, fontWeight: '500', marginTop: 10, lineHeight: 16 },
  fields: { flexDirection: 'row', gap: 10, marginTop: 14, marginBottom: 6 },
  flex: { flex: 1 },
  fieldLabel: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
  fieldInput: {
    height: 42,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: 12,
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  chipRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  rowLabel: { width: 72, fontSize: 12, fontWeight: '600' },
  chips: { flex: 1, flexDirection: 'row', justifyContent: 'space-between' },
  chip: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { fontSize: 13, fontWeight: '700' },
  hint: { fontSize: 11, fontWeight: '500', marginTop: 12 },
  error: { fontSize: 13, fontWeight: '600', marginTop: 8 },
});
