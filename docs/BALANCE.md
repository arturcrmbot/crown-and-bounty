# King's Commission: balance

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
- **Ranger.** Beasts follow him only when he'd clearly win, at the odds the card calls *"You should win"*, not when
  it's merely close.
- **Courtier.** Talking the villain round and bribing a gate cost gold, and the budget sets how much (#79 gives the
  lair its parley). Gold is his mana.

## The budget and its levers

The budget is written down for each commission as the reference hero's strength by day, in the measure above. It's
moved with these levers:

| Lever | Where it lives | What limits it |
| --- | --- | --- |
| Army | leadership (`heroStats`), recruits and prices (`places/dwelling.ts`), the King's pay (`COMMISSION`), hires and taming (`places/enemy.ts`), veterans (`campaign.ts`) | leadership: 10 a level (`RENOWN`), chests, banners, the Leadership skill |
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

- **`npm run sim:curve`** (#94, to build) prints the table above for every background and commission, by day, for the bot
  and a careful player, against every enemy, with the budget beside it.
- **`npm run difficulty`** gets a checkpoint at the target day. At the villain, the reference hero wins 35% to 65%
  without the extras and 75% or better with them.
- **The bot plays like a person** (#94, which takes over #14). It fights with a margin instead of at the cliff's edge, takes the skills that
  multiply, uses parleys, and bribes as a Courtier would. The careful player above is its first draft.
- **`npm run sim`** and **`npm run sim -- 8 --campaign`** give the days each commission takes, against its target day.
- **`npm run sim:boss`** and **`npm run sim:battles`** stay as they are.
- **Artur's playtests.** Only a person can say whether it's fun.

Each balance PR moves one lever and shows the curve before and after.
