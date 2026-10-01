import { describe, expect, it, vi } from 'vitest';

// The browser draws the words; here each is a block of ink as tall as a real line's (rows 2 to 17 at 16 px).
vi.mock('./text', () => ({
  textMask: (text: string, size: number) => {
    const width = text.length * 7;
    return { width, height: size + 6, solid: (i: number, j: number) => i >= 0 && i < width && j >= 2 && j <= size + 1 };
  },
}));

const { Bitmap } = await import('./bitmap');
const { Effects } = await import('./effects');

const CLIP = { x: 0, y: 0, width: 400, height: 300 };

/** The rows each colour's words cover in the frame, or null where they don't show. */
function rowsOf(effects: InstanceType<typeof Effects>, colours: number[]) {
  const screen = new Bitmap(CLIP.width, CLIP.height);
  effects.drawWords(screen, 0, 0, CLIP);
  return colours.map((colour) => {
    let top = Infinity;
    let bottom = -Infinity;
    for (let i = 0; i < screen.data.length; i++) {
      if (screen.data[i] !== colour) continue;
      const y = Math.floor(i / screen.width);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
    return Number.isFinite(top) ? { top, bottom } : null;
  });
}

/** Runs the words for `seconds`, checking every frame that no two print over each other; returns the most seen at once. */
function watch(effects: InstanceType<typeof Effects>, colours: number[], seconds: number, midway?: (t: number) => void) {
  let most = 0;
  for (let t = 0; t < seconds; t += 1 / 60) {
    midway?.(t);
    effects.update(1 / 60, [0, 0]);
    const rows = rowsOf(effects, colours);
    const shown = rows.filter((r) => r !== null);
    most = Math.max(most, shown.length);
    for (let a = 0; a < rows.length; a++) {
      for (let b = a + 1; b < rows.length; b++) {
        const [first, later] = [rows[a], rows[b]];
        // The earlier word stands above the later, with a row between their letters, where the outlines meet.
        if (first && later) expect(later.top - first.bottom, `at ${t.toFixed(2)} s`).toBeGreaterThanOrEqual(2);
      }
    }
  }
  return most;
}

describe('words rising off the map', () => {
  it('stack when one thing gives several gains at once: none prints over another', () => {
    const effects = new Effects();
    const colours = [11, 12, 13];
    // Recruiting at the butts on the first visit: the visit's experience, the gold spent, the archers.
    ['+40 experience', '\u2212288 gold', '+12 Archers'].forEach((text, i) => effects.floatText(200, 200, text, colours[i], i * 0.35));
    expect(watch(effects, colours, 3)).toBe(3);
  });

  it('make room for a word that comes while others are still rising', () => {
    const effects = new Effects();
    const colours = [21, 22, 23];
    effects.floatText(200, 200, '+250 gold', colours[0]);
    let sent = 0;
    const most = watch(effects, colours, 3.5, (t) => {
      // One more at 0.4 s, just after the first has started up; another once it has risen all the way.
      if (sent === 0 && t >= 0.4) effects.floatText(200, 200, '+1 experience', colours[++sent]);
      if (sent === 1 && t >= 1) effects.floatText(203, 198, 'Day II', colours[++sent]);
    });
    expect(most).toBe(3);
  });

  it('rise side by side from different spots, each as high as it would alone', () => {
    const effects = new Effects();
    effects.floatText(100, 200, '+250 gold', 31);
    effects.floatText(300, 200, '+250 gold', 32);
    for (let t = 0; t < 1; t += 1 / 60) effects.update(1 / 60, [0, 0]);
    const [left, right] = rowsOf(effects, [31, 32]);
    expect(left).toEqual(right);
    // Risen 22 pixels: the letters' tops (row 2 of the words, 1 below the outline) 22 above where they began.
    expect(left!.top).toBe(200 + 3 - 22);
  });
});

describe('coins flying to the bar', () => {
  it('pay in all the gold they carry as they land, a little at a time', () => {
    const effects = new Effects();
    const landed: number[] = [];
    effects.flyCoins([300, 100], [30, 280], 250, 0, (gold) => landed.push(gold));
    expect(effects.flying).toBe(true);
    for (let t = 0; t < 3; t += 1 / 60) effects.update(1 / 60, [0, 0]);
    expect(landed.length).toBeGreaterThan(2);
    expect(landed.reduce((a, b) => a + b, 0)).toBe(250);
    expect(effects.flying).toBe(false);
  });

  it('are drawn over the whole screen on their way, not only over the map', () => {
    const effects = new Effects();
    effects.flyCoins([300, 100], [30, 280], 100, 0, () => {});
    for (let t = 0; t < 0.45; t += 1 / 60) effects.update(1 / 60, [0, 0]);
    const screen = new Bitmap(CLIP.width, CLIP.height);
    effects.drawFlights(screen);
    expect(screen.data.some((v) => v !== 0)).toBe(true);
  });
});

describe('a glint on treasure', () => {
  it('twinkles, a small star at its point, for a moment and is gone', () => {
    const effects = new Effects();
    effects.puff(100, 100, 'twinkle');
    const drawn = () => {
      const screen = new Bitmap(CLIP.width, CLIP.height);
      effects.draw(screen, 0, 0, CLIP, () => true);
      const at: [number, number][] = [];
      screen.data.forEach((v, i) => v && at.push([i % screen.width, Math.floor(i / screen.width)]));
      return at;
    };
    effects.update(0.2, [0, 0]);
    const star = drawn();
    expect(star.length).toBeGreaterThan(0);
    expect(star.every(([x, y]) => Math.abs(x - 100) <= 4 && Math.abs(y - 100) <= 4)).toBe(true);
    effects.update(1, [0, 0]);
    expect(drawn()).toEqual([]);
  });
});

describe('gear found', () => {
  it('rises with its picture beside its name', () => {
    const effects = new Effects();
    const picture = new Bitmap(16, 16);
    picture.data.fill(77);
    effects.floatText(200, 200, 'A Pilgrim\u2019s Hat', 41, 0, picture);
    effects.update(0.5, [0, 0]);
    const [words] = rowsOf(effects, [41]);
    const [shown] = rowsOf(effects, [77]);
    expect(words).not.toBeNull();
    expect(shown).not.toBeNull();
  });
});
