/**
 * Held upright, a phone gets the game's name over its painting, and a card asking for the phone to
 * be turned on its side: the game is played in landscape, as the old games were. The screen shows
 * itself (`.kc-upright`, set by `touch.ts`), and the game's clock stands still behind it (`main.ts`).
 */
import { Bitmap } from '../render/bitmap';
import { GOLD, INK, RED, SLATE, STONE, WATER } from '../render/palette';
import { titlePainting } from '../render/titleScreen';
import { bitmapUrl } from './pixels';
import { upright, whenTouchChanges } from './touch';
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
  screen.setAttribute('aria-label', 'Turn your phone on its side');
  screen.innerHTML = `<div class="kc-turn-column">
    <img class="name" alt="Crown &amp; Bounty. The Old King\u2019s Treasure.">
    <img class="land" alt="">
    <div class="kc-card kc-turn-card">
      <img class="phone" alt="" src="${bitmapUrl(phone())}">
      <p>The map needs a wider screen than this. Turn your phone on its side to play.</p>
      <p class="small">If it won\u2019t turn, switch off rotation lock.</p>
    </div>
  </div>`;
  // The painting is the title's, cut out the first time the phone is held upright.
  const paint = () => {
    if (!upright() || screen.dataset.painted) return;
    screen.dataset.painted = 'yes';
    const { name, land } = titlePainting().upright();
    screen.querySelector<HTMLImageElement>('img.name')!.src = bitmapUrl(name);
    screen.querySelector<HTMLImageElement>('img.land')!.src = bitmapUrl(land);
  };
  whenTouchChanges(paint);
  paint();
  // Nothing behind it can be touched while it's up.
  for (const type of ['pointerdown', 'pointerup', 'click', 'touchstart'] as const) screen.addEventListener(type, (e) => e.stopPropagation());
  document.body.append(screen);
}
