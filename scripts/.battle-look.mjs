import { openPage, kc as hooks } from './lib/browser.mjs';
import { startServer } from './lib/server.mjs';
const server = await startServer();
const { browser, page, errors } = await openPage();
const kc = hooks(page);
try {
  await page.goto(`${server.url}?fresh=1&speed=8`);
  await kc.ready();
  await kc.choose('Ride out');
  const [x, y] = await kc.centre('patrol');
  await kc.click(x, y);
  await kc.choose('Approach');
  await page.waitForFunction(() => !window.__kc.status().riding && !window.__kc.status().visiting, null, { timeout: 30000 });
  await kc.choose('Fight');
  await page.waitForTimeout(300);
  console.log('screen', await kc.call(() => window.__kc.screen()));
  await page.mouse.move(16 + 200, 16 + 200);
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'screenshots/battle-1.png' });
  await kc.call(() => window.__kc.battle().auto());
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'screenshots/battle-2.png' });
  await page.waitForFunction(() => window.__kc.screen() === 'adventure', null, { timeout: 60000 });
  console.log('after:', await kc.title(), '|', await kc.lines());
} finally {
  console.log('errors:', errors.join(' | ') || 'none');
  await browser.close();
  await server.close();
}
