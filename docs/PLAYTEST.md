# Playtests

Newest first. Each entry says what was played, how it felt to an experienced player (HoMM2, King's Bounty,
modern RPGs), and what was done about it.

## #2: 28 Sep 2026, after R1, R2's juice and R4's signatures, all four backgrounds

**Played:** `scripts/playtest.mjs` with each background (title, prologue, the first day, the patrol by hand and
on auto, the tower, the castle). Also: every signature in a real battle (the knight's charge against the
wolves, the ranger's volley, the wizard's casting), the ranger riding into the woods, the courtier hiring
highwaymen and bribing the patrol, the court into the Fenmarch, and generated provinces' villains. Then
`npm run e2e`, `npm run sim -- 4`, and one full campaign per background (`npm run sim -- 1 --campaign`).

**How it felt:** the first minute finally has a mood. The painted sunset, the title tune, the King's welcome and
the WANTED poster give a reason to ride out, and picking a face and a way to win beats picking a row of
numbers. Battles read at a glance and have weight. The four heroes now play differently on the map and in a
fight.

**Found and fixed:**

1. The last card of the prologue ran off the bottom of the frame. It now leaves out the brief the poster has
   just given, names the hero's signature, and sits to the left of the throne so the King stays in view.
2. A new province's arrival card covered its name ribbon, and the ribbon could hide the hero. Cards now wait
   until the name has had its moment, and the ribbon moves to the bottom when the hero is near the top.
3. Gold, troops and experience rose off the hero *under* the card that announced them. Gains now wait for the
   card to close, gold piles skip their card (the gold rises instead), and a level-up card waits for the glow.
4. The damage numbers began inside the new, taller fighters, and a big troll hid the goblins' count. Numbers now
   rise from above each head, stack instead of overlapping, and counts are drawn last.
5. The courtier could pay a band that had no room under his banner. He now pays only for those he can lead,
   and the button says so.
6. The signatures broke the gates: the knight crushed the wolves on day 1, and the ranger had a 13% shot at
   Grimsby from the start. The wolves are now 80 (from 64), the charge adds a quarter (not half), and there's
   no volley at a villain's walls. Every difficulty target holds again.
7. The first frame's clock could run backwards (a negative `dt`), which crashed the title.

**Still open (balance is parked, as agreed):** the bot's ranger now wins Aldmoor by day 4 through the woods,
and the courtier (who doesn't hire yet in the bot) takes 11 to 23 days. Fogged landmarks show as dark blocks at
the map's edge. The battlefield is still mostly empty grass between the armies. Rewards (R3) and quests and
captains (R5) are next.

## #1: 27 Sep 2026, the live build, Knight, Aldmoor opening

**Played:** a fresh campaign through the real UI (`scripts/playtest.mjs`): the opening card, the map, the gold,
the chest, the patrol by hand and on auto, the tower and the castle. Plus `npm run sim:battles`.

**How it felt:** like a spreadsheet with a pretty map. I wouldn't have stayed past the first fight.

1. **No vibe.** No title screen and no intro. The game opens on a wall of text over a dimmed map. There's no
   music at all, and no ambience. Nobody has a face: not the King, not Grimsby, not me. The only reason to care is
   one line about a goose.
2. **Choosing who I am is picking a row of numbers.** "Knights get +1 attack and +1 defence." The four
   backgrounds play the same way.
3. **The sprites don't share a scale.** The hero is about 57 px tall and the patrol's soldiers about 18. Chests
   are 12 px, the troll 52 px and the goblins 12. In battle there are two lonely 40 px figures a side on a huge,
   empty field of grass.
4. **No gate, then a wall.** The patrol is the first enemy you see, and it is a pushover: on day 1 it says "They
   look nervous", the starting army wins 40 out of 40 in three rounds, and you lose 13%. The wolves are the same.
   Then Grimsby's hideout costs 57% of the army. There is nothing to fight in between, and no reason to explore
   before fighting.
5. **Fights are short and flat.** Two or three rounds, two stacks a side, and no decisions that matter much. Auto
   plays them as well as I do.
6. **The rewards are dull.** 300 gold, a +1 attack knife, and 466 experience, which is two levels on day 1.
   Nothing changes how I play. Level-ups offer +7% this and +400 gold per payday that.
7. **No juice.** Picking up gold is silent and still apart from a number in the HUD. Cards pop in without
   motion. A day passes with nothing but a card. Enemies just vanish. A win has no fanfare on the field.
8. **Few paths.** You can fight, and sometimes bribe. No quests, no characters, no choices that echo later.

**Plan:** in order of how much they hurt the first ten minutes:

- **R1, vibe:** music for every screen and ambience, all in code; a painted title screen; an intro at court
  with the King, a WANTED poster and the background choice; portraits on cards.
- **R2, scale and juice:** one scale bible for all sprites, with each map enemy as one creature and a size word;
  bigger fighters and a livelier battlefield; floating gold and experience, a glow on level-up, dusk and dawn,
  cards that unfold, hits that shake, bodies that fall.
- **R3, gating and rewards:** small fights near the start, the patrol as a real gate, honest odds, a slower
  experience curve, and rewards that matter: new troops, spells, shrines, artifacts.
- **R4, playstyles:** each background gets its own mechanics. The Knight charges and duels. The Wizard casts on
  the map and finds spells. The Ranger rides through forests, ambushes and tames beasts. The Courtier gets
  enemies to join him, bribes and hires mercenaries. Every enemy can be fought, talked to, sneaked past, cast at
  or bought.
- **R5, RPG:** quests with choices, captains, and more troop types.
