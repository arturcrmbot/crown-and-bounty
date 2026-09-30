import './tag.css';
import type { AimTag } from '../rules/battle/forecast';
import { uiScale } from './scale';

/** A box on the page, in page pixels. */
export type PageBox = { left: number; top: number; right: number; bottom: number };

/**
 * What a click would do, on a scrap of parchment beside the stack it would land on (#156): the blow,
 * the dead and the answer, in the rules' words (`aimTag`), and played by touch, what a second tap
 * does. It never takes a click itself.
 */
export class ForecastTag {
  private readonly el = document.createElement('div');
  private said = '';
  private placed = '';

  constructor() {
    this.el.className = 'kc-tag';
    this.el.hidden = true;
    document.body.append(this.el);
  }

  /**
   * Beside `box` (the stacks aimed at), on the side `prefer` says, or on the other if there's no room
   * there, and inside `room` (the field). `hint` goes last, in italics.
   */
  show(tag: AimTag, hint: string | null, box: PageBox, prefer: 'left' | 'right', room: PageBox) {
    const said = JSON.stringify([tag, hint]);
    if (said !== this.said) {
      this.said = said;
      const line = (text: string, kind?: string) => Object.assign(document.createElement('p'), { textContent: text, className: kind ?? '' });
      this.el.replaceChildren(
        Object.assign(document.createElement('b'), { textContent: tag.title }),
        ...tag.lines.map((l) => line(l.text, l.danger ? 'danger' : undefined)),
        ...(hint ? [line(hint, 'hint')] : []),
      );
    }
    const s = uiScale();
    // Called every frame while something is aimed at: it only moves when something has changed.
    const placed = JSON.stringify([said, box, prefer, room, s]);
    if (!this.el.hidden && placed === this.placed) return;
    this.placed = placed;
    this.el.hidden = false;
    this.el.style.transform = s === 1 ? '' : `scale(${s})`;
    const [w, h] = [this.el.offsetWidth * s, this.el.offsetHeight * s];
    const [right, left] = [box.right + 8, box.left - 8 - w];
    const fits = { right: right + w <= room.right - 4, left: left >= room.left + 4 };
    const side = fits[prefer] || !fits[prefer === 'right' ? 'left' : 'right'] ? prefer : prefer === 'right' ? 'left' : 'right';
    const x = Math.max(room.left + 4, Math.min(room.right - 4 - w, side === 'right' ? right : left));
    const y = Math.max(room.top + 4, Math.min(room.bottom - 4 - h, (box.top + box.bottom) / 2 - h / 2));
    this.el.style.left = `${Math.round(x)}px`;
    this.el.style.top = `${Math.round(y)}px`;
  }

  hide() {
    this.el.hidden = true;
  }

  dispose() {
    this.el.remove();
  }

  /** What it says while it shows, for scripts. */
  get text() {
    return this.el.hidden ? null : [...this.el.children].map((c) => c.textContent).join(' ');
  }
}
