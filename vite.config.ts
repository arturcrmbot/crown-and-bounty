import { defineConfig } from 'vite';

// Port 5173 is often taken by other projects on this machine, so the game has its own.
export default defineConfig({
  server: { host: '127.0.0.1', port: 5188, strictPort: true },
});
