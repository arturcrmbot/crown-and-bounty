import { isMuted, toggleMute } from '../audio/context';
import type { Display } from '../game/display';
import { Bitmap } from '../render/bitmap';
import { SCREEN } from '../render/frame';
import { GOLD, PARCHMENT, RED } from '../render/palette';
import './mute.css';
import { bitmapUrl } from './pixels';

/** A little speaker, with its sound waves or a red cross over them. */
function speaker(on: boolean): Bitmap {
  const rows = [
    '.....g.......',
    '....gg...w...',
    '...gpg....w..',
    'gggppg.w...w.',
    'gpppp g.w..w.',
    'gpppp g.w..w.',
    'gpppp g.w..w.',
    'gggppg.w...w.',
    '...gpg....w..',
    '....gg...w...',
    '.....g.......',
  ];
  const cross = new Set(['8,3', '12,3', '9,4', '11,4', '10,5', '9,6', '11,6', '8,7', '12,7']);
  const b = new Bitmap(13, 11);
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === 'g') b.set(x, y, GOLD[4]);
      else if (ch === 'p' || ch === ' ') b.set(x, y, PARCHMENT[6]);
      else if (ch === 'w' && on) b.set(x, y, GOLD[6]);
      if (!on && cross.has(`${x},${y}`)) b.set(x, y, RED[5]);
    }),
  );
  return b;
}

/**
 * Button size and where it sits, in screen pixels: on the bar's right end, over the hourglass's corner
 * of the frame, where every screen leaves room (the hourglass itself sits just left of it).
 */
const SIZE = { width: 74, height: 22 };
const AT = { x: SCREEN.width - SIZE.width - 6, y: 5 };

/** The sound button, always in the top right corner: click it (or press M) to mute and unmute everything. */
export class MuteButton {
  private readonly button = document.createElement('button');
  private readonly icon = document.createElement('img');
  private readonly label = document.createElement('span');
  private readonly icons = { on: bitmapUrl(speaker(true)), off: bitmapUrl(speaker(false)) };
  private shown: boolean | null = null;

  constructor() {
    this.button.className = 'kc-mute';
    this.icon.alt = '';
    this.button.append(this.icon, this.label);
    // Its clicks are its own: they never reach the map or the battlefield underneath.
    for (const type of ['pointerdown', 'pointerup', 'click'] as const) this.button.addEventListener(type, (e) => e.stopPropagation());
    this.button.addEventListener('click', () => {
      toggleMute();
      this.button.blur();
    });
    document.body.append(this.button);
  }

  /** Keeps it in the corner as the page scales, and its icon in step with M. */
  place(display: Display) {
    const muted = isMuted();
    if (muted !== this.shown) {
      this.shown = muted;
      this.icon.src = muted ? this.icons.off : this.icons.on;
      this.label.textContent = muted ? 'Muted' : 'Sound';
      this.button.classList.toggle('off', muted);
      this.button.title = muted ? 'Sound is off: click (or press M) to turn it on' : 'Sound is on: click (or press M) to mute';
      this.button.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
    }
    const { x, y } = display.toPage(AT.x, AT.y);
    const s = display.scale;
    Object.assign(this.button.style, { left: `${Math.round(x)}px`, top: `${Math.round(y)}px`, width: `${Math.round(SIZE.width * s)}px`, height: `${Math.round(SIZE.height * s)}px` });
    Object.assign(this.icon.style, { width: `${Math.round(13 * s)}px`, height: `${Math.round(11 * s)}px` });
    this.label.style.fontSize = `${Math.round(13 * s)}px`;
  }
}
