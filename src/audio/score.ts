/**
 * The music: yubatake's tunes (CC BY 4.0), as he wrote them, in MIDI (`public/assets/music/`), played
 * on the band's General MIDI instruments (`band.ts`) as our arrangement has it here: for each tune,
 * which instrument plays each of his parts, and how loud. And for each place in the game, the tunes
 * that play there. A map has two that take turns, each playing through at least twice and for a few
 * minutes, so the music stays put (Artur, 2 Oct, #257: "it's very jarring that the music changes
 * constantly"); a battle has one. Which place's music plays when is `game/tunes.ts`.
 */
import { RANGES, type Drum, type Melodic } from './band';
import type { Expression, Midi } from './midi';

export type TrackId = 'title' | 'heath' | 'fen' | 'weald' | 'marsh' | 'reach' | 'battle' | 'court' | 'feast' | 'grimsby' | 'mirrow' | 'bramble';

/** One note to play, in seconds from the top of its tune, and the lane of swells and fades it plays through, if its part has one. */
export type Note = { at: number; length: number; key: number; instrument: Melodic | Drum; volume: number; lane?: number };

/**
 * Who plays one of his parts: an instrument, its notes moved `octave` octaves and folded into the
 * instrument's keys (`RANGES`), or the drums, each of his drum notes played on one of ours.
 */
export type Voice = ({ instrument: Melodic; octave?: number } | { drums: Record<number, Drum> }) & { volume: number };

export type TuneId = 'fields' | 'mysticIsle' | 'northernIsles' | 'mainTheme' | 'theRide' | 'battleBoss' | 'dungeon' | 'belle' | 'unquiet' | 'saltarello';

export type Tune = {
  /** His file, in `public/assets/music/`, and his name for it. */
  file: string;
  title: string;
  /** Each of his parts, by its track's name in the file, and who plays it (or several, doubling it). Parts not named are left out. */
  parts: Record<string, Voice | Voice[]>;
  /** Scales the whole tune, so every tune plays at the music's mark in the mix (`npm run listen -- tracks`). */
  level: number;
  /** He wrote it to come round again with no pause; otherwise it ends, and the next tune starts after a breath. */
  loops?: boolean;
  /** His parts swell and fade as his file says (its volume and expression), each through a lane of its own. */
  expression?: boolean;
  /** Plays this many dB under the music's mark: a fight's music, so its blows stand out over it (#257). */
  under?: number;
};

/** His drum notes played on our drums, at a volume. */
export const drums = (map: Record<number, Drum>, volume: number): Voice => ({ drums: map, volume });
/** His part played on one of our instruments, at a volume. */
export const play = (instrument: Melodic, volume: number, more: { octave?: number } = {}): Voice => ({ instrument, volume, ...more });

export const TUNES: Record<TuneId, Tune> = {
  // Aldmoor's: the isles' folk tune and a lilting three-time field, as Artur kept them on 2 Oct.
  fields: {
    file: 'JRPG_fields.mid',
    title: 'Fields',
    parts: { Lead_Square: play('flute', 0.9), Middle_Pulse: play('harp', 0.6), Bass_Tri: play('upright', 0.8), Mid_Aux: play('strings', 0.35) },
    level: 0.93,
    loops: true,
  },
  northernIsles: {
    file: 'NorthernIsles.mid',
    title: 'Northern Isles',
    parts: {
      Woodwind: play('flute', 0.85, { octave: 1 }),
      Dulcimer: play('harp', 0.5),
      BassLute: play('guitar', 0.55),
      Stringed: play('strings', 0.35),
      Drum: drums({ 86: 'tom', 87: 'stick' }, 0.3),
    },
    level: 0.71,
  },
  // The Fenmarch's: mist on the water.
  mysticIsle: {
    file: 'JRPG_mysticIsle.mid',
    title: 'Mystic Isle',
    parts: { Lead_Tri: play('flute', 0.9), ChordsUpper_Pulse: play('strings', 0.4), ChordsLower_Pulse: play('harp', 0.55), Bass_Tri: play('upright', 0.8) },
    level: 1.2,
  },
  // The court's since 1 Oct (#178): older music, made by people, as a small Renaissance consort would
  // play it (recorder, shawm, lute and viol), from the Mutopia Project's public-domain editions.
  belle: {
    file: 'Arbeau_BelleQui.mid',
    title: 'Belle qui tiens ma vie (Arbeau)',
    parts: { D: play('recorder', 0.8), Tr: play('oboe', 0.6), T: play('guitar', 0.6), B: play('strings', 0.5), tambour: drums({ 53: 'tom' }, 0.35) },
    level: 0.2,
  },
  unquiet: {
    file: 'Dowland_UnquietThoughts.mid',
    title: 'Unquiet Thoughts (Dowland)',
    parts: { cantus: play('flute', 0.8), altus: play('recorder', 0.6), tenor: play('guitar', 0.65), bass: play('strings', 0.5) },
    level: 0.22,
  },
  // The payday feast's (#191): a quick Italian dance for the lute, from the Mutopia Project's public-domain edition.
  // The harp plays his line as he wrote it, and the lute doubles it, its lowest notes an octave up.
  saltarello: {
    file: 'Galilei_Saltarello.mid',
    title: 'Saltarello (Galilei)',
    parts: { 'staff:staff first voice': [play('harp', 0.45), play('guitar', 0.75)] },
    level: 0.5,
  },
  // The title's.
  mainTheme: {
    file: 'JRPG_mainTheme.mid',
    title: 'Main Theme',
    parts: { Lead_Square: play('flute', 0.9), Middle_Pulse: play('harp', 0.6), Bass_Tri: play('upright', 0.8) },
    level: 0.65,
  },
  // Every battle's (#257): a brisk string quartet, each of his parts on its own instrument. Each
  // player has two parts, one for the quick notes and one for the long notes that swell and fade.
  theRide: {
    file: 'TheRide.mid',
    title: 'The Ride',
    parts: {
      ViolinI: play('violin', 0.85),
      ViolinIFades: play('violin', 0.75),
      ViolinII: play('violin', 0.7),
      ViolinIIFades: play('violin', 0.65),
      Viola: play('viola', 0.75),
      ViolaFades: play('viola', 0.7),
      Cello: play('cello', 0.85),
      CelloFades: play('cello', 0.8),
    },
    level: 0.41,
    under: 2,
    expression: true,
  },
  // The villains' themes, in their own fights.
  battleBoss: {
    file: 'JRPG_battleBoss.mid',
    title: 'Boss Battle',
    parts: {
      Lead_Square: [play('oboe', 0.8), play('horn', 0.6)],
      Middle_PulsePiano: play('harpsichord', 0.45),
      Middle_PulsePianoExtra: play('harpsichord', 0.45),
      Bass_Tri: play('upright', 0.85),
      WhiteNoiseDrum: drums({ 45: 'snare' }, 0.4),
      PinkNoiseRing: drums({ 45: 'ride' }, 0.25),
      PinkNoiseGong: drums({ 30: 'tom', 31: 'tom', 34: 'tom', 35: 'tom' }, 0.45),
    },
    level: 0.71,
    under: 2,
    loops: true,
  },
  dungeon: {
    file: 'JRPG_dungeon.mid',
    title: 'Dungeon',
    parts: { Lead_Pulse: play('oboe', 0.8), Middle_Pulse: play('harpsichord', 0.45), Bass_Tri: play('upright', 0.8), Percussion: drums({ 51: 'kick', 52: 'stick' }, 0.4) },
    level: 0.95,
    under: 2,
    loops: true,
  },
};

/** The music of a place: the tunes that take turns there, in order. */
export type TrackDef = {
  id: TrackId;
  tunes: TuneId[];
  /** Coming back to it (from a battle, say), it picks up the tune where it was, rather than starting the next. */
  resumes?: boolean;
};

export const TRACKS: Record<TrackId, TrackDef> = {
  title: { id: 'title', tunes: ['mainTheme'] },
  // Each commission's land has two tunes that take turns: Aldmoor's, the Fenmarch's, then the three beyond.
  heath: { id: 'heath', tunes: ['northernIsles', 'fields'], resumes: true },
  fen: { id: 'fen', tunes: ['mysticIsle', 'northernIsles'], resumes: true },
  weald: { id: 'weald', tunes: ['fields', 'northernIsles'], resumes: true },
  marsh: { id: 'marsh', tunes: ['mysticIsle', 'fields'], resumes: true },
  reach: { id: 'reach', tunes: ['northernIsles', 'mysticIsle'], resumes: true },
  court: { id: 'court', tunes: ['belle', 'unquiet'] },
  feast: { id: 'feast', tunes: ['saltarello'] },
  battle: { id: 'battle', tunes: ['theRide'] },
  grimsby: { id: 'grimsby', tunes: ['battleBoss'] },
  // Mother Mirrow's and Aunt Bramble's, until commission II is made again.
  mirrow: { id: 'mirrow', tunes: ['dungeon'] },
  bramble: { id: 'bramble', tunes: ['dungeon'] },
};

/** A tune plays through at least twice, and for at least this long, before the next one's turn. */
export const TURN = 240;
/** The breath between one tune's end and the next, or a tune that doesn't loop and its next time round. */
export const BREATH = 2.5;

/** How many times a tune plays through before the next one's turn. */
export const lapsOf = (seconds: number) => Math.max(2, Math.ceil(TURN / seconds));

/** A key moved by octaves into a range. */
export function fold(key: number, [low, high]: [number, number]): number {
  while (key < low) key += 12;
  while (key > high) key -= 12;
  return key;
}

/**
 * How long a tune lasts: to the bar line where it comes round again, if it loops; otherwise until
 * its last note ends.
 */
export function lengthOf(tune: Tune, midi: Midi): number {
  if (tune.loops) return midi.seconds;
  return Math.max(midi.seconds, ...midi.parts.flatMap((p) => p.notes.map((n) => n.at + n.length)));
}

/** A tune as our band plays it: every note, and the lanes of swells and fades its parts play through. */
export type Arrangement = { notes: Note[]; lanes: Expression[] };

/**
 * Every note of a tune, from his MIDI file as our band plays it: each part's notes for each of its
 * voices, folded into the instrument's keys, at a volume from its velocity (the square law General
 * MIDI asks for), its voice and the tune's level. A tune that loops leaves out a last note on the
 * bar line it comes round at: its first note plays there. A tune with `expression` gives each of its
 * parts that swell and fade a lane, and its notes play through it.
 */
export function arrange(tune: Tune, midi: Midi): Arrangement {
  const notes: Note[] = [];
  const lanes: Expression[] = [];
  const end = lengthOf(tune, midi);
  for (const part of midi.parts) {
    const voices = tune.parts[part.name];
    if (!voices) continue;
    let lane: number | undefined;
    if (tune.expression && part.expression) {
      lane = lanes.length;
      lanes.push(part.expression.filter(([at]) => at < end));
    }
    for (const voice of Array.isArray(voices) ? voices : [voices]) {
      for (const n of part.notes) {
        if (n.at >= end - 0.01) continue;
        const volume = voice.volume * (n.velocity / 127) ** 2 * tune.level;
        const where = lane === undefined ? {} : { lane };
        if ('drums' in voice) {
          const drum = voice.drums[n.key];
          if (drum) notes.push({ at: n.at, length: n.length, key: n.key, instrument: drum, volume, ...where });
          continue;
        }
        notes.push({ at: n.at, length: n.length, key: fold(n.key + 12 * (voice.octave ?? 0), RANGES[voice.instrument]), instrument: voice.instrument, volume, ...where });
      }
    }
  }
  return { notes: notes.sort((a, b) => a.at - b.at), lanes };
}

/** Every note of a tune, as `arrange` has it. */
export const notesOf = (tune: Tune, midi: Midi): Note[] => arrange(tune, midi).notes;

/** A lane's level at a moment of its tune: its last change before then, or General MIDI's own level before its first. */
export function laneLevel(lane: Expression, at: number): number {
  let level = 1;
  for (const [t, v] of lane) {
    if (t > at) break;
    level = v;
  }
  return level;
}

/** How far into its tune a track was at a moment: which time round, and how far into it. */
export function whereIn(start: number, loop: number, now: number): { lap: number; offset: number } {
  const gone = Math.max(0, now - start);
  const lap = Math.floor(gone / loop);
  return { lap, offset: gone - lap * loop };
}

const NAMES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** "F#4" to a MIDI note number (the stings are written in names). */
export function midiOf(name: string): number {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name);
  if (!m) throw new Error(`Not a note: ${name}`);
  return 12 * (Number(m[3]) + 1) + NAMES[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}
