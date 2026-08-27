import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  initialWindowMetrics,
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { CalendarSheet } from './src/components/CalendarSheet';
import { MacroField } from './src/components/MacroField';
import { TotalsPanel } from './src/components/TotalsPanel';
import { describeDay, longDate, type DayKey } from './src/date';
import { sumDay } from './src/storage';
import { formatGrams, MACROS, useTheme, type MacroKey } from './src/theme';
import { useLog } from './src/useLog';

type Draft = Record<MacroKey, string>;

const EMPTY_DRAFT: Draft = { c: '', p: '', f: '' };

/** Keeps a field to digits with at most one decimal point and one decimal place. */
function sanitize(raw: string): string {
  const cleaned = raw.replace(/[^0-9.]/g, '');
  const dot = cleaned.indexOf('.');
  if (dot === -1) return cleaned.slice(0, 4);
  const whole = cleaned.slice(0, dot).slice(0, 4);
  const frac = cleaned.slice(dot + 1).replace(/\./g, '').slice(0, 1);
  return whole + '.' + frac;
}

function parse(value: string): number {
  const n = parseFloat(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Haptics are best-effort. iPads have no Taptic Engine, and these calls are
 * fire-and-forget, so a rejection here would surface as an unhandled promise
 * rejection rather than anything the user could act on.
 */
function buzz(run: () => Promise<void>) {
  try {
    run().catch(() => {});
  } catch {
    // module unavailable on this device
  }
}

export default function App() {
  // initialMetrics matters: without it SafeAreaProvider renders *null* until
  // the native side reports insets back, so anything that delays or drops that
  // callback leaves the user staring at an empty screen.
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <Screen />
    </SafeAreaProvider>
  );
}

function Screen() {
  const { c, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { log, today, add, remove } = useLog();

  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [lastAdd, setLastAdd] = useState<
    { day: DayKey; id: string; c: number; p: number; f: number } | null
  >(null);

  const carbRef = useRef<TextInput>(null);
  const proteinRef = useRef<TextInput>(null);
  const fatRef = useRef<TextInput>(null);
  const refs: Record<MacroKey, React.RefObject<TextInput | null>> = {
    c: carbRef,
    p: proteinRef,
    f: fatRef,
  };

  const totals = useMemo(() => sumDay(log[today]), [log, today]);
  const canAdd = parse(draft.c) + parse(draft.p) + parse(draft.f) > 0;

  const handleAdd = () => {
    if (!canAdd) return;
    const values = { c: parse(draft.c), p: parse(draft.p), f: parse(draft.f) };
    const { day, entry } = add(values.c, values.p, values.f);
    setDraft(EMPTY_DRAFT);
    Keyboard.dismiss();
    setLastAdd({ day, id: entry.id, ...values });
    buzz(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
  };

  const handleUndo = () => {
    if (!lastAdd) return;
    remove(lastAdd.day, lastAdd.id);
    setLastAdd(null);
    buzz(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
  };

  // Undo pill: fades in on an add, then fades itself back out a few seconds later.
  const toastOpacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!lastAdd) {
      toastOpacity.setValue(0);
      return;
    }
    const current = lastAdd;
    Animated.timing(toastOpacity, {
      toValue: 1,
      duration: 160,
      useNativeDriver: true,
    }).start();
    const timer = setTimeout(() => {
      Animated.timing(toastOpacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setLastAdd((prev) => (prev === current ? null : prev));
      });
    }, 4200);
    return () => clearTimeout(timer);
  }, [lastAdd, toastOpacity]);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.bg }]} edges={['top', 'left', 'right']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 110 }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          {/* Capped and centred so the fields stay thumb-sized on an iPad
              rather than stretching to a metre-wide row. */}
          <View style={styles.content}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: c.text }]}>Macros</Text>
            <Text style={[styles.subtitle, { color: c.muted }]}>{longDate(today)}</Text>
          </View>

          <View style={styles.fields}>
            {MACROS.map((m, i) => (
              <View key={m.key} style={[styles.field, i < MACROS.length - 1 && styles.fieldGap]}>
                <MacroField
                  ref={refs[m.key]}
                  letter={m.letter}
                  name={m.name}
                  color={c.macro[m.key]}
                  value={draft[m.key]}
                  onChangeText={(value) =>
                    setDraft((prev) => ({ ...prev, [m.key]: sanitize(value) }))
                  }
                />
              </View>
            ))}
          </View>

          <Pressable
            onPress={handleAdd}
            disabled={!canAdd}
            accessibilityRole="button"
            accessibilityLabel="Add to daily totals"
            style={({ pressed }) => [
              styles.addButton,
              { backgroundColor: c.accent, opacity: !canAdd ? 0.3 : pressed ? 0.75 : 1 },
            ]}
          >
            <Ionicons name="add" size={22} color={c.onAccent} />
            <Text style={[styles.addLabel, { color: c.onAccent }]}>Add to today</Text>
          </Pressable>

          <View style={styles.totals}>
            <TotalsPanel totals={totals} dayLabel={describeDay(today, today)} />
          </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {lastAdd ? (
        <Animated.View
          pointerEvents="box-none"
          style={[styles.toastWrap, { bottom: insets.bottom + 96, opacity: toastOpacity }]}
        >
          <View style={[styles.toast, { backgroundColor: c.surfaceAlt, borderColor: c.border }]}>
            <Text style={[styles.toastText, { color: c.muted }]}>
              Added{' '}
              <Text style={{ color: c.macro.c, fontWeight: '700' }}>{formatGrams(lastAdd.c)}C</Text>{' '}
              <Text style={{ color: c.macro.p, fontWeight: '700' }}>{formatGrams(lastAdd.p)}P</Text>{' '}
              <Text style={{ color: c.macro.f, fontWeight: '700' }}>{formatGrams(lastAdd.f)}F</Text>
            </Text>
            <Pressable onPress={handleUndo} hitSlop={10} accessibilityRole="button">
              <Text style={[styles.toastUndo, { color: c.text }]}>Undo</Text>
            </Pressable>
          </View>
        </Animated.View>
      ) : null}

      <Pressable
        onPress={() => {
          Keyboard.dismiss();
          setCalendarOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel="Open calendar"
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: c.accent, bottom: insets.bottom + 20, opacity: pressed ? 0.75 : 1 },
        ]}
      >
        <Ionicons name="calendar-outline" size={24} color={c.onAccent} />
      </Pressable>

      <CalendarSheet
        visible={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        log={log}
        today={today}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 16, paddingTop: 8 },
  content: { width: '100%', maxWidth: 560, alignSelf: 'center' },
  header: { paddingHorizontal: 4, paddingBottom: 18 },
  title: { fontSize: 30, fontWeight: '800', letterSpacing: -0.6 },
  subtitle: { fontSize: 14, fontWeight: '600', marginTop: 2 },
  fields: { flexDirection: 'row' },
  field: { flex: 1 },
  fieldGap: { marginRight: 10 },
  addButton: {
    marginTop: 14,
    height: 54,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  addLabel: { fontSize: 16, fontWeight: '700' },
  totals: { marginTop: 22 },
  toastWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  toastText: { fontSize: 13, fontWeight: '600' },
  toastUndo: { fontSize: 13, fontWeight: '800' },
  fab: {
    position: 'absolute',
    right: 20,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
});
