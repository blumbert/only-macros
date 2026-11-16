import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import type { CustomerInfo } from 'react-native-purchases';

import { grandfatheredByBuild, loadGrandfathered, rememberGrandfathered } from './grandfather';
import { configurePurchases, customerInfo, entitledFrom, onCustomerInfo } from './purchases';

export type PremiumState = {
  /** Subscribed: AI search and Runner fueling. */
  premium: boolean;
  /** Had the app before Premium: keeps Runner fueling free. Never AI search. */
  grandfathered: boolean;
  /** Where to manage or cancel, once there's a subscription to manage. */
  managementUrl: string | null;
  /** Re-read the subscription now, e.g. after a purchase or restore. */
  refresh: () => void;
};

/**
 * Local web preview only: `?premium=1` on the dev server's URL unlocks
 * Premium so its pages can be looked at without a subscription. `__DEV__` is
 * false in every store build, so this can't unlock anything for real users.
 */
const previewUnlocked =
  __DEV__ &&
  Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('premium') === '1';

/**
 * Premium status for the whole app. Rendering never waits on it: everything
 * starts locked-but-usable and unlocks the moment RevenueCat or the
 * grandfather check answers.
 */
export function usePremium(): PremiumState {
  const [premium, setPremium] = useState(false);
  const [grandfathered, setGrandfathered] = useState(false);
  const [managementUrl, setManagementUrl] = useState<string | null>(null);

  const apply = useCallback((info: CustomerInfo | null) => {
    if (!info) return;
    setPremium(entitledFrom(info));
    setManagementUrl(info.managementURL ?? null);
    if (grandfatheredByBuild(info.originalApplicationVersion)) {
      setGrandfathered(true);
      void rememberGrandfathered();
    }
  }, []);

  const refresh = useCallback(() => {
    void customerInfo().then(apply);
  }, [apply]);

  useEffect(() => {
    let alive = true;
    void loadGrandfathered().then((g) => {
      if (alive && g) setGrandfathered(true);
    });
    configurePurchases();
    refresh();
    const unsubscribe = onCustomerInfo(apply);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [apply, refresh]);

  return { premium: premium || previewUnlocked, grandfathered, managementUrl, refresh };
}
