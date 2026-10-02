/**
 * Stings: a few seconds of music for a moment that matters. A screen changing (into battle, to
 * court), a fight won or lost, a level, payday, a commission paid or failed. Since 2 Oct (#257) each
 * is one of yubatake's jingles on the band's instruments (`jingles.ts`), the heralds' and the
 * curtain's notes written out here for the band, or, into battle, a war horn recorded for Battle for
 * Wesnoth. The score ducks under a sting, and a sting that leads into a new screen holds that
 * screen's music back until it has rung.
 */
import { audio, isMuted } from './context';
import { dipAmbience } from './ambience';
import { KIT, playBand, type BandInstrument, type Drum } from './band';
import { jingleNotes, type JingleId } from './jingles';
import { cueMusic, duckMusic, scoreChain } from './music';
import { midiOf } from './score';
import { playSample } from './samples';

export type StingId = 'curtain' | 'battle' | 'court' | 'victory' | 'defeat' | 'bounty' | 'lost' | 'payday' | 'levelUp';

/** One note written out: a band instrument, seconds from the start, a note name (a drum's is ignored), seconds long, volume. */
type Hit = [instrument: BandInstrument, at: number, note: string, length: number, volume: number];

export type StingDef = {
  /** Its music: one of yubatake's jingles, notes written out for the band (every pitched one in `key`, see the test), or a recording from a sample pack. */
  music: { jingle: JingleId } | { key: string; hits: Hit[] } | { sample: string };
  /** Scales every note, so each sting sits at the stings' mark in the mix, a little over the music (see `npm run listen -- stings`). */
  level: number;
  /** Seconds the score stays ducked under it (and the land's sounds dipped). */
  duck: number;
  /** If it leads into a new screen: seconds before that screen's music may start. */
  next?: number;
};

/** Notes up a chord, one after another, `gap` seconds apart, each ringing `length`. */
function run(instrument: BandInstrument, at: number, notes: string[], gap: number, length: number, volume: number, fall = 0): Hit[] {
  return notes.map((note, i) => [instrument, at + i * gap, note, length, volume * (1 - (fall * i) / notes.length)] as Hit);
}

/** A roll on the timpani: `count` strokes from `from` to `to` seconds, swelling from `soft` to `loud`. */
function roll(note: string, from: number, to: number, count: number, soft: number, loud: number): Hit[] {
  return Array.from({ length: count }, (_, i) => ['timpani', from + ((to - from) * i) / (count - 1), note, 0.12, soft + ((loud - soft) * i) / (count - 1)] as Hit);
}

export const STINGS: Record<StingId, StingDef> = {
  // The title's painting gives way to the court: the harp sweeps up into the court's key of F, and a bell rings.
  curtain: {
    music: { key: 'F major', hits: [...run('harp', 0, ['F3', 'A3', 'C4', 'F4', 'A4', 'C5', 'F5', 'A5', 'C6'], 0.05, 1.5, 0.8, 0.3), ['bells', 0.45, 'F5', 1.2, 0.35]] },
    level: 0.19,
    duck: 0.9,
    next: 0.55,
  },
  // Into battle: a war horn calls, three times.
  battle: { music: { sample: 'sting:battle' }, level: 2, duck: 2.4, next: 1.2 },
  // To court: two heralds' trumpets in thirds, in F, over a roll on the timpani.
  court: {
    music: {
      key: 'F major',
      hits: [
        ...run('trumpet', 0, ['C5', 'C5', 'C5'], 0.13, 0.12, 0.8),
        ...run('horn', 0, ['A4', 'A4', 'A4'], 0.13, 0.12, 0.65),
        ['trumpet', 0.39, 'F5', 0.95, 0.85],
        ['horn', 0.39, 'C5', 0.95, 0.7],
        ['horn', 0.39, 'A4', 0.95, 0.65],
        ['trombone', 0.39, 'F3', 0.95, 0.7],
        ...roll('F2', 0.39, 1.1, 12, 0.25, 0.6),
        ['timpani', 1.2, 'F2', 0.4, 0.9],
        ['bells', 0.39, 'F5', 1.2, 0.3],
      ],
    },
    level: 0.2,
    duck: 1.2,
    next: 1.25,
  },
  // A fight won, and a commission done (Grimsby taken), on the band's brass and timpani.
  victory: { music: { jingle: 'winBattle' }, level: 0.47, duck: 3.6 },
  bounty: { music: { jingle: 'winBattleBoss' }, level: 0.94, duck: 12 },
  // A fight lost, and a commission failed: a horn over low strings.
  defeat: { music: { jingle: 'gameOver' }, level: 0.65, duck: 6.5 },
  lost: { music: { jingle: 'gameOver' }, level: 0.65, duck: 6.5 },
  // Payday: a flourish on the trumpets, horns and harp.
  payday: { music: { jingle: 'joinParty' }, level: 1.33, duck: 2.2 },
  // A level: the trumpets climb.
  levelUp: { music: { jingle: 'levelUp' }, level: 0.97, duck: 1 },
};

/** The recordings the stings play, which their sample pack must hold. */
export const STING_SAMPLES = Object.values(STINGS).flatMap((s) => ('sample' in s.music ? [s.music.sample] : []));

const isDrum = (instrument: BandInstrument): instrument is Drum => (KIT as readonly string[]).includes(instrument);

/** Plays a sting into `dest` at `at`, whatever its music is made of (silently, for whatever hasn't loaded yet). */
export function playSting(ctx: BaseAudioContext, dest: AudioNode, def: StingDef, at: number) {
  const m = def.music;
  if ('jingle' in m) {
    for (const n of jingleNotes(m.jingle)) playBand(ctx, dest, n.instrument, at + n.at, n.key, n.length, n.volume * def.level);
  } else if ('hits' in m) {
    for (const [instrument, t, note, length, volume] of m.hits) playBand(ctx, dest, instrument, at + t, isDrum(instrument) ? 0 : midiOf(note), length, volume * def.level);
  } else {
    const g = ctx.createGain();
    g.gain.value = def.level;
    g.connect(dest);
    playSample(ctx, g, at, m.sample);
  }
}

/** The stings play through a room and a top of their own, like the score's, but not through its gain, which ducks under them. */
let chain: GainNode | null = null;

/** Plays a sting on the music bus, ducks the score (and dips the land's sounds) under it, and holds back the next screen's music if it leads into one. */
export function sting(id: StingId) {
  const a = audio();
  if (!a || isMuted()) return;
  const def = STINGS[id];
  chain ??= scoreChain(a.ctx, a.music);
  try {
    playSting(a.ctx, chain, def, a.ctx.currentTime + 0.02);
  } catch {
    // A sting that can't be played is not worth stopping the game for.
  }
  duckMusic(def.duck);
  dipAmbience(def.duck);
  if (def.next !== undefined) cueMusic(def.next);
}
