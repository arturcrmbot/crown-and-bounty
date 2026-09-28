/**
 * Plays the score: whichever track the screen on top wants, looping, crossfading to the next when
 * the screen changes. Notes are scheduled a moment ahead of the clock, so timing stays tight.
 * A sting (see `stings.ts`) can hold the next track back until it has rung out, and ducks the one
 * playing under it.
 */
import { audio, whenAwake } from './context';
import { playNote } from './instruments';
import { loopUnits, notesOf, TRACKS, type Note, type TrackId } from './score';

const AHEAD = 0.3;
const FADE = 1.4;

type Playing = { id: TrackId; notes: Note[]; unit: number; loop: number; start: number; next: number; lap: number; gain: GainNode };

let wanted: TrackId | null = null;
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
  playing = { id, notes: notesOf(track), unit: track.unit, loop: loopUnits(track) * track.unit, start, next: 0, lap: 0, gain };
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
  for (let guard = 0; guard < 400; guard++) {
    const note = p.notes[p.next];
    const at = p.start + p.lap * p.loop + note.at * p.unit;
    if (at > horizon) break;
    if (at > a.ctx.currentTime - 0.05) playNote(a.ctx, p.gain, note.instrument, at, note.midi, note.length * p.unit, note.volume);
    p.next++;
    if (p.next >= p.notes.length) {
      p.next = 0;
      p.lap++;
    }
  }
}

/** The track playing now, and the one asked for: for scripts. */
export const nowPlaying = () => ({ playing: playing?.id ?? null, wanted });

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

/** Lowers the score to `depth` of its level for `seconds`, under a sting, then brings it back. */
export function duckMusic(seconds: number, depth = 0.3) {
  const a = audio();
  if (!a) return;
  const g = scoreBus().gain;
  const now = a.ctx.currentTime;
  g.cancelScheduledValues(now);
  g.setValueAtTime(g.value, now);
  g.linearRampToValueAtTime(depth, now + 0.08);
  g.setValueAtTime(depth, now + seconds);
  g.linearRampToValueAtTime(1, now + seconds + 0.9);
}
