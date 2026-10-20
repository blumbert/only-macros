import { StyleSheet, Text, TextInput, View } from 'react-native';

import { sanitizeMacroInput } from '../macroInput';
import { MACROS, useTheme, type MacroKey } from '../theme';

export type MacroDraft = Record<MacroKey, string>;

export const EMPTY_MACRO_DRAFT: MacroDraft = { c: '', p: '', f: '' };

export const toMacroDraft = (t: { c: number; p: number; f: number }): MacroDraft => ({
  c: String(t.c),
  p: String(t.p),
  f: String(t.f),
});

type Props = {
  draft: MacroDraft;
  onChange: (next: MacroDraft) => void;
  /** Read out before each field, e.g. "Per serving". */
  labelPrefix: string;
  /** Fields to call out because the label scan couldn't find them. */
  missing?: MacroKey[];
};

/** Three small gram fields in a row, as on the calendar's day card. */
export function MacroInputs({ draft, onChange, labelPrefix, missing = [] }: Props) {
  const { c } = useTheme();
  return (
    <View style={styles.row}>
      {MACROS.map((m) => {
        const flagged = missing.includes(m.key) && !draft[m.key];
        return (
          <View
            key={m.key}
            style={[
              styles.field,
              {
                backgroundColor: c.surfaceAlt,
                borderColor: flagged ? c.macro[m.key] : c.border,
                borderWidth: flagged ? 1.5 : StyleSheet.hairlineWidth * 2,
              },
            ]}
          >
            <Text style={[styles.letter, { color: c.macro[m.key] }]}>{m.letter}</Text>
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
              style={[styles.input, { color: c.text }]}
            />
            <Text style={[styles.unit, { color: c.faint }]}>g</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  field: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 10,
    height: 46,
  },
  letter: { fontSize: 12, fontWeight: '800', marginRight: 6 },
  input: {
    flex: 1,
    // A web <input> has an intrinsic width and won't shrink in a row without this.
    minWidth: 0,
    fontSize: 17,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    padding: 0,
  },
  unit: { fontSize: 12, fontWeight: '600' },
});
