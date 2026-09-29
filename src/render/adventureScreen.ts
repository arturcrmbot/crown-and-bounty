import { Bitmap, blit } from './bitmap';
import { Effects } from './effects';
import { BAR_DIVIDERS, MAP_VIEW as VIEW, paintFrame, SCREEN } from './frame';
import type { Point } from '../rules/map/geometry';
import type { FogMask } from './fog';
import type { MapTiles } from './mapTiles';
import { bayer, hash, noise } from './noise';
import { FOG_LUT, GRAIN_LUT, SHADOW_LUT } from './palette';
import { drawRoute, type RouteMark } from './route';
import { TILE } from './terrain';
import { CLEAR, type Sky, type Weather } from './weather';

/**
 * `x` and `y` are the sprite's top-left in map pixels. `frames` animate it (flags, wheels);
 * `frame` pins the frame instead of following the clock (a walking hero steps with distance).
 * `hidden` keeps it off the map for now: a band out of the hero's sight.
 */
export type Placed = { sprite: Bitmap; frames?: Bitmap[]; frame?: number; x: number; y: number; hidden?: boolean };

const footY = (o: Placed) => o.y + o.sprite.height;

/**
 * The adventure screen: the map's view, with the minimap over its top right corner (see `minimap.ts`).
 * Static objects are baked into the map's tiles as they're painted, and only animated ones are drawn
 * each frame. Fogged pixels show the roadless `wild` map through the fog colour table.
 */
export class AdventureScreen {
  readonly screen = new Bitmap(SCREEN.width, SCREEN.height);
  readonly frame: Bitmap;
  private readonly overlay: Bitmap;
  private readonly grain: Uint32Array;
  /** For each pixel of the screen, the fog's colour there plus one, or 0 where the land is known: see `Weather.light`. */
  private readonly veil = new Uint16Array(SCREEN.width * SCREEN.height);
  private readonly animated: Placed[] = [];
  readonly camera = { x: 0, y: 0 };
  readonly effects = new Effects();
  /** How far night has fallen over the map, 0 to 1, while a day ends. */
  dusk = 0;
  /** The light of the day and the weather (see `weather.ts`), and what draws them. */
  sky: Sky = CLEAR;
  weather: Weather | null = null;
  /** The route still ahead of the hero: gold dots for today, red for later days. */
  route: RouteMark[] = [];
  /** Where the hero will make camp when the gold part of a route runs out. */
  camp: Point | null = null;
  readonly tiles: MapTiles;
  private readonly fog: FogMask;

  constructor(tiles: MapTiles, fog: FogMask) {
    const { frame, overlay } = paintFrame(BAR_DIVIDERS, VIEW);
    this.frame = frame;
    this.overlay = overlay;
    this.tiles = tiles;
    this.fog = fog;
    const specks: number[] = [];
    for (let y = VIEW.y; y < VIEW.y + VIEW.height; y++) {
      for (let x = VIEW.x; x < VIEW.x + VIEW.width; x++) {
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
    this.camera.x = Math.max(0, Math.min(this.tiles.width - VIEW.width, x));
    this.camera.y = Math.max(0, Math.min(this.tiles.height - VIEW.height, y));
  }

  /** Paints a tile of the land not yet seen, nearest the view first, while nothing much is happening. */
  warm() {
    return this.tiles.warm(this.camera.x + VIEW.width / 2, this.camera.y + VIEW.height / 2);
  }

  centreOn(x: number, y: number) {
    this.scrollTo(x - VIEW.width / 2, y - VIEW.height / 2);
  }

  /** Map coordinates under a point of the screen, or null outside the map view. */
  toMap(screenX: number, screenY: number): Point | null {
    const x = screenX - VIEW.x;
    const y = screenY - VIEW.y;
    if (x < 0 || y < 0 || x >= VIEW.width || y >= VIEW.height) return null;
    return [x + Math.round(this.camera.x), y + Math.round(this.camera.y)];
  }

  compose(tick: number): Bitmap {
    const { screen, veil } = this;
    const fog = this.fog.mask;
    const MAP_WIDTH = this.tiles.width;
    screen.data.set(this.frame.data);
    const cx = Math.round(this.camera.x);
    const cy = Math.round(this.camera.y);
    // The view, tile by tile: each tile's part of it, through the fog.
    for (let ty = Math.floor(cy / TILE); ty * TILE < cy + VIEW.height && ty < this.tiles.rows; ty++) {
      for (let tx = Math.floor(cx / TILE); tx * TILE < cx + VIEW.width && tx < this.tiles.cols; tx++) {
        const tile = this.tiles.tile(tx, ty);
        const map = tile.bitmap.data;
        const wild = tile.wild.data;
        const w = tile.bitmap.width;
        const x0 = Math.max(cx, tile.x);
        const x1 = Math.min(cx + VIEW.width, tile.x + w);
        const y0 = Math.max(cy, tile.y);
        const y1 = Math.min(cy + VIEW.height, tile.y + tile.bitmap.height);
        for (let y = y0; y < y1; y++) {
          let o = (VIEW.y + y - cy) * SCREEN.width + VIEW.x + x0 - cx;
          let i = (y - tile.y) * w + x0 - tile.x;
          let f = y * MAP_WIDTH + x0;
          for (let x = x0; x < x1; x++, o++, i++, f++) {
            if (fog[f]) {
              const c = FOG_LUT[wild[i]];
              screen.data[o] = c;
              veil[o] = c + 1;
            } else {
              screen.data[o] = map[i];
              veil[o] = 0;
            }
          }
        }
      }
    }
    drawRoute(screen, VIEW, VIEW.x - cx, VIEW.y - cy, this.route, this.camp);
    this.animated.sort((a, b) => footY(a) - footY(b));
    for (const o of this.animated) {
      if (o.hidden || this.isFogged(o.x + o.sprite.width / 2, footY(o) - 2)) continue;
      const image = o.frames ? o.frames[(o.frame ?? tick) % o.frames.length] : o.sprite;
      blit(screen, image, VIEW.x + Math.round(o.x) - cx, VIEW.y + Math.round(o.y) - cy, VIEW);
    }
    const seen = (x: number, y: number) => !this.isFogged(x, y);
    this.weather?.drawSmoke(screen, VIEW.x - cx, VIEW.y - cy, VIEW, this.sky, seen);
    this.effects.draw(screen, VIEW.x - cx, VIEW.y - cy, VIEW, seen);
    this.weather?.light(screen, this.sky, this.camera, VIEW, veil);
    this.weather?.drawAir(screen, VIEW.x - cx, VIEW.y - cy, VIEW, this.sky, seen);
    this.effects.drawWords(screen, VIEW.x - cx, VIEW.y - cy, VIEW);
    for (const i of this.grain) screen.data[i] = GRAIN_LUT[screen.data[i]];
    if (this.dusk > 0) {
      // Night falls over the map, and lifts again, in a dither of shadow.
      for (let y = VIEW.y; y < VIEW.y + VIEW.height; y++) {
        for (let x = VIEW.x; x < VIEW.x + VIEW.width; x++) {
          const d = bayer(x, y);
          if (d >= this.dusk) continue;
          const o = y * SCREEN.width + x;
          screen.data[o] = d < this.dusk - 0.45 ? SHADOW_LUT[SHADOW_LUT[screen.data[o]]] : SHADOW_LUT[screen.data[o]];
        }
      }
    }
    blit(screen, this.overlay, 0, 0);
    return screen;
  }
}
