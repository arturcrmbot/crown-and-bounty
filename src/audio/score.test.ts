import { describe, expect, it } from 'vitest';
import { RANGES, type Melodic } from './band';
import { readMidi } from './midi';
import { fold, gateLevel, lapsOf, lengthOf, midiOf, moodLevel, notesOf, TRACKS, TUNES, TURN, type TrackId, type TuneId } from './score';

const FILES = import.meta.glob<string>('../../public/assets/music/*.mid', { query: '?inline', import: 'default', eager: true });
/** One of Yubatake's files, as the game reads it. */
const tuneFile = (id: TuneId) => readMidi(Uint8Array.from(atob(FILES[`../../public/assets/music/${TUNES[id].file}`].split(',')[1]), (c) => c.charCodeAt(0)));

const MAPS: TrackId[] = ['heath', 'fen', 'weald', 'marsh', 'reach'];
const melodic = (instrument: string): instrument is Melodic => instrument in RANGES;

describe('the music', () => {
  for (const id of Object.keys(TUNES) as TuneId[]) {
    const tune = TUNES[id];
    it(`${id}: every part we arrange is one of his, and every part of his is played`, () => {
      const midi = tuneFile(id);
      const his = midi.parts.map((p) => p.name);
      for (const part of Object.keys(tune.parts)) expect(his, part).toContain(part);
      for (const part of his) expect(tune.parts[part], `${id} leaves out ${part}`).toBeDefined();
    });

    it(`${id}: its notes sit in their instruments' keys, and inside the tune`, () => {
      const midi = tuneFile(id);
      const notes = notesOf(tune, midi);
      const seconds = lengthOf(tune, midi);
      expect(notes.length).toBeGreaterThan(0);
      for (const n of notes) {
        if (melodic(n.instrument)) expect(n.key >= RANGES[n.instrument][0] && n.key <= RANGES[n.instrument][1], `${n.instrument} ${n.key}`).toBe(true);
        expect(n.volume).toBeGreaterThan(0);
        // Every note starts within the tune, so a tune that loops comes round cleanly.
        expect(n.at >= 0 && n.at < seconds, `${n.instrument} at ${n.at}s of ${seconds}s`).toBe(true);
      }
      // A drum part plays only the drums it was given.
      for (const [name, voice] of Object.entries(tune.parts)) for (const v of [voice].flat()) if ('drums' in v) expect(Object.keys(v.drums).length, name).toBeGreaterThan(0);
    });
  }

  it('every tune is played somewhere, and every place has tunes', () => {
    const used = new Set(Object.values(TRACKS).flatMap((t) => t.tunes));
    for (const id of Object.keys(TUNES)) expect(used.has(id as TuneId), id).toBe(true);
    for (const t of Object.values(TRACKS)) expect(t.tunes.length, t.id).toBeGreaterThan(0);
  });

  it('a map turns through several tunes, and takes many minutes to come round again', () => {
    for (const id of MAPS) {
      const t = TRACKS[id];
      expect(new Set(t.tunes).size, id).toBeGreaterThanOrEqual(4);
      const minutes = t.tunes.reduce((sum, tune) => {
        const seconds = lengthOf(TUNES[tune], tuneFile(tune));
        return sum + seconds * lapsOf(seconds);
      }, 0) / 60;
      expect(minutes, id).toBeGreaterThan(6);
    }
  });

  it('a short tune plays through twice (or more) before the next one has its turn', () => {
    expect(lapsOf(150)).toBe(1);
    expect(lapsOf(TURN)).toBe(1);
    expect(lapsOf(60)).toBe(2);
    expect(lapsOf(20)).toBe(5);
  });

  it('a note out of an instrument\'s keys moves by octaves into them', () => {
    expect(fold(28, RANGES.upright)).toBe(40);
    expect(fold(50, RANGES.flute)).toBe(62);
    expect(fold(99, RANGES.oboe)).toBe(87);
    expect(fold(70, RANGES.flute)).toBe(70);
  });

  it("a villain's lair plays his theme sparer, brought up to the mark, and his whole band in his battle", () => {
    const [calm, fight] = [{ intensity: 0, balance: 0 }, { intensity: 0.25, balance: 0 }];
    for (const t of Object.values(TRACKS)) {
      if (t.calm === undefined) {
        expect(moodLevel(t, calm), t.id).toBe(1);
        continue;
      }
      // Some of his band waits for the fight.
      const voices = t.tunes.flatMap((id) => Object.values(TUNES[id].parts).flat());
      expect(voices.some((v) => v.gate?.from !== undefined && v.gate.from <= 0.25), t.id).toBe(true);
      expect(moodLevel(t, calm), t.id).toBe(t.calm);
      expect(moodLevel(t, fight), t.id).toBe(1);
    }
  });

  it('a battle builds, and turns with the fight', () => {
    const notes = notesOf(TUNES.battle, tuneFile('battle'));
    const playing = (mood: { intensity: number; balance: number }) => new Set(notes.filter((n) => gateLevel(n.gate, mood) > 0.5).map((n) => n.instrument));
    const start = playing({ intensity: 0.25, balance: 0 });
    expect(start.has('horn') && !start.has('snare')).toBe(true);
    expect(playing({ intensity: 0.8, balance: 0 }).has('snare')).toBe(true);
    expect(playing({ intensity: 0.8, balance: 0.6 }).has('glockenspiel')).toBe(true);
    const losing = playing({ intensity: 0.8, balance: -0.6 });
    expect(losing.has('oboe') && !losing.has('horn')).toBe(true);
  });

  it('parts come and go with the mood', () => {
    const map = { intensity: 0, balance: 0 };
    const fight = { intensity: 0.8, balance: 0 };
    expect(gateLevel(undefined, map)).toBe(1);
    expect(gateLevel({ from: 0.55 }, map)).toBe(0);
    expect(gateLevel({ from: 0.55 }, fight)).toBe(1);
    expect(gateLevel({ below: 0.2 }, map)).toBe(1);
    expect(gateLevel({ below: 0.2 }, fight)).toBe(0);
    expect(gateLevel({ mood: 'win' }, { intensity: 0.5, balance: 0.5 })).toBe(1);
    expect(gateLevel({ mood: 'win' }, { intensity: 0.5, balance: 0 })).toBe(0);
    expect(gateLevel({ mood: 'lose' }, { intensity: 0.5, balance: -0.5 })).toBe(1);
    expect(gateLevel({ mood: 'steady' }, { intensity: 0.5, balance: -0.5 })).toBe(0);
    expect(gateLevel({ mood: 'steady' }, { intensity: 0.5, balance: 0.1 })).toBe(1);
  });

  it('reads note names, for the stings', () => {
    expect(midiOf('A4')).toBe(69);
    expect(midiOf('F#4')).toBe(66);
    expect(midiOf('Bb3')).toBe(58);
  });
});
