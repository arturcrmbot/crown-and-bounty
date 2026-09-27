---
name: kings-commission-ship
description: >
  How to improve, playtest and ship King's Commission (the HoMM2-style browser game in this repo).
  Use after ANY change to the game, before telling Artur something is done, and whenever asked to
  playtest, polish, balance or deploy. Covers the playtest-as-an-experienced-gamer method, the
  quality bar Artur set, the test layers, and deploying to GitHub Pages
  (https://arturcrmbot.github.io/kings-commission/).
---

# Ship King's Commission

Artur's rules (27 Sep 2026): **every improvement gets deployed**, and **playtest it yourself,
properly, before reporting**. Fix what a player would hate, and keep going until *you* would enjoy it.
Never bring him obvious issues.

## The loop

1. **Change** something small and visible.
2. **Check** it: `npm test`, `npm run typecheck`, then as needed `npm run e2e`, `npm run visual`
   (look at the PNGs before `-- --approve`), and `npm run sim` / `npm run sim:battles` for balance.
3. **Playtest** it (below). Log the findings in `docs/PLAYTEST.md`: date, what you played, what felt
   wrong, and what you fixed. Fix what you found, then play again.
4. **Ship**: commit (with the Co-authored-by trailer), `git push`, then `npm run deploy`. Pages is
   live within about a minute: poll `gh api repos/arturcrmbot/kings-commission/pages/builds/latest
   --jq .status` until it says `built`. Then load the live URL in headless Edge and check it plays
   with no page errors (`URL=https://arturcrmbot.github.io/kings-commission/ node scripts/playtest.mjs`).
5. **Report** briefly: what changed, what you judged, and the live link. Only when you are happy.

## Playtest like an experienced gamer

Play the real UI, not the rules. `node scripts/playtest.mjs` plays through the opening and saves
numbered screenshots and card text to `screenshots/playtest/`. Look at every screenshot. Then make
your own choices through the `window.__kc` hooks. Judge as someone who knows HoMM2, King's Bounty and
modern RPGs:

- **First minute.** Is there a title screen, an intro, music, a reason to care? Would I keep playing?
- **Vibe.** Music for every screen, ambience, a warm and funny voice, portraits and characters.
- **Juice.** Every action answers back: a sound, a bit of motion, a number floating up. Cards
  arrive, gold chimes, hits shake, deaths fall, level-ups glow. Nothing happens silently.
- **Readability.** One scale for all sprites (see below). Threats read at a glance. Hover says what
  things are. The odds are honest, in plain words.
- **Pacing and gating.** The first enemy you can see should be too strong at first, so you explore,
  grow and come back. There should always be something worth riding to. No waiting around.
- **Combat.** Fair and readable: the forecast matches what happens, good tactics beat auto-resolve,
  no fight is lost to a surprise, and losses feel earned. Play at least one fight by hand.
- **Rewards.** Every fight and discovery gives something you can feel: new troops, spells,
  artifacts that change how you play, gold that buys something, levels with real choices.
- **Playstyles.** Each background must play differently, not just have other numbers. There should
  be several paths through each commission: fight, talk, sneak, cast, buy.
- **RPG depth.** Choices with consequences, characters who remember you, quests, builds.

Do this for every background at least through its first fights. Do the balance numbers
(`npm run sim -- 20 --campaign`) agree with how it felt?

## Scale bible

On the map, one tile is 32 px. A standing person is about 32 px tall, and the hero on his horse
about 52 px. Every enemy stack on the map is drawn as **one** creature at the same scale as in
battle (HoMM2 style). Its size shows as a word: few, several, pack, lots, horde, throng, swarm.
Buildings sit on the tile grid: huts are about 1 tile, mills and towers 2 to 3, castles 4.

In battle, a person is about 60 px tall. Goblins are about 0.75× that, trolls about 1.4×, and
mounted knights are wider.

## Gotchas

- The dev server is on 127.0.0.1:5188 (5173 belongs to another project; don't kill it).
- Playwright uses `channel: 'msedge'`. Scripts start their own server (`scripts/lib/server.mjs`).
- `?freeze=1` is for exact screenshots; `?seed=N` fixes the campaign; `?fresh=1` ignores the save.
  `?court=N`, `?commission=N`, `?battle=id`, `?reveal=1` and `?sceptre=1` jump straight to a scene.
- Saves are keyed by version (`src/game/save.ts`). Bump it when the state's shape changes or when
  generated maps come out differently for the same seed.
- Browsers only allow sound after a click or key press; M mutes.
- No image-generation models: all art, music and sound are made in code.
