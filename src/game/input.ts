import type { Display } from './display';

export type InputHandlers = {
  /** A press and release of the main button without dragging, in screen pixels. */
  click(x: number, y: number): void;
  /** A right-click: look at what's there, never act on it. Screens without it ignore right-clicks. */
  look?(x: number, y: number): void;
  /** A mouse wheel or a trackpad's two-finger swipe, in screen pixels. */
  wheel?(dx: number, dy: number): void;
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
    let press: { x: number; y: number; dragged: boolean; right: boolean } | null = null;
    // The game's own right-click, not the browser's menu.
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 && e.button !== 2) return;
      press = { x: e.clientX, y: e.clientY, dragged: false, right: e.button === 2 };
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
      if (press.right || (!press.dragged && Math.hypot(dx, dy) < 5)) return;
      press.dragged = true;
      handlers.leave();
      handlers.drag(dx / display.scale, dy / display.scale);
      press.x = e.clientX;
      press.y = e.clientY;
    });
    canvas.addEventListener('pointerleave', () => handlers.leave());
    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        // Lines or pages from a mouse wheel, pixels from a trackpad.
        const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
        handlers.wheel?.((e.deltaX * unit) / display.scale, (e.deltaY * unit) / display.scale);
      },
      { passive: false },
    );
    canvas.addEventListener('pointerup', (e) => {
      if (press && !press.dragged) {
        const [x, y] = display.toScreen(e.clientX, e.clientY);
        if (press.right) handlers.look?.(x, y);
        else handlers.click(x, y);
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
