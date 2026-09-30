/**
 * The rails, played by touch: a column of big buttons down each side of the picture, in the strips a
 * phone held sideways leaves beside it (`SIDE`, which the display keeps clear). They do what keys do
 * on a keyboard. Each screen names its own (`Screen.buttons`): on the map Hero, Journal, Map and End
 * day; in battle what the battle bar's buttons do. Full screen and Sound are always at the top right.
 */
import { isMuted, toggleMute } from '../audio/context';
import type { Display } from '../game/display';
import type { SideButton } from '../game/screen';
import { artifactIcon, statIcon } from '../render/artifactIcons';
import { Bitmap } from '../render/bitmap';
import { HOURGLASS, JOURNAL } from '../render/hud';
import { GOLD, INK, NEUTRAL, PARCHMENT, RED, WATER, WOOD } from '../render/palette';
import { CardView } from './card';
import { homeScreenCard, isFullscreen, standalone, toggleFullscreen } from './fullscreen';
import { speaker } from './mute';
import { bitmapUrl } from './pixels';
import { play } from './sound';
import { touch, upright } from './touch';
import './rail.css';

export type RailIcon = 'hero' | 'journal' | 'map' | 'day' | 'spells' | 'wait' | 'defend' | 'sing' | 'auto' | 'retreat' | 'sound' | 'muted' | 'full' | 'unfull';

function icon(rows: string[], colours: Record<string, number>): Bitmap {
  const b = new Bitmap(rows[0].length, rows.length);
  rows.forEach((row, y) => [...row].forEach((ch, x) => colours[ch] && b.set(x, y, colours[ch])));
  return b;
}

/** The little map of the province, folded twice, with its river and an X. */
const MAP = icon(
  ['ooooooooooooooo', 'oCCCCaCCCCaCCCo', 'oCxCCaCCCCaCCCo', 'oCCxCaCCCCaRCRo', 'oCCxxaCCCCaCRCo', 'oCCCxxxCCCaRCRo', 'oCCCCaCxxCaCCCo', 'oCCCCaCCCxxxCCo', 'oCCCCaCCCCaCxxo', 'oCCCCaCCCCaCCCo', 'ooooooooooooooo'],
  { o: INK, C: PARCHMENT[6], a: PARCHMENT[3], x: WATER[6], R: RED[4] },
);
/** Four corners, reaching out to the screen's edges, or back in. */
const FULL = icon(['GGGG...GGGG', 'G.........G', 'G.........G', 'G.........G', '...........', '...........', '...........', 'G.........G', 'G.........G', 'G.........G', 'GGGG...GGGG'], { G: GOLD[5] });
const UNFULL = icon(['...G...G...', '...G...G...', '...G...G...', 'GGGG...GGGG', '...........', '...........', '...........', 'GGGG...GGGG', '...G...G...', '...G...G...', '...G...G...'], { G: GOLD[5] });
/** A white flag on its pole. */
const FLAG = icon(
  ['w...........', 'wNNNN.......', 'wNNNNNNmm...', 'wNNNNNNNNNN.', 'wNNNNNNNNNm.', 'wNmmNNNNNm..', 'w....mmNm...', 'w...........', 'w...........', 'w...........', 'w...........'],
  { w: WOOD[5], N: NEUTRAL[7], m: NEUTRAL[5] },
);
/** A note, for a bard's song. */
const NOTE = icon(['...oo...', '...oGo..', '...oGGo.', '...oGoGo', '...oGo.o', '...oGo..', '...oGo..', '.oooGo..', 'oGGGGo..', 'oGGGGo..', '.oooo...'], { o: INK, G: GOLD[5] });

/** A bitmap without its empty edges, so every picture fills its button alike. */
function trimmed(b: Bitmap): Bitmap {
  let [x0, y0, x1, y1] = [b.width, b.height, -1, -1];
  for (let y = 0; y < b.height; y++) {
    for (let x = 0; x < b.width; x++) {
      if (!b.data[y * b.width + x]) continue;
      [x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x), Math.max(y1, y)];
    }
  }
  if (x1 < 0) return b;
  const out = new Bitmap(x1 - x0 + 1, y1 - y0 + 1);
  for (let y = y0; y <= y1; y++) out.data.set(b.data.subarray(y * b.width + x0, y * b.width + x1 + 1), (y - y0) * out.width);
  return out;
}

const PICTURES: Record<RailIcon, () => Bitmap> = {
  hero: () => artifactIcon('dwarvenHelm'),
  journal: () => JOURNAL,
  map: () => MAP,
  day: () => HOURGLASS,
  spells: () => statIcon('knowledge'),
  wait: () => HOURGLASS,
  defend: () => statIcon('defence'),
  sing: () => NOTE,
  auto: () => statIcon('attack'),
  retreat: () => FLAG,
  sound: () => speaker(true),
  muted: () => speaker(false),
  full: () => FULL,
  unfull: () => UNFULL,
};
/** Each picture as an image, and its size on the button: twice its pixels, no taller than `TALL`. */
const TALL = 24;
const pictures = new Map<RailIcon, { url: string; width: number; height: number }>();
function picture(id: RailIcon) {
  let p = pictures.get(id);
  if (!p) {
    const b = trimmed(PICTURES[id]());
    const zoom = Math.min(2, TALL / b.height);
    p = { url: bitmapUrl(b), width: Math.round(b.width * zoom), height: Math.round(b.height * zoom) };
    pictures.set(id, p);
  }
  return p;
}

/** Full screen and Sound: at the top of the right-hand rail, on every screen. */
const OWN = new Set(['full', 'sound']);

export class Rail {
  private readonly rails = { left: document.createElement('div'), right: document.createElement('div') };
  private readonly card = new CardView(() => this.card.hide());
  private readonly press: (button: SideButton) => void;
  /** The buttons as last drawn, and what they said, so the rails are only rebuilt when that changes. */
  private buttons: SideButton[] = [];
  private drawn = '';
  private placed = '';

  /** `press` works a screen's button (the game skips any change of screen under way first). */
  constructor(press: (button: SideButton) => void) {
    this.press = press;
    for (const [side, rail] of Object.entries(this.rails)) {
      rail.className = `kc-rail ${side}`;
      rail.hidden = true;
      // Its presses are its own: they never reach the map or the battlefield.
      rail.addEventListener('pointerdown', (e) => e.stopPropagation());
      rail.addEventListener('click', (e) => {
        e.stopPropagation();
        const el = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-id]');
        const button = el && this.buttons.find((b) => b.id === el.dataset.id);
        if (!button?.enabled) return;
        play('click');
        el!.blur();
        if (OWN.has(button.id)) button.press();
        else this.press(button);
      });
      rail.addEventListener('contextmenu', (e) => e.preventDefault());
      document.body.append(rail);
    }
  }

  /** Full screen (unless it's open from the Home Screen already) and Sound. */
  private own(): SideButton[] {
    const muted = isMuted();
    const full = isFullscreen();
    const fullButton: SideButton = { id: 'full', label: full ? 'Exit full' : 'Full screen', icon: full ? 'unfull' : 'full', side: 'right', enabled: true, on: full, press: () => void this.fullScreen() };
    const sound: SideButton = { id: 'sound', label: muted ? 'Muted' : 'Sound', icon: muted ? 'muted' : 'sound', side: 'right', enabled: true, press: () => toggleMute() };
    return standalone() ? [sound] : [fullButton, sound];
  }

  private async fullScreen() {
    if (!(await toggleFullscreen())) this.card.show(homeScreenCard());
  }

  /**
   * Each frame: the screen's buttons, in the strips beside the picture; nothing unless played by
   * touch, sideways, and nothing while the screen takes the whole window (`buttons` null).
   */
  place(display: Display, buttons: SideButton[] | null) {
    const shown = touch() && !upright() && buttons !== null;
    for (const rail of Object.values(this.rails)) rail.hidden = !shown;
    if (!shown) {
      this.card.hide();
      return;
    }
    const all = [...this.own(), ...buttons!];
    this.buttons = all;
    const said = all.map((b) => `${b.id}|${b.label}|${b.icon}|${b.side}|${b.enabled}|${b.on ?? false}`).join(';');
    if (said !== this.drawn) {
      this.drawn = said;
      this.build(all);
    }
    const rect = display.canvas.getBoundingClientRect();
    const [left, right] = [Math.max(0, Math.floor(rect.left)), Math.max(0, Math.floor(window.innerWidth - rect.right))];
    const place = `${left}|${right}|${Math.round(rect.right)}`;
    if (place !== this.placed) {
      this.placed = place;
      Object.assign(this.rails.left.style, { left: '0px', width: `${left}px` });
      Object.assign(this.rails.right.style, { left: `${Math.round(rect.right)}px`, width: `${right}px` });
      for (const rail of Object.values(this.rails)) rail.style.setProperty('--width', `${Math.min(64, Math.max(40, rail === this.rails.left ? left - 8 : right - 8))}px`);
    }
    if (this.card.isOpen) this.card.place(null, 0, window.innerHeight);
  }

  private build(all: SideButton[]) {
    for (const [side, rail] of Object.entries(this.rails)) {
      const top = document.createElement('div');
      top.className = 'top';
      const main = document.createElement('div');
      main.className = 'main';
      for (const b of all.filter((x) => x.side === side)) (OWN.has(b.id) ? top : main).append(this.button(b));
      rail.replaceChildren(top, main);
    }
  }

  private button(b: SideButton): HTMLButtonElement {
    const el = document.createElement('button');
    el.className = 'kc-rail-button';
    el.dataset.id = b.id;
    el.disabled = !b.enabled;
    el.classList.toggle('on', Boolean(b.on));
    el.classList.toggle('muted', b.icon === 'muted');
    el.setAttribute('aria-label', b.label);
    const p = picture(b.icon);
    const img = document.createElement('img');
    img.alt = '';
    img.src = p.url;
    Object.assign(img.style, { width: `${p.width}px`, height: `${p.height}px` });
    const word = document.createElement('span');
    word.textContent = b.label;
    el.append(img, word);
    return el;
  }
}
