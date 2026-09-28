/**
 * The one audio context, and its three buses: music, sound effects and ambience, all through a
 * gentle compressor so nothing clips. Browsers only allow sound after the player has clicked or
 * pressed a key, so it all starts then. M mutes everything, and that is remembered. Each bus also
 * has its own volume, set from the little mix panel beside the Sound button, and remembered too.
 */
export type Bus = 'music' | 'sfx' | 'ambience';
export type Buses = { ctx: AudioContext; music: GainNode; sfx: GainNode; ambience: GainNode };

const MUTE_KEY = 'kings-commission/muted';
const VOLUME_KEY = 'kings-commission/volumes';
/** How loud each bus is at its own volume of 1, and the master over them. */
export const LEVELS = { music: 0.42, sfx: 0.7, ambience: 0.35 };
export const MASTER = 0.9;

/**
 * The master chain for any context, live or rendered offline to be measured: a master gain into a
 * gentle compressor, so nothing clips. Returns the master gain, for the buses to feed.
 */
export function masterChain(ctx: BaseAudioContext, level = MASTER): GainNode {
  const squash = ctx.createDynamicsCompressor();
  squash.threshold.value = -14;
  squash.ratio.value = 4;
  const gain = ctx.createGain();
  gain.gain.value = level;
  gain.connect(squash).connect(ctx.destination);
  return gain;
}
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

function loadVolumes(): Record<Bus, number> {
  const fallback: Record<Bus, number> = { music: 1, sfx: 1, ambience: 1 };
  try {
    const saved = JSON.parse(localStorage.getItem(VOLUME_KEY) ?? '{}') as Partial<Record<Bus, number>>;
    for (const bus of ['music', 'sfx', 'ambience'] as const) if (typeof saved[bus] === 'number') fallback[bus] = clamp01(saved[bus]!);
  } catch {
    // No stored volumes, or they didn't parse: the fallback of full volume on every bus stands.
  }
  return fallback;
}

let buses: Buses | null = null;
let master: GainNode | null = null;
let muted = (() => {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
})();
let volumes = loadVolumes();
const listeners: (() => void)[] = [];

/** The buses, once sound has started; null until then (or where there is no audio at all). */
export const audio = () => buses;
export const isMuted = () => muted;
/** A bus's own volume, 0 to 1, on top of its base level: 1 unless the player has turned it down. */
export const getVolume = (bus: Bus) => volumes[bus];

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
    master = masterChain(ctx, muted ? 0 : MASTER);
    const bus = (name: Bus) => {
      const g = ctx.createGain();
      g.gain.value = LEVELS[name] * volumes[name];
      g.connect(master!);
      return g;
    };
    buses = { ctx, music: bus('music'), sfx: bus('sfx'), ambience: bus('ambience') };
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
  if (master && buses) master.gain.setTargetAtTime(muted ? 0 : MASTER, buses.ctx.currentTime, 0.05);
  return muted;
}

/** Sets a bus's own volume (0 to 1) from the mix panel, remembered like mute. */
export function setVolume(bus: Bus, level: number): number {
  const clamped = clamp01(level);
  volumes = { ...volumes, [bus]: clamped };
  try {
    localStorage.setItem(VOLUME_KEY, JSON.stringify(volumes));
  } catch {
    // Nowhere to remember it; it still works for now.
  }
  if (buses) buses[bus].gain.setTargetAtTime(LEVELS[bus] * clamped, buses.ctx.currentTime, 0.05);
  return clamped;
}
