import { describe, expect, it } from '@jest/globals';

import { grandfatheredByBuild, hasEarlierData } from '../grandfather';

describe('hasEarlierData', () => {
  it('counts a logged day, a saved runner profile, or a saved food', () => {
    expect(hasEarlierData(['{"2026-10-01":[{"id":"a","at":1,"c":10,"p":5,"f":2}]}', null, null])).toBe(true);
    expect(hasEarlierData([null, '{"profile":{"age":30},"units":"imperial","weeks":{}}', null])).toBe(true);
    expect(hasEarlierData([null, null, '[{"id":"f","name":"Oats","c":30,"p":5,"f":3}]'])).toBe(true);
  });

  it("doesn't count the empty stores a fresh install writes on its first launch", () => {
    expect(
      hasEarlierData(['{}', '{"profile":null,"units":"imperial","weeks":{},"dayKm":{}}', '[]']),
    ).toBe(false);
    expect(hasEarlierData([null, null, null])).toBe(false);
  });

  it('ignores anything unreadable', () => {
    expect(hasEarlierData(['not json', null, null])).toBe(false);
  });
});

describe('grandfatheredByBuild', () => {
  it('covers every build that shipped free', () => {
    expect(grandfatheredByBuild('1')).toBe(true);
    expect(grandfatheredByBuild('19')).toBe(true);
  });

  it('excludes Premium builds and unknowns', () => {
    expect(grandfatheredByBuild('20')).toBe(false);
    expect(grandfatheredByBuild(null)).toBe(false);
  });

  it("never treats sandbox's 1.0 as a real build, so TestFlight sees the paywall", () => {
    expect(grandfatheredByBuild('1.0')).toBe(false);
  });
});
