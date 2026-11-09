// Who keeps Runner fueling for free: everyone who had the app before Premium.
//
// The obvious source, RevenueCat's originalApplicationVersion, can't be the
// main one: its docs say it is null until the person has made a purchase or a
// restore, which is exactly who we're looking for (existing users who have
// never bought anything), and in sandbox it is always "1.0". So the decision
// is made on the phone, once, on the first launch of the first Premium
// version: if the app already holds data from before, this person used an
// earlier version. iCloud device backups carry the decision, with that data,
// to a new phone.

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'macrotracker.premium.v1';

/** The last build that shipped without Premium (1.0.6, build 19). */
export const LAST_FREE_BUILD = 19;

/** The data that only exists if someone used the app before. */
const EARLIER_DATA = ['macrotracker.log.v1', 'macrotracker.runner.v1', 'macrotracker.foods.v1'];

/** Whether any of the stored values shows real use: a logged day, a runner profile, a food. */
export function hasEarlierData(values: (string | null)[]): boolean {
  for (const raw of values) {
    if (!raw) continue;
    try {
      const v = JSON.parse(raw);
      if (Array.isArray(v) ? v.length > 0 : v && typeof v === 'object' && (
        // The runner store always has keys; only a saved profile counts as use.
        'profile' in v ? v.profile !== null : Object.keys(v).length > 0
      )) {
        return true;
      }
    } catch {
      // Unreadable: no evidence either way, so it doesn't count.
    }
  }
  return false;
}

/**
 * RevenueCat's original build number, when it has one: a person who has
 * restored or bought something on a phone that first had a free build.
 * Sandbox's "1.0" isn't a build number this app ever shipped, so it never
 * qualifies, which keeps the paywall testable in TestFlight.
 */
export function grandfatheredByBuild(originalApplicationVersion: string | null | undefined): boolean {
  if (!originalApplicationVersion || !/^\d+$/.test(originalApplicationVersion)) return false;
  return Number(originalApplicationVersion) <= LAST_FREE_BUILD;
}

/**
 * Decided once and remembered. Runs before anything is written on a fresh
 * install's first launch, so a new user's own first entries can't count.
 */
export async function loadGrandfathered(): Promise<boolean> {
  try {
    const stored = await AsyncStorage.getItem(KEY);
    if (stored !== null) return JSON.parse(stored)?.grandfathered === true;
    const values = await Promise.all(EARLIER_DATA.map((k) => AsyncStorage.getItem(k)));
    const grandfathered = hasEarlierData(values);
    await AsyncStorage.setItem(KEY, JSON.stringify({ grandfathered, decidedAt: Date.now() }));
    return grandfathered;
  } catch {
    return false;
  }
}

/** Marks this phone grandfathered for good (from the RevenueCat build check). */
export async function rememberGrandfathered(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify({ grandfathered: true, decidedAt: Date.now() }));
  } catch {
    // Still true for this session; it'll be worked out again next launch.
  }
}
