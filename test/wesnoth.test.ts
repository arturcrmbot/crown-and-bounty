import { existsSync, readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { SHADOW } from '../src/render/bitmap';
import { BLUE, CYCLING, RED } from '../src/render/palette';
import { decodePng } from '../src/render/png';
import { ART, unitImages } from '../src/render/units';
import { loadUnitArt, unitBitmap, unitImage } from '../src/render/wesnoth';

const file = (path: string) => `public/assets/wesnoth/units/${path}`;

describe('Wesnoth unit art', () => {
  beforeAll(() => loadUnitArt(async (path) => new Uint8Array(readFileSync(file(path)))));

  it('has every frame the troops use, as Wesnoth made it', () => {
    for (const path of unitImages()) expect(existsSync(file(path)), path).toBe(true);
  });

  it('decodes PNGs to their exact stored colours', async () => {
    // Counted with another decoder: 929 opaque pixels and 113 of Wesnoth's 60% purple shadow.
    const { width, height, data } = await decodePng(new Uint8Array(readFileSync(file('human-loyalists/swordsman.png'))));
    expect([width, height]).toEqual([72, 72]);
    const alphas = new Map<number, number>();
    for (let i = 3; i < data.length; i += 4) alphas.set(data[i], (alphas.get(data[i]) ?? 0) + 1);
    expect(alphas.get(255)).toBe(929);
    expect(alphas.get(153)).toBe(113);
    const shadow = [...data.keys()].find((i) => i % 4 === 3 && data[i] === 153)! - 3;
    expect([...data.subarray(shadow, shadow + 3)]).toEqual([23, 0, 53]);
  });

  it('paints each side in its own colours, never in the clock-cycling ones', () => {
    for (const [id, art] of Object.entries(ART)) {
      for (const team of ['blue', 'red'] as const) {
        for (const scale of [1.5, 0.9]) {
          const sprite = unitBitmap(art.stand, team, scale, scale < 1 ? 1 : 0);
          const used = new Set(sprite.data);
          expect([...used].some((c) => CYCLING.has(c)), `${id} ${team}`).toBe(false);
          expect(used.has(SHADOW), `${id} has its shadow`).toBe(true);
          // Wesnoth's magenta team colour becomes ours, and never the other side's.
          const other = team === 'blue' ? RED : BLUE;
          const ramp = team === 'blue' ? BLUE : RED;
          const magenta = [...unitImage(art.stand).data].some((_, i, d) => i % 4 === 0 && d[i + 3] === 255 && d[i] > 200 && d[i + 1] < 160 && d[i + 2] > 120);
          if (magenta) expect(ramp.some((c) => used.has(c)), `${id} ${team}`).toBe(true);
          expect(other.filter((c) => used.has(c)), `${id} ${team} uses the other side's colour`).toEqual([]);
        }
      }
    }
  });

  it('keeps going when an image never arrives: its unit stands in its usual pose', async () => {
    vi.resetModules();
    const fresh = await import('../src/render/wesnoth');
    const lost = ART.baron.death![7].image;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await fresh.loadUnitArt(async (path) => {
      if (path === lost) throw new Error('503');
      return new Uint8Array(readFileSync(file(path)));
    });
    warn.mockRestore();
    expect(fresh.unitImage(lost)).toBe(fresh.unitImage(ART.baron.stand));
    expect(fresh.unitImage(ART.baron.death![6].image)).not.toBe(fresh.unitImage(ART.baron.stand));
  });
});
