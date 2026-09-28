// Listens to the music without ears: renders tracks and stings offline in headless Edge, through the
// game's own buses and master chain, and prints how loud they are, how they end and how they loop.
//   npm run listen                 (everything)
//   npm run listen -- stings       (or tracks, or a name: heath, victory...)
import { openPage } from './lib/browser.mjs';
import { startServer } from './lib/server.mjs';

const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const server = await startServer();
const { browser, page, errors } = await openPage();
try {
  // Any page of the game's origin will do: the modules load straight from the dev server.
  await page.goto(`${server.url}?freeze=1`);
  await page.waitForFunction(() => window.__ready === true);
  const report = await page.evaluate(async (wanted) => {
    const { playNote } = await import('/src/audio/instruments.ts');
    const { STINGS } = await import('/src/audio/stings.ts');
    const { TRACKS, notesOf, loopUnits, midiOf } = await import('/src/audio/score.ts');
    const { LEVELS, masterChain } = await import('/src/audio/context.ts');
    const { AMBIENT_CALLS, AMBIENT_LAYERS } = await import('/src/audio/ambience.ts');
    const RATE = 44100;
    const want = (group, name) => !wanted.length || wanted.includes(group) || wanted.includes(name);

    /** Renders `seconds` of sound made by `play(ctx, dest)`, through a bus at `level` and the master chain. */
    async function render(seconds, level, play) {
      const ctx = new OfflineAudioContext(1, Math.ceil(RATE * seconds), RATE);
      const bus = ctx.createGain();
      bus.gain.value = level;
      bus.connect(masterChain(ctx));
      play(ctx, bus);
      return (await ctx.startRendering()).getChannelData(0);
    }
    const db = (v) => (v > 0 ? Math.round(20 * Math.log10(v) * 10) / 10 : -Infinity);
    const rms = (data, from = 0, to = data.length) => {
      let sum = 0;
      for (let i = from; i < to; i++) sum += data[i] * data[i];
      return Math.sqrt(sum / Math.max(1, to - from));
    };
    /** Peak, overall loudness, and the loudest 400 ms. */
    function stats(data) {
      let peak = 0;
      for (const v of data) peak = Math.max(peak, Math.abs(v));
      const win = Math.floor(RATE * 0.4);
      let loudest = 0;
      for (let i = 0; i + win <= data.length; i += Math.floor(win / 4)) loudest = Math.max(loudest, rms(data, i, i + win));
      return { peak: db(peak), rms: db(rms(data)), loudest: db(loudest) };
    }
    /** When the sound has died away to -50 dB for good, in seconds. */
    function tail(data) {
      const win = Math.floor(RATE * 0.05);
      for (let i = data.length - win; i > 0; i -= win) if (rms(data, i, i + win) > 10 ** (-50 / 20)) return Math.round(((i + win) / RATE) * 100) / 100;
      return 0;
    }
    const out = { stings: [], tracks: [], ambience: [] };
    for (const [id, make] of Object.entries(AMBIENT_LAYERS)) {
      if (!want('ambience', id)) continue;
      const data = await render(4, LEVELS.ambience, (ctx, dest) => make(ctx, dest));
      out.ambience.push({ id, kind: 'layer', ...stats(data.subarray(RATE)) });
    }
    for (const [id, make] of Object.entries(AMBIENT_CALLS)) {
      if (!want('ambience', id)) continue;
      const data = await render(8, LEVELS.ambience, (ctx, dest) => make(ctx, dest, 0.05));
      out.ambience.push({ id, kind: 'call', ...stats(data), rings: tail(data) });
    }
    for (const [id, def] of Object.entries(STINGS)) {
      if (!want('stings', id)) continue;
      const data = await render(6, LEVELS.music, (ctx, dest) => {
        for (const [instrument, at, note, length, volume] of def.hits) playNote(ctx, dest, instrument, 0.05 + at, instrument === 'tabor' || instrument === 'rim' ? 0 : midiOf(note), length, volume * def.level);
      });
      out.stings.push({ id, ...stats(data), rings: tail(data), duck: def.duck, next: def.next ?? null });
    }
    for (const [id, track] of Object.entries(TRACKS)) {
      if (!want('tracks', id)) continue;
      const loop = loopUnits(track) * track.unit;
      const notes = notesOf(track);
      // Two laps, so the seam between them sounds as it will in the game.
      const data = await render(loop * 2 + 3, LEVELS.music, (ctx, dest) => {
        for (let lap = 0; lap < 2; lap++) for (const n of notes) playNote(ctx, dest, n.instrument, 0.05 + lap * loop + n.at * track.unit, n.midi, n.length * track.unit, n.volume);
      });
      const at = (s) => Math.floor((0.05 + s) * RATE);
      // How loud the second before the seam, the second after it, and the second lap as a whole are.
      const before = db(rms(data, at(loop - 1), at(loop)));
      const after = db(rms(data, at(loop), at(loop + 1)));
      const lap = rms(data, at(loop), at(loop * 2));
      out.tracks.push({ id, seconds: Math.round(loop * 10) / 10, ...stats(data.subarray(at(loop), at(loop * 2))), lap: db(lap), seamBefore: before, seamAfter: after });
    }
    return out;
  }, only);
  if (report.stings.length) {
    console.log('\nStings (through the music bus and the master; dB below full scale)');
    console.log('id        peak   loudest  rings  duck  next');
    for (const s of report.stings) console.log(`${s.id.padEnd(9)} ${String(s.peak).padStart(5)}  ${String(s.loudest).padStart(6)}  ${String(s.rings).padStart(5)}s ${String(s.duck).padStart(4)}s ${s.next === null ? '' : `${s.next}s`}`);
  }
  if (report.tracks.length) {
    console.log('\nTracks (the second lap, as heard in the game)');
    console.log('id        loop    peak   rms   loudest   seam: last s -> first s');
    for (const t of report.tracks) console.log(`${t.id.padEnd(9)} ${String(t.seconds).padStart(5)}s ${String(t.peak).padStart(6)} ${String(t.rms).padStart(6)} ${String(t.loudest).padStart(7)}   ${t.seamBefore} -> ${t.seamAfter}`);
  }
  if (report.ambience.length) {
    console.log('\nAmbience at its loudest (right on top of it; through the ambience bus and the master)');
    console.log('id          kind    peak   loudest  rings');
    for (const a of report.ambience) console.log(`${a.id.padEnd(11)} ${a.kind.padEnd(5)} ${String(a.peak).padStart(6)}  ${String(a.loudest).padStart(6)}  ${a.rings === undefined ? '' : `${a.rings}s`}`);
  }
  if (errors.length) console.log(`page errors: ${errors.join(' | ')}`);
} finally {
  await browser.close();
  await server.close();
}
