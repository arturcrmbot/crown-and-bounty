// Screenshots the look test: npm run shots (with the dev server running).
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const url = process.env.URL ?? 'http://127.0.0.1:5188/';
const width = Number(process.env.W ?? 960);
const height = Number(process.env.H ?? 540);
mkdirSync('screenshots', { recursive: true });

const browser = await chromium.launch({ channel: process.env.CHANNEL ?? 'msedge', args: ['--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: Number(process.env.DPR ?? 1) });
page.on('console', (m) => m.type() !== 'debug' && console.log(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));

await page.goto(`${url}${process.env.QUERY ?? ''}`);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 60_000 });
await page.waitForTimeout(300);
if (process.env.RIDE) {
  const [x, y] = process.env.RIDE.split(',').map(Number);
  await page.evaluate(([rx, ry]) => window.__rideTo?.(rx, ry), [x, y]);
  await page.waitForTimeout(Number(process.env.WAIT ?? 1500));
}
const path = process.env.OUT ?? 'screenshots/look.png';
await page.screenshot({ path });
console.log(`saved ${path}`);
await browser.close();
