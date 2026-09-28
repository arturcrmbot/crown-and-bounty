/**
 * The music, written down. Each track has sections (A, B...), each a chord for every bar and a melody
 * written out note by note, and accompaniment built from the chords by pattern: arpeggios, a bass, a
 * drone, drums. A track's form plays its sections in turn, each pass arranged its own way (another
 * lead, fewer parts, a drum that drops out), so the map's tunes take minutes to come round again.
 * Some parts only play in the right mood: as a battle builds, when you're winning or losing, or
 * near a villain's lair and not yet in his battle (see `Gate`). All of it is original, in the style
 * of a small medieval band.
 *
 * Melody notation: `D5:2 B4:1 G4:2 B4:1 | ...`, with notes as name and octave, `r` for a rest, and
 * lengths in the track's unit (an eighth note). Bars are separated by `|`.
 */
import type { InstrumentId } from './instruments';

export type TrackId = 'title' | 'heath' | 'fen' | 'weald' | 'marsh' | 'reach' | 'town' | 'battle' | 'court' | 'grimsby' | 'mirrow' | 'bramble';

/**
 * When a part plays: from an intensity up (a battle building), below one (a lair's quiet
 * arrangement, gone once the fighting starts), or in a mood: winning, losing, or anything but losing.
 */
export type Gate = { from?: number; below?: number; mood?: 'win' | 'lose' | 'steady' };

/** The music's mood: how hard the fighting is (0 on the map, rising through a battle), and who's winning (-1 to 1). */
export type Mood = { intensity: number; balance: number };

export type Note = { at: number; length: number; midi: number; instrument: InstrumentId; volume: number; gate?: Gate; lead?: boolean };

/** A pattern step: when in the bar (in units), which chord tone (0 root, 1 third, 2 fifth, 3 the octave), octave, length, volume. */
type Step = [at: number, tone: number, octave: number, length: number, volume?: number];

type Accompaniment = { gate?: Gate } & (
  | { kind: 'pattern'; instrument: InstrumentId; volume: number; steps: Step[]; bars?: number[] }
  | { kind: 'drums'; steps: [at: number, drum: 'tabor' | 'rim', volume: number][]; bars?: number[] }
);

export type Section = { chords: string[]; melody: string };

/** One time through a section: which lead plays it (or none), and which parts (all of them, if not said). */
export type Pass = { section: string; lead?: { instrument?: InstrumentId; volume?: number; octave?: number } | null; parts?: string[] };

export type TrackDef = {
  id: TrackId;
  /** Seconds per unit (an eighth note). */
  unit: number;
  unitsPerBar: number;
  /** Units in a bar where the melody must sit on a chord tone. */
  strong: number[];
  sections: Record<string, Section>;
  lead: { instrument: InstrumentId; volume: number };
  parts: Record<string, Accompaniment>;
  form: Pass[];
  /** Scales the whole track, so every track is about as loud as the others (see `npm run listen -- tracks`). */
  level?: number;
  /** Lively tunes: every other time round, the recorder and the fife swap. */
  swap?: boolean;
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

/** Every note of a track's whole form, in order, with starts in units from the top of the loop. */
export function notesOf(track: TrackDef): Note[] {
  const notes: Note[] = [];
  const level = track.level ?? 1;
  let bar = 0;
  for (const pass of track.form) {
    const section = track.sections[pass.section];
    const top = bar * track.unitsPerBar;
    if (pass.lead !== null) {
      const lead = { ...track.lead, ...pass.lead };
      const shift = 12 * (pass.lead?.octave ?? 0);
      parseMelody(section.melody).forEach((notesInBar, b) => {
        for (const n of notesInBar) if (n.name !== 'r') notes.push({ at: top + b * track.unitsPerBar + n.at, length: n.length, midi: midiOf(n.name) + shift, instrument: lead.instrument, volume: lead.volume * level, lead: true });
      });
    }
    for (const [name, part] of Object.entries(track.parts)) {
      if (pass.parts && !pass.parts.includes(name)) continue;
      section.chords.forEach((chord, b) => {
        if (part.bars && !part.bars.includes(b)) return;
        const at = top + b * track.unitsPerBar;
        if (part.kind === 'drums') {
          for (const [step, drum, volume] of part.steps) notes.push({ at: at + step, length: 0.5, midi: 0, instrument: drum, volume: volume * level, gate: part.gate });
          return;
        }
        for (const [step, tone, octave, length, volume] of part.steps) {
          notes.push({ at: at + step, length, midi: voice(chord, tone, octave), instrument: part.instrument, volume: (volume ?? 1) * part.volume * level, gate: part.gate });
        }
      });
    }
    bar += section.chords.length;
  }
  return notes.sort((a, b) => a.at - b.at);
}

/** The notes a track uses, as pitch classes: its tune's and its chords', which make its scale. */
export function scaleOf(track: TrackDef): number[] {
  const pcs = new Set<number>();
  for (const section of Object.values(track.sections)) {
    for (const bar of parseMelody(section.melody)) for (const n of bar) if (n.name !== 'r') pcs.add(midiOf(n.name) % 12);
    for (const chord of section.chords) for (const pc of chordTones(chord)) pcs.add(pc);
  }
  return [...pcs].sort((a, b) => a - b);
}

/** The next note up the scale from `midi`. */
export function stepUp(scale: number[], midi: number): number {
  for (let m = midi + 1; m <= midi + 3; m++) if (scale.includes(m % 12)) return m;
  return midi + 2;
}

export const loopUnits = (track: TrackDef) => track.form.reduce((sum, pass) => sum + track.sections[pass.section].chords.length, 0) * track.unitsPerBar;

/** How loudly a gated note plays in a mood: 0 not at all, 1 fully, fading in over a little of the way. */
export function gateLevel(gate: Gate | undefined, mood: Mood): number {
  if (!gate) return 1;
  const ramp = (v: number) => Math.max(0, Math.min(1, v));
  let level = 1;
  if (gate.from !== undefined) level *= ramp((mood.intensity - gate.from) / 0.12 + 1);
  if (gate.below !== undefined) level *= ramp((gate.below - mood.intensity) / 0.12);
  if (gate.mood === 'win') level *= ramp((mood.balance - 0.2) / 0.2);
  if (gate.mood === 'lose') level *= ramp((-mood.balance - 0.2) / 0.2);
  if (gate.mood === 'steady') level *= 1 - ramp((-mood.balance - 0.2) / 0.2);
  return level;
}

// --- Parts used by more than one track ------------------------------------------------------

/** A jig's lute: the chord broken across two beats of three. */
const JIG_LUTE: Step[] = [[0, 0, 3, 1], [1, 2, 3, 1, 0.7], [2, 1, 4, 1, 0.8], [3, 3, 3, 1, 0.9], [4, 1, 4, 1, 0.7], [5, 2, 3, 1, 0.7]];
/** Four-in-a-bar: a lute on the beat and its chord between. */
const REEL_LUTE: Step[] = [[0, 0, 3, 1], [1, 2, 3, 1, 0.6], [2, 1, 4, 1, 0.7], [3, 2, 3, 1, 0.6], [4, 3, 3, 1, 0.8], [5, 2, 3, 1, 0.6], [6, 1, 4, 1, 0.7], [7, 2, 3, 1, 0.6]];

// --- The tracks ---------------------------------------------------------------------------------

/** "The Heather Road": a jig in G for the open country, recorder over lute, bass and frame drum; the second strain climbs to E minor. */
const heath: TrackDef = {
  id: 'heath',
  unit: 0.3,
  unitsPerBar: 6,
  strong: [0, 3],
  sections: {
    A: {
      chords: ['G', 'C', 'G', 'D', 'G', 'C', 'D', 'G', 'Em', 'C', 'G', 'D', 'Em', 'C', 'D', 'G'],
      melody: `D5:2 B4:1 G4:2 B4:1 | C5:2 E5:1 G5:2 E5:1 | D5:2 B4:1 D5:1 C5:1 B4:1 | A4:3 F#4:2 A4:1 |
        B4:2 D5:1 G5:2 D5:1 | E5:2 C5:1 E5:1 D5:1 C5:1 | A4:2 F#4:1 A4:1 B4:1 C5:1 | B4:3 G4:3 |
        G5:2 E5:1 B4:2 E5:1 | G5:2 E5:1 C5:2 E5:1 | D5:2 G5:1 B4:2 D5:1 | A4:2 D5:1 F#4:2 A4:1 |
        B4:1 C5:1 D5:1 E5:2 B4:1 | C5:1 D5:1 E5:1 G5:2 E5:1 | D5:2 C5:1 A4:2 F#4:1 | G4:6`,
    },
    B: {
      chords: ['Em', 'C', 'G', 'D', 'Em', 'C', 'D', 'D', 'C', 'G', 'Am', 'Em', 'C', 'G', 'D', 'G'],
      melody: `E5:2 G5:1 B5:2 G5:1 | G5:2 E5:1 C5:2 E5:1 | D5:2 B4:1 G4:2 B4:1 | A4:2 D5:1 F#5:2 D5:1 |
        G5:2 F#5:1 E5:2 B4:1 | C5:1 D5:1 E5:1 G5:2 E5:1 | F#5:2 E5:1 D5:2 A4:1 | A4:3 D5:3 |
        E5:2 G5:1 C6:2 G5:1 | B5:2 G5:1 D5:2 G5:1 | A5:2 E5:1 C5:2 E5:1 | B4:2 E5:1 G5:2 E5:1 |
        G5:1 A5:1 G5:1 E5:2 C5:1 | D5:2 B4:1 G4:2 B4:1 | A4:1 B4:1 C5:1 D5:2 F#4:1 | G4:6`,
    },
  },
  lead: { instrument: 'recorder', volume: 0.3 },
  parts: {
    lute: { kind: 'pattern', instrument: 'lute', volume: 0.2, steps: JIG_LUTE },
    bass: { kind: 'pattern', instrument: 'bass', volume: 0.32, steps: [[0, 0, 2, 3], [3, 2, 2, 3, 0.8]] },
    drone: { kind: 'pattern', instrument: 'drone', volume: 0.05, steps: [[0, 0, 2, 6]] },
    drum: { kind: 'drums', steps: [[0, 'tabor', 0.35], [2, 'rim', 0.12], [3, 'tabor', 0.22], [5, 'rim', 0.12]] },
  },
  form: [
    { section: 'A', parts: ['lute', 'bass', 'drum'] },
    { section: 'B', lead: { instrument: 'fife', volume: 0.22 }, parts: ['lute', 'bass', 'drum'] },
    // A quiet verse: the harp has the tune, over the bass and a drone, and the drum rests.
    { section: 'A', lead: { instrument: 'harp', volume: 0.2 }, parts: ['bass', 'drone'] },
    { section: 'B', parts: ['lute', 'bass', 'drone', 'drum'] },
  ],
  level: 0.92,
  swap: true,
};

/** "Mist on the Meres": slow and uneasy, in D Dorian, harp and a hurdy-gurdy drone under the recorder; the middle turns to A minor. */
const fen: TrackDef = {
  id: 'fen',
  unit: 0.42,
  unitsPerBar: 6,
  strong: [0],
  sections: {
    A: {
      chords: ['Dm', 'Dm', 'C', 'C', 'G', 'G', 'Dm', 'Dm', 'F', 'C', 'G', 'Am', 'Dm', 'C', 'Am', 'Dm'],
      melody: `A4:6 | F4:2 E4:2 D4:2 | E4:4 G4:2 | E4:6 | G4:4 B4:2 | B4:4 A4:2 | A4:4 F4:2 | D4:6 |
        C5:4 A4:2 | G4:4 E4:2 | D5:4 B4:2 | C5:2 B4:2 A4:2 | A4:4 F4:2 | G4:4 E4:2 | E4:4 A4:2 | D4:6`,
    },
    B: {
      chords: ['Am', 'Am', 'G', 'G', 'F', 'C', 'Dm', 'Dm', 'F', 'G', 'Am', 'Am', 'Dm', 'C', 'G', 'Dm'],
      melody: `E5:4 C5:2 | A4:4 B4:2 | D5:4 B4:2 | G4:6 | A4:2 C5:2 F5:2 | E5:4 D5:2 | F5:4 E5:2 | D5:6 |
        C5:4 A4:2 | B4:4 D5:2 | C5:2 B4:2 A4:2 | E4:6 | F4:2 A4:2 D5:2 | E5:4 G4:2 | D5:2 B4:2 G4:2 | A4:6`,
    },
  },
  lead: { instrument: 'recorder', volume: 0.26 },
  parts: {
    harp: { kind: 'pattern', instrument: 'harp', volume: 0.17, steps: [[0, 0, 3, 2], [1, 2, 3, 2, 0.7], [2, 3, 3, 2, 0.8], [3, 1, 4, 2, 0.7], [4, 2, 4, 2, 0.6], [5, 1, 4, 2, 0.5]] },
    drone: { kind: 'pattern', instrument: 'drone', volume: 0.07, steps: [[0, 0, 2, 6], [0, 2, 2, 6, 0.7]] },
    bell: { kind: 'pattern', instrument: 'bell', volume: 0.07, steps: [[0, 0, 5, 6]], bars: [0, 8] },
    heart: { kind: 'drums', steps: [[0, 'tabor', 0.14], [1, 'tabor', 0.08]] },
  },
  form: [
    { section: 'A', parts: ['harp', 'drone', 'bell'] },
    { section: 'B', parts: ['harp', 'drone'] },
    // The mist thickens: only the drone and a far bell, and the harp picks out the tune.
    { section: 'A', lead: { instrument: 'harp', volume: 0.32 }, parts: ['drone', 'bell'] },
    // Something moves out on the water: a heartbeat under the harp.
    { section: 'B', parts: ['harp', 'drone', 'heart'] },
  ],
  level: 1.3,
};

/** "The Baron's Road": a reel in D Mixolydian for the country Grimsby ran to, fife and recorder by turns over lute and drum. */
const weald: TrackDef = {
  id: 'weald',
  unit: 0.2,
  unitsPerBar: 8,
  strong: [0, 4],
  sections: {
    A: {
      chords: ['D', 'D', 'C', 'C', 'D', 'G', 'C', 'D'],
      melody: `A4:1 D5:1 F#5:1 D5:1 A5:1 F#5:1 D5:1 F#5:1 | A5:2 F#5:1 E5:1 D5:2 A4:2 |
        G4:1 C5:1 E5:1 C5:1 G5:1 E5:1 C5:1 E5:1 | G5:2 E5:1 D5:1 C5:2 G4:2 |
        F#5:2 A5:2 D6:2 A5:2 | B5:2 G5:2 D5:2 B4:2 | C5:1 D5:1 E5:1 G5:1 E5:2 C5:2 | D5:4 A4:2 F#4:2`,
    },
    B: {
      chords: ['G', 'D', 'C', 'D', 'G', 'D', 'C', 'D'],
      melody: `B4:1 D5:1 G5:1 D5:1 B5:1 G5:1 D5:1 G5:1 | A5:2 F#5:2 D5:2 F#5:2 | G5:2 E5:1 G5:1 C6:2 G5:2 |
        F#5:1 E5:1 D5:1 E5:1 F#5:2 A5:2 | G5:2 B5:2 D6:2 B5:2 | A5:2 F#5:1 A5:1 D5:4 |
        E5:1 F#5:1 G5:1 E5:1 C5:2 E5:2 | D5:6 r:2`,
    },
  },
  lead: { instrument: 'recorder', volume: 0.26 },
  parts: {
    lute: { kind: 'pattern', instrument: 'lute', volume: 0.17, steps: REEL_LUTE },
    bass: { kind: 'pattern', instrument: 'bass', volume: 0.3, steps: [[0, 0, 2, 2], [2, 2, 2, 2, 0.7], [4, 0, 2, 2, 0.9], [6, 2, 2, 2, 0.7]] },
    drone: { kind: 'pattern', instrument: 'drone', volume: 0.05, steps: [[0, 0, 2, 8]], bars: [0, 1, 4, 7] },
    drum: { kind: 'drums', steps: [[0, 'tabor', 0.32], [2, 'rim', 0.12], [4, 'tabor', 0.24], [6, 'rim', 0.12], [7, 'rim', 0.06]] },
  },
  form: [
    { section: 'A', parts: ['lute', 'bass', 'drum'] },
    { section: 'A', lead: { instrument: 'fife', volume: 0.2 }, parts: ['lute', 'bass', 'drum'] },
    { section: 'B', parts: ['lute', 'bass', 'drum'] },
    { section: 'B', lead: { instrument: 'fife', volume: 0.2 }, parts: ['lute', 'bass', 'drone', 'drum'] },
    { section: 'A', lead: { instrument: 'harp', volume: 0.2 }, parts: ['bass', 'drone'] },
    { section: 'B', parts: ['lute', 'bass', 'drone', 'drum'] },
    { section: 'A', parts: ['lute', 'bass', 'drone', 'drum'] },
    { section: 'B', lead: { instrument: 'fife', volume: 0.2 }, parts: ['lute', 'bass', 'drum'] },
  ],
  level: 0.84,
  swap: true,
};

/** "Bramble's Water": a slow air in E minor for the witch's fen, the recorder over harp and drone, with a turn to G. */
const marsh: TrackDef = {
  id: 'marsh',
  unit: 0.38,
  unitsPerBar: 6,
  strong: [0],
  sections: {
    A: {
      chords: ['Em', 'Em', 'C', 'C', 'Am', 'Am', 'B', 'B', 'Em', 'Em', 'D', 'D', 'C', 'Am', 'B', 'Em'],
      melody: `B4:4 G4:2 | E5:4 D5:2 | E5:2 D5:2 C5:2 | G4:6 | A4:2 C5:2 E5:2 | E5:4 F#5:2 | D#5:4 F#5:2 | B4:6 |
        G5:4 F#5:2 | E5:2 B4:2 G4:2 | F#5:4 A5:2 | D5:6 | E5:2 G5:2 E5:2 | C5:4 B4:2 | D#5:2 F#5:2 B4:2 | E5:6`,
    },
    B: {
      chords: ['G', 'D', 'Em', 'C', 'G', 'D', 'C', 'B'],
      melody: `D5:4 B4:2 | A4:4 F#4:2 | G4:2 B4:2 E5:2 | G5:4 E5:2 | B5:4 G5:2 | A5:2 F#5:2 D5:2 | E5:4 C5:2 | F#5:6`,
    },
  },
  lead: { instrument: 'recorder', volume: 0.25 },
  parts: {
    harp: { kind: 'pattern', instrument: 'harp', volume: 0.16, steps: [[0, 0, 3, 2], [1, 2, 3, 2, 0.6], [2, 1, 4, 2, 0.7], [3, 3, 3, 2, 0.7], [4, 2, 3, 2, 0.6], [5, 1, 4, 2, 0.5]] },
    drone: { kind: 'pattern', instrument: 'drone', volume: 0.065, steps: [[0, 0, 2, 6], [0, 2, 2, 6, 0.6]] },
    bell: { kind: 'pattern', instrument: 'bell', volume: 0.06, steps: [[0, 1, 5, 6]], bars: [0, 7] },
    heart: { kind: 'drums', steps: [[0, 'tabor', 0.13], [1, 'tabor', 0.07]] },
    drip: { kind: 'drums', steps: [[3, 'rim', 0.05]], bars: [1, 3, 5, 9, 12] },
  },
  form: [
    { section: 'A', parts: ['harp', 'drone', 'drip'] },
    { section: 'B', parts: ['harp', 'drone', 'bell'] },
    { section: 'A', lead: { instrument: 'harp', volume: 0.32 }, parts: ['drone', 'drip', 'bell'] },
    { section: 'B', lead: { instrument: 'recorder', volume: 0.25, octave: 0 }, parts: ['harp', 'drone', 'heart'] },
  ],
  level: 1.26,
};

/** "The Last Commission": broad and hopeful, in D; its second strain is the title's tune, the King's own, on brass. */
const reach: TrackDef = {
  id: 'reach',
  unit: 0.3,
  unitsPerBar: 8,
  strong: [0, 4],
  sections: {
    A: {
      chords: ['D', 'Bm', 'G', 'A', 'D', 'Bm', 'Em', 'A'],
      melody: `D5:3 E5:1 F#5:2 A5:2 | B5:4 F#5:2 D5:2 | G5:3 A5:1 B5:2 G5:2 | A5:4 E5:2 C#5:2 |
        F#5:3 E5:1 D5:2 F#5:2 | D5:2 F#5:2 B5:4 | G5:3 F#5:1 E5:2 B4:2 | A4:4 C#5:2 E5:2`,
    },
    B: {
      chords: ['D', 'G', 'A', 'D', 'Bm', 'G', 'A', 'D'],
      melody: `F#4:2 A4:2 D5:4 | B4:2 D5:2 G5:4 | E5:2 C#5:2 A4:4 | D5:8 | F#5:2 D5:2 B4:4 | G5:4 D5:2 B4:2 | A4:2 C#5:2 E5:2 C#5:2 | D5:8`,
    },
  },
  lead: { instrument: 'recorder', volume: 0.27 },
  parts: {
    harp: { kind: 'pattern', instrument: 'harp', volume: 0.15, steps: [[0, 0, 3, 2], [1, 2, 3, 2, 0.6], [2, 1, 4, 2, 0.7], [3, 3, 3, 2, 0.8], [4, 2, 4, 2, 0.6], [5, 3, 3, 2, 0.6], [6, 1, 4, 2, 0.7], [7, 2, 3, 2, 0.5]] },
    bass: { kind: 'pattern', instrument: 'bass', volume: 0.28, steps: [[0, 0, 2, 4], [4, 2, 2, 4, 0.8]] },
    brass: { kind: 'pattern', instrument: 'brass', volume: 0.09, steps: [[0, 0, 4, 6], [0, 1, 4, 6], [0, 2, 3, 6]], bars: [0, 4] },
    bells: { kind: 'pattern', instrument: 'bell', volume: 0.07, steps: [[0, 0, 5, 8]], bars: [0, 3, 7] },
    drum: { kind: 'drums', steps: [[0, 'tabor', 0.24], [4, 'tabor', 0.16], [6, 'rim', 0.08], [7, 'rim', 0.08]] },
  },
  form: [
    { section: 'A', parts: ['harp', 'bass', 'drum'] },
    { section: 'B', lead: { instrument: 'brass', volume: 0.2 }, parts: ['harp', 'bass', 'drum'] },
    { section: 'A', lead: { instrument: 'fife', volume: 0.2 }, parts: ['harp', 'bass', 'brass', 'drum'] },
    { section: 'B', parts: ['harp', 'bass', 'bells'] },
    { section: 'A', lead: { instrument: 'harp', volume: 0.2 }, parts: ['bass', 'bells'] },
    { section: 'B', parts: ['harp', 'bass', 'brass', 'drum'] },
  ],
  level: 1.19,
  swap: true,
};

/** "Market Day": what a castle or village sounds like while you're in it: a bright round dance in C. */
const town: TrackDef = {
  id: 'town',
  unit: 0.19,
  unitsPerBar: 8,
  strong: [0, 4],
  sections: {
    A: {
      chords: ['C', 'G', 'Am', 'F', 'C', 'F', 'G', 'C'],
      melody: `E5:2 G5:2 E5:1 D5:1 C5:2 | D5:2 B4:2 G4:2 B4:2 | C5:2 E5:2 A5:2 E5:2 | F5:2 E5:1 D5:1 C5:4 |
        G5:2 E5:2 C5:2 E5:2 | A5:2 F5:2 C5:2 A4:2 | B4:2 D5:2 G5:2 F5:2 | E5:4 C5:4`,
    },
    B: {
      chords: ['F', 'C', 'Dm', 'G', 'F', 'C', 'G', 'C'],
      melody: `A5:3 G5:1 F5:2 A5:2 | G5:2 E5:2 C5:4 | F5:2 D5:2 A4:2 D5:2 | B4:2 D5:2 G5:4 |
        C6:2 A5:2 F5:2 A5:2 | G5:2 E5:2 G5:1 E5:1 C5:2 | D5:2 G5:2 B4:2 D5:2 | C5:6 r:2`,
    },
  },
  lead: { instrument: 'recorder', volume: 0.26 },
  parts: {
    lute: { kind: 'pattern', instrument: 'lute', volume: 0.18, steps: [[0, 0, 3, 2], [2, 1, 4, 1, 0.6], [2, 2, 3, 1, 0.6], [4, 2, 3, 2, 0.8], [6, 1, 4, 1, 0.6], [6, 3, 3, 1, 0.6]] },
    bass: { kind: 'pattern', instrument: 'bass', volume: 0.28, steps: [[0, 0, 2, 3], [4, 2, 2, 3, 0.8]] },
    drum: { kind: 'drums', steps: [[0, 'tabor', 0.3], [2, 'rim', 0.14], [4, 'tabor', 0.22], [6, 'rim', 0.14], [7, 'rim', 0.07]] },
  },
  form: [
    { section: 'A' },
    { section: 'B' },
    { section: 'A', lead: { instrument: 'fife', volume: 0.2 } },
    { section: 'B', lead: { instrument: 'harp', volume: 0.2 }, parts: ['bass', 'drum'] },
  ],
  swap: true,
};

/**
 * "Steel and Feathers": a driving fife march in E minor, with a galloping bass and drums. It builds
 * with the fight: the lute comes in, then the brass, then more drums; winning, the brass calls
 * above it and a harp rings; losing, the lute falls silent and a drone and a bell darken it.
 */
const battle: TrackDef = {
  id: 'battle',
  unit: 0.215,
  unitsPerBar: 8,
  strong: [0, 4],
  sections: {
    A: {
      chords: ['Em', 'Em', 'C', 'D', 'Em', 'Em', 'C', 'B', 'Am', 'Em', 'C', 'D', 'Am', 'Em', 'B', 'Em'],
      melody: `E5:4 B4:2 G4:2 | G4:2 A4:2 B4:4 | C5:2 B4:1 A4:1 G4:2 E4:2 | F#4:2 A4:2 D5:4 |
        E5:3 D5:1 B4:2 G4:2 | B4:1 A4:1 G4:1 A4:1 B4:4 | C5:2 E5:2 G5:2 E5:2 | D#5:4 B4:2 F#4:2 |
        C5:2 A4:2 E5:4 | B4:2 G4:2 E4:4 | E5:2 D5:1 C5:1 G4:4 | F#4:2 A4:2 D5:2 A4:2 |
        A4:2 C5:2 E5:2 C5:2 | G5:2 E5:2 B4:4 | F#5:2 D#5:2 B4:2 A4:2 | G4:1 F#4:1 E4:6`,
    },
    B: {
      chords: ['Am', 'Am', 'Em', 'Em', 'C', 'D', 'B7', 'Em'],
      melody: `A5:2 E5:2 C5:2 E5:2 | A5:1 B5:1 C6:2 A5:4 | G5:2 E5:2 B4:2 E5:2 | E5:1 F#5:1 G5:2 E5:4 |
        E5:2 G5:2 C6:2 G5:2 | F#5:2 A5:2 D6:2 A5:2 | D#6:2 B5:2 A5:2 F#5:2 | E5:4 B4:2 G4:2`,
    },
  },
  lead: { instrument: 'fife', volume: 0.24 },
  parts: {
    bass: { kind: 'pattern', instrument: 'bass', volume: 0.26, steps: [[0, 0, 2, 1], [1, 0, 2, 1, 0.6], [2, 0, 2, 1, 0.8], [3, 2, 2, 1, 0.7], [4, 0, 2, 1], [5, 0, 2, 1, 0.6], [6, 3, 2, 1, 0.8], [7, 2, 2, 1, 0.7]] },
    drum: { kind: 'drums', steps: [[0, 'tabor', 0.5], [2, 'rim', 0.25], [3, 'tabor', 0.25], [4, 'tabor', 0.45], [6, 'rim', 0.25], [7, 'rim', 0.1]] },
    lute: { kind: 'pattern', instrument: 'lute', volume: 0.14, steps: [[0, 0, 3, 2], [0, 1, 3, 2], [0, 2, 3, 2], [4, 0, 3, 2, 0.8], [4, 1, 3, 2, 0.8], [4, 2, 3, 2, 0.8]], gate: { from: 0.35, mood: 'steady' } },
    brass: { kind: 'pattern', instrument: 'brass', volume: 0.13, steps: [[0, 0, 4, 3], [0, 2, 3, 3]], bars: [0, 4, 8, 12], gate: { from: 0.55 } },
    rush: { kind: 'drums', steps: [[1, 'rim', 0.12], [5, 'tabor', 0.2], [6, 'tabor', 0.16], [7, 'tabor', 0.22]], gate: { from: 0.7 } },
    call: { kind: 'pattern', instrument: 'brass', volume: 0.11, steps: [[0, 0, 4, 1.5], [2, 2, 4, 1.5], [4, 3, 4, 3]], bars: [1, 3, 5, 7, 9, 11, 13, 15], gate: { mood: 'win' } },
    ring: { kind: 'pattern', instrument: 'harp', volume: 0.1, steps: [[0, 0, 4, 1], [1, 1, 4, 1], [2, 2, 4, 1], [3, 3, 4, 2]], bars: [2, 6, 10, 14], gate: { mood: 'win' } },
    dark: { kind: 'pattern', instrument: 'drone', volume: 0.08, steps: [[0, 0, 2, 8], [0, 2, 2, 8, 0.8]], gate: { mood: 'lose' } },
    toll: { kind: 'pattern', instrument: 'knell', volume: 0.12, steps: [[0, 0, 4, 4]], bars: [0, 4], gate: { mood: 'lose' } },
  },
  form: [{ section: 'A' }, { section: 'B' }, { section: 'A', lead: { instrument: 'recorder', volume: 0.28 } }, { section: 'B' }],
  level: 0.95,
  swap: true,
};

/** "The King's Pavane": stately, in F, harpsichord and recorder, with bells for a court. */
const court: TrackDef = {
  id: 'court',
  unit: 0.39,
  unitsPerBar: 8,
  strong: [0, 4],
  sections: {
    A: {
      chords: ['F', 'Bb', 'C', 'F', 'Dm', 'Bb', 'C', 'F', 'Bb', 'F', 'Gm', 'C', 'Dm', 'Bb', 'C', 'F'],
      melody: `A4:4 C5:2 A4:2 | D5:4 Bb4:2 F4:2 | E4:2 G4:2 C5:4 | A4:8 | F4:2 A4:2 D5:2 C5:2 | Bb4:4 D5:2 Bb4:2 | C5:2 Bb4:2 G4:2 E4:2 | F4:8 |
        D5:4 F5:2 D5:2 | C5:4 A4:2 F4:2 | G4:2 Bb4:2 D5:4 | E5:4 C5:2 G4:2 | F5:4 D5:2 A4:2 | Bb4:2 D5:2 F5:4 | E5:2 C5:2 G4:2 E4:2 | F4:8`,
    },
  },
  lead: { instrument: 'recorder', volume: 0.27 },
  parts: {
    harpsichord: { kind: 'pattern', instrument: 'harpsichord', volume: 0.15, steps: [[0, 0, 3, 1], [1, 2, 3, 1, 0.6], [2, 1, 4, 1, 0.7], [3, 2, 3, 1, 0.6], [4, 3, 3, 1, 0.8], [5, 2, 3, 1, 0.6], [6, 1, 4, 1, 0.7], [7, 2, 3, 1, 0.6]] },
    bass: { kind: 'pattern', instrument: 'bass', volume: 0.28, steps: [[0, 0, 2, 4], [4, 2, 2, 4, 0.8]] },
    bell: { kind: 'pattern', instrument: 'bell', volume: 0.08, steps: [[0, 0, 5, 8]], bars: [0, 8] },
    drum: { kind: 'drums', steps: [[0, 'tabor', 0.16]] },
  },
  form: [{ section: 'A' }, { section: 'A', lead: { instrument: 'harpsichord', volume: 0.2 }, parts: ['bass', 'bell', 'drum'] }],
  level: 1.19,
};

/** "The King's Commission": the title, in D, harp arpeggios and brass under a broad recorder tune. */
const title: TrackDef = {
  id: 'title',
  unit: 0.36,
  unitsPerBar: 8,
  strong: [0, 4],
  sections: {
    A: {
      chords: ['D', 'G', 'A', 'D', 'Bm', 'G', 'A', 'D'],
      melody: `F#4:2 A4:2 D5:4 | B4:2 D5:2 G5:4 | E5:2 C#5:2 A4:4 | D5:8 | F#5:2 D5:2 B4:4 | G5:4 D5:2 B4:2 | A4:2 C#5:2 E5:2 C#5:2 | D5:8`,
    },
  },
  lead: { instrument: 'recorder', volume: 0.28 },
  parts: {
    harp: { kind: 'pattern', instrument: 'harp', volume: 0.16, steps: [[0, 0, 3, 2], [1, 2, 3, 2, 0.6], [2, 1, 4, 2, 0.7], [3, 3, 3, 2, 0.8], [4, 2, 4, 2, 0.6], [5, 3, 3, 2, 0.6], [6, 1, 4, 2, 0.7], [7, 2, 3, 2, 0.5]] },
    drone: { kind: 'pattern', instrument: 'drone', volume: 0.06, steps: [[0, 0, 2, 8], [0, 2, 2, 8, 0.7]] },
    brass: { kind: 'pattern', instrument: 'brass', volume: 0.1, steps: [[0, 0, 4, 6], [0, 1, 4, 6], [0, 2, 3, 6]], bars: [0, 4] },
    drum: { kind: 'drums', steps: [[0, 'tabor', 0.22], [6, 'tabor', 0.12], [7, 'tabor', 0.12]], bars: [3, 7] },
  },
  form: [{ section: 'A' }],
  level: 1.22,
};

/**
 * "The Baron's March": Grimsby's own, pompous and dotted, in C. By his stockade it's a lone fife over
 * a low horn and a slow drum behind the walls; in his battle the whole band marches, and it trips
 * over its own feet at the end of the second strain.
 */
const grimsby: TrackDef = {
  id: 'grimsby',
  unit: 0.27,
  unitsPerBar: 8,
  strong: [0, 4],
  sections: {
    A: {
      chords: ['C', 'C', 'G', 'G', 'F', 'C', 'G7', 'C'],
      melody: `C5:3 C5:1 E5:3 E5:1 | G5:4 E5:2 C5:2 | D5:3 D5:1 B4:3 B4:1 | G4:4 r:2 G4:1 A4:1 |
        A4:3 C5:1 F5:3 A5:1 | G5:3 F5:1 E5:2 D5:2 | D5:3 E5:1 F5:2 B4:2 | C5:4 G4:2 C5:2`,
    },
    B: {
      chords: ['F', 'G', 'Em', 'Am', 'F', 'C', 'G7', 'C'],
      melody: `F5:3 F5:1 A5:3 A5:1 | G5:4 D5:2 B4:2 | E5:3 E5:1 G5:3 G5:1 | A5:2 G5:1 F5:1 E5:4 |
        C5:3 C5:1 F5:3 F5:1 | E5:2 G5:2 C6:4 | B5:1 A5:1 G5:1 F5:1 D5:2 B4:2 | C5:2 r:2 C5:1 r:1 C5:2`,
    },
  },
  lead: { instrument: 'fife', volume: 0.22 },
  parts: {
    horn: { kind: 'pattern', instrument: 'brass', volume: 0.1, steps: [[0, 0, 3, 7]], gate: { below: 0.2 } },
    slow: { kind: 'drums', steps: [[0, 'tabor', 0.2], [4, 'tabor', 0.1]], gate: { below: 0.2 } },
    oompah: { kind: 'pattern', instrument: 'brass', volume: 0.1, steps: [[0, 0, 2, 1.5], [2, 2, 3, 1, 0.7], [2, 1, 3, 1, 0.7], [4, 2, 2, 1.5, 0.9], [6, 2, 3, 1, 0.7], [6, 1, 3, 1, 0.7]], gate: { from: 0.2 } },
    bass: { kind: 'pattern', instrument: 'bass', volume: 0.26, steps: [[0, 0, 2, 2], [4, 2, 2, 2, 0.8]], gate: { from: 0.2 } },
    march: { kind: 'drums', steps: [[0, 'tabor', 0.45], [2, 'tabor', 0.25], [4, 'tabor', 0.4], [6, 'tabor', 0.25], [7, 'rim', 0.15], [3, 'rim', 0.12]], gate: { from: 0.2 } },
    fanfare: { kind: 'pattern', instrument: 'brass', volume: 0.1, steps: [[0, 0, 4, 2], [0, 2, 4, 2], [4, 3, 4, 3]], bars: [1, 3, 5, 7], gate: { from: 0.2, mood: 'win' } },
    dread: { kind: 'pattern', instrument: 'drone', volume: 0.07, steps: [[0, 0, 2, 8]], gate: { from: 0.2, mood: 'lose' } },
  },
  form: [
    { section: 'A' },
    { section: 'A', lead: { instrument: 'recorder', volume: 0.25 } },
    { section: 'B' },
    { section: 'A', lead: { instrument: 'brass', volume: 0.2 } },
    { section: 'B', lead: { instrument: 'fife', volume: 0.22 } },
  ],
  level: 1.5,
  swap: true,
};

/**
 * "The Bog Waltz": Mother Mirrow's, in A minor, lurching on its third beat. At her hut the harp's
 * oom-pah-pah and a drone; in her battle a bass, drums and brass join the dance.
 */
const mirrow: TrackDef = {
  id: 'mirrow',
  unit: 0.2,
  unitsPerBar: 6,
  strong: [0],
  sections: {
    A: {
      chords: ['Am', 'Am', 'E', 'E', 'Am', 'Am', 'Dm', 'E', 'F', 'C', 'Dm', 'Am', 'F', 'E', 'Am', 'Am'],
      melody: `E5:4 C5:2 | A4:2 B4:2 C5:2 | B4:4 G#4:2 | E4:6 | A4:2 C5:2 E5:2 | A5:4 G#5:2 | F5:2 E5:2 D5:2 | E5:4 D5:1 B4:1 |
        C5:4 A4:2 | G4:2 C5:2 E5:2 | D5:4 F5:2 | E5:2 C5:2 A4:2 | A4:4 C5:2 | B4:2 G#4:2 E4:2 | A4:6 | r:2 E4:2 A4:2`,
    },
    B: {
      chords: ['C', 'G', 'Am', 'E', 'F', 'C', 'Dm', 'E'],
      melody: `G5:4 E5:2 | D5:4 B4:2 | C5:2 E5:2 A5:2 | G#5:4 B5:2 | A5:2 F5:2 C5:2 | E5:4 G4:2 | F4:2 A4:2 D5:2 | E5:6`,
    },
  },
  lead: { instrument: 'recorder', volume: 0.25 },
  parts: {
    pah: { kind: 'pattern', instrument: 'harp', volume: 0.14, steps: [[0, 0, 3, 2], [2, 1, 4, 1.5, 0.7], [2, 2, 4, 1.5, 0.7], [4, 1, 4, 1.5, 0.6], [4, 2, 4, 1.5, 0.6]] },
    hum: { kind: 'pattern', instrument: 'drone', volume: 0.06, steps: [[0, 0, 2, 6]], gate: { below: 0.2 } },
    bass: { kind: 'pattern', instrument: 'bass', volume: 0.28, steps: [[0, 0, 2, 2]], gate: { from: 0.2 } },
    drum: { kind: 'drums', steps: [[0, 'tabor', 0.38], [2, 'rim', 0.14], [4, 'rim', 0.12]], gate: { from: 0.2 } },
    stab: { kind: 'pattern', instrument: 'brass', volume: 0.1, steps: [[0, 0, 3, 1.5], [0, 1, 3, 1.5]], bars: [2, 3, 7, 13], gate: { from: 0.2 } },
    bell: { kind: 'pattern', instrument: 'bell', volume: 0.07, steps: [[0, 1, 5, 6]], bars: [0, 8] },
    cackle: { kind: 'pattern', instrument: 'fife', volume: 0.08, steps: [[3, 3, 4, 0.5], [3.5, 2, 4, 0.5], [4, 1, 4, 0.5], [4.5, 0, 4, 1]], bars: [5, 11], gate: { from: 0.2, mood: 'lose' } },
  },
  form: [{ section: 'A' }, { section: 'B' }, { section: 'A', lead: { instrument: 'fife', volume: 0.2 } }, { section: 'B', lead: { instrument: 'harp', volume: 0.3 }, parts: ['hum', 'bass', 'drum', 'stab', 'bell'] }],
  level: 1.2,
};

/**
 * "Bramble's Temper": Aunt Bramble's, a stamping witch's jig in G minor, bigger and crosser than her
 * sister's waltz. A hurdy-gurdy growls under it all; by her lair a stamp, in her battle the drums,
 * the bass and the brass.
 */
const bramble: TrackDef = {
  id: 'bramble',
  unit: 0.19,
  unitsPerBar: 6,
  strong: [0, 3],
  sections: {
    A: {
      chords: ['Gm', 'F', 'Eb', 'D', 'Gm', 'Cm', 'D', 'Gm'],
      melody: `G5:2 D5:1 Bb4:2 D5:1 | A5:2 F5:1 C5:2 F5:1 | G5:2 Eb5:1 Bb4:2 Eb5:1 | F#5:2 A5:1 D5:2 C5:1 |
        Bb5:1 A5:1 G5:1 D5:2 G5:1 | C5:2 Eb5:1 G5:2 Eb5:1 | D5:1 D5:1 D5:1 F#5:2 A5:1 | G5:3 G4:3`,
    },
    B: {
      chords: ['Eb', 'Bb', 'Cm', 'Gm', 'Eb', 'Bb', 'Cm', 'D'],
      melody: `Bb5:2 G5:1 Eb5:2 G5:1 | F5:2 D5:1 Bb4:2 D5:1 | Eb5:2 G5:1 C6:2 G5:1 | D5:2 Bb4:1 G4:2 Bb4:1 |
        G5:1 G5:1 G5:1 Bb5:2 G5:1 | F5:2 D5:1 F5:2 Bb5:1 | G5:2 Eb5:1 C5:2 Eb5:1 | D5:3 F#5:3`,
    },
  },
  lead: { instrument: 'fife', volume: 0.22 },
  parts: {
    growl: { kind: 'pattern', instrument: 'drone', volume: 0.07, steps: [[0, 0, 2, 6], [0, 2, 2, 6, 0.6]] },
    stamp: { kind: 'drums', steps: [[0, 'tabor', 0.48], [3, 'tabor', 0.35]], gate: { below: 0.2 } },
    bass: { kind: 'pattern', instrument: 'bass', volume: 0.22, steps: [[0, 0, 2, 2], [3, 0, 2, 2, 0.9]], gate: { from: 0.2 } },
    drum: { kind: 'drums', steps: [[0, 'tabor', 0.38], [1, 'rim', 0.09], [2, 'rim', 0.08], [3, 'tabor', 0.32], [4, 'rim', 0.09], [5, 'rim', 0.08]], gate: { from: 0.2 } },
    lute: { kind: 'pattern', instrument: 'lute', volume: 0.11, steps: JIG_LUTE, gate: { from: 0.4 } },
    brass: { kind: 'pattern', instrument: 'brass', volume: 0.09, steps: [[0, 0, 3, 2], [0, 2, 3, 2]], bars: [0, 3, 4, 7], gate: { from: 0.2 } },
    toll: { kind: 'pattern', instrument: 'knell', volume: 0.1, steps: [[0, 0, 4, 4]], bars: [0, 4], gate: { from: 0.2, mood: 'lose' } },
  },
  form: [
    { section: 'A' },
    { section: 'A', lead: { instrument: 'recorder', volume: 0.25 } },
    { section: 'B' },
    { section: 'B', lead: { instrument: 'brass', volume: 0.22 } },
  ],
  level: 1.25,
  swap: true,
};

export const TRACKS: Record<TrackId, TrackDef> = { title, heath, fen, weald, marsh, reach, town, battle, court, grimsby, mirrow, bramble };
