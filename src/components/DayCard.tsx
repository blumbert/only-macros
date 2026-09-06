import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { confirmDestructive } from '../confirm';
import { formatTime, longDate, type DayKey } from '../date';
import { parseMacroInput, sanitizeMacroInput } from '../macroInput';
import { calories, sumDay, type Entry, type Totals } from '../storage';
import { formatGrams, formatNumber, MACROS, useTheme, type MacroKey } from '../theme';

type Props = {
  day: DayKey;
  entries: Entry[];
  /** Future days can be looked at, but not logged against. */
  editable: boolean;
  onAdd: (values: Totals) => void;
  onDelete: (id: string) => void;
  onSetTotals: (values: Totals) => void;
};

type Draft = Record<MacroKey, string>;

const EMPTY_DRAFT: Draft = { c: '', p: '', f: '' };

const toDraft = (t: Totals): Draft => ({
  c: t.c ? String(t.c) : '',
  p: t.p ? String(t.p) : '',
  f: t.f ? String(t.f) : '',
});

const readDraft = (d: Draft): Totals => ({
  c: parseMacroInput(d.c),
  p: parseMacroInput(d.p),
  f: parseMacroInput(d.f),
});

const describe = (t: Totals) => `${formatGrams(t.c)}C ${formatGrams(t.p)}P ${formatGrams(t.f)}F`;

export function DayCard({ day, entries, editable, onAdd, onDelete, onSetTotals }: Props) {
  const { c } = useTheme();
  const [editing, setEditing] = useState(false);
  const [totalDraft, setTotalDraft] = useState<Draft>(EMPTY_DRAFT);
  const [addDraft, setAddDraft] = useState<Draft>(EMPTY_DRAFT);

  const totals = sumDay(entries);
  const kcal = calories(totals);
  const logged = entries.length > 0;

  // Moving to another day closes the editor rather than carrying a half-typed
  // draft over to a day it was never meant for.
  useEffect(() => {
    setEditing(false);
    setAddDraft(EMPTY_DRAFT);
  }, [day]);

  const openEditor = () => {
    setTotalDraft(toDraft(totals));
    setAddDraft(EMPTY_DRAFT);
    setEditing(true);
  };

  const sorted = [...entries].sort((a, b) => b.at - a.at);

  const handleAdd = () => {
    const values = readDraft(addDraft);
    if (values.c + values.p + values.f <= 0) return;
    onAdd(values);
    setAddDraft(EMPTY_DRAFT);
    // The total field is a draft, so it doesn't follow the log on its own.
    setTotalDraft(
      toDraft({ c: totals.c + values.c, p: totals.p + values.p, f: totals.f + values.f }),
    );
  };

  const handleDelete = (entry: Entry) => {
    confirmDestructive({
      title: 'Delete entry?',
      message: `${describe(entry)} at ${formatTime(entry.at)}`,
      confirmLabel: 'Delete',
      onConfirm: () => {
        onDelete(entry.id);
        setTotalDraft(
          toDraft({ c: totals.c - entry.c, p: totals.p - entry.p, f: totals.f - entry.f }),
        );
      },
    });
  };

  const handleSetTotals = () => {
    const values = readDraft(totalDraft);
    const empty = values.c + values.p + values.f <= 0;

    const apply = () => {
      onSetTotals(values);
      setTotalDraft(empty ? EMPTY_DRAFT : toDraft(values));
    };

    // A hand-typed total collapses the day into one figure, so anything that
    // would throw away individual rows asks first.
    if (entries.length > 1 || (empty && logged)) {
      confirmDestructive({
        title: empty ? 'Clear this day?' : 'Replace the entries?',
        message: empty
          ? `This removes ${entries.length === 1 ? 'the entry' : `all ${entries.length} entries`} for ${longDate(day)}.`
          : `${entries.length} entries become a single total of ${describe(values)}.`,
        confirmLabel: empty ? 'Clear' : 'Replace',
        onConfirm: apply,
      });
      return;
    }
    apply();
  };

  const draftTotals = readDraft(totalDraft);
  const totalChanged =
    draftTotals.c !== totals.c || draftTotals.p !== totals.p || draftTotals.f !== totals.f;
  const draftAdd = readDraft(addDraft);
  const canAdd = draftAdd.c + draftAdd.p + draftAdd.f > 0;

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={styles.header}>
        <Text style={[styles.date, { color: c.text }]}>{longDate(day)}</Text>
        {editable ? (
          <Pressable
            onPress={() => (editing ? setEditing(false) : openEditor())}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={editing ? 'Finish editing this day' : 'Edit this day'}
            style={({ pressed }) => [styles.headerButton, { opacity: pressed ? 0.6 : 1 }]}
          >
            {editing ? (
              <Text style={[styles.done, { color: c.text }]}>Done</Text>
            ) : (
              <Ionicons name="create-outline" size={20} color={c.muted} />
            )}
          </Pressable>
        ) : null}
      </View>

      {editing ? (
        <>
          <Text style={[styles.eyebrow, styles.sectionLabel, { color: c.muted }]}>DAILY TOTAL</Text>
          <MacroRow
            draft={totalDraft}
            onChange={setTotalDraft}
            labelPrefix="Total"
            action={
              <IconAction
                icon="checkmark-circle"
                color={totalChanged ? c.macro.p : c.faint}
                disabled={!totalChanged}
                label="Save daily total"
                onPress={handleSetTotals}
              />
            }
          />
          <Text style={[styles.hint, { color: c.faint }]}>
            Saving a total by hand replaces this day&apos;s entries.
          </Text>

          <View style={[styles.divider, { backgroundColor: c.border }]} />

          <Text style={[styles.eyebrow, styles.sectionLabel, { color: c.muted }]}>
            ADD TO THIS DAY
          </Text>
          <MacroRow
            draft={addDraft}
            onChange={setAddDraft}
            labelPrefix="Add"
            action={
              <IconAction
                icon="add-circle"
                color={canAdd ? c.macro.p : c.faint}
                disabled={!canAdd}
                label="Add these macros to this day"
                onPress={handleAdd}
              />
            }
          />

          <View style={[styles.divider, { backgroundColor: c.border }]} />

          <Text style={[styles.eyebrow, styles.sectionLabel, { color: c.muted }]}>ENTRIES</Text>
          {sorted.length === 0 ? (
            <Text style={[styles.empty, { color: c.faint }]}>Nothing logged</Text>
          ) : (
            sorted.map((entry, i) => (
              <View
                key={entry.id}
                style={[
                  styles.entryRow,
                  i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
                ]}
              >
                <Text style={[styles.entryTime, { color: c.faint }]}>{formatTime(entry.at)}</Text>
                <View style={styles.entryChips}>
                  {MACROS.map((m) => (
                    <Text key={m.key} style={[styles.entryChip, { color: c.macro[m.key] }]}>
                      {formatGrams(entry[m.key])}
                      {m.letter}
                    </Text>
                  ))}
                </View>
                <Pressable
                  onPress={() => handleDelete(entry)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete entry ${describe(entry)}`}
                  style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.6 : 1 }]}
                >
                  <Ionicons name="trash-outline" size={18} color={c.muted} />
                </Pressable>
              </View>
            ))
          )}
        </>
      ) : logged ? (
        <>
          <View style={styles.readRow}>
            {MACROS.map((m) => (
              <View key={m.key} style={styles.readCol}>
                <Text style={[styles.readLetter, { color: c.macro[m.key] }]}>{m.letter}</Text>
                <Text style={[styles.readValue, { color: c.text }]}>
                  {formatGrams(totals[m.key])}
                  <Text style={[styles.unit, { color: c.faint }]}>g</Text>
                </Text>
              </View>
            ))}
          </View>
          <View style={[styles.divider, { backgroundColor: c.border }]} />
          <View style={styles.calorieRow}>
            <Text style={[styles.eyebrow, { color: c.muted }]}>TOTAL CALORIES</Text>
            <Text style={[styles.kcal, { color: c.text }]}>
              {formatNumber(kcal)}
              <Text style={[styles.unit, { color: c.faint }]}> kcal</Text>
            </Text>
          </View>
        </>
      ) : (
        <Text style={[styles.empty, { color: c.faint }]}>Nothing logged</Text>
      )}
    </View>
  );
}

function MacroRow({
  draft,
  onChange,
  labelPrefix,
  action,
}: {
  draft: Draft;
  onChange: (next: Draft) => void;
  labelPrefix: string;
  action: React.ReactNode;
}) {
  const { c } = useTheme();
  return (
    <View style={styles.macroRow}>
      {MACROS.map((m) => (
        <View
          key={m.key}
          style={[styles.field, { backgroundColor: c.surfaceAlt, borderColor: c.border }]}
        >
          <Text style={[styles.fieldLetter, { color: c.macro[m.key] }]}>{m.letter}</Text>
          <TextInput
            value={draft[m.key]}
            onChangeText={(value) => onChange({ ...draft, [m.key]: sanitizeMacroInput(value) })}
            keyboardType="decimal-pad"
            inputMode="decimal"
            placeholder="0"
            placeholderTextColor={c.faint}
            selectionColor={c.macro[m.key]}
            maxLength={6}
            returnKeyType="done"
            accessibilityLabel={`${labelPrefix} ${m.name} in grams`}
            style={[styles.fieldInput, { color: c.text }]}
          />
        </View>
      ))}
      {action}
    </View>
  );
}

function IconAction({
  icon,
  color,
  disabled,
  label,
  onPress,
}: {
  icon: 'checkmark-circle' | 'add-circle';
  color: string;
  disabled: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Ionicons name={icon} size={26} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 18,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 24,
  },
  headerButton: { paddingLeft: 12 },
  date: { fontSize: 15, fontWeight: '700', flexShrink: 1 },
  done: { fontSize: 15, fontWeight: '700' },
  eyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  sectionLabel: { marginTop: 14, marginBottom: 8 },
  readRow: { flexDirection: 'row', marginTop: 12, marginBottom: 12 },
  readCol: { flex: 1, alignItems: 'center' },
  readLetter: { fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 2 },
  readValue: { fontSize: 20, fontWeight: '700', fontVariant: ['tabular-nums'] },
  unit: { fontSize: 12, fontWeight: '600' },
  divider: { height: StyleSheet.hairlineWidth, marginTop: 14 },
  calorieRow: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  kcal: { fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] },
  empty: { marginTop: 10, fontSize: 14, fontWeight: '500' },
  macroRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  field: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: 8,
    height: 42,
  },
  fieldLetter: { fontSize: 11, fontWeight: '800', marginRight: 4 },
  fieldInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    padding: 0,
  },
  hint: { marginTop: 8, fontSize: 11, fontWeight: '500' },
  iconButton: { padding: 4 },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  entryTime: { fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
  entryChips: { flexDirection: 'row', gap: 10, flexShrink: 1, marginLeft: 'auto' },
  entryChip: { fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
