/**
 * The one audio context, and its three buses: music, sound effects and ambience, all through a
 * gentle compressor so nothing clips. Browsers only allow sound after the player has clicked or
 * pressed a key, so it all starts then. M mutes everything, and that is remembered.
 */
export type Buses = { ctx: AudioContext; music: GainNode; sfx: GainNode; ambience: GainNode };

const MUTE_KEY = 'kings-commission/muted';
const LEVELS = { music: 0.42, sfx: 0.7, ambience: 0.35 };
let buses: Buses | null = null;
let master: GainNode | null = null;
let muted = (() => {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
})();
const listeners: (() => void)[] = [];

/** The buses, once sound has started; null until then (or where there is no audio at all). */
export const audio = () => buses;
export const isMuted = () => muted;

/** Called on every click or key until sound is running: only then may a page make sound. */
export function wakeAudio() {
  if (buses) {
    // A context made on the wrong sort of event can start suspended; the next click lets it go.
    if (buses.ctx.state === 'suspended') void buses.ctx.resume();
    return;
  }
  if (typeof AudioContext === 'undefined') return;
  try {
    const ctx = new AudioContext();
    const squash = ctx.createDynamicsCompressor();
    squash.threshold.value = -14;
    squash.ratio.value = 4;
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.9;
    master.connect(squash).connect(ctx.destination);
    const bus = (level: number) => {
      const g = ctx.createGain();
      g.gain.value = level;
      g.connect(master!);
      return g;
    };
    buses = { ctx, music: bus(LEVELS.music), sfx: bus(LEVELS.sfx), ambience: bus(LEVELS.ambience) };
    for (const f of listeners) f();
  } catch {
    buses = null;
  }
}

/** Runs `f` once sound is awake (at once, if it is already). */
export function whenAwake(f: () => void) {
  if (buses) f();
  else listeners.push(f);
}

export function toggleMute(): boolean {
  muted = !muted;
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {
    // Nowhere to remember it; it still works for now.
  }
  if (master && buses) master.gain.setTargetAtTime(muted ? 0 : 0.9, buses.ctx.currentTime, 0.05);
  return muted;
}
