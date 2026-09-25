// Balance report: the bot plays the commission for many seeds. npm run sim [-- count]
import { createServer } from 'vite';

const count = Number(process.argv[2] ?? 30);
const backgrounds = ['knight', 'wizard', 'ranger', 'courtier'];
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { simulate, simulateCampaign } = await server.ssrLoadModule('/src/rules/sim.ts');
  if (process.argv.includes('--campaign')) {
    for (const background of backgrounds) {
      const started = performance.now();
      const all = simulateCampaign(Array.from({ length: count }, (_, i) => i + 1), background);
      const ms = performance.now() - started;
      const line = [`${background.padEnd(9)}`];
      for (const chapter of [0, 1]) {
        const runs = all.map((c) => c.runs.filter((r) => r.state.campaign.chapter === chapter));
        const reached = runs.filter((r) => r.length > 0);
        const won = reached.filter((r) => r.some((x) => x.won));
        const days = won.map((r) => r.find((x) => x.won).day).sort((a, b) => a - b);
        const retried = reached.filter((r) => r.length > 1).length;
        const levels = won.map((r) => r.find((x) => x.won).level);
        line.push(`C${chapter + 1}: won ${won.length}/${reached.length}${retried ? ` (${retried} retried)` : ''} median day ${days[Math.floor(days.length / 2)] ?? '-'} p90 ${days[Math.floor(days.length * 0.9)] ?? '-'} level ${levels.length ? (levels.reduce((a, b) => a + b, 0) / levels.length).toFixed(1) : '-'}`);
      }
      console.log(`${line.join('   ')}  (${Math.round(ms / count)} ms each)`);
      for (const c of all.filter((x) => !x.runs.at(-1).won).slice(0, 2)) console.log(`  LOST seed ${c.seed} in C${c.runs.at(-1).state.campaign.chapter + 1}: ${c.runs.at(-1).log.slice(-8).join(', ')}`);
    }
    process.exit(0);
  }
  for (const background of backgrounds) {
    const started = performance.now();
    const runs = simulate(Array.from({ length: count }, (_, i) => i + 1), background);
    const ms = performance.now() - started;
    const wins = runs.filter((r) => r.won);
    const days = wins.map((r) => r.day).sort((a, b) => a - b);
    const pick = (q) => days[Math.min(days.length - 1, Math.floor(q * days.length))];
    const avg = (f) => (runs.reduce((s, r) => s + f(r), 0) / count).toFixed(1);
    console.log(`${background.padEnd(9)} won ${String(wins.length).padStart(2)}/${count}  days min ${days[0]} median ${pick(0.5)} p90 ${pick(0.9)} max ${days.at(-1)}  fights ${avg((r) => r.fights)} retreats ${avg((r) => r.retreats)}  level ${avg((r) => r.level)}  gold left ${runs.map((r) => r.gold).sort((a, b) => a - b)[Math.floor(count / 2)]}  (${Math.round(ms / count)} ms each)`);
    for (const r of runs.filter((x) => !x.won).slice(0, 2)) console.log(`  LOST seed ${r.seed}: ${r.log.join(', ')}`);
  }
} finally {
  await server.close();
}
