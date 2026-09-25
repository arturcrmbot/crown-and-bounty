import type { Display } from './display';

export type InputHandlers = {
  /** A press and release without dragging, in screen pixels. */
  click(x: number, y: number): void;
  hover(x: number, y: number, clientX: number, clientY: number): void;
  /** Dragged by this many screen pixels. */
  drag(dx: number, dy: number): void;
  leave(): void;
  key(key: string): void;
};

/** Pointer and keyboard, turned into clicks, drags, hovers and keys. `held` has the keys down now. */
export class Input {
  readonly held = new Set<string>();

  constructor(display: Display, handlers: InputHandlers) {
    const { canvas } = display;
    let press: { x: number; y: number; dragged: boolean } | null = null;
    canvas.addEventListener('pointerdown', (e) => {
      press = { x: e.clientX, y: e.clientY, dragged: false };
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!press) {
        const [x, y] = display.toScreen(e.clientX, e.clientY);
        handlers.hover(x, y, e.clientX, e.clientY);
        return;
      }
      const dx = e.clientX - press.x;
      const dy = e.clientY - press.y;
      if (!press.dragged && Math.hypot(dx, dy) < 5) return;
      press.dragged = true;
      handlers.leave();
      handlers.drag(dx / display.scale, dy / display.scale);
      press.x = e.clientX;
      press.y = e.clientY;
    });
    canvas.addEventListener('pointerleave', () => handlers.leave());
    canvas.addEventListener('pointerup', (e) => {
      if (press && !press.dragged) {
        const [x, y] = display.toScreen(e.clientX, e.clientY);
        handlers.click(x, y);
      }
      press = null;
    });
    window.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      this.held.add(key);
      handlers.key(key);
    });
    window.addEventListener('keyup', (e) => this.held.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.held.clear());
  }
}
