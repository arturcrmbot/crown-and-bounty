import { SCREEN, MAP_VIEW } from './render/frame';
import { HOURGLASS, HOURGLASS_AT, paintHud } from './render/hud';
import type { Point } from './render/lookTestMap';
import { buildLookTest, CELL } from './render/lookTestScene';
import { paletteWords } from './render/palette';
import { act, describe, describeHero, locationById, spendMovement, visit, type Action, type Card, type GameState } from './rules/game';
import { findPath, nearestPassable } from './rules/pathfinding';
import { newGame, PLACES } from './rules/scenario';
import { CardView } from './ui/card';

declare global {
  interface Window {
    /** Set once the first frame is on screen. Used by the screenshot script. */
    __ready?: boolean;
    /** Test hooks for scripted play. */
    __kc?: {
      click(x: number, y: number): void;
      choose(label: string): boolean;
      state(): GameState;
      idle(): boolean;
      status(): { riding: boolean; visiting: string | null; movement: number };
      centre(id: string): Point;
    };
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

let state = newGame();
const { view, grid, hero, hitboxes, pickups } = buildLookTest();
paintHud(view.frame, state);
const query = new URLSearchParams(window.location.search);
if (query.has('x')) view.centreOn(Number(query.get('x')), Number(query.get('y') ?? 480));
/** `?speed=4` rides four times faster, for scripted play-throughs. */
const speed = RIDE_SPEED * Math.max(1, Number(query.get('speed') ?? 1));

// Crows over the old watchtower (the card says something disturbed them) and rooks in the north-east wood.
view.effects.addFlock([PLACES.tower[0], PLACES.tower[1] - 84], 6, 1);
view.effects.addFlock([1010, 90], 5, 4);

const width = hero.idle[0].width;
let sinceDust = 0;
const position = { x: hero.object.x + width / 2, y: hero.object.y + hero.foot };
let route: Point[] = [];
let visiting: string | null = null;
let facing = 1;
let travelled = 0;
let sinceReveal = 0;
let follow = false;
let tiredShown = false;
let hudMovement = Math.floor(state.movement);

const PICKUP_IDS = new Set(pickups.keys());
const cards = new CardView(choose);
/** Map point the open card hangs above, or null to centre it on the map. */
let cardAnchor: Point | null = null;

function showCard(card: Card, anchor: Point | null) {
  cardAnchor = anchor;
  cards.show(card);
  if (card.reveal) view.reveal(card.reveal[0], card.reveal[1], 90);
}

function setState(next: GameState) {
  state = next;
  for (const [id, object] of pickups) {
    if (locationById(state, id).done) {
      view.remove(object);
      pickups.delete(id);
    }
  }
  hudMovement = Math.floor(state.movement);
  paintHud(view.frame, state);
}

function choose(action: Action) {
  if (action.type === 'close') {
    cards.hide();
    return;
  }
  if (action.type === 'restart') {
    window.location.reload();
    return;
  }
  if (action.type === 'go') {
    cards.hide();
    const place = locationById(state, action.id);
    plan(place.at, action.id);
    return;
  }
  const result = act(state, action);
  if (!result) {
    cards.hide();
    return;
  }
  const newDay = result.state.day !== state.day;
  setState(result.state);
  if (newDay) tiredShown = false;
  showCard(result.card, newDay ? null : cardAnchor);
}

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

const cellOf = (x: number, y: number) => ({ x: Math.floor(x / CELL), y: Math.floor(y / CELL) });
/** Movement points per map pixel at a spot: roads cost half as much as grass. */
function costPerPixel(x: number, y: number) {
  const c = cellOf(x, y);
  const cost = grid.cost[c.y * grid.width + c.x];
  return (Number.isFinite(cost) ? cost : 2) / CELL;
}

/** Plots a route to `target`. With `visitId`, the hero visits that place when he gets there. */
function plan(target: Point, visitId: string | null) {
  const start = nearestPassable(grid, cellOf(position.x, position.y));
  const goal = nearestPassable(grid, cellOf(target[0], target[1]), 16);
  const cells = start && goal ? findPath(grid, start, goal) : null;
  if (!cells) {
    showCard({ title: 'No way through', lines: ['Not even a goat could get there from here.'], choices: [] }, target);
    return;
  }
  route = curve(cells.map((c) => [c.x * CELL + CELL / 2, c.y * CELL + CELL / 2] as Point)).slice(1);
  visiting = visitId;
  follow = true;
  tiredShown = false;
  if (route.length === 0 && visiting) arrive();
}

function arrive() {
  const id = visiting!;
  visiting = null;
  const result = visit(state, id);
  setState(result.state);
  showCard(result.card, anchorOf(id));
}

function anchorOf(id: string): Point {
  const box = hitboxes.find((b) => b.id === id)!;
  return [(box.x0 + box.x1) / 2, box.y0 + 4];
}

/** Dots every 10 pixels along the road ahead, gold while today's movement lasts. */
function routeDots() {
  const dots: { at: Point; today: boolean }[] = [];
  let last: Point = [position.x, position.y];
  let carry = -14;
  let spent = 0;
  for (const p of route) {
    const d = Math.hypot(p[0] - last[0], p[1] - last[1]);
    spent += d * costPerPixel(p[0], p[1]);
    for (let t = 10 - carry; t <= d; t += 10) {
      const k = t / d;
      dots.push({ at: [Math.round(last[0] + (p[0] - last[0]) * k), Math.round(last[1] + (p[1] - last[1]) * k)], today: spent <= state.movement });
    }
    carry = (carry + d) % 10;
    last = p;
  }
  return dots;
}

function ride(dt: number) {
  let budget = speed * dt;
  while (budget > 0 && route.length > 0 && state.movement > 0) {
    const [tx, ty] = route[0];
    const dx = tx - position.x;
    const dy = ty - position.y;
    const d = Math.hypot(dx, dy);
    if (Math.abs(dx) > 0.3) facing = dx > 0 ? 1 : -1;
    const perPixel = costPerPixel(position.x, position.y);
    const move = Math.min(d, budget, state.movement / perPixel);
    if (d > 0) {
      position.x += (dx / d) * move;
      position.y += (dy / d) * move;
    }
    if (move >= d - 1e-6) route.shift();
    state = spendMovement(state, move * perPixel);
    budget -= move;
    travelled += move;
    sinceReveal += move;
    sinceDust += move;
    if (sinceDust > 7 && perPixel * CELL <= 1) {
      sinceDust = 0;
      view.effects.dust(position.x - facing * 12, position.y - 1, facing);
    }
    if (move <= 0) break;
  }
  if (sinceReveal > 6) {
    view.reveal(position.x, position.y, REVEAL_RADIUS);
    sinceReveal = 0;
  }
  if (Math.floor(state.movement) !== hudMovement) {
    hudMovement = Math.floor(state.movement);
    paintHud(view.frame, state);
  }
  const walking = route.length > 0 && state.movement > 0;
  if (route.length === 0 && visiting) arrive();
  if (route.length > 0 && state.movement <= 0 && !tiredShown) {
    tiredShown = true;
    showCard({ title: 'Your horse is spent', lines: ['End the day to rest. Red marks are for tomorrow.'], choices: [{ label: 'End the day', action: { type: 'endDay' } }] }, [position.x, position.y - hero.foot]);
  }
  hero.object.frames = walking ? (facing > 0 ? hero.walk : hero.walkLeft) : facing > 0 ? hero.idle : hero.idleLeft;
  hero.object.frame = walking ? Math.floor(travelled / STRIDE) : undefined;
  hero.object.x = position.x - width / 2;
  hero.object.y = position.y - hero.foot;
  view.route = route.length > 0 ? routeDots() : [];
  if (follow) {
    const tx = position.x - MAP_VIEW.width / 2;
    const ty = position.y - MAP_VIEW.height / 2 - 20;
    const k = Math.min(1, dt * 2.5);
    view.scrollTo(view.camera.x + (tx - view.camera.x) * k, view.camera.y + (ty - view.camera.y) * k);
    if (!walking && Math.hypot(tx - view.camera.x, ty - view.camera.y) < 2) follow = false;
  }
}

/** A click on the map: the hero, a place, or open ground to ride to. */
function clickMap([x, y]: Point) {
  if (state.over) return;
  const h = hero.object;
  if (x >= h.x + 6 && x < h.x + width - 6 && y >= h.y + 4 && y < h.y + hero.foot + 4) {
    showCard(describeHero(state), [position.x, h.y + 6]);
    return;
  }
  const gone = (id: string) => PICKUP_IDS.has(id) && !pickups.has(id);
  const hits = hitboxes.filter((b) => x >= b.x0 && x < b.x1 && y >= b.y0 && y < b.y1 && !gone(b.id));
  if (hits.length > 0) {
    const box = hits.reduce((front, b) => (b.y1 > front.y1 ? b : front));
    if (view.isFogged((box.x0 + box.x1) / 2, box.y1 - 4)) {
      showCard(
        { title: 'Unexplored', lines: ['You cannot see what lies there.'], choices: [{ label: 'Ride there', action: { type: 'go', id: box.id } }, { label: 'Close', action: { type: 'close' } }] },
        anchorOf(box.id),
      );
    } else {
      showCard(describe(state, box.id), anchorOf(box.id));
    }
    return;
  }
  cards.hide();
  plan([x, y], null);
}

const held = new Set<string>();
window.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  if (key === 'e') choose({ type: 'endDay' });
  else if (key === 'escape') cards.hide();
  held.add(key);
  if (key.startsWith('arrow') || 'wasd'.includes(key)) follow = false;
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
    const sx = (e.clientX - rect.left) / scale;
    const sy = (e.clientY - rect.top) / scale;
    const onHourglass = sx >= HOURGLASS_AT.x - 3 && sx < HOURGLASS_AT.x + HOURGLASS.width + 3 && sy >= HOURGLASS_AT.y - 3 && sy < HOURGLASS_AT.y + HOURGLASS.height + 3;
    if (onHourglass) choose({ type: 'endDay' });
    else {
      const point = view.toMap(sx, sy);
      if (point) clickMap(point);
    }
  }
  press = null;
});

window.__kc = {
  click: (x, y) => clickMap([x, y]),
  choose(label) {
    const button = [...document.querySelectorAll<HTMLButtonElement>('.kc-card button')].find((b) => b.textContent?.startsWith(label));
    button?.click();
    return Boolean(button);
  },
  state: () => state,
  idle: () => route.length === 0 || state.movement <= 0,
  status: () => ({ riding: route.length > 0, visiting, movement: state.movement }),
  centre(id) {
    const box = hitboxes.find((b) => b.id === id)!;
    return [(box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2 + 6];
  },
};

showCard(
  {
    title: 'The King\u2019s Commission',
    lines: [
      'Baron Grimsby owes the Crown three years of taxes and one goose. Bring him in.',
      'Click the map to ride, and click anything that looks interesting. Red marks on your route are for tomorrow.',
      'The hourglass (or **E**) ends the day. Every seventh day is payday.',
    ],
    choices: [{ label: 'Ride out', action: { type: 'close' } }],
  },
  null,
);

let lastTime = performance.now();
function frame(now: number) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  const dx = (held.has('arrowright') || held.has('d') ? 1 : 0) - (held.has('arrowleft') || held.has('a') ? 1 : 0);
  const dy = (held.has('arrowdown') || held.has('s') ? 1 : 0) - (held.has('arrowup') || held.has('w') ? 1 : 0);
  if (dx || dy) view.scrollTo(view.camera.x + dx * SCROLL_SPEED, view.camera.y + dy * SCROLL_SPEED);
  ride(dt);
  view.effects.update(dt, [position.x, position.y]);
  const tick = Math.floor(now / TICK_MS);
  const palette = paletteWords(tick);
  const indexed = view.compose(tick).data;
  for (let i = 0; i < indexed.length; i++) pixels[i] = palette[indexed[i]];
  context.putImageData(image, 0, 0);
  const rect = canvas.getBoundingClientRect();
  const anchor = cardAnchor ?? [view.camera.x + MAP_VIEW.width / 2, view.camera.y + MAP_VIEW.height / 2 + 60];
  cards.place({ x: rect.left + (MAP_VIEW.x + anchor[0] - view.camera.x) * scale, y: rect.top + (MAP_VIEW.y + anchor[1] - view.camera.y) * scale });
  window.__ready = true;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
