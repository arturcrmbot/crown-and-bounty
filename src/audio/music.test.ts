import { describe, expect, it } from 'vitest';
import { deepen, duck, DUCK_IN, DUCK_OUT } from './music';

/** A stand-in for an AudioParam that remembers its automation, and says what it would be at any time. */
function automated(start = 1) {
  const events: [kind: 'set' | 'ramp', value: number, at: number][] = [];
  const param = {
    value: start,
    cancelScheduledValues: () => (events.length = 0),
    setValueAtTime: (value: number, at: number) => events.push(['set', value, at]),
    linearRampToValueAtTime: (value: number, at: number) => events.push(['ramp', value, at]),
  };
  const valueAt = (t: number) => {
    let [value, from] = [start, 0];
    for (const [kind, v, at] of events) {
      if (at > t) return kind === 'ramp' ? value + ((v - value) * (t - from)) / (at - from) : value;
      [value, from] = [v, at];
    }
    return value;
  };
  return { param: param as unknown as AudioParam, valueAt };
}

describe('the score ducking under a sting', () => {
  it('goes down at once, stays down while the sting rings, and comes back up', () => {
    const { param, valueAt } = automated();
    duck(param, 10, { depth: 0.3, until: 11.5 });
    expect(valueAt(10)).toBeCloseTo(1);
    expect(valueAt(10 + DUCK_IN)).toBeCloseTo(0.3);
    expect(valueAt(11.4)).toBeCloseTo(0.3);
    expect(valueAt(11.5 + DUCK_OUT / 2)).toBeCloseTo(0.65);
    expect(valueAt(11.5 + DUCK_OUT)).toBeCloseTo(1);
  });

  it('a lighter duck while a sting rings never lets the music back up early', () => {
    const knell = deepen({ depth: 1, until: 0 }, 10, 4.5, 0.3);
    expect(knell).toEqual({ depth: 0.3, until: 14.5 });
    // The heralds' fanfare a second later: as deep and as long as the knell's.
    expect(deepen(knell, 11, 1.5, 0.5)).toEqual({ depth: 0.3, until: 14.5 });
    // A longer one on a short one holds for its own length.
    expect(deepen({ depth: 0.3, until: 10.6 }, 10.2, 1.5, 0.5)).toEqual({ depth: 0.3, until: 11.7 });
    // Once a duck is over, the next is its own.
    expect(deepen(knell, 20, 1, 0.5)).toEqual({ depth: 0.5, until: 21 });
  });
});
