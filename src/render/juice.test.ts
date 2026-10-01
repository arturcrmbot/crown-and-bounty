import { describe, expect, it } from 'vitest';
import { FRAME, holdFrames, kickLeft, kickOf, popRise, popScale, popShown, POP_LIFE, POP_RISE, rolled, ROLL } from './juice';

describe('how a blow lands', () => {
  it('holds longer the harder it lands, and only a moment with gentle effects', () => {
    expect(holdFrames({ killed: 0 })).toBe(2);
    expect(holdFrames({ killed: 3 })).toBe(3);
    expect(holdFrames({ killed: 0, lucky: true })).toBe(4);
    expect(holdFrames({ killed: 2, charge: true })).toBe(5);
    expect(holdFrames({ killed: 4, wiped: true })).toBe(5);
    expect(holdFrames({ killed: 4, wiped: true }, true)).toBe(1);
    // Never more than a sixth of a second, so a fight of forty blows gets only a few seconds longer.
    expect(5 * FRAME).toBeLessThan(0.17);
  });

  it('kicks the field the way the blow goes, harder for a charge, and not at all when gentle', () => {
    const [x, y] = kickOf([-10, 0], { killed: 0 });
    expect(x).toBeCloseTo(-2);
    expect(y).toBeCloseTo(0);
    expect(Math.hypot(...kickOf([3, 4], { killed: 1, charge: true }))).toBeLessThanOrEqual(5);
    expect(kickOf([3, 4], { killed: 1, charge: true })[0]).toBeCloseTo(3);
    expect(kickOf([1, 0], { killed: 9, wiped: true }, true)).toEqual([0, 0]);
  });

  it('springs back within a fifth of a second', () => {
    let kick: [number, number] = [-5, 1.5];
    for (let t = 0; t < 0.2; t += 1 / 60) kick = kickLeft(kick, 1 / 60);
    expect(kick).toEqual([0, 0]);
  });
});

describe('the count and the kill', () => {
  it('rolls the count down to its new number in four frames', () => {
    expect(rolled(40, 32, 0)).toBe(40);
    expect(rolled(40, 32, ROLL / 2)).toBe(36);
    expect(rolled(40, 32, ROLL)).toBe(32);
    expect(rolled(40, 32, 9)).toBe(32);
  });

  it('pops in large, settles in three frames, holds, rises and fades out', () => {
    expect(popScale(0)).toBe(1.6);
    expect(popScale(FRAME * 1.5)).toBe(1.3);
    expect(popScale(FRAME * 2.5)).toBe(1.1);
    expect(popScale(0.2)).toBe(1);
    expect(popRise(0.1)).toBe(0);
    expect(popRise(POP_LIFE)).toBe(POP_RISE);
    expect(popShown(0.5)).toBe(1);
    expect(popShown(POP_LIFE)).toBe(0);
  });
});
