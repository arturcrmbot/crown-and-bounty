// The power curve (docs/BALANCE.md): how strong the hero is, day by day, in Grimsbys: the multiple of
// Grimsby's stockade as it stood on 29 Sep 2026 (46 swordsmen, 24 crossbowmen and the Baron) that his army
// beats half the time, the sergeants fighting. A careful player (the bot with a margin) plays everything but
// the villain; beside him, Grimsby as he stands, the odds at his gate, and the day each gate falls.
// npm run sim:curve [-- seeds] [--bot] [--days 1,3,7,10,14,21] [--bg knight,wizard]
import { createServer } from 'vite';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const seeds = Number(process.argv.slice(2).find((a) => /^\d+$/.test(a)) ?? 3);
const careful = !process.argv.includes('--bot');
const days = arg('days', '1,3,7,10,14,21').split(',').map(Number);
const backgrounds = arg('bg', 'knight,wizard,ranger,courtier').split(',');
const until = Math.max(...days);
const GRIMSBY = [{ troop: 'swordsmen', count: 46 }, { troop: 'crossbowmen', count: 24 }, { troop: 'baron', count: 1 }];
const GATES = ['patrol', 'wolves', 'diggings', 'grimsby'];

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'error' });
try {
  const { newGame, heroInBattle, heroStats, armyPower, winChance, TROOPS } = await server.ssrLoadModule('/src/rules/game.ts');
  const { playCommission } = await server.ssrLoadModule('/src/rules/bot.ts');
  const { mapOf } = await server.ssrLoadModule('/src/rules/map/maps.ts');
  const { createBattle } = await server.ssrLoadModule('/src/rules/battle/battle.ts');
  const { autoResolve } = await server.ssrLoadModule('/src/rules/battle/ai.ts');
  const { atHome, bare, TARGET_DAY } = await server.ssrLoadModule('/src/rules/difficulty.ts');
  const seedOf = (i) => (Math.imul(i + 1, 0x9e3779b1) ^ 0x85ebca6b) >>> 0;
  const scale = (army, k) => army.map((a) => (TROOPS[a.troop].leadership >= 99 ? a : { ...a, count: Math.round(a.count * k) })).filter((a) => a.count > 0);
  /** How often this army beats `enemy` at Grimsby's walls, the sergeants fighting and never spending his gold. */
  const wins = (state, enemy, samples = 12) => {
    const { gold: _g, room: _r, ...hero } = { ...heroInBattle(state), volley: undefined };
    let won = 0;
    for (let i = 1; i <= samples; i++) if (autoResolve(createBattle({ place: 'hideout', seed: seedOf(i), player: state.army, enemy, hero, obstacles: 3 })).result === 'won') won++;
    return won / samples;
  };
  /** The multiple of Grimsby (as he was) this army beats half the time. */
  const grimsbys = (state) => {
    if (!state.army.length) return 0;
    let lo = Math.log(0.05);
    let hi = Math.log(40);
    for (let step = 0; step < 8; step++) {
      const mid = (lo + hi) / 2;
      if (wins(state, scale(GRIMSBY, Math.exp(mid))) >= 0.5) lo = mid;
      else hi = mid;
    }
    return Math.exp((lo + hi) / 2);
  };
  const troopsOf = (army) => armyPower(army.filter((a) => TROOPS[a.troop].leadership < 99));
  const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor((xs.length - 1) / 2)];
  console.log(`${careful ? 'A careful player' : 'The bot'}, ${seeds} seeds a background: strength in Grimsbys, and [Grimsby as he stands]. Median of seeds.`);
  console.log(`${'day'.padEnd(10)}${days.map((d) => String(d).padEnd(15)).join('')}  gates fall (median day)          Grimsby on day ${TARGET_DAY}: all / army alone`);
  for (const background of backgrounds) {
    const rows = days.map(() => []);
    const fell = Object.fromEntries(GATES.map((g) => [g, []]));
    const target = { all: [], alone: [] };
    for (let n = 1; n <= seeds; n++) {
      const start = { ...newGame(n, undefined, background), opening: undefined };
      const snaps = new Map();
      const run = playCommission(start, mapOf(start), 20000, { reckless: !careful, allow: (l) => l.kind !== 'hideout', stop: (s) => (snaps.set(s.day, s), s.day > until) });
      snaps.set(run.state.day, run.state);
      const at = (d) => snaps.get(d) ?? [...snaps.entries()].filter(([x]) => x <= d).sort((a, b) => a[0] - b[0]).at(-1)[1];
      days.forEach((d, i) => {
        const s = at(d);
        const hideout = atHome(s).locations.find((l) => l.id === 'hideout').enemy.army;
        rows[i].push({ k: grimsbys(s), g: troopsOf(hideout) / troopsOf(GRIMSBY), level: s.hero.level, lead: heroStats(s).leadership });
      });
      for (const g of GATES) {
        const d = [...snaps.entries()].sort((a, b) => a[0] - b[0]).find(([, s]) => s.locations.find((l) => l.id === g)?.done)?.[0];
        if (d !== undefined) fell[g].push(d);
      }
      const ref = atHome(at(TARGET_DAY));
      target.all.push(winChance(ref, 'hideout'));
      target.alone.push(winChance(bare(ref), 'hideout'));
    }
    const cells = rows.map((r) => `${median(r.map((x) => x.k)).toFixed(2)} [${median(r.map((x) => x.g)).toFixed(2)}]`.padEnd(15)).join('');
    const gates = GATES.map((g) => `${g} ${fell[g].length ? median(fell[g]) : '-'}`).join(' ');
    const odds = `${Math.round(median(target.all) * 100)}% / ${Math.round(median(target.alone) * 100)}%`;
    console.log(`${background.padEnd(10)}${cells}  ${gates.padEnd(32)} ${odds}`);
    const levels = rows.map((r) => `L${median(r.map((x) => x.level))} ${median(r.map((x) => x.lead))}`.padEnd(15)).join('');
    console.log(`${''.padEnd(10)}${levels}  (level, leadership)`);
  }
} finally {
  await server.close();
}
