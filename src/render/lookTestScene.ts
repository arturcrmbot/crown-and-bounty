import { AdventureScreen, type Placed } from './adventureScreen';
import { Bitmap, blit, SHADOW } from './bitmap';
import { BAR } from './frame';
import {
  CASTLE, CHEST, CRAGS, EXPLORED, forestAmount, GOLD_PILE, HERO, MAP_HEIGHT, MAP_WIDTH, MILL, MINE, PATHS, PATROL,
  ROCKS, SIGNPOST, TOWER, TREES, VILLAGE, type Point,
} from './lookTestMap';
import { bayer, hash } from './noise';
import { FOG_LUT, GOLD, INK, NEUTRAL, PARCHMENT, SILHOUETTE, STONE, WOOD } from './palette';
import {
  boulder, castle, chest, crag, goldPile, hero, hut, mill, mine, oak, patrol, pine, signpost, stoneBridge, watchtower, well,
} from './sprites';
import { distanceField, Ground, paintTerrain, smooth, type Terrain } from './terrain';
import { drawText } from './text';

const FRAMES = 8;
const animation = <T>(make: (t: number) => T) => Array.from({ length: FRAMES }, (_, i) => make(i / FRAMES));
const footY = (o: Placed) => o.y + o.sprite.height;

/** Landmarks under fog show only as flat dark shapes. */
function silhouette(sprite: Bitmap): Bitmap {
  const out = new Bitmap(sprite.width, sprite.height);
  for (let i = 0; i < sprite.data.length; i++) if (sprite.data[i] !== 0 && sprite.data[i] !== SHADOW) out.data[i] = SILHOUETTE;
  return out;
}

export function buildLookTest(): AdventureScreen {
  const terrain = paintTerrain();
  const W = MAP_WIDTH;
  const at = (x: number, y: number) => Math.round(y) * W + Math.round(x);
  const inside = (x: number, y: number) => x >= 4 && y >= 4 && x < W - 4 && y < MAP_HEIGHT - 4;
  const ground = (x: number, y: number) => (inside(x, y) ? terrain.ground[at(x, y)] : -1);
  const open = (x: number, y: number, pathGap: number, riverGap: number) =>
    inside(x, y) &&
    terrain.paths.d[at(x, y)] > pathGap &&
    terrain.river.d[at(x, y)] > riverGap &&
    [[0, 0], [-4, 0], [4, 0], [0, 3], [0, -3]].every(([dx, dy]) => ground(x + dx, y + dy) === Ground.Grass) &&
    ground(x, y + 8) !== Ground.Cliff &&
    ground(x, y - 8) !== Ground.Cliff;

  const scenery: Placed[] = [];
  const landmarks: Placed[] = [];
  const place = (sprite: Bitmap, [x, y]: Point, footFromTop: number): Placed => ({ sprite, x: x - sprite.width / 2, y: y - footFromTop });

  // Forest masses: packed trees wherever the authored forest shapes reach.
  const pines = Array.from({ length: 18 }, (_, i) => pine(500 + i, 13 + (i % 6) * 2));
  const oaks = Array.from({ length: 12 }, (_, i) => oak(700 + i, 12 + (i % 4) * 2));
  for (let gy = 0; gy < MAP_HEIGHT; gy += 5) {
    for (let gx = (gy / 5) % 2 === 0 ? 0 : 3.5; gx < W; gx += 7) {
      const x = gx + (hash(gx, gy, 1) - 0.5) * 5;
      const y = gy + (hash(gx, gy, 2) - 0.5) * 4;
      const f = forestAmount(x, y);
      if (f < 0.5 || hash(gx, gy, 3) > (f > 0.56 ? 0.95 : 0.55) || !open(x, y, 7, 22)) continue;
      const variants = hash(gx, gy, 4) < 0.75 ? pines : oaks;
      scenery.push(place(variants[Math.floor(hash(gx, gy, 5) * variants.length)], [x, y], variants[0].height - 5));
    }
  }
  TREES.forEach(([x, y, isPine], i) => {
    const sprite = isPine ? pine(300 + i, 22) : oak(320 + i, 22);
    scenery.push(place(sprite, [x, y], sprite.height - 5));
  });
  ROCKS.forEach(([x, y, size], i) => scenery.push(place(boulder(260 + i, size), [x, y], Math.ceil(size * 0.8) + 2)));
  CRAGS.forEach(([x, y, w, h], i) => scenery.push(place(crag(w, h, 40 + i), [x, y], h)));

  landmarks.push(place(watchtower(0.2), TOWER, 74));
  landmarks.push(place(mine(), MINE, 44));
  VILLAGE.huts.forEach((p, i) => landmarks.push(place(hut(i + 3), p, 28)));
  landmarks.push(place(well(), VILLAGE.well, 23));
  landmarks.push(place(signpost(), SIGNPOST, 23));
  landmarks.push(place(chest(), CHEST, 13));
  landmarks.push(place(goldPile(), GOLD_PILE, 12));
  const crossing = smooth(PATHS[0]).reduce((best, p) => (terrain.river.d[at(p[0], p[1])] < terrain.river.d[at(best[0], best[1])] ? p : best));
  landmarks.push(place(stoneBridge(46), crossing, 12));

  const view = new AdventureScreen(terrain.bitmap);
  bakeWithFog(terrain, scenery, landmarks);

  const castleFrames = animation((t) => castle(t * Math.PI * 2));
  view.animate({ ...place(castleFrames[0], CASTLE, 104), frames: castleFrames });
  const millFrames = animation((t) => mill(t / 8));
  view.animate({ ...place(millFrames[0], MILL, 44), frames: millFrames });
  const patrolFrames = animation((t) => patrol(t * Math.PI * 2));
  view.animate({ ...place(patrolFrames[0], PATROL, 40), frames: patrolFrames });
  const heroFrames = animation((t) => hero(t * Math.PI * 2));
  view.animate({ ...place(heroFrames[0], HERO, 57), frames: heroFrames });
  view.centreOn(HERO[0] + 40, HERO[1] - 70);

  paintBar(view);
  return view;
}

/**
 * Bakes everything into the explored map and into a roadless copy where landmarks are silhouettes,
 * then fogs the land the hero hasn't seen: dithered edge, darker, desaturated, no roads.
 */
function bakeWithFog(terrain: Terrain, scenery: Placed[], landmarks: Placed[]) {
  const all = [...scenery, ...landmarks].sort((a, b) => footY(a) - footY(b));
  const isLandmark = new Set(landmarks);
  for (const o of all) {
    blit(terrain.bitmap, o.sprite, Math.round(o.x), Math.round(o.y));
    blit(terrain.wild, isLandmark.has(o) ? silhouette(o.sprite) : o.sprite, Math.round(o.x), Math.round(o.y));
  }
  const trails = distanceField(EXPLORED.trails.map((t) => smooth(t)), EXPLORED.trailRadius + 40);
  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      const i = y * MAP_WIDTH + x;
      let reach = trails.d[i] - EXPLORED.trailRadius;
      for (const [cx, cy, r] of EXPLORED.discs) reach = Math.min(reach, Math.hypot(x - cx, y - cy) - r);
      const fog = Math.min(1, Math.max(0, (reach + 12) / 30));
      if (fog > bayer(x, y)) terrain.bitmap.data[i] = FOG_LUT[terrain.wild.data[i]];
    }
  }
}

function icon(rows: string[], colours: Record<string, number>): Bitmap {
  const sprite = new Bitmap(rows[0].length, rows.length);
  rows.forEach((row, y) => [...row].forEach((ch, x) => colours[ch] && sprite.set(x, y, colours[ch])));
  return sprite;
}

const COIN = icon(
  ['..oooo..', '.oyyYYo.', 'oyyyyYYo', 'oyddyyYo', 'oydyyyyo', 'oyyyyydo', '.oyyddo.', '..oooo..'],
  { o: INK, y: GOLD[4], Y: GOLD[6], d: GOLD[2] },
);
const SWORD = icon(
  ['.......ss', '......sWs', '.....sWs.', '....sWs..', '.g.sWs...', '..gWs....', '..bg.....', '.b..g....', 'o........'],
  { s: INK, W: STONE[6], g: GOLD[4], b: WOOD[3], o: GOLD[5] },
);
const BOW = icon(
  ['..bb.....', '.b..w....', 'b....w...', 'b..aaaaaT', 'b....w...', '.b..w....', '..bb.....'],
  { b: WOOD[4], w: NEUTRAL[6], a: WOOD[2], T: STONE[6] },
);

function paintBar(view: AdventureScreen) {
  const { frame } = view;
  const y = BAR.y + 5;
  const mid = BAR.y + BAR.height / 2;
  let x = BAR.x + 14;
  const item = (sprite: Bitmap, text: string) => {
    blit(frame, sprite, x, Math.round(mid - sprite.height / 2));
    x += sprite.width + 6;
    x += drawText(frame, text, x, y, PARCHMENT[6], INK) + 30;
  };
  item(COIN, '1,250');
  item(SWORD, '12');
  item(BOW, '25');
  drawText(frame, 'BOUNTY:  BARON GRIMSBY', BAR.x + 560, y, GOLD[5], INK);
  drawText(frame, 'DAY  III', BAR.x + BAR.width - 84, y, PARCHMENT[6], INK);
}
