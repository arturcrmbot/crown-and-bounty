/**
 * Stings: a few seconds of music for a moment that matters. A screen changing (into battle, to
 * court), a fight won or lost, a commission paid or failed. Each is written out note by note, for
 * the same band as the score. The score ducks under a sting, and a sting that leads into a new
 * screen holds that screen's music back until it has rung.
 */
import { audio, isMuted } from './context';
import { playNote, type InstrumentId } from './instruments';
import { dipAmbience } from './ambience';
import { cueMusic, duckMusic } from './music';
import { midiOf } from './score';

export type StingId = 'curtain' | 'battle' | 'court' | 'victory' | 'defeat' | 'bounty' | 'lost' | 'payday' | 'levelUp';

/** One note: instrument, seconds from the start, note name (or a drum), seconds long, volume. */
type Hit = [instrument: InstrumentId, at: number, note: string, length: number, volume: number];

export type StingDef = {
  /** The key it's in, like "E minor": every pitched note belongs to it (see the test). */
  key: string;
  hits: Hit[];
  /** Scales every note, so each sting sits at the stings' mark in the mix, a little over the music (see `npm run listen -- stings`). */
  level: number;
  /** Seconds the score stays ducked under it (and the land's sounds dipped). */
  duck: number;
  /** If it leads into a new screen: seconds before that screen's music may start. */
  next?: number;
};

/** A drum roll: `count` strokes from `from` to `to` seconds, swelling from `soft` to `loud`. */
function roll(from: number, to: number, count: number, soft: number, loud: number): Hit[] {
  return Array.from({ length: count }, (_, i) => ['tabor', from + ((to - from) * i) / (count - 1), 'C3', 0.1, soft + ((loud - soft) * i) / (count - 1)] as Hit);
}

/** Notes up a chord, one after another, `gap` seconds apart, each ringing `length`. */
function run(instrument: InstrumentId, at: number, notes: string[], gap: number, length: number, volume: number, fall = 0): Hit[] {
  return notes.map((note, i) => [instrument, at + i * gap, note, length, volume * (1 - (fall * i) / notes.length)] as Hit);
}

export const STINGS: Record<StingId, StingDef> = {
  // The title's painting gives way to the court: a harp sweeps up into the court's key of F.
  curtain: {
    key: 'F major',
    level: 0.6,
    hits: [...run('harp', 0, ['F3', 'A3', 'C4', 'F4', 'A4', 'C5', 'F5', 'A5', 'C6'], 0.05, 1.5, 0.3, 0.3), ['bell', 0.45, 'F5', 1, 0.07]],
    duck: 0.9,
    next: 0.55,
  },
  // Into battle: a drum roll, a clash of steel, and the brass bark once as the battle music starts.
  battle: {
    key: 'E minor',
    level: 1.5,
    hits: [...roll(0, 0.36, 8, 0.12, 0.5), ['steel', 0.4, 'C6', 1, 0.5], ['tabor', 0.4, 'C3', 0.3, 0.8], ['brass', 0.4, 'E3', 0.32, 0.26], ['brass', 0.4, 'B3', 0.32, 0.22], ['brass', 0.4, 'E4', 0.32, 0.18]],
    duck: 0.6,
    next: 0.52,
  },
  // To court: two heralds' trumpets in thirds, in F, over a roll on the kettle.
  court: {
    key: 'F major',
    level: 1.62,
    hits: [
      ...run('brass', 0, ['C5', 'C5', 'C5'], 0.13, 0.1, 0.24),
      ...run('brass', 0, ['A4', 'A4', 'A4'], 0.13, 0.1, 0.2),
      ['brass', 0.39, 'F5', 0.95, 0.26],
      ['brass', 0.39, 'C5', 0.95, 0.22],
      ['brass', 0.39, 'A4', 0.95, 0.2],
      ...roll(0.39, 1.1, 12, 0.1, 0.3),
      ['tabor', 1.2, 'C3', 0.3, 0.6],
      ['bell', 0.39, 'F6', 1, 0.06],
    ],
    duck: 1.2,
    next: 1.25,
  },
  // A fight won: the battle's E minor turns to E major, up the chord and held, on the drum.
  victory: {
    key: 'E major',
    level: 1.45,
    hits: [
      ...run('brass', 0, ['B3', 'E4', 'G#4'], 0.11, 0.1, 0.26),
      ['brass', 0.33, 'B4', 1, 0.28],
      ['brass', 0.33, 'G#4', 1, 0.22],
      ['brass', 0.33, 'E4', 1, 0.22],
      ['tabor', 0, 'C3', 0.2, 0.5],
      ['tabor', 0.33, 'C3', 0.2, 0.7],
      ['bell', 0.33, 'E6', 1, 0.07],
      ...run('harp', 0.35, ['E5', 'G#5', 'B5', 'E6'], 0.05, 1, 0.14),
    ],
    duck: 1.5,
  },
  // A fight lost: a low bell tolls twice over a dark drone, and the lute falls away.
  defeat: {
    key: 'E minor',
    level: 1.29,
    hits: [
      ['knell', 0, 'E4', 3, 0.3],
      ['knell', 1.2, 'E4', 3, 0.2],
      ['drone', 0, 'E2', 2.2, 0.08],
      ['drone', 0, 'B2', 2.2, 0.06],
      ...run('lute', 0.35, ['B3', 'G3', 'F#3', 'E3'], 0.3, 0.6, 0.2),
    ],
    duck: 2.4,
  },
  // A commission done and the bounty paid: the brass climb D major, the bells ring, the harp sparkles.
  bounty: {
    key: 'D major',
    level: 1.45,
    hits: [
      ...run('brass', 0, ['D4', 'F#4', 'A4'], 0.1, 0.09, 0.24),
      ['brass', 0.3, 'D5', 1.2, 0.26],
      ['brass', 0.3, 'A4', 1.2, 0.22],
      ['brass', 0.3, 'F#4', 1.2, 0.2],
      ['tabor', 0.3, 'C3', 0.2, 0.7],
      ...roll(0.6, 1.3, 10, 0.1, 0.35),
      ['tabor', 1.4, 'C3', 0.2, 0.7],
      ['bell', 0.3, 'D6', 1, 0.08],
      ['bell', 0.9, 'A5', 1, 0.07],
      ...run('harp', 0.32, ['D5', 'F#5', 'A5', 'D6', 'F#6'], 0.05, 1.2, 0.14),
    ],
    duck: 1.8,
  },
  // Payday: the lute strums G, the recorder says ta-da, and a bell rings it in.
  payday: {
    key: 'G major',
    level: 1.25,
    hits: [
      ...run('lute', 0, ['G3', 'B3', 'D4', 'G4'], 0.025, 0.8, 0.2),
      ['recorder', 0.12, 'D5', 0.12, 0.22],
      ['recorder', 0.26, 'G5', 0.12, 0.24],
      ['recorder', 0.4, 'B5', 0.55, 0.24],
      ['tabor', 0.4, 'C3', 0.2, 0.5],
      ['bell', 0.4, 'G5', 1, 0.07],
      ...run('harp', 0.45, ['D6', 'G6', 'B5'], 0.06, 0.6, 0.1),
    ],
    duck: 1,
  },
  // A level: the harp sweeps up D major, the brass holds it, and the bells ring.
  levelUp: {
    key: 'D major',
    level: 1.16,
    hits: [
      ...run('harp', 0, ['D4', 'F#4', 'A4', 'D5', 'F#5', 'A5', 'D6'], 0.045, 1.3, 0.2, 0.2),
      ['brass', 0.32, 'D5', 0.9, 0.2],
      ['brass', 0.32, 'A4', 0.9, 0.18],
      ['brass', 0.32, 'F#4', 0.9, 0.16],
      ['tabor', 0.32, 'C3', 0.2, 0.5],
      ['bell', 0.32, 'D6', 1, 0.08],
      ['bell', 0.6, 'F#6', 1, 0.06],
    ],
    duck: 1.3,
  },
  // A commission failed: the knell tolls three times, slow, over a drone that won't resolve.
  lost: {
    key: 'D minor',
    level: 2.04,
    hits: [
      ['knell', 0, 'D4', 3.5, 0.32],
      ['knell', 1.6, 'D4', 3.5, 0.26],
      ['knell', 3.2, 'D4', 3.5, 0.2],
      ['drone', 0, 'D2', 4, 0.08],
      ['drone', 0.8, 'A2', 3.2, 0.05],
      ['recorder', 1.7, 'A4', 0.6, 0.18],
      ['recorder', 2.3, 'F4', 0.6, 0.16],
      ['recorder', 2.9, 'E4', 1.4, 0.15],
    ],
    duck: 4.5,
  },
};

const DRUMS = new Set<InstrumentId>(['tabor', 'rim']);

/** Plays a sting on the music bus, ducks the score (and dips the land's sounds) under it, and holds back the next screen's music if it leads into one. */
export function sting(id: StingId) {
  const a = audio();
  if (!a || isMuted()) return;
  const def = STINGS[id];
  const t = a.ctx.currentTime + 0.02;
  try {
    for (const [instrument, at, note, length, volume] of def.hits) playNote(a.ctx, a.music, instrument, t + at, DRUMS.has(instrument) ? 0 : midiOf(note), length, volume * def.level);
  } catch {
    // A sting that can't be played is not worth stopping the game for.
  }
  duckMusic(def.duck);
  dipAmbience(def.duck);
  if (def.next !== undefined) cueMusic(def.next);
}
