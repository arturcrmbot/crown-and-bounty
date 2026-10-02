// The difficulty model's report (docs/BALANCE.md): the climb, ring by ring, as win chances on day I and once a careful
// player has done the first two rings (`climbed`), for every background, against the targets in rules/difficulty.ts;
// and in the first commission, a careful player's odds at the villain's gate on day 21, as a report.
// npm run difficulty [-- commission]
import { createServer } from 'vite';

const chapter = Number(process.argv[2] ?? 1) - 1;
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { bare, climbed, medians, odds, reference, RINGS, TARGETS, TARGET_DAY } = await server.ssrLoadModule('/src/rules/difficulty.ts');
  const { winChance } = await server.ssrLoadModule('/src/rules/fight.ts');
  const { newGame, beginCommission, commissionAt } = await server.ssrLoadModule('/src/rules/game.ts');
  const pct = (c) => `${(c * 100).toFixed(0)}%`;
  /** A mark where a step's median is off its target at this moment. */
  const mark = (step, when, c) => {
    const range = TARGETS[when][step];
    return !range || c === undefined || (c >= range[0] && c <= range[1]) ? ' ' : '!';
  };
  for (const background of ['knight', 'wizard', 'ranger', 'courtier']) {
    const first = { ...newGame(1066, undefined, background), opening: undefined };
    const start = chapter === 0 ? first : beginCommission(commissionAt(first.campaign, chapter).province, 1066, first.campaign.start, chapter, [], first.seed);
    const t = performance.now();
    const later = climbed(start);
    const at = (s) => Object.fromEntries(odds(s).map((o) => [o.id, o]));
    const [before, after] = [at(start), at(later)];
    const [m0, m1] = [medians(start), medians(later)];
    console.log(`${background.padEnd(9)} climbed by day ${later.day}, level ${later.hero.level}, army ${later.army.map((a) => `${a.count} ${a.troop}`).join(', ')}  (${Math.round(performance.now() - t)} ms)`);
    for (const step of [1, 2, 3, 4, 5, 'top']) {
      const bands = Object.values(before).filter((o) => o.step === step);
      if (!bands.length) continue;
      const cells = bands.map((o) => `${o.id} ${pct(o.chance)}${after[o.id] ? `\u2192${pct(after[o.id].chance)}` : '\u2192beaten'}`);
      const days = step === 'top' ? `day ${TARGET_DAY}` : `days ${RINGS[step][0]}-${RINGS[step][1]}`;
      const median = `${m0[step] === undefined ? '-' : pct(m0[step])}${mark(step, 'start', m0[step])}\u2192${m1[step] === undefined ? 'beaten' : pct(m1[step])}${mark(step, 'climbed', m1[step])}`;
      console.log(`          ${(step === 'top' ? 'the villain' : `ring ${step}`).padEnd(11)} ${days.padEnd(10)} median ${median.padEnd(14)} ${cells.join('   ')}`);
    }
    if (chapter === 0) {
      const t = performance.now();
      const hero = reference(start);
      const villain = hero.locations.find((l) => l.kind === 'hideout');
      const all = winChance(hero, villain.id);
      const alone = winChance(bare(hero), villain.id);
      console.log(`          day ${TARGET_DAY}, a careful player at level ${hero.hero.level} (${hero.army.map((a) => `${a.count} ${a.troop}`).join(', ')}): ${villain.id} ${pct(all)} with everything, ${pct(alone)} on his army alone  (${Math.round(performance.now() - t)} ms)`);
    }
  }
} finally {
  await server.close();
}
