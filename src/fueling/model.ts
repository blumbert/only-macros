import { fromDayKey, toDayKey, type DayKey } from '../date';
import { calories, sumDay, type Log } from '../storage';
import { RULES, type DayType } from './rules';
import { planFor, type Weeks } from './training';

export type Sex = 'male' | 'female';
export type Goal = 'maintain' | 'lose' | 'recomp';

/** Bone stress injuries in the last 2 years, in the IOC REDs CAT2's terms. */
export type BoneHistory = 'none' | 'oneLowRisk' | 'oneHighRisk' | 'twoOrMore';

/** `oligo`: periods usually more than 35 days apart. `missed3`: 3+ in a row missed. */
export type Cycle = 'regular' | 'oligo' | 'missed3' | 'notApplicable';

export type Profile = {
  sex: Sex;
  age: number;
  weightKg: number;
  /** Fraction, e.g. 0.12. Left out, a lean default for the runner's sex is used. */
  bodyFat?: number;
  lifestyle: 'desk' | 'onFeet';
  goal: Goal;
  bone: BoneHistory;
  /** Kept out of training 6+ months by a bone stress injury in the last 2 years. */
  boneLongLayoff: boolean;
  cycle: Cycle;
};

/**
 * Hard guards stop a weight-loss goal; soft ones only inform. Codes rather
 * than sentences, so the copy lives with the UI and the model stays testable.
 */
export type Guard =
  | 'minor'
  | 'boneHistory'
  | 'missedPeriods'
  | 'loggedLowEa'
  | 'boneHistoryMinor'
  | 'irregularPeriods'
  | 'loggedReducedEa'
  | 'reducedEa'
  | 'fatBelowFloor';

export type DayTargets = {
  kcal: number;
  maintenanceKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  /** Estimated running energy for the day. */
  runningKcal: number;
  /** Energy availability at the target, kcal per kg fat-free mass. */
  ea: number;
  deficitApplied: boolean;
  /** The goal actually used — a blocked "lose" comes back as "maintain". */
  goal: Goal;
  blocks: Guard[];
  warnings: Guard[];
};

export function fatFreeMass(p: Profile): number {
  const bodyFat = p.bodyFat ?? RULES.defaultBodyFat[p.sex];
  return p.weightKg * (1 - bodyFat);
}

export function runningKcal(weightKg: number, km: number): number {
  return RULES.runningKcalPerKgKm * weightKg * Math.max(km, 0);
}

/** Everything but training: resting rate scaled up for daily life. */
export function baseKcal(p: Profile): number {
  const rmr = RULES.rmr.base + RULES.rmr.perKgFfm * fatFreeMass(p);
  return rmr * RULES.lifestyle[p.lifestyle];
}

/**
 * Guards that come from who the runner is rather than from any one day. The
 * bone and period rules are the IOC REDs CAT2's primary indicators (block) and
 * secondary indicators (warn).
 */
export function profileGuards(p: Profile, loggedEa: number | null) {
  const blocks: Guard[] = [];
  const warnings: Guard[] = [];

  if (p.age < RULES.minorAge) blocks.push('minor');

  if (p.bone === 'oneHighRisk' || p.bone === 'twoOrMore' || p.boneLongLayoff) {
    blocks.push('boneHistory');
  } else if (p.bone === 'oneLowRisk') {
    warnings.push('boneHistoryMinor');
  }

  if (p.sex === 'female') {
    if (p.cycle === 'missed3') blocks.push('missedPeriods');
    else if (p.cycle === 'oligo') warnings.push('irregularPeriods');
  }

  if (loggedEa !== null) {
    if (loggedEa < RULES.ea.low) blocks.push('loggedLowEa');
    else if (loggedEa < RULES.ea.adequate) warnings.push('loggedReducedEa');
  }

  return { blocks, warnings };
}

export function dayTargets(
  p: Profile,
  day: { type: DayType; km: number },
  loggedEa: number | null = null,
): DayTargets {
  const ffm = fatFreeMass(p);
  const running = runningKcal(p.weightKg, day.km);
  const maintenance = baseKcal(p) + running;
  const { blocks, warnings } = profileGuards(p, loggedEa);

  const goal: Goal = p.goal === 'lose' && blocks.length ? 'maintain' : p.goal;

  // The deficit only ever comes out of rest and easy days; workouts and long
  // runs are fuelled in full whatever the goal.
  let kcal = maintenance;
  let deficitApplied = false;
  if (goal === 'lose' && RULES.deficit.days.includes(day.type)) {
    const candidate = maintenance - RULES.deficit.kcal;
    // With today's rules this can't trip — base energy alone keeps a capped
    // deficit above the threshold — but the check stays so that changing a
    // number in RULES can never quietly produce a day below it.
    if ((candidate - running) / ffm >= RULES.ea.low) {
      kcal = candidate;
      deficitApplied = true;
    }
  }

  const proteinG =
    p.weightKg * (goal === 'maintain' ? RULES.protein.maintain : RULES.protein.deficitOrRecomp);
  const carbRange = RULES.carbs[day.type];
  let carbsG = p.weightKg * carbRange.pick;
  let fatKcal = kcal - proteinG * 4 - carbsG * 4;

  // Fat takes what's left, held between 20% and 35% of the day. Too little
  // fat pulls carbs down toward the bottom of the day's range, never below
  // it; too much moves the excess into carbs.
  if (fatKcal < RULES.fatShare.min * kcal) {
    const carbsForFloor = (kcal - proteinG * 4 - RULES.fatShare.min * kcal) / 4;
    carbsG = Math.max(carbsForFloor, p.weightKg * carbRange.min);
    fatKcal = kcal - proteinG * 4 - carbsG * 4;
  } else if (fatKcal > RULES.fatShare.max * kcal) {
    fatKcal = RULES.fatShare.max * kcal;
    carbsG = (kcal - proteinG * 4 - fatKcal) / 4;
  }
  if (fatKcal < RULES.fatShare.min * kcal - 0.5) warnings.push('fatBelowFloor');

  const ea = (kcal - running) / ffm;
  if (ea < RULES.ea.adequate) warnings.push('reducedEa');

  return {
    kcal: Math.round(kcal),
    maintenanceKcal: Math.round(maintenance),
    proteinG: Math.round(proteinG),
    carbsG: Math.round(carbsG),
    fatG: Math.round(Math.max(fatKcal, 0) / 9),
    runningKcal: Math.round(running),
    ea: Math.round(ea * 10) / 10,
    deficitApplied,
    goal,
    blocks,
    warnings,
  };
}

/**
 * Energy availability from what was actually eaten over the last week, using
 * each day's own running from the training weeks. Today is left out because
 * it isn't finished, and days with nothing logged are skipped rather than read
 * as zero — the same rules the calendar's monthly average follows. Too few
 * logged days and there's nothing meaningful to say, so it returns null.
 */
export function loggedEnergyAvailability(
  p: Profile,
  log: Log,
  weeks: Weeks,
  today: DayKey,
): { ea: number; days: number } | null {
  const ffm = fatFreeMass(p);
  const start = fromDayKey(today);
  let total = 0;
  let days = 0;
  for (let back = 1; back <= RULES.loggedEa.lookbackDays; back++) {
    const d = new Date(start);
    d.setDate(d.getDate() - back);
    const key = toDayKey(d);
    const intake = calories(sumDay(log[key]));
    const plan = planFor(weeks, key);
    if (intake <= 0 || !plan) continue;
    total += (intake - runningKcal(p.weightKg, plan.km)) / ffm;
    days++;
  }
  if (days < RULES.loggedEa.minDays) return null;
  return { ea: Math.round((total / days) * 10) / 10, days };
}
