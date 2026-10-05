# Crown & Bounty: balance

How each commission stays a proper challenge, as the code has it today. The history of how it got here is in the
issues (#94, #167, #239, #254) and in git.

## The climb

Aldmoor is a climb (#239). Its bands stand in five rings by the ride from the start (`ring` on each enemy), and a careful
player meets each ring on its days (`RINGS` in `src/rules/difficulty.ts`). The villain is at the top, on day 21
(`TARGET_DAY`).

| Ring | Days | Its bands |
| --- | --- | --- |
| 1, round the castle | 1 and 2 | the cutpurses on the King's road |
| 2, the fields and the downs | 2 to 5 | the poachers, the rustlers, the Baron's tax collectors, the wild boars |
| 3, the river and the chase | 4 to 9 | Grimsby's patrol on the old bridge, Pike's grain cart, the sounder of boars, the bears, the outlaws |
| 4, the heath and the crags | 8 to 14 | the highwaymen, the wolves on the heath, Grimsby's dig |
| 5, Darkwood | 12 to 20 | Rook's wolves from the kennels, the giant spiders, the Baron's pickets |
| The top | 21 | Grimsby's stockade, with the Baron at level X |

In each ring most bands are a fair fight that a careful player wins with losses, and about one is a step ahead, so he
comes back for it. The patrol on the bridge and Rook's wolves are gates (`gate`): only a diplomat hires them, and dearly.
Each ring lies further out than the one before, and `climb.test.ts` measures the rides.

## What the tests hold

`TARGETS` in `src/rules/difficulty.ts`, for every background, as the win chance against the median band of each ring:

- **On day I,** with the army he starts with, the first ring is a fair fight (50% or better). Everything from the river
  on is 35% or worse, and Grimsby 5% or worse.
- **Once rings 1 and 2 are done,** the river and the chase are mostly a fair fight, and Grimsby is still 5% or worse.

On the target day the villain should be about a coin flip for the army a careful player has by then, and about three
in four with everything he found and did as well (gear, sets, relics, spells, and the quests' rewards). That one is a
report, not a test.

## The levers

| Lever | Where it lives | Now |
| --- | --- | --- |
| Band growth | `BAND_GROWTH` in `src/rules/days.ts` | every band grows by a seventh each payday for three paydays. A villain grows at his own `grows` (Grimsby 3%) for five |
| Enemy heroes | `heroHelp` in `src/content/troops.ts`, `bookFor` in `src/rules/battle/battle.ts` | each level after the first lends his side a point of attack or defence, attack first. From level 3 he casts his troop's spells |
| Experience | `TEACHES` in `src/rules/fight.ts` | a fight teaches 0.6 of the fighting worth of what it beat |
| Levels | `LEVELS` in `src/rules/hero.ts` | II at 200, III 800, IV 1,500, V 2,300, X 8,700, which is about IX by Grimsby |
| A level gives | `src/rules/hero.ts` | two stat points, +10 leadership (`RENOWN`) and a skill, or +25 leadership instead (`RALLY`) |
| Leadership | `MUSTER` in `src/rules/places/dwelling.ts`, chests, banners, the Leadership skill | the steward sells 20 for 500 gold at the castle, as often as Aldric can pay |
| Who comes over | `outweighs` and `befriends` in `src/content/troops.ts` | none while his army is no stronger than theirs, all once it's twice as strong. Beasts follow a Ranger at half that: half a pack as strong as his army, all of one two thirds as strong |
| Mana | `DAWN_MANA` in `src/rules/hero.ts` | a quarter comes back at dawn, and a well or a castle fills it. Two casts a round at most (`MAX_CASTS`) |
| Bribes | `MAX_BRIBES` in `src/rules/hero.ts` | never more than half off, whatever he wears and knows |
| Captains taken | `PRICE_A_LEVEL` in `src/rules/ransom.ts` | 100 gold a level, paid at the castle |
| Attack and defence | `skillFactor` in `src/rules/battle/battle.ts` | 10% more damage a point of attack over defence, 5% less a point of defence over attack |

A band's power counts its hero: his own worth, and what his level lends each troop (`fightingPower` in
`src/rules/state.ts`). An enemy who holds the field keeps whoever of it still stands (`holding` in `src/rules/fight.ts`).

## How it's measured

Only a change that moves balance runs these, with at most 10 seeds a background.

- `npm run sim:curve -- 3` prints the careful player's strength by day in Grimsbys, the day each ring falls, his level,
  leadership and bands beaten, and Grimsby's odds on day 21.
- `npm run difficulty` prints the climb's win chances on day I and once rings 1 and 2 are done, and the careful player's
  odds at Grimsby's gate on day 21, with everything he found and on his army alone.
- `npm run sim -- 10` plays whole commissions per background and reports the day each is won.
- `npm run sim:battles` and `npm run sim:boss` print the win chance of each fight, and the army each background needs to
  beat a villain half the time.

A careful player is the bot (`src/rules/bot.ts`): it fights only with a margin and takes the skills that multiply. Only
Artur's playtests say whether it's fun.
