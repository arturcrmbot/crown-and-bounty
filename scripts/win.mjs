// Plays the whole look-test contract to the end, fast: node scripts/win.mjs (dev server running).
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const url = process.env.URL ?? 'http://127.0.0.1:5188/?speed=8';
mkdirSync('screenshots', { recursive: true });
const browser = await chromium.launch({ channel: process.env.CHANNEL ?? 'msedge' });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));

const kc = (fn, arg) => page.evaluate(fn, arg);
const title = () => kc(() => document.querySelector('.kc-card-wrap:not([hidden]) h3')?.textContent ?? null);
const lines = () => kc(() => [...document.querySelectorAll('.kc-card-wrap:not([hidden]) p')].map((p) => p.textContent).join(' / '));
const choose = async (label) => {
  const ok = await kc((l) => window.__kc.choose(l), label);
  await page.waitForTimeout(80);
  return ok;
};

/** Clicks a place, takes its action, and keeps riding (ending days when tired) until the hero gets there. */
async function go(id, action) {
  // Fogged places only offer to ride there; the visit happens on arrival.
  const [x, y] = await kc((i) => window.__kc.centre(i), id);
  await kc(([cx, cy]) => window.__kc.click(cx, cy), [x, y]);
  if ((await title()) === 'Unexplored') action = 'Ride there';
  if (!(await choose(action))) throw new Error(`${id}: no "${action}" on "${await title()}": ${await lines()}`);
  for (;;) {
    await page.waitForFunction(() => {
      const s = window.__kc.status();
      return (!s.riding && !s.visiting) || s.movement <= 0;
    }, null, { timeout: 60_000 });
    const s = await kc(() => window.__kc.status());
    if (s.riding && s.movement <= 0) {
      await choose('End the day');
      console.log(`  ${await title()}: ${await lines()}`);
      await choose('Close');
      continue;
    }
    break;
  }
  const state = await kc(() => window.__kc.state());
  console.log(`${id}: "${await title()}" ${await lines()}  [day ${state.day}, gold ${state.gold}, lead ${state.leadership}, army ${JSON.stringify(state.army)}]`);
}

await page.goto(url);
await page.waitForFunction(() => window.__ready === true);
await choose('Ride out');
await go('chest', 'Open');
await choose('Hand it out');
await choose('Close');
await go('gold', 'Take');
await choose('Close');
await go('patrol', 'Approach');
await choose('Fight');
console.log(`  fight: "${await title()}" ${await lines()}`);
await choose('Close');
await go('tower', 'Enter');
await choose('Close');
await go('mine', 'Enter');
await choose('Close');
await go('castle', 'Visit');
await choose('Recruit');
await choose('Close');
await go('village', 'Visit');
await choose('Recruit');
await choose('Close');
await page.screenshot({ path: 'screenshots/win-1-before-hideout.png' });
for (let attempt = 1; attempt <= 3; attempt++) {
  await go('hideout', 'Approach');
  await choose('Storm the stockade');
  const result = await title();
  console.log(`  hideout, attempt ${attempt}: "${result}" ${await lines()}`);
  if (result !== 'Retreat!') break;
  await choose('Close');
  // Wait for payday, then recruit again before the next try.
  while ((await kc(() => window.__kc.state())).day % 7 !== 1) {
    await page.keyboard.press('e');
    await page.waitForTimeout(60);
  }
  console.log(`  ${await title()}: ${await lines()}`);
  await choose('Close');
  await go('castle', 'Visit');
  await choose('Recruit');
  await choose('Close');
  await go('village', 'Visit');
  await choose('Recruit');
  await choose('Close');
}
await page.screenshot({ path: 'screenshots/win-2-end.png' });
console.log('final', JSON.stringify(await kc(() => window.__kc.state()), (k, v) => (k === 'locations' ? undefined : v)));
await browser.close();
