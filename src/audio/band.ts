/**
 * The band: a few General MIDI instruments from GeneralUser GS, S. Christian Collins's free
 * SoundFont, cut down by `scripts/soundfont.py` to `public/assets/music/band.bin` and `band.json`.
 * Each note plays its zone's sample tuned to its key, looped while it's held, through the zone's
 * volume envelope, as a 90s sound card played General MIDI. The pack is fetched and decoded once,
 * as sound wakes.
 */

export const MELODIC = ['flute', 'oboe', 'clarinet', 'recorder', 'horn', 'harp', 'harpsichord', 'pizzicato', 'glockenspiel', 'guitar', 'strings', 'upright'] as const;
export const KIT = ['kick', 'stick', 'snare', 'hat', 'tom', 'crash', 'ride', 'tambourine'] as const;
export type Melodic = (typeof MELODIC)[number];
export type Drum = (typeof KIT)[number];
export type BandInstrument = Melodic | Drum;

/**
 * The keys each instrument plays well: the score folds every note into its instrument's, by
 * octaves, so nothing sits too low for a phone to play or too high to bear. `scripts/soundfont.py`
 * keeps the samples for these keys (its `RANGES`, which the test checks against these).
 */
export const RANGES: Record<Melodic, [low: number, high: number]> = {
  flute: [60, 96],
  recorder: [60, 96],
  oboe: [58, 91],
  clarinet: [50, 91],
  horn: [41, 77],
  harp: [36, 96],
  harpsichord: [36, 96],
  pizzicato: [36, 84],
  glockenspiel: [67, 100],
  guitar: [40, 79],
  strings: [40, 88],
  upright: [33, 64],
};

export type Zone = {
  keys: [number, number];
  /** The key its sample sounds at, and how far it is out of tune (cents). */
  root: number;
  tune: number;
  sample: number;
  loop: boolean;
  /** The volume envelope, in seconds, and the sustain as a share of the peak. */
  attack: number;
  hold: number;
  decay: number;
  sustain: number;
  release: number;
  /** A low-pass filter's cutoff (Hz), if the SoundFont gives one. */
  cutoff: number | null;
  /** Brings the sample to the band's common loudness at full volume. */
  gain: number;
  drum?: boolean;
};
export type Sample = { offset: number; length: number; rate: number; predictor: number; index: number; loopStart: number; loopEnd: number };
export type BandData = { source: string; samples: Sample[]; instruments: Record<BandInstrument, Zone[]> };

const STEPS = [
  7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 19, 21, 23, 25, 28, 31, 34, 37, 41, 45, 50, 55, 60, 66, 73, 80, 88, 97, 107, 118, 130, 143, 157, 173, 190, 209, 230, 253, 279, 307, 337, 371, 408,
  449, 494, 544, 598, 658, 724, 796, 876, 963, 1060, 1166, 1282, 1411, 1552, 1707, 1878, 2066, 2272, 2499, 2749, 3024, 3327, 3660, 4026, 4428, 4871, 5358, 5894, 6484, 7132, 7845, 8630,
  9493, 10442, 11487, 12635, 13899, 15289, 16818, 18500, 20350, 22385, 24623, 27086, 29794, 32767,
];
const INDEX = [-1, -1, -1, -1, 2, 4, 6, 8];

/** Decodes a sample's IMA ADPCM: four bits a sample, two to a byte (low nibble first), each a step from the last value. */
export function decodeAdpcm(pack: Uint8Array, s: Sample): Float32Array {
  const out = new Float32Array(s.length);
  let [value, index] = [s.predictor, s.index];
  for (let i = 0; i < s.length; i++) {
    const code = (pack[s.offset + (i >> 1)] >> (4 * (i & 1))) & 15;
    const step = STEPS[index];
    let delta = step >> 3;
    if (code & 4) delta += step;
    if (code & 2) delta += step >> 1;
    if (code & 1) delta += step >> 2;
    value = Math.max(-32768, Math.min(32767, code & 8 ? value - delta : value + delta));
    index = Math.max(0, Math.min(88, index + INDEX[code & 7]));
    out[i] = value / 32768;
  }
  return out;
}

type Band = { data: BandData; buffers: AudioBuffer[] };
let band: Band | null = null;
let loading: Promise<void> | null = null;

export const bandReady = () => band !== null;

/** Fetches and decodes the band's samples, once (later calls wait on the first). */
export function loadBand(base = import.meta.env.BASE_URL): Promise<void> {
  loading ??= (async () => {
    const [data, pack] = await Promise.all([
      fetch(`${base}assets/music/band.json`).then((r) => r.json() as Promise<BandData>),
      fetch(`${base}assets/music/band.bin`).then((r) => r.arrayBuffer()),
    ]);
    const bytes = new Uint8Array(pack);
    const buffers = data.samples.map((s) => {
      // A whole number of samples a second, which every browser takes; the note's rate makes up the hair of difference.
      const buffer = new AudioBuffer({ length: Math.max(1, s.length), sampleRate: Math.round(s.rate), numberOfChannels: 1 });
      buffer.copyToChannel(decodeAdpcm(bytes, s) as Float32Array<ArrayBuffer>, 0);
      return buffer;
    });
    band = { data, buffers };
  })().catch((e) => {
    loading = null;
    throw e;
  });
  return loading;
}

/** The zone a key plays on an instrument: the one whose keys hold it, or the nearest. */
export function zoneFor(zones: Zone[], key: number): Zone {
  return zones.find((z) => z.keys[0] <= key && key <= z.keys[1]) ?? zones.reduce((a, b) => (Math.abs(b.root - key) < Math.abs(a.root - key) ? b : a));
}

/**
 * Plays one note on a band instrument, if the band has loaded (silently, if not). `length` is how
 * long it's held, in seconds, and `volume` about 0 to 1; a drum ignores the key.
 */
export function playBand(ctx: BaseAudioContext, dest: AudioNode, instrument: BandInstrument, at: number, key: number, length: number, volume: number) {
  if (!band) return;
  const zones = band.data.instruments[instrument];
  if (!zones?.length) return;
  const z = zoneFor(zones, key);
  const s = band.data.samples[z.sample];
  const buffer = band.buffers[z.sample];
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const pitch = z.drum ? 0 : (key - z.root) / 12;
  source.playbackRate.value = 2 ** (pitch + z.tune / 1200) * (s.rate / buffer.sampleRate);
  if (z.loop && s.loopEnd > s.loopStart + 8) {
    source.loop = true;
    source.loopStart = s.loopStart / buffer.sampleRate;
    source.loopEnd = s.loopEnd / buffer.sampleRate;
  }
  const peak = Math.max(0.0001, volume * z.gain);
  const env = ctx.createGain();
  const g = env.gain;
  // The envelope up to the note's end, worked out ahead (notes are scheduled before they play):
  // attack to the peak, hold, then fall towards the sustain at the SoundFont's rate (its decay is
  // the time to fall 100 dB), then the release from wherever it had got to.
  const end = at + Math.max(0.02, length);
  const top = at + Math.max(0.002, z.attack);
  const held = top + z.hold;
  const sustain = Math.max(0.0001, peak * z.sustain);
  const fall = z.sustain > 0.0001 ? (-20 * Math.log10(z.sustain)) / 100 : 1;
  const settled = held + Math.max(0.001, z.decay * fall);
  g.setValueAtTime(0, at);
  let level: number;
  if (end <= top) {
    level = (peak * (end - at)) / (top - at);
    g.linearRampToValueAtTime(level, end);
  } else {
    g.linearRampToValueAtTime(peak, top);
    if (end <= held) {
      level = peak;
      g.setValueAtTime(peak, end);
    } else if (end < settled) {
      level = peak * (sustain / peak) ** ((end - held) / (settled - held));
      g.setValueAtTime(peak, held);
      g.exponentialRampToValueAtTime(Math.max(0.0001, level), end);
    } else {
      level = sustain;
      g.setValueAtTime(peak, held);
      g.exponentialRampToValueAtTime(sustain, settled);
      g.setValueAtTime(sustain, end);
    }
  }
  // The release, too, is the SoundFont's time to fall 100 dB: from part-way down, it has less to fall.
  const release = Math.min(3, Math.max(0.03, z.release * Math.max(0, 1 + Math.log10(Math.max(level / peak, 1e-5)) / 5)));
  g.exponentialRampToValueAtTime(0.0001, end + release);
  let into: AudioNode = env;
  if (z.cutoff && !z.drum && z.cutoff >= 500) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = Math.min(z.cutoff, ctx.sampleRate / 2 - 100);
    filter.connect(env);
    into = filter;
  }
  env.connect(dest);
  source.connect(into);
  source.start(at);
  source.stop(end + release + 0.05);
}
