import { blit, type Bitmap } from './bitmap';
import { TILE, type TerrainPainter, type TerrainTile } from './terrain';

/** Something painted onto the land for good: a tree, a crag, a building. `wild` is how it shows under the fog. */
export type Fixture = { sprite: Bitmap; wild: Bitmap; x: number; y: number };

/**
 * The land as painted tiles, with everything that never moves painted into them. Each tile is painted
 * the first time it comes into view, and the rest a tile at a time while nothing much is happening,
 * so a big province opens at once and scrolls without a stutter.
 */
export class MapTiles {
  readonly width: number;
  readonly height: number;
  readonly cols: number;
  readonly rows: number;
  private readonly painter: TerrainPainter;
  private readonly tiles: (TerrainTile | null)[];
  /** What stands on each tile, in the order it's drawn: back to front. */
  private readonly fixtures: Fixture[][];
  private left: number;

  /** `fixtures` come in drawing order, back to front. */
  constructor(painter: TerrainPainter, fixtures: readonly Fixture[]) {
    this.painter = painter;
    this.width = painter.width;
    this.height = painter.height;
    this.cols = Math.ceil(this.width / TILE);
    this.rows = Math.ceil(this.height / TILE);
    this.tiles = new Array(this.cols * this.rows).fill(null);
    this.left = this.tiles.length;
    this.fixtures = Array.from({ length: this.tiles.length }, () => []);
    for (const f of fixtures) {
      const tx0 = Math.max(0, Math.floor(f.x / TILE));
      const tx1 = Math.min(this.cols - 1, Math.floor((f.x + f.sprite.width - 1) / TILE));
      const ty0 = Math.max(0, Math.floor(f.y / TILE));
      const ty1 = Math.min(this.rows - 1, Math.floor((f.y + f.sprite.height - 1) / TILE));
      for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) this.fixtures[ty * this.cols + tx].push(f);
    }
  }

  /** The tile at (tx, ty), counted in tiles, painted now if it hasn't been. */
  tile(tx: number, ty: number): TerrainTile {
    const i = ty * this.cols + tx;
    let tile = this.tiles[i];
    if (!tile) {
      tile = this.painter.paint(tx, ty);
      for (const f of this.fixtures[i]) {
        blit(tile.bitmap, f.sprite, f.x - tile.x, f.y - tile.y);
        blit(tile.wild, f.wild, f.x - tile.x, f.y - tile.y);
      }
      this.fixtures[i] = [];
      this.tiles[i] = tile;
      this.left--;
    }
    return tile;
  }

  /** Paints the unpainted tile nearest the map point (x, y), if any is left. Returns whether it did. */
  warm(x: number, y: number): boolean {
    if (this.left === 0) return false;
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < this.tiles.length; i++) {
      if (this.tiles[i]) continue;
      const d = Math.hypot(((i % this.cols) + 0.5) * TILE - x, (Math.floor(i / this.cols) + 0.5) * TILE - y);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    this.tile(best % this.cols, Math.floor(best / this.cols));
    return true;
  }
}
