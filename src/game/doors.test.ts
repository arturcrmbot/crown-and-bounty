import { describe, expect, it } from 'vitest';
import { Bitmap, SHADOW } from '../render/bitmap';
import { doorsOf, hiddenShare, HIDES, reachOf } from './doors';

/** A figure 30 pixels wide and 45 tall, standing in the middle of a 72-pixel frame, with a shadow that doesn't count. */
function figure() {
  const sprite = new Bitmap(72, 72);
  for (let y = 10; y < 55; y++) for (let x = 21; x < 51; x++) sprite.set(x, y, 5);
  for (let x = 10; x < 62; x++) sprite.set(x, 56, SHADOW);
  return reachOf(sprite, 54);
}

/** The Shrine of St Aldhelm: 28 by 34, its foot at (2912, 930). */
const SHRINE = { x0: 2898, y0: 900, x1: 2926, y1: 934 };

describe('where the hero waits at a place', () => {
  it('measures how far his figure reaches from his feet, shadow left out', () => {
    expect(figure()).toEqual({ left: 15, right: 15, up: 44, down: 1 });
  });

  it('knows he hides a shrine, standing just in front of it', () => {
    expect(hiddenShare(SHRINE, figure(), [2916, 940])).toBeGreaterThan(0.8);
    expect(hiddenShare(SHRINE, figure(), [3100, 1046])).toBe(0);
  });

  it('finds a door on either side of it, where the shrine still shows', () => {
    const doors = doorsOf(SHRINE, 930, figure());
    expect(doors).toEqual([[2887, 930], [2937, 930]]);
    for (const door of doors) expect(hiddenShare(SHRINE, figure(), door)).toBeLessThan(HIDES);
  });
});
