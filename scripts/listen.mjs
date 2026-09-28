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
    const { TRACKS, notesOf, loopUnits, midiOf, gateLevel } = await import('/src/audio/score.ts');
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
    const MOODS = { map: { intensity: 0, balance: 0 }, start: { intensity: 0.25, balance: 0 }, heated: { intensity: 0.85, balance: 0 }, winning: { intensity: 0.85, balance: 0.6 }, losing: { intensity: 0.85, balance: -0.6 } };
    for (const [id, track] of Object.entries(TRACKS)) {
      if (!want('tracks', id)) continue;
      const loop = loopUnits(track) * track.unit;
      const notes = notesOf(track);
      const gated = notes.some((n) => n.gate);
      /** Renders the stretch of track time [from, to) (laps wrap round), in a mood, and returns it without its 3 s lead-in. */
      const stretch = async (from, to, mood) => {
        const lead = 3;
        const data = await render(to - from + lead + 2, LEVELS.music, (ctx, dest) => {
          for (let lap = Math.floor((from - lead) / loop); lap <= Math.floor(to / loop); lap++) {
            for (const n of notes) {
              const t = lap * loop + n.at * track.unit;
              if (t < from - lead || t >= to) continue;
              const level = gateLevel(n.gate, mood);
              if (level > 0.02) playNote(ctx, dest, n.instrument, t - (from - lead), n.midi, n.length * track.unit, n.volume * level);
            }
          }
        });
        return data.subarray(Math.floor(lead * RATE), Math.floor((lead + to - from) * RATE));
      };
      // Each pass of the form on its own, so a quiet verse can't hide.
      const passes = [];
      let at = 0;
      for (const pass of track.form) {
        const seconds = track.sections[pass.section].chords.length * track.unitsPerBar * track.unit;
        const data = await stretch(at, at + seconds, MOODS.map);
        passes.push(`${pass.section}:${db(rms(data))}`);
        at += seconds;
      }
      // The seam: the last seconds of the loop and the first of the next time round.
      const seam = await stretch(loop - 3, loop + 3, MOODS.map);
      const moods = {};
      if (gated) for (const [name, mood] of Object.entries(MOODS)) moods[name] = db(rms(await stretch(0, Math.min(loop, 20), mood)));
      out.tracks.push({ id, seconds: Math.round(loop), passes, seamBefore: db(rms(seam, 0, 3 * RATE)), seamAfter: db(rms(seam, 3 * RATE)), moods });
    }
    return out;
  }, only);
  if (report.stings.length) {
    console.log('\nStings (through the music bus and the master; dB below full scale)');
    console.log('id        peak   loudest  rings  duck  next');
    for (const s of report.stings) console.log(`${s.id.padEnd(9)} ${String(s.peak).padStart(5)}  ${String(s.loudest).padStart(6)}  ${String(s.rings).padStart(5)}s ${String(s.duck).padStart(4)}s ${s.next === null ? '' : `${s.next}s`}`);
  }
  if (report.tracks.length) {
    console.log('\nTracks (as heard in the game): each pass of the form, the seam, and for gated tracks each mood (first 20 s, dB RMS)');
    for (const t of report.tracks) {
      console.log(`${t.id.padEnd(9)} ${String(t.seconds).padStart(4)}s  passes ${t.passes.join('  ')}  seam ${t.seamBefore} -> ${t.seamAfter}`);
      if (Object.keys(t.moods).length) console.log(`${''.padEnd(16)}moods ${Object.entries(t.moods).map(([k, v]) => `${k} ${v}`).join('  ')}`);
    }
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
