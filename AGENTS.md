# AGENTS.md

King's Commission (working title) is a browser game: King's Bounty (1990) rebuilt with modern tech and the charm of Heroes of Might and Magic 2. Read `docs/BRIEF.md` for the design and every decision made so far.

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

- `npm run dev`: dev server on http://localhost:5173.
- `npm run typecheck` and `npm run build`.
- `npm run shots`: with the dev server running, saves `screenshots/look.png` through headless Edge.
