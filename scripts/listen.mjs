// Listens to the sound without ears: renders tracks, stings, effects and ambience offline in headless
// Edge, through the game's own buses and master chain, and prints how loud they are (as a listener
// hears loudness: K-weighted, in LUFS, see ITU-R BS.1770), how far each sits from its mark in the mix
// (`MARKS` in src/audio/context.ts), how far the score ducks under each sting, how they end, how
// bright they are and how the tracks loop.
//   npm run listen                 (everything)
//   npm run listen -- stings       (or tracks, effects, ambience, or a name: fields, victory, blow:bite...)
//   npm run listen -- --check      (and fail if anything sits too far from its mark, or peaks too high)
import { openPage } from './lib/browser.mjs';
import { startServer } from './lib/server.mjs';

const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const checking = process.argv.includes('--check');
const server = await startServer();
const { browser, page, errors } = await openPage();
try {
  // Any page of the game's origin will do: the modules load straight from the dev server.
  await page.goto(`${server.url}?freeze=1`);
  await page.waitForFunction(() => window.__ready === true);
  const report = await page.evaluate(async (wanted) => {
    const { STINGS, playSting } = await import('/src/audio/stings.ts');
    const { loadJingles } = await import('/src/audio/jingles.ts');
    const { TRACKS, TUNES, arrange, lengthOf, midiOf, laneLevel } = await import('/src/audio/score.ts');
    const { loadBand, playBand } = await import('/src/audio/band.ts');
    const { LEVELS, MARKS, masterChain } = await import('/src/audio/context.ts');
    const { AMBIENT_BEDS, AMBIENT_CALLS, AMBIENT_LAYERS } = await import('/src/audio/ambience.ts');
    const { EFFECTS } = await import('/src/audio/effects.ts');
    const { duck, deepen, DUCK_IN, loadTune, tuneMidi, scoreChain } = await import('/src/audio/music.ts');
    const { loadSamples } = await import('/src/audio/samples.ts');
    // The band's samples, every tune and the recorded effects, as the game loads them.
    await loadBand();
    await Promise.all([loadSamples('map'), loadSamples('land'), loadSamples('battle')]);
    await loadJingles();
    for (const id of Object.keys(TUNES)) await loadTune(id);
    // BS.1770's K-weighting filters are given for 48 kHz.
    const RATE = 48000;
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
    const round = (v) => Math.round(v * 10) / 10;
    const db = (v) => (v > 0 ? round(20 * Math.log10(v)) : -Infinity);
    /** The ear hears high notes as louder than low ones: BS.1770's high shelf and high-pass, before measuring. */
    function kweight(data) {
      const stages = [
        [1.53512485958697, -2.69169618940638, 1.19839281085285, -1.69065929318241, 0.73248077421585],
        [1, -2, 1, -1.99004745483398, 0.99007225036621],
      ];
      let x = data;
      for (const [b0, b1, b2, a1, a2] of stages) {
        const y = new Float64Array(x.length);
        let [x1, x2, y1, y2] = [0, 0, 0, 0];
        for (let i = 0; i < x.length; i++) {
          const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
          [x2, x1, y2, y1] = [x1, x[i], y1, v];
          y[i] = v;
        }
        x = y;
      }
      return x;
    }
    const lufs = (power) => (power > 0 ? -0.691 + 10 * Math.log10(power) : -Infinity);
    /** The mean power of each block of `seconds` (400 ms, as BS.1770 has it), a block every quarter of that. */
    function blocks(k, seconds = 0.4) {
      const size = Math.floor(RATE * seconds);
      const hop = Math.floor(size / 4);
      const out = [];
      for (let i = 0; i + size <= k.length; i += hop) {
        let sum = 0;
        for (let j = i; j < i + size; j++) sum += k[j] * k[j];
        out.push(sum / size);
      }
      return out;
    }
    const mean = (xs) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
    /** How loud a stretch of music is overall, in LUFS: gated, so its silences don't count (BS.1770). */
    function integrated(data) {
      const heard = blocks(kweight(data)).filter((p) => lufs(p) > -70);
      const gate = lufs(mean(heard)) - 10;
      return round(lufs(mean(heard.filter((p) => lufs(p) > gate))));
    }
    /** How loud a sound is at its loudest, in LUFS: its loudest 400 ms ("momentary" loudness). */
    const momentary = (data) => round(lufs(Math.max(0, ...blocks(kweight(data)))));
    /** The same for a short sound, over its loudest 100 ms: the ear takes about that long to hear how loud a click or a blow is. */
    const short = (data) => round(lufs(Math.max(0, ...blocks(kweight(data), 0.1))));
    function peak(data) {
      let top = 0;
      for (const v of data) top = Math.max(top, Math.abs(v));
      return db(top);
    }
    const rms = (data, from = 0, to = data.length) => {
      let sum = 0;
      for (let i = from; i < to; i++) sum += data[i] * data[i];
      return Math.sqrt(sum / Math.max(1, to - from));
    };
    /** When the sound has died away to -50 dB for good, in seconds. */
    function tail(data) {
      const win = Math.floor(RATE * 0.05);
      for (let i = data.length - win; i > 0; i -= win) if (rms(data, i, i + win) > 10 ** (-50 / 20)) return Math.round(((i + win) / RATE) * 100) / 100;
      return 0;
    }
    /** How bright a sound is: the middle of its spectrum's weight (its spectral centroid), in Hz, over its loud stretches. */
    function brightness(data) {
      const N = 2048;
      const re = new Float64Array(N);
      const im = new Float64Array(N);
      let weighted = 0;
      let total = 0;
      for (let at = 0; at + N <= data.length; at += N / 2) {
        let energy = 0;
        for (let i = 0; i < N; i++) {
          // A Hann window, so each frame's edges don't smear the spectrum.
          re[i] = data[at + i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)));
          im[i] = 0;
          energy += re[i] * re[i];
        }
        if (energy < 1e-7) continue;
        fft(re, im);
        let sum = 0;
        let moment = 0;
        for (let k = 1; k < N / 2; k++) {
          const m = Math.hypot(re[k], im[k]);
          sum += m;
          moment += m * ((k * RATE) / N);
        }
        weighted += (moment / sum) * energy;
        total += energy;
      }
      return total ? Math.round(weighted / total) : 0;
    }
    /** In-place radix-2 FFT. */
    function fft(re, im) {
      const n = re.length;
      for (let i = 1, j = 0; i < n; i++) {
        let bit = n >> 1;
        for (; j & bit; bit >>= 1) j ^= bit;
        j ^= bit;
        if (i < j) {
          [re[i], re[j]] = [re[j], re[i]];
          [im[i], im[j]] = [im[j], im[i]];
        }
      }
      for (let len = 2; len <= n; len <<= 1) {
        const angle = (-2 * Math.PI) / len;
        for (let i = 0; i < n; i += len) {
          for (let j = 0; j < len / 2; j++) {
            const [wr, wi] = [Math.cos(angle * j), Math.sin(angle * j)];
            const [ar, ai] = [re[i + j + len / 2], im[i + j + len / 2]];
            const [tr, ti] = [ar * wr - ai * wi, ar * wi + ai * wr];
            re[i + j + len / 2] = re[i + j] - tr;
            im[i + j + len / 2] = im[i + j] - ti;
            re[i + j] += tr;
            im[i + j] += ti;
          }
        }
      }
    }

    /**
     * Plays the stretch of a tune's time [from, to) as the game does (through the score's room echo,
     * each part that swells and fades through its own lane, and coming round again if it loops),
     * starting `offset` seconds into the render.
     */
    function playTune(ctx, dest, id, from, to, offset = 0) {
      const tune = TUNES[id];
      const loop = lengthOf(tune, tuneMidi(id));
      const { notes, lanes } = arrange(tune, tuneMidi(id));
      const into = scoreChain(ctx, dest);
      const first = Math.max(0, Math.floor(from / loop));
      const gains = lanes.map((points) => {
        const g = ctx.createGain();
        g.gain.setValueAtTime(laneLevel(points, from - first * loop), offset);
        g.connect(into);
        return g;
      });
      for (let lap = first; lap <= Math.floor(to / loop); lap++) {
        if (lap > 0 && !tune.loops) break;
        lanes.forEach((points, i) => {
          for (const [at, level] of points) {
            const t = lap * loop + at;
            if (t > from && t < to) gains[i].gain.linearRampToValueAtTime(level, t - from + offset);
          }
        });
        for (const n of notes) {
          const t = lap * loop + n.at;
          if (t < from || t >= to) continue;
          playBand(ctx, n.lane === undefined ? into : gains[n.lane], n.instrument, t - from + offset, n.key, n.length, n.volume);
        }
      }
    }
    /** K-weighted loudness of a stretch [from, to) seconds, ungated: for the music under a duck. */
    const between = (data, from, to) => {
      const k = kweight(data.subarray(Math.floor(from * RATE), Math.floor(to * RATE)));
      let sum = 0;
      for (const v of k) sum += v * v;
      return round(lufs(sum / Math.max(1, k.length)));
    };
    /**
     * How the score steps back under something played over it: Aldmoor's first tune ducked at 3 s
     * as the game ducks it, and its loudness just before and under the duck.
     */
    async function ducked(seconds, depth) {
      const music = await render(4 + seconds, LEVELS.music, (ctx, dest) => {
        const g = ctx.createGain();
        g.connect(dest);
        duck(g.gain, 3, deepen({ depth: 1, until: 0 }, 3, seconds, depth));
        playTune(ctx, g, TRACKS.heath.tunes[0], 0, 4 + seconds);
      });
      return { before: between(music, 1, 3), under: between(music, 3 + DUCK_IN, 3 + Math.max(DUCK_IN + 0.3, seconds)) };
    }

    const out = { marks: MARKS, stings: [], tracks: [], effects: [], ambience: [] };
    for (const [id, def] of Object.entries(EFFECTS)) {
      if (!want('effects', id) && !want('effects', id.split(':')[0])) continue;
      // Most effects vary a little each time: the loudness is the mean of a few, the peak the highest.
      const takes = [];
      for (let take = 0; take < 5; take++) {
        takes.push(
          await render(3, LEVELS.sfx, (ctx, dest) => {
            const g = ctx.createGain();
            g.gain.value = def.level;
            g.connect(dest);
            def.play(ctx, g, 0.05);
          }),
        );
      }
      const loudness = round(lufs(mean(takes.map((t) => 10 ** ((short(t) + 0.691) / 10)))));
      const off = round(loudness - MARKS[def.loud]);
      // The level that would put it right on its mark.
      const fit = Number((def.level * 10 ** (-off / 20)).toPrecision(2));
      const dip = def.duck ? await ducked(def.duck, 0.5) : null;
      out.effects.push({ id, loud: def.loud, level: def.level, fit, loudness, off, peak: Math.max(...takes.map(peak)), rings: tail(takes[0]), bright: brightness(takes[0]), duck: dip && { seconds: def.duck, dip: round(dip.under - dip.before), over: round(loudness - dip.under) } });
    }
    for (const [id, make] of Object.entries(AMBIENT_BEDS)) {
      if (!want('ambience', id)) continue;
      const data = await render(8, LEVELS.ambience, (ctx, dest) => make(ctx, dest));
      const body = data.subarray(RATE);
      out.ambience.push({ id, kind: 'bed', peak: peak(body), loudness: integrated(body) });
    }
    for (const [id, make] of Object.entries(AMBIENT_LAYERS)) {
      if (!want('ambience', id)) continue;
      const data = await render(4, LEVELS.ambience, (ctx, dest) => make(ctx, dest));
      const body = data.subarray(RATE);
      out.ambience.push({ id, kind: 'layer', peak: peak(body), loudness: integrated(body) });
    }
    for (const [id, make] of Object.entries(AMBIENT_CALLS)) {
      if (!want('ambience', id)) continue;
      const data = await render(8, LEVELS.ambience, (ctx, dest) => make(ctx, dest, 0.05));
      out.ambience.push({ id, kind: 'call', peak: peak(data), loudness: short(data), rings: tail(data) });
    }
    for (const [id, def] of Object.entries(STINGS)) {
      if (!want('stings', id)) continue;
      // Through a room and a top of its own, as the game plays it.
      const data = await render(14, LEVELS.music, (ctx, dest) => playSting(ctx, scoreChain(ctx, dest), def, 0.05));
      const loudness = momentary(data);
      const dip = await ducked(def.duck, 0.3);
      out.stings.push({ id, peak: peak(data), loudness, off: round(loudness - MARKS.sting), rings: tail(data), duck: def.duck, dip: round(dip.under - dip.before), over: round(loudness - dip.under), next: def.next ?? null });
    }
    for (const [id, tune] of Object.entries(TUNES)) {
      if (!want('tracks', id)) continue;
      const loop = lengthOf(tune, tuneMidi(id));
      /** Renders the stretch of tune time [from, to), and returns it without its 3 s lead-in (the notes still ringing from before). */
      const stretch = async (from, to) => {
        const lead = 3;
        const data = await render(to - from + lead + 2, LEVELS.music, (ctx, dest) => playTune(ctx, dest, id, from - lead, to));
        return data.subarray(Math.floor(lead * RATE), Math.floor((lead + to - from) * RATE));
      };
      // Each quarter on its own, so a quiet stretch can't hide.
      const passes = [];
      for (let q = 0; q < 4; q++) passes.push({ section: `${q + 1}/4`, loudness: integrated(await stretch((q * loop) / 4, ((q + 1) * loop) / 4)) });
      // The whole tune, as a player hears it.
      const whole = integrated(await stretch(0, loop));
      // The seam, for a tune that loops: the last seconds and the first of the next time round.
      const seam = tune.loops ? await stretch(loop - 3, loop + 3) : null;
      // A fight's music sits a little under the mark, so its blows stand out (`under`).
      const mark = MARKS.music - (tune.under ?? 0);
      const off = round(whole - mark);
      // The level that would put it right on its mark.
      const fit = Number((tune.level * 10 ** (-off / 20)).toPrecision(2));
      out.tracks.push({ id, seconds: Math.round(loop), loudness: whole, mark, off, level: tune.level, fit, passes, seamBefore: seam ? integrated(seam.subarray(0, 3 * RATE)) : null, seamAfter: seam ? integrated(seam.subarray(3 * RATE)) : null });
    }
    return out;
  }, only);
  const sign = (v) => (v > 0 ? `+${v}` : `${v}`);
  const { marks } = report;
  if (report.tracks.length) {
    console.log(`\nTunes, as a player hears them (music bus, the score's room and the master; LUFS, gated): the whole tune against the music's mark (${marks.music}, a fight's a little under it), the level that would put it there, each quarter, and the seam of one that loops`);
    for (const t of report.tracks) {
      console.log(`${t.id.padEnd(13)} ${String(t.seconds).padStart(4)}s  ${String(t.loudness).padStart(5)} (${sign(t.off)})  fit ${t.fit}  quarters ${t.passes.map((p) => p.loudness).join(' ')}${t.seamBefore === null ? '' : `  seam ${t.seamBefore} -> ${t.seamAfter}`}`);
    }
  }
  if (report.stings.length) {
    console.log(`\nStings (music bus and master): their loudest 400 ms in LUFS against the stings' mark (${marks.sting}), peak dBFS, how long they ring, how long and how far the score ducks under them (LU), how far they stand over it, and when the next screen's music may start`);
    console.log('id        loudest   off   peak  rings  duck    dip   over  next');
    for (const s of report.stings) console.log(`${s.id.padEnd(9)} ${String(s.loudness).padStart(6)} ${sign(s.off).padStart(5)} ${String(s.peak).padStart(6)} ${String(s.rings).padStart(5)}s ${String(s.duck).padStart(4)}s ${String(s.dip).padStart(6)} ${sign(s.over).padStart(6)}  ${s.next === null ? '' : `${s.next}s`}`);
  }
  if (report.effects.length) {
    console.log(`\nEffects (effects bus and master): their loudest 100 ms in LUFS, against their mark (faint ${marks.faint}, soft ${marks.soft}, firm ${marks.firm}, loud ${marks.loud}), the level that would put them on it, peak dBFS, how long they ring, how bright (Hz), and how the score steps back under the ones that are music`);
    console.log('id              mark  level  (fit)  loudest   off   peak  rings  bright');
    for (const e of report.effects) {
      const under = e.duck ? `  ducks the score ${e.duck.dip} LU for ${e.duck.seconds}s, and stands ${sign(e.duck.over)} over it` : '';
      console.log(`${e.id.padEnd(15)} ${e.loud.padEnd(5)} ${String(e.level).padStart(5)} ${`(${e.fit})`.padStart(6)}  ${String(e.loudness).padStart(6)} ${sign(e.off).padStart(5)} ${String(e.peak).padStart(6)} ${String(e.rings).padStart(5)}s ${String(e.bright).padStart(6)}${under}`);
    }
  }
  if (report.ambience.length) {
    console.log(`\nAmbience (ambience bus and master): the beds under a screen and the land's layers at their loudest, right on top of them (LUFS, gated), and its calls at their loudest 100 ms; its mark is ${marks.ambience}`);
    console.log('id          kind  loudness   peak  rings');
    for (const a of report.ambience) console.log(`${a.id.padEnd(11)} ${a.kind.padEnd(5)} ${String(a.loudness).padStart(7)}  ${String(a.peak).padStart(6)}  ${a.rings === undefined ? '' : `${a.rings}s`}`);
  }
  if (errors.length) console.log(`page errors: ${errors.join(' | ')}`);
  if (checking) {
    // What the mix promises: every track at the music's mark, every sting at its own, every effect
    // near its mark and none near clipping, and nothing in the ambience louder than its mark.
    const faults = [];
    const near = (what, value, mark, give) => Math.abs(value - mark) > give && faults.push(`${what}: ${value} LUFS, its mark ${mark} (\u00b1${give})`);
    for (const t of report.tracks) near(t.id, t.loudness, t.mark, 1);
    for (const s of report.stings) near(`sting ${s.id}`, s.loudness, marks.sting, 1.5);
    const GIVE = { faint: 4, soft: 3, firm: 3, loud: 3 };
    for (const e of report.effects) {
      near(e.id, e.loudness, marks[e.loud], GIVE[e.loud]);
      if (e.peak > -1) faults.push(`${e.id}: peaks at ${e.peak} dBFS`);
    }
    for (const a of report.ambience) if (a.kind !== 'call' && a.loudness > marks.ambience + 2) faults.push(`${a.id}: ${a.loudness} LUFS, louder than the ambience's mark (${marks.ambience})`);
    console.log(faults.length ? `\n${faults.length} off the mark:\n  ${faults.join('\n  ')}` : '\nEverything sits on its mark.');
    if (faults.length) process.exitCode = 1;
  }
} finally {
  await browser.close();
  await server.close();
}
