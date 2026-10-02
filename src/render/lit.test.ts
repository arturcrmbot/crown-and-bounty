import { describe, expect, it } from 'vitest';
import { Bitmap, SHADOW } from './bitmap';
import { LIT_REACH, ringOf } from './lit';
import { GOLD, INK } from './palette';

/** A 9 by 7 sprite: a box with a hole in its middle, and a shadow off its lower right. */
function boxWithHole(): Bitmap {
  const b = new Bitmap(9, 7);
  for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) if (!(x >= 2 && x <= 3 && y >= 2 && y <= 3)) b.set(x, y, 5);
  for (let x = 6; x < 9; x++) b.set(x, 6, SHADOW);
  return b;
}

describe('the ring round the place under the pointer (#256)', () => {
  it('goes round its outside, two pixels of gold and one of ink, and never inside it', () => {
    const sprite = boxWithHole();
    const ring = ringOf(sprite);
    const P = LIT_REACH;
    expect([ring.width, ring.height]).toEqual([sprite.width + P * 2, sprite.height + P * 2]);
    // Out from its left side, row 2: ink, gold, bright gold, then the sprite.
    expect([0, 1, 2, 3].map((x) => ring.get(x, P + 2))).toEqual([INK, GOLD[5], GOLD[6], 0]);
    // The hole inside it stays open, and nothing is drawn on the sprite itself.
    for (let y = 2; y <= 3; y++) for (let x = 2; x <= 3; x++) expect(ring.get(P + x, P + y)).toBe(0);
    for (let y = 0; y < sprite.height; y++) for (let x = 0; x < sprite.width; x++) if (sprite.get(x, y) === 5) expect(ring.get(P + x, P + y)).toBe(0);
  });

  it('takes its shadow for open ground', () => {
    const ring = ringOf(boxWithHole());
    const P = LIT_REACH;
    // Just right of the box's foot, over its shadow, the ring is its bright gold.
    expect(ring.get(P + 6, P + 5)).toBe(GOLD[6]);
    // Further along the shadow it's outside the ring altogether.
    expect(ring.get(P + 8 + 1, P + 6)).toBe(0);
  });

  it('is worked out once for each picture', () => {
    const sprite = boxWithHole();
    expect(ringOf(sprite)).toBe(ringOf(sprite));
  });
});
