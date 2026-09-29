// The difficulty model's report: every tiered enemy's win chance at the start and once explored,
// for every background, against the targets in rules/difficulty.ts, and in the first commission, the
// villain on the target day for a careful player (the power budget). npm run difficulty [-- commission]
import { createServer } from 'vite';

const chapter = Number(process.argv[2] ?? 1) - 1;
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { bare, explored, odds, reference, TARGETS, TARGET_DAY } = await server.ssrLoadModule('/src/rules/difficulty.ts');
  const { winChance } = await server.ssrLoadModule('/src/rules/fight.ts');
  const { newGame, beginCommission, commissionAt } = await server.ssrLoadModule('/src/rules/game.ts');
  const mark = (tier, when, c) => {
    const range = TARGETS[tier][when];
    return !range ? ' ' : c >= range[0] && c <= range[1] ? ' ' : '!';
  };
  for (const background of ['knight', 'wizard', 'ranger', 'courtier']) {
    const first = { ...newGame(1066, undefined, background), opening: undefined };
    const start = chapter === 0 ? first : beginCommission(commissionAt(first.campaign, chapter).province, 1066, first.campaign.start, chapter, [], first.seed);
    const t = performance.now();
    const later = explored(start);
    const at = (s) => Object.fromEntries(odds(s).map((o) => [o.id, o]));
    const before = at(start);
    const after = at(later);
    const cells = Object.values(before).map((o) => {
      const e = after[o.id];
      return `${o.id}(${o.tier}) ${(o.chance * 100).toFixed(0)}%${mark(o.tier, 'start', o.chance)}${e ? `→${(e.chance * 100).toFixed(0)}%${mark(o.tier, 'explored', e.chance)}` : '→beaten'}`;
    });
    console.log(`${background.padEnd(9)} explored by day ${later.day}, level ${later.hero.level}, army ${later.army.map((a) => `${a.count} ${a.troop}`).join(', ')}  (${Math.round(performance.now() - t)} ms)`);
    console.log(`          ${cells.join('   ')}`);
    if (chapter === 0) {
      const t = performance.now();
      const hero = reference(start);
      const villain = hero.locations.find((l) => l.kind === 'hideout');
      const all = winChance(hero, villain.id);
      const alone = winChance(bare(hero), villain.id);
      const mark = (c, range) => (c >= range[0] && c <= range[1] ? ' ' : '!');
      console.log(`          day ${TARGET_DAY}, a careful player at level ${hero.hero.level} (${hero.army.map((a) => `${a.count} ${a.troop}`).join(', ')}): ${villain.id} ${(all * 100).toFixed(0)}%${mark(all, TARGETS.boss.budget)} with everything, ${(alone * 100).toFixed(0)}% on his army alone  (${Math.round(performance.now() - t)} ms)`);
    }
  }
} finally {
  await server.close();
}
