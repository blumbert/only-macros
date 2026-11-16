import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { addDays, describeDay, type DayKey } from '../date';
import { servingsName, type FoodsStore } from '../foods';
import { buzzSuccess } from '../haptics';
import { parseMacroInput } from '../macroInput';
import { caloriesDisagree, scale } from '../nutrition/parseLabel';
import { calories, MAX_NAME, type Totals } from '../storage';
import { formatGrams, formatNumber, useTheme, type MacroKey } from '../theme';
import { EMPTY_MACRO_DRAFT, MacroInputs, type MacroDraft } from './MacroInputs';
import { ServingsInput } from './ServingsInput';

/** What a label scan or an AI search found, to fill the form with. */
export type Prefill = {
  perServing: Partial<Totals>;
  servings?: number;
  name?: string;
  servingSize?: string;
  /** The calories the source states per serving, to check the macros against. */
  kcal?: number;
};

type Props = {
  today: DayKey;
  foods: FoodsStore;
  onAdd: (day: DayKey, values: Totals, name?: string) => void;
  /** The page's own way in: scan buttons, a search box. Sits under the day. */
  top: ReactNode;
  prefill: Prefill | null;
  /** Bump to apply `prefill` again, even when it's equal to the last one. */
  prefillId: number;
  /** Where the numbers came from, for the hints: "label" or "estimate". */
  sourceNoun: string;
  onAdded?: () => void;
};

const readDraft = (d: MacroDraft): Totals => ({
  c: parseMacroInput(d.c),
  p: parseMacroInput(d.p),
  f: parseMacroInput(d.f),
});

const describe = (t: Totals) => `${formatGrams(t.c)}C ${formatGrams(t.p)}P ${formatGrams(t.f)}F`;

/**
 * The per-serving form a label scan or an AI search fills in: always shown,
 * always editable, so a misread or a wrong guess is easy to fix before
 * anything is added. Adds to today or any earlier day.
 */
export function FoodEntryForm({
  today,
  foods,
  onAdd,
  top,
  prefill,
  prefillId,
  sourceNoun,
  onAdded,
}: Props) {
  const { c } = useTheme();
  const [daysBack, setDaysBack] = useState(0);
  const [draft, setDraft] = useState<MacroDraft>(EMPTY_MACRO_DRAFT);
  const [missing, setMissing] = useState<MacroKey[]>([]);
  const [servings, setServings] = useState('1');
  const [name, setName] = useState('');
  const [servingSize, setServingSize] = useState<string | undefined>();
  const [sourceKcal, setSourceKcal] = useState<number | undefined>();
  const [saveToFoods, setSaveToFoods] = useState(false);
  const [added, setAdded] = useState<string | null>(null);

  const day = addDays(today, -daysBack);
  const dayName = describeDay(day, today);
  // "Add to today", "Add to Mon, Oct 13".
  const dayPhrase = daysBack < 2 ? dayName.toLowerCase() : dayName;

  useEffect(() => {
    if (!prefill) return;
    const v = prefill.perServing;
    setDraft({
      c: v.c !== undefined ? String(v.c) : '',
      p: v.p !== undefined ? String(v.p) : '',
      f: v.f !== undefined ? String(v.f) : '',
    });
    setMissing((['c', 'p', 'f'] as MacroKey[]).filter((k) => v[k] === undefined));
    setServings(String(prefill.servings && prefill.servings > 0 ? prefill.servings : 1));
    // A typed name is kept unless the source has one of its own.
    if (prefill.name) setName(prefill.name);
    setServingSize(prefill.servingSize);
    setSourceKcal(prefill.kcal);
    setAdded(null);
    // Applied once per prefillId, by design.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillId]);

  const clearForm = () => {
    setDraft(EMPTY_MACRO_DRAFT);
    setMissing([]);
    setServings('1');
    setName('');
    setServingSize(undefined);
    setSourceKcal(undefined);
    setSaveToFoods(false);
  };

  const perServing = readDraft(draft);
  const servingCount = parseMacroInput(servings);
  const total = scale(perServing, servingCount);
  const hasMacros = perServing.c + perServing.p + perServing.f > 0;
  const needsName = saveToFoods && !name.trim();
  const canAdd = hasMacros && servingCount > 0 && !needsName;
  const disagree =
    sourceKcal !== undefined && hasMacros && caloriesDisagree(sourceKcal, calories(perServing));

  const handleAdd = () => {
    if (!canAdd) return;
    const trimmed = name.trim();
    onAdd(day, total, trimmed ? servingsName(trimmed, servingCount) : undefined);
    if (saveToFoods && trimmed) {
      foods.saveFood({ name: trimmed, ...perServing, serving: servingSize });
    }
    setAdded(`Added ${describe(total)} to ${dayPhrase}.`);
    buzzSuccess();
    clearForm();
    onAdded?.();
  };

  return (
    <>
      <View style={[styles.dayNav, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Pressable
          onPress={() => setDaysBack((d) => d + 1)}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Previous day"
        >
          <Ionicons name="chevron-back" size={20} color={c.text} />
        </Pressable>
        <View style={styles.dayLabelWrap}>
          <Text style={[styles.eyebrow, { color: c.muted }]}>ADDING TO</Text>
          <Text style={[styles.dayLabel, { color: c.text }]}>{dayName}</Text>
        </View>
        <Pressable
          onPress={() => setDaysBack((d) => Math.max(d - 1, 0))}
          disabled={daysBack === 0}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Next day"
        >
          <Ionicons name="chevron-forward" size={20} color={daysBack === 0 ? c.faint : c.text} />
        </Pressable>
      </View>

      {top}

      {added ? (
        <View style={styles.added}>
          <Ionicons name="checkmark-circle" size={16} color={c.macro.p} />
          <Text style={[styles.addedText, { color: c.muted }]}>{added}</Text>
        </View>
      ) : null}

      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Text style={[styles.eyebrow, styles.sectionLabel, { color: c.muted }]}>
          PER SERVING{servingSize ? ` · ${servingSize.toUpperCase()}` : ''}
        </Text>
        <MacroInputs
          draft={draft}
          onChange={(next) => {
            setDraft(next);
            setAdded(null);
          }}
          labelPrefix="Per serving"
          missing={missing}
        />
        {missing.length ? (
          <Text style={[styles.hint, { color: c.macro.c }]}>
            Couldn&apos;t find {listMissing(missing)} on the {sourceNoun} — type{' '}
            {missing.length === 1 ? 'it' : 'them'} in.
          </Text>
        ) : null}
        {disagree ? (
          <Text style={[styles.hint, { color: c.macro.c }]}>
            The {sourceNoun} says {formatNumber(sourceKcal!)} kcal a serving, but these come to{' '}
            {formatNumber(calories(perServing))}. Check the numbers.
          </Text>
        ) : null}

        <Text style={[styles.eyebrow, styles.sectionLabel, styles.spaced, { color: c.muted }]}>
          HOW MUCH
        </Text>
        <ServingsInput value={servings} onChange={setServings} />

        <View style={[styles.divider, { backgroundColor: c.border }]} />

        <View style={styles.totalRow}>
          <Text style={[styles.totalMacros, { color: c.text }]}>
            <Text style={{ color: c.macro.c }}>{formatGrams(total.c)}C</Text>{'  '}
            <Text style={{ color: c.macro.p }}>{formatGrams(total.p)}P</Text>{'  '}
            <Text style={{ color: c.macro.f }}>{formatGrams(total.f)}F</Text>
          </Text>
          <Text style={[styles.totalKcal, { color: c.text }]}>
            {formatNumber(calories(total))}
            <Text style={[styles.unit, { color: c.faint }]}> kcal</Text>
          </Text>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={saveToFoods ? 'Name' : 'Name (optional)'}
          placeholderTextColor={c.faint}
          selectionColor={c.text}
          maxLength={MAX_NAME}
          returnKeyType="done"
          accessibilityLabel="Food name"
          style={[
            styles.nameInput,
            {
              color: c.text,
              backgroundColor: c.surfaceAlt,
              borderColor: needsName ? c.macro.c : c.border,
            },
          ]}
        />
        <View style={styles.switchRow}>
          <Text style={[styles.switchLabel, { color: c.text }]}>Save to my foods</Text>
          <Switch
            value={saveToFoods}
            onValueChange={setSaveToFoods}
            accessibilityLabel="Save to my foods"
          />
        </View>
        {needsName ? (
          <Text style={[styles.hint, { color: c.macro.c }]}>Give it a name to save it.</Text>
        ) : null}
      </View>

      <Pressable
        onPress={handleAdd}
        disabled={!canAdd}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.addButton,
          { backgroundColor: c.accent, opacity: !canAdd ? 0.3 : pressed ? 0.75 : 1 },
        ]}
      >
        <Ionicons name="add" size={22} color={c.onAccent} />
        <Text style={[styles.addLabel, { color: c.onAccent }]}>Add to {dayPhrase}</Text>
      </Pressable>
    </>
  );
}

const MACRO_NAMES: Record<MacroKey, string> = { c: 'carbs', p: 'protein', f: 'fat' };

function listMissing(keys: MacroKey[]): string {
  const names = keys.map((k) => MACRO_NAMES[k]);
  return names.length <= 1
    ? names.join('')
    : `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`;
}

/** Shared by the pages built on this form, so their own cards match it. */
export const entryStyles = StyleSheet.create({
  card: {
    marginTop: 14,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  hint: { fontSize: 12, fontWeight: '500', lineHeight: 17, marginTop: 8 },
  hintTop: { marginTop: 0, marginBottom: 12 },
  eyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },
});

const styles = StyleSheet.create({
  ...entryStyles,
  dayNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  dayLabelWrap: { alignItems: 'center' },
  dayLabel: { fontSize: 16, fontWeight: '700', marginTop: 2 },
  sectionLabel: { marginBottom: 8 },
  spaced: { marginTop: 16 },
  added: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingHorizontal: 4 },
  addedText: { fontSize: 13, fontWeight: '600', flex: 1 },
  divider: { height: StyleSheet.hairlineWidth, marginTop: 16, marginBottom: 12 },
  totalRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  totalMacros: { fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
  totalKcal: { fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] },
  unit: { fontSize: 12, fontWeight: '600' },
  nameInput: {
    height: 46,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: 12,
    fontSize: 16,
    fontWeight: '600',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  switchLabel: { fontSize: 15, fontWeight: '600' },
  addButton: {
    marginTop: 16,
    height: 54,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  addLabel: { fontSize: 16, fontWeight: '700' },
});
