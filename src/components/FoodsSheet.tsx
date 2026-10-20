import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { confirmDestructive } from '../confirm';
import type { Food, FoodsStore } from '../foods';
import { parseMacroInput } from '../macroInput';
import { canScanLabels, useLabelScan, type ScanSource } from '../nutrition/useLabelScan';
import { calories, MAX_NAME } from '../storage';
import { formatGrams, formatNumber, MACROS, useTheme, type MacroKey } from '../theme';
import { EMPTY_MACRO_DRAFT, MacroInputs, toMacroDraft, type MacroDraft } from './MacroInputs';
import { ScanButtons } from './ScanButtons';

type Props = {
  visible: boolean;
  onClose: () => void;
  foods: FoodsStore;
};

/** Which food the form is open for: a new one, an existing one, or none. */
type Editing = { id: string | null } | null;

export function FoodsSheet({ visible, onClose, foods }: Props) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [editing, setEditing] = useState<Editing>(null);

  const editingFood = editing?.id ? foods.foods.find((f) => f.id === editing.id) : undefined;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onShow={() => setEditing(null)}
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.sheet,
          { backgroundColor: c.bg, paddingTop: Platform.OS === 'android' ? insets.top : 0 },
        ]}
      >
        <View style={[styles.sheetHeader, { borderBottomColor: c.border }]}>
          <Text style={[styles.sheetTitle, { color: c.text }]}>Saved foods</Text>
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
              {editing ? (
                <FoodForm
                  // A fresh form per food, so one food's half-typed edit never
                  // carries over to another.
                  key={editing.id ?? 'new'}
                  food={editingFood}
                  onSave={(draft) => {
                    foods.saveFood(draft, editing.id ?? undefined);
                    setEditing(null);
                  }}
                  onCancel={() => setEditing(null)}
                  onDelete={
                    editingFood
                      ? () =>
                          confirmDestructive({
                            title: `Delete ${editingFood.name}?`,
                            message: 'Entries already in your log stay as they are.',
                            confirmLabel: 'Delete',
                            onConfirm: () => {
                              foods.removeFood(editingFood.id);
                              setEditing(null);
                            },
                          })
                      : undefined
                  }
                />
              ) : (
                <Pressable
                  onPress={() => setEditing({ id: null })}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.addButton,
                    { backgroundColor: c.accent, opacity: pressed ? 0.75 : 1 },
                  ]}
                >
                  <Ionicons name="add" size={22} color={c.onAccent} />
                  <Text style={[styles.addLabel, { color: c.onAccent }]}>Add a food</Text>
                </Pressable>
              )}

              {foods.foods.length === 0 ? (
                editing ? null : (
                  <Text style={[styles.empty, { color: c.faint }]}>
                    No saved foods yet. Add one here, or switch on &ldquo;Save to my foods&rdquo;
                    when you scan a label. Saved foods can then be picked under the macro fields
                    on the main screen.
                  </Text>
                )
              ) : (
                <View style={[styles.list, { backgroundColor: c.surface, borderColor: c.border }]}>
                  {foods.foods.map((food, i) => (
                    <Pressable
                      key={food.id}
                      onPress={() => setEditing({ id: food.id })}
                      accessibilityRole="button"
                      accessibilityLabel={`Edit ${food.name}`}
                      style={({ pressed }) => [
                        styles.row,
                        i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
                        { opacity: pressed ? 0.6 : 1 },
                        editing?.id === food.id && { opacity: 0.4 },
                      ]}
                    >
                      <FoodRow food={food} />
                      <Ionicons name="chevron-forward" size={16} color={c.faint} />
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

/** Name, serving and macros of one saved food. Shared with the main screen's picker. */
export function FoodRow({ food }: { food: Food }) {
  const { c } = useTheme();
  return (
    <View style={styles.rowMain}>
      <View style={styles.rowTop}>
        <Text style={[styles.foodName, { color: c.text }]} numberOfLines={1}>
          {food.name}
        </Text>
        <Text style={[styles.foodKcal, { color: c.muted }]}>
          {formatNumber(calories(food))} kcal
        </Text>
      </View>
      <View style={styles.rowBottom}>
        {MACROS.map((m) => (
          <Text key={m.key} style={[styles.chip, { color: c.macro[m.key] }]}>
            {formatGrams(food[m.key])}
            {m.letter}
          </Text>
        ))}
        {food.serving ? (
          <Text style={[styles.serving, { color: c.faint }]} numberOfLines={1}>
            per {food.serving}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function FoodForm({
  food,
  onSave,
  onCancel,
  onDelete,
}: {
  food?: Food;
  onSave: (draft: { name: string; c: number; p: number; f: number; serving?: string }) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const { c } = useTheme();
  const { state, scan } = useLabelScan();
  const [name, setName] = useState(food?.name ?? '');
  const [draft, setDraft] = useState<MacroDraft>(food ? toMacroDraft(food) : EMPTY_MACRO_DRAFT);
  const [serving, setServing] = useState(food?.serving ?? '');
  const [missing, setMissing] = useState<MacroKey[]>([]);

  const handleScan = async (source: ScanSource) => {
    const reading = await scan(source);
    if (!reading) return;
    setDraft({
      c: reading.c !== undefined ? String(reading.c) : '',
      p: reading.p !== undefined ? String(reading.p) : '',
      f: reading.f !== undefined ? String(reading.f) : '',
    });
    setMissing((['c', 'p', 'f'] as MacroKey[]).filter((k) => reading[k] === undefined));
    if (reading.servingSize) setServing(reading.servingSize);
  };

  const values = {
    c: parseMacroInput(draft.c),
    p: parseMacroInput(draft.p),
    f: parseMacroInput(draft.f),
  };
  const canSave = !!name.trim() && values.c + values.p + values.f > 0;

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Text style={[styles.eyebrow, styles.sectionLabel, { color: c.muted }]}>
        {food ? 'EDIT FOOD' : 'NEW FOOD'}
      </Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Name"
        placeholderTextColor={c.faint}
        selectionColor={c.text}
        maxLength={MAX_NAME}
        autoFocus={!food && !canScanLabels}
        returnKeyType="done"
        accessibilityLabel="Food name"
        style={[styles.input, { color: c.text, backgroundColor: c.surfaceAlt, borderColor: c.border }]}
      />

      <Text style={[styles.eyebrow, styles.sectionLabel, styles.spaced, { color: c.muted }]}>
        PER SERVING
      </Text>
      <MacroInputs draft={draft} onChange={setDraft} labelPrefix="Per serving" missing={missing} />
      <TextInput
        value={serving}
        onChangeText={setServing}
        placeholder="Serving size (optional), e.g. 1 bar"
        placeholderTextColor={c.faint}
        selectionColor={c.text}
        maxLength={40}
        returnKeyType="done"
        accessibilityLabel="Serving size"
        style={[
          styles.input,
          styles.servingInput,
          { color: c.text, backgroundColor: c.surfaceAlt, borderColor: c.border },
        ]}
      />

      {canScanLabels ? (
        <>
          <Text style={[styles.eyebrow, styles.sectionLabel, styles.spaced, { color: c.muted }]}>
            FILL FROM A LABEL
          </Text>
          <ScanButtons state={state} onScan={(s) => void handleScan(s)} />
        </>
      ) : null}

      <View style={styles.formActions}>
        {onDelete ? (
          <Pressable onPress={onDelete} hitSlop={8} accessibilityRole="button" style={styles.deleteButton}>
            <Ionicons name="trash-outline" size={18} color={c.muted} />
            <Text style={[styles.deleteLabel, { color: c.muted }]}>Delete</Text>
          </Pressable>
        ) : (
          <View />
        )}
        <View style={styles.formButtons}>
          <Pressable
            onPress={onCancel}
            hitSlop={8}
            accessibilityRole="button"
            style={({ pressed }) => [styles.secondary, { borderColor: c.border, opacity: pressed ? 0.6 : 1 }]}
          >
            <Text style={[styles.secondaryLabel, { color: c.text }]}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={() => onSave({ name, ...values, serving })}
            disabled={!canSave}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.primary,
              { backgroundColor: c.accent, opacity: !canSave ? 0.3 : pressed ? 0.75 : 1 },
            ]}
          >
            <Text style={[styles.primaryLabel, { color: c.onAccent }]}>Save</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
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
  addButton: {
    height: 50,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  addLabel: { fontSize: 16, fontWeight: '700' },
  empty: { marginTop: 18, fontSize: 14, fontWeight: '500', lineHeight: 20, paddingHorizontal: 4 },
  list: {
    marginTop: 14,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: 16,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  rowMain: { flex: 1 },
  rowTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 },
  foodName: { fontSize: 16, fontWeight: '700', flexShrink: 1 },
  foodKcal: { fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  rowBottom: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 3 },
  chip: { fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  serving: { fontSize: 12, fontWeight: '500', flexShrink: 1 },
  card: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  eyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  sectionLabel: { marginBottom: 8 },
  spaced: { marginTop: 16 },
  input: {
    height: 46,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: 12,
    fontSize: 16,
    fontWeight: '600',
  },
  servingInput: { marginTop: 8, fontSize: 14, fontWeight: '500' },
  formActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
  },
  formButtons: { flexDirection: 'row', gap: 8 },
  deleteButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  deleteLabel: { fontSize: 14, fontWeight: '600' },
  secondary: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth * 2,
    justifyContent: 'center',
  },
  secondaryLabel: { fontSize: 15, fontWeight: '600' },
  primary: { height: 40, paddingHorizontal: 20, borderRadius: 12, justifyContent: 'center' },
  primaryLabel: { fontSize: 15, fontWeight: '700' },
});
