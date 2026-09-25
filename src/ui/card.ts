import type { Action, Card } from '../rules/game';
import './card.css';

type ScreenPoint = { x: number; y: number };

const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const format = (text: string) => escape(text).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>');

/** The one parchment card on screen. It sits above whatever it describes and follows it around. */
export class CardView {
  private readonly wrap = document.createElement('div');
  private readonly card = document.createElement('div');
  private onChoice: (action: Action) => void;

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
    this.card.innerHTML = `<h3>${escape(card.title)}</h3>${card.lines.map((l) => `<p>${format(l)}</p>`).join('')}`;
    if (card.choices.length) {
      const choices = document.createElement('div');
      choices.className = 'choices';
      for (const choice of card.choices) {
        const button = document.createElement('button');
        button.textContent = choice.label;
        button.addEventListener('click', (e) => {
          e.stopPropagation();
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

  /**
   * Puts the card's bottom edge just above `point` (page pixels), or just below it when there is no
   * room above, kept between `top` and `bottom`. With no point, the card sits in the middle.
   */
  place(point: ScreenPoint | null, top: number, bottom: number) {
    if (this.wrap.hidden) return;
    const { offsetWidth: w, offsetHeight: h } = this.wrap;
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
