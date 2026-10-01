/**
 * The music: Yubatake's tunes from his "JRPG Collection" and his "Northern Isles" (CC-BY 4.0), as he wrote them, in MIDI
 * (`public/assets/music/`), played on the band's General MIDI instruments (`band.ts`) as our
 * arrangement has it here: for each tune, which instrument plays each of his parts, how loud, and in
 * which mood. And for each place in the game, the tunes that take turns there: on a map each plays
 * through (twice, if it's short), and after a breath the next begins, so the music never stays on
 * one tune for long. Some parts only play in the right mood: as a battle builds, when you're winning
 * or losing, or once a villain's fight has started, his lair's quieter arrangement filling out (see
 * `Gate`). Which place's music plays when is `game/tunes.ts`.
 */
import { RANGES, type Drum, type Melodic } from './band';
import type { Midi } from './midi';

export type TrackId = 'title' | 'heath' | 'fen' | 'weald' | 'marsh' | 'reach' | 'battle' | 'court' | 'feast' | 'grimsby' | 'mirrow' | 'bramble';

/**
 * When a part plays: from an intensity up (a battle building, or a villain's fight begun), below
 * one (gone once the fighting starts), or in a mood: winning, losing, or anything but losing.
 */
export type Gate = { from?: number; below?: number; mood?: 'win' | 'lose' | 'steady' };

/** The music's mood: how hard the fighting is (0 on the map, rising through a battle), and who's winning (-1 to 1). */
export type Mood = { intensity: number; balance: number };

/** One note to play, in seconds from the top of its tune. */
export type Note = { at: number; length: number; key: number; instrument: Melodic | Drum; volume: number; gate?: Gate };

/**
 * Who plays one of his parts: an instrument, its notes moved `octave` octaves and folded into the
 * instrument's keys (`RANGES`), or the drums, each of his drum notes played on one of ours.
 */
export type Voice = ({ instrument: Melodic; octave?: number } | { drums: Record<number, Drum> }) & { volume: number; gate?: Gate };

export type TuneId =
  | 'fields' | 'town' | 'mysticIsle' | 'northernIsles' | 'docks' | 'temple'
  | 'mainTheme' | 'battle' | 'battleBoss' | 'labyrinth' | 'dungeon' | 'belle' | 'unquiet' | 'saltarello';

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
};

const drums = (map: Record<number, Drum>, volume: number, gate?: Gate): Voice => ({ drums: map, volume, gate });
const play = (instrument: Melodic, volume: number, more: { octave?: number; gate?: Gate } = {}): Voice => ({ instrument, volume, ...more });

/** Into a villain's fight: the parts his lair's quieter arrangement leaves out. */
const FIGHT: Gate = { from: 0.2 };

export const TUNES: Record<TuneId, Tune> = {
  // The maps': a lilting three-time field and the town (Aldmoor's turn also has the isles' folk tune, the docks, the temple and the labyrinth, as Artur chose on 1 Oct).
  fields: {
    file: 'JRPG_fields.mid',
    title: 'Fields',
    parts: { Lead_Square: play('flute', 0.9), Middle_Pulse: play('harp', 0.6), Bass_Tri: play('upright', 0.8), Mid_Aux: play('strings', 0.35) },
    level: 0.93,
    loops: true,
  },
  town: {
    file: 'JRPG_town.mid',
    title: 'Town',
    parts: {
      Lead_Pulse: play('oboe', 0.8),
      Middle_Pulse: play('harp', 0.55),
      Middle_Pulse_Extra: play('glockenspiel', 0.3),
      Bass_Short: play('pizzicato', 0.6),
      Bass_Long: play('upright', 0.7),
      Percussion: drums({ 52: 'tambourine' }, 0.28),
    },
    level: 1.1,
    loops: true,
  },
  // The Fenmarch's: mist on the water, a folk tune from the isles, the boats at the jetty, and a quiet shrine.
  mysticIsle: {
    file: 'JRPG_mysticIsle.mid',
    title: 'Mystic Isle',
    parts: { Lead_Tri: play('flute', 0.9), ChordsUpper_Pulse: play('strings', 0.4), ChordsLower_Pulse: play('harp', 0.55), Bass_Tri: play('upright', 0.8) },
    level: 1.2,
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
  docks: {
    file: 'JRPG_docks.mid',
    title: 'Docks',
    parts: { Lead_Square: play('clarinet', 0.85), Middle_Square: play('harp', 0.55), Bass_Tri: play('upright', 0.8), Percussion: drums({ 57: 'hat' }, 0.28) },
    level: 1.4,
    loops: true,
  },
  temple: {
    file: 'JRPG_temple.mid',
    title: 'Temple',
    parts: { Lead_Square: play('oboe', 0.8), Middle_Square: play('harp', 0.55), Bass_Tri: play('strings', 0.5) },
    level: 1.3,
  },
  // The court's since 1 Oct (#178): older music, made by people, as a small Renaissance consort would
  // play it (recorder, shawm, lute and viol), from the Mutopia Project's public-domain editions.
  belle: {
    file: 'Arbeau_BelleQui.mid',
    title: 'Belle qui tiens ma vie (Arbeau)',
    parts: { D: play('recorder', 0.8), Tr: play('oboe', 0.6), T: play('guitar', 0.6), B: play('strings', 0.5), tambour: drums({ 53: 'tom' }, 0.35) },
    level: 0.19,
  },
  unquiet: {
    file: 'Dowland_UnquietThoughts.mid',
    title: 'Unquiet Thoughts (Dowland)',
    parts: { cantus: play('flute', 0.8), altus: play('recorder', 0.6), tenor: play('guitar', 0.65), bass: play('strings', 0.5) },
    level: 0.21,
  },
  // The payday feast's (#191): a quick Italian dance for the lute, from the Mutopia Project's public-domain edition.
  // The harp plays his line as he wrote it, and the lute doubles it, its lowest notes an octave up.
  saltarello: {
    file: 'Galilei_Saltarello.mid',
    title: 'Saltarello (Galilei)',
    parts: { 'staff:staff first voice': [play('harp', 0.45), play('guitar', 0.75)] },
    level: 0.47,
  },
  // The title's, and the court's.
  mainTheme: {
    file: 'JRPG_mainTheme.mid',
    title: 'Main Theme',
    parts: { Lead_Square: play('flute', 0.9), Middle_Pulse: play('harp', 0.6), Bass_Tri: play('upright', 0.8) },
    level: 0.65,
  },
  // A battle: the horn leads, the drums come in as it heats up, strings join the fight, a
  // glockenspiel rings over the tune while you're winning, and the oboe takes it over while you're losing.
  battle: {
    file: 'JRPG_battle.mid',
    title: 'Battle',
    parts: {
      Lead_Square: [play('horn', 0.85, { gate: { mood: 'steady' } }), play('oboe', 0.85, { gate: { mood: 'lose' } }), play('glockenspiel', 0.3, { gate: { mood: 'win' } })],
      Middle_Pulse: play('pizzicato', 0.5),
      Bass_Tri: [play('upright', 0.85), play('strings', 0.35, { gate: { from: 0.55 } })],
      Percussion: drums({ 55: 'kick', 57: 'snare' }, 0.4, { from: 0.35 }),
    },
    level: 0.95,
    loops: true,
  },
  // The villains' themes: by the lair, only some of the band, and all of it once his fight begins.
  battleBoss: {
    file: 'JRPG_battleBoss.mid',
    title: 'Boss Battle',
    parts: {
      Lead_Square: [play('oboe', 0.8), play('horn', 0.6, { gate: { from: 0.55 } })],
      Middle_PulsePiano: play('harpsichord', 0.45),
      Middle_PulsePianoExtra: play('harpsichord', 0.45),
      Bass_Tri: play('upright', 0.85),
      WhiteNoiseDrum: drums({ 45: 'snare' }, 0.4, FIGHT),
      PinkNoiseRing: drums({ 45: 'ride' }, 0.25, FIGHT),
      PinkNoiseGong: drums({ 30: 'tom', 31: 'tom', 34: 'tom', 35: 'tom' }, 0.45, FIGHT),
    },
    level: 1.1,
    loops: true,
  },
  labyrinth: {
    file: 'JRPG_labyrinth.mid',
    title: 'Labyrinth',
    parts: { Lead_Pulse: play('clarinet', 0.85), Middle_Pulse: play('harp', 0.55, { gate: FIGHT }), Bass_Tri: play('pizzicato', 0.8), Percussion: drums({ 51: 'kick', 52: 'stick' }, 0.4, FIGHT) },
    level: 1.15,
    loops: true,
  },
  dungeon: {
    file: 'JRPG_dungeon.mid',
    title: 'Dungeon',
    parts: { Lead_Pulse: play('oboe', 0.8), Middle_Pulse: play('harpsichord', 0.45, { gate: FIGHT }), Bass_Tri: play('upright', 0.8), Percussion: drums({ 51: 'kick', 52: 'stick' }, 0.4, FIGHT) },
    level: 1.1,
    loops: true,
  },
};

/** The music of a place: the tunes that take turns there, in order. */
export type TrackDef = {
  id: TrackId;
  tunes: TuneId[];
  /**
   * Scales a villain's theme by his lair, on the map, where it's his quieter arrangement: up to
   * the mark, as his whole band is in his battle.
   */
  calm?: number;
};

export const TRACKS: Record<TrackId, TrackDef> = {
  title: { id: 'title', tunes: ['mainTheme'] },
  // Each commission's land has its own turn of tunes: Aldmoor's farms, the Fenmarch's meres, then the three beyond.
  heath: { id: 'heath', tunes: ['northernIsles', 'fields', 'docks', 'town', 'temple', 'labyrinth'] },
  fen: { id: 'fen', tunes: ['mysticIsle', 'northernIsles', 'docks', 'temple'] },
  weald: { id: 'weald', tunes: ['fields', 'town', 'northernIsles', 'temple'] },
  marsh: { id: 'marsh', tunes: ['docks', 'mysticIsle', 'temple', 'northernIsles'] },
  reach: { id: 'reach', tunes: ['town', 'fields', 'docks', 'northernIsles'] },
  court: { id: 'court', tunes: ['belle', 'unquiet'] },
  feast: { id: 'feast', tunes: ['saltarello'] },
  battle: { id: 'battle', tunes: ['battle'] },
  grimsby: { id: 'grimsby', tunes: ['battleBoss'], calm: 1 },
  mirrow: { id: 'mirrow', tunes: ['labyrinth'], calm: 1 },
  bramble: { id: 'bramble', tunes: ['dungeon'], calm: 1.25 },
};

/** A tune shorter than this plays through twice before the next one's turn. */
export const TURN = 90;
/** The breath between one tune's end and the next, or a tune that doesn't loop and its next time round. */
export const BREATH = 2.5;

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

/**
 * Every note of a tune, from his MIDI file as our band plays it: each part's notes for each of its
 * voices, folded into the instrument's keys, at a volume from its velocity (the square law General
 * MIDI asks for), its voice and the tune's level. A tune that loops leaves out a last note on the
 * bar line it comes round at: its first note plays there.
 */
export function notesOf(tune: Tune, midi: Midi): Note[] {
  const notes: Note[] = [];
  const end = lengthOf(tune, midi);
  for (const part of midi.parts) {
    const voices = tune.parts[part.name];
    if (!voices) continue;
    for (const voice of Array.isArray(voices) ? voices : [voices]) {
      for (const n of part.notes) {
        if (n.at >= end - 0.01) continue;
        const volume = voice.volume * (n.velocity / 127) ** 2 * tune.level;
        if ('drums' in voice) {
          const drum = voice.drums[n.key];
          if (drum) notes.push({ at: n.at, length: n.length, key: n.key, instrument: drum, volume, gate: voice.gate });
          continue;
        }
        notes.push({ at: n.at, length: n.length, key: fold(n.key + 12 * (voice.octave ?? 0), RANGES[voice.instrument]), instrument: voice.instrument, volume, gate: voice.gate });
      }
    }
  }
  return notes.sort((a, b) => a.at - b.at);
}

/** How many times a tune plays through before the next one's turn: once, or twice if it's short. */
export const lapsOf = (seconds: number) => (seconds < TURN / 2 ? Math.ceil(TURN / seconds) : seconds < TURN ? 2 : 1);

/** How loud the whole track plays in a mood: its `calm` level on the map, giving way to 1 as a fight begins (as a lair's parts give way to the battle's). */
export function moodLevel(track: TrackDef, mood: Mood): number {
  return track.calm === undefined ? 1 : 1 + (track.calm - 1) * gateLevel({ below: 0.2 }, mood);
}

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

const NAMES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** "F#4" to a MIDI note number (the stings are written in names). */
export function midiOf(name: string): number {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name);
  if (!m) throw new Error(`Not a note: ${name}`);
  return 12 * (Number(m[3]) + 1) + NAMES[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}
