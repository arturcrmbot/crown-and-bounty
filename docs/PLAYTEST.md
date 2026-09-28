# Playtests

Newest first. Each entry says what was played, how it felt to an experienced player (HoMM2, King's Bounty,
modern RPGs), and what was done about it.

## #5: 28 Sep 2026, enemies that really fight, and fair odds

**Played:** fights by hand with every background, through the real UI in headless Edge, one decision at a
time: a Knight against the patrol on day 1, the wolves with nothing but Defend, and the patrol with an army the
card rates 50/50. A Ranger's volley against the patrol, a Wizard's spells against it, and a Courtier who hires
the highwaymen and takes them to the boars. The Fenmarch goblins hunting a weak Knight. Then the bots: close
fights for every enemy of every commission, `npm run difficulty`, and the campaign sim.

**How it felt:** the enemy now fights like it means it. The patrol's swordsmen march past my knights to get at my
archers, pin them and cut them down, while the crossbowmen keep shooting. When my archers stepped out of reach,
the swordsmen turned on my knights, and the crossbowmen joined in. Wait and Defend matter: waiting lets the
knights act last in one round and first in the next. Spells matter even more: Slow halves the swordsmen's march,
four Lightning Bolts and a Hasted, Blessed charge wiped out the crossbowmen. Losing to a gate on day 1 felt
earned, not unfair.

**Found and fixed:**

1. Enemy fighters closed in on whoever was nearest. They now make for your shooters, gang up on a stack that
   has already struck back, and finish off wounded stacks. Their shooters keep shooting, and one caught in melee
   steps out of reach when it can. Trolls count on their healing. In close fights (every enemy, the army
   scaled to 50/50 against the old enemy) the sergeants now win 43% instead of 50%.
2. A battle ended as a retreat after three quiet rounds even while the enemy was still marching at you, so
   waiting for slowed trolls cost a quarter of the army. Quiet rounds now count only while the enemy gets no
   closer. If it has no way through to you at all, it's a stand-off: both sides draw off and nobody is lost.
   Keeping out of its way on purpose is still a retreat.
3. Hunters could fall on the camp on the first night, from out of the mist, even at the hero's castle. That
   was the Courtier bot's loop in commission III: the Hunting Hounds ambushed it at home every few days, so it
   rebuilt and lost again until day 100. Hunters now pick up the trail first. At dawn the card warns you and the
   mist lifts round them, and they only fall on the camp if you're still in reach the next night. They never
   come into a castle or village, and the ambush card gives the odds. The bot runs from ambushes it would lose
   and shelters in town when hunted. The same seed now wins commission III on day 65.
4. Playtest #4's open point: the sergeants beat the patrol for a day-3 Knight 15 times in 16, and careful hand
   play lost. They won by circling: knights beside the swordsmen rode three hexes round them and charged again,
   every turn, so nobody ever struck back. A charge now needs a run-up started clear of the enemy. The card for
   that Knight now says what hand play found.
5. The Ranger's free volley aimed at the biggest stack. It now aims where the arrows take the most, enemy
   shooters first.

**Checked:** with a 50/50 army (13 knights, 28 archers, 20 peasants) I lost my archers by hand, then handed over
to the sergeants, who won with two knights left. They play about as well as a careful player, not better. In Aldmoor's
close fights a player who always attacks won 32%, the sergeants 45%, and one who looks a round ahead 60%. Defend alone
against the 84 wolves is a defeat. The hired highwaymen fight, and the Courtier beat the boars without a loss.
All tests pass, every difficulty target holds, and the bot wins all five commissions with every background.

**Still open (balance is parked, as agreed):** the Wizard's bolts make later commissions easy, even with a tenth
of the army. The Courtier bot's commission III on that old seed takes 65 days. A version of the sergeants that
plays out the enemy's reply wins 53% of close fights instead of 45%, at twice the cost: worth trying if auto
should play sharper.

## #4: 28 Sep 2026, Artur's first commission as a Knight

**Played:** Artur played the live build from the title, through Aldmoor, as a Knight. Then we checked the fixes
through the real UI: a Knight who loses his archers to the patrol and buys more, level-ups for all four
backgrounds, a melee filmed frame by frame, soldiers at map and battle size, a 20-minute session, and the bot's
five commissions.

**What Artur said, and what was done:**

1. No music until he clicked his hero, so none in the intro. Fixed (c95fdd2): the title waits for "Click
   anywhere to begin", sound wakes on any first click, and a Sound/Muted button sits top right.
2. Loves the title screen. The map disappointed: "the characters need to become a lot more cute." Every
   humanoid soldier is redrawn chibi-style (big head, shining eyes, round body, big boots) for now (308e87c).
   The troop figures are being replaced with Battle for Wesnoth's art.
3. Many perks and finds feel meaningless: read some text, get "+1 defence". Six trick perks (Cavalry Charge,
   First Volley, Woodsman, Battle Mage, Silver Tongue, Far Sight) teach another hero's trick. Every level offers
   one while any are left, marked "(new trick)". The Old Tower Banner also gives archers +1 attack and +3 shots.
   The Miller's Everlasting Loaf gives +25 movement a day and makes wages a tenth cheaper (308e87c).
4. Likes exploring, that losing isn't the end of the world, and recruiting around the map. Kept.
5. Lost his archers to the patrol and had no ranged troops to hire. Aldmoor Butts, an archery range beside the
   start, sells 12 archers at 30 gold and 10 more each payday. The first generated province's village sells
   archers too (308e87c).
6. "Massive bug": pressing Defend until the wolves and boars ran away won every reward. Fixed (c95fdd2):
   enemies never wait or defend, and a quiet battle only counts as a win against a far weaker enemy.
7. "Let the sergeants handle it" beat a grown Grimsby full of crossbowmen when he had no archers. Since
   c95fdd2, 15 knights and 12 swordsmen lose that fight 8 times out of 8.
8. Can see how differently a Ranger or a Wizard would play. Kept.
9. Hitting "just does it". Melee now winds up, lunges and knocks the target back with a flash and a spray of
   blood. The spark is bigger and the shake grows with the damage (308e87c). Wesnoth's attack frames should
   finish it.

**Found and fixed while checking:**

1. The game froze after about 12 minutes on one page. The palette's colour cycling went negative and threw on
   every frame, so the live site had this bug. Fixed, with a test, and a 20-minute session now runs clean.
2. Counts dropped before the blow landed, because the rules settle the whole exchange at once. Each stack now
   keeps its count until its own hit lands, so the attacker's loss shows when the strike-back lands.
3. The new lunge carried the attacker's badge onto the target's, so "15" and "42" read as "1542". Badges stay
   on their hex and follow a stack only while it walks.
4. Damage numbers on the top row rose under the message ribbon. They now stop below it and stack downward there.
5. A save from before this batch had no butts. A save now gains any place added to its province since.
6. A place drawn in front of the hero takes the click (308e87c). A hero at the butts' foot stands in front of
   them, so his own card opens, as it should.

**Checked:** a Knight on day 3 loses the patrol fight, buys 12 archers at the butts for 360 gold, and the butts
restock to 10 on payday. Every level-up offers a trick until all are learnt, never one the hero has, with every
background. Soldiers read at map size (about 34 px) and in battle. The bot wins all five commissions with every
background (days: knight 17/3/2/9/5, wizard 6/2/2/3/10, ranger 23/2/2/2/9, courtier 5/4/2/10/10), so the
courtier's commission III loss is gone. The bot test allows 60 days, since a bot that storms Grimsby too early
takes weeks to rebuild.

**Still open:** the patrol's card says "They look nervous" to a day-3 Knight with 15 knights and 20 archers.
The sergeants do win 16 fights out of 16 from there, but careful hand play lost. That goes to the battle AI work.

## #3: 27 Sep 2026, rewards and choices that come back

**Played:** a Hedge Wizard through the talk-and-trick route (Old Nan's Stone Skin, the highwaymen for their
letter, the orders on the patrol, the poachers for their venison, the venison on the wolves) and a Knight who
spares the poachers, opens their cache and fights the highwaymen with the horn. A Fireball in battle. A generated
province's standing stones. Then the bot on the new routes, for every background and four seeds.

**How it felt:** Aldmoor now asks questions. The poachers' card offers a fight, a pardon or (for a courtier) a
job, and each answer changes what the wolves and the cottage will offer later. Greyed-out choices ("Throw them the
King's venison") say there is another way, without saying how. Relics make finds exciting: a knight with a horn
volleys like a ranger, a ranger with a lance charges.

**Found and fixed:**

1. The orders route was a trap. Sending the whole patrol to Grimsby, with no deserters' camp and only 80
   experience, doubled his stockade: the bot lost most runs for the wizard, ranger and courtier. Now 30% of the
   patrol goes to the stockade and the rest desert (so swordsmen can be hired), and outwitting them is worth 300
   experience (a fight is worth 1,120). The bot wins 15 of 16 runs that way.
2. The first Fireball was a thin ring gone in a third of a second. It is now a ball of fire that drops and
   bursts in a sheet of flame over everyone it hits, and the forecast warns when your own men stand in it.
3. The generated shrine was called "The Humming Stones" but drew a wayside shrine: it now draws a ring of
   standing stones.
4. The courtier bot never used his trick and lost commission III. It now hires small bands, and wins all five.

**Still open:** one ranger seed still loses on the orders route (rangers can't replace their archers in
Aldmoor, so they need the patrol's experience). Balance is parked, as agreed.

## #2: 27 Sep 2026, after R1, R2's juice and R4's signatures, all four backgrounds

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
