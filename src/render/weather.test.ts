import { describe, expect, it } from 'vitest';
import { Bitmap } from './bitmap';
import { ADVENTURE_VIEW as VIEW, SCREEN } from './frame';
import { EVENING_LUT, FOG_LUT, LEAF, MORNING_LUT, NIGHT_LUT, SHADOW_LUT, STONE } from './palette';
import { CLEAR, Weather } from './weather';

const LAND = LEAF[5];
const FOG = FOG_LUT[LAND];
const FIGURE = STONE[6];

/**
 * The map's view as the adventure screen hands it to the light: known land on the left, fog on the
 * right (with the fog's colour in `veil`), and a figure standing on the known land and reaching up
 * over the fog's edge.
 */
function view() {
  const screen = new Bitmap(SCREEN.width, SCREEN.height);
  const veil = new Uint16Array(SCREEN.width * SCREEN.height);
  const edge = VIEW.x + VIEW.width / 2;
  for (let y = VIEW.y; y < VIEW.y + VIEW.height; y++) {
    for (let x = VIEW.x; x < VIEW.x + VIEW.width; x++) {
      const o = y * SCREEN.width + x;
      screen.data[o] = x < edge ? LAND : FOG;
      veil[o] = x < edge ? 0 : FOG + 1;
    }
  }
  for (let y = 100; y < 180; y++) for (let x = edge - 20; x < edge + 20; x++) screen.data[y * SCREEN.width + x] = FIGURE;
  const pixels = (x0: number, x1: number, y0: number, y1: number) => {
    const out = new Set<number>();
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) out.add(screen.data[y * SCREEN.width + x]);
    return out;
  };
  return {
    screen,
    veil,
    land: () => pixels(VIEW.x, edge - 30, 200, 400),
    fog: () => pixels(edge + 30, VIEW.x + VIEW.width, 200, 400),
    figureOverFog: () => pixels(edge, edge + 20, 100, 180),
  };
}

describe('the light of the day', () => {
  it('falls on the land the hero knows and on whatever stands there, never on the fog', () => {
    for (const lut of [MORNING_LUT, EVENING_LUT, NIGHT_LUT]) {
      expect(lut[LAND]).not.toBe(LAND);
      expect(lut[FIGURE]).not.toBe(FIGURE);
    }
    const weather = new Weather([], []);
    // A fresh morning, and a golden evening: the land takes the colour, and the fog stays the fog.
    for (const [day, lut] of [[0, MORNING_LUT], [0.72, EVENING_LUT]] as const) {
      const v = view();
      weather.light(v.screen, { ...CLEAR, day }, { x: 0, y: 0 }, VIEW, v.veil);
      expect(v.land(), `day ${day}`).toContain(lut[LAND]);
      expect([...v.fog()], `day ${day}`).toEqual([FOG]);
      expect(v.figureOverFog(), `day ${day}`).toContain(lut[FIGURE]);
    }
    // At night the known land is lit blue, and the fog, which takes no colour from the sky, goes dark.
    const night = view();
    weather.light(night.screen, { ...CLEAR, day: 1 }, { x: 0, y: 0 }, VIEW, night.veil);
    expect(night.land()).toContain(NIGHT_LUT[LAND]);
    expect(night.land()).toContain(LAND);
    expect([...night.fog()]).toEqual([SHADOW_LUT[FOG]]);
    expect(night.figureOverFog()).toContain(NIGHT_LUT[FIGURE]);
  });
});
