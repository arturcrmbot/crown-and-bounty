import { describe, expect, it } from 'vitest';
import { RANGES, type Melodic } from './band';
import { readMidi } from './midi';
import { arrange, fold, laneLevel, lapsOf, lengthOf, midiOf, notesOf, TRACKS, TUNES, TURN, whereIn, type TrackId, type TuneId } from './score';

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

  it('a map has two tunes that take turns, and each plays for minutes before the other', () => {
    for (const id of MAPS) {
      const t = TRACKS[id];
      expect(new Set(t.tunes).size, id).toBe(2);
      expect(t.resumes, id).toBe(true);
      for (const tune of t.tunes) {
        const seconds = lengthOf(TUNES[tune], tuneFile(tune));
        expect(seconds * lapsOf(seconds), `${id} ${tune}`).toBeGreaterThanOrEqual(TURN);
      }
    }
    // A battle plays its one tune, and picks up nowhere: it begins on the downbeat after the sting.
    expect(TRACKS.battle.tunes).toEqual(['theRide']);
    expect(TRACKS.battle.resumes).toBeUndefined();
  });

  it('a tune plays through twice (or more) before the next one has its turn', () => {
    expect(lapsOf(400)).toBe(2);
    expect(lapsOf(TURN)).toBe(2);
    expect(lapsOf(121)).toBe(2);
    expect(lapsOf(60)).toBe(4);
    expect(lapsOf(24)).toBe(10);
  });

  it('a map picks up where it was', () => {
    expect(whereIn(100, 60, 100)).toEqual({ lap: 0, offset: 0 });
    expect(whereIn(100, 60, 130)).toEqual({ lap: 0, offset: 30 });
    expect(whereIn(100, 60, 175)).toEqual({ lap: 1, offset: 15 });
    // Before it began: the top.
    expect(whereIn(100, 60, 90)).toEqual({ lap: 0, offset: 0 });
  });

  it('a note out of an instrument\'s keys moves by octaves into them', () => {
    expect(fold(28, RANGES.upright)).toBe(40);
    expect(fold(50, RANGES.flute)).toBe(62);
    expect(fold(99, RANGES.oboe)).toBe(87);
    expect(fold(70, RANGES.flute)).toBe(70);
  });

  it('The Ride swells and fades as yubatake wrote it, each player through a lane of his own', () => {
    const { notes, lanes } = arrange(TUNES.theRide, tuneFile('theRide'));
    expect(lanes.length).toBe(8);
    for (const lane of lanes) {
      expect(lane.length).toBeGreaterThan(100);
      for (const [at, level] of lane) expect(at >= 0 && level >= 0 && level <= 1.7, `${at} ${level}`).toBe(true);
    }
    // Every note plays through a lane, on the quartet's own instruments.
    for (const n of notes) expect(n.lane !== undefined && n.lane < lanes.length).toBe(true);
    expect(new Set(notes.map((n) => n.instrument))).toEqual(new Set(['violin', 'viola', 'cello']));
    // Before a part's first change it plays at General MIDI's own level; after, at its last.
    expect(laneLevel([[1, 0.5], [2, 0.8]], 0.5)).toBe(1);
    expect(laneLevel([[1, 0.5], [2, 0.8]], 1.5)).toBe(0.5);
    expect(laneLevel([[1, 0.5], [2, 0.8]], 9)).toBe(0.8);
  });

  it('no other tune has lanes, so it plays as it always has', () => {
    for (const id of Object.keys(TUNES) as TuneId[]) if (id !== 'theRide') expect(arrange(TUNES[id], tuneFile(id)).lanes, id).toEqual([]);
  });

  it('reads note names, for the stings', () => {
    expect(midiOf('A4')).toBe(69);
    expect(midiOf('F#4')).toBe(66);
    expect(midiOf('Bb3')).toBe(58);
  });
});
