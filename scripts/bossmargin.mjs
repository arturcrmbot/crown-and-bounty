// The army multiple (of the starting army) to beat a commission's hideout half the time, with its villain's tricks and without.
// npm run sim:boss. Env: CHAPTER=1 (the Fenmarch), VILLAIN=witch, LEVEL=5, SCALE=1,0.9 (the villain's men), MANA, SP, BG.
const { createServer } = await import(`${process.cwd()}/node_modules/vite/dist/node/index.js`);
const vite = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'error' });
try {
  const game = await vite.ssrLoadModule('/src/rules/game.ts');
  const bm = await vite.ssrLoadModule('/src/rules/battle/battle.ts');
  const ai = await vite.ssrLoadModule('/src/rules/battle/ai.ts');
  const { TROOPS } = await vite.ssrLoadModule('/src/content/troops.ts');
  const chapter = Number(process.env.CHAPTER ?? 1);
  const villain = process.env.VILLAIN ?? 'witch';
  const level = Number(process.env.LEVEL ?? 1);
  const tricks = { ...TROOPS[villain].caster, ...(process.env.MANA ? { mana: Number(process.env.MANA) } : {}), ...(process.env.SP ? { spellPower: Number(process.env.SP) } : {}) };
  const seed = (i) => (Math.imul(i + 1, 0x9e3779b1) ^ 0x85ebca6b) >>> 0;
  const scale = (process.env.SCALE ?? '1').split(',').map(Number);
  const chance = (state, enemyScale) => {
    const place = state.locations.find((l) => l.kind === 'hideout');
    const hero = game.heroInBattle(state);
    const enemy = place.enemy.army.map((a) => ({ ...a, count: TROOPS[a.troop].leadership === 99 ? a.count : Math.round(a.count * enemyScale) }));
    let wins = 0;
    for (let i = 1; i <= 16; i++) {
      const b = bm.createBattle({ place: place.id, seed: seed(i), player: state.army, enemy, hero, obstacles: 3, ground: state.province?.fen ? 'fen' : undefined });
      if (ai.autoResolve(b).result === 'won') wins++;
    }
    return wins / 16;
  };
  for (const bg of (process.env.BG ?? 'knight,wizard,ranger,courtier').split(',')) {
    const first = { ...game.newGame(1066, undefined, bg), opening: undefined };
    const hero = { ...first.hero, level, xp: 0 };
    const s = chapter > 0 ? game.beginCommission(game.commissionAt(first.campaign, chapter).province, first.seed, { hero, gold: first.gold, leadership: first.leadership, army: first.army }, chapter, Array.from({ length: chapter }, (_, i) => ({ chapter: i, days: 10, level })), first.seed) : { ...first, hero };
    const find = (on, enemyScale) => {
      TROOPS[villain].caster = on ? tricks : undefined;
      for (let m = 1; m <= 5.001; m += 0.1) {
        const army = s.army.map((a) => ({ ...a, count: Math.round(a.count * m) }));
        if (chance({ ...s, army }, enemyScale) >= 0.5) return m.toFixed(1);
      }
      return '>5';
    };
    console.log(bg.padEnd(9), 'plain', find(false, 1), ' tricks', scale.map((k) => `x${k}: ${find(true, k)}`).join('  '));
  }
} finally {
  await vite.close();
}
