# AGENTS.md

King's Commission (working title) is a browser game: King's Bounty (1990) rebuilt with modern tech and the charm of Heroes of Might and Magic 2. Read `docs/BRIEF.md` for the design and every decision made so far, and `docs/PLAN.md` for the structure, testing and milestones.

## Working with Artur

- Reply fast and keep it short. Before any step that will take more than a minute or two, post a one-line status. Never go silent.
- Show, don't tell. Open the game in the browser side panel and screenshot it. Use a mermaid diagram for flows.
- Build in small, visible steps. Check in before any big build or long design deep-dive.
- No image-generation models for art. Use CC0 packs, and code for everything else.
- Don't commit or push unless asked.

## Architecture

- `src/rules/`: game rules in plain TypeScript (map, movement, armies, gold, contracts, battle results). No Three.js, no DOM, no timers. Deterministic with a seeded RNG. Tested with Vitest.
- `src/render/`: 2D pixel-art drawing into an indexed 640×480 framebuffer. Reads the rules state and never changes it.
- `src/ui/`: HTML/CSS overlays (side panel, dialogs, army and recruit screens).
- `public/assets/`: CC0 art, if any. `public/assets/CREDITS.md` lists the source and licence of each pack.

## Loop

Change, run the tests, open the game in the browser panel, screenshot, fix.

- `npm run dev`: dev server on http://127.0.0.1:5188 (5173 is often taken on this machine). Scroll with arrows, WASD or drag; click to ride; E ends the day.
- `npm test`: Vitest for `src/rules/`. `npm run typecheck` and `npm run build`.
- `npm run shots`: with the dev server running, saves `screenshots/look.png` (env: `QUERY`, `RIDE=x,y`, `OUT`).
- `npm run play` and `node scripts/win.mjs`: scripted play-throughs; the second plays the whole contract at `?speed=8`.
