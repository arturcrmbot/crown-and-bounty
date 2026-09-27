/**
 * Plays the score: whichever track the screen on top wants, looping, crossfading to the next when
 * the screen changes. Notes are scheduled a moment ahead of the clock, so timing stays tight.
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

function begin(id: TrackId) {
  const a = audio()!;
  const track = TRACKS[id];
  const gain = a.ctx.createGain();
  gain.gain.setValueAtTime(0.0001, a.ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(1, a.ctx.currentTime + FADE);
  gain.connect(a.music);
  playing = { id, notes: notesOf(track), unit: track.unit, loop: loopUnits(track) * track.unit, start: a.ctx.currentTime + 0.1, next: 0, lap: 0, gain };
}

function fadeOut(p: Playing) {
  const a = audio()!;
  p.gain.gain.cancelScheduledValues(a.ctx.currentTime);
  p.gain.gain.setValueAtTime(Math.max(0.0001, p.gain.gain.value), a.ctx.currentTime);
  p.gain.gain.exponentialRampToValueAtTime(0.0001, a.ctx.currentTime + FADE);
  setTimeout(() => p.gain.disconnect(), FADE * 1000 + 3000);
}

function tick() {
  const a = audio();
  if (!a) return;
  if ((playing?.id ?? null) !== wanted) {
    if (playing) fadeOut(playing);
    playing = null;
    if (wanted) begin(wanted);
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

/** Asks for a track (or silence). Takes effect once sound is awake. */
export function setMusic(id: TrackId | null) {
  if (id === wanted) return;
  wanted = id;
  whenAwake(() => {
    if (!timer) timer = setInterval(tick, 50);
    tick();
  });
}
