import { Alert, Platform } from 'react-native';

type Options = {
  title: string;
  message?: string;
  /** Label on the destructive button, e.g. "Delete". */
  confirmLabel: string;
  onConfirm: () => void;
};

/**
 * Ask before doing something destructive.
 *
 * react-native-web ships `Alert.alert` as an empty stub, so on web a plain
 * `Alert.alert` confirmation never appears *and* never fires its handler — the
 * button simply does nothing. Falling back to the browser's own `confirm`
 * keeps deletes working there.
 */
export function confirmDestructive({ title, message, confirmLabel, onConfirm }: Options): void {
  if (Platform.OS === 'web') {
    // No `confirm` means no browser window to ask in (a prerender, say), and
    // silently dropping the action is what this whole function exists to avoid.
    const ask = typeof window !== 'undefined' ? window.confirm : undefined;
    if (!ask || ask(message ? `${title}\n\n${message}` : title)) onConfirm();
    return;
  }

  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}
