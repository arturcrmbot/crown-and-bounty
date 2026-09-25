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
- **Adventure map is turn-based by day:** each day the hero gets a movement allowance. (Artur asked whether real time would suit a browser better. Turn-based days are assumed for now.)

## Look

- **Target:** the look and feel of Heroes of Might and Magic 2's adventure map. **2D only.** On 25 Sep 2026 Artur rejected a 3D look test (pixel-art and toy-diorama renders of KayKit models): "it doesn't need to be 3D at all".
- **Plan:** pixel art at HoMM2's own 640×480, scaled up in whole pixels, with square 32 px tiles and HoMM2's screen layout (map view in a carved frame, right-hand panel with minimap, hero, buttons and status). A 256-colour indexed palette, with water animated by palette cycling as HoMM2 did.
- **Art sources:** CC0 packs where one fits, and code for everything else. No CC0 pack looks like HoMM2, so the look test draws its art in code.
- **Real HoMM2 art is possible only locally:** loading your own copy of the game's data files, as the fheroes2 project does. The game couldn't then be shared publicly.
- **No image-model art.** Artur rejected generated images.

## Stack

TypeScript and Vite, drawing to a 2D canvas. HTML/CSS for menus, panels and dialogs. Vitest for the game rules and Playwright for screenshots.

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

- **Battle format:** a hex battlefield with stacks, as in HoMM2, or King's Bounty's simpler grid?
- **Adventure map tiles:** square, as in HoMM2 (the look test assumes this), or hex?
- **Adventure map pacing:** turn-based days or real time?
