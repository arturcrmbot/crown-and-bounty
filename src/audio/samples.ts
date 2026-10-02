/**
 * The recorded sound effects (#257): takes cut from recordings made by people and packed by
 * `scripts/sfx.py` into `public/assets/sfx/` (one lossless FLAC and its JSON index a pack). A pack is
 * fetched and decoded once, after the first click, and each effect plays one of its takes at random,
 * a little higher or lower each time, so a hundred blows in a fight never sound like one recording.
 * Until its pack is in, an effect is silent.
 */

/** A pack's index: the rate its takes are stored at, and each effect's takes (where each starts, and how long it is, in the pack's samples). */
export type SamplePack = { rate: number; effects: Record<string, { offset: number; length: number }[]> };

/** The sounds of a fight; those of the map, the cards and the hero screen; and the land's own, under the music. */
export type PackId = 'battle' | 'map' | 'land';

const takes = new Map<string, AudioBuffer[]>();
const loading = new Map<PackId, Promise<void>>();
/** Loops asked for before their pack was in, each waiting to start once it is. */
const waiting = new Map<string, (() => void)[]>();

export const samplesReady = (id: string) => takes.has(id);

/**
 * Fetches and decodes a pack, once (later calls wait on the first). FLAC is decoded at its own rate,
 * so every take comes out exactly as it was cut.
 */
export function loadSamples(pack: PackId, base = import.meta.env.BASE_URL): Promise<void> {
  let p = loading.get(pack);
  if (!p) {
    p = (async () => {
      const [index, bytes] = await Promise.all([
        fetch(`${base}assets/sfx/${pack}.json`).then((r) => r.json() as Promise<SamplePack>),
        fetch(`${base}assets/sfx/${pack}.flac`).then((r) => r.arrayBuffer()),
      ]);
      const decoded = await new OfflineAudioContext(1, 1, index.rate).decodeAudioData(bytes);
      const all = decoded.getChannelData(0);
      // Should a browser decode it at another rate after all, the takes still sit in proportion.
      const scale = decoded.sampleRate / index.rate;
      for (const [id, list] of Object.entries(index.effects)) {
        takes.set(
          id,
          list.map(({ offset, length }) => {
            const from = Math.round(offset * scale);
            const n = Math.max(1, Math.round(length * scale));
            const buffer = new AudioBuffer({ length: n, sampleRate: decoded.sampleRate, numberOfChannels: 1 });
            buffer.copyToChannel(all.slice(from, from + n), 0);
            return buffer;
          }),
        );
        for (const start of waiting.get(id) ?? []) start();
        waiting.delete(id);
      }
    })().catch((e) => {
      loading.delete(pack);
      throw e;
    });
    loading.set(pack, p);
  }
  return p;
}

/**
 * Plays one of an effect's takes at random into `dest` at `at`, `semitones` higher (or lower) than
 * it was recorded and moved by up to `spread` more either way, its speed moving with its pitch, as a
 * recording played faster does. Silent until its pack is in.
 */
export function playSample(ctx: BaseAudioContext, dest: AudioNode, at: number, id: string, spread = 0, semitones = 0) {
  const list = takes.get(id);
  if (!list?.length) return;
  const source = ctx.createBufferSource();
  source.buffer = list[Math.floor(Math.random() * list.length)];
  source.playbackRate.value = 2 ** ((semitones + (Math.random() * 2 - 1) * spread) / 12);
  source.connect(dest);
  source.start(at);
}

/**
 * Plays one of an effect's takes round and round into `dest`, from a random point in it (so two
 * places with the same water never run together), until the stop it returns is called. Asked for
 * before its pack is in, it starts as soon as the pack is.
 */
export function loopSample(ctx: BaseAudioContext, dest: AudioNode, id: string): () => void {
  let source: AudioBufferSourceNode | null = null;
  let stopped = false;
  const start = () => {
    const list = takes.get(id);
    if (stopped || !list?.length) return;
    const buffer = list[Math.floor(Math.random() * list.length)];
    source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(dest);
    source.start(ctx.currentTime, Math.random() * buffer.duration);
  };
  if (takes.has(id)) start();
  else waiting.set(id, [...(waiting.get(id) ?? []), start]);
  return () => {
    stopped = true;
    source?.stop();
  };
}
