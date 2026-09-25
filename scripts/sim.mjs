// Balance report: the bot plays the commission for many seeds. npm run sim [-- count]
import { createServer } from 'vite';

const count = Number(process.argv[2] ?? 30);
const backgrounds = ['knight', 'wizard', 'ranger', 'courtier'];
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { simulate } = await server.ssrLoadModule('/src/rules/sim.ts');
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
