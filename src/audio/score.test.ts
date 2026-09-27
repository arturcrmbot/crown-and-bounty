import { describe, expect, it } from 'vitest';
import { chordTones, midiOf, notesOf, parseMelody, TRACKS } from './score';

describe('the music', () => {
  for (const track of Object.values(TRACKS)) {
    it(`${track.id}: every bar is full, and the tune sits on the chord on every strong beat`, () => {
      const bars = parseMelody(track.melody.text);
      expect(bars.length).toBe(track.chords.length);
      bars.forEach((bar, b) => {
        expect(bar.reduce((sum, n) => sum + n.length, 0), `bar ${b + 1}`).toBe(track.unitsPerBar);
        const tones = chordTones(track.chords[b]);
        for (const beat of track.strong) {
          const note = bar.find((n) => n.at <= beat && beat < n.at + n.length)!;
          if (note.name === 'r') continue;
          expect(tones, `bar ${b + 1} (${track.chords[b]}), beat unit ${beat}: ${note.name}`).toContain(midiOf(note.name) % 12);
        }
      });
      // Nothing too low to hear on a laptop, or too high to bear.
      for (const n of notesOf(track)) if (n.midi) expect(n.midi >= 36 && n.midi <= 91, `${n.midi}`).toBe(true);
    });
  }

  it('reads notes and chords', () => {
    expect(midiOf('A4')).toBe(69);
    expect(midiOf('F#4')).toBe(66);
    expect(midiOf('Bb3')).toBe(58);
    expect(chordTones('Em')).toEqual([4, 7, 11]);
    expect(chordTones('B')).toEqual([11, 3, 6]);
    expect(chordTones('Bb')).toEqual([10, 2, 5]);
  });
});
