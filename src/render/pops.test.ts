import { describe, expect, it, vi } from 'vitest';

// The browser draws the words; here each is a block of ink as tall as a real line's.
vi.mock('./text', () => ({
  textMask: (text: string, size: number) => {
    const width = text.length * Math.round(size / 2);
    return { width, height: size + 6, solid: (i: number, j: number) => i >= 0 && i < width && j >= 2 && j <= size + 1 };
  },
}));

const { Bitmap } = await import('./bitmap');
const { drawPops, popSprite } = await import('./pops');
const { POP_LIFE } = await import('./juice');
const { INK, NEUTRAL } = await import('./palette');

const CLIP = { x: 0, y: 0, width: 400, height: 300 };
const GOLD = 40;

/** The rows a colour covers on the screen, or null where it doesn't show. */
function rows(screen: InstanceType<typeof Bitmap>, colour: number) {
  let [top, bottom] = [Infinity, -Infinity];
  for (let i = 0; i < screen.data.length; i++) {
    if (screen.data[i] !== colour) continue;
    const y = Math.floor(i / screen.width);
    [top, bottom] = [Math.min(top, y), Math.max(bottom, y)];
  }
  return Number.isFinite(top) ? { top, bottom } : null;
}

describe('numbers popping out of a badge', () => {
  it('put a little skull before a kill, and an ink line all round', () => {
    const kill = popSprite('\u22128', GOLD, 22, true);
    const wound = popSprite('\u221218 hp', GOLD, 15, false);
    expect(kill.data.includes(NEUTRAL[7])).toBe(true);
    expect(wound.data.includes(NEUTRAL[7])).toBe(false);
    for (const s of [kill, wound]) {
      expect(s.data.includes(INK)).toBe(true);
      // The rim is ink or empty: nothing coloured touches the sprite's edge.
      for (let x = 0; x < s.width; x++) expect([0, INK]).toContain(s.get(x, 0));
    }
  });

  it('sit just above the badge, whatever size they pop at', () => {
    for (const age of [0, 0.05, 0.2]) {
      const screen = new Bitmap(CLIP.width, CLIP.height);
      drawPops(screen, [{ fighter: 1, words: '\u22128', colour: GOLD, skull: true, age }], 200, 200, CLIP);
      const gold = rows(screen, GOLD)!;
      expect(gold.bottom, `at ${age}`).toBeLessThan(200);
      expect(gold.bottom, `at ${age}`).toBeGreaterThan(190);
    }
  });

  it('stack when two come from one badge, the newest at the badge', () => {
    const screen = new Bitmap(CLIP.width, CLIP.height);
    drawPops(screen, [{ fighter: 1, words: '\u22123', colour: 41, skull: true, age: 0.3 }, { fighter: 1, words: '\u22125', colour: 42, skull: true, age: 0.1 }], 200, 200, CLIP);
    const [older, newer] = [rows(screen, 41)!, rows(screen, 42)!];
    expect(older.bottom).toBeLessThan(newer.top);
  });

  it('are gone by the end of their life', () => {
    const screen = new Bitmap(CLIP.width, CLIP.height);
    drawPops(screen, [{ fighter: 1, words: '\u22128', colour: GOLD, skull: true, age: POP_LIFE }], 200, 200, CLIP);
    expect(rows(screen, GOLD)).toBeNull();
  });
});
