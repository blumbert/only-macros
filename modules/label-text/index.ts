import { requireOptionalNativeModule } from 'expo';

/** One line of text Vision found, with its box in 0-1 coordinates from the top-left. */
export type TextLine = { text: string; x: number; y: number; width: number; height: number };

type LabelTextModule = { recognize(uri: string): Promise<TextLine[]> };

// Optional, not required: the module only exists in a real iOS build. Expo Go
// and the web don't have it, and requiring it there would throw at import and
// take the whole app down rather than just the scan button.
const native = requireOptionalNativeModule<LabelTextModule>('LabelText');

export const canRecognizeText = native !== null;

export function recognizeText(uri: string): Promise<TextLine[]> {
  if (!native) return Promise.reject(new Error('Text recognition is not available here.'));
  return native.recognize(uri);
}
