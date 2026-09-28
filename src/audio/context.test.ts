import { describe, expect, it } from 'vitest';
import { getVolume, setVolume } from './context';

describe('bus volumes', () => {
  it('start at full and remember whatever the mix panel sets, clamped to 0..1', () => {
    expect(getVolume('ambience')).toBe(1);
    expect(setVolume('ambience', 0.4)).toBeCloseTo(0.4);
    expect(getVolume('ambience')).toBeCloseTo(0.4);
    expect(setVolume('music', -0.2)).toBe(0);
    expect(setVolume('sfx', 1.7)).toBe(1);
    // Setting one bus never disturbs another.
    expect(getVolume('ambience')).toBeCloseTo(0.4);
  });
});
