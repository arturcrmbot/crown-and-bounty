import type { PortraitId } from '../content/portraits';
import { portraitOf } from '../render/portraits';
import type { Action, Card } from '../rules/game';
import './card.css';
import { bitmapUrl } from './pixels';
import { uiScale } from './scale';
import { play } from './sound';

type ScreenPoint = { x: number; y: number };
/** A box on the page (page pixels) that a card with nowhere in particular to be should keep clear of. */
export type Keepout = { x0: number; y0: number; x1: number; y1: number };

const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const format = (text: string) => escape(text).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>');

/** A portrait as an image for the page, drawn once through the game's palette. */
const images = new Map<PortraitId, string>();
function portraitImage(id: PortraitId): string {
  let url = images.get(id);
  if (!url) {
    url = bitmapUrl(portraitOf(id));
    images.set(id, url);
  }
  return url;
}

/** The one parchment card on screen. It sits above whatever it describes and follows it around. */
export class CardView {
  private readonly wrap = document.createElement('div');
  private readonly card = document.createElement('div');
  private onChoice: (action: Action) => void;
  private title: string | null = null;
  private scale = 1;
  private tallest = 0;

  constructor(onChoice: (action: Action) => void) {
    this.onChoice = onChoice;
    this.wrap.className = 'kc-card-wrap';
    this.card.className = 'kc-card';
    this.wrap.append(this.card);
    this.wrap.hidden = true;
    document.body.append(this.wrap);
    this.card.addEventListener('pointerdown', (e) => e.stopPropagation());
  }

  get isOpen() {
    return !this.wrap.hidden;
  }

  show(card: Card) {
    // A new card unfolds like a letter; the same card shown again just updates.
    if (this.wrap.hidden || this.title !== card.title) {
      this.card.classList.remove('unfold');
      void this.card.offsetWidth;
      this.card.classList.add('unfold');
    }
    this.title = card.title;
    this.card.classList.toggle('wide', Boolean(card.wide));
    this.card.classList.toggle('poster', Boolean(card.poster));
    this.card.classList.toggle('tiled', Boolean(card.tiles));
    const face = card.portrait ? `<img class="portrait" alt="" src="${portraitImage(card.portrait)}">` : '';
    const title = card.title ? `<h3>${escape(card.title)}</h3>` : '';
    this.card.innerHTML = `${card.poster ? title + face : face + title}${card.lines.map((l) => `<p>${format(l)}</p>`).join('')}`;
    if (card.choices.length) {
      const choices = document.createElement('div');
      choices.className = card.tiles ? 'choices tiles' : 'choices';
      for (const choice of card.choices) {
        const button = document.createElement('button');
        button.textContent = choice.label;
        if (choice.detail) {
          const detail = document.createElement('small');
          detail.textContent = choice.detail;
          button.append(detail);
        }
        if (choice.portrait) {
          button.classList.add('with-portrait');
          const face = document.createElement('img');
          face.alt = '';
          face.src = portraitImage(choice.portrait);
          button.prepend(face);
        }
        button.disabled = Boolean(choice.disabled);
        button.addEventListener('click', (e) => {
          e.stopPropagation();
          play(choice.action.type === 'choose' && choice.action.choice === 'dig' ? 'dig' : 'click');
          this.onChoice(choice.action);
        });
        choices.append(button);
      }
      this.card.append(choices);
    }
    this.wrap.hidden = false;
  }

  hide() {
    this.wrap.hidden = true;
  }

  /** A key on a card: Enter or Space presses its only button, a number key that button. True if one was pressed. */
  key(key: string): boolean {
    if (key === 'enter' || key === ' ') return this.pressOnly();
    if (key.length === 1 && key >= '1' && key <= '9') return this.pressNumber(Number(key));
    return false;
  }

  /** A number key presses that button of the card, counting from 1, if it can be pressed. */
  pressNumber(n: number): boolean {
    if (this.wrap.hidden) return false;
    const button = this.card.querySelectorAll<HTMLButtonElement>('.choices button')[n - 1];
    if (!button || button.disabled) return false;
    button.click();
    return true;
  }

  /**
   * Enter or Space on a card with one thing to do ("Close", "Ride out") does it; a card with a real
   * choice waits for one. A focused button answers the key itself. True if a button was pressed.
   */
  pressOnly(): boolean {
    if (this.wrap.hidden || this.card.contains(document.activeElement)) return false;
    const buttons = [...this.card.querySelectorAll<HTMLButtonElement>('.choices button:not(:disabled)')];
    if (buttons.length !== 1) return false;
    buttons[0].click();
    return true;
  }

  /** Takes the card off the page for good, when its screen goes away. */
  dispose() {
    this.wrap.remove();
  }

  /**
   * Puts the card's bottom edge just above `point` (page pixels), kept between `top` and `bottom`.
   * With no room above, it goes below or beside `keepout` (what the card is about), so it never
   * covers it. With no point, the card sits in the middle, or beside `keepout` (the hero) if the
   * middle would cover him. Cards grow with the canvas, as the pixel art does.
   */
  place(point: ScreenPoint | null, top: number, bottom: number, keepout?: Keepout) {
    if (this.wrap.hidden) return;
    const s = uiScale();
    if (s !== this.scale) {
      this.scale = s;
      this.wrap.style.transform = s === 1 ? '' : `scale(${s})`;
    }
    const tallest = Math.floor((window.innerHeight - 46) / s);
    if (tallest !== this.tallest) {
      this.tallest = tallest;
      this.card.style.maxHeight = `${tallest}px`;
    }
    const [w, h] = [this.wrap.offsetWidth * s, this.wrap.offsetHeight * s];
    // Too tall for the map area: use the whole window, so the buttons at the bottom stay on screen.
    if (h > bottom - top - 16) [top, bottom] = [0, window.innerHeight];
    const [minY, maxY] = [top + 8, Math.max(top + 8, bottom - h - 8)];
    const clampY = (y: number) => Math.min(maxY, Math.max(minY, y));
    let x = Math.min(window.innerWidth - w - 8, Math.max(8, (point ? point.x : window.innerWidth / 2) - w / 2));
    let y = top;
    const k = keepout;
    /** Beside `k`, on the side with more room, level with it; false if neither side has room. */
    const beside = () => {
      if (!k) return false;
      const [left, right] = [k.x0 - 14 - w, k.x1 + 14];
      const leftFits = left >= 8;
      const rightFits = right + w <= window.innerWidth - 8;
      if (!leftFits && !rightFits) return false;
      x = leftFits && (!rightFits || k.x0 > window.innerWidth - k.x1) ? left : right;
      y = clampY((k.y0 + k.y1 - h) / 2);
      return true;
    };
    if (!point) {
      y = clampY((top + bottom - h) / 2);
      if (k && x < k.x1 && x + w > k.x0 && y < k.y1 && y + h > k.y0 && !beside()) {
        if (k.y0 - h - 10 >= minY) y = k.y0 - h - 10;
        else if (k.y1 + 10 <= maxY) y = k.y1 + 10;
      }
    } else {
      const above = point.y - h - 10;
      if (above >= minY) y = above;
      else if (k && k.y1 + 10 <= maxY) y = k.y1 + 10;
      else if (!beside()) y = clampY(point.y + 30);
    }
    this.wrap.style.left = `${Math.round(x)}px`;
    this.wrap.style.top = `${Math.round(y)}px`;
  }
}
