import { describe, expect, it } from 'vitest';
import { chordTones, gateLevel, loopUnits, midiOf, moodLevel, notesOf, parseMelody, scaleOf, stepUp, TRACKS } from './score';

describe('the music', () => {
  for (const track of Object.values(TRACKS)) {
    for (const [name, section] of Object.entries(track.sections)) {
      it(`${track.id} ${name}: every bar is full, and the tune sits on the chord on every strong beat`, () => {
        const bars = parseMelody(section.melody);
        expect(bars.length).toBe(section.chords.length);
        bars.forEach((bar, b) => {
          expect(bar.reduce((sum, n) => sum + n.length, 0), `bar ${b + 1}`).toBe(track.unitsPerBar);
          const tones = chordTones(section.chords[b]);
          for (const beat of track.strong) {
            const note = bar.find((n) => n.at <= beat && beat < n.at + n.length)!;
            if (note.name === 'r') continue;
            expect(tones, `bar ${b + 1} (${section.chords[b]}), beat unit ${beat}: ${note.name}`).toContain(midiOf(note.name) % 12);
          }
        });
      });
    }

    it(`${track.id}: its form plays sections and parts it has, in a range a laptop can play`, () => {
      for (const pass of track.form) {
        expect(track.sections[pass.section], pass.section).toBeDefined();
        for (const part of pass.parts ?? []) expect(track.parts[part], part).toBeDefined();
      }
      // Nothing too low to hear on a laptop, or too high to bear.
      for (const n of notesOf(track)) if (n.midi) expect(n.midi >= 36 && n.midi <= 91, `${n.instrument} ${n.midi}`).toBe(true);
      // Every note starts within the loop, so it comes round cleanly.
      const loop = loopUnits(track);
      for (const n of notesOf(track)) expect(n.at >= 0 && n.at < loop).toBe(true);
    });
  }

  it('the map tunes take their time to come round again', () => {
    for (const id of ['heath', 'fen', 'weald', 'marsh', 'reach'] as const) {
      const t = TRACKS[id];
      expect(loopUnits(t) * t.unit, id).toBeGreaterThan(90);
      expect(new Set(t.form.map((p) => p.section)).size, id).toBeGreaterThan(1);
    }
  });

  it('knows each tune\'s scale, for the graces it adds from the note above', () => {
    // The heath is in G: G A B C D E F#.
    expect(scaleOf(TRACKS.heath)).toEqual([0, 2, 4, 6, 7, 9, 11]);
    expect(stepUp(scaleOf(TRACKS.heath), midiOf('B4'))).toBe(midiOf('C5'));
    expect(stepUp(scaleOf(TRACKS.heath), midiOf('E5'))).toBe(midiOf('F#5'));
    // Every tune's scale is a real one, not a muddle of every note.
    for (const t of Object.values(TRACKS)) expect(scaleOf(t).length, t.id).toBeLessThanOrEqual(9);
  });

  it('reads notes and chords', () => {
    expect(midiOf('A4')).toBe(69);
    expect(midiOf('F#4')).toBe(66);
    expect(midiOf('Bb3')).toBe(58);
    expect(chordTones('Em')).toEqual([4, 7, 11]);
    expect(chordTones('B')).toEqual([11, 3, 6]);
    expect(chordTones('Bb')).toEqual([10, 2, 5]);
  });

  it("a villain's theme is as loud by his lair as in his battle: its sparer arrangement there plays up", () => {
    const [calm, fight] = [{ intensity: 0, balance: 0 }, { intensity: 0.25, balance: 0 }];
    for (const t of Object.values(TRACKS)) {
      if (t.calm === undefined) {
        expect(moodLevel(t, calm), t.id).toBe(1);
        continue;
      }
      // Only a track with a lair's arrangement (parts that go once the fighting starts) needs it.
      expect(Object.values(t.parts).some((p) => p.gate?.below !== undefined), t.id).toBe(true);
      expect(moodLevel(t, calm), t.id).toBe(t.calm);
      expect(moodLevel(t, fight), t.id).toBe(1);
    }
  });

  it('parts come and go with the mood', () => {
    const map = { intensity: 0, balance: 0 };
    const fight = { intensity: 0.8, balance: 0 };
    expect(gateLevel(undefined, map)).toBe(1);
    expect(gateLevel({ from: 0.55 }, map)).toBe(0);
    expect(gateLevel({ from: 0.55 }, fight)).toBe(1);
    // The lair's quiet arrangement goes once the fighting starts.
    expect(gateLevel({ below: 0.2 }, map)).toBe(1);
    expect(gateLevel({ below: 0.2 }, fight)).toBe(0);
    expect(gateLevel({ mood: 'win' }, { intensity: 0.5, balance: 0.5 })).toBe(1);
    expect(gateLevel({ mood: 'win' }, { intensity: 0.5, balance: 0 })).toBe(0);
    expect(gateLevel({ mood: 'lose' }, { intensity: 0.5, balance: -0.5 })).toBe(1);
    expect(gateLevel({ mood: 'steady' }, { intensity: 0.5, balance: -0.5 })).toBe(0);
    expect(gateLevel({ mood: 'steady' }, { intensity: 0.5, balance: 0.1 })).toBe(1);
  });
});
