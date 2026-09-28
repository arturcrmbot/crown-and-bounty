/**
 * The sound of the place under the music. Each screen asks for a bed: wind on the heath, a colder
 * wind in the fen, a crackling fire at court. On the map, the land itself joins in around the
 * listener (the middle of the view): running water near the river and a roar at the falls,
 * chatter and a smith's hammer by villages and castles, crows at the tower and a bell at the
 * abbey, wind whistling over high ground, birds in the woods, frogs at the fen's pools, a creaking
 * mill and a pick in the mine. Each is louder the nearer it is and panned to its side. When the
 * day's riding is spent and night falls, the birds go quiet and the crickets and an owl come out.
 */
import { audio, whenAwake } from './context';

export type AmbienceId = 'heath' | 'fen' | 'fire';

type Spot = readonly [x: number, y: number];

/** Where the land makes its sounds, in map pixels. */
export type Soundscape = {
  river: Spot[];
  falls: Spot[];
  still: Spot[];
  woods: Spot[];
  high: Spot[];
  town: Spot[];
  crows: Spot[];
  abbey: Spot[];
  mill: Spot[];
  mine: Spot[];
  /** An archery range: arrows into straw. */
  butts: Spot[];
  /** Fen country: frogs in every ditch, not only at the pools. */
  fen: boolean;
};

/** Who is listening and when: a point on the map, how far night has come (0 to 1), how fresh the morning is, and how hard it's raining. */
export type Listener = { x: number; y: number; night: number; morning: number; rain?: number };

export type Place = { scape: Soundscape; listener: Listener };

/** Beyond this many pixels a kind of place is silent; half as far, it's a quarter as loud. */
const RANGE: Record<Exclude<keyof Soundscape, 'fen'>, number> = {
  river: 300,
  falls: 480,
  still: 260,
  woods: 260,
  high: 340,
  town: 300,
  crows: 360,
  abbey: 520,
  mill: 280,
  mine: 260,
  butts: 280,
};
/** How many spots in range make a place as loud as it gets: one village, but a stand of trees. */
const FULL: Record<Exclude<keyof Soundscape, 'fen'>, number> = { river: 3, falls: 1, still: 4, woods: 24, high: 6, town: 1, crows: 1, abbey: 1, mill: 1, mine: 1, butts: 1 };
/** How far to either side a sound can pan: half the view's width, give or take. */
const PAN_WIDTH = 460;
const TICK = 0.15;

type Layer = { gain: GainNode; pan: StereoPannerNode; stop: () => void };
type Current = { id: AmbienceId; gain: GainNode; stops: (() => void)[]; layers: Map<string, Layer> | null; scape: Soundscape | null };

let wanted: AmbienceId | null = null;
let wantedPlace: Place | null = null;
let current: Current | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
/** Whether the last tick heard night, so the morning's cockerel crows once, when night gives way. */
let wasNight = false;
/** The last few one-off sounds, and how loud each layer was asked to be, for scripts to check. */
const recent: string[] = [];
const levels: Record<string, number> = {};
const log = (name: string) => {
  recent.push(name);
  if (recent.length > 40) recent.shift();
};

const noiseBuffers = new Map<number, AudioBuffer>();
function noiseBuffer(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const known = noiseBuffers.get(seconds);
  if (known && known.sampleRate === ctx.sampleRate) return known;
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let seed = 12345 + seconds * 7;
  for (let i = 0; i < data.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    data[i] = seed / 2 ** 31 - 1;
  }
  noiseBuffers.set(seconds, buffer);
  return buffer;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** A looping noise source, started now; returns it and a way to stop it. */
function noiseLoop(ctx: BaseAudioContext, seconds = 4): AudioBufferSourceNode {
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer(ctx, seconds);
  source.loop = true;
  // Start somewhere different each time, so two layers from the same buffer don't march together.
  source.start(ctx.currentTime, Math.random() * seconds);
  return source;
}

function filter(ctx: BaseAudioContext, type: BiquadFilterType, frequency: number, q = 0.7): BiquadFilterNode {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = frequency;
  f.Q.value = q;
  return f;
}

/** A slow wobble on a parameter: `rate` times a second, by `depth` either way. */
function wobble(ctx: BaseAudioContext, param: AudioParam, rate: number, depth: number): OscillatorNode {
  const lfo = ctx.createOscillator();
  lfo.frequency.value = rate;
  const d = ctx.createGain();
  d.gain.value = depth;
  lfo.connect(d).connect(param);
  lfo.start();
  return lfo;
}

// --- Beds: what a screen sounds like everywhere -----------------------------------------------

/** A wind: filtered noise, swelling and falling slowly. */
function wind(ctx: BaseAudioContext, dest: AudioNode, cold: boolean): () => void {
  const source = noiseLoop(ctx);
  const band = filter(ctx, 'bandpass', cold ? 500 : 800, 0.8);
  const swell = ctx.createGain();
  swell.gain.value = cold ? 0.22 : 0.12;
  const lfo = wobble(ctx, swell.gain, 0.07, cold ? 0.14 : 0.08);
  source.connect(band).connect(swell).connect(dest);
  return () => {
    source.stop();
    lfo.stop();
  };
}

// --- Layers: sounds that go on as long as you're near ----------------------------------------

/** Running water: a rush of noise, and resonances wandering through it like a brook's babble. */
function brook(ctx: BaseAudioContext, dest: AudioNode): () => void {
  const source = noiseLoop(ctx, 3);
  const rush = filter(ctx, 'bandpass', 1100, 0.5);
  const rushGain = ctx.createGain();
  rushGain.gain.value = 0.16;
  source.connect(rush).connect(rushGain).connect(dest);
  const lfos: OscillatorNode[] = [];
  for (const [f, rate, depth] of [[700, 0.61, 260], [1250, 1.13, 380], [1900, 1.87, 500]] as const) {
    const band = filter(ctx, 'bandpass', f, 9);
    const g = ctx.createGain();
    g.gain.value = 0.3;
    source.connect(band).connect(g).connect(dest);
    lfos.push(wobble(ctx, band.frequency, rate, depth));
  }
  return () => {
    source.stop();
    for (const l of lfos) l.stop();
  };
}

/** A waterfall: a deep, steady roar with spray on top. */
function falls(ctx: BaseAudioContext, dest: AudioNode): () => void {
  const source = noiseLoop(ctx, 5);
  const roar = filter(ctx, 'lowpass', 900, 0.6);
  const roarGain = ctx.createGain();
  roarGain.gain.value = 0.55;
  const spray = filter(ctx, 'highpass', 3200, 0.5);
  const sprayGain = ctx.createGain();
  sprayGain.gain.value = 0.05;
  source.connect(roar).connect(roarGain).connect(dest);
  source.connect(spray).connect(sprayGain).connect(dest);
  const lfo = wobble(ctx, roarGain.gain, 0.23, 0.06);
  return () => {
    source.stop();
    lfo.stop();
  };
}

/** Wind over high ground: a narrow howl that wanders in pitch, and gusts. */
function gale(ctx: BaseAudioContext, dest: AudioNode): () => void {
  const source = noiseLoop(ctx, 4);
  const howl = filter(ctx, 'bandpass', 720, 7);
  const g = ctx.createGain();
  g.gain.value = 0.5;
  source.connect(howl).connect(g).connect(dest);
  const pitch = wobble(ctx, howl.frequency, 0.11, 260);
  const gusts = wobble(ctx, g.gain, 0.083, 0.35);
  return () => {
    source.stop();
    pitch.stop();
    gusts.stop();
  };
}

/** A shower: a hiss of rain, and the patter of big drops close by. */
function shower(ctx: BaseAudioContext, dest: AudioNode): () => void {
  const source = noiseLoop(ctx, 3);
  const hiss = filter(ctx, 'highpass', 2200, 0.5);
  const hissGain = ctx.createGain();
  hissGain.gain.value = 0.12;
  const body = filter(ctx, 'bandpass', 900, 0.6);
  const bodyGain = ctx.createGain();
  bodyGain.gain.value = 0.1;
  source.connect(hiss).connect(hissGain).connect(dest);
  source.connect(body).connect(bodyGain).connect(dest);
  const lfo = wobble(ctx, hissGain.gain, 0.17, 0.03);
  return () => {
    source.stop();
    lfo.stop();
  };
}

/** Crickets: two of them, high chirps in trills, a little apart. */
function crickets(ctx: BaseAudioContext, dest: AudioNode): () => void {
  const nodes: (OscillatorNode | AudioBufferSourceNode)[] = [];
  for (const [f, trill, chirp, level, pan] of [[4400, 29, 1.25, 0.1, -0.4], [4750, 33, 0.9, 0.08, 0.45]] as const) {
    const o = ctx.createOscillator();
    o.frequency.value = f;
    const t = ctx.createGain();
    t.gain.value = 0.5;
    const trillLfo = ctx.createOscillator();
    trillLfo.type = 'square';
    trillLfo.frequency.value = trill;
    const td = ctx.createGain();
    td.gain.value = 0.5;
    trillLfo.connect(td).connect(t.gain);
    const c = ctx.createGain();
    c.gain.value = level / 2;
    const chirpLfo = ctx.createOscillator();
    chirpLfo.type = 'square';
    chirpLfo.frequency.value = chirp;
    const cd = ctx.createGain();
    cd.gain.value = level / 2;
    chirpLfo.connect(cd).connect(c.gain);
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    o.connect(t).connect(c).connect(p).connect(dest);
    for (const n of [o, trillLfo, chirpLfo]) {
      n.start();
      nodes.push(n);
    }
  }
  return () => {
    for (const n of nodes) n.stop();
  };
}

// --- One-offs: a sound from a spot, now and then ---------------------------------------------

/** A songbird: a few quick whistles sliding up or down. */
function songbird(ctx: BaseAudioContext, dest: AudioNode, at: number) {
  const notes = 2 + Math.floor(Math.random() * 4);
  const base = rand(2600, 4200);
  for (let i = 0; i < notes; i++) {
    const t = at + i * rand(0.07, 0.13);
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(base * rand(0.9, 1.15), t);
    o.frequency.exponentialRampToValueAtTime(base * (Math.random() < 0.5 ? 1.3 : 0.75), t + 0.06);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.07, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + 0.1);
  }
}

/** A blackbird in the wood: a few fluty notes, lower and slower than the little birds. */
function blackbird(ctx: BaseAudioContext, dest: AudioNode, at: number) {
  let t = at;
  const notes = 3 + Math.floor(Math.random() * 4);
  for (let i = 0; i < notes; i++) {
    const f = rand(1400, 2700);
    const length = rand(0.07, 0.2);
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(f, t);
    o.frequency.linearRampToValueAtTime(f * rand(0.85, 1.2), t + length);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.06, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + length);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + length + 0.02);
    t += length + rand(0.02, 0.09);
  }
}

/** A cuckoo, deep in the trees: two soft notes, falling a third. */
function cuckoo(ctx: BaseAudioContext, dest: AudioNode, at: number) {
  for (const [f, t] of [[740, 0], [590, 0.3]] as const) {
    const o = ctx.createOscillator();
    o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at + t);
    g.gain.exponentialRampToValueAtTime(0.07, at + t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, at + t + 0.24);
    o.connect(g).connect(dest);
    o.start(at + t);
    o.stop(at + t + 0.28);
  }
}

/** A woodpecker drumming: a quick run of knocks on hollow wood. */
function woodpecker(ctx: BaseAudioContext, dest: AudioNode, at: number) {
  const knocks = 10 + Math.floor(Math.random() * 8);
  const rate = rand(15, 20);
  for (let i = 0; i < knocks; i++) {
    const t = at + i / rate;
    const o = ctx.createOscillator();
    o.frequency.value = rand(900, 1000);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.06 * (1 - i / knocks / 2), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + 0.04);
  }
}

/** A skylark over the open heath: a long, fast, high warble. */
function skylark(ctx: BaseAudioContext, dest: AudioNode, at: number) {
  const o = ctx.createOscillator();
  const length = rand(1.2, 2.2);
  let t = at;
  o.frequency.setValueAtTime(rand(3000, 4000), t);
  while (t < at + length) {
    t += rand(0.03, 0.07);
    o.frequency.linearRampToValueAtTime(rand(2800, 5000), t);
  }
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(0.018, at + 0.2);
  g.gain.setValueAtTime(0.018, at + length - 0.2);
  g.gain.exponentialRampToValueAtTime(0.0001, at + length);
  const flutter = wobble(ctx, g.gain, 23, 0.012);
  o.connect(g).connect(dest);
  o.start(at);
  o.stop(at + length + 0.05);
  flutter.stop(at + length + 0.05);
}

/** A crow: a harsh caw or two, falling. */
function crow(ctx: BaseAudioContext, dest: AudioNode, at: number) {
  const caws = 1 + Math.floor(Math.random() * 3);
  const pitch = rand(520, 680);
  for (let i = 0; i < caws; i++) {
    const t = at + i * rand(0.32, 0.42);
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(pitch, t);
    o.frequency.exponentialRampToValueAtTime(pitch * 0.78, t + 0.26);
    const rough = ctx.createGain();
    rough.gain.value = 0.7;
    const r = wobble(ctx, rough.gain, 70, 0.3);
    const band = filter(ctx, 'bandpass', 1300, 1.8);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.24, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    o.connect(rough).connect(band).connect(g).connect(dest);
    o.start(t);
    o.stop(t + 0.3);
    r.stop(t + 0.3);
  }
}

/** A frog: a low croak, rattling. */
function frog(ctx: BaseAudioContext, dest: AudioNode, at: number) {
  const pitch = rand(110, 200);
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
    const band = filter(ctx, 'bandpass', pitch * 3);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(band).connect(am).connect(g).connect(dest);
    for (const n of [o, rattle]) {
      n.start(t);
      n.stop(t + 0.2);
    }
  }
}

/** A drop in the brook: a tiny bubble rising in pitch. */
function droplet(ctx: BaseAudioContext, dest: AudioNode, at: number) {
  const o = ctx.createOscillator();
  const f = rand(500, 900);
  o.frequency.setValueAtTime(f, at);
  o.frequency.exponentialRampToValueAtTime(f * rand(1.6, 2.2), at + 0.03);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(rand(0.03, 0.07), at + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.04);
  o.connect(g).connect(dest);
  o.start(at);
  o.stop(at + 0.05);
}

/** Vowels as two formants, for voices. */
const VOWELS: [number, number][] = [[730, 1090], [530, 1840], [270, 2290], [570, 840], [300, 870], [660, 1720]];

/** Villagers talking: a phrase of murmured syllables, from somebody with a voice of their own. */
function chatter(ctx: BaseAudioContext, dest: AudioNode, at: number) {
  const voice = rand(95, 230);
  const syllables = 3 + Math.floor(Math.random() * 7);
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  const bands = [filter(ctx, 'bandpass', 600, 6), filter(ctx, 'bandpass', 1500, 8)];
  const g = ctx.createGain();
  g.gain.value = 0.0001;
  const mix = ctx.createGain();
  mix.gain.value = 1;
  for (const b of bands) o.connect(b).connect(mix);
  mix.connect(g).connect(dest);
  let t = at;
  o.frequency.setValueAtTime(voice, t);
  for (let i = 0; i < syllables; i++) {
    const length = rand(0.09, 0.2);
    const [f1, f2] = VOWELS[Math.floor(Math.random() * VOWELS.length)];
    bands[0].frequency.setValueAtTime(f1, t);
    bands[1].frequency.setValueAtTime(f2, t);
    o.frequency.linearRampToValueAtTime(voice * rand(0.85, 1.2), t + length);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(rand(0.12, 0.25), t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + length);
    t += length + rand(0.01, 0.08);
  }
  o.start(at);
  o.stop(t + 0.05);
}

/** The smith at his anvil: a few ringing blows, then a rest. */
function anvil(ctx: BaseAudioContext, dest: AudioNode, at: number) {
  const blows = 2 + Math.floor(Math.random() * 4);
  const pitch = rand(1900, 2400);
  for (let i = 0; i < blows; i++) {
    const t = at + i * rand(0.42, 0.55);
    for (const [ratio, level, ring] of [[1, 0.09, 0.5], [1.63, 0.055, 0.35], [2.41, 0.04, 0.2]] as const) {
      const o = ctx.createOscillator();
      o.frequency.value = pitch * ratio;
      const g = ctx.createGain();
      g.gain.setValueAtTime(level, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + ring);
      o.connect(g).connect(dest);
      o.start(t);
      o.stop(t + ring + 0.02);
    }
    thump(ctx, dest, t, 0.08);
  }
}

/** A short knock of noise: the dull part of a blow. */
function thump(ctx: BaseAudioContext, dest: AudioNode, at: number, level: number, frequency = 600) {
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer(ctx, 0.25);
  const band = filter(ctx, 'bandpass', frequency, 1.2);
  const g = ctx.createGain();
  g.gain.setValueAtTime(level, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.07);
  source.connect(band).connect(g).connect(dest);
  source.start(at);
  source.stop(at + 0.1);
}

/** A pick (or a peat spade) at work: steady blows on stone. */
function pick(ctx: BaseAudioContext, dest: AudioNode, at: number) {
  const blows = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < blows; i++) {
    const t = at + i * rand(0.7, 0.9);
    thump(ctx, dest, t, 0.25, 1800);
    const o = ctx.createOscillator();
    o.frequency.value = rand(700, 900);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.05, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + 0.06);
  }
}

/** A mill turning: a wooden creak, and water off the wheel. */
function creak(ctx: BaseAudioContext, dest: AudioNode, at: number) {
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  const f = rand(90, 140);
  o.frequency.setValueAtTime(f, at);
  o.frequency.linearRampToValueAtTime(f * rand(1.2, 1.5), at + 0.45);
  const band = filter(ctx, 'bandpass', 420, 3);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(0.12, at + 0.1);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.5);
  const judder = wobble(ctx, g.gain, 31, 0.04);
  o.connect(band).connect(g).connect(dest);
  o.start(at);
  o.stop(at + 0.55);
  judder.stop(at + 0.55);
  thump(ctx, dest, at + 0.5, 0.05, 1100);
}

/** At the butts: an arrow's hiss, and the thock as it goes into the straw. */
function arrow(ctx: BaseAudioContext, dest: AudioNode, at: number) {
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer(ctx, 0.25);
  const band = filter(ctx, 'bandpass', 2600, 2);
  band.frequency.setValueAtTime(2600, at);
  band.frequency.exponentialRampToValueAtTime(900, at + 0.2);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(0.09, at + 0.08);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.2);
  source.connect(band).connect(g).connect(dest);
  source.start(at);
  source.stop(at + 0.22);
  thump(ctx, dest, at + 0.22, 0.4, 350);
}

/** The abbey's little bell, for the hours. */
function chapelBell(ctx: BaseAudioContext, dest: AudioNode, at: number) {
  const strokes = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < strokes; i++) {
    const t = at + i * 1.4;
    for (const [ratio, level, ring] of [[1, 0.1, 2.4], [2.4, 0.04, 1.3], [3.9, 0.025, 0.7], [0.5, 0.03, 2.8]] as const) {
      const o = ctx.createOscillator();
      o.frequency.value = 784 * ratio;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(level, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + ring);
      o.connect(g).connect(dest);
      o.start(t);
      o.stop(t + ring + 0.05);
    }
  }
}

/** The brothers at their office: a slow line of plainchant, in the fen's own D Dorian, on "ah" and "oh". */
function chant(ctx: BaseAudioContext, dest: AudioNode, at: number) {
  const lines = [
    [62, 64, 65, 64, 62],
    [57, 60, 62, 62, 60, 62],
    [62, 65, 67, 65, 64, 62],
  ];
  const line = lines[Math.floor(Math.random() * lines.length)];
  let t = at;
  for (const [i, midi] of line.entries()) {
    const length = i === line.length - 1 ? 1.6 : rand(0.6, 0.9);
    for (const detune of [-5, 6]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = 440 * 2 ** ((midi - 12 - 69) / 12);
      o.detune.value = detune;
      const [f1, f2] = i % 2 ? [570, 840] : [730, 1090];
      const mix = ctx.createGain();
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.16, t + 0.12);
      g.gain.setValueAtTime(0.16, t + length - 0.1);
      g.gain.exponentialRampToValueAtTime(0.0001, t + length + 0.05);
      for (const [f, q] of [[f1, 6], [f2, 9]] as const) o.connect(filter(ctx, 'bandpass', f, q)).connect(mix);
      mix.connect(g).connect(dest);
      o.start(t);
      o.stop(t + length + 0.1);
    }
    t += length;
  }
}

/** A tawny owl: "hoo... hoo-hoo-hoooo". */
function owl(ctx: BaseAudioContext, dest: AudioNode, at: number) {
  for (const [t, length, f] of [[0, 0.45, 420], [1.1, 0.12, 400], [1.35, 0.14, 410], [1.6, 0.7, 395]] as const) {
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(f * 1.04, at + t);
    o.frequency.exponentialRampToValueAtTime(f, at + t + length);
    const vib = wobble(ctx, o.frequency, 9, f * 0.012);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at + t);
    g.gain.exponentialRampToValueAtTime(0.09, at + t + Math.min(0.08, length / 2));
    g.gain.exponentialRampToValueAtTime(0.0001, at + t + length);
    o.connect(g).connect(dest);
    o.start(at + t);
    o.stop(at + t + length + 0.05);
    vib.stop(at + t + length + 0.05);
  }
}

/** A cockerel at first light: "cock-a-doodle-doo". */
function cockerel(ctx: BaseAudioContext, dest: AudioNode, at: number) {
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  const band = filter(ctx, 'bandpass', 1600, 2.5);
  const g = ctx.createGain();
  g.gain.value = 0.0001;
  o.connect(band).connect(g).connect(dest);
  let t = at;
  for (const [f, length] of [[520, 0.12], [700, 0.12], [760, 0.14], [650, 0.55]] as const) {
    o.frequency.setValueAtTime(f, t);
    if (length > 0.3) o.frequency.linearRampToValueAtTime(f * 0.8, t + length);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.14, t + 0.03);
    g.gain.setValueAtTime(0.12, t + length - 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t + length);
    t += length + 0.03;
  }
  o.start(at);
  o.stop(t + 0.05);
}

/** A log settling in the fire: a few sharp pops. */
function crackle(ctx: BaseAudioContext, dest: AudioNode, at: number) {
  for (let i = 0; i < 3 + Math.floor(Math.random() * 5); i++) {
    const t = at + Math.random() * 0.4;
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer(ctx, 0.25);
    const high = filter(ctx, 'highpass', rand(1500, 4500));
    const g = ctx.createGain();
    g.gain.value = rand(0.05, 0.15);
    source.connect(high).connect(g).connect(dest);
    source.start(t, Math.random() * 0.2, 0.02);
  }
}

// --- Mixing by distance ----------------------------------------------------------------------

/** How loud a spot `d` pixels away is, for a kind with this range: 1 on top of it, 0 at the edge. */
const falloff = (d: number, range: number) => (d >= range ? 0 : (1 - d / range) ** 2);

/** How much of a kind of place is around the listener (0 to 1), and which side it's on. */
function presence(spots: Spot[], range: number, full: number, x: number, y: number): { amount: number; pan: number } {
  let sum = 0;
  let side = 0;
  for (const [sx, sy] of spots) {
    const w = falloff(Math.hypot(sx - x, sy - y), range);
    if (w <= 0) continue;
    sum += w;
    side += w * (sx - x);
  }
  return { amount: Math.min(1, sum / full), pan: sum > 0 ? Math.max(-0.85, Math.min(0.85, side / sum / PAN_WIDTH)) : 0 };
}

/** One spot of a kind near the listener, likelier the nearer it is, with how loud and where it sounds from there. */
function nearSpot(spots: Spot[], range: number, x: number, y: number): { level: number; pan: number } | null {
  let total = 0;
  const near: [number, number][] = [];
  for (const [sx, sy] of spots) {
    const w = falloff(Math.hypot(sx - x, sy - y), range);
    if (w > 0.01) {
      near.push([w, sx - x]);
      total += w;
    }
  }
  let pick = Math.random() * total;
  for (const [w, dx] of near) {
    pick -= w;
    if (pick <= 0) return { level: w, pan: Math.max(-0.85, Math.min(0.85, dx / PAN_WIDTH)) };
  }
  return null;
}

/** An output for a one-off sound: as loud as its spot is near, from the spot's side. Let go once the longest of them (the abbey's bell) has rung out. */
function outlet(ctx: BaseAudioContext, dest: AudioNode, level: number, pan: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = level;
  const p = ctx.createStereoPanner();
  p.pan.value = pan;
  g.connect(p).connect(dest);
  setTimeout(() => p.disconnect(), 12_000);
  return g;
}

type OneOff = (ctx: BaseAudioContext, dest: AudioNode, at: number) => void;

/**
 * What comes from each kind of place now and then: how often (a second, at its loudest), by day and
 * by night, and how loud against the rest. The first that fits the moment is chosen.
 */
const CALLS: { kind: Exclude<keyof Soundscape, 'fen'>; day: number; night: number; level: number; sound: OneOff }[] = [
  { kind: 'woods', day: 0.28, night: 0, level: 0.9, sound: blackbird },
  { kind: 'woods', day: 0.22, night: 0, level: 0.8, sound: songbird },
  { kind: 'woods', day: 0.02, night: 0, level: 0.9, sound: cuckoo },
  { kind: 'woods', day: 0.025, night: 0, level: 1, sound: woodpecker },
  { kind: 'woods', day: 0, night: 0.04, level: 1, sound: owl },
  { kind: 'river', day: 0.9, night: 0.9, level: 0.7, sound: droplet },
  { kind: 'still', day: 0.25, night: 0.5, level: 0.9, sound: frog },
  { kind: 'town', day: 0.55, night: 0.08, level: 1, sound: chatter },
  { kind: 'town', day: 0.1, night: 0, level: 1, sound: anvil },
  { kind: 'crows', day: 0.18, night: 0.02, level: 0.8, sound: crow },
  { kind: 'abbey', day: 0.02, night: 0.02, level: 1, sound: chapelBell },
  { kind: 'abbey', day: 0.05, night: 0.03, level: 1, sound: chant },
  { kind: 'mill', day: 0.4, night: 0.4, level: 1, sound: creak },
  { kind: 'mine', day: 0.12, night: 0.03, level: 1, sound: pick },
  { kind: 'butts', day: 0.3, night: 0, level: 1, sound: arrow },
];

function layer(ctx: BaseAudioContext, dest: AudioNode, make: (ctx: BaseAudioContext, dest: AudioNode) => () => void): Layer {
  const gain = ctx.createGain();
  gain.gain.value = 0;
  const pan = ctx.createStereoPanner();
  gain.connect(pan).connect(dest);
  return { gain, pan, stop: make(ctx, gain) };
}

/** Starts the land's own layers: they sit silent until the listener comes near. */
function startLayers(ctx: BaseAudioContext, dest: AudioNode, scape: Soundscape): Map<string, Layer> {
  const layers = new Map<string, Layer>();
  if (scape.river.length) layers.set('river', layer(ctx, dest, brook));
  if (scape.falls.length) layers.set('falls', layer(ctx, dest, falls));
  if (scape.high.length) layers.set('high', layer(ctx, dest, gale));
  layers.set('night', layer(ctx, dest, crickets));
  layers.set('rain', layer(ctx, dest, shower));
  return layers;
}

function mix(a: NonNullable<ReturnType<typeof audio>>, place: Place) {
  const { ctx } = a;
  const { scape, listener } = place;
  const { x, y, night } = listener;
  const layers = current!.layers!;
  const now = ctx.currentTime;
  const set = (id: string, level: number, pan = 0) => {
    const l = layers.get(id);
    levels[id] = Math.round(level * 100) / 100;
    if (!l) return;
    l.gain.gain.setTargetAtTime(level, now, 0.35);
    l.pan.pan.setTargetAtTime(pan, now, 0.35);
  };
  const water = presence(scape.river, RANGE.river, FULL.river, x, y);
  set('river', water.amount * 0.9, water.pan);
  const roar = presence(scape.falls, RANGE.falls, FULL.falls, x, y);
  set('falls', roar.amount * 0.8, roar.pan);
  const high = presence(scape.high, RANGE.high, FULL.high, x, y);
  set('high', high.amount * 0.5, high.pan);
  const rain = listener.rain ?? 0;
  set('night', night * 0.9 * (1 - rain * 0.7));
  set('rain', rain);

  const t = now + 0.05;
  const dest = current!.gain;
  const around = new Map<keyof typeof RANGE, number>();
  for (const call of CALLS) {
    // Rain sends the birds into cover, and the people indoors; frogs don't mind.
    const dry = call.kind === 'still' || call.kind === 'river' ? 1 : 1 - rain * 0.8;
    const rate = (call.day * (1 - night) + call.night * night) * dry;
    const spots = scape[call.kind];
    if (rate <= 0 || !spots.length) continue;
    if (!around.has(call.kind)) around.set(call.kind, presence(spots, RANGE[call.kind], FULL[call.kind], x, y).amount);
    const amount = around.get(call.kind)!;
    if (amount <= 0 || Math.random() > rate * amount * TICK) continue;
    const spot = nearSpot(spots, RANGE[call.kind], x, y);
    if (!spot) continue;
    call.sound(ctx, outlet(ctx, dest, spot.level * call.level, spot.pan), t);
    log(CALL_NAMES.get(call.sound) ?? '?');
  }
  // Open country between the places: a skylark by day; frogs in every fen ditch, more of them at night.
  if (night < 0.5 && !scape.fen && Math.random() < 0.035 * TICK * 2) skylark(ctx, outlet(ctx, dest, 0.8, rand(-0.5, 0.5)), t);
  if (scape.fen && Math.random() < (0.12 + night * 0.25 + rain * 0.2) * TICK * 2) frog(ctx, outlet(ctx, dest, 0.35, rand(-0.7, 0.7)), t);
  // Big drops close by, in a shower.
  if (rain > 0.2 && Math.random() < rain * 1.5 * TICK) droplet(ctx, outlet(ctx, dest, 0.6 * rain, rand(-0.8, 0.8)), t);
  // The cockerel crows once as night gives way to a fresh morning, if there's a farm in earshot.
  const isNight = night > 0.5;
  if (wasNight && !isNight && listener.morning > 0.5) {
    const farm = nearSpot(scape.town, RANGE.town * 1.6, x, y);
    if (farm) {
      cockerel(ctx, outlet(ctx, dest, Math.max(0.35, farm.level), farm.pan), t + 0.4);
      log('cockerel');
    }
  }
  wasNight = isNight;
}

function tick() {
  const a = audio();
  if (!a) return;
  const scape = wantedPlace?.scape ?? null;
  if ((current?.id ?? null) !== wanted || (current && current.scape !== scape)) {
    if (current) {
      const old = current;
      old.gain.gain.setTargetAtTime(0, a.ctx.currentTime, 0.4);
      setTimeout(() => {
        for (const stop of old.stops) stop();
        for (const l of old.layers?.values() ?? []) l.stop();
        old.gain.disconnect();
      }, 3000);
    }
    current = null;
    if (wanted) {
      const gain = a.ctx.createGain();
      gain.gain.value = 0;
      gain.gain.setTargetAtTime(1, a.ctx.currentTime, 0.6);
      gain.connect(a.ambience);
      const stops = wanted === 'fire' ? [] : [wind(a.ctx, gain, wanted === 'fen')];
      current = { id: wanted, gain, stops, layers: scape ? startLayers(a.ctx, gain, scape) : null, scape };
      wasNight = false;
    }
  }
  if (!current) return;
  const t = a.ctx.currentTime + 0.05;
  if (current.layers && wantedPlace) mix(a, wantedPlace);
  else if (current.id === 'heath' && Math.random() < 0.05 * (TICK / 0.2)) songbird(a.ctx, current.gain, t);
  else if (current.id === 'fen' && Math.random() < 0.06 * (TICK / 0.2)) frog(a.ctx, current.gain, t);
  if (current.id === 'fire' && Math.random() < 0.12 * (TICK / 0.2)) crackle(a.ctx, current.gain, t);
}

/**
 * Asks for a screen's sound (or quiet). On the map, `place` says where the land makes its sounds
 * and who is listening, every frame. Takes effect once sound is awake.
 */
export function setAmbience(id: AmbienceId | null, place: Place | null = null) {
  wantedPlace = place;
  if (id === wanted) return;
  wanted = id;
  whenAwake(() => {
    if (!timer) timer = setInterval(tick, TICK * 1000);
    tick();
  });
}

/** What the ambience is doing: its bed, how loud each of the land's layers is, and the last one-off sounds. For scripts. */
export const heard = () => ({ bed: current?.id ?? null, layers: { ...levels }, recent: [...recent] });

/** The one-off sounds, by name, for `npm run listen`. */
export const AMBIENT_CALLS = { songbird, blackbird, cuckoo, woodpecker, skylark, crow, frog, droplet, chatter, anvil, pick, creak, arrow, chapelBell, chant, owl, cockerel, crackle };
/** Each one-off's name, for the log (the functions' own names don't survive the build). */
const CALL_NAMES = new Map<OneOff, string>(Object.entries(AMBIENT_CALLS).map(([name, f]) => [f, name]));

/** And the layers that go on while you're near. */
export const AMBIENT_LAYERS = { brook, falls, gale, crickets, shower };
