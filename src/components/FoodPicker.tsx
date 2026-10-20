import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
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

import type { Food } from '../foods';
import { useTheme } from '../theme';
import { FoodRow } from './FoodsSheet';
import { ServingsInput } from './ServingsInput';

/** Search shows once the list is long enough to need it. */
const SEARCH_FROM = 8;

/**
 * The small saved-food line under the main screen's macro fields. Empty, it's
 * a single quiet button; with a food picked, it shows the food and how many
 * servings, and the fields above hold the grams for that many.
 */
export function SavedFoodBar({
  picked,
  servings,
  onOpen,
  onServingsChange,
  onClear,
}: {
  picked: Food | null;
  servings: string;
  onOpen: () => void;
  onServingsChange: (value: string) => void;
  onClear: () => void;
}) {
  const { c } = useTheme();

  if (!picked) {
    return (
      <Pressable
        onPress={onOpen}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Pick a saved food"
        style={({ pressed }) => [styles.pickButton, { opacity: pressed ? 0.6 : 1 }]}
      >
        <Ionicons name="bookmark-outline" size={15} color={c.muted} />
        <Text style={[styles.pickLabel, { color: c.muted }]}>Saved food</Text>
        <Ionicons name="chevron-down" size={13} color={c.faint} />
      </Pressable>
    );
  }

  return (
    <View style={styles.pickedRow}>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`${picked.name}. Pick a different saved food`}
        style={({ pressed }) => [
          styles.pickedName,
          { backgroundColor: c.surface, borderColor: c.border, opacity: pressed ? 0.6 : 1 },
        ]}
      >
        <Ionicons name="bookmark" size={13} color={c.muted} />
        <Text style={[styles.pickedText, { color: c.text }]} numberOfLines={1}>
          {picked.name}
        </Text>
        <Pressable
          onPress={onClear}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Clear saved food"
        >
          <Ionicons name="close-circle" size={17} color={c.faint} />
        </Pressable>
      </Pressable>
      <ServingsInput value={servings} onChange={onServingsChange} compact />
    </View>
  );
}

export function FoodPickerSheet({
  visible,
  onClose,
  foods,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  foods: Food[];
  onPick: (food: Food) => void;
}) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? foods.filter((f) => f.name.toLowerCase().includes(q)) : foods;
  }, [foods, query]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onShow={() => setQuery('')}
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.sheet,
          { backgroundColor: c.bg, paddingTop: Platform.OS === 'android' ? insets.top : 0 },
        ]}
      >
        <View style={[styles.sheetHeader, { borderBottomColor: c.border }]}>
          <Text style={[styles.sheetTitle, { color: c.text }]}>Pick a saved food</Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button">
            <Text style={[styles.done, { color: c.text }]}>Cancel</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View style={styles.content}>
            {foods.length >= SEARCH_FROM ? (
              <View style={[styles.search, { backgroundColor: c.surface, borderColor: c.border }]}>
                <Ionicons name="search" size={16} color={c.faint} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search"
                  placeholderTextColor={c.faint}
                  selectionColor={c.text}
                  autoCorrect={false}
                  returnKeyType="search"
                  accessibilityLabel="Search saved foods"
                  style={[styles.searchInput, { color: c.text }]}
                />
              </View>
            ) : null}

            {foods.length === 0 ? (
              <Text style={[styles.empty, { color: c.faint }]}>
                No saved foods yet. Add them from the menu (top right) under Saved foods, or
                switch on &ldquo;Save to my foods&rdquo; when you scan a label.
              </Text>
            ) : shown.length === 0 ? (
              <Text style={[styles.empty, { color: c.faint }]}>Nothing matches.</Text>
            ) : (
              <View style={[styles.list, { backgroundColor: c.surface, borderColor: c.border }]}>
                {shown.map((food, i) => (
                  <Pressable
                    key={food.id}
                    onPress={() => onPick(food)}
                    accessibilityRole="button"
                    accessibilityLabel={`Pick ${food.name}`}
                    style={({ pressed }) => [
                      styles.row,
                      i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
                      { opacity: pressed ? 0.6 : 1 },
                    ]}
                  >
                    <FoodRow food={food} />
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  pickButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  pickLabel: { fontSize: 14, fontWeight: '600' },
  pickedRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pickedName: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 34,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: 10,
  },
  pickedText: { flex: 1, fontSize: 14, fontWeight: '700' },
  sheet: { flex: 1 },
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
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  searchInput: { flex: 1, fontSize: 16, fontWeight: '500', padding: 0 },
  empty: { marginTop: 8, fontSize: 14, fontWeight: '500', lineHeight: 20, paddingHorizontal: 4 },
  list: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth * 2, paddingHorizontal: 16 },
  row: { paddingVertical: 12 },
});
