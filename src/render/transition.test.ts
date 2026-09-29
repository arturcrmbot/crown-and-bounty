import { describe, expect, it } from 'vitest';
import { BAR, MAP_VIEW, MINIMAP, SCREEN } from './frame';
import { Transition, TRANSITION_TIME } from './transition';

const W = SCREEN.width;
const at = (x: number, y: number) => y * W + x;

describe('screen transitions', () => {
  const from = new Uint8Array(W * SCREEN.height).fill(10);
  const to = new Uint8Array(W * SCREEN.height).fill(20);
  const out = new Uint8Array(W * SCREEN.height);
  const middle = at(MAP_VIEW.x + 300, MAP_VIEW.y + 200);
  const bar = at(BAR.x + 200, BAR.y + 10);

  for (const style of ['fade', 'dissolve', 'clash'] as const) {
    it(`${style}: starts on the old screen, ends on the new, and is over in under a second`, () => {
      expect(TRANSITION_TIME[style]).toBeLessThan(1);
      const t = new Transition(from, style);
      t.compose(to, out);
      expect(out[middle]).toBe(10);
      expect(out[bar]).toBe(10);
      expect(t.revealed).toBe(false);
      t.age = TRANSITION_TIME[style];
      t.compose(to, out);
      expect(out[middle]).toBe(20);
      expect(out[bar]).toBe(20);
      // The cards come in before the very end, once the picture is mostly there.
      expect(t.revealed && t.done).toBe(true);
      t.age = TRANSITION_TIME[style] * 0.4;
      expect(t.revealed).toBe(false);
    });
  }

  it('leaves the frame round the picture alone', () => {
    const t = new Transition(from, 'fade');
    t.age = TRANSITION_TIME.fade / 2;
    t.compose(to, out);
    // Right in the dark middle of a fade, the frame is still one screen or the other, not black.
    expect([10, 20]).toContain(out[at(4, 4)]);
    expect(out[middle]).not.toBe(10);
    expect(out[middle]).not.toBe(20);
  });

  it('fades the adventure map\u2019s panel with the picture, where the other screens have frame, and leaves what both share', () => {
    const panel = at(MINIMAP.x + MINIMAP.width + 2, MINIMAP.y + 40);
    const t = new Transition(from, 'fade');
    t.age = TRANSITION_TIME.fade / 2;
    t.compose(to, out);
    expect(out[panel]).not.toBe(10);
    expect(out[panel]).not.toBe(20);
    const shared = to.slice();
    shared[panel] = from[panel];
    t.compose(shared, out);
    expect(out[panel]).toBe(10);
  });
});
