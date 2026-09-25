import { AdventureScreen } from './render/adventureScreen';
import { populateLookTest } from './render/lookTestScene';
import { SCREEN } from './render/frame';
import { paletteWords } from './render/palette';

declare global {
  interface Window {
    /** Set once the first frame is on screen. Used by the screenshot script. */
    __ready?: boolean;
  }
}

/** HoMM2 advanced its palette cycles about eight times a second. */
const TICK_MS = 120;

const canvas = document.createElement('canvas');
canvas.width = SCREEN.width;
canvas.height = SCREEN.height;
document.body.append(canvas);
const context = canvas.getContext('2d')!;
const image = context.createImageData(SCREEN.width, SCREEN.height);
const pixels = new Uint32Array(image.data.buffer);

/** Whole-pixel scaling when the window allows it, so every art pixel stays square. */
function fit() {
  const ratio = Math.min(window.innerWidth / SCREEN.width, window.innerHeight / SCREEN.height);
  const scale = ratio >= 1 ? Math.floor(ratio) : ratio;
  canvas.style.width = `${SCREEN.width * scale}px`;
  canvas.style.height = `${SCREEN.height * scale}px`;
}
window.addEventListener('resize', fit);
fit();

const view = new AdventureScreen();
populateLookTest(view);
let lastTick = -1;

function frame(now: number) {
  const tick = Math.floor(now / TICK_MS);
  if (tick !== lastTick) {
    lastTick = tick;
    const palette = paletteWords(tick);
    const indexed = view.compose(tick).data;
    for (let i = 0; i < indexed.length; i++) pixels[i] = palette[indexed[i]];
    context.putImageData(image, 0, 0);
    window.__ready = true;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
