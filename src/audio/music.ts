/**
 * Plays the score: whichever track the screen on top wants, its tunes taking turns (see
 * `score.ts`), crossfading to another track when the screen changes. Coming back to a map, it picks
 * up the tune where it was. Notes are scheduled a moment ahead of the clock, so timing stays tight,
 * and so are the swells and fades of a tune that has them, each part's through a gain of its own. A
 * sting (see `stings.ts`) can hold the next track back until it has rung out, and ducks the one
 * playing under it. The band's samples and the tunes load as the music is first asked for; until a
 * track's tunes are ready, whatever was playing plays on.
 */
import { audio, whenAwake } from './context';
import { bandReady, loadBand, playBand } from './band';
import { readMidi, type Expression, type Midi } from './midi';
import { arrange, BREATH, laneLevel, lapsOf, lengthOf, TRACKS, TUNES, whereIn, type Arrangement, type TrackId, type TuneId } from './score';

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

const arrangements = new Map<TuneId, Arrangement>();
/** A tune as the band plays it, worked out once. */
function arranged(id: TuneId): Arrangement {
  let a = arrangements.get(id);
  if (!a) arrangements.set(id, (a = arrange(TUNES[id], midis.get(id)!)));
  return a;
}

const ready = (id: TrackId) => bandReady() && TRACKS[id].tunes.every((t) => midis.has(t));

/** Starts loading what a track needs: the band, and its tunes. */
function prepare(id: TrackId) {
  loadBand().catch(() => {});
  for (const t of TRACKS[id].tunes) loadTune(t).catch(() => {});
}

/** A part's swells and fades: its gain, and how far its changes have been scheduled. */
type Lane = { points: Expression; gain: GainNode; next: number; lap: number };

type Playing = {
  id: TrackId;
  tune: TuneId;
  /** Which of the track's tunes this is. */
  turn: number;
  notes: Arrangement['notes'];
  lanes: Lane[];
  /** Seconds a time round: the tune, and a breath if it doesn't loop. */
  loop: number;
  /** Times round before the next tune's turn (for ever, if the track has just the one). */
  laps: number;
  /** When its first time round began (or would have, for a tune picked up part of the way through). */
  start: number;
  next: number;
  lap: number;
  gain: GainNode;
};

/** Where each track's turn of tunes has got to: the next tune a track that doesn't pick up where it was plays. */
const turns: Partial<Record<TrackId, number>> = {};
/** Where a track that picks up where it was had got to when it last stopped. */
const left: Partial<Record<TrackId, { turn: number; lap: number; offset: number }>> = {};

/** Starts a track's tune: from the top, or `from` part of the way through one of its times round. */
function startTune(id: TrackId, turn: number, start: number, gain: GainNode, from?: { lap: number; offset: number }): Playing {
  const track = TRACKS[id];
  const tune = track.tunes[turn % track.tunes.length];
  const midi = midis.get(tune)!;
  const seconds = lengthOf(TUNES[tune], midi);
  const loop = seconds + (TUNES[tune].loops ? 0 : BREATH);
  const laps = track.tunes.length > 1 ? lapsOf(seconds) : Infinity;
  const lap = from ? Math.min(from.lap, laps - 1) : 0;
  const offset = from ? Math.min(from.offset, loop) : 0;
  turns[id] = turn + 1;
  const { notes, lanes } = arranged(tune);
  const ctx = gain.context;
  return {
    id,
    tune,
    turn,
    notes,
    lanes: lanes.map((points) => {
      const g = ctx.createGain();
      g.gain.setValueAtTime(laneLevel(points, offset), Math.max(ctx.currentTime, start));
      g.connect(gain);
      const next = points.findIndex(([at]) => at > offset);
      return { points, gain: g, next: next < 0 ? points.length : next, lap };
    }),
    loop,
    laps,
    start: start - lap * loop - offset,
    next: Math.max(0, notes.findIndex((n) => n.at >= offset - 0.001)),
    lap,
    gain,
  };
}

let wanted: TrackId | null = null;
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

/**
 * Where the band's sound stops: its samples are kept at 22 kHz, and a browser playing one at
 * another pitch leaves a faint fizz above half that, which this takes away.
 */
export const TOP = 10000;

/**
 * The score's own gain into `dest`, through a gentle low-pass at `TOP` and with the room's echo on
 * everything played through it: returns the gain to play into.
 */
export function scoreChain(ctx: BaseAudioContext, dest: AudioNode): GainNode {
  const gain = ctx.createGain();
  const top = ctx.createBiquadFilter();
  top.type = 'lowpass';
  top.frequency.value = TOP;
  top.Q.value = 0.6;
  const echo = ctx.createConvolver();
  echo.buffer = room(ctx);
  const wet = ctx.createGain();
  wet.gain.value = ROOM;
  gain.connect(top).connect(dest);
  top.connect(echo).connect(wet).connect(dest);
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
  const was = TRACKS[id].resumes ? left[id] : undefined;
  playing = was ? startTune(id, was.turn, start, gain, was) : startTune(id, turns[id] ?? 0, start, gain);
}

function fadeOut(p: Playing, fade: number) {
  const a = audio()!;
  // A map remembers where it was, to pick up from there when it comes back.
  if (TRACKS[p.id].resumes) left[p.id] = { turn: p.turn, ...whereIn(p.start, p.loop, a.ctx.currentTime) };
  p.gain.gain.cancelScheduledValues(a.ctx.currentTime);
  p.gain.gain.setValueAtTime(Math.max(0.0001, p.gain.gain.value), a.ctx.currentTime);
  p.gain.gain.exponentialRampToValueAtTime(0.0001, a.ctx.currentTime + fade);
  setTimeout(() => p.gain.disconnect(), fade * 1000 + 3000);
}

/** Schedules a playing tune's swells and fades up to `horizon`, each a ramp to its next level. */
function scheduleLanes(p: Playing, now: number, horizon: number) {
  for (const lane of p.lanes) {
    for (let guard = 0; guard < 2000 && lane.lap < p.laps; guard++) {
      if (lane.next >= lane.points.length) {
        lane.next = 0;
        lane.lap++;
        continue;
      }
      const [at, level] = lane.points[lane.next];
      const when = p.start + lane.lap * p.loop + at;
      if (when > horizon) break;
      if (when > now) lane.gain.gain.linearRampToValueAtTime(level, when);
      lane.next++;
    }
  }
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
  const now = a.ctx.currentTime;
  const horizon = now + AHEAD;
  scheduleLanes(p, now, horizon);
  for (let guard = 0; guard < 400; guard++) {
    const note = p.notes[p.next];
    const at = p.start + p.lap * p.loop + note.at;
    if (at > horizon) break;
    if (at > now - 0.05) playBand(a.ctx, note.lane === undefined ? p.gain : p.lanes[note.lane].gain, note.instrument, at, note.key, note.length, note.volume);
    p.next++;
    if (p.next < p.notes.length) continue;
    p.next = 0;
    p.lap++;
    if (p.lap < p.laps) continue;
    // Its turn is over: the next tune starts after a breath (a tune that doesn't loop has had it already).
    const end: number = p.start + p.lap * p.loop + (TUNES[p.tune].loops ? BREATH : 0);
    const old = p.lanes;
    setTimeout(() => old.forEach((l) => l.gain.disconnect()), (end - now + 15) * 1000);
    p = playing = startTune(p.id, p.turn + 1, end, p.gain);
  }
}

/** The track playing now and its tune, the one asked for, and how far the score is ducked (1: not at all): for scripts. */
export const nowPlaying = () => ({ playing: playing?.id ?? null, tune: playing?.tune ?? null, wanted, duck: score ? Math.round(score.gain.value * 100) / 100 : 1 });

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
