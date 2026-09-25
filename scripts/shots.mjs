// Screenshots the look test: npm run shots (with the dev server running).
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const url = process.env.URL ?? 'http://localhost:5173/';
const width = Number(process.env.W ?? 1280);
const height = Number(process.env.H ?? 960);
mkdirSync('screenshots', { recursive: true });

const browser = await chromium.launch({ channel: process.env.CHANNEL ?? 'msedge', args: ['--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: Number(process.env.DPR ?? 1) });
page.on('console', (m) => m.type() !== 'debug' && console.log(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));

await page.goto(url);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 60_000 });
await page.waitForTimeout(300);
const path = process.env.OUT ?? 'screenshots/look.png';
await page.screenshot({ path });
console.log(`saved ${path}`);
await browser.close();
