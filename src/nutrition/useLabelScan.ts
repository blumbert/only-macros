import * as ImagePicker from 'expo-image-picker';
import { useCallback, useRef, useState } from 'react';

import { canRecognizeText, recognizeText } from '../../modules/label-text';
import { parseLabel, type LabelReading } from './parseLabel';

export type ScanSource = 'camera' | 'library';

export type ScanState =
  | { status: 'idle' }
  | { status: 'reading' }
  | { status: 'done'; reading: LabelReading }
  | { status: 'error'; message: string; settings?: boolean };

/** Whether this build can read labels at all. Expo Go and the web can't. */
export const canScanLabels = canRecognizeText;

/**
 * Take or choose a photo of a nutrition facts label and read it, all on the
 * phone. The photo is only ever a temporary file the picker made; nothing
 * keeps it once the text is read.
 */
export function useLabelScan() {
  const [state, setState] = useState<ScanState>({ status: 'idle' });
  // A second tap while the first scan is still going would race it.
  const busy = useRef(false);

  const scan = useCallback(async (source: ScanSource): Promise<LabelReading | null> => {
    if (busy.current) return null;
    busy.current = true;
    try {
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          setState({
            status: 'error',
            message: permission.canAskAgain
              ? 'Macros needs the camera to read a label. You can choose a photo instead.'
              : 'Camera access is off for Macros. Turn it on in Settings, or choose a photo instead.',
            settings: !permission.canAskAgain,
          });
          return null;
        }
      }

      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled || !result.assets?.length) return null;

      setState({ status: 'reading' });
      const lines = await recognizeText(result.assets[0].uri);
      const reading = parseLabel(lines);
      if (reading.c === undefined && reading.p === undefined && reading.f === undefined) {
        setState({
          status: 'error',
          message: lines.length
            ? "Couldn't find carbs, protein or fat in that photo. Try again closer to the label, flat and in good light — or type the numbers in."
            : "Couldn't read any text in that photo. Try again closer to the label, in good light.",
        });
        return null;
      }
      setState({ status: 'done', reading });
      return reading;
    } catch {
      setState({
        status: 'error',
        message: "Something went wrong reading that photo. Try again, or type the numbers in.",
      });
      return null;
    } finally {
      busy.current = false;
    }
  }, []);

  const reset = useCallback(() => setState({ status: 'idle' }), []);

  return { state, scan, reset };
}
