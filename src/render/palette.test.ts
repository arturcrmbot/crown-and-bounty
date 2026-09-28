import { describe, expect, it } from 'vitest';
import { paletteWords } from './palette';

describe('the palette', () => {
  it('keeps cycling however long the game has been open', () => {
    // The clock ticks about eight times a second: an hour is nearly 30,000 ticks.
    expect(() => paletteWords(30_000)).not.toThrow();
    expect(paletteWords(30_001)).toEqual(paletteWords(1));
    expect(paletteWords(6)).toEqual(paletteWords(0));
    expect(paletteWords(1)).not.toEqual(paletteWords(0));
  });
});
