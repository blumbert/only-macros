import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { addDays, shortDate, WEEKDAY_INITIALS, type DayKey } from '../date';
import type { Units } from '../fueling/profile';
import { RULES, type DayType } from '../fueling/rules';
import {
  checkWeek,
  EMPTY_WEEK,
  KM_PER_MI,
  setDayType,
  weekFor,
  weekKey,
  type Week,
  type Weeks,
  type WeekXt,
} from '../fueling/training';
import { useTheme } from '../theme';
import { Dropdown, range as optionRange } from './Dropdown';
import { DONE_ID } from './KeyboardDone';

type Props = {
  weeks: Weeks;
  today: DayKey;
  units: Units;
  onChange: (key: DayKey, week: Week) => void;
};

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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
  const { minEffort, maxEffort, defaultEffort } = RULES.crossTraining;
  const xt: WeekXt = week.xt ?? {
    min: Array(7).fill(0),
    effort: Array(7).fill(defaultEffort),
  };
  const showWhole = (n: number) => (n > 0 ? String(n) : '');
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
  const xtColor = c.macro.c;
  const setXtMin = (i: number, text: string) => {
    const n = parseInt(text, 10);
    const min = xt.min.map((m, j) => (j === i ? (Number.isFinite(n) && n > 0 ? n : 0) : m));
    commit({ ...week, xt: { ...xt, min } });
  };
  const setXtEffort = (i: number, value: number) =>
    commit({ ...week, xt: { ...xt, effort: xt.effort.map((e, j) => (j === i ? value : e)) } });
  const efforts = optionRange(minEffort, maxEffort);
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
          onPress={() => setViewKey((k) => addDays(k, -7))}
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
          onPress={() => setViewKey((k) => addDays(k, 7))}
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

      {/* The days across the top, so every row below reads as a column. */}
      <View style={[styles.chipRow, styles.headerRow]}>
        <View style={styles.rowLabel} />
        <View style={styles.chips}>
          {WEEKDAY_INITIALS.map((initial, i) => (
            <Text key={i} style={[styles.dayHead, { color: c.muted }]}>
              {initial}
            </Text>
          ))}
        </View>
      </View>

      {rows.map((row) => (
        <View key={row.type} style={styles.chipRow}>
          <Text style={[styles.rowLabel, { color: c.muted }]}>{row.label}</Text>
          <View style={styles.chips}>
            {WEEKDAY_INITIALS.map((_, i) => {
              const on = week.days[i] === row.type;
              return (
                <Pressable
                  key={i}
                  onPress={() => commit({ ...week, days: setDayType(week.days, i, row.type) })}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
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
                  {on ? <Ionicons name="checkmark" size={18} color={row.color} /> : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}

      {/* Cross-training, under the running: any day can have it, each with
          its own minutes and effort. Typing minutes plans that day. */}
      <View style={[styles.divider, { backgroundColor: c.border }]} />
      <View style={styles.chipRow}>
        <Text style={[styles.rowLabel, { color: c.muted }]}>Cross-train min</Text>
        <View style={styles.chips}>
          {WEEKDAY_INITIALS.map((_, i) => {
            const on = xt.min[i] > 0;
            return (
              <TextInput
                inputAccessoryViewID={DONE_ID}
                key={i}
                value={showWhole(xt.min[i])}
                onChangeText={(v) => setXtMin(i, v.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                inputMode="numeric"
                maxLength={3}
                selectTextOnFocus
                accessibilityLabel={`Cross-training minutes, ${WEEKDAY_NAMES[i]}`}
                style={[
                  styles.chip,
                  styles.box,
                  {
                    color: on ? xtColor : c.text,
                    borderColor: on ? xtColor : c.border,
                    backgroundColor: on ? xtColor + '2E' : 'transparent',
                  },
                ]}
              />
            );
          })}
        </View>
      </View>
      {/* Above the hint and the cards below, so an open list floats over them. */}
      <View style={[styles.chipRow, styles.raised]}>
        <Text style={[styles.rowLabel, { color: c.muted }]}>Effort 1–10</Text>
        <View style={styles.chips}>
          {WEEKDAY_INITIALS.map((_, i) =>
            xt.min[i] > 0 ? (
              <Dropdown
                key={`${viewKey}-${i}`}
                compact
                width={34}
                label={`Cross-training effort, ${WEEKDAY_NAMES[i]}`}
                value={xt.effort[i]}
                options={efforts}
                onChange={(n) => setXtEffort(i, n)}
              />
            ) : (
              <View key={i} style={styles.chipGap} />
            ),
          )}
        </View>
      </View>

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
  whole = false,
  maxLength = 5,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  /** Whole numbers only (minutes, effort). */
  whole?: boolean;
  maxLength?: number;
}) {
  const { c } = useTheme();
  return (
    <View style={styles.flex}>
      <Text style={[styles.fieldLabel, { color: c.muted }]}>{label}</Text>
      <TextInput
        inputAccessoryViewID={DONE_ID}
        value={value}
        onChangeText={(v) => onChange(v.replace(whole ? /[^0-9]/g : /[^0-9.]/g, ''))}
        keyboardType={whole ? 'number-pad' : 'decimal-pad'}
        inputMode={whole ? 'numeric' : 'decimal'}
        placeholder="0"
        placeholderTextColor={c.faint}
        maxLength={maxLength}
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
    // Above the cards that follow, so an open effort list floats over them.
    zIndex: 10,
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
  // Minutes and effort: rounded rectangles, set apart from the tap-to-check circles.
  box: {
    width: 34,
    height: 26,
    borderRadius: 8,
    padding: 0,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
  },
  chipGap: { width: 34, height: 26 },
  raised: { zIndex: 10 },
  headerRow: { marginTop: 14 },
  dayHead: { width: 34, textAlign: 'center', fontSize: 12, fontWeight: '700' },
  divider: { height: StyleSheet.hairlineWidth * 2, marginTop: 14, marginBottom: 2 },
  hint: { fontSize: 11, fontWeight: '500', marginTop: 12 },
  error: { fontSize: 13, fontWeight: '600', marginTop: 8 },
});
