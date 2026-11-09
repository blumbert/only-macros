import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL, type CustomerInfo, type PurchasesPackage } from 'react-native-purchases';

// A thin layer over RevenueCat so no screen imports the SDK and none of them
// has to know how entitlement works. Adapted from Weedhead Warriors'
// purchases.ts, which shipped this same SDK version on this same Expo SDK.
//
// The iOS PUBLIC key from RevenueCat (Project settings -> API keys, starts
// with `appl_`). Never the secret key: anything compiled into the app can be
// read out of it. Until it's filled in, everything here reports "unavailable"
// instead of throwing.
const PURCHASES_IOS_KEY = '';

/** The entitlement Premium products grant, named identically in RevenueCat. */
export const PREMIUM_ENTITLEMENT = 'premium';

export type Plan = {
  id: string;
  title: string;
  priceString: string;
  period: string | null;
  /** The plan to preselect: the offering's last, conventionally the yearly one. */
  recommended: boolean;
};

export type PurchaseResult =
  | { ok: true; entitled: boolean }
  | { ok: false; cancelled?: boolean; message: string };

export function purchasesAvailable(): boolean {
  return Platform.OS === 'ios' && !!PURCHASES_IOS_KEY;
}

let configured = false;

/**
 * There are no accounts, so RevenueCat makes its own anonymous user id and
 * keeps it with the app's data. That id is what the AI search server checks
 * the subscription against.
 */
export function configurePurchases(): void {
  if (!purchasesAvailable() || configured) return;
  try {
    Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.ERROR);
    Purchases.configure({ apiKey: PURCHASES_IOS_KEY });
    configured = true;
  } catch {
    // A build without the native module: purchases simply stay unavailable.
  }
}

export async function appUserId(): Promise<string | null> {
  if (!configured) return null;
  try {
    return await Purchases.getAppUserID();
  } catch {
    return null;
  }
}

export const entitledFrom = (info: CustomerInfo | null | undefined): boolean =>
  !!info?.entitlements?.active?.[PREMIUM_ENTITLEMENT];

export async function customerInfo(): Promise<CustomerInfo | null> {
  if (!configured) return null;
  try {
    return await Purchases.getCustomerInfo();
  } catch {
    return null;
  }
}

/** Calls back whenever RevenueCat learns of a change (a purchase, a renewal, a lapse). */
export function onCustomerInfo(listener: (info: CustomerInfo) => void): () => void {
  if (!configured) return () => {};
  Purchases.addCustomerInfoUpdateListener(listener);
  return () => {
    Purchases.removeCustomerInfoUpdateListener(listener);
  };
}

// RevenueCat hands back the store's raw ISO-8601 period ("P1M"); a paywall
// that printed that would be gibberish.
function humanizePeriod(iso: string | null): string | null {
  if (!iso) return null;
  const map: Record<string, string> = { P1W: 'week', P1M: 'month', P3M: '3 months', P6M: '6 months', P1Y: 'year' };
  return map[iso] ?? null;
}

const toPlan = (p: PurchasesPackage, recommended: boolean): Plan => ({
  id: p.identifier,
  title: p.product.title,
  priceString: p.product.priceString,
  period: humanizePeriod(p.product.subscriptionPeriod),
  recommended,
});

/**
 * Every plan in the current offering, cheapest first as the dashboard orders
 * them. An empty list has several different causes, so the reason comes back
 * too rather than a bare [].
 */
export async function getPlans(): Promise<{ plans: Plan[]; error?: string }> {
  if (!configured) return { plans: [], error: 'Subscriptions aren’t available in this build.' };
  try {
    const offerings = await Purchases.getOfferings();
    const current = offerings.current;
    if (!current) return { plans: [], error: 'No current offering is set up in RevenueCat.' };
    const pkgs = current.availablePackages ?? [];
    if (!pkgs.length) {
      return {
        plans: [],
        error: `Offering "${current.identifier}" has no products the App Store will sell yet.`,
      };
    }
    return { plans: pkgs.map((p, i) => toPlan(p, i === pkgs.length - 1)) };
  } catch (e: any) {
    return { plans: [], error: e?.message ?? 'Couldn’t load plans from the App Store.' };
  }
}

export async function purchase(planId: string): Promise<PurchaseResult> {
  if (!configured) return { ok: false, message: 'Subscriptions aren’t available in this build.' };
  try {
    // Re-resolved here: the paywall may have been open a while, and the
    // purchase needs the SDK's own package object.
    const offerings = await Purchases.getOfferings();
    const pkg = offerings.current?.availablePackages.find((p) => p.identifier === planId);
    if (!pkg) return { ok: false, message: 'That plan is no longer available.' };
    const { customerInfo: info } = await Purchases.purchasePackage(pkg);
    return { ok: true, entitled: entitledFrom(info) };
  } catch (e: any) {
    // Cancel in Apple's sheet arrives as an error; it isn't a failure.
    if (e?.userCancelled) return { ok: false, cancelled: true, message: 'Cancelled.' };
    return { ok: false, message: e?.message ?? 'The purchase couldn’t be completed.' };
  }
}

/**
 * Required on any screen that sells a subscription, and the way back in on a
 * new phone or after reinstalling.
 */
export async function restore(): Promise<PurchaseResult> {
  if (!configured) return { ok: false, message: 'Subscriptions aren’t available in this build.' };
  try {
    const info = await Purchases.restorePurchases();
    return { ok: true, entitled: entitledFrom(info) };
  } catch (e: any) {
    if (e?.userCancelled) return { ok: false, cancelled: true, message: 'Cancelled.' };
    return { ok: false, message: e?.message ?? 'Couldn’t restore purchases.' };
  }
}
