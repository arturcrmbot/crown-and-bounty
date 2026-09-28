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

Artur's rules: **every improvement gets deployed** (27 Sep 2026), and **fast** (28 Sep: "I want to
just play this, and I'll tell you if something is not working"). Ship small slices as soon as they
work; GitHub Actions does the long checks. Fix what a player would hate.

## The loop

1. **Change** something small and visible.
2. **Check** it locally: `npm run typecheck` and the tests for what you touched
   (`npx vitest run <files>`). That's all. CI runs the rest on the pull request: the unit tests, the
   build, the bot's whole commissions, and the play-through with a playtest per background.
3. **Playtest** only what a test can't judge (how a new screen looks, how a fight feels), quickly.
   Artur playtests and reports; his findings become GitHub Issues.
4. **Ship** through a pull request, never a push to main. Commit with the Co-authored-by trailer, and
   put `Fixes #N` in the PR. Green factory PRs merge themselves unless labelled `hold`, and main
   deploys a few minutes later. If main breaks, an issue labelled `ci` opens itself. `gh run watch`
   follows a run. Don't run `npm run deploy`.
5. **Report** in a line: what changed, and the live link.

Visual scenes are approved on a Mac (`npm run visual -- --approve`, after looking at the PNGs). CI
runs them only by hand, and only reports.

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

When you do play, try every background at least through its first fights. CI's balance report
(the run's summary) says whether the bot still wins every commission with each.

## Scale bible

The troops and the hero are Battle for Wesnoth's units, whose people stand about 43 px tall in their
72 px frames (`src/render/scale.ts` holds the numbers). Each unit keeps the size Wesnoth gave it next
to a person: goblins small, trolls big, knights on horseback wide.

On the map, one tile is 32 px. Every enemy stack is **one** creature (HoMM2 style) at `MAP_UNIT` 0.9:
a person about 39 px tall, brightened a touch and inked round so it reads on the grass. Its size
shows as a word: few, several, pack, lots, horde, throng, swarm. The hero goes at his own size
(`MAP_HERO` 1) in his background's figure (`heroArtId` in `src/render/units.ts`), in a gold ring: the
easiest thing to find on the map. The Knight rides Wesnoth's Horseman (about 64 px with our blue
pennant); the others go on foot, about 45 px: the Wizard an Arch Mage, the Ranger Wesnoth's Ranger in
his green hood (never to be mistaken for a Poacher), the Courtier a Master at Arms in a plumed hat.
Their portraits agree with the figures. Buildings sit on the tile grid: huts are about 1 tile, mills
and towers 2 to 3, castles 4.

In battle, units are drawn at `BATTLE_UNIT` 1.5: a person about 65 px tall, most of two hex rows as
in HoMM2. Goblins come out about 45 px, trolls 80, a mounted knight 105 with his lance. The three
villains stand a quarter taller (`VILLAIN`), so the boss reads at a glance. Aldric fights on the field in
his background's figure at battle size, in the gold ring he has on the map, with a health bar where a stack
has its count (the villains too); the King's star flies at the field's edge.

## Gotchas

- The dev server is on 127.0.0.1:5188 (5173 belongs to another project; don't kill it).
- Playwright uses `channel: 'msedge'` locally, and Playwright's own Chromium in CI (`CHANNEL=bundled`). Scripts start their own server (`scripts/lib/server.mjs`).
- `?freeze=1` is for exact screenshots; `?seed=N` fixes the campaign; `?fresh=1` ignores the save;
  `?hero=ranger` (with a debug start such as `?battle=wolves`) picks the background.
- Anything that grows a hero (a signature, a skill) can break a gate: run `npm run difficulty` after, and keep
  every tier inside its targets.
- The game opens on the title and the prologue. Scripts press `New campaign`, `At your service`, `I’ll bring him in`, then a hero; `?quick=1` skips all of it.
  `?court=N`, `?commission=N`, `?battle=id`, `?reveal=1` and `?sceptre=1` jump straight to a scene.
- Saves are keyed by version (`src/game/save.ts`). Bump it when the state's shape changes or when
  generated maps come out differently for the same seed.
- Browsers only allow sound after a click or key press; M mutes.
- No image-generation models. The units are Battle for Wesnoth's (`npm run wesnoth`; every file is
  credited in `public/assets/CREDITS.md`, and the game is GPL-2.0-or-later); all other art, music
  and sound are made in code. A new unit or frame goes in `src/render/units.ts`, then
  `npm run wesnoth -- --palette --credits`.
