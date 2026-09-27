import { defineConfig } from 'vite';

export default defineConfig({
  // Relative paths, so the built game runs from any folder: GitHub Pages serves it under /kings-commission/.
  base: './',
  // Port 5173 is often taken by other projects on this machine, so the game has its own.
  server: { host: '127.0.0.1', port: 5188, strictPort: true },
});
