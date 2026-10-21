import { Platform, TurboModuleRegistry } from 'react-native';

import { addDays, fromDayKey, type DayKey } from '../date';
import { healthWindow, runKmByDay, type HealthRun } from './healthDays';
import { RULES } from './rules';

// Apple Health, read on the phone. Nothing here touches the network: HealthKit
// is a local store, which is why connecting it doesn't change the app's
// "Data Not Collected" privacy label.
//
// The library is native (Nitro), so it exists only in a real iOS build. Its
// JS throws at import without the "NitroModules" TurboModule, so that is
// checked first with the non-throwing `TurboModuleRegistry.get`, and only then
// is the library required. Expo Go and the web simply see no Health.
//
// API checked against @kingstinct/react-native-healthkit 14.0.2's own types:
// requestAuthorization({ toRead }), queryWorkoutSamples({ filter, limit,
// ascending }), filter { workoutActivityType, date: { startDate, endDate } },
// and totalDistance reported natively as { unit: 'meters', quantity }.

/** HKWorkoutActivityType.running in the library's generated enum. */
const RUNNING = 37;

/**
 * How far back a sync looks to decide whether Health can see the runner's
 * runs at all. iOS never tells an app its read access was denied — a denial
 * looks exactly like an empty store — so an empty answer over two months is
 * taken to mean "can't see", not "didn't run", and nothing is zeroed.
 */
const VISIBILITY_DAYS = 60;

function healthKit(): any | null {
  if (Platform.OS !== 'ios') return null;
  if (!TurboModuleRegistry.get('NitroModules')) return null;
  try {
    return require('@kingstinct/react-native-healthkit');
  } catch {
    return null;
  }
}

/** Whether this device and build can read Apple Health. */
export function healthAvailable(): boolean {
  const hk = healthKit();
  if (!hk) return false;
  try {
    return !!hk.isHealthDataAvailable();
  } catch {
    return false;
  }
}

/**
 * Shows iOS's Health permission sheet for reading workouts. iOS shows it once
 * per install; after that this returns at once whatever was chosen, and never
 * says what that was — the sync is the real test.
 */
export async function requestHealthAccess(): Promise<void> {
  const hk = healthKit();
  if (!hk) throw new Error('Apple Health isn’t available on this device.');
  await hk.requestAuthorization({ toRead: ['HKWorkoutTypeIdentifier'] });
}

const toMeters = (q: { unit?: string; quantity?: number } | undefined): number => {
  if (!q || typeof q.quantity !== 'number' || q.quantity <= 0) return 0;
  switch ((q.unit ?? '').toLowerCase()) {
    case 'meters':
    case 'm':
      return q.quantity;
    case 'km':
      return q.quantity * 1000;
    case 'mi':
      return q.quantity * 1609.344;
    default:
      return 0;
  }
};

export type HealthRead =
  | { visible: true; days: Record<DayKey, number> }
  | { visible: false };

/**
 * Kilometres run on each of the last 7 days and today, from every running
 * workout in Health — Apple Watch, and any app that saves its runs there.
 */
export async function readRecentRuns(today: DayKey): Promise<HealthRead> {
  const hk = healthKit();
  if (!hk) throw new Error('Apple Health isn’t available on this device.');
  const workouts: any[] = await hk.queryWorkoutSamples({
    filter: {
      workoutActivityType: RUNNING,
      date: { startDate: fromDayKey(addDays(today, -VISIBILITY_DAYS)), endDate: new Date() },
    },
    limit: 0,
    ascending: true,
  });
  if (!workouts?.length) return { visible: false };
  const runs: HealthRun[] = workouts.map((w) => ({
    start: w.startDate instanceof Date ? w.startDate : new Date(w.startDate),
    meters: toMeters(w.totalDistance),
  }));
  return {
    visible: true,
    days: runKmByDay(runs, healthWindow(today, RULES.loggedEa.lookbackDays)),
  };
}
