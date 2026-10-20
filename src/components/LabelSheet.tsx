import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { addDays, describeDay, type DayKey } from '../date';
import { servingsName, type FoodsStore } from '../foods';
import { buzzSuccess } from '../haptics';
import { parseMacroInput } from '../macroInput';
import { caloriesDisagree, scale, type LabelReading } from '../nutrition/parseLabel';
import { canScanLabels, useLabelScan, type ScanSource } from '../nutrition/useLabelScan';
import { calories, MAX_NAME, type Totals } from '../storage';
import { formatGrams, formatNumber, useTheme, type MacroKey } from '../theme';
import { EMPTY_MACRO_DRAFT, MacroInputs, type MacroDraft } from './MacroInputs';
import { ScanButtons } from './ScanButtons';
import { ServingsInput } from './ServingsInput';

type Props = {
  visible: boolean;
  onClose: () => void;
  today: DayKey;
  onAdd: (day: DayKey, values: Totals, name?: string) => void;
  foods: FoodsStore;
};

const readDraft = (d: MacroDraft): Totals => ({
  c: parseMacroInput(d.c),
  p: parseMacroInput(d.p),
  f: parseMacroInput(d.f),
});

const describe = (t: Totals) => `${formatGrams(t.c)}C ${formatGrams(t.p)}P ${formatGrams(t.f)}F`;

/**
 * Scan a nutrition facts label, say how many servings, and add it to today
 * or any earlier day. The numbers it reads are always shown, editable, before
 * anything is added: a misread is easy to spot and fix there.
 */
export function LabelSheet({ visible, onClose, today, onAdd, foods }: Props) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { state, scan, reset } = useLabelScan();

  const [daysBack, setDaysBack] = useState(0);
  const [draft, setDraft] = useState<MacroDraft>(EMPTY_MACRO_DRAFT);
  const [missing, setMissing] = useState<MacroKey[]>([]);
  const [servings, setServings] = useState('1');
  const [name, setName] = useState('');
  const [servingSize, setServingSize] = useState<string | undefined>();
  const [labelKcal, setLabelKcal] = useState<number | undefined>();
  const [saveToFoods, setSaveToFoods] = useState(false);
  const [added, setAdded] = useState<string | null>(null);

  const day = addDays(today, -daysBack);
  const dayName = describeDay(day, today);
  // "Add to today", "Add to Mon, Oct 13".
  const dayPhrase = daysBack < 2 ? dayName.toLowerCase() : dayName;

  const clearForm = () => {
    setDraft(EMPTY_MACRO_DRAFT);
    setMissing([]);
    setServings('1');
    setName('');
    setServingSize(undefined);
    setLabelKcal(undefined);
    setSaveToFoods(false);
  };

  const onShow = () => {
    setDaysBack(0);
    clearForm();
    setAdded(null);
    reset();
  };

  const apply = (reading: LabelReading) => {
    setDraft({
      c: reading.c !== undefined ? String(reading.c) : '',
      p: reading.p !== undefined ? String(reading.p) : '',
      f: reading.f !== undefined ? String(reading.f) : '',
    });
    setMissing((['c', 'p', 'f'] as MacroKey[]).filter((k) => reading[k] === undefined));
    setServingSize(reading.servingSize);
    setLabelKcal(reading.kcal);
    setAdded(null);
  };

  const handleScan = async (source: ScanSource) => {
    const reading = await scan(source);
    if (reading) apply(reading);
  };

  const perServing = readDraft(draft);
  const servingCount = parseMacroInput(servings);
  const total = scale(perServing, servingCount);
  const hasMacros = perServing.c + perServing.p + perServing.f > 0;
  const needsName = saveToFoods && !name.trim();
  const canAdd = hasMacros && servingCount > 0 && !needsName;
  const disagree =
    labelKcal !== undefined && hasMacros && caloriesDisagree(labelKcal, calories(perServing));

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
    reset();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onShow={onShow}
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.sheet,
          { backgroundColor: c.bg, paddingTop: Platform.OS === 'android' ? insets.top : 0 },
        ]}
      >
        <View style={[styles.sheetHeader, { borderBottomColor: c.border }]}>
          <Text style={[styles.sheetTitle, { color: c.text }]}>Scan a label</Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button">
            <Text style={[styles.done, { color: c.text }]}>Done</Text>
          </Pressable>
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          >
            <View style={styles.content}>
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
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={daysBack === 0 ? c.faint : c.text}
                  />
                </Pressable>
              </View>

              <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
                {canScanLabels ? (
                  <>
                    <Text style={[styles.hint, styles.hintTop, { color: c.muted }]}>
                      Photograph the Nutrition Facts panel straight on, filling the frame. The
                      photo is read on your phone and isn&apos;t kept.
                    </Text>
                    <ScanButtons state={state} onScan={(s) => void handleScan(s)} />
                  </>
                ) : (
                  <Text style={[styles.hint, { color: c.muted }]}>
                    Reading labels from a photo needs the App Store version of Macros. You can
                    still type the label&apos;s numbers in below.
                  </Text>
                )}
                {added ? (
                  <View style={styles.added}>
                    <Ionicons name="checkmark-circle" size={16} color={c.macro.p} />
                    <Text style={[styles.addedText, { color: c.muted }]}>{added}</Text>
                  </View>
                ) : null}
              </View>

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
                    Couldn&apos;t find {listMissing(missing)} on the label — type{' '}
                    {missing.length === 1 ? 'it' : 'them'} in.
                  </Text>
                ) : null}
                {disagree ? (
                  <Text style={[styles.hint, { color: c.macro.c }]}>
                    The label says {formatNumber(labelKcal!)} kcal a serving, but these come to{' '}
                    {formatNumber(calories(perServing))}. Check the numbers against the label.
                  </Text>
                ) : null}

                <Text style={[styles.eyebrow, styles.sectionLabel, { color: c.muted }]}>
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
                  <Text style={[styles.hint, { color: c.macro.c }]}>
                    Give it a name to save it.
                  </Text>
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
                <Text style={[styles.addLabel, { color: c.onAccent }]}>
                  Add to {dayPhrase}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const MACRO_NAMES: Record<MacroKey, string> = { c: 'carbs', p: 'protein', f: 'fat' };

function listMissing(keys: MacroKey[]): string {
  const names = keys.map((k) => MACRO_NAMES[k]);
  return names.length <= 1
    ? names.join('')
    : `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`;
}

const styles = StyleSheet.create({
  sheet: { flex: 1 },
  flex: { flex: 1 },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetTitle: { fontSize: 18, fontWeight: '700' },
  done: { fontSize: 16, fontWeight: '600' },
  scroll: { paddingHorizontal: 16, paddingTop: 12 },
  content: { width: '100%', maxWidth: 560, alignSelf: 'center' },
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
  card: {
    marginTop: 14,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  eyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  sectionLabel: { marginBottom: 8 },
  hint: { fontSize: 12, fontWeight: '500', lineHeight: 17, marginTop: 8 },
  hintTop: { marginTop: 0, marginBottom: 12 },
  added: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
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
