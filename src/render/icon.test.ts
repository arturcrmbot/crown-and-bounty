import { describe, expect, it } from 'vitest';
import page from '../../index.html?raw';
import manifest from '../../public/manifest.webmanifest?raw';
import { ICONS, gameIcon } from './icon';
import { paletteWords } from './palette';
import { decodePng } from './png';

// Each icon file, as the page would have it: a data URL of its bytes.
const FILES = import.meta.glob<string>('../../public/*.png', { query: '?inline', import: 'default', eager: true });

describe('the icon', () => {
  it.each(ICONS)('$file is the crown the code draws (npm run icons saves it)', async (icon) => {
    const url = FILES[`../../public/${icon.file}`];
    const png = await decodePng(Uint8Array.from(atob(url.split(',')[1]), (c) => c.charCodeAt(0)));
    expect([png.width, png.height]).toEqual([icon.size, icon.size]);
    const pixels = new Uint32Array(png.data.buffer, png.data.byteOffset, png.data.length / 4);
    const words = paletteWords(0);
    expect([...gameIcon(icon).data].findIndex((index, i) => words[index] !== pixels[i])).toBe(-1);
  });

  it('is named by the page and the web-app manifest', () => {
    for (const { file } of ICONS) expect(page + manifest).toContain(`"${file}"`);
  });
});
