/**
 * The little mix panel beside the Sound button: a slider for music, effects and ambience, each
 * remembered like mute (see `audio/context.ts`). A gilt knob button opens and closes it.
 */
import { getVolume, setVolume, type Bus } from '../audio/context';
import type { Display } from '../game/display';
import { Bitmap } from '../render/bitmap';
import { GOLD, PARCHMENT } from '../render/palette';
import './mix.css';
import { bitmapUrl } from './pixels';
import { SOUND_AT, SOUND_SIZE } from './mute';

/** Three bars of a little equaliser, the knob's icon. */
function bars(): Bitmap {
  const b = new Bitmap(13, 11);
  const heights = [7, 11, 5];
  heights.forEach((h, i) => {
    const x = i * 4 + 1;
    for (let y = 10; y > 10 - h; y--) b.set(x, y, GOLD[4]);
    b.set(x, 10 - h + 1, GOLD[6]);
    b.set(x + 1, 10 - h + 1, PARCHMENT[6]);
  });
  return b;
}

const SIZE = { width: 34, height: SOUND_SIZE.height };
const GAP = 6;
const AT = { x: SOUND_AT.x - SIZE.width - GAP, y: SOUND_AT.y };
/** The panel drops from under the Sound button's right edge, so it never runs off the left. */
const PANEL_WIDTH = 190;
const PANEL_AT = { x: SOUND_AT.x + SOUND_SIZE.width - PANEL_WIDTH, y: SOUND_AT.y + SOUND_SIZE.height + 4 };

const BUSES: readonly { bus: Bus; label: string }[] = [
  { bus: 'music', label: 'Music' },
  { bus: 'sfx', label: 'Effects' },
  { bus: 'ambience', label: 'Ambience' },
];

export class MixPanel {
  private readonly button = document.createElement('button');
  private readonly panel = document.createElement('div');
  private open = false;

  constructor() {
    this.button.className = 'kc-mix';
    this.button.title = 'Mix: music, effects and ambience volumes';
    this.button.setAttribute('aria-label', 'Open the mix panel');
    const icon = document.createElement('img');
    icon.src = bitmapUrl(bars());
    icon.alt = '';
    this.button.append(icon);

    this.panel.className = 'kc-mix-panel';
    this.panel.hidden = true;
    for (const { bus, label } of BUSES) {
      const row = document.createElement('label');
      row.className = 'kc-mix-row';
      const name = document.createElement('span');
      name.textContent = label;
      const slider = document.createElement('input');
      slider.type = 'range';
      slider.min = '0';
      slider.max = '100';
      slider.value = String(Math.round(getVolume(bus) * 100));
      slider.addEventListener('input', () => setVolume(bus, Number(slider.value) / 100));
      row.append(name, slider);
      this.panel.append(row);
    }

    // Its own clicks never reach the map underneath, and never close the panel they're inside.
    for (const el of [this.button, this.panel]) for (const type of ['pointerdown', 'pointerup', 'click'] as const) el.addEventListener(type, (e) => e.stopPropagation());
    this.button.addEventListener('click', () => this.toggle(!this.open));
    document.addEventListener('click', () => this.toggle(false));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.toggle(false);
    });
    document.body.append(this.button, this.panel);
  }

  private toggle(open: boolean) {
    this.open = open;
    this.panel.hidden = !open;
    this.button.classList.toggle('open', open);
  }

  /** Keeps it beside the Sound button, at the page's scale. */
  place(display: Display) {
    const { x, y } = display.toPage(AT.x, AT.y);
    const s = display.scale;
    Object.assign(this.button.style, { left: `${Math.round(x)}px`, top: `${Math.round(y)}px`, width: `${Math.round(SIZE.width * s)}px`, height: `${Math.round(SIZE.height * s)}px` });
    const panel = display.toPage(PANEL_AT.x, PANEL_AT.y);
    Object.assign(this.panel.style, { left: `${Math.round(panel.x)}px`, top: `${Math.round(panel.y)}px`, width: `${Math.round(PANEL_WIDTH * s)}px` });
  }
}
