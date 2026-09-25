import { AdventureScreen, type Placed } from './adventureScreen';
import { blit } from './bitmap';
import { BAR } from './frame';
import { CASTLE, CHEST, forestAmount, GOLD_PILE, HERO, HUTS, MAP_HEIGHT, MAP_WIDTH, MILL, PATHS, TOWER, type Point } from './lookTestMap';
import { hash, rng } from './noise';
import { GOLD, INK, NEUTRAL, PARCHMENT } from './palette';
import { boulder, castle, chest, goldPile, hero, hut, mill, mountain, oak, pine, stoneBridge, watchtower } from './sprites';
import { Ground, paintTerrain, smooth } from './terrain';
import { drawText } from './text';

const FRAMES = 8;
const animation = <T>(make: (t: number) => T) => Array.from({ length: FRAMES }, (_, i) => make(i / FRAMES));

/** Grey crags: around the watchtower's knoll, along the cliff top and in the eastern woods. */
const CRAGS: [number, number, number, number][] = [
  [238, 262, 58, 40], [340, 258, 50, 34], [262, 300, 44, 28], [196, 214, 40, 30],
  [676, 440, 52, 34], [742, 432, 40, 28], [918, 424, 48, 32],
  [1190, 430, 70, 50], [1232, 560, 60, 44], [1150, 690, 54, 38], [1236, 330, 56, 40],
  [120, 120, 64, 44], [70, 560, 50, 36], [560, 250, 46, 30],
];

export function buildLookTest(): AdventureScreen {
  const terrain = paintTerrain();
  const view = new AdventureScreen(terrain.bitmap);
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

  const statics: Placed[] = [];
  const pines = Array.from({ length: 18 }, (_, i) => pine(500 + i, 12 + (i % 6) * 2));
  const oaks = Array.from({ length: 12 }, (_, i) => oak(700 + i, 11 + (i % 4) * 2));

  for (let gy = 0; gy < MAP_HEIGHT; gy += 5) {
    for (let gx = (gy / 5) % 2 === 0 ? 0 : 3.5; gx < W; gx += 7) {
      const x = gx + (hash(gx, gy, 1) - 0.5) * 5;
      const y = gy + (hash(gx, gy, 2) - 0.5) * 4;
      const f = forestAmount(x, y);
      const chance = f > 0.5 ? 0.92 : f > 0.4 ? (f - 0.4) * 6 : 0.008;
      if (hash(gx, gy, 3) > chance || !open(x, y, 7, 22)) continue;
      const variants = hash(gx, gy, 4) < (f > 0.5 ? 0.78 : 0.4) ? pines : oaks;
      const sprite = variants[Math.floor(hash(gx, gy, 5) * variants.length)];
      statics.push({ sprite, x: x - sprite.width / 2 + 1, y: y - (sprite.height - 5) });
    }
  }

  const random = rng(17);
  for (let n = 0; n < 260; n++) {
    const x = random() * W;
    const y = random() * MAP_HEIGHT;
    if (!open(x, y, 6, 16)) continue;
    const sprite = boulder(900 + n, 4 + Math.floor(random() * 6));
    statics.push({ sprite, x: x - sprite.width / 2, y: y - sprite.height + 2 });
  }
  CRAGS.forEach(([x, y, w, h], n) => {
    const sprite = mountain(w, h, 40 + n);
    statics.push({ sprite, x: x - sprite.width / 2, y: y - h });
  });

  const place = (sprite: Placed['sprite'], [x, y]: Point, footFromTop: number) => ({ sprite, x: x - sprite.width / 2, y: y - footFromTop });
  statics.push(place(watchtower(0.2), TOWER, 74));
  HUTS.forEach((p, i) => statics.push(place(hut(i + 3), p, 28)));
  statics.push(place(chest(), CHEST, 13));
  statics.push(place(goldPile(), GOLD_PILE, 12));

  // Stone bridge where the tower path crosses the river.
  const crossing = smooth(PATHS[0]).reduce((best, p) => (terrain.river.d[at(p[0], p[1])] < terrain.river.d[at(best[0], best[1])] ? p : best));
  statics.push(place(stoneBridge(46), crossing, 12));
  view.bake(statics);

  const castleFrames = animation((t) => castle(t * Math.PI * 2));
  view.animate({ ...place(castleFrames[0], CASTLE, 104), frames: castleFrames });
  const millFrames = animation((t) => mill(t / 8));
  view.animate({ ...place(millFrames[0], MILL, 44), frames: millFrames });
  const heroFrames = animation((t) => hero(t * Math.PI * 2));
  view.animate({ ...place(heroFrames[0], HERO, 40), frames: heroFrames });
  view.centreOn(HERO[0] + 60, HERO[1] - 60);

  paintBar(view);
  return view;
}

function paintBar(view: AdventureScreen) {
  const { frame } = view;
  const y = BAR.y + 5;
  const coins = goldPile();
  blit(frame, coins, BAR.x + 10, BAR.y + 7);
  drawText(frame, '1,250', BAR.x + 38, y, GOLD[6], INK);
  drawText(frame, 'Leadership 120', BAR.x + 120, y, PARCHMENT[5], INK);
  drawText(frame, 'Knights 12   Archers 25', BAR.x + 316, y, PARCHMENT[5], INK);
  drawText(frame, 'Bounty: Baron Grimsby', BAR.x + 576, y, PARCHMENT[5], INK);
  drawText(frame, 'Day 3 of 100', BAR.x + 800, y, NEUTRAL[7], INK);
}
