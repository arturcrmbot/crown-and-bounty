import { SCREEN } from './render/frame';
import type { Point } from './render/lookTestMap';
import { buildLookTest, CELL } from './render/lookTestScene';
import { paletteWords } from './render/palette';
import { findPath, nearestPassable } from './rules/pathfinding';

declare global {
  interface Window {
    /** Set once the first frame is on screen. Used by the screenshot script. */
    __ready?: boolean;
    /** Test hook: ride the hero to a map point. */
    __rideTo?: (x: number, y: number) => void;
  }
}

/** HoMM2 advanced its palette cycles about eight times a second. */
const TICK_MS = 120;
const SCROLL_SPEED = 6;
/** Map pixels per second. */
const RIDE_SPEED = 95;
const REVEAL_RADIUS = 150;
/** Map pixels per step of the trot cycle, so hooves don't slide. */
const STRIDE = 5;

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

const { view, grid, hero } = buildLookTest();
const query = new URLSearchParams(window.location.search);
if (query.has('x')) view.centreOn(Number(query.get('x')), Number(query.get('y') ?? 480));

const width = hero.idle[0].width;
const position = { x: hero.object.x + width / 2, y: hero.object.y + hero.foot };
let route: Point[] = [];
let facing = 1;
let travelled = 0;
let sinceReveal = 0;
let follow = false;

/** Cuts the corners of the cell-by-cell route so the horse rides in curves. */
function curve(points: Point[]): Point[] {
  let out = points;
  for (let pass = 0; pass < 2; pass++) {
    const next: Point[] = [out[0]];
    for (let i = 0; i < out.length - 1; i++) {
      const [ax, ay] = out[i];
      const [bx, by] = out[i + 1];
      next.push([ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25], [ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75]);
    }
    next.push(out[out.length - 1]);
    out = next;
  }
  return out;
}

function rideTo(x: number, y: number) {
  const cell = (px: number, py: number) => ({ x: Math.floor(px / CELL), y: Math.floor(py / CELL) });
  const start = nearestPassable(grid, cell(position.x, position.y));
  const goal = nearestPassable(grid, cell(x, y));
  if (!start || !goal) return;
  const cells = findPath(grid, start, goal);
  if (!cells || cells.length < 2) return;
  route = curve(cells.map((c) => [c.x * CELL + CELL / 2, c.y * CELL + CELL / 2] as Point)).slice(1);
  follow = true;
}
window.__rideTo = rideTo;

/** Gold dots every 10 pixels along the road still ahead. */
function routeDots(): Point[] {
  const dots: Point[] = [];
  let last: Point = [position.x, position.y];
  let carry = -14;
  for (const p of route) {
    const d = Math.hypot(p[0] - last[0], p[1] - last[1]);
    for (let t = 10 - carry; t <= d; t += 10) {
      const k = t / d;
      dots.push([Math.round(last[0] + (p[0] - last[0]) * k), Math.round(last[1] + (p[1] - last[1]) * k)]);
    }
    carry = (carry + d) % 10;
    last = p;
  }
  return dots;
}

function ride(dt: number) {
  let budget = RIDE_SPEED * dt;
  while (budget > 0 && route.length > 0) {
    const [tx, ty] = route[0];
    const dx = tx - position.x;
    const dy = ty - position.y;
    const d = Math.hypot(dx, dy);
    if (Math.abs(dx) > 0.3) facing = dx > 0 ? 1 : -1;
    const move = Math.min(d, budget);
    if (d > 0) {
      position.x += (dx / d) * move;
      position.y += (dy / d) * move;
    }
    if (move >= d) route.shift();
    budget -= move;
    travelled += move;
    sinceReveal += move;
  }
  if (sinceReveal > 6) {
    view.reveal(position.x, position.y, REVEAL_RADIUS);
    sinceReveal = 0;
  }
  const walking = route.length > 0;
  hero.object.frames = walking ? (facing > 0 ? hero.walk : hero.walkLeft) : facing > 0 ? hero.idle : hero.idleLeft;
  hero.object.frame = walking ? Math.floor(travelled / STRIDE) : undefined;
  hero.object.x = position.x - width / 2;
  hero.object.y = position.y - hero.foot;
  view.route = walking ? routeDots() : [];
  if (follow) {
    const tx = position.x - 464;
    const ty = position.y - 250;
    const k = Math.min(1, dt * 2.5);
    view.scrollTo(view.camera.x + (tx - view.camera.x) * k, view.camera.y + (ty - view.camera.y) * k);
    if (!walking && Math.hypot(tx - view.camera.x, ty - view.camera.y) < 2) follow = false;
  }
}

const held = new Set<string>();
window.addEventListener('keydown', (e) => {
  held.add(e.key.toLowerCase());
  follow = false;
});
window.addEventListener('keyup', (e) => held.delete(e.key.toLowerCase()));

let press: { x: number; y: number; dragged: boolean } | null = null;
canvas.addEventListener('pointerdown', (e) => {
  press = { x: e.clientX, y: e.clientY, dragged: false };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!press) return;
  const dx = e.clientX - press.x;
  const dy = e.clientY - press.y;
  if (!press.dragged && Math.hypot(dx, dy) < 5) return;
  press.dragged = true;
  follow = false;
  view.scrollTo(view.camera.x - dx / scale, view.camera.y - dy / scale);
  press.x = e.clientX;
  press.y = e.clientY;
});
canvas.addEventListener('pointerup', (e) => {
  if (press && !press.dragged) {
    const rect = canvas.getBoundingClientRect();
    const point = view.toMap((e.clientX - rect.left) / scale, (e.clientY - rect.top) / scale);
    if (point) rideTo(point[0], point[1]);
  }
  press = null;
});

let lastTime = performance.now();
function frame(now: number) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  const dx = (held.has('arrowright') || held.has('d') ? 1 : 0) - (held.has('arrowleft') || held.has('a') ? 1 : 0);
  const dy = (held.has('arrowdown') || held.has('s') ? 1 : 0) - (held.has('arrowup') || held.has('w') ? 1 : 0);
  if (dx || dy) view.scrollTo(view.camera.x + dx * SCROLL_SPEED, view.camera.y + dy * SCROLL_SPEED);
  ride(dt);
  const tick = Math.floor(now / TICK_MS);
  const palette = paletteWords(tick);
  const indexed = view.compose(tick).data;
  for (let i = 0; i < indexed.length; i++) pixels[i] = palette[indexed[i]];
  context.putImageData(image, 0, 0);
  window.__ready = true;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
