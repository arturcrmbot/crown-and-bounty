import { createServer as netServer } from 'node:net';
import { createServer } from 'vite';

/** Starts the game's dev server on a free port, so scripts don't depend on one already running. */
export async function startServer() {
  const port = await new Promise((resolve) => {
    const probe = netServer().listen(0, '127.0.0.1', () => {
      const { port: free } = probe.address();
      probe.close(() => resolve(free));
    });
  });
  const server = await createServer({ server: { host: '127.0.0.1', port, strictPort: true }, logLevel: 'error' });
  await server.listen();
  return { url: `http://127.0.0.1:${port}/`, close: () => server.close() };
}
