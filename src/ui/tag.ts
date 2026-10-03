import './tag.css';
import type { AimTag } from '../rules/battle/forecast';
import { uiScale } from './scale';
import { translate } from '../i18n';

/** A box on the page, in page pixels. */
export type PageBox = { left: number; top: number; right: number; bottom: number };
/** Where the tag may go, round the box it's about. */
export type TagSide = 'left' | 'right' | 'above' | 'below';

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
   * Round `box` (the stacks aimed at), at the first of `sides` with room for it inside `room` (the
   * field), or at the first of them, squeezed in, if none has. `hint` goes last, in italics.
   */
  show(tag: AimTag, hint: string | null, box: PageBox, sides: TagSide[], room: PageBox) {
    const said = JSON.stringify([tag, hint]);
    if (said !== this.said) {
      this.said = said;
      const line = (text: string, kind?: string) => Object.assign(document.createElement('p'), { textContent: translate(text), className: kind ?? '' });
      this.el.replaceChildren(
        Object.assign(document.createElement('b'), { textContent: translate(tag.title) }),
        ...tag.lines.map((l) => line(l.text, l.danger ? 'danger' : undefined)),
        ...(hint ? [line(hint, 'hint')] : []),
      );
    }
    const s = uiScale();
    // Called every frame while something is aimed at: it only moves when something has changed.
    const placed = JSON.stringify([said, box, sides, room, s]);
    if (!this.el.hidden && placed === this.placed) return;
    this.placed = placed;
    this.el.hidden = false;
    this.el.style.transform = s === 1 ? '' : `scale(${s})`;
    const [w, h] = [this.el.offsetWidth * s, this.el.offsetHeight * s];
    const [midX, midY] = [(box.left + box.right) / 2 - w / 2, (box.top + box.bottom) / 2 - h / 2];
    const spots: Record<TagSide, [number, number]> = {
      right: [box.right + 8, midY],
      left: [box.left - 8 - w, midY],
      above: [midX, box.top - 8 - h],
      below: [midX, box.bottom + 8],
    };
    const fits = (side: TagSide) => {
      const [x, y] = spots[side];
      return side === 'left' || side === 'right' ? x >= room.left + 4 && x + w <= room.right - 4 : y >= room.top + 4 && y + h <= room.bottom - 4;
    };
    const [x, y] = spots[sides.find(fits) ?? sides[0]];
    this.el.style.left = `${Math.round(Math.max(room.left + 4, Math.min(room.right - 4 - w, x)))}px`;
    this.el.style.top = `${Math.round(Math.max(room.top + 4, Math.min(room.bottom - 4 - h, y)))}px`;
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
