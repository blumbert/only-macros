import { Camera } from 'expo-camera';
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

/** A photo from the library, or null if the runner backed out. */
export async function pickPhoto(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
  return result.canceled || !result.assets?.length ? null : result.assets[0].uri;
}

/**
 * Read a photo of a nutrition facts label, all on the phone. Photos come from
 * the app's own camera (LabelCamera) or the library; either way they're only
 * temporary files, and nothing keeps them once the text is read.
 */
export function useLabelScan() {
  const [state, setState] = useState<ScanState>({ status: 'idle' });
  // A second photo while the first is still being read would race it.
  const busy = useRef(false);

  /** Asks for the camera if it hasn't been asked yet; says why when it's refused. */
  const requestCamera = useCallback(async (): Promise<boolean> => {
    const permission = await Camera.requestCameraPermissionsAsync();
    if (permission.granted) return true;
    setState({
      status: 'error',
      message: permission.canAskAgain
        ? 'Macros needs the camera to read a label. You can choose a photo instead.'
        : 'Camera access is off for Macros. Turn it on in Settings, or choose a photo instead.',
      settings: !permission.canAskAgain,
    });
    return false;
  }, []);

  const read = useCallback(async (uri: string): Promise<LabelReading | null> => {
    if (busy.current) return null;
    busy.current = true;
    try {
      setState({ status: 'reading' });
      const lines = await recognizeText(uri);
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
        message: 'Something went wrong reading that photo. Try again, or type the numbers in.',
      });
      return null;
    } finally {
      busy.current = false;
    }
  }, []);

  /** Choose a photo from the library and read it. */
  const scanLibrary = useCallback(async (): Promise<LabelReading | null> => {
    try {
      const uri = await pickPhoto();
      return uri ? read(uri) : null;
    } catch {
      setState({
        status: 'error',
        message: "Couldn't open your photos. Try again, or type the numbers in.",
      });
      return null;
    }
  }, [read]);

  const reset = useCallback(() => setState({ status: 'idle' }), []);

  return { state, requestCamera, read, scanLibrary, reset };
}
