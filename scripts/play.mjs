// Scripted play-through for checking the loop: npm run play (with the dev server running).
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const url = process.env.URL ?? 'http://127.0.0.1:5188/';
mkdirSync('screenshots', { recursive: true });
const browser = await chromium.launch({ channel: process.env.CHANNEL ?? 'msedge' });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));
page.on('console', (m) => m.type() === 'error' && console.log(`[console] ${m.text()}`));

const shot = async (name) => {
  await page.screenshot({ path: `screenshots/play-${name}.png` });
  console.log(`saved screenshots/play-${name}.png`);
};
const state = () => page.evaluate(() => window.__kc.state());
const choose = async (label) => {
  const ok = await page.evaluate((l) => window.__kc.choose(l), label);
  if (!ok) throw new Error(`No "${label}" on the card`);
  await page.waitForTimeout(100);
};
const click = (x, y) => page.evaluate(([cx, cy]) => window.__kc.click(cx, cy), [x, y]);
const settle = () => page.waitForFunction(() => window.__kc.idle(), null, { timeout: 30_000 }).then(() => page.waitForTimeout(400));
const card = () => page.evaluate(() => document.querySelector('.kc-card-wrap:not([hidden]) h3')?.textContent ?? null);

await page.goto(url);
await page.waitForFunction(() => window.__ready === true);
await page.waitForTimeout(300);
await shot('1-welcome');
await choose('Ride out');

await click(458, 700);
console.log('card:', await card());
await shot('2-chest-card');
await choose('Open');
await settle();
console.log('card:', await card());
await shot('3-chest-open');
const before = (await state()).gold;
await choose('Keep the gold');
console.log('gold', before, '->', (await state()).gold);

await click(404, 570);
console.log('card:', await card());
await choose('Approach');
await settle();
console.log('card:', await card());
await choose('Fight');
console.log('card:', await card(), (await state()).army);
await shot('4-after-fight');
await browser.close();
