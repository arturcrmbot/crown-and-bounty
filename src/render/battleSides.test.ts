import { describe, expect, it } from 'vitest';
import { hexIndex, neighbours } from '../rules/battle/hex';
import { hexCentre, sideAt } from './battleHexes';

describe('which side a blow comes from (#211)', () => {
  const target = hexIndex(5, 4);
  const sides = neighbours(target);
  const [tx, ty] = hexCentre(target);
  /** A point on the target, `share` of the way from its middle towards a side's middle. */
  const toward = (side: number, share: number): [number, number] => {
    const [sx, sy] = hexCentre(side);
    return [tx + (sx - tx) * share, ty + (sy - ty) * share];
  };

  it('is the side the pointer points to from the stack\u2019s middle, the left and right as much as the rest', () => {
    for (const side of sides) expect(sideAt(...toward(side, 0.25), target, sides), `side ${side}`).toBe(side);
  });

  it('is where a stack beside it stands, for a click in the middle', () => {
    for (const stand of sides) {
      expect(sideAt(tx, ty, target, sides, stand), `stand ${stand}`).toBe(stand);
      expect(sideAt(...toward(stand, -0.15), target, sides, stand), `stand ${stand}, a little off`).toBe(stand);
    }
  });

  it('is only ever one it could strike from', () => {
    const two = sides.slice(0, 2);
    for (const side of sides) expect(two).toContain(sideAt(...toward(side, 0.4), target, two));
    expect(sideAt(tx, ty, target, [])).toBeNull();
  });
});
