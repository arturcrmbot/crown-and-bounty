// The difficulty model's report: every tiered enemy's win chance at the start and once explored,
// for every background, against the targets in rules/difficulty.ts. npm run difficulty [-- commission]
import { createServer } from 'vite';

const chapter = Number(process.argv[2] ?? 1) - 1;
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { explored, odds, TARGETS } = await server.ssrLoadModule('/src/rules/difficulty.ts');
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
  }
} finally {
  await server.close();
}
