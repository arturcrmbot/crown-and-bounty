# AGENTS.md

King's Commission (working title) is a browser game: King's Bounty (1990) rebuilt with modern tech and the charm of Heroes of Might and Magic 2. Read `docs/BRIEF.md` for the design and every decision made so far, and `docs/PLAN.md` for the structure, testing and milestones.

## Working with Artur

- Reply fast and keep it short. Before any step that will take more than a minute or two, post a one-line status. Never go silent.
- Show, don't tell. Open the game in the browser side panel and screenshot it. Use a mermaid diagram for flows.
- Build in small, visible steps. Check in before any big build or long design deep-dive.
- No image-generation models for art. The troops and the hero are Battle for Wesnoth's units (GPL-2.0-or-later and CC BY-SA 4.0, credited file by file in `public/assets/CREDITS.md`); everything else is drawn in code. The game is GPL-2.0-or-later (`LICENSE`).
- Commit, push and deploy (`npm run deploy`) after every improvement, and playtest it properly yourself first. Follow `.github/skills/kings-commission-ship/SKILL.md` (Artur, 27 Sep). Never bring him obvious issues.

## Architecture

- `src/content/`: typed game data. Provinces (land, places, decor), troops, spells, backgrounds, skills, perks and artifacts.
- `src/rules/`: the game rules in plain TypeScript, with no Three.js, DOM or timers. Every change is `(state, action) → { state, events }`, and dice come from the seed in the state. The rules own the logical map (`map/`: 8 px walk grid, pathfinding, movement, fog). Tested with Vitest.
- **Extending the game.** Most additions are data:
  - Places: each kind of place is one module in `src/rules/places/` (a `PlaceKind`: its cards, arrival, own choices, payday, bot appetite), registered in `places/index.ts`. Towers, mines and mills show their `pages` when they have them, so a find is a choice written as content.
  - Beasts (troops with no wages that aren't villains) can be tamed by a hero with `tames`: see `tameOffer` in `places/enemy.ts`.
  - Content choices: shrines, quests, parleys and events are content. They're pages of choices with `Needs` (conditions and costs, including `flag`/`notFlag` and `notSpell`) and `Effects` (gold, treasure, stats, spells, troops, flags, reveal, xp, win, a new `place`, `reinforce` another enemy, `desert` this one, `travel` by a shortcut...), interpreted by `src/rules/effects/`, with story state in `state.flags`. A flag set by one place's spoils or choice can open a choice somewhere else: that is how choices come back later.
  - Relics (`RELICS` in `src/content/artifacts.ts`) carry a background's trick as a `Bonus` (charge, volley, forestWalk, casts, mapSpells, bribes, hires, tames), so any hero can pick one up.
  - Battle: spells, statuses and troop abilities are data in `src/content/spells.ts` and `troops.ts`, and the battle engine reads them generically. Aldric fights too, as one troop per background (`hero` in `troops.ts`: his health and damage grow with his level); `heroFighter` in `rules/fight.ts` gives his numbers, and `createBattle` puts him in the line from `BattleHero.unit`.
  - Battle AI (`rules/battle/ai.ts`): it tries every option with the real rules, so new content needs no AI changes.
  - Map AI (`rules/map/roaming.ts`): an enemy's `behaviour` (guard, roam, hunt), `range` and `grows` are data. Enemies block the walk grid where the state says they stand.
  - The hero screen and the army: what they say (the sheet, a stack's card, the bar's hover labels, a place's hover label) is `src/rules/heroSheet.ts`; what they change are rules actions (`wear`, `unequip`, `movePack` in `hero.ts`; `moveStack`, `dismiss` in `army.ts`), dispatched through `apply` like any card's.
- `src/game/`: screen controllers (input, riding animation, events into cards and HUD), save/load. `main.ts` only boots. The hero screen is a `Screen` of its own (`game/hero.ts`) over the map, which stands still under it.
- `src/render/`: 2D pixel-art drawing into an indexed 960×540 framebuffer, with one 256-colour palette for everything (the Wesnoth units included). It reads the rules state and never changes it.
- `src/ui/`: HTML/CSS overlays (parchment cards, hover label, the hero screen in `heroScreen.ts` with its drag and drop). They grow with the canvas (`ui/scale.ts`). Artifact and stat pictures are drawn in code in `render/artifactIcons.ts`.
- `public/assets/wesnoth/units/`: Battle for Wesnoth's unit PNGs, unchanged, from the pinned tag. `src/render/units.ts` says which unit and frames each troop uses (from its Wesnoth `.cfg`), and which figure each background's hero is (`heroArtId`); `src/render/wesnoth.ts` recolours, scales and matches them to the palette as the game runs. `npm run wesnoth` downloads missing images (`-- --palette` re-picks the palette colours the art adds, `-- --credits` rewrites `public/assets/CREDITS.md`).

## Loop

Change, run the tests, open the game in the browser panel, screenshot, fix.

- `npm run dev`: dev server on http://127.0.0.1:5188 (5173 is often taken on this machine). Scroll with arrows, WASD or drag; click to ride; E ends the day; H opens the hero screen; M mutes the sound; ? lists every key. The game opens on the title, then the King's prologue at court; `?quick=1` (or any debug start, or `?freeze=1`) goes straight to the map, and `?title=1` brings the title back when frozen. `?fresh=1` ignores the save, `?freeze=1` stops the clock (and doesn't save, and screens change without a transition; `&transitions=1` keeps them, to step through with `__kc.advance`), `?speed=8` rides faster, `?x=&y=` centres the camera, `?battle=patrol` opens that fight (`&hero=ranger` picks the background, and skips the opening card on the map, `&spells=fireball` teaches spells, `&army=knights:20,archers:30` sets the army, `&gear=twinWand,oldBanner` gives artifacts: worn if the slot is free, else in the pack), `?court=N` opens the court after commission N, `?commission=2` starts in the Fenmarch (3 to 5 are generated), `?reveal=1` lifts the fog.
- `npm test`: Vitest (rules, map, movement, bot). `npm run typecheck` and `npm run build`.
- `npm run sim [-- 50]`: the bot plays the commission for many seeds, per background, and prints a balance report. `npm run sim -- 10 --campaign` plays both commissions, court included. `npm run sim:battles` prints win chances for each fight.
- `npm run e2e`: plays the whole commission through the real UI on its own server; exit code 1 on failure.
- `npm run visual [-- --approve]`: frozen scenes, exact frame hashes against `test/visual.json`, PNGs in `screenshots/visual/`. Scenes drawn in the page, like the hero screen (`dom: true`), hash the screenshot instead. Don't edit files while e2e or visual run: the dev server reloads the page.
- `npm run shots`: ad-hoc screenshot of the running dev server (env: `QUERY`, `RIDE=x,y`, `OUT`).
- `npm run listen [-- stings|tracks|name]`: renders the music offline in headless Edge, through the game's buses and master, and prints peaks, loudness, how long stings ring and how tracks sound across their loop seam. Nobody can listen to it here: measure instead.
- `npm run deploy`: builds and publishes to GitHub Pages (the `gh-pages` branch of `origin`). Live a minute later at https://arturcrmbot.github.io/kings-commission/.
