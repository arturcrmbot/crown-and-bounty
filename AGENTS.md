# AGENTS.md

King's Commission (working title) is a browser game: King's Bounty (1990) rebuilt with modern tech and the charm of Heroes of Might and Magic 2. Read `docs/BRIEF.md` for the design and every decision made so far, and `docs/PLAN.md` for the structure, testing and milestones.

## Working with Artur

- Reply fast and keep it short. Before any step that will take more than a minute or two, post a one-line status. Never go silent.
- Show, don't tell. Open the game in the browser side panel and screenshot it. Use a mermaid diagram for flows.
- Build in small, visible steps. Check in before any big build or long design deep-dive.
- No image-generation models for art. Use CC0 packs, and code for everything else.
- Don't commit or push unless asked.

## Architecture

- `src/content/`: typed game data. Provinces (land, places, decor), troops, spells, backgrounds, skills, perks and artifacts.
- `src/rules/`: the game rules in plain TypeScript, with no Three.js, DOM or timers. Every change is `(state, action) → { state, events }`, and dice come from the seed in the state. The rules own the logical map (`map/`: 8 px walk grid, pathfinding, movement, fog). Tested with Vitest.
- `src/game/`: screen controllers (input, riding animation, events into cards and HUD), save/load. `main.ts` only boots.
- `src/render/`: 2D pixel-art drawing into an indexed 960×540 framebuffer. It reads the rules state and never changes it.
- `src/ui/`: HTML/CSS overlays (parchment cards, hover label).
- `public/assets/`: CC0 art, if any. `public/assets/CREDITS.md` lists the source and licence of each pack.

## Loop

Change, run the tests, open the game in the browser panel, screenshot, fix.

- `npm run dev`: dev server on http://127.0.0.1:5188 (5173 is often taken on this machine). Scroll with arrows, WASD or drag; click to ride; E ends the day. `?fresh=1` ignores the save, `?freeze=1` stops the clock (and doesn't save), `?speed=8` rides faster, `?x=&y=` centres the camera, `?battle=patrol` opens that fight, `?court=1` opens the court after Aldmoor, `?commission=2` starts in the Fenmarch, `?reveal=1` lifts the fog.
- `npm test`: Vitest (rules, map, movement, bot). `npm run typecheck` and `npm run build`.
- `npm run sim [-- 50]`: the bot plays the commission for many seeds, per background, and prints a balance report. `npm run sim -- 10 --campaign` plays both commissions, court included. `npm run sim:battles` prints win chances for each fight.
- `npm run e2e`: plays the whole commission through the real UI on its own server; exit code 1 on failure.
- `npm run visual [-- --approve]`: frozen scenes, exact frame hashes against `test/visual.json`, PNGs in `screenshots/visual/`.
- `npm run shots`: ad-hoc screenshot of the running dev server (env: `QUERY`, `RIDE=x,y`, `OUT`).
