import { describe, expect, it } from 'vitest';
import { midiOf } from './score';
import { STINGS } from './stings';

/** A major or natural minor scale's pitch classes, from "F# minor". */
function scale(key: string): number[] {
  const [tonic, mode] = key.split(' ');
  const root = midiOf(`${tonic}4`) % 12;
  const steps = mode === 'major' ? [0, 2, 4, 5, 7, 9, 11] : [0, 2, 3, 5, 7, 8, 10];
  return steps.map((s) => (root + s) % 12);
}

const UNPITCHED = new Set(['tabor', 'rim', 'steel']);

describe('the stings', () => {
  for (const [id, sting] of Object.entries(STINGS)) {
    it(`${id}: every note is in ${sting.key}, and it is over in a few seconds`, () => {
      const pitches = scale(sting.key);
      for (const [instrument, at, note] of sting.hits) {
        expect(at >= 0 && at <= 3.5, `${instrument} ${note} at ${at}`).toBe(true);
        if (UNPITCHED.has(instrument)) continue;
        expect(pitches, `${instrument} ${note}`).toContain(midiOf(note) % 12);
      }
      // A sting that leads into a screen lets its music in soon.
      if (sting.next !== undefined) expect(sting.next).toBeLessThanOrEqual(1.3);
      expect(sting.duck).toBeGreaterThan(0);
    });
  }
});
