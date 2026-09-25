// Balance report: the bot plays the commission for many seeds. npm run sim [-- count]
import { createServer } from 'vite';

const count = Number(process.argv[2] ?? 50);
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { simulate } = await server.ssrLoadModule('/src/rules/sim.ts');
  const started = performance.now();
  const runs = simulate(Array.from({ length: count }, (_, i) => i + 1));
  const ms = performance.now() - started;
  const wins = runs.filter((r) => r.won);
  const days = wins.map((r) => r.day).sort((a, b) => a - b);
  const pick = (q) => days[Math.min(days.length - 1, Math.floor(q * days.length))];
  console.log(`${count} commissions in ${Math.round(ms)} ms (${(ms / count).toFixed(1)} ms each)`);
  console.log(`won ${wins.length}/${count}; days to win: min ${days[0]}, median ${pick(0.5)}, p90 ${pick(0.9)}, max ${days.at(-1)}`);
  console.log(`fights per run ${(runs.reduce((s, r) => s + r.fights, 0) / count).toFixed(1)}, retreats per run ${(runs.reduce((s, r) => s + r.retreats, 0) / count).toFixed(2)}`);
  console.log(`gold at the end: median ${runs.map((r) => r.gold).sort((a, b) => a - b)[Math.floor(count / 2)]}`);
  for (const r of runs.filter((x) => !x.won).slice(0, 3)) console.log(`LOST seed ${r.seed}: ${r.log.join(', ')}`);
} finally {
  await server.close();
}
