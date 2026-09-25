// Visual regression: frozen, seeded scenes. The indexed frame is hashed exactly and compared with
// test/visual.json; PNGs go to screenshots/visual/ for review. npm run visual [-- --approve]
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { openPage, kc as hooks } from './lib/browser.mjs';
import { startServer } from './lib/server.mjs';

const SCENES = {
  intro: { query: '', keepCard: true },
  meadow: { query: '' },
  watchtower: { query: '&x=300&y=220' },
  castle: { query: '&x=1000&y=300' },
  darkwood: { query: '&x=200&y=780' },
  battle: { query: '&battle=patrol', keepCard: true },
  court: { query: '&court=1', keepCard: true },
  fenmarch: { query: '&commission=2', keepCard: true },
  fen: { query: '&commission=2&reveal=1&x=640&y=700', keepCard: true },
  fenbattle: { query: '&commission=2&battle=troll', keepCard: true },
  heath: { query: '&commission=3&reveal=1&x=640&y=480', keepCard: true },
  mere: { query: '&commission=4&reveal=1&x=700&y=560', keepCard: true },
  sceptre: { query: '&commission=5&reveal=1&sceptre=1', keepCard: true },
};
const approve = process.argv.includes('--approve');
const file = 'test/visual.json';
const approved = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
mkdirSync('screenshots/visual', { recursive: true });

const server = await startServer();
const { browser, page, errors } = await openPage();
const kc = hooks(page);
const now = {};
let changed = 0;
try {
  for (const [name, scene] of Object.entries(SCENES)) {
    await page.goto(`${server.url}?freeze=1${scene.query}`);
    await kc.ready();
    if (!scene.keepCard) {
      await kc.choose('Knight of the Realm');
      await kc.choose('Ride out');
    }
    await page.waitForTimeout(120);
    now[name] = await kc.frameHash();
    await page.screenshot({ path: `screenshots/visual/${name}.png` });
    const same = approved[name] === now[name];
    if (!same) changed++;
    console.log(`${same ? 'same   ' : approved[name] ? 'CHANGED' : 'NEW    '} ${name}  ${now[name]}  screenshots/visual/${name}.png`);
  }
} finally {
  await browser.close();
  await server.close();
}
if (errors.length) console.log(`page errors: ${errors.join(' | ')}`);
if (approve) {
  writeFileSync(file, `${JSON.stringify(now, null, 2)}\n`);
  console.log(`approved ${Object.keys(now).length} scenes into ${file}`);
} else if (changed) {
  console.log(`${changed} scene(s) differ. Look at the PNGs, then run: npm run visual -- --approve`);
}
process.exit(!approve && (changed || errors.length) ? 1 : 0);
