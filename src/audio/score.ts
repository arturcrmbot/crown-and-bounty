/**
 * The music, written down. Each track has a chord for every bar, a melody written out note by note,
 * and accompaniment built from the chords by pattern: arpeggios, a bass, a drone, drums. All of it is
 * original, in the style of a small medieval band.
 *
 * Melody notation: `D5:2 B4:1 G4:2 B4:1 | ...`, with notes as name and octave, `r` for a rest, and
 * lengths in the track's unit (an eighth note). Bars are separated by `|`.
 */
import type { InstrumentId } from './instruments';

export type TrackId = 'title' | 'heath' | 'fen' | 'battle' | 'court';

export type Note = { at: number; length: number; midi: number; instrument: InstrumentId; volume: number };

/** A pattern step: when in the bar (in units), which chord tone (0 root, 1 third, 2 fifth, 3 the octave), octave, length, volume. */
type Step = [at: number, tone: number, octave: number, length: number, volume?: number];

type Accompaniment =
  | { kind: 'pattern'; instrument: InstrumentId; volume: number; steps: Step[]; bars?: number[] }
  | { kind: 'drums'; steps: [at: number, drum: 'tabor' | 'rim', volume: number][]; bars?: number[] };

export type TrackDef = {
  id: TrackId;
  /** Seconds per unit (an eighth note). */
  unit: number;
  unitsPerBar: number;
  /** Units in a bar where the melody must sit on a chord tone. */
  strong: number[];
  chords: string[];
  melody: { instrument: InstrumentId; volume: number; text: string };
  parts: Accompaniment[];
};

const NAMES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** "F#4" to a MIDI note number. */
export function midiOf(name: string): number {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name);
  if (!m) throw new Error(`Not a note: ${name}`);
  return 12 * (Number(m[3]) + 1) + NAMES[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}

/** A chord's pitch classes: root, third and fifth (and a seventh with 7). "Em", "F#", "Bb", "D7". */
export function chordTones(chord: string): number[] {
  const m = /^([A-G])(#|b)?(m)?(7)?$/.exec(chord);
  if (!m) throw new Error(`Not a chord: ${chord}`);
  const root = (NAMES[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12;
  const tones = [root, (root + (m[3] ? 3 : 4)) % 12, (root + 7) % 12];
  return m[4] ? [...tones, (root + 10) % 12] : tones;
}

/** A chord tone as a MIDI note: tone 0 is the root, 1 the third, 2 the fifth, 3 the root an octave up. */
function voice(chord: string, tone: number, octave: number): number {
  const tones = chordTones(chord);
  const root = 12 * (octave + 1) + tones[0];
  const pc = tones[tone % 3];
  const up = (pc - tones[0] + 12) % 12;
  return root + up + (tone >= 3 ? 12 : 0);
}

/** The melody's bars, parsed: each note's start in the bar and its length. */
export function parseMelody(text: string): { at: number; length: number; name: string }[][] {
  return text.split('|').map((bar) => {
    let at = 0;
    return bar
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((token) => {
        const [name, length] = token.split(':');
        const note = { at, length: Number(length), name };
        at += Number(length);
        return note;
      });
  });
}

/** Every note of a track, in order, with starts in units from the top of the loop. */
export function notesOf(track: TrackDef): Note[] {
  const notes: Note[] = [];
  parseMelody(track.melody.text).forEach((bar, b) => {
    for (const n of bar) if (n.name !== 'r') notes.push({ at: b * track.unitsPerBar + n.at, length: n.length, midi: midiOf(n.name), instrument: track.melody.instrument, volume: track.melody.volume });
  });
  for (const part of track.parts) {
    track.chords.forEach((chord, b) => {
      if (part.bars && !part.bars.includes(b)) return;
      if (part.kind === 'drums') {
        for (const [at, drum, volume] of part.steps) notes.push({ at: b * track.unitsPerBar + at, length: 0.5, midi: 0, instrument: drum, volume });
        return;
      }
      for (const [at, tone, octave, length, volume] of part.steps) {
        notes.push({ at: b * track.unitsPerBar + at, length, midi: voice(chord, tone, octave), instrument: part.instrument, volume: (volume ?? 1) * part.volume });
      }
    });
  }
  return notes.sort((a, b) => a.at - b.at);
}

export const loopUnits = (track: TrackDef) => track.chords.length * track.unitsPerBar;

// --- The tracks ---------------------------------------------------------------------------------

/** "The Heather Road": a jig in G for the open country, recorder over lute, bass and frame drum. */
const heath: TrackDef = {
  id: 'heath',
  unit: 0.3,
  unitsPerBar: 6,
  strong: [0, 3],
  chords: ['G', 'C', 'G', 'D', 'G', 'C', 'D', 'G', 'Em', 'C', 'G', 'D', 'Em', 'C', 'D', 'G'],
  melody: {
    instrument: 'recorder',
    volume: 0.3,
    text: `D5:2 B4:1 G4:2 B4:1 | C5:2 E5:1 G5:2 E5:1 | D5:2 B4:1 D5:1 C5:1 B4:1 | A4:3 F#4:2 A4:1 |
      B4:2 D5:1 G5:2 D5:1 | E5:2 C5:1 E5:1 D5:1 C5:1 | A4:2 F#4:1 A4:1 B4:1 C5:1 | B4:3 G4:3 |
      G5:2 E5:1 B4:2 E5:1 | G5:2 E5:1 C5:2 E5:1 | D5:2 G5:1 B4:2 D5:1 | A4:2 D5:1 F#4:2 A4:1 |
      B4:1 C5:1 D5:1 E5:2 B4:1 | C5:1 D5:1 E5:1 G5:2 E5:1 | D5:2 C5:1 A4:2 F#4:1 | G4:6`,
  },
  parts: [
    { kind: 'pattern', instrument: 'lute', volume: 0.2, steps: [[0, 0, 3, 1], [1, 2, 3, 1, 0.7], [2, 1, 4, 1, 0.8], [3, 3, 3, 1, 0.9], [4, 1, 4, 1, 0.7], [5, 2, 3, 1, 0.7]] },
    { kind: 'pattern', instrument: 'bass', volume: 0.32, steps: [[0, 0, 2, 3], [3, 2, 2, 3, 0.8]] },
    { kind: 'drums', steps: [[0, 'tabor', 0.35], [2, 'rim', 0.12], [3, 'tabor', 0.22], [5, 'rim', 0.12]] },
  ],
};

/** "Mist on the Meres": slow and uneasy, in D Dorian, harp and a hurdy-gurdy drone under the recorder. */
const fen: TrackDef = {
  id: 'fen',
  unit: 0.42,
  unitsPerBar: 6,
  strong: [0],
  chords: ['Dm', 'Dm', 'C', 'C', 'G', 'G', 'Dm', 'Dm', 'F', 'C', 'G', 'Am', 'Dm', 'C', 'Am', 'Dm'],
  melody: {
    instrument: 'recorder',
    volume: 0.26,
    text: `A4:6 | F4:2 E4:2 D4:2 | E4:4 G4:2 | E4:6 | G4:4 B4:2 | B4:4 A4:2 | A4:4 F4:2 | D4:6 |
      C5:4 A4:2 | G4:4 E4:2 | D5:4 B4:2 | C5:2 B4:2 A4:2 | A4:4 F4:2 | G4:4 E4:2 | E4:4 A4:2 | D4:6`,
  },
  parts: [
    { kind: 'pattern', instrument: 'harp', volume: 0.17, steps: [[0, 0, 3, 2], [1, 2, 3, 2, 0.7], [2, 3, 3, 2, 0.8], [3, 1, 4, 2, 0.7], [4, 2, 4, 2, 0.6], [5, 1, 4, 2, 0.5]] },
    { kind: 'pattern', instrument: 'drone', volume: 0.07, steps: [[0, 0, 2, 6], [0, 2, 2, 6, 0.7]] },
    { kind: 'pattern', instrument: 'bell', volume: 0.07, steps: [[0, 0, 5, 6]], bars: [0, 8] },
  ],
};

/** "Steel and Feathers": a driving fife march in E minor, with a galloping bass and drums. */
const battle: TrackDef = {
  id: 'battle',
  unit: 0.215,
  unitsPerBar: 8,
  strong: [0, 4],
  chords: ['Em', 'Em', 'C', 'D', 'Em', 'Em', 'C', 'B', 'Am', 'Em', 'C', 'D', 'Am', 'Em', 'B', 'Em'],
  melody: {
    instrument: 'fife',
    volume: 0.24,
    text: `E5:4 B4:2 G4:2 | G4:2 A4:2 B4:4 | C5:2 B4:1 A4:1 G4:2 E4:2 | F#4:2 A4:2 D5:4 |
      E5:3 D5:1 B4:2 G4:2 | B4:1 A4:1 G4:1 A4:1 B4:4 | C5:2 E5:2 G5:2 E5:2 | D#5:4 B4:2 F#4:2 |
      C5:2 A4:2 E5:4 | B4:2 G4:2 E4:4 | E5:2 D5:1 C5:1 G4:4 | F#4:2 A4:2 D5:2 A4:2 |
      A4:2 C5:2 E5:2 C5:2 | G5:2 E5:2 B4:4 | F#5:2 D#5:2 B4:2 A4:2 | G4:1 F#4:1 E4:6`,
  },
  parts: [
    { kind: 'pattern', instrument: 'bass', volume: 0.26, steps: [[0, 0, 2, 1], [1, 0, 2, 1, 0.6], [2, 0, 2, 1, 0.8], [3, 2, 2, 1, 0.7], [4, 0, 2, 1], [5, 0, 2, 1, 0.6], [6, 3, 2, 1, 0.8], [7, 2, 2, 1, 0.7]] },
    { kind: 'pattern', instrument: 'lute', volume: 0.14, steps: [[0, 0, 3, 2], [0, 1, 3, 2], [0, 2, 3, 2], [4, 0, 3, 2, 0.8], [4, 1, 3, 2, 0.8], [4, 2, 3, 2, 0.8]] },
    { kind: 'pattern', instrument: 'brass', volume: 0.13, steps: [[0, 0, 4, 3], [0, 2, 3, 3]], bars: [0, 4, 8, 12] },
    { kind: 'drums', steps: [[0, 'tabor', 0.5], [2, 'rim', 0.25], [3, 'tabor', 0.25], [4, 'tabor', 0.45], [6, 'rim', 0.25], [7, 'rim', 0.1]] },
  ],
};

/** "The King's Pavane": stately, in F, harpsichord and recorder, with bells for a court. */
const court: TrackDef = {
  id: 'court',
  unit: 0.39,
  unitsPerBar: 8,
  strong: [0, 4],
  chords: ['F', 'Bb', 'C', 'F', 'Dm', 'Bb', 'C', 'F', 'Bb', 'F', 'Gm', 'C', 'Dm', 'Bb', 'C', 'F'],
  melody: {
    instrument: 'recorder',
    volume: 0.27,
    text: `A4:4 C5:2 A4:2 | D5:4 Bb4:2 F4:2 | E4:2 G4:2 C5:4 | A4:8 | F4:2 A4:2 D5:2 C5:2 | Bb4:4 D5:2 Bb4:2 | C5:2 Bb4:2 G4:2 E4:2 | F4:8 |
      D5:4 F5:2 D5:2 | C5:4 A4:2 F4:2 | G4:2 Bb4:2 D5:4 | E5:4 C5:2 G4:2 | F5:4 D5:2 A4:2 | Bb4:2 D5:2 F5:4 | E5:2 C5:2 G4:2 E4:2 | F4:8`,
  },
  parts: [
    { kind: 'pattern', instrument: 'harpsichord', volume: 0.15, steps: [[0, 0, 3, 1], [1, 2, 3, 1, 0.6], [2, 1, 4, 1, 0.7], [3, 2, 3, 1, 0.6], [4, 3, 3, 1, 0.8], [5, 2, 3, 1, 0.6], [6, 1, 4, 1, 0.7], [7, 2, 3, 1, 0.6]] },
    { kind: 'pattern', instrument: 'bass', volume: 0.28, steps: [[0, 0, 2, 4], [4, 2, 2, 4, 0.8]] },
    { kind: 'pattern', instrument: 'bell', volume: 0.08, steps: [[0, 0, 5, 8]], bars: [0, 8] },
    { kind: 'drums', steps: [[0, 'tabor', 0.16]] },
  ],
};

/** "The King's Commission": the title, in D, harp arpeggios and brass under a broad recorder tune. */
const title: TrackDef = {
  id: 'title',
  unit: 0.36,
  unitsPerBar: 8,
  strong: [0, 4],
  chords: ['D', 'G', 'A', 'D', 'Bm', 'G', 'A', 'D'],
  melody: {
    instrument: 'recorder',
    volume: 0.28,
    text: `F#4:2 A4:2 D5:4 | B4:2 D5:2 G5:4 | E5:2 C#5:2 A4:4 | D5:8 | F#5:2 D5:2 B4:4 | G5:4 D5:2 B4:2 | A4:2 C#5:2 E5:2 C#5:2 | D5:8`,
  },
  parts: [
    { kind: 'pattern', instrument: 'harp', volume: 0.16, steps: [[0, 0, 3, 2], [1, 2, 3, 2, 0.6], [2, 1, 4, 2, 0.7], [3, 3, 3, 2, 0.8], [4, 2, 4, 2, 0.6], [5, 3, 3, 2, 0.6], [6, 1, 4, 2, 0.7], [7, 2, 3, 2, 0.5]] },
    { kind: 'pattern', instrument: 'drone', volume: 0.06, steps: [[0, 0, 2, 8], [0, 2, 2, 8, 0.7]] },
    { kind: 'pattern', instrument: 'brass', volume: 0.1, steps: [[0, 0, 4, 6], [0, 1, 4, 6], [0, 2, 3, 6]], bars: [0, 4] },
    { kind: 'drums', steps: [[0, 'tabor', 0.22], [6, 'tabor', 0.12], [7, 'tabor', 0.12]], bars: [3, 7] },
  ],
};

export const TRACKS: Record<TrackId, TrackDef> = { title, heath, fen, battle, court };
