import { StyleSheet, Text, View } from 'react-native';

import { calories, type Totals } from '../storage';
import { formatGrams, formatNumber, MACROS, useTheme } from '../theme';

type Props = {
  totals: Totals;
  dayLabel: string;
};

export function TotalsPanel({ totals, dayLabel }: Props) {
  const { c } = useTheme();
  const kcal = calories(totals);

  const shares = MACROS.map((m) => ({
    key: m.key,
    color: c.macro[m.key],
    portion: kcal > 0 ? (totals[m.key] * m.kcalPerGram) / kcal : 0,
  }));

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={styles.header}>
        <Text style={[styles.eyebrow, { color: c.muted }]}>DAILY TOTALS</Text>
        <Text style={[styles.day, { color: c.faint }]}>{dayLabel}</Text>
      </View>

      <View style={styles.row}>
        {MACROS.map((m) => (
          <View key={m.key} style={styles.col}>
            <Text style={[styles.macroLetter, { color: c.macro[m.key] }]}>{m.letter}</Text>
            <Text style={[styles.macroValue, { color: c.text }]}>
              {formatGrams(totals[m.key])}
              <Text style={[styles.macroUnit, { color: c.faint }]}>g</Text>
            </Text>
          </View>
        ))}
      </View>

      <View style={[styles.bar, { backgroundColor: c.surfaceAlt }]}>
        {shares.map((s) =>
          s.portion > 0 ? (
            <View key={s.key} style={{ flex: s.portion, backgroundColor: s.color }} />
          ) : null,
        )}
      </View>

      <View style={styles.calorieRow}>
        <Text style={[styles.eyebrow, { color: c.muted }]}>DAILY CALORIES</Text>
        <Text style={[styles.calorieValue, { color: c.text }]}>
          {formatNumber(kcal)}
          <Text style={[styles.calorieUnit, { color: c.faint }]}> kcal</Text>
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  day: {
    fontSize: 12,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    marginTop: 14,
    marginBottom: 14,
  },
  col: {
    flex: 1,
    alignItems: 'center',
  },
  macroLetter: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 4,
  },
  macroValue: {
    fontSize: 27,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  macroUnit: {
    fontSize: 14,
    fontWeight: '600',
  },
  bar: {
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  calorieRow: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  calorieValue: {
    fontSize: 30,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  calorieUnit: {
    fontSize: 14,
    fontWeight: '600',
  },
});
