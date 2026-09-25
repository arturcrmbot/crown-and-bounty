import type { AdventureScreen } from './adventureScreen';
import { CASTLE, CHEST, FORESTS, GOLD_PILE, HERO, MOUNTAINS, RIVER, ROAD } from './lookTestMap';
import { rng } from './noise';
import { bridge, castle, chest, goldPile, hero, MINIMAP_COLOURS, mountain, oak, pine } from './sprites';
import { closest, Ground, smooth } from './terrain';

const WAVE_FRAMES = 8;
const waving = (make: (phase: number) => ReturnType<typeof hero>) =>
  Array.from({ length: WAVE_FRAMES }, (_, i) => make((i / WAVE_FRAMES) * Math.PI * 2));

/** Places the castle, mountains, forests, bridge, pickups and the hero on the look-test map. */
export function populateLookTest(view: AdventureScreen) {
  for (const { at, width, height, seed } of MOUNTAINS) {
    const sprite = mountain(width, height, seed);
    view.add({ sprite, x: at[0] - sprite.width / 2, y: at[1] - height, minimap: MINIMAP_COLOURS.mountain });
  }

  const castleFrames = waving(castle);
  view.add({ sprite: castleFrames[0], frames: castleFrames, x: CASTLE[0] - 64, y: CASTLE[1] - 104, minimap: MINIMAP_COLOURS.castle });

  let treeSeed = 100;
  for (const forest of FORESTS) {
    const random = rng(forest.seed * 977);
    for (let placed = 0, tries = 0; placed < forest.count && tries < 600; tries++) {
      const angle = random() * Math.PI * 2;
      const distance = Math.sqrt(random()) * forest.radius;
      const x = forest.at[0] + Math.cos(angle) * distance;
      const y = forest.at[1] + Math.sin(angle) * distance * 0.8;
      const clear = [[0, 0], [-8, 0], [8, 0], [0, 6]].every(([dx, dy]) => view.groundAt(x + dx, y + dy) === Ground.Grass);
      if (!clear) continue;
      const sprite = forest.pine ? pine(treeSeed++) : oak(treeSeed++);
      view.add({ sprite, x: x - sprite.width / 2 + 2, y: y - (sprite.height - 6), minimap: MINIMAP_COLOURS.forest });
      placed++;
    }
  }

  // The bridge goes where the road meets the river.
  const road = smooth(ROAD);
  const river = smooth(RIVER);
  const crossing = road.reduce((best, p) => (closest(river, p[0], p[1]).d < closest(river, best[0], best[1]).d ? p : best));
  const span = bridge(52);
  view.add({ sprite: span, x: crossing[0] - span.width / 2, y: crossing[1] - 14 });

  const chestSprite = chest();
  view.add({ sprite: chestSprite, x: CHEST[0] - 9, y: CHEST[1] - 13 });
  const gold = goldPile();
  view.add({ sprite: gold, x: GOLD_PILE[0] - 11, y: GOLD_PILE[1] - 12 });

  const heroFrames = waving(hero);
  view.add({ sprite: heroFrames[0], frames: heroFrames, x: HERO[0] - 19, y: HERO[1] - 40, minimap: MINIMAP_COLOURS.hero });
}
