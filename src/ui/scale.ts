/**
 * How much the page's overlays (cards and labels) grow with the canvas, so they keep their size
 * against the pixel art: whole steps, as the canvas takes, and never smaller than their own.
 */
let scale = 1;

export const uiScale = () => scale;

export function setUiScale(canvasScale: number) {
  scale = Math.max(1, canvasScale);
}
