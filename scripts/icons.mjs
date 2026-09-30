// The game's icon (#148), a gold crown on royal blue drawn in code (src/render/icon.ts), saved as the
// PNGs index.html and the web-app manifest name: the browser tab's icon, and a phone's home-screen icon.
// Run it again (npm run icons) after changing the crown; a unit test checks the files match it.
import { writeFileSync } from 'node:fs';
import { openPage, kc as hooks } from './lib/browser.mjs';
import { startServer } from './lib/server.mjs';

const server = await startServer();
const { browser, page, errors } = await openPage();
try {
  await page.goto(`${server.url}?freeze=1`);
  await hooks(page).ready();
  const icons = await page.evaluate(async () => {
    const { ICONS, gameIcon } = await import('/src/render/icon.ts');
    const { bitmapUrl } = await import('/src/ui/pixels.ts');
    return ICONS.map((icon) => [icon.file, bitmapUrl(gameIcon(icon))]);
  });
  for (const [file, url] of icons) {
    writeFileSync(`public/${file}`, Buffer.from(url.split(',')[1], 'base64'));
    console.log(`saved public/${file}`);
  }
  if (errors.length) console.log(`page errors: ${errors.join(' | ')}`);
} finally {
  await browser.close();
  await server.close();
}
process.exit(errors.length ? 1 : 0);
