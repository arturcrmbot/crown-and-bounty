/**
 * The band, made from oscillators and noise. Each instrument plays one note at a time given: when,
 * which MIDI note, how long, how loud, and where to send it.
 */
export type InstrumentId = 'lute' | 'harp' | 'harpsichord' | 'recorder' | 'fife' | 'drone' | 'bass' | 'tabor' | 'rim' | 'brass' | 'bell' | 'knell' | 'steel';

export const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/**
 * Plucked strings by the Karplus-Strong trick: a burst of noise fed round a delay line one string's
 * length long, softened a little each time round. Worked out once per note, pitch and brightness.
 */
const plucks = new Map<string, AudioBuffer>();
function pluckBuffer(ctx: BaseAudioContext, midi: number, bright: number, length: number): AudioBuffer {
  const key = `${midi}/${bright}/${length}`;
  const known = plucks.get(key);
  if (known) return known;
  const rate = ctx.sampleRate;
  const period = Math.max(2, Math.round(rate / hz(midi)));
  const buffer = ctx.createBuffer(1, Math.floor(rate * length), rate);
  const out = buffer.getChannelData(0);
  // A seeded burst, so every note sounds the same each time it plays.
  let seed = midi * 7919 + 17;
  const noise = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 31 - 1;
  };
  const ring = new Float32Array(period);
  for (let i = 0; i < period; i++) ring[i] = noise();
  // Softer plucks start with smoother noise.
  for (let pass = 0; pass < 3 - bright; pass++) for (let i = 1; i < period; i++) ring[i] = (ring[i] + ring[i - 1]) / 2;
  const decay = 0.9965 + bright * 0.0008 - Math.max(0, midi - 72) * 0.0002;
  let prev = 0;
  for (let i = 0; i < out.length; i++) {
    const k = i % period;
    const value = ring[k];
    out[i] = value;
    ring[k] = decay * (value + prev) * 0.5;
    prev = value;
  }
  // Take the edge off the start and fade out the tail.
  const fade = Math.floor(rate * 0.25);
  for (let i = 0; i < fade; i++) out[out.length - 1 - i] *= i / fade;
  plucks.set(key, buffer);
  return buffer;
}

/** Levels that make every instrument about as loud as the others at the same volume. */
const PLUCK_LEVEL = 5;
const FLUTE_LEVEL = 0.55;

function pluck(ctx: BaseAudioContext, dest: AudioNode, at: number, midi: number, length: number, volume: number, bright: number, tone: number) {
  const source = ctx.createBufferSource();
  source.buffer = pluckBuffer(ctx, midi, bright, Math.min(2.4, Math.max(0.6, length + 0.8)));
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = tone;
  const gain = ctx.createGain();
  // A plucked string is quiet next to a blown pipe: bring it up to the same scale.
  gain.gain.setValueAtTime(volume * PLUCK_LEVEL, at);
  gain.gain.setTargetAtTime(0, at + length + 0.5, 0.25);
  source.connect(filter).connect(gain).connect(dest);
  source.start(at);
  source.stop(at + length + 1.6);
}

/** A breathy wooden flute: a soft attack, then vibrato that comes in once the note settles. */
function flute(ctx: BaseAudioContext, dest: AudioNode, at: number, midi: number, length: number, loud: number, shrill: boolean) {
  const f = hz(midi);
  const volume = loud * FLUTE_LEVEL;
  const body = ctx.createOscillator();
  body.type = 'triangle';
  body.frequency.value = f;
  const pure = ctx.createOscillator();
  pure.type = 'sine';
  pure.frequency.value = f;
  const vibrato = ctx.createOscillator();
  vibrato.frequency.value = 5.2;
  const depth = ctx.createGain();
  depth.gain.setValueAtTime(0, at);
  depth.gain.linearRampToValueAtTime(f * 0.006, at + Math.min(0.5, length * 0.6));
  vibrato.connect(depth).connect(body.frequency);
  depth.connect(pure.frequency);
  const mix = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = shrill ? 5200 : 2600;
  const env = ctx.createGain();
  const end = at + Math.max(0.08, length - 0.02);
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(volume, at + 0.045);
  env.gain.setValueAtTime(volume * 0.85, end - 0.02);
  env.gain.exponentialRampToValueAtTime(0.0001, end + 0.12);
  body.connect(mix);
  const pureGain = ctx.createGain();
  pureGain.gain.value = 0.7;
  pure.connect(pureGain).connect(mix);
  mix.connect(filter).connect(env).connect(dest);
  // A puff of breath at the start.
  breath(ctx, env, at, shrill ? 5000 : 2200, 0.05, 0.25);
  for (const o of [body, pure, vibrato]) {
    o.start(at);
    o.stop(end + 0.2);
  }
}

function breath(ctx: BaseAudioContext, dest: AudioNode, at: number, frequency: number, length: number, level: number) {
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * length), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let seed = 99;
  for (let i = 0; i < data.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    data[i] = (seed / 2 ** 31 - 1) * (1 - i / data.length);
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = frequency;
  band.Q.value = 1.2;
  const gain = ctx.createGain();
  gain.gain.value = level;
  source.connect(band).connect(gain).connect(dest);
  source.start(at);
}

/** A hurdy-gurdy drone: two slightly detuned reedy tones, swelling in. */
function drone(ctx: BaseAudioContext, dest: AudioNode, at: number, midi: number, length: number, volume: number) {
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(volume, at + Math.min(0.6, length / 3));
  env.gain.setValueAtTime(volume, at + length - 0.1);
  env.gain.exponentialRampToValueAtTime(0.0001, at + length + 0.4);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 900;
  filter.Q.value = 0.7;
  filter.connect(env).connect(dest);
  for (const detune of [-6, 5]) {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = hz(midi);
    o.detune.value = detune;
    o.connect(filter);
    o.start(at);
    o.stop(at + length + 0.5);
  }
}

/** A frame drum: a thump that drops in pitch, and a skin rattle. */
function tabor(ctx: BaseAudioContext, dest: AudioNode, at: number, volume: number) {
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(120, at);
  o.frequency.exponentialRampToValueAtTime(55, at + 0.18);
  const g = ctx.createGain();
  g.gain.setValueAtTime(volume, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.35);
  o.connect(g).connect(dest);
  o.start(at);
  o.stop(at + 0.4);
  breath(ctx, dest, at, 700, 0.12, volume * 0.5);
}

/** A tap on the rim, or a shake of a tambourine. */
const rim = (ctx: BaseAudioContext, dest: AudioNode, at: number, volume: number) => breath(ctx, dest, at, 6500, 0.06, volume);

/** A brass fanfare note: buzzing, brightening as it swells, with a touch of vibrato. */
function brass(ctx: BaseAudioContext, dest: AudioNode, at: number, midi: number, length: number, volume: number) {
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.value = hz(midi);
  const vib = ctx.createOscillator();
  vib.frequency.value = 5.5;
  const vibDepth = ctx.createGain();
  vibDepth.gain.value = hz(midi) * 0.004;
  vib.connect(vibDepth).connect(o.frequency);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(300, at);
  filter.frequency.exponentialRampToValueAtTime(2400, at + 0.08);
  filter.frequency.exponentialRampToValueAtTime(1300, at + 0.4);
  const env = ctx.createGain();
  const end = at + Math.max(0.1, length - 0.03);
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(volume, at + 0.04);
  env.gain.setValueAtTime(volume * 0.8, end);
  env.gain.exponentialRampToValueAtTime(0.0001, end + 0.15);
  o.connect(filter).connect(env).connect(dest);
  for (const n of [o, vib]) {
    n.start(at);
    n.stop(end + 0.2);
  }
}

/** A bell: a few out-of-tune partials that ring on. */
function bell(ctx: BaseAudioContext, dest: AudioNode, at: number, midi: number, volume: number) {
  for (const [ratio, level, ring] of [[1, 1, 2.2], [2.76, 0.4, 1.2], [5.4, 0.2, 0.6]] as const) {
    const o = ctx.createOscillator();
    o.frequency.value = hz(midi) * ratio;
    const g = ctx.createGain();
    g.gain.setValueAtTime(volume * level, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + ring);
    o.connect(g).connect(dest);
    o.start(at);
    o.stop(at + ring + 0.1);
  }
}

/**
 * A church bell tolling: the partials a real bell rings with, named from the note you hear (the
 * nominal). The hum an octave and more below, and a minor third (the tierce) that makes it mournful.
 */
function knell(ctx: BaseAudioContext, dest: AudioNode, at: number, midi: number, volume: number) {
  const partials: [ratio: number, level: number, ring: number][] = [
    [0.25, 0.45, 5],
    [0.5, 0.6, 4],
    [0.6, 0.5, 3.2],
    [0.75, 0.22, 2],
    [1, 0.8, 3],
    [1.5, 0.3, 1.4],
    [2, 0.22, 1],
  ];
  for (const [ratio, level, ring] of partials) {
    const o = ctx.createOscillator();
    o.frequency.value = hz(midi) * ratio;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(volume * level, at + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, at + ring);
    o.connect(g).connect(dest);
    o.start(at);
    o.stop(at + ring + 0.1);
  }
  // The clapper's knock.
  breath(ctx, dest, at, 900, 0.05, volume * 0.5);
}

/** Steel on steel: a bright scrape and a ring of clashing, out-of-tune partials. `midi` sets how high it rings. */
function steel(ctx: BaseAudioContext, dest: AudioNode, at: number, midi: number, volume: number) {
  const partials: [ratio: number, level: number, ring: number][] = [
    [1, 1, 0.9],
    [1.58, 0.7, 0.6],
    [2.24, 0.6, 0.5],
    [2.87, 0.45, 0.35],
    [3.54, 0.35, 0.3],
    [4.22, 0.25, 0.2],
  ];
  for (const [ratio, level, ring] of partials) {
    // Two blades, not quite the same: a beating shimmer.
    for (const detune of [1, 1.013]) {
      const o = ctx.createOscillator();
      o.frequency.value = hz(midi) * ratio * detune;
      const g = ctx.createGain();
      g.gain.setValueAtTime(volume * level * 0.35, at);
      g.gain.exponentialRampToValueAtTime(0.0001, at + ring);
      o.connect(g).connect(dest);
      o.start(at);
      o.stop(at + ring + 0.05);
    }
  }
  breath(ctx, dest, at, 5200, 0.07, volume * 1.4);
  breath(ctx, dest, at + 0.01, 2600, 0.16, volume * 0.6);
}

/** Plays one note on an instrument. `length` is in seconds; `volume` about 0 to 1. */
export function playNote(ctx: BaseAudioContext, dest: AudioNode, instrument: InstrumentId, at: number, midi: number, length: number, volume: number) {
  switch (instrument) {
    case 'lute':
      return pluck(ctx, dest, at, midi, length, volume, 1, 3200);
    case 'harp':
      return pluck(ctx, dest, at, midi, length, volume, 2, 5200);
    case 'harpsichord':
      return pluck(ctx, dest, at, midi, length, volume * 0.8, 2, 7000);
    case 'bass':
      return pluck(ctx, dest, at, midi, length, volume, 0, 1400);
    case 'recorder':
      return flute(ctx, dest, at, midi, length, volume, false);
    case 'fife':
      return flute(ctx, dest, at, midi, length, volume, true);
    case 'drone':
      return drone(ctx, dest, at, midi, length, volume);
    case 'tabor':
      return tabor(ctx, dest, at, volume);
    case 'rim':
      return rim(ctx, dest, at, volume);
    case 'brass':
      return brass(ctx, dest, at, midi, length, volume);
    case 'bell':
      return bell(ctx, dest, at, midi, volume);
    case 'knell':
      return knell(ctx, dest, at, midi, volume);
    case 'steel':
      return steel(ctx, dest, at, midi, volume);
  }
}
