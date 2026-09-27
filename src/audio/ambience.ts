/**
 * The sound of the place under the music: birdsong and wind on the heath, frogs and a cold wind in
 * the fen, a crackling fire at court. Little sounds at random moments, and a wind that never stops.
 */
import { audio, whenAwake } from './context';

export type AmbienceId = 'heath' | 'fen' | 'fire';

let wanted: AmbienceId | null = null;
let current: { id: AmbienceId; wind: AudioBufferSourceNode | null; gain: GainNode } | null = null;
let timer: ReturnType<typeof setInterval> | null = null;

function noiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let seed = 12345;
  for (let i = 0; i < data.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    data[i] = seed / 2 ** 31 - 1;
  }
  return buffer;
}

/** A wind: filtered noise, swelling and falling slowly. */
function wind(ctx: AudioContext, dest: AudioNode, cold: boolean): AudioBufferSourceNode {
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer(ctx, 4);
  source.loop = true;
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = cold ? 500 : 800;
  band.Q.value = 0.8;
  const swell = ctx.createGain();
  swell.gain.value = cold ? 0.22 : 0.12;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.07;
  const depth = ctx.createGain();
  depth.gain.value = cold ? 0.14 : 0.08;
  lfo.connect(depth).connect(swell.gain);
  source.connect(band).connect(swell).connect(dest);
  source.start();
  lfo.start();
  return source;
}

/** A songbird: a few quick whistles sliding up or down. */
function bird(ctx: AudioContext, dest: AudioNode, at: number) {
  const notes = 2 + Math.floor(Math.random() * 4);
  const base = 2600 + Math.random() * 1600;
  for (let i = 0; i < notes; i++) {
    const t = at + i * (0.07 + Math.random() * 0.06);
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(base * (0.9 + Math.random() * 0.25), t);
    o.frequency.exponentialRampToValueAtTime(base * (Math.random() < 0.5 ? 1.3 : 0.75), t + 0.06);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + 0.1);
  }
}

/** A frog: a low croak, rattling. */
function frog(ctx: AudioContext, dest: AudioNode, at: number) {
  const pitch = 110 + Math.random() * 90;
  const croaks = 1 + Math.floor(Math.random() * 3);
  for (let i = 0; i < croaks; i++) {
    const t = at + i * 0.22;
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.setValueAtTime(pitch, t);
    o.frequency.exponentialRampToValueAtTime(pitch * 0.8, t + 0.14);
    const rattle = ctx.createOscillator();
    rattle.frequency.value = 38;
    const am = ctx.createGain();
    am.gain.value = 0;
    const depth = ctx.createGain();
    depth.gain.value = 0.05;
    rattle.connect(depth).connect(am.gain);
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = pitch * 3;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(band).connect(am).connect(g).connect(dest);
    for (const n of [o, rattle]) {
      n.start(t);
      n.stop(t + 0.2);
    }
  }
}

/** A log settling in the fire: a few sharp pops. */
function crackle(ctx: AudioContext, dest: AudioNode, at: number) {
  for (let i = 0; i < 3 + Math.floor(Math.random() * 5); i++) {
    const t = at + Math.random() * 0.4;
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer(ctx, 0.02);
    const high = ctx.createBiquadFilter();
    high.type = 'highpass';
    high.frequency.value = 1500 + Math.random() * 3000;
    const g = ctx.createGain();
    g.gain.value = 0.05 + Math.random() * 0.1;
    source.connect(high).connect(g).connect(dest);
    source.start(t);
  }
}

function tick() {
  const a = audio();
  if (!a) return;
  if ((current?.id ?? null) !== wanted) {
    if (current) {
      const old = current;
      old.gain.gain.setTargetAtTime(0, a.ctx.currentTime, 0.4);
      setTimeout(() => {
        old.wind?.stop();
        old.gain.disconnect();
      }, 3000);
    }
    current = null;
    if (wanted) {
      const gain = a.ctx.createGain();
      gain.gain.value = 0;
      gain.gain.setTargetAtTime(1, a.ctx.currentTime, 0.6);
      gain.connect(a.ambience);
      current = { id: wanted, wind: wanted === 'fire' ? null : wind(a.ctx, gain, wanted === 'fen'), gain };
    }
  }
  if (!current) return;
  const t = a.ctx.currentTime + 0.05;
  if (current.id === 'heath' && Math.random() < 0.05) bird(a.ctx, current.gain, t);
  if (current.id === 'fen' && Math.random() < 0.06) frog(a.ctx, current.gain, t);
  if (current.id === 'fen' && Math.random() < 0.008) bird(a.ctx, current.gain, t);
  if (current.id === 'fire' && Math.random() < 0.12) crackle(a.ctx, current.gain, t);
}

/** Asks for a place's sound (or quiet). Takes effect once sound is awake. */
export function setAmbience(id: AmbienceId | null) {
  if (id === wanted) return;
  wanted = id;
  whenAwake(() => {
    if (!timer) timer = setInterval(tick, 200);
    tick();
  });
}
