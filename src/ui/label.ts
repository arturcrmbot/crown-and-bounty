import { uiScale } from './scale';
import { touch } from './touch';

/** The name of whatever is under the pointer, like HoMM2's status line; played by touch, what a finger holds or taps. */
export class HoverLabel {
  private readonly el = document.createElement('div');
  private scale = 1;

  constructor() {
    this.el.className = 'kc-label';
    this.el.hidden = true;
    document.body.append(this.el);
  }

  /** Below and right of the pointer, or above and left of it where the window runs out; above a finger, clear of it. */
  show(text: string, clientX: number, clientY: number) {
    this.el.textContent = text;
    this.el.hidden = false;
    const s = uiScale();
    if (s !== this.scale) {
      this.scale = s;
      this.el.style.transform = s === 1 ? '' : `scale(${s})`;
    }
    const [w, h] = [this.el.offsetWidth * s, this.el.offsetHeight * s];
    const finger = touch();
    const left = finger ? Math.min(window.innerWidth - w - 4, clientX - w / 2) : clientX + 14 + w > window.innerWidth - 4 ? clientX - w - 8 : clientX + 14;
    const top = finger ? (clientY - h - 34 >= 4 ? clientY - h - 34 : clientY + 34) : clientY + 16 + h > window.innerHeight - 4 ? clientY - h - 10 : clientY + 16;
    this.el.style.left = `${Math.max(4, left)}px`;
    this.el.style.top = `${Math.max(4, top)}px`;
  }

  hide() {
    this.el.hidden = true;
  }

  dispose() {
    this.el.remove();
  }

  get text() {
    return this.el.hidden ? null : this.el.textContent;
  }
}
