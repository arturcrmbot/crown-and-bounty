/**
 * The little mix panel beside the Sound button: a slider for music, effects and ambience, each
 * remembered like mute (see `audio/context.ts`), and the switch for gentle effects in battle
 * (`ui/gentle.ts`). A gilt knob button opens and closes it.
 */
import { getVolume, isMuted, setVolume, toggleMute, type Bus } from '../audio/context';
import type { Display } from '../game/display';
import { Bitmap } from '../render/bitmap';
import { GOLD, PARCHMENT } from '../render/palette';
import './mix.css';
import { isGentle, setGentle } from './gentle';
import { bitmapUrl } from './pixels';
import { SOUND_AT, SOUND_SIZE } from './mute';
import { uiRoom, uiScale } from './scale';
import { touch } from './touch';

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
const PANEL_WIDTH = 300;

/** The phone rail opens the same panel as the desktop button. */
export function toggleMixPanel() {
  const button = document.querySelector<HTMLButtonElement>('.kc-mix');
  if (!button) throw new Error('The mix panel has not been created.');
  button.click();
}

const BUSES: readonly { bus: Bus; label: string }[] = [
  { bus: 'music', label: 'Music' },
  { bus: 'sfx', label: 'Effects' },
  { bus: 'ambience', label: 'Ambience' },
];

export class MixPanel {
  private readonly button = document.createElement('button');
  private readonly panel = document.createElement('div');
  private readonly sound = document.createElement('button');
  private open = false;
  private opener: HTMLElement | null = null;
  private placed = '';

  constructor() {
    this.button.className = 'kc-mix';
    this.button.title = 'Mix: music, effects and ambience volumes, and gentle effects in battle';
    this.button.setAttribute('aria-label', 'Open the mix panel');
    this.button.setAttribute('aria-expanded', 'false');
    this.button.setAttribute('aria-controls', 'kc-mix-panel');
    const icon = document.createElement('img');
    icon.src = bitmapUrl(bars());
    icon.alt = '';
    this.button.append(icon);

    this.panel.className = 'kc-mix-panel';
    this.panel.id = 'kc-mix-panel';
    this.panel.setAttribute('role', 'dialog');
    this.panel.setAttribute('aria-label', 'Sound and effects');
    this.panel.hidden = true;
    const header = document.createElement('div');
    header.className = 'kc-mix-heading';
    header.innerHTML = '<h3>Sound and effects</h3>';
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = 'Close';
    close.addEventListener('click', () => this.toggle(false));
    header.append(close);
    const content = document.createElement('div');
    content.className = 'kc-mix-body';
    this.sound.type = 'button';
    this.sound.className = 'kc-mix-sound';
    this.sound.addEventListener('click', () => toggleMute());
    content.append(this.sound);
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
      slider.setAttribute('aria-label', label);
      const value = document.createElement('output');
      value.textContent = `${slider.value}%`;
      slider.setAttribute('aria-valuetext', value.textContent);
      slider.addEventListener('input', () => {
        setVolume(bus, Number(slider.value) / 100);
        value.textContent = `${slider.value}%`;
        slider.setAttribute('aria-valuetext', value.textContent);
      });
      row.append(name, slider, value);
      content.append(row);
    }
    // Less shaking and flashing in battle, for players sensitive to motion or flashing light (#190).
    const gentle = document.createElement('label');
    gentle.className = 'kc-mix-row kc-mix-gentle';
    gentle.title = 'Less shaking and flashing in battle';
    const words = document.createElement('span');
    words.innerHTML = 'Gentle effects<small>Less shaking and flashing in battle.</small>';
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = isGentle();
    box.addEventListener('change', () => setGentle(box.checked));
    gentle.append(words, box);
    content.append(gentle);
    this.panel.append(header, content);

    // Its own clicks never reach the map underneath, and never close the panel they're inside.
    for (const el of [this.button, this.panel]) for (const type of ['pointerdown', 'pointerup', 'click'] as const) el.addEventListener(type, (e) => e.stopPropagation());
    this.button.addEventListener('click', () => this.toggle(!this.open));
    this.panel.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') {
        e.preventDefault();
        this.toggle(false);
      }
    });
    document.addEventListener('click', () => this.toggle(false, false));
    document.addEventListener('keydown', (e) => {
      if (this.open && e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.toggle(false);
      }
    });
    document.body.append(this.button, this.panel);
  }

  private toggle(open: boolean, restoreFocus = true) {
    if (open === this.open) return;
    if (open) this.opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.open = open;
    this.panel.hidden = !open;
    this.button.classList.toggle('open', open);
    this.button.setAttribute('aria-expanded', String(open));
    this.button.setAttribute('aria-label', open ? 'Close the mix panel' : 'Open the mix panel');
    if (open) this.panel.querySelector<HTMLInputElement>('input[type="range"]')!.focus({ preventScroll: true });
    else if (restoreFocus) {
      const opener = touch() ? document.querySelector<HTMLButtonElement>('.kc-rail button[data-id="mix"]') : this.opener;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    }
  }

  /** Keeps it beside the Sound button, at the page's scale. */
  place(display: Display) {
    const { x, y } = display.toPage(AT.x, AT.y);
    const s = display.scale;
    Object.assign(this.button.style, { left: `${Math.round(x)}px`, top: `${Math.round(y)}px`, width: `${Math.round(SIZE.width * s)}px`, height: `${Math.round(SIZE.height * s)}px` });
    this.sound.textContent = isMuted() ? 'Turn sound on' : 'Mute sound';
    const room = uiRoom();
    const zoom = uiScale();
    const width = Math.min(PANEL_WIDTH, Math.floor((room.right - room.left - 16) / zoom));
    const top = touch() ? 8 : Math.min(window.innerHeight - 8, y + SIZE.height * s + 6);
    const left = Math.max(room.left + 8, Math.min(room.right - width * zoom - 8, x + SIZE.width * s - width * zoom));
    const placed = `${left}|${top}|${width}|${zoom}|${window.innerHeight}`;
    if (placed === this.placed) return;
    this.placed = placed;
    Object.assign(this.panel.style, {
      left: `${Math.round(left)}px`,
      top: `${Math.round(top)}px`,
      width: `${width}px`,
      maxHeight: `${Math.floor((window.innerHeight - top - 8) / zoom)}px`,
      transform: zoom === 1 ? '' : `scale(${zoom})`,
    });
  }
}
