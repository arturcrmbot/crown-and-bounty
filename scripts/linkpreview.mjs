// The link preview for sharing the game (#146): the title painting, straight from the game's canvas,
// cropped inside its torn edge to 1200 x 630, as LinkedIn and the rest want it. index.html's og:image
// points at public/link-preview.png. Run it again (npm run linkpreview) after the painting or the
// name on it changes (#145).
import { writeFileSync } from 'node:fs';
import { openPage, kc as hooks } from './lib/browser.mjs';
import { startServer } from './lib/server.mjs';

const out = 'public/link-preview.png';
const server = await startServer();
const { browser, page, errors } = await openPage();
const kc = hooks(page);
try {
  await page.goto(`${server.url}?freeze=1&title=1`);
  await kc.ready();
  // The click puts away "Click anywhere to begin"; the menu it opens is on the page, not the canvas.
  await kc.begin();
  const png = await page.evaluate(() => {
    const game = document.querySelector('canvas');
    // The painting (MAP_VIEW, 16..944 x 16..480) inside the torn parchment that reaches 8 pixels into it.
    const [sx, sy, sw, sh] = [53, 24, 854, 448];
    // Whole pixels first, four times over, then down to size smoothly: crisp pixels with soft edges.
    const big = document.createElement('canvas');
    big.width = sw * 4;
    big.height = sh * 4;
    const b = big.getContext('2d');
    b.imageSmoothingEnabled = false;
    b.drawImage(game, sx, sy, sw, sh, 0, 0, big.width, big.height);
    const card = document.createElement('canvas');
    card.width = 1200;
    card.height = 630;
    const c = card.getContext('2d');
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = 'high';
    const scale = Math.max(card.width / sw, card.height / sh);
    const [w, h] = [sw * scale, sh * scale];
    c.drawImage(big, (card.width - w) / 2, (card.height - h) / 2, w, h);
    return card.toDataURL('image/png');
  });
  writeFileSync(out, Buffer.from(png.split(',')[1], 'base64'));
  console.log(`saved ${out}${errors.length ? `; page errors: ${errors.join(' | ')}` : ''}`);
} finally {
  await browser.close();
  await server.close();
}
process.exit(errors.length ? 1 : 0);
