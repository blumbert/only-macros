import { Ionicons } from '@expo/vector-icons';
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

import { AppMenu, type Anchor, type MenuItem } from './src/components/AppMenu';
import { CalendarSheet } from './src/components/CalendarSheet';
import { FoodPickerSheet, SavedFoodBar } from './src/components/FoodPicker';
import { FoodsSheet } from './src/components/FoodsSheet';
import { LabelSheet } from './src/components/LabelSheet';
import { MacroField } from './src/components/MacroField';
import { RecentEntries } from './src/components/RecentEntries';
import { RunnerSheet } from './src/components/RunnerSheet';
import { TotalsPanel } from './src/components/TotalsPanel';
import { describeDay, longDate, type DayKey } from './src/date';
import { servingsName, useFoods, type Food } from './src/foods';
import { buzzLight, buzzSuccess } from './src/haptics';
import { parseMacroInput, sanitizeMacroInput } from './src/macroInput';
import { scale } from './src/nutrition/parseLabel';
import { sumDay } from './src/storage';
import { formatGrams, MACROS, useTheme, type MacroKey } from './src/theme';
import { useLog } from './src/useLog';

type Draft = Record<MacroKey, string>;

const EMPTY_DRAFT: Draft = { c: '', p: '', f: '' };
const sanitize = sanitizeMacroInput;
const parse = parseMacroInput;

type Page = 'calendar' | 'runner' | 'label' | 'foods';

/** The grams for `servings` of a saved food, as the fields show them. */
const draftFor = (food: Food, servings: number): Draft => {
  const t = scale(food, servings);
  return { c: String(t.c), p: String(t.p), f: String(t.f) };
};

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
  const { log, today, add, addOn, setDayTotals, remove, update } = useLog();
  const foods = useFoods();

  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [page, setPage] = useState<Page | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<Anchor | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  // A saved food chosen under the fields. The fields then hold the grams for
  // `servings` of it; typing in a field yourself drops the food.
  const [picked, setPicked] = useState<{ food: Food; servings: string } | null>(null);
  const [lastAdd, setLastAdd] = useState<
    { day: DayKey; id: string; c: number; p: number; f: number } | null
  >(null);

  const menuButton = useRef<View>(null);
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
    const name = picked
      ? servingsName(picked.food.name, parse(picked.servings))
      : undefined;
    const { day, entry } = add(values.c, values.p, values.f, name);
    if (picked) foods.markUsed(picked.food.id);
    setDraft(EMPTY_DRAFT);
    setPicked(null);
    Keyboard.dismiss();
    setLastAdd({ day, id: entry.id, ...values });
    buzzSuccess();
  };

  const handleUndo = () => {
    if (!lastAdd) return;
    remove(lastAdd.day, lastAdd.id);
    setLastAdd(null);
    buzzLight();
  };

  const pickFood = (food: Food) => {
    setPickerOpen(false);
    setPicked({ food, servings: '1' });
    setDraft(draftFor(food, 1));
  };

  const changeServings = (servings: string) => {
    if (!picked) return;
    setPicked({ ...picked, servings });
    const n = parse(servings);
    // Mid-typing ("" or "0.") there's no amount yet; keep the last one showing.
    if (n > 0) setDraft(draftFor(picked.food, n));
  };

  const clearPicked = () => {
    setPicked(null);
    setDraft(EMPTY_DRAFT);
  };

  const openMenu = () => {
    Keyboard.dismiss();
    menuButton.current?.measureInWindow((x, y, width, height) =>
      setMenuAnchor({ x, y, width, height }),
    );
  };

  const menuItems: MenuItem[] = [
    { key: 'calendar', label: 'Calendar', icon: 'calendar-outline', onPress: () => setPage('calendar') },
    { key: 'label', label: 'Scan a label', icon: 'scan-outline', onPress: () => setPage('label') },
    { key: 'foods', label: 'Saved foods', icon: 'bookmark-outline', onPress: () => setPage('foods') },
    { key: 'runner', label: 'Runner fueling', icon: 'footsteps-outline', onPress: () => setPage('runner') },
  ];
  const closePage = () => setPage(null);

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
    // The menu is positioned in window coordinates, so it's drawn over this
    // full-screen view rather than inside the safe-area padding.
    <View style={[styles.root, { backgroundColor: c.bg }]}>
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          {/* Capped and centred so the fields stay thumb-sized on an iPad
              rather than stretching to a metre-wide row. */}
          <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={[styles.title, { color: c.text }]}>Macros</Text>
              <Text style={[styles.subtitle, { color: c.muted }]}>{longDate(today)}</Text>
            </View>
            <Pressable
              ref={menuButton}
              onPress={openMenu}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Menu"
              style={({ pressed }) => [
                styles.menuButton,
                { backgroundColor: c.surface, borderColor: c.border, opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Ionicons name="menu" size={22} color={c.text} />
            </Pressable>
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
                  onChangeText={(value) => {
                    setDraft((prev) => ({ ...prev, [m.key]: sanitize(value) }));
                    // Typed by hand, it's no longer that food's numbers.
                    if (picked) setPicked(null);
                  }}
                />
              </View>
            ))}
          </View>

          <View style={styles.savedFood}>
            <SavedFoodBar
              picked={picked?.food ?? null}
              servings={picked?.servings ?? '1'}
              onOpen={() => {
                Keyboard.dismiss();
                setPickerOpen(true);
              }}
              onServingsChange={changeServings}
              onClear={clearPicked}
            />
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

          <View style={styles.recent}>
            <RecentEntries
              entries={log[today] ?? []}
              onSave={(id, values) => update(today, id, values)}
              onDelete={(id) => remove(today, id)}
            />
          </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {lastAdd ? (
        <Animated.View
          pointerEvents="box-none"
          style={[styles.toastWrap, { bottom: insets.bottom + 20, opacity: toastOpacity }]}
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

      <CalendarSheet
        visible={page === 'calendar'}
        onClose={closePage}
        log={log}
        today={today}
        onAdd={addOn}
        onDelete={remove}
        onSetTotals={setDayTotals}
      />

      <RunnerSheet visible={page === 'runner'} onClose={closePage} log={log} today={today} />

      <LabelSheet
        visible={page === 'label'}
        onClose={closePage}
        today={today}
        onAdd={addOn}
        foods={foods}
      />

      <FoodsSheet visible={page === 'foods'} onClose={closePage} foods={foods} />

      <FoodPickerSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        foods={foods.foods}
        onPick={pickFood}
      />
    </SafeAreaView>

      <AppMenu anchor={menuAnchor} items={menuItems} onClose={() => setMenuAnchor(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 16, paddingTop: 8 },
  content: { width: '100%', maxWidth: 560, alignSelf: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingBottom: 18,
  },
  headerText: { flexShrink: 1 },
  title: { fontSize: 30, fontWeight: '800', letterSpacing: -0.6 },
  subtitle: { fontSize: 14, fontWeight: '600', marginTop: 2 },
  menuButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  fields: { flexDirection: 'row' },
  field: { flex: 1 },
  fieldGap: { marginRight: 10 },
  savedFood: { marginTop: 10 },
  addButton: {
    marginTop: 12,
    height: 54,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  addLabel: { fontSize: 16, fontWeight: '700' },
  totals: { marginTop: 22 },
  recent: { marginTop: 16 },
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
});
