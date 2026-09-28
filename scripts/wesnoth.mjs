// Battle for Wesnoth's unit art, from the official repository at a pinned release:
//   npm run wesnoth              downloads any missing images into public/assets/wesnoth/units/
//   npm run wesnoth -- --palette also picks the palette colours the art needs (src/render/unitPalette.ts)
//   npm run wesnoth -- --credits also writes the per-file credits into public/assets/CREDITS.md
// Which images the troops use is src/render/units.ts; the PNGs are kept exactly as Wesnoth has them.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createServer } from 'vite';

const TAG = '1.18.8';
const REPO = 'wesnoth/wesnoth';
const IMAGES = 'data/core/images/units';
const OUT = 'public/assets/wesnoth/units';
const args = process.argv.slice(2);

const vite = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'error' });
try {
  const units = await vite.ssrLoadModule('/src/render/units.ts');
  const paths = units.unitImages();

  let fetched = 0;
  for (const path of paths) {
    const file = join(OUT, path);
    if (existsSync(file)) continue;
    const response = await fetch(`https://raw.githubusercontent.com/${REPO}/${TAG}/${IMAGES}/${path}`);
    if (!response.ok) throw new Error(`${path}: ${response.status} (is the frame named right in units.ts?)`);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, Buffer.from(await response.arrayBuffer()));
    fetched++;
  }
  console.log(`${paths.length} images in ${OUT} (${fetched} downloaded from ${REPO} ${TAG})`);

  if (args.includes('--palette')) await pickPalette(paths, units);
  if (args.includes('--credits')) writeCredits(units.ART, paths);
} finally {
  await vite.close();
}

/**
 * The colours to add to the palette: k-means in OKLab over every pixel of every frame, as the game
 * draws them (both sides' colours, battle and map sizes), with the palette's own colours held fixed.
 */
/** Every image a unit's art uses. */
function frameList(u) {
  return [u.stand, u.defend, u.defendRanged, ...[u.idle, u.move, u.melee.frames, u.charge?.frames, u.cast, u.ranged?.frames, u.death].flatMap((l) => (l ?? []).map((f) => f.image))].filter(Boolean);
}

async function pickPalette(paths, units) {
  const art = await vite.ssrLoadModule('/src/render/wesnoth.ts');
  const palette = await vite.ssrLoadModule('/src/render/palette.ts');
  const scale = await vite.ssrLoadModule('/src/render/scale.ts');
  await art.loadUnitArt(async (path) => new Uint8Array(readFileSync(join(OUT, path))));
  const counts = new Map();
  const owners = Object.entries(units.ART).map(([id, u]) => [id, new Set(frameList(u))]);
  for (const path of paths) {
    const ids = owners.filter(([, own]) => own.has(path)).map(([id]) => id);
    for (const team of ['blue', 'red']) {
      for (const [size, id] of ['battle', 'map'].flatMap((size) => ids.map((id) => [size, id]))) {
        const { kinds, colours } = art.unitPixels(path, team, scale.unitScale(size, id), scale.unitLift(size));
        // Team colour goes to the sides' own ramps, so only the painted pixels count here.
        for (let i = 0; i < kinds.length; i++) if (kinds[i] === 2) counts.set(colours[i], (counts.get(colours[i]) ?? 0) + 1);
      }
    }
  }
  const unit = new Set(palette.UNIT);
  const fixed = art.PAINT.filter((i) => !unit.has(i));
  const X = [...counts.keys()].map((c) => art.oklab((c >> 16) & 255, (c >> 8) & 255, c & 255));
  const W = [...counts.values()];
  const F = fixed.map((i) => art.oklab(...palette.COLORS[i]));
  const K = 64;
  const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
  const nearest = (x, C) => C.reduce((best, c, j) => (d2(x, c) < best[0] ? [d2(x, c), j] : best), [Infinity, -1]);
  let seed = 1066;
  const random = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32);
  // Seed each new colour where the palette so far is worst (k-means++), then settle them (Lloyd).
  const free = [];
  for (let k = 0; k < K; k++) {
    const C = [...F, ...free];
    const cost = X.map((x, i) => nearest(x, C)[0] * W[i]);
    let pick = random() * cost.reduce((a, b) => a + b, 0);
    free.push([...X[cost.findIndex((c) => (pick -= c) <= 0)]]);
  }
  let error = 0;
  for (let round = 0; round < 60; round++) {
    const C = [...F, ...free];
    const sums = free.map(() => [0, 0, 0, 0]);
    error = 0;
    X.forEach((x, i) => {
      const [d, j] = nearest(x, C);
      error += d * W[i];
      if (j < F.length) return;
      const s = sums[j - F.length];
      for (let c = 0; c < 3; c++) s[c] += x[c] * W[i];
      s[3] += W[i];
    });
    let moved = 0;
    sums.forEach((s, k) => {
      if (!s[3]) return;
      const next = [s[0] / s[3], s[1] / s[3], s[2] / s[3]];
      moved += d2(next, free[k]);
      free[k] = next;
    });
    if (moved < 1e-12) break;
  }
  const total = W.reduce((a, b) => a + b, 0);
  const before = X.reduce((e, x, i) => e + nearest(x, F)[0] * W[i], 0) / total;
  console.log(`palette: ${counts.size} colours over ${total} pixels; mean OKLab error ${Math.sqrt(before).toFixed(4)} with the old palette, ${Math.sqrt(error / total).toFixed(4)} with ${K} more`);
  const hex = free
    .map((lab) => ({ lab, rgb: fromOklab(lab) }))
    .sort((a, b) => Math.round(Math.atan2(a.lab[2], a.lab[1]) * 2) - Math.round(Math.atan2(b.lab[2], b.lab[1]) * 2) || a.lab[0] - b.lab[0])
    .map(({ rgb }) => `'#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}'`);
  const rows = Array.from({ length: Math.ceil(hex.length / 8) }, (_, i) => `  ${hex.slice(i * 8, i * 8 + 8).join(', ')},`);
  writeFileSync('src/render/unitPalette.ts', `// Written by \`npm run wesnoth -- --palette\`: the colours the Wesnoth unit art adds to the palette.\nexport const UNIT_COLOURS: readonly string[] = [\n${rows.join('\n')}\n];\n`);
  console.log('wrote src/render/unitPalette.ts');
}

function fromOklab([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lin = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
  return lin.map((c) => {
    const v = Math.min(1, Math.max(0, c));
    return Math.round((v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055) * 255);
  });
}

/**
 * CREDITS.md: every file, its licence and its artists, from the repository's history. Wesnoth's art
 * is GPL-2.0-or-later, and what was added after 30 Jul 2017 is CC BY-SA 4.0
 * (https://wiki.wesnoth.org/Wesnoth:Copyrights). Commits that only recompress or move files don't count.
 */
function writeCredits(unitArt, paths) {
  const cacheFile = 'node_modules/.cache/wesnoth-history.json';
  const cache = existsSync(cacheFile) ? JSON.parse(readFileSync(cacheFile, 'utf8')) : {};
  const gh = (endpoint) => JSON.parse(execFileSync('gh', ['api', endpoint], { encoding: 'utf8', maxBuffer: 1 << 26 }));
  const commit = cache[`tag:${TAG}`] ?? (cache[`tag:${TAG}`] = gh(`repos/${REPO}/commits/${TAG}`).sha);
  const CUTOFF = '2017-07-30';
  const chore = /optipng|pngcrush|zopfli|compress(ed)? images|umcpropfix|file permissions|canvas size|\bmoved?\b|\brenamed?\b|^revert 20\d\d-/i;
  const info = {};
  for (const path of paths) {
    const key = `${TAG}:${path}`;
    cache[key] ??= gh(`repos/${REPO}/commits?path=${IMAGES}/${path}&sha=${TAG}&per_page=100`).map((c) => ({ date: c.commit.author.date.slice(0, 10), author: c.commit.author.name, message: c.commit.message.split('\n')[0] }));
    const history = cache[key];
    const art = history.filter((c) => !chore.test(c.message));
    const made = history[history.length - 1]?.date ?? '';
    const changed = (art[0] ?? history[0])?.date ?? '';
    const names = new Set();
    for (const c of art.length ? art : history) {
      const by = c.message.match(/\bby ([A-Z][\w.-]*(?: [A-Z][\w.-]*)?|[\w.-]+)/);
      names.add(by ? by[1].replace(/[.,;]$/, '') : c.author);
    }
    const licence = made >= CUTOFF ? 'CC BY-SA 4.0' : changed >= CUTOFF ? 'GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0' : 'GPL-2.0-or-later';
    info[path] = { licence, names: [...names].join(', '), made, changed };
  }
  mkdirSync(dirname(cacheFile), { recursive: true });
  writeFileSync(cacheFile, JSON.stringify(cache));

  const lines = [];
  // The same figure can go by two names (the Knight's is also plain 'hero'): credit it once.
  const credited = new Set();
  const whose = (id) => (id.startsWith('hero') && id !== 'hero' ? `hero, as a ${id.slice(4)}` : id);
  for (const [troop, u] of Object.entries(unitArt)) {
    if (credited.has(u)) continue;
    credited.add(u);
    const own = paths.filter((p) => frameList(u).includes(p));
    lines.push('', `### ${u.unit} (our ${whose(troop)})`, '', `Frames and timings from \`data/core/units/${u.cfg}\`.`, '', '| File | Licence | Artists, from the history | Added | Last changed |', '| --- | --- | --- | --- | --- |');
    for (const p of own) lines.push(`| \`${p}\` | ${info[p].licence} | ${info[p].names} | ${info[p].made} | ${info[p].changed} |`);
  }
  const credits = readFileSync('public/assets/CREDITS.md', 'utf8');
  const begin = '<!-- wesnoth-files -->';
  const end = '<!-- /wesnoth-files -->';
  const body = `${begin}\nFrom [${REPO}](https://github.com/${REPO}) at tag \`${TAG}\` (commit \`${commit}\`), \`${IMAGES}/\`, kept unchanged in \`${OUT}/\`.\n${lines.join('\n')}\n${end}`;
  const next = credits.includes(begin) ? credits.replace(new RegExp(`${begin}[\\s\\S]*${end}`), body) : `${credits.trimEnd()}\n\n${body}\n`;
  writeFileSync('public/assets/CREDITS.md', next);
  console.log(`wrote credits for ${paths.length} files into public/assets/CREDITS.md`);
}
