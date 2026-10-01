import { describe, expect, it } from 'vitest';
import { Bitmap, SHADOW } from './bitmap';
import { paintedBox, rotateAbout } from './rotate';

/** A little figure: a head on a body, two wide at the feet, with a shadow beside them. */
function figure() {
  const b = new Bitmap(4, 6);
  for (const [x, y, v] of [[1, 0, 9], [2, 0, 9], [1, 1, 8], [2, 1, 8], [1, 2, 7], [2, 2, 7], [1, 3, 7], [2, 3, 7], [1, 4, 6], [2, 4, 6], [1, 5, 5], [2, 5, 5], [3, 5, SHADOW]] as const) b.set(x, y, v);
  return b;
}

describe('turning a sprite', () => {
  it('leaves it as it was at no turn, shadow aside', () => {
    const { sprite, x, y } = rotateAbout(figure(), 0, [1, 5]);
    expect([x, y]).toEqual([-1, -5]);
    for (let j = 0; j < 6; j++) for (let i = 0; i < 4; i++) expect(sprite.get(i, j), `${i},${j}`).toBe(figure().get(i, j) === SHADOW ? 0 : figure().get(i, j));
  });

  it('lays it down with its head to the left at a quarter turn, its feet where they were', () => {
    const { sprite, x, y } = rotateAbout(figure(), 90, [1, 5]);
    const box = paintedBox(sprite)!;
    // Six tall becomes six long, two wide becomes two high.
    expect(box[2] - box[0] + 1).toBe(6);
    expect(box[3] - box[1] + 1).toBe(2);
    // The head (colour 9) is the leftmost column, the feet (colour 5) the rightmost.
    expect(sprite.get(box[0], box[1])).toBe(9);
    expect(sprite.get(box[2], box[1])).toBe(5);
    // The feet stay at the pivot: the rightmost column sits just left of it.
    expect(x + box[2]).toBe(0);
    expect(y).toBeLessThanOrEqual(0);
  });

  it('lays it down the other way at a quarter turn back', () => {
    const { sprite } = rotateAbout(figure(), -90, [2, 5]);
    const box = paintedBox(sprite)!;
    expect(sprite.get(box[2], box[1])).toBe(9);
  });
});
