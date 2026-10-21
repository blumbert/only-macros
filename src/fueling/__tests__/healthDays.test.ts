import { describe, expect, it } from '@jest/globals';

import { distanceSource, healthWindow, mergeDayKm, runKmByDay } from '../healthDays';

const at = (day: string, hour: number) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, hour);
};

describe('healthWindow', () => {
  it('is the last n days and today, oldest first', () => {
    expect(healthWindow('2026-10-21', 3)).toEqual([
      '2026-10-18',
      '2026-10-19',
      '2026-10-20',
      '2026-10-21',
    ]);
  });
});

describe('runKmByDay', () => {
  const days = ['2026-10-19', '2026-10-20', '2026-10-21'];

  it('gives every covered day an entry, 0 when nothing was run', () => {
    expect(runKmByDay([], days)).toEqual({ '2026-10-19': 0, '2026-10-20': 0, '2026-10-21': 0 });
  });

  it('adds up a day with two runs', () => {
    const runs = [
      { start: at('2026-10-20', 7), meters: 5000 },
      { start: at('2026-10-20', 18), meters: 3210 },
    ];
    expect(runKmByDay(runs, days)['2026-10-20']).toBe(8.21);
  });

  it('files a run by its local start day, late runs included', () => {
    const runs = [{ start: at('2026-10-19', 23), meters: 10000 }];
    expect(runKmByDay(runs, days)).toEqual({ '2026-10-19': 10, '2026-10-20': 0, '2026-10-21': 0 });
  });

  it('ignores runs outside the window', () => {
    const runs = [{ start: at('2026-10-10', 9), meters: 15000 }];
    expect(Object.values(runKmByDay(runs, days))).toEqual([0, 0, 0]);
  });
});

describe('mergeDayKm', () => {
  const today = '2026-10-21';
  const health = { '2026-10-19': 0, '2026-10-20': 8, '2026-10-21': 0 };

  it('takes past days from Health, a missed run as 0', () => {
    expect(mergeDayKm({}, health, today)).toEqual({ '2026-10-19': 0, '2026-10-20': 8 });
  });

  it('leaves today to the plan until a run is in', () => {
    expect(mergeDayKm({}, health, today)['2026-10-21']).toBeUndefined();
    expect(mergeDayKm({}, { ...health, '2026-10-21': 6.5 }, today)['2026-10-21']).toBe(6.5);
  });

  it('lets a distance set by hand win over Health', () => {
    expect(mergeDayKm({ '2026-10-19': 5 }, health, today)['2026-10-19']).toBe(5);
  });

  it('is just the hand-set distances without Health', () => {
    expect(mergeDayKm({ '2026-10-19': 5 }, null, today)).toEqual({ '2026-10-19': 5 });
  });
});

describe('distanceSource', () => {
  const today = '2026-10-21';
  const health = { '2026-10-19': 0, '2026-10-21': 0 };

  it('names the source that won', () => {
    expect(distanceSource('2026-10-19', { '2026-10-19': 3 }, health, today)).toBe('manual');
    expect(distanceSource('2026-10-19', {}, health, today)).toBe('health');
    expect(distanceSource('2026-10-21', {}, health, today)).toBe('plan');
    expect(distanceSource('2026-10-19', {}, null, today)).toBe('plan');
  });
});
