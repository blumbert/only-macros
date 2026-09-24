import { describe, expect, it } from '@jest/globals';

import type { Log } from '../../storage';
import { dayTargets, loggedEnergyAvailability, type Profile } from '../model';
import { RULES, type DayType } from '../rules';
import { EMPTY_WEEK, KM_PER_MI, type Week } from '../training';

// The two worked examples from docs/runner-fueling-model.md.
const female: Profile = {
  sex: 'female',
  age: 28,
  weightKg: 50,
  lifestyle: 'desk',
  goal: 'maintain',
  bone: 'none',
  boneLongLayoff: false,
  cycle: 'regular',
};
const femaleEasy = { type: 'easy' as const, km: (40 * KM_PER_MI) / 7 };

const male: Profile = {
  ...female,
  sex: 'male',
  weightKg: 75,
  bodyFat: 0.15,
  cycle: 'notApplicable',
};
const maleEasy = { type: 'easy' as const, km: (50 * KM_PER_MI) / 7 };

describe('maintenance', () => {
  it('matches the 50 kg worked example', () => {
    const t = dayTargets(female, femaleEasy);
    expect(t.maintenanceKcal).toBe(2407);
    expect(t.kcal).toBe(2407);
    expect(t.proteinG).toBe(80);
    // Fat would land at 37% of the day, so it's capped at 35% and the excess
    // becomes carbohydrate.
    expect(t.fatG).toBe(94);
    expect(t.carbsG).toBe(311);
    expect(t.ea).toBe(47.5);
    expect(t.blocks).toEqual([]);
    expect(t.warnings).toEqual([]);
  });

  it('matches the 75 kg worked example', () => {
    const t = dayTargets(male, maleEasy);
    expect(t.maintenanceKcal).toBe(3439);
    expect(t.proteinG).toBe(120);
  });

  it('assumes lean body fat when none is given', () => {
    // 16% for women: 50 kg → 42 kg fat-free mass → 500 + 22 × 42 = 1,424 × 1.4
    expect(dayTargets(female, { type: 'rest', km: 0 }).maintenanceKcal).toBe(1994);
  });
});

describe('carbohydrate by day type', () => {
  const km = 12;
  const carbsPerKg = (type: DayType) =>
    dayTargets(female, { type, km: type === 'rest' ? 0 : km }).carbsG / female.weightKg;

  it('rises from rest to long run', () => {
    expect(carbsPerKg('rest')).toBeLessThan(carbsPerKg('easy'));
    expect(carbsPerKg('easy')).toBeLessThan(carbsPerKg('workout'));
    expect(carbsPerKg('workout')).toBeLessThan(carbsPerKg('long'));
  });

  it('never drops below the bottom of the day type range', () => {
    for (const type of ['rest', 'easy', 'workout', 'long'] as DayType[]) {
      for (const goal of ['maintain', 'lose', 'recomp'] as const) {
        const t = dayTargets({ ...female, goal }, { type, km: type === 'rest' ? 0 : km });
        expect(t.carbsG).toBeGreaterThanOrEqual(Math.floor(RULES.carbs[type].min * female.weightKg));
      }
    }
  });

  it('keeps fat between 20% and 35% of the day', () => {
    for (const p of [female, male]) {
      for (const type of ['rest', 'easy', 'workout', 'long'] as DayType[]) {
        for (const dayKm of [0, 8, 16, 35]) {
          const t = dayTargets({ ...p, goal: 'lose' }, { type, km: type === 'rest' ? 0 : dayKm });
          if (t.warnings.includes('fatBelowFloor')) continue;
          const share = (t.fatG * 9) / t.kcal;
          expect(share).toBeGreaterThanOrEqual(0.195);
          expect(share).toBeLessThanOrEqual(0.355);
        }
      }
    }
  });
});

describe('losing weight', () => {
  const lose = { ...female, goal: 'lose' as const };

  it('takes 300 kcal off an easy day and raises protein', () => {
    const t = dayTargets(lose, femaleEasy);
    expect(t.deficitApplied).toBe(true);
    expect(t.kcal).toBe(2107);
    expect(t.proteinG).toBe(100);
    expect(t.ea).toBe(40.3);
    expect(t.warnings).toContain('reducedEa');
  });

  it('fuels workout and long-run days in full', () => {
    for (const type of ['workout', 'long'] as const) {
      const t = dayTargets(lose, { type, km: 15 });
      expect(t.deficitApplied).toBe(false);
      expect(t.kcal).toBe(t.maintenanceKcal);
    }
  });

  it('never takes more than 300 kcal', () => {
    for (const type of ['rest', 'easy'] as const) {
      const t = dayTargets(lose, { type, km: 10 });
      expect(t.maintenanceKcal - t.kcal).toBeLessThanOrEqual(RULES.deficit.kcal + 1);
    }
  });

  it('is not refused for being light — body size is not a guardrail', () => {
    // BMI around 17, as plenty of elite distance runners are.
    const t = dayTargets({ ...lose, weightKg: 45 }, femaleEasy);
    expect(t.blocks).toEqual([]);
    expect(t.deficitApplied).toBe(true);
  });
});

describe('guardrails', () => {
  const lose = { ...female, goal: 'lose' as const };

  const blockedBy = (p: Profile, loggedEa: number | null = null) => {
    const t = dayTargets(p, femaleEasy, loggedEa);
    // A blocked "lose" always comes back as plain maintenance.
    if (t.blocks.length) {
      expect(t.goal).toBe('maintain');
      expect(t.deficitApplied).toBe(false);
      expect(t.kcal).toBe(t.maintenanceKcal);
      expect(t.proteinG).toBe(80);
    }
    return t;
  };

  it('blocks a deficit for a minor', () => {
    expect(blockedBy({ ...lose, age: 17 }).blocks).toEqual(['minor']);
  });

  it('blocks on a high-risk bone stress injury (sacrum, pelvis, femoral neck)', () => {
    expect(blockedBy({ ...lose, bone: 'oneHighRisk' }).blocks).toEqual(['boneHistory']);
  });

  it('blocks on two or more bone stress injuries anywhere', () => {
    expect(blockedBy({ ...lose, bone: 'twoOrMore' }).blocks).toEqual(['boneHistory']);
  });

  it('blocks on six months out of training with one', () => {
    expect(blockedBy({ ...lose, bone: 'oneLowRisk', boneLongLayoff: true }).blocks).toEqual([
      'boneHistory',
    ]);
  });

  it('only warns about a single low-risk bone stress injury', () => {
    const t = blockedBy({ ...lose, bone: 'oneLowRisk' });
    expect(t.blocks).toEqual([]);
    expect(t.deficitApplied).toBe(true);
    expect(t.warnings).toContain('boneHistoryMinor');
  });

  it('blocks on three or more missed periods', () => {
    expect(blockedBy({ ...lose, cycle: 'missed3' }).blocks).toEqual(['missedPeriods']);
  });

  it('only warns about infrequent periods', () => {
    const t = blockedBy({ ...lose, cycle: 'oligo' });
    expect(t.blocks).toEqual([]);
    expect(t.warnings).toContain('irregularPeriods');
  });

  it('ignores the cycle answer for male runners', () => {
    expect(blockedBy({ ...male, goal: 'lose', cycle: 'missed3' }).blocks).toEqual([]);
  });

  it('blocks when the log shows low energy availability already', () => {
    expect(blockedBy(lose, 25).blocks).toEqual(['loggedLowEa']);
  });

  it('warns when the log shows reduced energy availability', () => {
    const t = blockedBy(lose, 40);
    expect(t.blocks).toEqual([]);
    expect(t.warnings).toContain('loggedReducedEa');
  });

  it('reports every block that applies, not just the first', () => {
    expect(blockedBy({ ...lose, age: 16, bone: 'twoOrMore' }).blocks).toEqual([
      'minor',
      'boneHistory',
    ]);
  });

  it('leaves maintain and recomp goals alone', () => {
    const recomp = dayTargets({ ...female, goal: 'recomp', bone: 'twoOrMore' }, femaleEasy);
    expect(recomp.goal).toBe('recomp');
    expect(recomp.kcal).toBe(recomp.maintenanceKcal);
    expect(recomp.proteinG).toBe(100);
  });
});

describe('loggedEnergyAvailability', () => {
  // 70 km a week, all easy: 10 km a day → 0.9 × 50 × 10 = 450 kcal of running.
  const week: Week = { ...EMPTY_WEEK, km: 70 };
  // Only the earlier week is entered, so the week of the 20th carries it forward.
  const weeks = { '2026-09-13': week };
  const today = '2026-09-24';
  const eat2000 = [{ id: 'x', at: 0, c: 275, p: 90, f: 60 }];

  it('averages logged days in the last week against that day’s running', () => {
    const log: Log = { '2026-09-19': eat2000, '2026-09-21': eat2000, '2026-09-23': eat2000 };
    // (2,000 − 450) / 42 kg fat-free mass
    expect(loggedEnergyAvailability(female, log, weeks, today)).toEqual({ ea: 36.9, days: 3 });
  });

  it('leaves out today, and anything older than a week', () => {
    const log: Log = {
      '2026-09-16': eat2000,
      '2026-09-19': eat2000,
      '2026-09-21': eat2000,
      '2026-09-23': eat2000,
      '2026-09-24': [{ id: 'y', at: 0, c: 10, p: 0, f: 0 }],
    };
    expect(loggedEnergyAvailability(female, log, weeks, today)?.days).toBe(3);
  });

  it('skips unlogged days instead of counting them as zero', () => {
    const log: Log = { '2026-09-17': eat2000, '2026-09-20': eat2000, '2026-09-23': eat2000 };
    expect(loggedEnergyAvailability(female, log, weeks, today)?.ea).toBe(36.9);
  });

  it('says nothing with too few logged days to go on', () => {
    const log: Log = { '2026-09-22': eat2000, '2026-09-23': eat2000 };
    expect(loggedEnergyAvailability(female, log, weeks, today)).toBeNull();
  });

  it('skips days no training week covers', () => {
    const log: Log = { '2026-09-19': eat2000, '2026-09-21': eat2000, '2026-09-23': eat2000 };
    expect(loggedEnergyAvailability(female, log, { '2026-09-20': week }, today)).toBeNull();
  });
});
