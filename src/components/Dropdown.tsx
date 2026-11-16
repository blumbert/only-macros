import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme';

export type Option = { value: number; label: string };

const ROW = 32;
const MAX_ROWS = 7;

/**
 * A plain dropdown: a small box showing the value, and a short scrolling list
 * that opens under it. The list floats over whatever is below, so whatever
 * holds a dropdown needs a zIndex above the content that follows it.
 */
export function Dropdown({
  value,
  options,
  onChange,
  label,
  display,
  suffix,
  width = 56,
  compact = false,
}: {
  value: number;
  options: Option[];
  onChange: (value: number) => void;
  /** For screen readers, e.g. "Miles". */
  label: string;
  /** What the box shows, when it isn't the selected option's label. */
  display?: string;
  /** A unit shown in gray after the value, e.g. "min". */
  suffix?: string;
  width?: number;
  /** Small, to fit a grid column. */
  compact?: boolean;
}) {
  const { c } = useTheme();
  const [open, setOpen] = useState(false);
  const list = useRef<ScrollView>(null);
  const index = Math.max(
    options.findIndex((o) => o.value === value),
    0,
  );
  const shown = display ?? options.find((o) => o.value === value)?.label ?? String(value);

  return (
    <View style={[styles.wrap, { width, zIndex: open ? 100 : 1 }]}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${label}: ${shown}`}
        style={({ pressed }) => [
          styles.box,
          compact && styles.boxCompact,
          {
            borderColor: open ? c.text : c.border,
            backgroundColor: c.surfaceAlt,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <Text
          style={[styles.value, compact && styles.valueCompact, { color: c.text }]}
          numberOfLines={1}
          maxFontSizeMultiplier={1.2}
        >
          {shown}
        </Text>
        {suffix ? (
          <Text style={[styles.suffix, { color: c.faint }]} maxFontSizeMultiplier={1.2}>
            {suffix}
          </Text>
        ) : null}
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={compact ? 8 : 12} color={c.muted} />
      </Pressable>
      {open ? (
        <View
          style={[
            styles.list,
            compact && styles.listCompact,
            {
              minWidth: Math.max(width, compact ? 48 : 0),
              maxHeight: ROW * Math.min(options.length, MAX_ROWS),
              borderColor: c.border,
              backgroundColor: c.surface,
            },
          ]}
        >
          <ScrollView
            ref={list}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
            // Open with the current value in view.
            contentOffset={{ x: 0, y: Math.max(index - Math.floor(MAX_ROWS / 2), 0) * ROW }}
          >
            {options.map((o) => {
              const on = o.value === value;
              return (
                <Pressable
                  key={o.value}
                  onPress={() => {
                    setOpen(false);
                    if (!on) onChange(o.value);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${label} ${o.label}`}
                  style={({ pressed }) => [
                    styles.row,
                    { backgroundColor: on ? c.surfaceAlt : pressed ? c.surfaceAlt : 'transparent' },
                  ]}
                >
                  <Text
                    style={[styles.rowText, { color: c.text, fontWeight: on ? '800' : '600' }]}
                    maxFontSizeMultiplier={1.2}
                  >
                    {o.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

/** Whole numbers from `from` to `to`, as options. */
export function range(from: number, to: number, label: (n: number) => string = String): Option[] {
  return Array.from({ length: to - from + 1 }, (_, i) => ({ value: from + i, label: label(from + i) }));
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  box: {
    height: 34,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  boxCompact: { height: 26, borderRadius: 8, paddingHorizontal: 4, gap: 1, justifyContent: 'center' },
  valueCompact: { fontSize: 12 },
  // Pushed right, next to the arrow, with the value on the left.
  suffix: { marginLeft: 'auto', fontSize: 12, fontWeight: '600' },
  listCompact: { top: 30 },
  value: { flexShrink: 1, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  list: {
    position: 'absolute',
    top: 38,
    left: 0,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth * 2,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  row: { height: ROW, justifyContent: 'center', paddingHorizontal: 10 },
  rowText: { fontSize: 15, fontVariant: ['tabular-nums'] },
});
