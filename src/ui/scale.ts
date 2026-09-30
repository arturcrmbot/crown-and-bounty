/**
 * How much the page's overlays (cards and labels) grow with the canvas, so they keep their size
 * against the pixel art: whole steps, as the canvas takes, and never smaller than their own.
 */
let scale = 1;

export const uiScale = () => scale;

export function setUiScale(canvasScale: number) {
  scale = Math.max(1, canvasScale);
}

/**
 * The page's room for cards, left to right (page pixels): the whole window, or played by touch on
 * its side, the picture between the rails.
 */
let room: { left: number; right: number } | null = null;

export const uiRoom = () => room ?? { left: 0, right: window.innerWidth };

export function setUiRoom(left: number, right: number) {
  room = { left, right };
}
