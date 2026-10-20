import * as Haptics from 'expo-haptics';

/**
 * Haptics are best-effort. iPads have no Taptic Engine, and these calls are
 * fire-and-forget, so a rejection here would surface as an unhandled promise
 * rejection rather than anything the user could act on.
 */
export function buzz(run: () => Promise<void>) {
  try {
    run().catch(() => {});
  } catch {
    // module unavailable on this device
  }
}

export const buzzSuccess = () =>
  buzz(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));

export const buzzLight = () => buzz(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
