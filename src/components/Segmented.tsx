import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme';

type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  options: Option<T>[];
  value: T | null;
  onChange: (value: T) => void;
  /** Stacked full-width rows, for options too long to sit side by side. */
  vertical?: boolean;
  accessibilityLabel: string;
};

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  vertical,
  accessibilityLabel,
}: Props<T>) {
  const { c } = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={[vertical ? styles.column : styles.row]}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={({ pressed }) => [
              styles.option,
              vertical ? styles.optionVertical : styles.optionRow,
              {
                backgroundColor: selected ? c.accent : c.surfaceAlt,
                borderColor: selected ? c.accent : c.border,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Text
              style={[
                styles.label,
                vertical && styles.labelVertical,
                { color: selected ? c.onAccent : c.text },
              ]}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6 },
  column: { gap: 6 },
  option: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth * 2,
    justifyContent: 'center',
  },
  optionRow: { flex: 1, height: 40, alignItems: 'center', paddingHorizontal: 6 },
  optionVertical: { minHeight: 42, paddingHorizontal: 14, paddingVertical: 10 },
  label: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
  labelVertical: { textAlign: 'left' },
});
