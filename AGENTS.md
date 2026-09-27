# AGENTS.md

King's Commission (working title) is a browser game: King's Bounty (1990) rebuilt with modern tech and the charm of Heroes of Might and Magic 2. Read `docs/BRIEF.md` for the design and every decision made so far, and `docs/PLAN.md` for the structure, testing and milestones.

## Working with Artur

- Reply fast and keep it short. Before any step that will take more than a minute or two, post a one-line status. Never go silent.
- Show, don't tell. Open the game in the browser side panel and screenshot it. Use a mermaid diagram for flows.
- Build in small, visible steps. Check in before any big build or long design deep-dive.
- No image-generation models for art. Use CC0 packs, and code for everything else.
- Commit, push and deploy (`npm run deploy`) after every improvement, and playtest it properly yourself first. Follow `.github/skills/kings-commission-ship/SKILL.md` (Artur, 27 Sep). Never bring him obvious issues.

## Architecture

- `src/content/`: typed game data. Provinces (land, places, decor), troops, spells, backgrounds, skills, perks and artifacts.
- `src/rules/`: the game rules in plain TypeScript, with no Three.js, DOM or timers. Every change is `(state, action) → { state, events }`, and dice come from the seed in the state. The rules own the logical map (`map/`: 8 px walk grid, pathfinding, movement, fog). Tested with Vitest.
- **Extending the game.** Most additions are data:
  - Places: each kind of place is one module in `src/rules/places/` (a `PlaceKind`: its cards, arrival, own choices, payday, bot appetite), registered in `places/index.ts`.
  - Content choices: shrines, quests, parleys and events are content. They're pages of choices with `Needs` (conditions and costs) and `Effects` (gold, stats, spells, troops, flags, reveal, xp, win...), interpreted by `src/rules/effects.ts`, with story state in `state.flags`.
  - Battle: spells, statuses and troop abilities are data in `src/content/spells.ts` and `troops.ts`, and the battle engine reads them generically.
  - Battle AI (`rules/battle/ai.ts`): it tries every option with the real rules, so new content needs no AI changes.
  - Map AI (`rules/map/roaming.ts`): an enemy's `behaviour` (guard, roam, hunt), `range` and `grows` are data. Enemies block the walk grid where the state says they stand.
- `src/game/`: screen controllers (input, riding animation, events into cards and HUD), save/load. `main.ts` only boots.
- `src/render/`: 2D pixel-art drawing into an indexed 960×540 framebuffer. It reads the rules state and never changes it.
- `src/ui/`: HTML/CSS overlays (parchment cards, hover label).
- `public/assets/`: CC0 art, if any. `public/assets/CREDITS.md` lists the source and licence of each pack.

## Loop

Change, run the tests, open the game in the browser panel, screenshot, fix.

- `npm run dev`: dev server on http://127.0.0.1:5188 (5173 is often taken on this machine). Scroll with arrows, WASD or drag; click to ride; E ends the day; M mutes the sound. The game opens on the title, then the King's prologue at court; `?quick=1` (or any debug start, or `?freeze=1`) goes straight to the map, and `?title=1` brings the title back when frozen. `?fresh=1` ignores the save, `?freeze=1` stops the clock (and doesn't save), `?speed=8` rides faster, `?x=&y=` centres the camera, `?battle=patrol` opens that fight (`&hero=ranger` picks the background, `&spells=fireball` teaches spells), `?court=N` opens the court after commission N, `?commission=2` starts in the Fenmarch (3 to 5 are generated), `?reveal=1` lifts the fog.
- `npm test`: Vitest (rules, map, movement, bot). `npm run typecheck` and `npm run build`.
- `npm run sim [-- 50]`: the bot plays the commission for many seeds, per background, and prints a balance report. `npm run sim -- 10 --campaign` plays both commissions, court included. `npm run sim:battles` prints win chances for each fight.
- `npm run e2e`: plays the whole commission through the real UI on its own server; exit code 1 on failure.
- `npm run visual [-- --approve]`: frozen scenes, exact frame hashes against `test/visual.json`, PNGs in `screenshots/visual/`.
- `npm run shots`: ad-hoc screenshot of the running dev server (env: `QUERY`, `RIDE=x,y`, `OUT`).
- `npm run deploy`: builds and publishes to GitHub Pages (the `gh-pages` branch of `origin`). Live a minute later at https://arturcrmbot.github.io/kings-commission/.
