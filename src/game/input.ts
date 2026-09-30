import type { Display } from './display';

export type InputHandlers = {
  /** The main button going down, in screen pixels, before it's known to be a click or a drag. */
  press?(x: number, y: number): void;
  /** A press and release of the main button without dragging, in screen pixels; `touch` if a finger tapped. */
  click(x: number, y: number, touch?: boolean): void;
  /** A right-click: look at what's there, never act on it. Screens without it ignore right-clicks. */
  look?(x: number, y: number): void;
  /** A mouse wheel or a trackpad's two-finger swipe, in screen pixels. */
  wheel?(dx: number, dy: number): void;
  /** The pointer over a point: a mouse moving, or a finger held still there (touch has no other way to point). */
  hover(x: number, y: number, clientX: number, clientY: number): void;
  /** Dragged by this many screen pixels, to (x, y). */
  drag(dx: number, dy: number, x: number, y: number): void;
  leave(): void;
  /** A key pressed. True if the screen took it for itself, so the browser shouldn't (Tab, on the map). */
  key(key: string): boolean | void;
};

/** How long a finger holds still before it points at what's under it, as a mouse hovers (ms). */
const HOLD = 450;
/** How far a press may wander and still be a click rather than a drag: a finger wanders further (CSS pixels). */
const SLOP = { mouse: 5, touch: 12 };

/**
 * Pointer and keyboard, turned into clicks, drags, hovers and keys. `held` has the keys down now.
 * A finger taps, drags, and, held still a moment, points (its label stays up until the next touch).
 */
export class Input {
  readonly held = new Set<string>();

  constructor(display: Display, handlers: InputHandlers) {
    const { canvas } = display;
    let press: { id: number; x: number; y: number; dragged: boolean; right: boolean; touch: boolean; pointing: boolean } | null = null;
    let hold: ReturnType<typeof setTimeout> | null = null;
    const letGo = () => {
      if (hold) clearTimeout(hold);
      hold = null;
      press = null;
    };
    // The game's own right-click, not the browser's menu.
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    // A new touch anywhere, on the canvas or not, puts away what the last one pointed at.
    window.addEventListener('pointerdown', (e) => e.pointerType === 'touch' && handlers.leave(), { capture: true });
    canvas.addEventListener('pointerdown', (e) => {
      if ((e.button !== 0 && e.button !== 2) || !e.isPrimary) return;
      letGo();
      const touch = e.pointerType === 'touch';
      const pressed = { id: e.pointerId, x: e.clientX, y: e.clientY, dragged: false, right: e.button === 2, touch, pointing: false };
      press = pressed;
      canvas.setPointerCapture(e.pointerId);
      if (!pressed.right) handlers.press?.(...display.toScreen(e.clientX, e.clientY));
      if (touch) {
        hold = setTimeout(() => {
          hold = null;
          if (press !== pressed || pressed.dragged) return;
          pressed.pointing = true;
          handlers.hover(...display.toScreen(pressed.x, pressed.y), pressed.x, pressed.y);
        }, HOLD);
      }
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!press) {
        if (e.pointerType === 'touch') return;
        const [x, y] = display.toScreen(e.clientX, e.clientY);
        handlers.hover(x, y, e.clientX, e.clientY);
        return;
      }
      if (e.pointerId !== press.id) return;
      // A finger held still points; sliding it on points at what it slides over.
      if (press.pointing) return handlers.hover(...display.toScreen(e.clientX, e.clientY), e.clientX, e.clientY);
      const dx = e.clientX - press.x;
      const dy = e.clientY - press.y;
      if (press.right || (!press.dragged && Math.hypot(dx, dy) < (press.touch ? SLOP.touch : SLOP.mouse))) return;
      press.dragged = true;
      handlers.leave();
      handlers.drag(dx / display.scale, dy / display.scale, ...display.toScreen(e.clientX, e.clientY));
      press.x = e.clientX;
      press.y = e.clientY;
    });
    // A finger lifted leaves what it pointed at on show, until the next touch.
    canvas.addEventListener('pointerleave', (e) => e.pointerType !== 'touch' && handlers.leave());
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
      if (press && e.pointerId === press.id && !press.dragged && !press.pointing) {
        const [x, y] = display.toScreen(e.clientX, e.clientY);
        if (press.right) handlers.look?.(x, y);
        else handlers.click(x, y, press.touch);
      }
      if (!press || e.pointerId === press.id) letGo();
    });
    canvas.addEventListener('pointercancel', (e) => (!press || e.pointerId === press.id) && letGo());
    // After a tap the browser sends a click of its own, to whatever is under the finger by then: a card
    // the tap has just opened there would take it as a press of its button. The tap is the game's alone.
    canvas.addEventListener('touchend', (e) => e.cancelable && e.preventDefault(), { passive: false });
    window.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      this.held.add(key);
      if (handlers.key(key) === true) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.held.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.held.clear());
  }
}
