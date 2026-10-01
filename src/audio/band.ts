/**
 * The band: a few General MIDI instruments from GeneralUser GS, S. Christian Collins's free
 * SoundFont, cut down by `scripts/soundfont.py` to `public/assets/music/band.flac` and `band.json`.
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
/** A sample in the pack: where it starts and how long it is (in the pack's samples), the rate it plays at, and its loop. */
export type Sample = { offset: number; length: number; rate: number; loopStart: number; loopEnd: number };
/** The pack: the rate it's stored at, its samples one after another, and each instrument's zones. */
export type BandData = { source: string; rate: number; samples: Sample[]; instruments: Record<BandInstrument, Zone[]> };

type Band = { data: BandData; buffers: AudioBuffer[] };
let band: Band | null = null;
let loading: Promise<void> | null = null;

export const bandReady = () => band !== null;

/**
 * Fetches and decodes the band's samples, once (later calls wait on the first). The pack is
 * lossless FLAC, decoded at its own rate, so every sample and loop comes out exactly as it was cut.
 */
export function loadBand(base = import.meta.env.BASE_URL): Promise<void> {
  loading ??= (async () => {
    const [data, pack] = await Promise.all([
      fetch(`${base}assets/music/band.json`).then((r) => r.json() as Promise<BandData>),
      fetch(`${base}assets/music/band.flac`).then((r) => r.arrayBuffer()),
    ]);
    const decoded = await new OfflineAudioContext(1, 1, data.rate).decodeAudioData(pack);
    const all = decoded.getChannelData(0);
    // Should a browser decode it at another rate after all, the samples still sit in proportion.
    const scale = decoded.sampleRate / data.rate;
    const buffers = data.samples.map((s) => {
      const from = Math.round(s.offset * scale);
      const length = Math.max(1, Math.round(s.length * scale));
      // A whole number of samples a second, which every browser takes; the note's rate makes up the hair of difference.
      const buffer = new AudioBuffer({ length, sampleRate: Math.round(s.rate * scale), numberOfChannels: 1 });
      buffer.copyToChannel(all.slice(from, from + length), 0);
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
  // The buffer holds the sample at a rounded rate (and, in a browser that decoded the pack at
  // another rate, scaled): play it at the rate it was cut at, and its loop where it was.
  const scale = buffer.length / Math.max(1, s.length);
  source.playbackRate.value = 2 ** (pitch + z.tune / 1200) * ((s.rate * scale) / buffer.sampleRate);
  if (z.loop && s.loopEnd > s.loopStart + 8) {
    source.loop = true;
    source.loopStart = (s.loopStart * scale) / buffer.sampleRate;
    source.loopEnd = (s.loopEnd * scale) / buffer.sampleRate;
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
