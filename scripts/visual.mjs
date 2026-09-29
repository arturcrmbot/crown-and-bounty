// Visual regression: frozen, seeded scenes. The indexed frame is hashed exactly and compared with
// test/visual.json; PNGs go to screenshots/visual/ for review. npm run visual [-- --approve]
// Scenes drawn in the page rather than the canvas (`dom`, like the hero screen) hash the screenshot.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { openPage, kc as hooks } from './lib/browser.mjs';
import { startServer } from './lib/server.mjs';

// `steps` are card buttons to press on the way in (or `key:h` to press a key, `place:stack:0` to click
// something on the hero screen); without them, a scene picks the knight and rides out unless `keepCard`.
/** A wizard's relics and trinkets, worn and in the pack, for the hero screen. */
const GEAR = 'twinWand,crystalBall,greenwoodCloak,oldBanner,poachersHorn,brannocsLance,silverSignet,luckyHorseshoe,wizardsButton,goldenFeather,astrolabe,millersLoaf';
const SCENES = {
  title: { query: '&title=1', steps: [] },
  menu: { query: '&title=1', steps: ['begin'] },
  king: { query: '&title=1', steps: ['begin', 'New campaign'] },
  wanted: { query: '&title=1', steps: ['begin', 'New campaign', 'At your service'] },
  heroes: { query: '&title=1', steps: ['begin', 'New campaign', 'At your service', 'I\u2019ll bring him in'] },
  intro: { query: '', keepCard: true },
  meadow: { query: '' },
  wizard: { query: '', steps: ['Hedge Wizard', 'Ride out'] },
  ranger: { query: '', steps: ['Ranger of the Greenwood', 'Ride out'] },
  courtier: { query: '', steps: ['Courtier', 'Ride out'] },
  watchtower: { query: '&x=1032&y=760' },
  castle: { query: '&x=2520&y=860' },
  darkwood: { query: '&x=520&y=1960' },
  // Aldmoor's regions and its two crossings, with the mist lifted.
  westmere: { query: '&reveal=1&x=2100&y=1390' },
  aldheath: { query: '&reveal=1&x=1000&y=800' },
  ford: { query: '&reveal=1&x=1780&y=380' },
  bridge: { query: '&reveal=1&x=1700&y=1460' },
  downs: { query: '&reveal=1&x=2900&y=420' },
  chase: { query: '&reveal=1&x=2400&y=1900' },
  dig: { query: '&reveal=1&x=700&y=560' },
  battle: { query: '&battle=patrol', keepCard: true },
  court: { query: '&court=1', keepCard: true },
  courtwizard: { query: '&court=1&hero=wizard', keepCard: true },
  courtranger: { query: '&court=1&hero=ranger', keepCard: true },
  courtcourtier: { query: '&court=1&hero=courtier', keepCard: true },
  fenmarch: { query: '&commission=2', keepCard: true },
  fen: { query: '&commission=2&reveal=1&x=640&y=700', keepCard: true },
  fenbattle: { query: '&commission=2&battle=troll', keepCard: true },
  heath: { query: '&commission=3&reveal=1&x=640&y=480', keepCard: true },
  mere: { query: '&commission=4&reveal=1&x=700&y=560', keepCard: true },
  sceptre: { query: '&commission=5&reveal=1&sceptre=1', keepCard: true },
  hero: { query: `&hero=wizard&gear=${GEAR}&army=knights:8,archers:22,peasants:40`, steps: ['key:h'], dom: true },
  herostack: { query: `&hero=wizard&gear=${GEAR}&army=knights:8,archers:22,peasants:40`, steps: ['key:h', 'place:stack:0'], dom: true },
  heroleader: { query: `&hero=knight&gear=oldBanner,brannocsLance&army=knights:10,archers:20,peasants:30`, steps: ['key:h', 'place:hero'], dom: true },
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
    if (scene.steps) {
      for (const label of scene.steps) {
        if (label === 'begin') await kc.begin();
        else if (label.startsWith('key:')) await page.keyboard.press(label.slice(4));
        else if (label.startsWith('place:')) await page.locator(`.kc-hero [data-place="${label.slice(6)}"]`).click();
        else await kc.choose(label);
      }
      // The pointer rests in a corner, so no hover note covers the scene.
      if (scene.dom) await page.mouse.move(2, 2);
    } else if (!scene.keepCard) {
      await kc.choose('Knight of the Realm');
      await kc.choose('Ride out');
    }
    await page.waitForTimeout(scene.dom ? 400 : 120);
    const png = await page.screenshot({ path: `screenshots/visual/${name}.png` });
    now[name] = scene.dom ? createHash('sha1').update(png).digest('hex').slice(0, 8) : await kc.frameHash();
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
