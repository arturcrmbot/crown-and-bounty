/** The name of whatever is under the pointer, like HoMM2's status line. */
export class HoverLabel {
  private readonly el = document.createElement('div');

  constructor() {
    this.el.className = 'kc-label';
    this.el.hidden = true;
    document.body.append(this.el);
  }

  show(text: string, clientX: number, clientY: number) {
    this.el.textContent = text;
    this.el.style.left = `${clientX + 14}px`;
    this.el.style.top = `${clientY + 16}px`;
    this.el.hidden = false;
  }

  hide() {
    this.el.hidden = true;
  }

  get text() {
    return this.el.hidden ? null : this.el.textContent;
  }
}
