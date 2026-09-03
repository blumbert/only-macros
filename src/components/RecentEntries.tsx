import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { formatTime } from '../date';
import { parseMacroInput, sanitizeMacroInput } from '../macroInput';
import type { Entry } from '../storage';
import { formatGrams, MACROS, useTheme, type MacroKey } from '../theme';

type Props = {
  entries: Entry[];
  onSave: (id: string, values: { c: number; p: number; f: number }) => void;
  onDelete: (id: string) => void;
};

type Draft = Record<MacroKey, string>;

const toDraft = (e: Entry): Draft => ({
  c: e.c ? String(e.c) : '',
  p: e.p ? String(e.p) : '',
  f: e.f ? String(e.f) : '',
});

export function RecentEntries({ entries, onSave, onDelete }: Props) {
  const { c } = useTheme();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>({ c: '', p: '', f: '' });

  const sorted = [...entries].sort((a, b) => b.at - a.at);

  const startEdit = (entry: Entry) => {
    setEditingId(entry.id);
    setDraft(toDraft(entry));
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = (id: string) => {
    const values = {
      c: parseMacroInput(draft.c),
      p: parseMacroInput(draft.p),
      f: parseMacroInput(draft.f),
    };
    if (values.c + values.p + values.f <= 0) return;
    onSave(id, values);
    setEditingId(null);
  };

  const confirmDelete = (entry: Entry) => {
    if (editingId === entry.id) setEditingId(null);
    Alert.alert(
      'Delete entry?',
      `${formatGrams(entry.c)}C ${formatGrams(entry.p)}P ${formatGrams(entry.f)}F at ${formatTime(entry.at)}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => onDelete(entry.id) },
      ],
    );
  };

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Text style={[styles.eyebrow, { color: c.muted }]}>RECENT ENTRIES</Text>

      {sorted.length === 0 ? (
        <Text style={[styles.empty, { color: c.faint }]}>Nothing logged yet today</Text>
      ) : (
        <View style={styles.list}>
          {sorted.map((entry, i) => (
            <View
              key={entry.id}
              style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }]}
            >
              {editingId === entry.id ? (
                <View style={styles.editRow}>
                  {MACROS.map((m) => (
                    <View
                      key={m.key}
                      style={[styles.editField, { backgroundColor: c.surfaceAlt, borderColor: c.border }]}
                    >
                      <Text style={[styles.editLetter, { color: c.macro[m.key] }]}>{m.letter}</Text>
                      <TextInput
                        value={draft[m.key]}
                        onChangeText={(value) =>
                          setDraft((prev) => ({ ...prev, [m.key]: sanitizeMacroInput(value) }))
                        }
                        keyboardType="decimal-pad"
                        inputMode="decimal"
                        placeholder="0"
                        placeholderTextColor={c.faint}
                        selectionColor={c.macro[m.key]}
                        maxLength={6}
                        returnKeyType="done"
                        accessibilityLabel={`Edit ${m.name} in grams`}
                        style={[styles.editInput, { color: c.text }]}
                      />
                    </View>
                  ))}
                  <Pressable
                    onPress={() => saveEdit(entry.id)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Save entry"
                    style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.6 : 1 }]}
                  >
                    <Ionicons name="checkmark-circle" size={24} color={c.macro.p} />
                  </Pressable>
                  <Pressable
                    onPress={cancelEdit}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Cancel editing"
                    style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.6 : 1 }]}
                  >
                    <Ionicons name="close-circle" size={24} color={c.faint} />
                  </Pressable>
                </View>
              ) : (
                <>
                  <View style={styles.rowMain}>
                    <Text style={[styles.time, { color: c.faint }]}>{formatTime(entry.at)}</Text>
                    <View style={styles.chips}>
                      <Text style={[styles.chip, { color: c.macro.c }]}>{formatGrams(entry.c)}C</Text>
                      <Text style={[styles.chip, { color: c.macro.p }]}>{formatGrams(entry.p)}P</Text>
                      <Text style={[styles.chip, { color: c.macro.f }]}>{formatGrams(entry.f)}F</Text>
                    </View>
                  </View>
                  <View style={styles.actions}>
                    <Pressable
                      onPress={() => startEdit(entry)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel="Edit entry"
                      style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.6 : 1 }]}
                    >
                      <Ionicons name="pencil-outline" size={18} color={c.muted} />
                    </Pressable>
                    <Pressable
                      onPress={() => confirmDelete(entry)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel="Delete entry"
                      style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.6 : 1 }]}
                    >
                      <Ionicons name="trash-outline" size={18} color={c.muted} />
                    </Pressable>
                  </View>
                </>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 6,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  empty: {
    marginTop: 14,
    marginBottom: 10,
    fontSize: 14,
    fontWeight: '500',
  },
  list: { marginTop: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  rowMain: { flexDirection: 'row', alignItems: 'baseline', gap: 12, flexShrink: 1 },
  time: { fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
  chips: { flexDirection: 'row', gap: 10 },
  chip: { fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  actions: { flexDirection: 'row', gap: 4 },
  iconButton: { padding: 4 },
  editRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: 8,
    height: 40,
  },
  editLetter: { fontSize: 11, fontWeight: '800', marginRight: 4 },
  editInput: { flex: 1, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'], padding: 0 },
});
