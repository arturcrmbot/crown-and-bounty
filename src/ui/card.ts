import type { PortraitId } from '../content/portraits';
import { portraitOf } from '../render/portraits';
import type { Action, Card } from '../rules/game';
import './card.css';
import { bitmapUrl } from './pixels';
import { play } from './sound';

type ScreenPoint = { x: number; y: number };

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

  /** Takes the card off the page for good, when its screen goes away. */
  dispose() {
    this.wrap.remove();
  }

  /**
   * Puts the card's bottom edge just above `point` (page pixels), or just below it when there is no
   * room above, kept between `top` and `bottom`. With no point, the card sits in the middle.
   */
  place(point: ScreenPoint | null, top: number, bottom: number) {
    if (this.wrap.hidden) return;
    const { offsetWidth: w, offsetHeight: h } = this.wrap;
    // Too tall for the map area: use the whole window, so the buttons at the bottom stay on screen.
    if (h > bottom - top - 16) [top, bottom] = [0, window.innerHeight];
    const [minY, maxY] = [top + 8, Math.max(top + 8, bottom - h - 8)];
    const clampY = (y: number) => Math.min(maxY, Math.max(minY, y));
    const x = Math.min(window.innerWidth - w - 8, Math.max(8, (point ? point.x : window.innerWidth / 2) - w / 2));
    let y: number;
    if (!point) y = clampY((top + bottom - h) / 2);
    else {
      const above = point.y - h - 10;
      y = above >= minY ? above : clampY(point.y + 30);
    }
    this.wrap.style.left = `${Math.round(x)}px`;
    this.wrap.style.top = `${Math.round(y)}px`;
  }
}
