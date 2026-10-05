import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { useTheme } from '../theme';

type Props = {
  /** Distance in the runner's own unit. */
  value: number;
  unit: string;
  /** Fires as the wheel turns, so the numbers beside it can follow along. */
  onPreview: (value: number | null) => void;
  /** Fires once the wheel settles on a value other than `value`. */
  onCommit: (value: number) => void;
};

const STEP = 0.1;
const ROW = 34;
/** Rows in view: the selected one and one either side. */
const VISIBLE = 3;
/** How long the wheel has to sit still before the value counts as chosen. */
const SETTLE_MS = 250;
/** Far enough for an ultra; a value past it stretches the wheel to fit. */
const MAX: Record<string, number> = { mi: 50, km: 80 };

const toIndex = (v: number) => Math.max(Math.round(v / STEP), 0);
const label = (i: number) => (i * STEP).toFixed(1);

function buzz() {
  try {
    Haptics.selectionAsync().catch(() => {});
  } catch {
    // no haptics on this device
  }
}

/**
 * A picker wheel in tenths of a mile (or km). It's a plain FlatList snapping
 * to rows, padded with a blank row at each end so the first and last values
 * can sit in the middle. Row `i` of the data is value `i - 1`, which makes the
 * scroll offset of value `i` simply `i * ROW`.
 */
export function MileageWheel({ value, unit, onPreview, onCommit }: Props) {
  const { c } = useTheme();
  const list = useRef<FlatList<number>>(null);
  const valueIndex = toIndex(value);
  const count = Math.max(toIndex(MAX[unit] ?? 50), valueIndex + toIndex(10)) + 1;
  const data = useMemo(() => Array.from({ length: count + 2 }, (_, i) => i - 1), [count]);

  const [centre, setCentre] = useState(valueIndex);
  const centreRef = useRef(valueIndex);
  const valueRef = useRef(valueIndex);
  valueRef.current = valueIndex;
  // While the wheel is being moved to `value` from outside (a reset, or the
  // week's plan changing), its scroll events aren't the runner choosing.
  const target = useRef<number | null>(null);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (settle.current) clearTimeout(settle.current);
  }, []);

  useEffect(() => {
    if (centreRef.current === valueIndex) return;
    target.current = valueIndex;
    centreRef.current = valueIndex;
    setCentre(valueIndex);
    list.current?.scrollToOffset({ offset: valueIndex * ROW, animated: true });
  }, [valueIndex]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const i = Math.min(Math.max(Math.round(y / ROW), 0), count - 1);
    if (target.current !== null) {
      if (i === target.current) target.current = null;
      return;
    }
    if (i !== centreRef.current) {
      centreRef.current = i;
      setCentre(i);
      onPreview(i * STEP);
      buzz();
    }
    if (settle.current) clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      const chosen = centreRef.current;
      // Snapping is native on iOS and Android; this catches anywhere it isn't.
      if (Math.abs(y - chosen * ROW) > 1) {
        list.current?.scrollToOffset({ offset: chosen * ROW, animated: true });
      }
      onPreview(null);
      if (chosen !== valueRef.current) onCommit(Math.round(chosen * STEP * 10) / 10);
    }, SETTLE_MS);
  };

  return (
    <View style={[styles.wrap, { height: ROW * VISIBLE }]}>
      <View
        pointerEvents="none"
        style={[styles.band, { top: ROW, height: ROW, borderColor: c.border }]}
      />
      <FlatList
        ref={list}
        data={data}
        keyExtractor={(i) => String(i)}
        renderItem={({ item }) => (
          <View style={styles.row}>
            {item >= 0 && item < count ? (
              <Text
                style={[
                  styles.num,
                  { color: item === centre ? c.text : c.faint, opacity: item === centre ? 1 : 0.6 },
                ]}
              >
                {label(item)}
              </Text>
            ) : null}
          </View>
        )}
        extraData={centre}
        getItemLayout={(_, index) => ({ length: ROW, offset: ROW * index, index })}
        initialScrollIndex={valueIndex}
        initialNumToRender={VISIBLE + 2}
        windowSize={5}
        snapToInterval={ROW}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
        scrollEventThrottle={16}
        onScroll={onScroll}
        nestedScrollEnabled
        accessibilityRole="adjustable"
        accessibilityLabel={`Distance, ${label(centre)} ${unit}`}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => {
          const next = centreRef.current + (e.nativeEvent.actionName === 'increment' ? 1 : -1);
          if (next < 0 || next >= count) return;
          onCommit(Math.round(next * STEP * 10) / 10);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: 76, overflow: 'hidden' },
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
  },
  row: { height: ROW, alignItems: 'center', justifyContent: 'center' },
  num: { fontSize: 22, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
