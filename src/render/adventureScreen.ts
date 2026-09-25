import { Bitmap, blit } from './bitmap';
import { MAP_VIEW, MINIMAP, paintFrame, SCREEN } from './frame';
import { MAP_PX, RIVER, ROAD } from './lookTestMap';
import { DIRT, GRASS, SAND, WATER } from './palette';
import { Ground, paintTerrain, type Terrain } from './terrain';

/** `frames` animate the object (waving flags); `sprite` is the first frame. */
export type Placed = { sprite: Bitmap; frames?: Bitmap[]; x: number; y: number; minimap?: number };

const GROUND_COLOURS = [GRASS[4], WATER[5], SAND[3], DIRT[5]];

/** The HoMM2-style adventure screen: static frame, painted terrain and y-sorted objects. */
export class AdventureScreen {
  readonly screen = new Bitmap(SCREEN.width, SCREEN.height);
  private readonly frame = new Bitmap(SCREEN.width, SCREEN.height);
  private readonly terrain: Terrain;
  private readonly objects: Placed[] = [];

  constructor() {
    this.terrain = paintTerrain(RIVER, ROAD);
    paintFrame(this.frame);
    this.paintMinimap();
  }

  /** `x` and `y` are the sprite's top-left in map pixels. */
  add(object: Placed) {
    this.objects.push(object);
    this.objects.sort((a, b) => a.y + a.sprite.height - (b.y + b.sprite.height));
    this.paintMinimap();
  }

  private paintMinimap() {
    const scale = MAP_PX / MINIMAP.width;
    for (let y = 0; y < MINIMAP.height; y++) {
      for (let x = 0; x < MINIMAP.width; x++) {
        const mx = Math.floor((x + 0.5) * scale);
        const my = Math.floor((y + 0.5) * scale);
        this.frame.set(MINIMAP.x + x, MINIMAP.y + y, GROUND_COLOURS[this.terrain.ground[my * MAP_PX + mx]]);
      }
    }
    for (const { sprite, x, y, minimap } of this.objects) {
      if (minimap === undefined) continue;
      const x0 = Math.floor(x / scale);
      const y0 = Math.floor((y + sprite.height * 0.45) / scale);
      const x1 = Math.ceil((x + sprite.width) / scale);
      const y1 = Math.ceil((y + sprite.height) / scale);
      for (let j = y0; j < y1; j++) {
        for (let i = x0; i < x1; i++) {
          const sx = Math.floor(i * scale - x);
          const sy = Math.floor(j * scale - y);
          const v = sprite.get(sx, sy);
          if (v !== 0 && v !== 255 && i >= 0 && j >= 0 && i < MINIMAP.width && j < MINIMAP.height) {
            this.frame.set(MINIMAP.x + i, MINIMAP.y + j, minimap);
          }
        }
      }
    }
  }

  compose(tick: number): Bitmap {
    const { screen } = this;
    screen.data.set(this.frame.data);
    const map = this.terrain.bitmap.data;
    for (let y = 0; y < MAP_PX; y++) {
      screen.data.set(map.subarray(y * MAP_PX, (y + 1) * MAP_PX), (MAP_VIEW.y + y) * SCREEN.width + MAP_VIEW.x);
    }
    for (const { sprite, frames, x, y } of this.objects) {
      const image = frames ? frames[tick % frames.length] : sprite;
      blit(screen, image, MAP_VIEW.x + Math.round(x), MAP_VIEW.y + Math.round(y), MAP_VIEW);
    }
    return screen;
  }

  groundAt(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= MAP_PX || y >= MAP_PX) return Ground.Water;
    return this.terrain.ground[Math.floor(y) * MAP_PX + Math.floor(x)];
  }
}
