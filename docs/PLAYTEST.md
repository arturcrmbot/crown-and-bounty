# Playtests

Newest first. Each entry says what was played, how it felt to an experienced player (HoMM2, King's Bounty,
modern RPGs), and what was done about it.

## #10: 28 Sep 2026, skills that change how you play

**Played:** Artur's point that level-ups were "+1 defence, +1 offence", through the real UI in headless Edge. A new
Courtier from the title: the highwaymen and the poachers, and his first level-up. A Courtier six levels on (Advanced
Diplomacy, Expert Estates, Advanced Scouting) at his level-up card, the patrol, the wolves and a payday. A Courtier
with a big army at the highwaymen with Basic Diplomacy. A Knight with Advanced Archery and Expert Offence against the
wolves. Then every rank in tests, `npm run difficulty` and the campaign sim.

**How it felt:** a level-up is now a real choice. *"Expert Diplomacy: any band that draws wages will take your coin
and join you: gatekeepers too, at twice the price"* against *"War Chest: every payday brings 400 more gold"* made me
stop and think, and the gatekeepers turned out to cost 6,888 gold: a real price for the whole patrol. Scouting earns
its keep on the patrol's card: *"Your scouts don't give you one chance in ten"*, and they have seen the Carving Knife
in the baggage, so I know what the fight is worth before I pick it. The payday card with rents and fuller villages
reads like an estate paying off. Riding up to the highwaymen with a big army and a diplomat, *"Demand their
surrender"* is quicker and cheaper than a fight, for half the experience. In battle the stakes show at once: the
wolves come on at speed 4, "Slowed", into the knights and 30 peasants who can now charge too.

**Found and fixed:**

1. The hero screen called the stakes "Dread" (the Goose Whisperer's word) and listed "Wolves and Wild Boars and Bog
   Goblins". It now says *"Slowed from the start: Wolves, Wild Boars and Bog Goblins start every battle slowed."*
2. A surrender came up under the band's name like any visit. It now says *"They surrender!"*.
3. Rents arrived at the end of the payday card, after the villain's news. They now follow the King's gold they are
   part of.

**Checked:** all tests pass, with a new test for every rank's trick and for heroes saved with the old nine skills.
Every Aldmoor difficulty target holds, and the bot wins all five commissions with every background. Generated maps
are unchanged, so saves still match.

**Still open:** the battle doesn't say what starts slowed (the stakes, the goose); a line in the opening ribbon would.
The ambush card still gives the odds only in words. The bot never demands a surrender. Wisdom comes with the
spellbook.

## #9: 28 Sep 2026, a change of scene between screens

**Played:** the whole opening and the first fights with the clock running, and every change of screen frame by
frame with the clock frozen (`?freeze=1&transitions=1`, stepped with `__kc.advance`): the title into the prologue,
the prologue onto the map, the map into battle and back (won and lost), the court into the Fenmarch, and a
commission lost on day C and tried again. The stings rendered offline through the game's own buses and measured
(`npm run listen`): peaks, their loudest 400 ms against the score's, how long they ring. Then e2e and the visual
scenes.

**How it felt:** before, every screen cut hard to the next, and the music simply swapped: the map, a battle and
the court felt like tabs of one window. Now each is a place you go to. The painting sinks into the dark in a dither
of shadow as a harp sweeps up, and the throne room rises out of it with the King's card unfolding once it's in
view. Riding into a fight, the map darkens on a drum roll and a gleaming edge sweeps across it like a blade, the
steel rings and the field behind it flashes, and the battle march starts on the clash. A win is brass climbing into
E major over the battle's E minor; a defeat, a bell tolling twice. Court opens on two heralds' trumpets. A lost
commission tolls the knell three times and the dark closes over the map and stays.

**Found and fixed:**

1. A new province's name and fanfare came while the court was still fading out, and the arrival card sat over a
   black screen. The name, the fanfare and the first card now wait until the new map is in.
2. The first flash for a battle turned the grass a sickly yellow and read as static. It's now one step brighter
   behind a narrow gleaming edge, which reads as a sweep of steel.
3. The harp's sweep into court was 4 dB louder than anything in the score; every sting now sits about as loud as
   the score's loudest bars, and the score ducks under it.
4. Cards appeared while the picture was still dark: they now wait for 80% of a fade.

**Checked:** a click skips a change, a key skips it and still counts, and frozen screenshots are unchanged (every
visual scene hashes the same). Each change costs 1 to 2 ms a frame while it runs.

## #8: 28 Sep 2026, Artur's second commission; a hero screen, the army, mana, and a UX pass

**What Artur said** (his second time through Aldmoor, after the Wesnoth art and the battle AI):

1. "I'm having fun." The AI makes sense. He beat Baron Grimsby just after the week, when Grimsby's reinforcements
   had come, and "it wasn't an easy fight". Kept.
2. Equipment "needs to be like a character where you can drag and drop from the inventory." Done: the hero screen.
3. "You should also be able to inspect your army... you can borrow this from Heroes of Might and Magic." Done: the
   army strip and each stack's card.
4. "You should be able to see how many mana points you've got left, and are you recovering them." Done: the bar,
   the hero screen and the spellbook say what's left, the most he holds, and that it's full again at dawn.
5. "There's still some UX stuff that we need to fix." The UX pass below.
6. The hero as a unit in battle, and a rider who matches the hero: "Hero on the battlefield". Each background's
   figure is in (05349ce); the hero as a unit is under way.

**Played:** through the real UI in headless Edge, at 960×540 and at 1920×1080: a Wizard with every artifact in
the game (5 worn, 18 in the pack), dragging, clicking and keying them between the paper doll and the pack; stacks
dragged along the line, moved from their cards and by Shift and the arrows, dismissed; every troop's card and each
background's leader card; the bar's troop counts. A Knight through Aldmoor's castle, armoury and village, days
ending, a level-up, Far Sight; the spellbook and the retreat card in battle. `scripts/playtest.mjs` as a Wizard,
e2e (now with the hero screen), the bot, and the live site.

**How it felt:** the hero finally feels like a character you kit out. The sheet reads like HoMM2's hero screen on
parchment: his face, the four stats with their pictures, the gauges, what he's learned, the doll with his own
figure faint behind the slots, and the army along the bottom in Wesnoth's art. Dragging the lance from the pack
onto the weapon slot lights the slot, clinks, and the attack number glows as it goes up. A stack's card answers
the questions a HoMM player asks: attack 10 (8 their own, +2 from Sir Aldric), where they'll stand, what they cost
a week. Back on the map after it, the rough edges there stood out.

**Found and fixed:**

1. Mana was one number in the hero card. The bar now shows it (a crystal, left and most); every number on the bar
   says what it is under the pointer ("Mana 20/30 · full again at dawn", when payday comes and what it brings, the
   wages each stack takes, the days left); and they keep their columns, so nothing shifts as they change. Day
   LXXXVIII no longer runs into the hourglass. The troop counts open that stack's card, the mana the hero screen.
2. The old Equipment card could put things on but never take them off. The hero screen does both, and more.
3. Cards stayed at 15 px on a 1920×1080 window while the pixel art doubled: cards and labels now grow with it.
4. A card about nothing in particular (a level-up, Far Sight, the keys) sat right on the hero, since the camera
   centres on him. It now sits beside him.
5. Every dawn wanted a click on "The sun comes up over the province". A quiet dawn now has no card: the day's
   number rises off the hero. Payday, a hunter on the trail and a lost commission still get their cards.
6. The armoury listed every ware twice and ran off the map, with Close scrolled out of sight. Each ware is one
   button now, with its price and what it does, greyed when it's too dear and saying how much gold is short.
   Buying says whether it's worn or in the pack; a find that goes in the pack says H swaps it.
7. "Recruit 10" with 20 on offer said nothing about why. The card says so now: not enough leadership, five
   companies already (dismiss one on the hero screen), or the purse runs to ten. When none can come, Recruit
   shows greyed.
8. Level-ups listed each option twice: the notes now sit under their buttons, and the card is half as tall.
9. Hover labels only named things. An enemy's now says what it is ("Grimsby's Patrol: a horde of Swordsmen and
   lots of Crossbowmen"), a castle or village what it has to recruit, and the hero how to open his screen. The
   pointer over an enemy turns to crossed swords. Labels near the window's edge stay inside it.
10. Keys: H opens (and closes) the hero screen, ? lists every key, Enter or Space presses a card's only button, and
    End the day buttons say (E).
11. Words that didn't agree with their numbers: "1 Archer are left", "1 Knight join your army", "1 Swordsman slip
    away". Now "Still with you: 1 Archer", "1 Knight joins your army".

**Checked:** all tests (new: the hero sheet and stack cards, wearing, taking off and moving artifacts, moving and
dismissing stacks, the cards above), e2e (H opens the screen, the banner dragged off and back on, two stacks
swapped and back, Escape), two new visual scenes drawn in the page (the hero screen and a stack's card, hashed from
the screenshot), the bot (all four backgrounds win), and the live site with no page errors. Old saves load: the
state didn't change shape.

**The deeper pass, as a new player** (map input, cards, the hero sheet):

12. A click on open ground while a card was up rode off, costing a day's march for a misclick. It now only puts
    the card away. A second click on a place whose card is open rides there, as in HoMM2 (the label says "click
    again: Approach"); a right-click only looks.
13. There was no way to stop a ride. Esc, or a click on the hero, reins in. Shift gallops, the wheel or a
    trackpad pans, and Space brings the view back to him.
14. Nothing said how far anything was. Rest the pointer on the ground or a place and the label says "today",
    "tomorrow" or "in 3 days" (or "no way through yet").
15. The threat card's odds were only a joke ("Your army looks at you..."). The same joke now ends in plain
    words ("You'd likely lose"), on the ambush card too, and Fight and the sergeants say what each means.
16. After recruiting, the castle's card closed, and the armoury needed a new visit. The card comes back with who
    joined on top.
17. The bar's hourglass was 7 pixels; it's bigger and lights up, the bar underlines what a click works, and the
    bounty opens the WANTED poster with the days left.
18. "Start a new campaign" on the map wiped the save in one click. It asks first.
19. The prologue and the court needed the mouse. Enter, Space and the number keys press cards' buttons there
    and on the map; the tired card has "Not yet", and Mysticism's mana on the road shows in the notes.
20. The leadership bar was red when all was well; it's bronze, red only when he leads more than he can. Empty
    slots and places in the line say how to fill them, and a tap on a chip shows its note.

**Still open:** the hero's own battle numbers go on his leader card once "Hero on the battlefield" lands them.
Recruiting takes all you can pay for; there's no taking fewer. Swapping a leadership banner for another leaves
the army as big as it was: harmless, but a player could use it.

## #7: 28 Sep 2026, the Ranger tames beasts, and finds offer real choices

**Played:** Artur's two points from #4 ("as a ranger all of the animals would have joined me", and "you visit an
old watchtower, look at some text and just get +1 something"), through the real UI in headless Edge. A Ranger on
day I at the boars and the wolves. A Knight through Aldmoor's shrine, mill, watchtower and mine, down the dwarf's
delving to Grimsby's door and back, then Sergeant Pike's journal at the patrol. Tamed wolves and boars in a
battle. Then the Fenmarch's and generated provinces' finds in tests, `npm run difficulty` and the campaign sim.

**How it felt:** the Ranger now plays like a ranger. On day I the boars follow him (3 of 9: he has room for no
more), and the card says why the wolves won't: *"Beasts follow only someone who could beat them, and these don't
think you could. Not yet."* Once his army could beat them, the pack lies down at his feet, shows him its den and
the old cloak, and runs at his side for no wages. He gives up the fight's gold and the pelt Old Nan wants for
Fireball, which is a real trade. The finds ask questions: the crows let you take the banner *or* the journal, and
the journal turns out to be Sergeant Pike's father's, so the whole patrol goes home without a fight. The dwarf's
tunnel is the best moment: help him instead of taking his cart, and you can come up behind the wolves, at
Grimsby's door, on day III.

**Found and fixed:**

1. Tamed boars cost 3 leadership each, a poor deal next to archers: a day-I Ranger got 2 of 9, and the Ranger bot's
   slow runs doubled (p90 16 days to 36) while its banner filled with boars. Boars now cost 2, like wolves.
2. Coming up out of the delving or the punt, the hero stood on the mouth and hid it. He now comes up beside it.
3. A spent story choice still showed, greyed out ("Whistle St Aldhelm's hymn" after the goose had been called).
   Parleys whose flag has been used now go.

**Checked:** all tests pass (taming, the finds and their callbacks, the two shortcuts, old saves getting the new
choices at places not yet visited), every Aldmoor difficulty target holds (the wolves stay a gate for taming too:
0% at the start), and the bot wins all five commissions with every background, taming as it goes. Generated maps
come out exactly as before, so saves of them still match.

**Still open (balance is parked, as agreed):** the Ranger bot's Aldmoor has a longer tail (a few runs of 30 to 57
days out of 30) because it fills its banner with peasants. The finds' flags only last one commission.
## #6: 28 Sep 2026, Battle for Wesnoth's units

**Played:** every Aldmoor fight (the patrol, wolves, boars, poachers, highwaymen and Grimsby's hideout) and the
Fenmarch's goblins, trolls and Mother Mirrow, filmed through the real UI in headless Edge at 20 frames a second
with the clock frozen, then studied frame by frame. A Ranger's volley, a Wizard's Fireball, every troop on the
player's side in blue, and the map in every visual scene.

**How it felt:** far cuter, and readable at a glance. Each troop is plainly what it is: a peasant with a
pitchfork, a bowman, a knight on horseback with a lance, a goblin half a man tall, a troll with a club, a hooded
witch, and Grimsby a head taller than his men. Fights now feel like fights. The knight's horse leaps and the lance
goes in, the goblins flash red with a spark on the frame it lands, "Charge!" rings out, the trolls' wounds close,
and the witch raises glowing hands and throws her hex. On the map, the hero on his horse in a gold ring is the first
thing you see, and the enemies stand out in red.

**Found and fixed:**

1. Arrows were thin sticks, lost against the grass. They're longer now, with a steel head, pale fletching and an
   ink shadow, and easy to follow.
2. "Charge!" landed on top of the damage number. Words that rise from a stack now keep apart by their width.
3. A Fireball's damage, flash and number came as it was cast, while the ball was still in the sky. They now come
   with the burst, and stacks caught beside the target flinch at the same moment, not afterwards.
4. The gold hex jumped to the next stack as soon as a move was chosen, so the witch threw her hex from under a
   troll's highlight. A stack now keeps the gold hex until its blows have landed.
5. The witch's hex was a small dot; it's a size bigger, with a longer trail.
6. The log said "Their Mother Mirrow shoot your Knights", and the forecast "Attack their mother mirrow... 0
   perish". Now it's "Mother Mirrow shoots your Knights", "Attack Baron Grimsby: about 40 damage" and "Baron
   Grimsby falls".

**Checked:** tests, e2e and every visual scene; the eleven that changed were looked at before approval. The 242
Wesnoth images add 397 KB to the site, loaded once.

**Still open:** the Bowman has little team colour (in Wesnoth too, just his belt and fletching), and wolves and
boars have none, so their badge says whose they are. If that confuses, Wesnoth's own answer is a thin
team-coloured ring under each unit.

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
