# Crown & Bounty: balance

How every commission becomes a proper challenge. Agreed with Artur on 29 Sep 2026, after he played Aldmoor end to
end as the Knight. Read with `BRIEF.md` and `PLAN.md`. The numbers were measured on main on 29 Sep, after #82 and #83,
on the old, small Aldmoor. Luck and morale (#84) and the bigger Aldmoor (#85) came in after, so the first job of
`sim:curve` (#94) is to measure them again.

## The problem

Artur: *"It's super easy to just overpower enemies... we are increasing the power of our hero exponentially without
really finding ways to balance it with the enemies' capabilities... As a Knight I literally didn't have to think at
all."*

Strength here is counted in **Grimsbys**: the multiple of Grimsby's stockade (46 swordsmen and 24 crossbowmen, with
the Baron's spells and orders) that Aldric's army beats half the time when the sergeants fight it out. At 1.0, a
fight with Grimsby as he starts is a coin flip.

| Aldmoor, in Grimsbys | start | day 9 | day 21 |
| --- | --- | --- | --- |
| Knight | 0.6 | 0.8 | 1.3 |
| Wizard | 0.6 | 1.8 | 1.8 |
| Ranger | 0.7 | 1.3 | 1.7 |
| Courtier | 0.7 | 2.0 | 2.0 |
| A careful player, any background | 0.7 to 0.9 | 1.6 to 2.1 | 1.7 to 2.1 |
| **Grimsby** | 1.0 | 1.04 | 1.09 (1.28 at most) |

The rows for backgrounds are the bot's, the median of three seeds, playing everything but Grimsby. The careful
player is the same bot, but it fights only when it could beat half as many again, and it takes skills at its
level-ups.

- Aldric grows two and a half to three and a half times in a week or two, and the enemies stand still. Grimsby takes
  on 5% more men a payday, five times.
- Leadership is full by about day 9, so strength levels off there, at about 2 Grimsbys.
- **Grimsby falls in the first week.** Artur took him on day 8, and the bot takes him on day 5 to 9 (the median).
  Commissions II to V fall on days 2 to 9, at levels 9 to 15 (`npm run sim -- 8 --campaign`).

**Where the power comes from.** At day 9 or 21, one source is taken away and the strength measured again:

| Source | Knight | Wizard | Ranger | Courtier |
| --- | --- | --- | --- | --- |
| A bigger army: recruits, tamed beasts, hired bands, and leadership from levels, chests and banners | ×1.9 | ×1.7 | ×1.7 | ×1.8 |
| Spells | ×1.1 | ×1.9 | ×1.1 | ×1.4 |
| Stats from levels (each point of attack is 10% more damage for every stack) | ×1.3 | ×1.3 | ×1.2 | ×1.1 |
| Gear | ×1.2 | ×1.05 | ×1.2 | ×1.1 |
| His own turn behind the line (a ride, bolts, arrows, songs) | ×1.0 | ×1.3 | ×1.1 | ×1.3 |

They multiply: the bigger army gets the stats, the gear and the spells.

**Fights are a cliff.** 10 knights and 24 archers lose to the wolves every time; with 32 archers, 240 gold at the
butts beside the start, they win every time. A fight goes from lost to won with about a sixth more army, so an enemy
is a wall one day and a walkover the next, and a hero who waits a day never has to think.

**Why the model missed it** (#14):

- The difficulty check's `explored` point is day 6, before the gates. That's where the Knight's 13% at the hideout
  came from. By the time a player reaches Grimsby, he has the gates' experience (about three levels), their loot, and
  a payday of recruits.
- On a cliff, a single number means little. The Knight's chance at the explored hideout was 94% before #36, 13% after
  it and #42, and 81% after #6. Each of those changes moved the commander's sums, not how hard the fight feels. The
  strength in Grimsbys moves far less.
- The bot fights as soon as its odds reach nine in ten, right at the cliff's edge, and loses most of its army doing
  it: the Knight bot beats the wolves on day 1 and keeps 5 of 42. So its curve sits below a player's.
- It takes the trick perk at every level, never Offence or Armourer, and its sergeants never bribe.

## The new map, measured (29 Sep, evening)

Measured on main after #85 to #123, on the new Aldmoor, with a careful player (the bot's routes, but it fights only
with a margin and learns the skills that multiply) and the greedy bot, 5 seeds a background.

| Aldmoor, in Grimsbys (careful player) | day 1 | day 3 | day 7 | day 10 | day 14 | day 21 |
| --- | --- | --- | --- | --- | --- | --- |
| Knight | 0.79 | 0.81 | 1.13 | 1.32 | 1.81 | 2.61 |
| Wizard | 0.83 | 0.99 | 1.13 | 1.16 | 2.68 | 2.75 |
| Ranger | 0.69 | 1.05 | 1.96 | 2.48 | 2.42 | 2.42 |
| Courtier | 0.90 | 1.10 | 1.43 | 2.23 | 2.48 | 2.68 |
| **Grimsby as he stands** | 1.0 | 1.0 | 0.83 | 0.69 | 0.67 | 0.71 |

- **Artur took Grimsby at level 3** with a few knights and archers. Hurt him (pay off the patrol, raid the dig), and
  he rode out with a third of his men; the starting army beats that guard ten times in ten (+440 experience, level
  III), and he fled home without it, for good. His stockade at 65% fell to one day's shopping (15 knights, 32
  archers) ten times in ten, for every background. Not a bug: the sergeants use his orders and his guard, and the
  card's odds are right.
- **He's sized for day 1.** His stockade is smaller than the patrol on the bridge. One day's shopping puts any hero
  at 0.8 to 1.1 Grimsbys, and the Courtier wins nine in ten on day III at level I, without a fight.
- **The bridge falls on day 2 to 4** for the bot (4 to 10 for the careful player) and pays four levels (1,152
  experience). Everyone is level 8 with full leadership by day 10 to 14, and the bot leaves 3,000 to 4,000 gold
  unspent. It takes Grimsby on day 9 to 12 (the median).
- **Where the power comes from** on day 21 (the careful player, one seed): the army ×1.7 to 2.8, spells ×1.2 (Knight)
  to ×1.8 (Wizard, Courtier ×1.7), stats ×1.2, gear ×1.1 to 1.25, skills ×1.1 to 1.2, his own turn ×1.0 to 1.2, luck
  and morale ×1.0 to 1.2.
- **Why the model missed it:** its `explored` point is day 15 on the new map, where Grimsby is 100% for everyone,
  but the boss has only a day-1 target.
- **The playtests** (#119, #129) add: bought-off stacks pay full experience; one charge of knights kills a stack
  and nothing strikes back; a skill's next rank comes at the very next level-up; and Grimsby never answers a second
  hurt.

The levers, in order, each a PR with the curve before and after:

1. Grimsby's guard straggles home after him, so the stockade stays whole, and a new hurt sends him out again (#131).
2. Stacks paid off or bought over teach half what beating them would (Artur's call), as a surrender does (#132).
3. Slower growth: +5 leadership a level, not +10 (#97), and a skill's ranks spread over the level-ups (#133).
4. The Knight's charge has an answer: a stack that charges is winded, and can't strike back for the rest of that
   round and the next (#134).
5. Beasts follow at nine in ten (#98, #136); a quarter of the Wizard's mana comes back each dawn, and a holy well or
   his castle fills it (#99, #138).
6. Grimsby and the gates sized to the new curve (#95), with a day-21 check in `npm run difficulty`, and
   `npm run sim:curve` (#94): the bot now plays as the careful player does.

## Aldmoor resized (29 Sep, night)

**Artur, that evening:** no target numbers. *"As long as the game is fair now I will play it and let you know if it's
too easy or hard. But don't aim for some arbitrary number."* So the coin flip on day 21 is no longer a target, and no
test holds Grimsby to one. `npm run sim:curve` and `npm run difficulty` still report the numbers below; Artur's play
decides.

With all six levers in: Grimsby's stockade is half as big again as it was (69 swordsmen, 36 crossbowmen, was 46 and
24), and he recruits 3% a payday, not 5%; the patrol on the bridge is 70 swordsmen and 40 crossbowmen (was 50 and 29);
Rook has 100 wolves (was 84); and Grimsby rides out with a fifth of his men, not a third. 1.75 times the stockade was
tried first (the table below): the play-through's plain player, who takes the first thing offered at every level-up,
couldn't take him by day 79, so he was eased to 1.5. `npm run sim:curve -- 3`, a careful player, at 1.75:

| Aldmoor, in Grimsbys | day 3 | day 7 | day 10 | day 14 | day 17 | day 21 | the bridge falls | Grimsby on day 21 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Knight | 0.83 | 1.02 | 1.26 | 1.43 | 2.75 | 3.06 | day 12 | 100% (100% on his army alone) |
| Wizard | 0.99 | 1.23 | 1.16 | 2.29 | 2.42 | 2.35 | day 11 | 100% (100%) |
| Ranger | 1.08 | 1.29 | 2.07 | 2.23 | 2.54 | 2.54 | day 9 | 100% (63%) |
| Courtier | 1.10 | 1.43 | 1.43 | 2.01 | 2.61 | 2.61 | day 12 | 100% (94%) |
| **Grimsby as he stands (at 1.75)** | 1.74 | 1.74 | 1.79 | 1.79 | 1.85 | 1.85 | | |

Before, Grimsby stood at 1.0 and fell to 0.7 once his guard was beaten, the bridge fell on day 2 to 4 (the bot) or 4
to 10 (the careful player), and the bot took him on day 9 to 12, at level 3 by the sortie. Now:

- **The bridge holds for a week and a half,** and Rook's wolves for nearly two (they may fall on your camp first).
- **Grimsby is out of reach for the first two weeks,** at 1.75 and so at 1.5 too. At 1.75 the bot took him on day 16 to
  26 (10 of 12 Knight seeds); twice the stockade (tried first) left a bot beaten once at his walls unable to get back.
- **The Wizard and the Ranger are a week ahead.** The Wizard's own spells carry him (his mana is full for the one
  fight), and the Ranger has all his levels by day 10.
- The bot storms Grimsby once it likes the odds, from day 21 at a coin flip, and later at worse: an army raised again
  at the castle may do better, and it never sits out the commission.
- **What's left is Artur's playtest.** Measure again with `npm run sim:curve` if he finds it too easy or too hard.

## Power decides, and leadership you can grow (30 Sep, afternoon)

Artur, after the Courtier found Aldmoor easy and the Ranger hit a wall (#167, #171): *"In Heroes of Might and Magic
it's a single number... the total strength of the army... and that should decide things like bribing."* And the
Ranger: *"There is no real good way to increase leadership, and without leadership you cannot increase the size of
your army."*

- **Who comes over is one number, power** (`outweighs` in `content/troops.ts`): the fighting worth of an army. Nobody
  comes while your army is no stronger than theirs, all of them once it's twice as strong, and in between, as much as
  it outweighs them. Whoever doesn't come attacks at once. That's the same for bands hired and a stack paid off in
  battle, and beasts tamed followed it too until 2 Oct (below). A stack paid to go home costs 2 gold for every point of its power, or 6 to come over, and no
  bribe is ever more than half off. Whoever comes teaches half what beating him would, and a band hired whole hands
  over what it carried, as one that surrenders does: its takings, its gear and its story (#231). So a day-one Courtier can't buy Grimsby's swordsmen (they're twice his army) until
  his army outweighs them, and a Ranger's day-one army wins 4 of the 7 bears and fights the other 3.
- **Troops who draw no wages need no leadership:** beasts, and the old King's huntsmen. They still need one of the five
  companies.
- **Leadership he can always grow:** +25 in place of a skill at any level-up (`RALLY`), and 20 for 500 gold from the
  steward at his castle, as often as he can pay (`MUSTER`), on top of the 5 a level, the chests, banners and skill.

## The enemy keeps its losses (30 Sep, evening)

Artur ticked it in #167 and #171. Until now a band, a convoy or a lair was whole again after every fight it held, so each
try at Grimsby's stockade started from scratch. The Wizard's defeat there killed 69 of its 73 swordsmen and every
crossbowman, and his next try met all of them again. Now a retreat or a defeat leaves the enemy's losses standing, as in
HoMM2 (`holding` in `rules/fight.ts`).

- The enemy keeps whoever of it still stands. Those paid to go home or to come over are gone for good.
- The guard the Baron calls to the field can make up his losses, but never leaves him more men than he had, so a fight
  never makes him stronger.
- The lair recruits its 3% a payday from what's left. A sortie's band and a convoy's squad go home with whoever is left
  of them. A band beaten in the open still straggles home as many as rode into that fight (#131).
- It softens the wall for a player who loses there, and takes nothing from one who wins. A veteran could wear a lair down
  with throwaway attacks, but each one costs him his whole army (a defeat) or a quarter of every company (a retreat).

`npm run sim -- 10`, the careful player, before and after. Every run is won both times.

| Days to take Grimsby: median, 90th percentile | Knight | Wizard | Ranger | Courtier |
| --- | --- | --- | --- | --- |
| Before | 17, 21 | 12, 16 | 11, 44 | 12, 33 |
| After | 17, 21 | 12, 16 | 11, 14 | 12, 25 |

The careful player rarely loses a fight, so only the 3 runs of 40 that lost at Grimsby's walls changed. The Ranger's seed
10 lost there on day VIII with the stockade nearly beaten, and his next army took the 10 men left on day XIV, where
before it waited until day XLIV. The Courtier's seed 3 took him on day XX, not XXXIII, and seed 9 on day XVIII, not XIX.

## The lullaby, the gates and taming (2 Oct)

Artur's calls 3 to 5 in #167, built small, with one quick `npm run sim -- 5` before and after.

- **The lullaby** (#232) works only once Grimsby has been beaten in the field (his band, met in the open, sets
  `baronRouted`), and at the stockade it sends two in five of his garrison home to their mothers instead of winning it.
  Before, a Courtier who asked Old Nan took Grimsby on day 7 at level II with 41 troops.
- **Gates** cost three times as much to pay off: the bridge 2,700 gold (1,350 for a Courtier), and an expert diplomat's
  hire of a gatekeeper 18 gold a point of power instead of 6. A day-one Courtier paid the bridge 450 of his 2,400 gold;
  now it's the gate or about a week of recruits.
- **Taming** stays before the fight, with the rest of the pack attacking at once, and is far stronger for the Ranger,
  the hero beasts follow (`beastMaster`): `befriends` in `content/troops.ts` brings none from an army half as strong as
  the pack or weaker, half of a pack as strong as his army, and all of one two thirds as strong (it was none at parity
  and all at twice as strong). In the Ranger's playtest (#219) his day-9 army won 3 of Rook's 100 wolves; it now wins
  53. Anyone else who tames (the Hawthorn Crown, Beast Friend) wins over as many as his army outweighs, as before. A
  first try made the curve everyone's, and the bot's Knight, who takes the crown, won in a median 12 days, not 18.
  Taming costs the rest of the day, and needs half a day's riding left, because the beasts take till dusk to come
  round (as every `tamed` line says), and a day is the one thing every hero runs short of.

`npm run sim -- 5`, the careful player, before and after. Every run is won both times. Five seeds is a quick look, not
a measurement, and the bot never sings or pays a gate off, so it sees mostly the taming.

| Days to take Grimsby: median, 90th percentile | Knight | Wizard | Ranger | Courtier |
| --- | --- | --- | --- | --- |
| Before | 18, 25 | 10, 16 | 8, 12 | 17, 20 |
| After | 15, 16 | 11, 17 | 10, 11 | 12, 20 |

## The approach

1. **A power budget for each commission.** Each commission has a target day for its villain and a reference hero:
   what a careful player has by then. For Aldmoor that's about day 21 (#77, #95), three weeks later than now. Every enemy
   is sized against the reference hero on the day he's meant to meet it, not against the hero of day 1.
2. **Caps on the big three.** The army, stats and gear, and spells still grow, but more slowly and up to a ceiling.
   That keeps the reference hero predictable, and a player who grinds can't run away from the budget. The rise has to
   slow as well as stop: today he's at his ceiling by day 9, so a stronger Grimsby alone would only move the coin flip
   to day 9. The bigger Aldmoor (#85) spreads the rewards over three weeks, and the caps slow what each one adds.
3. **A fix for each background that has a runaway of its own:** the Wizard's mana (#99), the Ranger's taming (#98)
   and the Courtier's prices (#96). The Knight has none, so the budget is his fix.

After that, in this order: smarter enemies (captains, #15; troop abilities, #7; boss fights, #16), then difficulty
levels (#20) as a dial on top of the budget. Not chosen: enemies that grow with Aldric, since growth has to feel like
growth.

**What the classics did.** King's Bounty (1990) capped every stack by leadership: a stack with more hit points than
your leadership went out of control. It took weekly upkeep, and gave you 900, 600, 400 or 200 days by difficulty.
Heroes II had no leadership. Its wandering monsters grew every week, and difficulty changed your starting gold and
the computer players. We take King's Bounty's leadership cap.

## What a proper challenge is

**The villain.** On the target day, with the army a careful player has by then and nothing else, the villain is a
coin flip. What tips it is everything the hero found and did: gear and sets worn, relics, spells from shrines, and
quest rewards (the goose's hymn, Pike's journal, the Baron's orders). With all of them, he wins about three times in
four. Artur: *"since you get new army after it should be a hard fight... a coin flip unless you are using all your
equipment / artifacts / quest rewards etc."* Losses at the lair don't matter: the army goes home afterwards. Before
the target day, he's out of reach, as now: 5% at most on day 1.

**Gates** are too strong at first (35% at most) and beatable once you've explored (75% or better), as now. With the
budget, "explored" moves to where a player really is when he reaches the gate.

**Pests and bands** stay as they are: pests are won from the start, and bands are fair fights.

**Every commission** follows the same rule (#101), at its own target day, for the hero the campaign carried there. Generated
provinces stop growing by a flat fifth, and each is sized to the reference hero it expects. The crooks of commissions
II to V (proposed in #86) escalate in kind: rabble, then skill, then armour, then the best of everything. The budget
sets how many.

**Each background:**

- **Knight.** Nothing of his own. Grimsby is a coin flip without the extras, so the gear, the sets and the quests are
  how he wins.
- **Wizard.** His mana stops coming back in full every dawn. A quarter comes back, and a mana well or a castle fills
  it. His spells stay strong, but he has to choose where to spend them.
- **Ranger.** Beasts follow him as far as his army outweighs them, and the rest attack (30 Sep, below). They need no
  leadership.
- **Courtier.** Talking the villain round and bribing a gate cost gold, and the budget sets how much (#79 gives the
  lair its parley). Gold is his mana, and his army's power decides how much of a stack his gold can buy.

## The budget and its levers

The budget is written down for each commission as the reference hero's strength by day, in the measure above. It's
moved with these levers:

| Lever | Where it lives | What limits it |
| --- | --- | --- |
| Army | leadership (`heroStats`), recruits and prices (`places/dwelling.ts`), the King's pay (`COMMISSION`), hires and taming (`places/enemy.ts`), veterans (`campaign.ts`) | leadership: 5 a level (`RENOWN`), or 25 in place of a skill (`RALLY`), 20 for 500 gold at the castle (`MUSTER`), chests, banners, the Leadership skill; troops who draw no wages need none. Who comes over is power (`outweighs`) |
| Stats | level-ups (`LEVELS`, each background's `growth`), the court's boons | 10% more damage per point of attack over defence, 5% less per point of defence (`skillFactor`) |
| Gear | `content/artifacts.ts`, sets | seven slots |
| Spells | `content/spells.ts`, mana (ten a point of knowledge) | two casts a round (`MAX_CASTS`), mana at dawn (`endDay`) |
| Experience | `battleXp` (the worth of what's beaten), finds, parleys | the level curve (`LEVELS`) |
| Enemies | each province's content, `grows`, `strengthFor` | the budget |

**The caps:**

- **Leadership limits the army** (#97). It grows more slowly (fewer points a level, from chests and from banners), so the
  army a player can lead on the target day is known.
- **Stats and gear grow more slowly** (#100): smaller gains, or less from each point.
- **Mana comes back a quarter at a time** (#99).

## How it's measured

- **`npm run sim:curve`** (#94) prints the table above for every background in Aldmoor, by day, for a careful player (or
  `--bot`, the old reckless one), with Grimsby as he stands, the day each gate falls, and his odds on day 21.
- **`npm run difficulty`** also reports a careful player on day 21 in Aldmoor, who has done everything but the villain:
  his odds at Grimsby's gate with everything he found, and on his army alone. A report, not a target.
- **The bot plays like a person** (#94, which takes over #14). It fights with a margin instead of at the cliff's edge, and
  takes the skills that multiply. Still to come: parleys, and bribing as a Courtier would.
- **`npm run sim`** and **`npm run sim -- 8 --campaign`** give the days each commission takes, against its target day.
- **`npm run sim:boss`** and **`npm run sim:battles`** stay as they are.
- **Artur's playtests.** Only a person can say whether it's fun.

Each balance PR moves one lever and shows the curve before and after.
