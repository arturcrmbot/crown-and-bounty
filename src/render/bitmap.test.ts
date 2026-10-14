import { describe, expect, it } from 'vitest';
import { Bitmap, scaleBitmap, SHADOW } from './bitmap';

describe('whole-pixel scene figures', () => {
  it('enlarges palette pixels without blending transparency or shadows', () => {
    const source = new Bitmap(2, 2);
    source.data.set([0, 7, SHADOW, 21]);
    const scaled = scaleBitmap(source, 2);
    expect([scaled.width, scaled.height]).toEqual([4, 4]);
    expect([...scaled.data]).toEqual([0, 0, 7, 7, 0, 0, 7, 7, SHADOW, SHADOW, 21, 21, SHADOW, SHADOW, 21, 21]);
    expect([...source.data]).toEqual([0, 7, SHADOW, 21]);
  });

  it('keeps the source edge at fractional scene scale', () => {
    const source = new Bitmap(3, 2);
    source.data.set([1, 2, 3, 4, 5, 6]);
    const scaled = scaleBitmap(source, 1.5);
    expect([scaled.width, scaled.height]).toEqual([5, 3]);
    expect(scaled.get(4, 2)).toBe(6);
    expect(scaled.data.every(pixel => pixel > 0 && pixel <= 6)).toBe(true);
  });
});
