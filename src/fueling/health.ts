import { Platform, TurboModuleRegistry } from 'react-native';

import { addDays, fromDayKey, type DayKey } from '../date';
import {
  crossTrainingByDay,
  healthWindow,
  runKmByDay,
  type HealthRun,
  type HealthWorkout,
  type HealthXt,
} from './healthDays';
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
// totalDistance reported natively as { unit: 'meters', quantity }, duration
// as { unit: 's' } and totalEnergyBurned as { unit: 'kcal' }.

/** HKWorkoutActivityType.running in the library's generated enum. */
const RUNNING = 37;

/**
 * The workouts that count as cross-training: sustained cardio that stands in
 * for running. Strength, yoga, walking, hiking and team sports don't, so
 * they're left out. Values are HKWorkoutActivityType's.
 */
const CROSS_TRAINING = new Set([
  13, // cycling
  16, // elliptical
  31, // paddle sports (kayaking, canoeing, paddleboarding)
  35, // rowing
  39, // skating (inline and ice)
  44, // stair climbing (machine)
  46, // swimming
  60, // cross-country skiing
  63, // high-intensity interval training
  68, // stairs
  69, // step training
  73, // mixed cardio
  74, // hand cycling
  82, // swim-bike-run
]);

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

/**
 * Runs, and cross-training (sustained cardio workouts). `visible` is about
 * runs only; cross-training comes back either way.
 */
export type HealthRead =
  | { visible: true; days: Record<DayKey, number>; xt: HealthXt }
  | { visible: false; xt: HealthXt };

const toMinutes = (q: { unit?: string; quantity?: number } | undefined): number => {
  if (!q || typeof q.quantity !== 'number' || q.quantity <= 0) return 0;
  const unit = (q.unit ?? '').toLowerCase();
  if (unit === 's') return q.quantity / 60;
  if (unit === 'min') return q.quantity;
  if (unit === 'hr' || unit === 'h') return q.quantity * 60;
  return 0;
};

const toKcal = (q: { unit?: string; quantity?: number } | undefined): number => {
  if (!q || typeof q.quantity !== 'number' || q.quantity <= 0) return 0;
  const unit = (q.unit ?? '').toLowerCase();
  if (unit === 'kcal' || unit === 'cal') return q.quantity;
  if (unit === 'kj') return q.quantity / 4.184;
  return 0;
};

/**
 * Kilometres run on each of the last 7 days and today, from every running
 * workout in Health — Apple Watch, and any app that saves its runs there —
 * and the cross-training on those days, from cardio workouts like cycling,
 * the elliptical and swimming.
 */
export async function readRecentRuns(today: DayKey): Promise<HealthRead> {
  const hk = healthKit();
  if (!hk) throw new Error('Apple Health isn’t available on this device.');
  const all: any[] =
    (await hk.queryWorkoutSamples({
      filter: {
        date: { startDate: fromDayKey(addDays(today, -VISIBILITY_DAYS)), endDate: new Date() },
      },
      limit: 0,
      ascending: true,
    })) ?? [];
  const startOf = (w: any) => (w.startDate instanceof Date ? w.startDate : new Date(w.startDate));
  const covered = healthWindow(today, RULES.loggedEa.lookbackDays);
  const others: HealthWorkout[] = all
    .filter((w) => CROSS_TRAINING.has(w.workoutActivityType))
    .map((w) => ({
      start: startOf(w),
      minutes: toMinutes(w.duration),
      kcal: toKcal(w.totalEnergyBurned),
    }));
  const xt = crossTrainingByDay(others, covered);
  const workouts = all.filter((w) => w.workoutActivityType === RUNNING);
  if (!workouts.length) return { visible: false, xt };
  const runs: HealthRun[] = workouts.map((w) => ({
    start: startOf(w),
    meters: toMeters(w.totalDistance),
  }));
  return { visible: true, days: runKmByDay(runs, covered), xt };
}
