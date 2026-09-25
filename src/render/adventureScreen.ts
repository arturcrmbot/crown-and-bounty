import { Bitmap, blit } from './bitmap';
import { Effects } from './effects';
import { MAP_VIEW, paintFrame, SCREEN } from './frame';
import type { Point } from '../rules/map/geometry';
import type { FogMask } from './fog';
import { hash, noise } from './noise';
import { FOG_LUT, GOLD, GRAIN_LUT, INK, RED } from './palette';

/**
 * `x` and `y` are the sprite's top-left in map pixels. `frames` animate it (flags, wheels);
 * `frame` pins the frame instead of following the clock (a walking hero steps with distance).
 */
export type Placed = { sprite: Bitmap; frames?: Bitmap[]; frame?: number; x: number; y: number };

const footY = (o: Placed) => o.y + o.sprite.height;

/**
 * The adventure screen. Static objects are baked into the map once, and only animated ones are
 * drawn each frame. Fogged pixels show the roadless `wild` map through the fog colour table.
 */
export class AdventureScreen {
  readonly screen = new Bitmap(SCREEN.width, SCREEN.height);
  readonly frame: Bitmap;
  private readonly overlay: Bitmap;
  private readonly grain: Uint32Array;
  private readonly animated: Placed[] = [];
  readonly camera = { x: 0, y: 0 };
  readonly effects = new Effects();
  /** The route still ahead of the hero: gold dots for today, red for later days. */
  route: { at: Point; today: boolean }[] = [];
  private readonly map: Bitmap;
  private readonly wild: Bitmap;
  private readonly fog: FogMask;

  constructor(map: Bitmap, wild: Bitmap, fog: FogMask) {
    const { frame, overlay } = paintFrame();
    this.frame = frame;
    this.overlay = overlay;
    this.map = map;
    this.wild = wild;
    this.fog = fog;
    const specks: number[] = [];
    for (let y = MAP_VIEW.y; y < MAP_VIEW.y + MAP_VIEW.height; y++) {
      for (let x = MAP_VIEW.x; x < MAP_VIEW.x + MAP_VIEW.width; x++) {
        if (hash(x, y, 201) < 0.035 + noise(x / 26, y / 26, 202) * 0.07) specks.push(y * SCREEN.width + x);
      }
    }
    this.grain = Uint32Array.from(specks);
  }

  animate(object: Placed) {
    this.animated.push(object);
  }

  remove(object: Placed) {
    const i = this.animated.indexOf(object);
    if (i >= 0) this.animated.splice(i, 1);
  }

  isFogged(x: number, y: number) {
    return this.fog.isFogged(x, y);
  }

  scrollTo(x: number, y: number) {
    this.camera.x = Math.max(0, Math.min(this.map.width - MAP_VIEW.width, x));
    this.camera.y = Math.max(0, Math.min(this.map.height - MAP_VIEW.height, y));
  }

  centreOn(x: number, y: number) {
    this.scrollTo(x - MAP_VIEW.width / 2, y - MAP_VIEW.height / 2);
  }

  /** Map coordinates under a point of the screen, or null outside the map view. */
  toMap(screenX: number, screenY: number): Point | null {
    const x = screenX - MAP_VIEW.x;
    const y = screenY - MAP_VIEW.y;
    if (x < 0 || y < 0 || x >= MAP_VIEW.width || y >= MAP_VIEW.height) return null;
    return [x + Math.round(this.camera.x), y + Math.round(this.camera.y)];
  }

  compose(tick: number): Bitmap {
    const { screen } = this;
    const fog = this.fog.mask;
    const MAP_WIDTH = this.map.width;
    const map = this.map.data;
    const wild = this.wild.data;
    screen.data.set(this.frame.data);
    const cx = Math.round(this.camera.x);
    const cy = Math.round(this.camera.y);
    for (let y = 0; y < MAP_VIEW.height; y++) {
      const row = (cy + y) * MAP_WIDTH + cx;
      let o = (MAP_VIEW.y + y) * SCREEN.width + MAP_VIEW.x;
      for (let x = 0; x < MAP_VIEW.width; x++, o++) {
        const i = row + x;
        screen.data[o] = fog[i] ? FOG_LUT[wild[i]] : map[i];
      }
    }
    for (const { at: [x, y], today } of this.route) {
      const sx = MAP_VIEW.x + x - cx;
      const sy = MAP_VIEW.y + y - cy;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) this.dot(sx + i, sy + j, i === 0 && j === 0 ? (today ? GOLD[6] : RED[4]) : INK);
    }
    this.animated.sort((a, b) => footY(a) - footY(b));
    for (const o of this.animated) {
      if (this.isFogged(o.x + o.sprite.width / 2, footY(o) - 2)) continue;
      const image = o.frames ? o.frames[(o.frame ?? tick) % o.frames.length] : o.sprite;
      blit(screen, image, MAP_VIEW.x + Math.round(o.x) - cx, MAP_VIEW.y + Math.round(o.y) - cy, MAP_VIEW);
    }
    this.effects.draw(screen, MAP_VIEW.x - cx, MAP_VIEW.y - cy, MAP_VIEW, (x, y) => !this.isFogged(x, y));
    for (const i of this.grain) screen.data[i] = GRAIN_LUT[screen.data[i]];
    blit(screen, this.overlay, 0, 0);
    return screen;
  }

  private dot(x: number, y: number, color: number) {
    if (x >= MAP_VIEW.x && y >= MAP_VIEW.y && x < MAP_VIEW.x + MAP_VIEW.width && y < MAP_VIEW.y + MAP_VIEW.height) this.screen.set(x, y, color);
  }
}
