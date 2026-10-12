import { describe, expect, it, vi } from 'vitest';
import type { HeroRig } from '../render/adventureScene';
import { Bitmap } from '../render/bitmap';
import { Walks } from './walks';

vi.mock('../render/text', () => ({
  drawText: () => {},
  drawOutlined: () => {},
  textMask: (text: string, size: number) => ({ width: text.length * 7, height: size + 6, solid: () => false }),
  lettered: (size: number) => size,
  bigLettering: () => false,
}));

const rig = (): HeroRig => {
  const frames = (count: number) => Array.from({ length: count }, () => new Bitmap(8, 12));
  const idle = frames(3);
  return {
    object: { sprite: idle[0], frames: idle, x: -4, y: -8, hidden: true },
    idle, idleLeft: frames(3), walk: frames(6), walkLeft: frames(6), foot: 8, head: 8,
    gait: { stride: 48, frames: [8, 16, 24, 32, 40, 48], footfalls: [8, 32] },
  };
};

describe('the enemies walking at dawn', () => {
  it('selects actual travel poses and keeps the hit area with the visible figure', () => {
    const figure = rig();
    const box = { id: 'band', x0: -4, y0: -8, x1: 4, y1: 4 };
    const walks = new Walks();
    walks.start('band', figure, box, [0, 0], [[24, 0], [24, 24]]);
    expect(figure.object.frames).toBe(figure.walk);
    walks.advance(0.15);
    expect(figure.object.frame).toBe(1);
    expect(walks.where('band')?.[0]).toBeCloseTo(8);
    expect(walks.where('band')?.[1]).toBe(0);
    expect(box).toEqual({ id: 'band', x0: 4, y0: -8, x1: 12, y1: 4 });
    expect(figure.object.hidden).toBe(true);
  });

  it('uses travelled distance through unequal segments rather than time or the straight-line chord', () => {
    const figure = rig();
    const walks = new Walks();
    walks.start('band', figure, undefined, [0, 0], [[8, 0], [8, 24]]);
    walks.advance(0.675);
    expect(walks.where('band')).toEqual([8, 12]);
    expect(figure.object.frame).toBe(2);
  });

  it('faces the next horizontal segment and restores that facing to gentle idle at the exact stop', () => {
    const figure = rig();
    const walks = new Walks();
    walks.start('band', figure, undefined, [0, 0], [[24, 0], [-24, 0]]);
    walks.advance(0.6);
    expect(figure.object.frames).toBe(figure.walkLeft);
    walks.advance(1);
    expect(walks.where('band')).toBeNull();
    expect(figure.object.frames).toBe(figure.idleLeft);
    expect(figure.object.frame).toBeUndefined();
    expect([figure.object.x, figure.object.y]).toEqual([-28, -8]);
  });

  it('finishes only the old walk for the same band before starting its next night', () => {
    const first = rig();
    const other = rig();
    const walks = new Walks();
    walks.start('band', first, undefined, [0, 0], [[24, 0]]);
    walks.start('other', other, undefined, [0, 0], [[48, 0]]);
    walks.advance(0.15);
    const otherAt = walks.where('other');
    walks.start('band', first, undefined, [24, 0], [[24, 24]]);
    expect([first.object.x, first.object.y]).toEqual([20, -8]);
    expect(walks.where('other')).toEqual(otherAt);
    walks.advance(1);
    expect(first.object.frames).toBe(first.idle);
    expect([first.object.x, first.object.y]).toEqual([20, 16]);
  });

  it('leaves an empty path alone', () => {
    const figure = rig();
    const walks = new Walks();
    walks.start('band', figure, undefined, [0, 0], []);
    walks.advance(1);
    expect(figure.object.frames).toBe(figure.idle);
    expect([figure.object.x, figure.object.y]).toEqual([-4, -8]);
  });

  it('starts at the event ground point even if a refresh has already placed the band at its destination', () => {
    const figure = rig();
    figure.object.x = 20;
    const box = { id: 'band', x0: 20, y0: -8, x1: 28, y1: 4 };
    const walks = new Walks();
    walks.start('band', figure, box, [0, 0], [[24, 0]]);
    expect(figure.object.x).toBe(-4);
    expect(box.x0).toBe(-4);
    walks.advance(1);
    expect(figure.object.x).toBe(20);
    expect(box.x0).toBe(20);
  });

  it('keeps a refreshed figure ground anchor when its canvas changes during an unfinished night', () => {
    const figure = rig();
    const walks = new Walks();
    walks.start('band', figure, undefined, [0, 0], [[24, 0]]);
    walks.advance(0.2);
    figure.object.sprite = new Bitmap(12, 16);
    figure.foot = 10;
    walks.advance(1);
    expect([figure.object.x, figure.object.y]).toEqual([18, -10]);
  });
});
