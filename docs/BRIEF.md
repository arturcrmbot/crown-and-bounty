# Crown & Bounty: brief

Crown & Bounty is King's Bounty (1990) rebuilt for the browser with the charm of Heroes of Might and Magic II. Its first
act is The Old King's Treasure. It's a small game, made for fun and not for sale. Until 30 Sep 2026 it was called King's
Commission (#147).

This is the design as it stands. `AGENTS.md` says where each part lives in the code, [WORLD.md](WORLD.md) holds the story,
[BALANCE.md](BALANCE.md) the difficulty, and [VOICE.md](VOICE.md) how the game's words are written. Where they disagree
on the story, WORLD.md wins.

## The game

- **The premise.** You are Aldric, King Osric's new officer, and you take bounties on the crooks who have run off with
  his country. Each commission is a province with a villain at the end of it. You have 100 days to bring him in
  (`LAST_DAY`), but a careful player does it in about three weeks.
- **The campaign.** Act I is five commissions. Aldmoor (Baron Grimsby) and the Fenmarch are made by hand, and
  commissions III to V are generated from the campaign's seed. Every bounty comes with a torn piece of an old map, and
  in the fifth commission the last piece marks where to dig up the Sceptre of Order. Only Commission I is open to the
  public (`LAUNCH` in `src/content/launch.ts`), and after it the court says more are coming. Commissions II to V are
  still the old ones and get rebuilt as `docs/act1/crooks.md` plans.
- **One hero.** Aldric is the only hero you ever have, and he's one of four backgrounds: the Knight of the Realm, the
  Hedge Wizard, the Ranger of the Greenwood and the Courtier, who is a bard. Each plays differently. His level, skills,
  perks, gear, gold and leadership carry over from one commission to the next. His troops go home, except a quarter of
  each stack who stay on as veterans.
- **The army.** Troops are just numbers, as in King's Bounty: 400 peasants are 400 peasants. Leadership caps the army.
  Troops draw wages every payday, which comes once a week.
- **The map.** Days are turns. Each day Aldric has so far to ride, and he visits places, makes choices and fights. The
  bands on the map guard, roam or hunt, and move at night. The villain rides out of his lair when you hurt him.
- **Battles** are HoMM2's, on an 11 by 9 hex field. Stacks take turns by speed. Aldric leads from behind his line,
  where nothing can reach him, and strikes, shoots or casts in his background's way. Enemy villains, captains and heroes
  lead the same way, and a side is beaten when its troops are. The sergeants (auto) fight with the same rules and AI.
- **Choices.** Places, quests, parleys and finds are pages of choices written as content, and a choice made in one
  place can open another later. The court remembers what you did.
- **The enemy's captains and heroes.** A villain can have named captains, such as Rook the Huntsman, and in Aldmoor
  every band of men has a hero with a level from 1 to 10. None of them ever joins Aldric.

## Artur's rules

- **Hint, don't tell.** Clues are quiet.
- **Nobody heals in a fight** (#239), on either side, because it only makes fights longer. The Fenmarch's healing goes
  when commission II is rebuilt.
- **No gimmicks** that cost code and add little.
- **Ship small and fast.** Every change goes through a pull request and deploys once CI is green.

## Look and sound

- **2D only,** at a 960 by 540 indexed framebuffer with one 256 colour palette, in the spirit of HoMM2's adventure map
  and battle screen. Artur turned down 3D on 25 Sep.
- **Painted art** (#178, #255). Aldmoor's map, the battlefield, the feast, and every troop's, captain's and Aldric's
  figure are painted from Retro Diffusion sheets and cut by `npm run mapart`. It's the only image model the game uses.
  Battle for Wesnoth's units lie under the paintings, where they time the blows and stand in until the paintings load.
  Everything else (the portraits, the title painting, the interface) is drawn in code.
- **Recorded sound** (#257). Every sound effect, and most of the land's sounds, is a recording made by a named person,
  cut by `scripts/sfx.py`. Only speech and a few small things are still made in code.
- **Music** is yubatake's MIDI tunes, played on GeneralUser GS's instruments. A map's music stays put and picks up where
  it left off after a battle.
- **The lettering** is Bounty Serif, cut from TeX Gyre Pagella, so it looks the same on every device.
- **Phones** are played sideways, by touch, with big buttons in the rails beside the picture.

## Licence

The game is GPL-2.0-or-later (`LICENSE`), as Wesnoth's units ask. Every asset is credited, with its licence, in
`public/assets/CREDITS.md`.

## Stack and tests

TypeScript and Vite, drawing to a 2D canvas, with HTML and CSS for the cards and the hero screen. The rules are plain
TypeScript with no DOM or timers, so the bot can play them headless. Hosted on GitHub Pages:
https://arturcrmbot.github.io/crown-and-bounty/

| Layer | What it proves | Command |
| --- | --- | --- |
| Unit tests | the rules, the content, battles, the map, the sound's data | `npm run test:fast` |
| The bot | a careful player wins whole commissions with every background | `npm run test:bot`, `npm run sim` |
| Play-through | the real UI, from the title to the court, by mouse | `npm run e2e` |
| Phone | the same by touch alone, on an emulated phone held sideways | `npm run phone` |
| Visual | frozen scenes, frame for frame, against baselines approved on a Mac | `npm run visual` |
| Artur | whether it's fun | the live game |
