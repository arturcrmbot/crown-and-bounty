import { describe, expect, it } from 'vitest';
import { COLORS, CYCLE_DEEP, CYCLE_FIRE, CYCLE_SHALLOW, CYCLING, EVENING_LUT, GRASS, MIST_LUT, MORNING_LUT, NIGHT_LUT, paletteWords, RAIN_LUT } from './palette';

const luma = (i: number) => {
  const [r, g, b] = COLORS[i];
  return 0.3 * r + 0.59 * g + 0.11 * b;
};

describe('the palette', () => {
  it('keeps cycling however long the game has been open', () => {
    // The clock ticks about eight times a second: an hour is nearly 30,000 ticks.
    expect(() => paletteWords(30_000)).not.toThrow();
    expect(paletteWords(30_001)).toEqual(paletteWords(1));
    expect(paletteWords(6)).toEqual(paletteWords(0));
    expect(paletteWords(1)).not.toEqual(paletteWords(0));
  });

  it('lights the day: night is darker and bluer, evening warmer, and water and flames keep turning', () => {
    const grass = GRASS[5];
    expect(luma(NIGHT_LUT[grass])).toBeLessThan(luma(grass) * 0.75);
    const [r, , b] = COLORS[EVENING_LUT[grass]];
    expect(r - b).toBeGreaterThan(COLORS[grass][0] - COLORS[grass][2]);
    expect(luma(MORNING_LUT[grass])).toBeGreaterThanOrEqual(luma(grass));
    // Mist lifts dark things towards a pale grey.
    expect(luma(MIST_LUT[GRASS[1]])).toBeGreaterThan(luma(GRASS[1]));
    for (const lut of [MORNING_LUT, EVENING_LUT, NIGHT_LUT, MIST_LUT, RAIN_LUT]) {
      for (const i of CYCLE_FIRE) expect(lut[i]).toBe(i);
      // Whatever cycles still cycles: no table turns water into a colour that stands still.
      for (const i of CYCLING) expect(CYCLING.has(lut[i])).toBe(true);
    }
    expect(CYCLE_DEEP).toContain(NIGHT_LUT[CYCLE_SHALLOW[3]]);
    // Strong enough to move most colours: how much of the map it covers is the dither's job.
    const landColours = [...GRASS];
    for (const lut of [MORNING_LUT, EVENING_LUT, NIGHT_LUT]) expect(landColours.filter((i) => lut[i] !== i).length).toBeGreaterThanOrEqual(8);
  });
});
