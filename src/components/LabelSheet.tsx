import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import type { DayKey } from '../date';
import type { FoodsStore } from '../foods';
import { canScanLabels, useLabelScan, type ScanSource } from '../nutrition/useLabelScan';
import type { Totals } from '../storage';
import { useTheme } from '../theme';
import { entryStyles, FoodEntryForm, type Prefill } from './FoodEntryForm';
import { ScanButtons } from './ScanButtons';
import { Sheet } from './Sheet';

type Props = {
  visible: boolean;
  onClose: () => void;
  today: DayKey;
  onAdd: (day: DayKey, values: Totals, name?: string) => void;
  foods: FoodsStore;
};

/**
 * Scan a nutrition facts label, say how many servings, and add it to today
 * or any earlier day.
 */
export function LabelSheet({ visible, onClose, today, onAdd, foods }: Props) {
  const { c } = useTheme();
  const { state, scan, reset } = useLabelScan();
  const [opened, setOpened] = useState(0);
  const [prefill, setPrefill] = useState<Prefill | null>(null);
  const [prefillId, setPrefillId] = useState(0);

  const handleScan = async (source: ScanSource) => {
    const reading = await scan(source);
    if (!reading) return;
    setPrefill({
      perServing: { c: reading.c, p: reading.p, f: reading.f },
      servingSize: reading.servingSize,
      kcal: reading.kcal,
    });
    setPrefillId((n) => n + 1);
  };

  // A fresh form every time the sheet opens. Keyed on `visible` rather than
  // the Modal's onShow, which react-native-web doesn't reliably fire.
  useEffect(() => {
    if (!visible) return;
    setOpened((n) => n + 1);
    setPrefill(null);
    reset();
  }, [visible, reset]);

  return (
    <Sheet visible={visible} onClose={onClose} title="Scan a label">
      <FoodEntryForm
        key={opened}
        today={today}
        foods={foods}
        onAdd={onAdd}
        prefill={prefill}
        prefillId={prefillId}
        sourceNoun="label"
        onAdded={reset}
        top={
          <View style={[entryStyles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            {canScanLabels ? (
              <>
                <Text style={[entryStyles.hint, entryStyles.hintTop, { color: c.muted }]}>
                  Photograph the Nutrition Facts panel straight on, filling the frame. The photo
                  is read on your phone and isn&apos;t kept.
                </Text>
                <ScanButtons state={state} onScan={(s) => void handleScan(s)} />
              </>
            ) : (
              <Text style={[entryStyles.hint, { color: c.muted }]}>
                Reading labels from a photo needs the App Store version of Macros. You can still
                type the label&apos;s numbers in below.
              </Text>
            )}
          </View>
        }
      />
    </Sheet>
  );
}
