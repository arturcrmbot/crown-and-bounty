import { SCREEN } from './render/frame';
import { buildLookTest } from './render/lookTestScene';
import { paletteWords } from './render/palette';

declare global {
  interface Window {
    /** Set once the first frame is on screen. Used by the screenshot script. */
    __ready?: boolean;
  }
}

/** HoMM2 advanced its palette cycles about eight times a second. */
const TICK_MS = 120;
const SCROLL_SPEED = 6;

const canvas = document.createElement('canvas');
canvas.width = SCREEN.width;
canvas.height = SCREEN.height;
document.body.append(canvas);
const context = canvas.getContext('2d')!;
const image = context.createImageData(SCREEN.width, SCREEN.height);
const pixels = new Uint32Array(image.data.buffer);
let scale = 1;

/** Whole-pixel scaling when the window allows it, so every art pixel stays square. */
function fit() {
  const ratio = Math.min(window.innerWidth / SCREEN.width, window.innerHeight / SCREEN.height);
  scale = ratio >= 1 ? Math.floor(ratio) : ratio;
  canvas.style.width = `${SCREEN.width * scale}px`;
  canvas.style.height = `${SCREEN.height * scale}px`;
}
window.addEventListener('resize', fit);
fit();

const view = buildLookTest();
const query = new URLSearchParams(window.location.search);
if (query.has('x')) view.centreOn(Number(query.get('x')), Number(query.get('y') ?? 480));
const held = new Set<string>();
window.addEventListener('keydown', (e) => held.add(e.key.toLowerCase()));
window.addEventListener('keyup', (e) => held.delete(e.key.toLowerCase()));
let drag: { x: number; y: number } | null = null;
canvas.addEventListener('pointerdown', (e) => {
  drag = { x: e.clientX, y: e.clientY };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointerup', () => (drag = null));
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  view.scrollTo(view.camera.x - (e.clientX - drag.x) / scale, view.camera.y - (e.clientY - drag.y) / scale);
  drag = { x: e.clientX, y: e.clientY };
});

let lastTick = -1;
let lastCamera = '';
function frame(now: number) {
  const dx = (held.has('arrowright') || held.has('d') ? 1 : 0) - (held.has('arrowleft') || held.has('a') ? 1 : 0);
  const dy = (held.has('arrowdown') || held.has('s') ? 1 : 0) - (held.has('arrowup') || held.has('w') ? 1 : 0);
  if (dx || dy) view.scrollTo(view.camera.x + dx * SCROLL_SPEED, view.camera.y + dy * SCROLL_SPEED);
  const tick = Math.floor(now / TICK_MS);
  const camera = `${Math.round(view.camera.x)},${Math.round(view.camera.y)}`;
  if (tick !== lastTick || camera !== lastCamera) {
    lastTick = tick;
    lastCamera = camera;
    const palette = paletteWords(tick);
    const indexed = view.compose(tick).data;
    for (let i = 0; i < indexed.length; i++) pixels[i] = palette[indexed[i]];
    context.putImageData(image, 0, 0);
    window.__ready = true;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
