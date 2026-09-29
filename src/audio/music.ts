/**
 * Plays the score: whichever track the screen on top wants, looping, crossfading to the next when
 * the screen changes. Notes are scheduled a moment ahead of the clock, so timing stays tight.
 * A sting (see `stings.ts`) can hold the next track back until it has rung out, and ducks the one
 * playing under it. The mood (how hard a battle is going, and for whom) decides which of a track's
 * gated parts play, note by note, so the music follows the fight.
 */
import { audio, whenAwake } from './context';
import { playNote } from './instruments';
import type { InstrumentId } from './instruments';
import { gateLevel, loopUnits, moodLevel, notesOf, scaleOf, stepUp, TRACKS, type Mood, type Note, type TrackId } from './score';

const AHEAD = 0.3;
const FADE = 1.4;

type Playing = { id: TrackId; notes: Note[]; scale: number[]; swap: boolean; unit: number; loop: number; start: number; next: number; lap: number; gain: GainNode };

/** Every other time round, the recorder and the fife swap tunes, as two players in a band would. */
const SWAP: Partial<Record<InstrumentId, InstrumentId>> = { recorder: 'fife', fife: 'recorder' };

/** A fixed hash of a lap and a note, 0 to 1: which notes get ornamented, differently each time round. */
function chance(lap: number, i: number): number {
  let h = Math.imul(lap * 7919 + i * 104729 + 17, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  return ((h ^ (h >>> 13)) >>> 0) / 2 ** 32;
}

/**
 * Plays one note of the track, as this time round would: after the first lap the lead swaps between
 * recorder and fife now and then, and a few long notes get a quick grace from the note above.
 */
function perform(ctx: BaseAudioContext, p: Playing, note: Note, index: number, at: number, level: number) {
  const volume = note.volume * level;
  const length = note.length * p.unit;
  if (!note.lead || p.lap === 0) return playNote(ctx, p.gain, note.instrument, at, note.midi, length, volume);
  const instrument = p.swap && p.lap % 2 === 1 ? (SWAP[note.instrument] ?? note.instrument) : note.instrument;
  // Keep the fife's shriller voice as soft as the recorder's.
  const loud = instrument === 'fife' && note.instrument === 'recorder' ? volume * 0.8 : instrument === 'recorder' && note.instrument === 'fife' ? volume * 1.15 : volume;
  if (note.length >= 2 && chance(p.lap, index) < 0.2) {
    const grace = Math.min(0.09, p.unit * 0.35);
    playNote(ctx, p.gain, instrument, at, stepUp(p.scale, note.midi), grace, loud * 0.8);
    return playNote(ctx, p.gain, instrument, at + grace, note.midi, length - grace, loud);
  }
  playNote(ctx, p.gain, instrument, at, note.midi, length, loud);
}

let wanted: TrackId | null = null;
let mood: Mood = { intensity: 0, balance: 0 };
let playing: Playing | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
/** Every track plays through this, so a sting can duck the score without touching its own level. */
let score: GainNode | null = null;
/** The next change of track waits this long (for a sting), with a quick fade: until `expires`. */
let cue: { delay: number; expires: number } | null = null;

function scoreBus(): GainNode {
  const a = audio()!;
  if (!score) {
    score = a.ctx.createGain();
    score.connect(a.music);
  }
  return score;
}

function begin(id: TrackId, delay: number | null) {
  const a = audio()!;
  const track = TRACKS[id];
  const gain = a.ctx.createGain();
  const start = a.ctx.currentTime + (delay ?? 0.1);
  // After a sting the new track comes in on its downbeat, at full strength; otherwise it swells in.
  if (delay === null) {
    gain.gain.setValueAtTime(0.0001, a.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(1, a.ctx.currentTime + FADE);
  }
  gain.connect(scoreBus());
  playing = { id, notes: notesOf(track), scale: scaleOf(track), swap: Boolean(track.swap), unit: track.unit, loop: loopUnits(track) * track.unit, start, next: 0, lap: 0, gain };
}

function fadeOut(p: Playing, fade: number) {
  const a = audio()!;
  p.gain.gain.cancelScheduledValues(a.ctx.currentTime);
  p.gain.gain.setValueAtTime(Math.max(0.0001, p.gain.gain.value), a.ctx.currentTime);
  p.gain.gain.exponentialRampToValueAtTime(0.0001, a.ctx.currentTime + fade);
  setTimeout(() => p.gain.disconnect(), fade * 1000 + 3000);
}

function tick() {
  const a = audio();
  if (!a) return;
  if ((playing?.id ?? null) !== wanted) {
    const held = cue && cue.expires > a.ctx.currentTime ? cue : null;
    cue = null;
    if (playing) fadeOut(playing, held ? 0.3 : FADE);
    playing = null;
    if (wanted) begin(wanted, held?.delay ?? null);
  }
  const p = playing;
  if (!p) return;
  const horizon = a.ctx.currentTime + AHEAD;
  const whole = moodLevel(TRACKS[p.id], mood);
  for (let guard = 0; guard < 400; guard++) {
    const note = p.notes[p.next];
    const at = p.start + p.lap * p.loop + note.at * p.unit;
    if (at > horizon) break;
    if (at > a.ctx.currentTime - 0.05) {
      const level = gateLevel(note.gate, mood);
      if (level > 0.02) perform(a.ctx, p, note, p.next, at, level * whole);
    }
    p.next++;
    if (p.next >= p.notes.length) {
      p.next = 0;
      p.lap++;
    }
  }
}

/** The track playing now, the one asked for, the mood, and how far the score is ducked (1: not at all): for scripts. */
export const nowPlaying = () => ({ playing: playing?.id ?? null, wanted, mood: { ...mood }, duck: score ? Math.round(score.gain.value * 100) / 100 : 1 });

/** How the fight is going: the score's gated parts follow it (see `Gate`). On the map it's calm. */
export function setMusicMood(next: Mood) {
  mood = next;
}

/** Asks for a track (or silence). Takes effect once sound is awake. */
export function setMusic(id: TrackId | null) {
  if (id === wanted) return;
  wanted = id;
  whenAwake(() => {
    if (!timer) timer = setInterval(tick, 50);
    tick();
  });
}

/** The next change of track (within a second) waits `delay` seconds for a sting to ring, and the old one steps aside quickly. */
export function cueMusic(delay: number) {
  const a = audio();
  if (a) cue = { delay, expires: a.ctx.currentTime + 1 };
}

/** How quickly a duck goes down, and how long it takes to come back up (seconds). */
export const DUCK_IN = 0.08;
export const DUCK_OUT = 0.9;

/** A duck under way: how deep (a share of the level), and until when it holds (on the audio clock). */
export type Duck = { depth: number; until: number };

/**
 * A new duck on top of whatever duck is on: it goes as deep as the deeper of the two and holds as
 * long as the longer, so a light duck arriving under a sting never lets the music back up early.
 */
export function deepen(on: Duck, now: number, seconds: number, depth: number): Duck {
  const live = on.until > now;
  return { depth: live ? Math.min(on.depth, depth) : depth, until: Math.max(live ? on.until : 0, now + seconds) };
}

/** Ducks a gain: down to `depth` in `DUCK_IN`, held until `until`, then back to full over `DUCK_OUT`. */
export function duck(gain: AudioParam, now: number, { depth, until }: Duck) {
  gain.cancelScheduledValues(now);
  gain.setValueAtTime(gain.value, now);
  gain.linearRampToValueAtTime(depth, now + DUCK_IN);
  gain.setValueAtTime(depth, Math.max(now + DUCK_IN, until));
  gain.linearRampToValueAtTime(1, Math.max(now + DUCK_IN, until) + DUCK_OUT);
}

let ducking: Duck = { depth: 1, until: 0 };

/** Lowers the score to `depth` of its level for `seconds` (under a sting, or a fanfare), then brings it back. */
export function duckMusic(seconds: number, depth = 0.3) {
  const a = audio();
  if (!a) return;
  const now = a.ctx.currentTime;
  ducking = deepen(ducking, now, seconds, depth);
  duck(scoreBus().gain, now, ducking);
}
