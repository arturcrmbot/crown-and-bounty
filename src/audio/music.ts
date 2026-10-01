/**
 * Plays the score: whichever track the screen on top wants, its tunes taking turns (see
 * `score.ts`), crossfading to another track when the screen changes. Notes are scheduled a moment
 * ahead of the clock, so timing stays tight. A sting (see `stings.ts`) can hold the next track back
 * until it has rung out, and ducks the one playing under it. The mood (how hard a battle is going,
 * and for whom) decides which of a tune's gated parts play, note by note, so the music follows the
 * fight. The band's samples and the tunes load as the music is first asked for; until a track's
 * tunes are ready, whatever was playing plays on.
 */
import { audio, whenAwake } from './context';
import { bandReady, loadBand, playBand } from './band';
import { readMidi, type Midi } from './midi';
import { BREATH, gateLevel, lapsOf, lengthOf, moodLevel, notesOf, TRACKS, TUNES, type Mood, type Note, type TrackId, type TuneId } from './score';

const AHEAD = 0.3;
const FADE = 1.4;

const midis = new Map<TuneId, Midi>();
const asked = new Map<TuneId, Promise<void>>();

/** Fetches and reads a tune's MIDI file, once. */
export function loadTune(id: TuneId, base = import.meta.env.BASE_URL): Promise<void> {
  let p = asked.get(id);
  if (!p) {
    p = fetch(`${base}assets/music/${TUNES[id].file}`)
      .then((r) => r.arrayBuffer())
      .then((b) => void midis.set(id, readMidi(new Uint8Array(b))))
      .catch((e) => {
        asked.delete(id);
        throw e;
      });
    asked.set(id, p);
  }
  return p;
}

/** A tune, once read. */
export const tuneMidi = (id: TuneId) => midis.get(id);

const ready = (id: TrackId) => bandReady() && TRACKS[id].tunes.every((t) => midis.has(t));

/** Starts loading what a track needs: the band, and its tunes. */
function prepare(id: TrackId) {
  loadBand().catch(() => {});
  for (const t of TRACKS[id].tunes) loadTune(t).catch(() => {});
}

type Playing = {
  id: TrackId;
  tune: TuneId;
  /** Which of the track's tunes this is. */
  turn: number;
  notes: Note[];
  /** Seconds a time round: the tune, and a breath if it doesn't loop. */
  loop: number;
  /** Times round before the next tune's turn (for ever, if the track has just the one). */
  laps: number;
  start: number;
  next: number;
  lap: number;
  gain: GainNode;
};

/** Where each track's turn of tunes has got to: back on the map after a fight, the next tune plays. */
const turns: Partial<Record<TrackId, number>> = {};

function startTune(id: TrackId, turn: number, start: number, gain: GainNode): Playing {
  const track = TRACKS[id];
  const tune = track.tunes[turn % track.tunes.length];
  const midi = midis.get(tune)!;
  const seconds = lengthOf(TUNES[tune], midi);
  turns[id] = turn + 1;
  return {
    id,
    tune,
    turn,
    notes: notesOf(TUNES[tune], midi),
    loop: seconds + (TUNES[tune].loops ? 0 : BREATH),
    laps: track.tunes.length > 1 ? lapsOf(seconds) : Infinity,
    start,
    next: 0,
    lap: 0,
    gain,
  };
}

let wanted: TrackId | null = null;
let mood: Mood = { intensity: 0, balance: 0 };
let playing: Playing | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
/** Every track plays through this, so a sting can duck the score without touching its own level. */
let score: GainNode | null = null;
/** The next change of track waits this long (for a sting), with a quick fade: until `expires`. */
let cue: { delay: number; expires: number } | null = null;

/** A small room's echo, made once per context: a second and a half of noise, dying away, a little different in each ear. */
function room(ctx: BaseAudioContext): AudioBuffer {
  const seconds = 1.4;
  const buffer = ctx.createBuffer(2, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const data = buffer.getChannelData(c);
    let seed = 1990 + c * 7919;
    let soft = 0;
    for (let i = 0; i < data.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      // Darker as it dies, as a room's walls take the highs first.
      soft += ((seed / 2 ** 31 - 1) - soft) * (0.9 - (0.75 * i) / data.length);
      data[i] = soft * Math.exp((-5 * i) / data.length) * (i < ctx.sampleRate * 0.012 ? 0 : 1);
    }
  }
  return buffer;
}

/** How much of the room's echo the band plays into. */
export const ROOM = 0.22;

/** The score's own gain into `dest`, with the room's echo on everything played through it: returns the gain to play into. */
export function scoreChain(ctx: BaseAudioContext, dest: AudioNode): GainNode {
  const gain = ctx.createGain();
  const echo = ctx.createConvolver();
  echo.buffer = room(ctx);
  const wet = ctx.createGain();
  wet.gain.value = ROOM;
  gain.connect(dest);
  gain.connect(echo).connect(wet).connect(dest);
  return gain;
}

function scoreBus(): GainNode {
  const a = audio()!;
  score ??= scoreChain(a.ctx, a.music);
  return score;
}

function begin(id: TrackId, delay: number | null) {
  const a = audio()!;
  const gain = a.ctx.createGain();
  const start = a.ctx.currentTime + (delay ?? 0.1);
  // After a sting the new track comes in on its downbeat, at full strength; otherwise it swells in.
  if (delay === null) {
    gain.gain.setValueAtTime(0.0001, a.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(1, a.ctx.currentTime + FADE);
  }
  gain.connect(scoreBus());
  playing = startTune(id, turns[id] ?? 0, start, gain);
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
  if ((playing?.id ?? null) !== wanted && (!wanted || ready(wanted))) {
    const held = cue && cue.expires > a.ctx.currentTime ? cue : null;
    cue = null;
    if (playing) fadeOut(playing, held ? 0.3 : FADE);
    playing = null;
    if (wanted) begin(wanted, held?.delay ?? null);
  }
  let p = playing;
  if (!p || !p.notes.length) return;
  const horizon = a.ctx.currentTime + AHEAD;
  const whole = moodLevel(TRACKS[p.id], mood);
  for (let guard = 0; guard < 400; guard++) {
    const note = p.notes[p.next];
    const at = p.start + p.lap * p.loop + note.at;
    if (at > horizon) break;
    if (at > a.ctx.currentTime - 0.05) {
      const level = gateLevel(note.gate, mood);
      if (level > 0.02) playBand(a.ctx, p.gain, note.instrument, at, note.key, note.length, note.volume * level * whole);
    }
    p.next++;
    if (p.next < p.notes.length) continue;
    p.next = 0;
    p.lap++;
    if (p.lap < p.laps) continue;
    // Its turn is over: the next tune starts after a breath (a tune that doesn't loop has had it already).
    const end: number = p.start + p.lap * p.loop + (TUNES[p.tune].loops ? BREATH : 0);
    p = playing = startTune(p.id, p.turn + 1, end, p.gain);
  }
}

/** The track playing now and its tune, the one asked for, the mood, and how far the score is ducked (1: not at all): for scripts. */
export const nowPlaying = () => ({ playing: playing?.id ?? null, tune: playing?.tune ?? null, wanted, mood: { ...mood }, duck: score ? Math.round(score.gain.value * 100) / 100 : 1 });

/** How the fight is going: the score's gated parts follow it (see `Gate`). On the map it's calm. */
export function setMusicMood(next: Mood) {
  mood = next;
}

/** Asks for a track (or silence), and starts loading it. Takes effect once sound is awake and it has loaded. */
export function setMusic(id: TrackId | null) {
  if (id === wanted) return;
  wanted = id;
  if (id) prepare(id);
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
