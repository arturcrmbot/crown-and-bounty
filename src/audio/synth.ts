/**
 * What the sound effects are made of: tones, bursts and swishes of noise, the crackle of tiny grains,
 * the ring of struck metal or wood, and a voice through its vowels. Each plays into any context and
 * any output at a given time, so an effect can play live or be rendered offline and measured
 * (`npm run listen`). A little chance in most of them keeps a sound heard a hundred times in a
 * battle from sounding like a recording.
 */

export const rand = (a: number, b: number) => a + Math.random() * (b - a);

const whites = new Map<number, AudioBuffer>();
/** Two seconds of white noise at a context's rate, the same every time, for bursts to start anywhere in. */
function white(ctx: BaseAudioContext): AudioBuffer {
  let buffer = whites.get(ctx.sampleRate);
  if (!buffer) {
    buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let seed = 20260929;
    for (let i = 0; i < data.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      data[i] = seed / 2 ** 31 - 1;
    }
    whites.set(ctx.sampleRate, buffer);
  }
  return buffer;
}

/** Noise, from somewhere in the buffer, for `length` seconds from `at`. */
function noiseFrom(ctx: BaseAudioContext, at: number, length: number): AudioBufferSourceNode {
  const source = ctx.createBufferSource();
  source.buffer = white(ctx);
  const span = Math.min(1.9, length + 0.05);
  source.start(at, Math.random() * (2 - span), span);
  return source;
}

function filter(ctx: BaseAudioContext, type: BiquadFilterType, frequency: number, q: number, at: number, to?: number, until?: number): BiquadFilterNode {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(frequency, at);
  if (to !== undefined && until !== undefined && to !== frequency) f.frequency.exponentialRampToValueAtTime(to, until);
  return f;
}

/** A plucked or struck tone: a wave that comes in over `attack` and dies away, maybe sliding by `slide` as it goes. */
export function tone(ctx: BaseAudioContext, dest: AudioNode, at: number, frequency: number, length: number, volume: number, type: OscillatorType = 'sine', slide = 1, attack = 0.008) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(frequency, at);
  if (slide !== 1) o.frequency.exponentialRampToValueAtTime(frequency * slide, at + length);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(volume, at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + length);
  o.connect(g).connect(dest);
  o.start(at);
  o.stop(at + length + 0.02);
}

/** A burst of noise through a filter, that starts at once (or over `attack`) and dies away: thumps, knocks, hisses. */
export function burst(ctx: BaseAudioContext, dest: AudioNode, at: number, length: number, type: BiquadFilterType, frequency: number, volume: number, sweep = 1, q = 1, attack = 0) {
  const source = noiseFrom(ctx, at, length);
  const f = filter(ctx, type, frequency, q, at, frequency * sweep, at + length);
  const g = ctx.createGain();
  if (attack > 0) {
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(volume, at + attack);
  } else g.gain.setValueAtTime(volume, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + length);
  source.connect(f).connect(g).connect(dest);
}

/** A swish through the air: noise that swells as its pitch falls from `from` to `to`, and stops short at the end. */
export function swish(ctx: BaseAudioContext, dest: AudioNode, at: number, length: number, from: number, to: number, volume: number, q = 1.2) {
  const source = noiseFrom(ctx, at, length);
  const f = filter(ctx, 'bandpass', from, q, at, to, at + length);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(volume, at + length * 0.8);
  g.gain.exponentialRampToValueAtTime(0.0001, at + length);
  source.connect(f).connect(g).connect(dest);
}

/** Partials of something struck: each a ratio of the lowest, with its level and how long it rings (seconds). */
export type Partials = readonly (readonly [ratio: number, level: number, rings: number])[];
/** Dry wood knocked: a low note that's gone at once, and a couple of hard overtones. */
export const WOOD: Partials = [[1, 1, 0.07], [2.7, 0.45, 0.04], [5.3, 0.2, 0.02]];
/** Steel or iron struck: clashing, out-of-tune partials that ring on. */
export const STEEL: Partials = [[1, 1, 0.24], [1.58, 0.6, 0.18], [2.24, 0.45, 0.13], [2.87, 0.35, 0.1], [3.54, 0.25, 0.08]];

/** Something struck that rings: its partials over `base` Hz, from `at`. */
export function ring(ctx: BaseAudioContext, dest: AudioNode, at: number, base: number, partials: Partials, volume: number) {
  for (const [ratio, level, rings] of partials) {
    const o = ctx.createOscillator();
    o.frequency.value = base * ratio;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(volume * level, at + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, at + rings);
    o.connect(g).connect(dest);
    o.start(at);
    o.stop(at + rings + 0.02);
  }
}

/**
 * A crackle of tiny grains of noise, as a sheet of parchment makes when it's handled, or wood when
 * it splinters: they come thicker towards `peak` (a share of `length`) and thin out after, over a
 * faint hiss, `perSecond` of them at the thickest. Each is made afresh, so no two sound the same.
 */
export function crackle(ctx: BaseAudioContext, dest: AudioNode, at: number, length: number, peak: number, perSecond: number, volume: number, type: BiquadFilterType, frequency: number, q = 0.8) {
  const rate = ctx.sampleRate;
  const n = Math.ceil(rate * length);
  const buffer = ctx.createBuffer(1, n, rate);
  const data = buffer.getChannelData(0);
  const fade = Math.exp(-1 / (rate * 0.0012));
  let grain = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const thick = t < peak ? t / peak : (1 - t) / (1 - peak);
    if (Math.random() < (thick * perSecond) / rate) grain = Math.max(grain, 0.35 + Math.random() * 0.65);
    grain *= fade;
    data[i] = (Math.random() * 2 - 1) * (grain + 0.06 * thick);
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const g = ctx.createGain();
  g.gain.value = volume;
  source.connect(filter(ctx, type, frequency, q, at)).connect(g).connect(dest);
  source.start(at);
}

/** A cry, a grunt or a yelp: how it's pitched, what vowel it's on, and how rough. */
export type Voice = {
  /** The pitch through the cry: [share of its length, Hz], the first at 0. */
  pitch: readonly (readonly [share: number, hz: number])[];
  length: number;
  volume: number;
  /** The vowel's formants in Hz (its resonances), and the vowel it slides to by the end. None: a beast's plain whine. */
  vowel: readonly number[];
  to?: readonly number[];
  /** A growl or a rattle: its loudness wobbling `rate` times a second, by `depth` (0 to 1). */
  growl?: readonly [rate: number, depth: number];
  /** A quaver in the pitch: `rate` times a second, by `depth` (a share of the pitch). */
  quaver?: readonly [rate: number, depth: number];
  /** How much breath (noise) there is in it, against the buzz of the throat. */
  breath?: number;
  wave?: OscillatorType;
  attack?: number;
};

/** How sharp each formant is, and how loud against the first. */
const FORMANT_Q = [6, 9, 12];
const FORMANT_LEVEL = [1, 0.6, 0.3];
/** Formants let little of the buzz through: this brings a voice up to the scale of the other sounds. */
const VOICE_GAIN = 1;

/** A voice: the buzz of a throat (a sawtooth, sliding through its pitches) and some breath, through the resonances of a vowel. */
export function voice(ctx: BaseAudioContext, dest: AudioNode, at: number, v: Voice) {
  const end = at + v.length;
  const o = ctx.createOscillator();
  o.type = v.wave ?? 'sawtooth';
  o.frequency.setValueAtTime(v.pitch[0][1], at);
  for (const [share, hz] of v.pitch.slice(1)) o.frequency.exponentialRampToValueAtTime(hz, at + share * v.length);
  const sources: AudioScheduledSourceNode[] = [o];
  if (v.quaver) {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = v.quaver[0];
    const depth = ctx.createGain();
    depth.gain.value = v.quaver[1] * v.pitch[0][1];
    lfo.connect(depth).connect(o.frequency);
    sources.push(lfo);
  }
  const attack = v.attack ?? 0.012;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(v.volume, at + attack);
  env.gain.setValueAtTime(v.volume, Math.max(at + attack + 0.001, end - v.length * 0.4));
  env.gain.exponentialRampToValueAtTime(0.0001, end);
  env.connect(dest);
  let into: AudioNode = env;
  if (v.growl) {
    const am = ctx.createGain();
    am.gain.value = 1 - v.growl[1] / 2;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = v.growl[0];
    const depth = ctx.createGain();
    depth.gain.value = v.growl[1] / 2;
    lfo.connect(depth).connect(am.gain);
    am.connect(env);
    into = am;
    sources.push(lfo);
  }
  const sum = ctx.createGain();
  sum.gain.value = VOICE_GAIN;
  sum.connect(into);
  const breath = v.breath ? noiseFrom(ctx, at, v.length) : null;
  const air = ctx.createGain();
  air.gain.value = v.breath ?? 0;
  breath?.connect(air);
  if (!v.vowel.length) {
    // A beast's whine: its own pitch, with the harshest of the buzz taken off.
    const soft = filter(ctx, 'lowpass', 2600, 0.7, at);
    o.connect(soft).connect(sum);
    air.connect(soft);
    sum.gain.value = 0.2;
  }
  v.vowel.forEach((hz, i) => {
    const band = filter(ctx, 'bandpass', hz, FORMANT_Q[i] ?? 12, at, v.to?.[i] ?? hz, end);
    const level = ctx.createGain();
    level.gain.value = FORMANT_LEVEL[i] ?? 0.2;
    o.connect(band);
    air.connect(band);
    band.connect(level).connect(sum);
  });
  for (const s of sources) {
    s.start(at);
    s.stop(end + 0.02);
  }
}
