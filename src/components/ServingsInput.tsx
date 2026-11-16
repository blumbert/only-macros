import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { parseMacroInput, sanitizeServingsInput } from '../macroInput';
import { useTheme } from '../theme';

type Props = {
  /** As typed, so "1." can be on its way to "1.5". */
  value: string;
  onChange: (value: string) => void;
  /** Smaller, for sitting under the main screen's fields. */
  compact?: boolean;
};

const STEP = 0.5;

/** Servings, typed or stepped by halves. */
export function ServingsInput({ value, onChange, compact }: Props) {
  const { c } = useTheme();
  const n = parseMacroInput(value);
  const step = (dir: 1 | -1) => {
    // From an in-between amount like 1.25, a step lands on the next half.
    const next = dir > 0 ? Math.floor(n / STEP + 1e-9) * STEP + STEP : Math.ceil(n / STEP - 1e-9) * STEP - STEP;
    if (next <= 0 || next > 99) return;
    onChange(String(next));
  };
  const size = compact ? 30 : 38;

  return (
    <View style={styles.row}>
      <StepButton icon="remove" size={size} disabled={n <= STEP} onPress={() => step(-1)} label="One less serving" />
      <View
        style={[
          styles.field,
          // A fixed width: left to size itself, the field took the whole row
          // and pushed the food's name and the "servings" label out of view.
          { height: size, width: compact ? 52 : 64, backgroundColor: c.surfaceAlt, borderColor: c.border },
        ]}
      >
        <TextInput
          value={value}
          onChangeText={(v) => onChange(sanitizeServingsInput(v))}
          keyboardType="decimal-pad"
          inputMode="decimal"
          placeholder="1"
          placeholderTextColor={c.faint}
          selectionColor={c.text}
          maxLength={5}
          selectTextOnFocus
          accessibilityLabel="Servings"
          style={[styles.input, { color: c.text, fontSize: compact ? 15 : 17 }]}
        />
      </View>
      <StepButton icon="add" size={size} disabled={n + STEP > 99} onPress={() => step(1)} label="One more serving" />
      <Text style={[styles.unit, { color: c.faint, fontSize: compact ? 12 : 13 }]}>
        {n === 1 ? 'serving' : 'servings'}
      </Text>
    </View>
  );
}

function StepButton({
  icon,
  size,
  disabled,
  onPress,
  label,
}: {
  icon: 'add' | 'remove';
  size: number;
  disabled: boolean;
  onPress: () => void;
  label: string;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.step,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: c.surfaceAlt,
          borderColor: c.border,
          opacity: disabled ? 0.35 : pressed ? 0.6 : 1,
        },
      ]}
    >
      <Ionicons name={icon} size={size * 0.5} color={c.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  step: {
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  field: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth * 2,
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  input: {
    width: '100%',
    minWidth: 0,
    fontWeight: '700',
    textAlign: 'center',
    padding: 0,
    fontVariant: ['tabular-nums'],
  },
  unit: { fontWeight: '600', marginLeft: 2 },
});
