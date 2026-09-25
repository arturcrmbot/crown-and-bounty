# King's Commission: brief

Working title. A small browser game, not commercial. The goal is quirky and fun, with the charm of Heroes of Might and Magic 2 and the structure of the original King's Bounty (1990).

## Decided (with Artur, 25 Sep 2026)

- **Premise:** you are the King's officer, taking bounty contracts on villains. Each run is a new commission: a new province, a new set of villains, and a deadline of 100 days.
- **Runs:** 20 to 30 minutes on a freshly generated map each time.
- **No time loops or rewind lore.** Any bigger story runs quietly from one commission to the next.
- **Run shape:** explore the fogged map, open chests (gold or leadership?), recruit at dwellings, fight roaming stacks. Every 7 days is payday: the King pays you, your troops take wages, and dwellings restock. Beating a villain's castle earns the bounty and a torn piece of the map. Dig in the right spot for the sceptre to win. If you reach day 100 without it, you lose.
- **Characters vs troops:** your hero is the character, levelling up and learning skills, and maybe a second hero later. Troops are just numbers: 400 peasants are 400 peasants.
- **Captains:** the rare exception. Once your army is big enough, a notable creature can sign on and bring a small group of its own, such as a dragon captain who is fussy about her hoard. Two or three per run, each with a quirk.
- **Villains have gimmicks and personality,** for example Baron Grimsby, who stole the royal goose.
- **Tone:** warm, funny, storybook. The flavour text in `sketches/2d-map-mockup/` shows the voice.
- **One hero across a campaign** (25 Sep, after the first playtest): levels, skills and gear carry over, and each commission is a new province. RPG depth goes into build choices first (a background, then skills and perks), then story choices, then captains.
- **Battles are HoMM2-style:** a hex battlefield where stacks take turns, and the hero casts spells and uses skills. Auto-resolve uses the same engine.
- **Adventure map is turn-based by day:** each day the hero gets a movement allowance. (Artur asked whether real time would suit a browser better. Turn-based days are assumed for now.)

## Look

- **Target:** the look and feel of Heroes of Might and Magic 2's adventure map. **2D only.** On 25 Sep 2026 Artur rejected a 3D look test (pixel-art and toy-diorama renders of KayKit models): "it doesn't need to be 3D at all".
- **Plan:** pixel art at HoMM2's own 640×480, scaled up in whole pixels, with square 32 px tiles and HoMM2's screen layout (map view in a carved frame, right-hand panel with minimap, hero, buttons and status). A 256-colour indexed palette, with water animated by palette cycling as HoMM2 did.
- **Art sources:** CC0 packs where one fits, and code for everything else. No CC0 pack looks like HoMM2, so the look test draws its art in code.
- **Real HoMM2 art is possible only locally:** loading your own copy of the game's data files, as the fheroes2 project does. The game couldn't then be shared publicly.
- **No image-model art.** Artur rejected generated images.

## Stack

TypeScript and Vite, drawing to a 2D canvas. HTML/CSS for menus, panels and dialogs. Vitest for the game rules and Playwright for screenshots.

## Status (25 Sep 2026)

- **Look test:** done in 2D. A hand-authored 40 x 30 tile map, drawn in code: forests, a mountain range, a river and waterfall, landmarks, restrained fog of war and paper grain.
- **First playable loop:** in. Click to ride (pathfinding, daily movement, red marks for tomorrow), parchment cards for the hero and every place, a chest (gold or leadership), recruiting, the mill, payday every 7 days, two enemy types and Baron Grimsby's hideout.
- **Battles (M1):** HoMM2-style, on an 11 x 9 hex field. There are seven troop types and four spells (Lightning Bolt, Bless, Slow and Haste). You get an attack forecast on hover, can inspect any stack, and can retreat. "Let the sergeants handle it" auto-resolves with the same engine and AI, and the odds hint on each card comes from simulated fights.
- **Hero builds (M2):** four backgrounds (Knight, Hedge Wizard, Ranger and Courtier), each with its own army, stats, purse and signature perk. Battles and discoveries give experience. Each level raises a stat and offers a pick of three, drawn from 9 skills (three ranks each) and 6 perks. There are 10 artifacts in 5 slots, found on the map or bought at the castle armoury. The bot wins Aldmoor with every background, by day 7 to 10.

## Build order

1. **Look test:** one small 2D scene in the HoMM2 style. Artur judges it by eye.
2. **Playable 15-minute loop, little polish:** a small map, two fights, recruiting, payday and one contract. This proves the fun before anything gets polished.
3. **Battles:** make them look and feel great.
4. **Content:** full map generation, villains, captains, spells and digging for the sceptre.
5. **Polish:** art and juice throughout, and music later.

## Lessons from the previous project (Dungeon Breach, shelved)

- It had great architecture and polished combat, but it wasn't fun. Prove the loop is fun before polishing anything.
- Heavy process and huge instruction files made the agent slow. Keep docs short.

## Open questions

See also "Still open" in `PLAN.md`.

- **Adventure map tiles:** the prototype rides freely over an 8 px walk grid on a hand-painted map, with 32 px tiles only for authoring. Keep that, or snap to HoMM2-style square tiles?
- **Adventure map pacing:** turn-based days or real time?
