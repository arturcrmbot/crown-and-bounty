/**
 * Held upright, a phone gets a card asking for it to be turned sideways: the game is played in
 * landscape, as the old games were. The card shows itself (`.kc-upright`, set by `touch.ts`), and
 * the game's clock stands still behind it (`main.ts`).
 */
import { Bitmap } from '../render/bitmap';
import { GOLD, INK, RED, SLATE, STONE, WATER } from '../render/palette';
import { bitmapUrl } from './pixels';
import './turn.css';

/** A phone, with the King's crown on its screen. */
function phone(): Bitmap {
  const rows = [
    '.oooooooooooooo.',
    'oSSSSSSSSSSSSSSo',
    'oSSSSSSooSSSSSSo',
    'oSooooooooooooSo',
    'oSoBBBBBBBBBBoSo',
    'oSoBBBBBBBBBBoSo',
    'oSoBBBBBBBBBBoSo',
    'oSoBBBBBBBBBBoSo',
    'oSoBBBBBBBBBBoSo',
    'oSoBBGBGGBGBBoSo',
    'oSoBBGGGGGGBBoSo',
    'oSoBBGRGGRGBBoSo',
    'oSoBBGGGGGGBBoSo',
    'oSoBBBBBBBBBBoSo',
    'oSoBBBBBBBBBBoSo',
    'oSoBBBBBBBBBBoSo',
    'oSoBBBBBBBBBBoSo',
    'oSoBBBBBBBBBBoSo',
    'oSoBBBBBBBBBBoSo',
    'oSoBBBBBBBBBBoSo',
    'oSooooooooooooSo',
    'oSSSSSSSSSSSSSSo',
    'oSSSSSSooSSSSSSo',
    'oSSSSSSSSSSSSSSo',
    '.oooooooooooooo.',
  ];
  const colours: Record<string, number> = { o: INK, S: STONE[2], B: WATER[2], G: GOLD[5], R: RED[4], s: SLATE[3] };
  const b = new Bitmap(rows[0].length, rows.length);
  rows.forEach((row, y) => [...row].forEach((ch, x) => colours[ch] && b.set(x, y, colours[ch])));
  return b;
}

export function turnCard() {
  const screen = document.createElement('div');
  screen.className = 'kc-turn';
  screen.setAttribute('role', 'dialog');
  screen.setAttribute('aria-label', 'Turn your phone sideways');
  screen.innerHTML = `<div class="kc-card kc-turn-card">
    <img class="phone" alt="" src="${bitmapUrl(phone())}">
    <h3>Turn your phone sideways</h3>
    <p>Aldmoor is wider than it is tall. So is Baron Grimsby.</p>
    <p class="small">If it won\u2019t turn, switch off rotation lock.</p>
  </div>`;
  // Nothing behind it can be touched while it's up.
  for (const type of ['pointerdown', 'pointerup', 'click', 'touchstart'] as const) screen.addEventListener(type, (e) => e.stopPropagation());
  document.body.append(screen);
}
