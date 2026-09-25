// Battle balance: AI against AI for each fight in Aldmoor, with the army you'd plausibly have. npm run sim:battles
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { battleStats } = await server.ssrLoadModule('/src/rules/battle/balance.ts');
  const { ALDMOOR } = await server.ssrLoadModule('/src/content/aldmoor.ts');
  const { newGame } = await server.ssrLoadModule('/src/rules/scenario.ts');
  const { heroInBattle } = await server.ssrLoadModule('/src/rules/fight.ts');
  const hero = heroInBattle(newGame());
  const start = [{ troop: 'knights', count: 12 }, { troop: 'archers', count: 25 }];
  const later = [{ troop: 'knights', count: 17 }, { troop: 'archers', count: 18 }, { troop: 'peasants', count: 20 }];
  const payday = [{ troop: 'knights', count: 27 }, { troop: 'archers', count: 16 }, { troop: 'peasants', count: 26 }];
  for (const [fight, army, label] of [['patrol', start, 'starting army'], ['wolves', start, 'starting army'], ['hideout', later, 'after recruiting'], ['hideout', payday, 'after a payday']]) {
    const s = battleStats(ALDMOOR, fight, army, hero);
    console.log(`${fight.padEnd(8)} ${label.padEnd(17)} won ${String(s.wins).padStart(2)}/${s.seeds}  rounds ${s.rounds.toFixed(1)}  actions ${s.actions.toFixed(1)}  army lost ${(s.lost * 100).toFixed(0)}%  spells ${s.spells.toFixed(1)}`);
  }
} finally {
  await server.close();
}
