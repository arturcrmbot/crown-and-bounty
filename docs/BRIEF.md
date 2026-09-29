# King's Commission: brief

Working title. A small browser game, not commercial. The goal is quirky and fun, with the charm of Heroes of Might and Magic 2 and the structure of the original King's Bounty (1990).

The story and the world are in [WORLD.md](WORLD.md) (29 Sep 2026). Where the villains and the story below differ from it, WORLD.md wins.

## Decided (with Artur, 25 Sep 2026)

- **Premise:** you are the King's officer, taking bounty contracts on villains. Each run is a new commission: a new province, a new set of villains, and a deadline of 100 days.
- **Runs:** 20 to 30 minutes on a freshly generated map each time.
- **No time loops or rewind lore.** Any bigger story runs quietly from one commission to the next.
- **Run shape:** explore the fogged map, open chests (gold or leadership?), recruit at dwellings, fight roaming stacks. Every 7 days is payday: the King pays you, your troops take wages, and dwellings restock. Beating a villain's castle earns the bounty and a torn piece of the map. Dig in the right spot for the sceptre to win. If you reach day 100 without it, you lose.
- **Characters vs troops:** your hero is the character, levelling up and learning skills, and maybe a second hero later. Troops are just numbers: 400 peasants are 400 peasants.
- **Captains** (changed 29 Sep): the enemy's only. Aldric is the only hero you ever have, and every villain has named captains who lead his bands and fight as heroes do. See `WORLD.md` and #15.
- **Villains have gimmicks and personality,** for example Baron Grimsby, who stole the royal goose.
- **Tone:** warm, funny, storybook. The flavour text in `sketches/2d-map-mockup/` shows the voice.
- **One hero across a campaign** (25 Sep, after the first playtest): levels, skills and gear carry over, and each commission is a new province. RPG depth goes into build choices first (a background, then skills and perks), then story choices.
- **Battles are HoMM2-style:** a hex battlefield where stacks take turns, and the hero casts spells and uses skills. Auto-resolve uses the same engine.
- **Adventure map is turn-based by day:** each day the hero gets a movement allowance. (Artur asked whether real time would suit a browser better. Turn-based days are assumed for now.)

## Look

- **Target:** the look and feel of Heroes of Might and Magic 2's adventure map. **2D only.** On 25 Sep 2026 Artur rejected a 3D look test (pixel-art and toy-diorama renders of KayKit models): "it doesn't need to be 3D at all".
- **Plan:** pixel art at HoMM2's own 640×480, scaled up in whole pixels, with square 32 px tiles and HoMM2's screen layout (map view in a carved frame, right-hand panel with minimap, hero, buttons and status). A 256-colour indexed palette, with water animated by palette cycling as HoMM2 did.
- **Art sources:** Battle for Wesnoth's hand-painted units for the troops and the hero, and code for everything else (terrain, buildings, portraits, the title painting, the interface). Code-drawn figures couldn't reach HoMM2, and HoMM2's own art belongs to Ubisoft, so on 28 Sep 2026 Artur chose Wesnoth's sprites (https://units.wesnoth.org/1.18/mainline/en_US/era_default.html) and accepted that the game becomes open source under the GPL. The PNGs come unchanged from Wesnoth's repository at tag 1.18.8, are recoloured and scaled in code, and every file is credited in `public/assets/CREDITS.md`.
- **Real HoMM2 art is possible only locally:** loading your own copy of the game's data files, as the fheroes2 project does. The game couldn't then be shared publicly.
- **No image-model art.** Artur rejected generated images.
- **Licence:** the game is GPL-2.0-or-later (`LICENSE`), as Wesnoth's art asks. Wesnoth's images keep their own licences: GPL-2.0-or-later, and CC BY-SA 4.0 for what was added after 30 Jul 2017.

## Stack

TypeScript and Vite, drawing to a 2D canvas. HTML/CSS for menus, panels and dialogs. Vitest for the game rules and Playwright for screenshots. Hosted on GitHub Pages from the public repo `arturcrmbot/kings-commission`: https://arturcrmbot.github.io/kings-commission/

## Status (28 Sep 2026)

- **Look test:** done in 2D. A hand-authored 40 x 30 tile map, drawn in code: forests, a mountain range, a river and waterfall, landmarks, restrained fog of war and paper grain.
- **First playable loop:** in. Click to ride (pathfinding, daily movement, red marks for tomorrow), parchment cards for the hero and every place, a chest (gold or leadership), recruiting, the mill, payday every 7 days, two enemy types and Baron Grimsby's hideout.
- **Map AI (27 Sep, made fair 28 Sep):** enemies act at night on the same walk grid as the hero. Guards hold their posts. Roamers wander their territory, like Grimsby's patrol round the crossroads. Hunters, like the Fenmarch goblins, come for a weaker hero who strays into their territory, but never into a castle or village. The first night they only pick up his trail: at dawn the card says so and the mist lifts round them, so he can ride clear, shelter in a town or turn and fight, and the hunter's own card says whether it has his scent. If he's still in reach the next night, they fall on his camp at dawn, and the ambush card gives the odds: fight, leave it to the sergeants, or run for it at the cost of a fifth of his army. Afterwards the hunter rests three nights. Villains recruit 5% more men every payday, for five paydays, so dawdling costs.
- **Battle AI (27 Sep):** the commander picks its moves by trying every option with the real rules (average damage, no dice) and scoring what's left: the worth of each side, less what the enemy could take back over the next two turns, plus what it could take itself. It focuses fire, screens its shooters, charges shooters it can't out-shoot and casts whatever spell is worth most. It never names a spell or troop. It beats the old greedy AI 39 to 1 with mixed armies, and takes about 1 ms a move. It plays your side on auto, and a careful player does about as well by hand. The enemy uses the same judgement but never waits, defends or backs off (28 Sep): its shooters keep shooting and step out of melee when they can, its fighters make for your shooters and gang up on a stack that has already struck back, and trolls count on healing. A battle is called off only after three rounds with no blow struck while the enemy gets no closer: the enemy counts as beaten if it's under a third of your strength; otherwise it keeps its army, and you've left the field as in a retreat, or, if it had no way through to you at all, both sides simply draw off and nobody is cut down.
- **Battles (M1):** HoMM2-style, on an 11 x 9 hex field. There are seven troop types and four spells (Lightning Bolt, Bless, Slow and Haste). You get an attack forecast on hover, can inspect any stack, and can retreat. "Let the sergeants handle it" auto-resolves with the same engine and AI, and the odds hint on each card comes from simulated fights.
- **Hero builds (M2):** four backgrounds (Knight, Hedge Wizard, Ranger and Courtier), each with its own army, stats, purse and signature perk. Battles and discoveries give experience. Each level raises a stat and offers a pick of three, drawn from 9 skills (three ranks each) and 6 perks. There are 37 artifacts in seven slots: one each for weapon, armour, helm and banner, and three interchangeable trinket slots. They are found on the map or bought at the castle armoury. The bot wins Aldmoor with every background, by day 7 to 10.
- **Campaign (M3):** two commissions. After Aldmoor comes the King's court: a code-drawn throne room with King Osric and the returned goose. There, any waiting level-ups are taken, the King adds gold and offers a boon (pick one of three), and the next commission is read out. Commission II is the Fenmarch: meres, reeds and willows, bog goblins, a bridge troll who guards the only way south, and Mother Mirrow, a bog witch in a hut on chicken legs who turned the King's tax collector into a newt. Levels also bring leadership (+10 each). A lost commission can be tried again from its start. The bot wins both commissions with every background: Aldmoor by day 9 to 10, the Fenmarch by day 9 to 16.
- **Generated commissions and parleys (M4):** the campaign is five commissions. After Aldmoor and the Fenmarch, each province is generated from the campaign's seed: roads join the places, woods and meres or crags fill the land, bands stand on the roads, and the villain's hideout sits in a ringed wood behind gatekeepers. Every map is checked playable with the same pathfinding the hero uses. The villains are Baron Grimsby again (he escaped, with the King's hat) and Aunt Bramble, Mother Mirrow's big sister, who turned the royal choir into frogs. Each commission is a fifth stronger than the last. Enemies can offer parleys, other ways past than a fight: pay, talk or trick. Some need a background or skill, and options the hero can't take show greyed out as a hint. Trolls regenerate, and the witches' hexes slow what they hit.
- **The ending:** every bounty comes with a torn piece of an old map (the hero screen counts them). In the fifth commission, the last piece puts an X on the map: ride there and dig up the Sceptre of Order to win the campaign. The bot plays all five commissions, including the dig, with every background.
- **Title and prologue (R1, 27 Sep):** the game opens on a painted sunset over the King's country (castle,
  fields, river, the hero setting out) with the name in beaten gold and the title tune. A new campaign starts at
  court: King Osric explains the trouble, his clerk hands over a WANTED poster for Grimsby, and Aldric picks who
  he was from four faces with a plain line on how each wins. Every commission opens with its province's name on
  a ribbon and a fanfare. Portraits (the King, the heroes, the villains) appear on cards.
- **Juice (R2, 27 Sep):** on the map, gains rise off the hero in words (gold, troops, leadership, experience), a
  level brings a golden ring, beaten foes leave dust and treasure glitters, and night falls over the map
  between days. In battle, fighters are HoMM2-sized (most of two hex rows), the King's star flies at the field's
  edge and the enemy flies a standard (Grimsby's goose, the fen's moon, the outlaws' skull), blows spark and
  shake the field, the fallen stay where they fell, kill counts rise over heads, and a ribbon says VICTORY or
  DEFEAT.
- **Signature playstyles (R4, 27 Sep; the Ranger's beasts, 28 Sep):** the Knight's knights charge (a run-up of 3 hexes or more, started
  clear of the enemy: a quarter harder, and nobody strikes back). The Ranger rides through woodland, where nothing on the map can follow or hunt him,
  and his archers loose a free volley before each battle (not at a villain's walls), where it hurts most, enemy shooters first. The Wizard casts two spells
  a round and has Far Sight on the map. The Courtier pays half for any bribe and can hire small bands outright
  for their wages. The wolves grew to 80 so they stay a gate for everyone.
- **Rewards and choices that come back (R3 and R5, 27 Sep):** six relics carry the heroes' tricks, so any
  hero can learn to win another way: the Poacher's Horn (a volley), the Greenwood Cloak (the woods), Sir
  Brannoc's Lance (a charge), the Twin Wand (a second spell a round), the Crystal of Far Sight, and the Silver
  Signet (cheap bribes, hired bands, for sale at the castle). Two new spells: Fireball bursts over a stack and
  everyone beside it, friend or foe, and Stone Skin adds 3 defence. In Aldmoor, choices echo: spare the poachers
  and they point you to their cache and its horn; beat them and their venison sends the wolves off the road; the
  highwaymen carry Grimsby's orders, which send part of the patrol back to his stockade (the road clears, the
  rest desert and can be hired, Grimsby grows); the wolves leave a ranger's cloak and a pelt, and Old Nan, a
  hedge-witch in a crooked cottage, trades Fireball for the pelt and Stone Skin for gold. In generated
  provinces the gatekeepers carry a relic, the castle sells one, and a ring of standing stones (or a drowned
  chapel in the fen) teaches two charms. The Fenmarch goblins have Sir Brannoc's lance.
- **Artur's playtest fixes (28 Sep):** enemies never wait or defend, so turtling doesn't win: a quiet battle
  only beats a far weaker enemy. The patrol, the stockade and the wolves grew so they stay gates. Aldmoor Butts,
  an archery range beside the start, sells archers (12 at 30 gold, 10 more each payday), so lost archers can
  be replaced, and the first generated province's village sells them too. Six trick perks teach another hero's
  trick, and every level offers one while any are left. The Old Tower Banner also gives archers +1 attack and
  +3 shots, and the Miller's Everlasting Loaf gives +25 movement a day and makes wages a tenth cheaper. In
  battle, melee winds up, lunges, knocks the target back and sprays blood, and each count drops as its blow
  lands. Soldiers are redrawn chibi-style.
- **Taming and real choices (28 Sep, after Artur's first playtest):** the Ranger wins beasts over instead of
  fighting them: wolves and boars, anything that draws no wages and follows no villain. They come only if his
  army could beat them (odds the card calls close, or better), as many as his leadership allows, and the rest
  wander off. A tamed band gives half the experience and shows its den (the wolves' cloak), but no gold and no
  spoils (no pelt for Old Nan). A mixed band, like the gatekeepers with their hounds, loses its beasts and fights
  on. Other heroes learn it from St Aldhelm's Hawthorn Crown, a relic, or the Beast Friend trick perk. The
  Fenmarch has a boar wallow. Finds now offer choices instead of a flat bonus, and some come back: the
  watchtower's crows let you take the banner or the journal (Sergeant Pike's father's: give it to Pike and the
  whole patrol goes home); the Old Mine's dwarf gives up his cart, or his helmet and the old delving, a tunnel
  that comes up behind the wolves at Grimsby's door; the mill gives the Everlasting Loaf or Haste; St Aldhelm
  lends his crown, or hears a prayer for the goose, who then lures half Grimsby's crossbowmen away. In the
  Fenmarch, Brother Anselm spares his staff, a thunderbolt (Lightning Bolt) or a letter to his big sister, the
  witch, who sends half her goblins home; the sinking peat hut saves the wages, the boots or the cutters' punt,
  which slips past the troll; the windmill gives a goblin charm or the miller's sons. In generated provinces the
  tower's note gives away the villain's hideout and weakness (back pay, church bells, the wedding ale), or a
  charm; the mine gives gold, or a relic deeper down; the mill gives the miller's sons, or a charm.
- **The hero looks like who he is (28 Sep, from Artur's second playtest):** each background has its own Wesnoth
  figure, on the map, in battle, kneeling at court and on his portrait. The Knight rides the Horseman with our pennant.
  The others go on foot, since Wesnoth has no mounted mage and each should read as himself at a glance: the
  Hedge Wizard is an Arch Mage (hood, beard, orb and staff), the Ranger is Wesnoth's own Ranger in his green hood
  (nothing like the red poachers), and the Courtier is a Master at Arms in a plumed hat, who doffs it with a bow
  now and then. A tired hero on foot hears that his legs are spent, not his horse.
- **The hero on the field (28 Sep, from Artur's second playtest):** Aldric fights in his battles, as the villains
  do: a stack of one in his army's line, never one of its five stacks. Each background fights his own way. The
  Knight's lance charges with his knights. The Hedge Wizard throws bolts from his staff, as hard as his spell
  power, and is frail up close. The Ranger's longbow joins the opening volley. The Courtier's light blade matters
  less than his presence: stacks beside him fight with +2 attack and +2 defence. His health and damage grow with
  his level, and his attack and defence (level-ups and gear) count for him as for every stack; at level I he's
  worth about a tenth of the army he starts with. He casts from where he stands, hands raised, and only while he
  stands. His guard raise their shields over him, so no shot or spell takes more than a third of his health, but
  a blow at close quarters takes what it takes. If he falls he's carried from the field, and the battle goes on
  without his spells; he's on his feet by evening, but goes no further that day. The enemy finishes him off when
  it can, and the sergeants keep him out of harm's way; both now see a charge coming. The odds on every card count
  him. He stands in the gold ring he has on the map, and he and the villains show a health bar instead of a count.
  His current health stays on the battle bar beside his mana, whoever is taking a turn or under the pointer.
- **The hero screen and the army (28 Sep, from Artur's second playtest):** H, a click on the hero, or the bar's
  troop counts open a HoMM2-style sheet over the map (the map stands still under it): his portrait, level and
  experience, the four stats, mana (left, most, and when it comes back), movement and leadership, his signature,
  skills, perks and spells with their notes. A paper doll of his seven slots, with his own figure faint behind
  them like an engraving, and the pack below. Artifacts move by drag and drop, by click (pick up, put down,
  double-click to wear or take off) or by keys. The army strip shows each stack as its Wesnoth unit with its
  count, beside the hero as leader. A stack's card gives its battle numbers with what the hero adds, its traits,
  leadership, wages and where it stands in the line; stacks are dragged along the line (it sets their battle rows)
  and can be dismissed, though never the last. Mana also shows on the map's bar and in the spellbook. The bar's
  numbers say what they mean under the pointer.
- **UX pass (28 Sep):** cards and labels grow with the page; a card about nothing in particular keeps clear of
  the hero; a quiet dawn needs no click (the day's number rises off him, news still gets a card); the armoury
  shows each ware once with its price, greyed when too dear; recruit cards say why fewer can come; hover labels
  say what's at a place; crossed swords over enemies; **?** lists every key, and Enter or Space presses a card's
  only button.
- **Skills that change play (28 Sep, after Artur's first playtest):** every skill has three ranks. Basic is a
  number; Advanced and Expert add a trick. Archery: stakes that slow wolves, boars and goblins from the start, then a
  free volley. Offence: knights and swordsmen charge, then everyone who fights hand to hand. Armourer: mail for the
  shooters, then +1 defence for every piece of gear worn. Logistics: riding off the road costs a quarter less, then no
  more than a road. Scouting: exact counts, then the odds as a number and what an enemy carries, then scouts who shadow
  every band (seen through the mist, and nothing can hunt you). Leadership: a third of every company stays on between
  commissions, then volunteers every payday. Estates: fuller castles and villages, then rent from every one visited.
  Sorcery: cheaper spells, then a second cast a round. Mysticism: mana comes back as you ride. A new skill, Diplomacy:
  bands far weaker than you surrender when you ride up (their gold, half the experience), small bands take your coin,
  and at Expert even gatekeepers, at twice the price. The Courtier now favours Diplomacy over Mysticism.
- **Gear with character (28 Sep):** twelve new artifacts and two sets. Grimsby's Regalia (his carving knife, his
  golden feather and, from commission III, his hat): wear all three and his men start every battle slowed. The
  Fenmarch Finery (eelskin boots, trollhide jerkin, banner of the Fens): goblins and trolls start slowed, and riding
  off the road costs a quarter less. The villains leave their things: Mother Mirrow's hat, Grimsby's hat and Aunt
  Bramble's ladle (+3 spell power, but spells a mana dearer). Gear with a price: the Headsman's Axe (+4 attack, −2
  defence), the King's Plate (+5 defence, −40 movement), a Friar's Habit (+2 knowledge, −1 defence, cheaper bribes)
  and the highwaymen's Black Banner (weak bands surrender, but recruits cost a tenth more, and the recruit card says
  why). Gear that changes how you ride, count and collect: the Surveyor's Chain in Aldmoor's chest, a Pilgrim's Hat as
  St Aldhelm's third way (mana back as you ride), and in the armouries a Scout's Spyglass (numbers on the odds), the
  Steward's Ledger (rents) and the Recruiting Drum (volunteers every payday). Generated armouries stock two such
  specials. Gear that slows the hero slows today's ride too, so its price can't be dodged overnight.
- **Gear with drawbacks:** Bramble's Ladle, the Headsman's Axe, the King's Plate, a Friar's Habit and the Black Banner go into the pack first, with a choice to wear them or keep them there. Gear without a drawback still goes straight on when its slot is free.
- **Mana wells (the first slice of the spellbook, #9):** a new kind of place, one to a province (St Aldhelm's Well
  in Aldmoor, St Wendel's Spring in the Fenmarch): a drink fills the hero's mana to the brim, once a day, so a
  caster can plan a second battle's worth of spells round it. It does nothing for a hero with no mana to fill, or
  one already full, and waits for a day he needs it. The rest of #9 (circles, a mage guild, scrolls, map spells,
  Eagle Eye) is still to build.
- **Sound and music:** everything is synthesised with Web Audio, with no files. There are twelve original pieces for a small medieval band. On the map, each commission has its own: "The Heather Road" (Aldmoor's jig), "Mist on the Meres" (the Fenmarch), "The Baron's Road" (a reel), "Bramble's Water" (a slow air) and "The Last Commission", whose second strain is the title's tune on brass. Each has an A and a B strain and a form of four to eight passes arranged differently (a new lead, the drum resting), so it takes two to three minutes to come round; every other time round the recorder and fife swap and a few long notes get a grace note. Each villain has a theme, played near his lair and swelling into the whole band in his battle: Grimsby's pompous march, Mother Mirrow's bog waltz, Aunt Bramble's stamping jig. A castle or village plays "Market Day" while you're in it. "Steel and Feathers" (battle) builds with the fight, brightens when you're winning and darkens when you're losing. Plus "The King's Pavane" (court) and a title theme. The band is plucked lute, harp and harpsichord, recorder, fife, hurdy-gurdy drone, frame drum, brass, bells and a church bell. Music crossfades between screens. Every change of screen is a change of scene (28 Sep): the picture sinks into the dark and the next rises out of it, or dissolves, and riding into battle a gleaming edge sweeps across the map like a blade; under a second, and a click skips it. Stings mark each: a harp sweeping up into court, a drum roll and a clash of steel into battle, heralds' trumpets for court, brass for a win (in battle or left to the sergeants), a tolling bell for a defeat, the bells for a paid bounty, the knell for a lost commission (and the dark stays over the map), a ta-da on payday and a harp and brass for a level. The score ducks under them. Under it runs ambience: wind on the heath, a colder wind in the fen, a crackling fire at court. On the map the land joins in around the hero (28 Sep), louder the nearer he is and panned to its side: running water by the river and a roar at the falls, voices and a smith's anvil at villages and castles, arrows into straw at the butts, crows at the tower, the abbey's bell and plainchant, wind whistling over crags and cliffs, blackbirds, a cuckoo and a woodpecker in the woods, frogs by the fen's meres, a creaking mill and a pick in the mine. As the day's riding runs out the birds go quiet and crickets and an owl come out; a cockerel greets the morning. Plus effects for clicks, coins, the day bell, fanfares, hits, arrows and spells. A test checks that every strong-beat melody note sits on its chord. The title waits for a click, so the music starts with it. M or the Sound button in the top right corner mutes.
- **Perks that bend rules (28 Sep):** the flat perks became small rules. Quartermaster: wages a fifth less, and
  recruiters throw in one free for every five. Night Rider: movement left unused rides on tomorrow, up to half a
  day. Treasure Hunter: half as much again from treasure, and at dawn the mist lifts over any within 300 paces. War
  Chest: the King's bankers pay a tenth of the purse every payday, up to 500. Two new ones: Scholar (four choices at
  every level-up) and the King's Favourite (four boons at court).
- **Big maps (29 Sep, the groundwork for a bigger Aldmoor, #77):** the land is painted in tiles of 128 pixels as they
  come into view, with its trees and buildings, and the rest a tile a frame while nothing much is happening, so a
  province six times the size opens at once. Tufts, petals, reeds and lily pads are sprinkled tile by tile, as thickly
  as before. The fog, the walk grid and the start's explored land are worked out only where something is. Routes are
  read off one search from the hero, which answers the way to every place at once (for the bot, and for the hover
  label's days), and he rides up to an enemy from his own side of it: to a patrol on a bridge from his own bank, not
  the long way round to the far one.
