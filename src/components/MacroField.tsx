import { forwardRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { useTheme } from '../theme';

type Props = {
  letter: string;
  name: string;
  color: string;
  value: string;
  onChangeText: (value: string) => void;
};

export const MacroField = forwardRef<TextInput, Props>(function MacroField(
  { letter, name, color, value, onChangeText },
  ref,
) {
  const { c } = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.card,
          {
            backgroundColor: c.surface,
            borderColor: focused ? color : c.border,
            borderWidth: focused ? 2 : StyleSheet.hairlineWidth * 2,
          },
        ]}
      >
        <Text style={[styles.letter, { color }]}>{letter}</Text>
        <TextInput
          ref={ref}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          keyboardType="decimal-pad"
          inputMode="decimal"
          placeholder="0"
          placeholderTextColor={c.faint}
          selectionColor={color}
          maxLength={6}
          returnKeyType="done"
          accessibilityLabel={`${name} in grams`}
          style={[styles.input, { color: c.text }]}
        />
        <Text style={[styles.unit, { color: c.faint }]}>grams</Text>
      </View>
    </View>
  );
});


const styles = StyleSheet.create({
  wrap: { flex: 1 },
  card: {
    borderRadius: 20,
    paddingTop: 12,
    paddingBottom: 10,
    alignItems: 'center',
  },
  letter: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  input: {
    width: '100%',
    fontSize: 34,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: 4,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  unit: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
});
