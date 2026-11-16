import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import type { DayKey } from '../date';
import type { FoodsStore } from '../foods';
import type { LabelReading } from '../nutrition/parseLabel';
import { canScanLabels, useLabelScan, type ScanSource } from '../nutrition/useLabelScan';
import type { Totals } from '../storage';
import { useTheme } from '../theme';
import { entryStyles, FoodEntryForm, type Prefill } from './FoodEntryForm';
import { LabelCamera } from './LabelCamera';
import { ScanButtons } from './ScanButtons';
import { Sheet } from './Sheet';

type Props = {
  visible: boolean;
  onClose: () => void;
  today: DayKey;
  onAdd: (day: DayKey, values: Totals, name?: string) => void;
  foods: FoodsStore;
  /**
   * Go straight to the camera when the page opens. Cancelling the camera
   * leaves the page showing, with its Take photo / Choose photo buttons.
   */
  openCamera?: boolean;
};

/**
 * Scan a nutrition facts label, say how many servings, and add it to today
 * or any earlier day.
 */
export function LabelSheet({ visible, onClose, today, onAdd, foods, openCamera = false }: Props) {
  const { c } = useTheme();
  const { state, requestCamera, read, scanLibrary, reset } = useLabelScan();
  const [cameraOpen, setCameraOpen] = useState(false);
  const [opened, setOpened] = useState(0);
  const [prefill, setPrefill] = useState<Prefill | null>(null);
  const [prefillId, setPrefillId] = useState(0);

  const fill = (reading: LabelReading | null) => {
    if (!reading) return;
    setPrefill({
      perServing: { c: reading.c, p: reading.p, f: reading.f },
      servingSize: reading.servingSize,
      kcal: reading.kcal,
    });
    setPrefillId((n) => n + 1);
  };

  const handleScan = async (source: ScanSource) => {
    if (source === 'library') {
      fill(await scanLibrary());
      return;
    }
    if (await requestCamera()) setCameraOpen(true);
  };

  // A photo from the camera, taken or chosen there: close it and read.
  const onPhoto = async (uri: string) => {
    setCameraOpen(false);
    fill(await read(uri));
  };

  const latestScan = useRef(handleScan);
  latestScan.current = handleScan;

  // A fresh form every time the sheet opens. Keyed on `visible` rather than
  // the Modal's onShow, which react-native-web doesn't reliably fire.
  useEffect(() => {
    if (!visible) return;
    setOpened((n) => n + 1);
    setPrefill(null);
    setCameraOpen(false);
    reset();
    if (!openCamera || !canScanLabels) return;
    // After the sheet has finished sliding up: iOS won't present the camera
    // over a sheet that's still being presented.
    const timer = setTimeout(() => void latestScan.current('camera'), 600);
    return () => clearTimeout(timer);
  }, [visible, reset, openCamera]);

  return (
    <Sheet visible={visible} onClose={onClose} title="Scan a label">
      <LabelCamera
        visible={visible && cameraOpen}
        onPhoto={(uri) => void onPhoto(uri)}
        onClose={() => setCameraOpen(false)}
      />
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
