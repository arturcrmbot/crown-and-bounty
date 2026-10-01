import { describe, expect, it } from 'vitest';
import { readMidi } from './midi';

/** A variable-length quantity, as MIDI writes delta times. */
function vlq(n: number): number[] {
  const out = [n & 0x7f];
  while ((n >>= 7)) out.unshift((n & 0x7f) | 0x80);
  return out;
}
const word = (n: number, bytes: number) => Array.from({ length: bytes }, (_, i) => (n >> (8 * (bytes - 1 - i))) & 0xff);
const chunk = (id: string, body: number[]) => [...id].map((c) => c.charCodeAt(0)).concat(word(body.length, 4), body);
const name = (text: string) => [0xff, 0x03, text.length, ...[...text].map((c) => c.charCodeAt(0))];

describe('reading a MIDI file', () => {
  it('reads each part by name, its notes in seconds through a change of tempo, and where the tune comes round', () => {
    // 96 ticks a beat; three beats a bar; 120 a minute, then 60 from the third beat.
    const conductor = [0, 0xff, 0x51, 3, ...word(500000, 3), 0, 0xff, 0x58, 4, 3, 2, 24, 8, ...vlq(192), 0xff, 0x51, 3, ...word(1000000, 3), 0, 0xff, 0x2f, 0];
    // A note on, its off, then a second note by running status, ended by a note-on at velocity 0.
    const lead = [0, ...name('Lead'), 0, 0x90, 60, 100, ...vlq(96), 0x80, 60, 0, 0, 0x90, 64, 80, ...vlq(192), 64, 0, 0, 0xff, 0x2f, 0];
    const bytes = new Uint8Array([...chunk('MThd', [0, 1, 0, 2, 0, 96]), ...chunk('MTrk', conductor), ...chunk('MTrk', lead)]);
    const midi = readMidi(bytes);
    expect(midi.beatsPerBar).toBe(3);
    expect(midi.parts.map((p) => p.name)).toEqual(['Lead']);
    const [first, second] = midi.parts[0].notes;
    expect(first).toEqual({ at: 0, length: 0.5, key: 60, velocity: 100 });
    // From beat 1 (0.5 s) to beat 3 (1 s at 120), then a beat at 60 (1 s more).
    expect(second.at).toBeCloseTo(0.5);
    expect(second.length).toBeCloseTo(1.5);
    expect(second.velocity).toBe(80);
    // One bar of three beats: two at 120 and one at 60.
    expect(midi.seconds).toBeCloseTo(2);
  });

  it('refuses what is not a MIDI file', () => {
    expect(() => readMidi(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]))).toThrow();
  });
});
