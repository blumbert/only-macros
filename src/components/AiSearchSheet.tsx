import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { DayKey } from '../date';
import type { FoodsStore } from '../foods';
import { aiSearch, type AiReport } from '../premium/aiSearch';
import type { Totals } from '../storage';
import { useTheme } from '../theme';
import { entryStyles, FoodEntryForm, type Prefill } from './FoodEntryForm';
import { Sheet } from './Sheet';

type Props = {
  visible: boolean;
  onClose: () => void;
  today: DayKey;
  onAdd: (day: DayKey, values: Totals, name?: string) => void;
  foods: FoodsStore;
  /** Opens the paywall, when the subscription turns out to have lapsed. */
  onNeedPremium: () => void;
};

const BASIS: Record<AiReport['basis'], string> = {
  product_label: 'From the product’s own nutrition label',
  similar_products: 'Estimated from similar products',
  general_knowledge: 'Estimated from typical values',
};

const MAX_QUERY = 200;

/**
 * Premium: describe what you ate in your own words, and Claude works out the
 * macros, from the real label when it can find one. The answer fills the same
 * editable form as a scanned label, so a wrong guess is easy to fix.
 */
export function AiSearchSheet({ visible, onClose, today, onAdd, foods, onNeedPremium }: Props) {
  const { c } = useTheme();
  const [opened, setOpened] = useState(0);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<AiReport | null>(null);
  const [usage, setUsage] = useState<{ used: number; limit: number } | null>(null);
  const [prefill, setPrefill] = useState<Prefill | null>(null);
  const [prefillId, setPrefillId] = useState(0);
  // Only the latest search may land: a slow answer to an abandoned one mustn't
  // overwrite the form.
  const generation = useRef(0);

  const search = async () => {
    const q = query.trim();
    if (q.length < 2 || searching) return;
    const mine = ++generation.current;
    setSearching(true);
    setError(null);
    setReport(null);
    const result = await aiSearch(q);
    if (mine !== generation.current) return;
    setSearching(false);
    if (!result.ok) {
      setError(result.message);
      if (result.reason === 'not_subscribed') onNeedPremium();
      return;
    }
    const r = result.report;
    setReport(r);
    setUsage({ used: result.used, limit: result.limit });
    setPrefill({
      perServing: { c: r.per_serving.carbs_g, p: r.per_serving.protein_g, f: r.per_serving.fat_g },
      servings: r.servings,
      name: r.food_name,
      servingSize: r.serving_size,
      kcal: r.per_serving.calories || undefined,
    });
    setPrefillId((n) => n + 1);
  };

  // A fresh page every time the sheet opens. Keyed on `visible` rather than
  // the Modal's onShow, which react-native-web doesn't reliably fire.
  useEffect(() => {
    if (!visible) return;
    generation.current++;
    setOpened((n) => n + 1);
    setQuery('');
    setSearching(false);
    setError(null);
    setReport(null);
    setPrefill(null);
  }, [visible]);

  return (
    <Sheet visible={visible} onClose={onClose} title="Search with AI">
      <FoodEntryForm
        key={opened}
        today={today}
        foods={foods}
        onAdd={onAdd}
        prefill={prefill}
        prefillId={prefillId}
        sourceNoun="estimate"
        onAdded={() => {
          setReport(null);
          setQuery('');
        }}
        top={
          <View style={[entryStyles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={[entryStyles.hint, entryStyles.hintTop, { color: c.muted }]}>
              Describe what you had, with the brand and amount if you know them, e.g. &ldquo;half
              a quart of Hornstra Farms Cow Tracks ice cream&rdquo;.
            </Text>
            <View style={styles.searchRow}>
              <TextInput
                value={query}
                onChangeText={(t) => setQuery(t.slice(0, MAX_QUERY))}
                placeholder="What did you eat?"
                placeholderTextColor={c.faint}
                selectionColor={c.text}
                multiline
                blurOnSubmit
                returnKeyType="search"
                onSubmitEditing={() => void search()}
                accessibilityLabel="Describe what you ate"
                style={[
                  styles.input,
                  { color: c.text, backgroundColor: c.surfaceAlt, borderColor: c.border },
                ]}
              />
              <Pressable
                onPress={() => void search()}
                disabled={searching || query.trim().length < 2}
                accessibilityRole="button"
                accessibilityLabel="Search"
                style={({ pressed }) => [
                  styles.go,
                  {
                    backgroundColor: c.accent,
                    opacity: searching || query.trim().length < 2 ? 0.35 : pressed ? 0.75 : 1,
                  },
                ]}
              >
                <Ionicons name="sparkles" size={20} color={c.onAccent} />
              </Pressable>
            </View>

            {searching ? (
              <View style={styles.status}>
                <ActivityIndicator size="small" color={c.muted} />
                <Text style={[styles.statusText, { color: c.muted }]}>
                  Looking it up… this can take half a minute.
                </Text>
              </View>
            ) : error ? (
              <View style={styles.status}>
                <Ionicons name="alert-circle-outline" size={16} color={c.macro.c} />
                <Text style={[styles.statusText, { color: c.muted }]}>{error}</Text>
              </View>
            ) : report ? (
              <View style={styles.result}>
                <Text style={[styles.basis, { color: c.text }]}>{BASIS[report.basis]}</Text>
                <Text style={[styles.statusText, { color: c.muted }]}>{report.explanation}</Text>
                {report.sources.slice(0, 3).map((s) => (
                  <Text
                    key={s.url}
                    onPress={() => void Linking.openURL(s.url)}
                    accessibilityRole="link"
                    numberOfLines={1}
                    style={[styles.source, { color: c.muted }]}
                  >
                    {s.title || s.url}
                  </Text>
                ))}
                <Text style={[styles.check, { color: c.faint }]}>
                  An estimate — check it against the package when you have it.
                </Text>
              </View>
            ) : null}

            {usage ? (
              <Text style={[styles.usage, { color: c.faint }]}>
                {usage.used} of {usage.limit} AI searches used this month
              </Text>
            ) : null}
          </View>
        }
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  searchRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 46,
    maxHeight: 110,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 16,
    fontWeight: '500',
  },
  go: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  status: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: 12 },
  statusText: { flex: 1, fontSize: 13, fontWeight: '500', lineHeight: 18 },
  result: { marginTop: 12, gap: 4 },
  basis: { fontSize: 13, fontWeight: '700' },
  source: { fontSize: 12, fontWeight: '600', textDecorationLine: 'underline', marginTop: 2 },
  check: { fontSize: 11, fontWeight: '500', marginTop: 6 },
  usage: { fontSize: 11, fontWeight: '600', marginTop: 10 },
});
