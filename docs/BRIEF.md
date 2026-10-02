# Crown & Bounty: brief

Crown & Bounty, with The Old King's Treasure as the subtitle for Act I (Artur, 30 Sep 2026, #145). Until then it was King's Commission, a working title. A small browser game, not commercial. The goal is quirky and fun, with the charm of Heroes of Might and Magic 2 and the structure of the original King's Bounty (1990).

The story and the world are in [WORLD.md](WORLD.md) (29 Sep 2026). Where the villains and the story below differ from it, WORLD.md wins.

The balance is in [BALANCE.md](BALANCE.md) (29 Sep 2026): a power budget for each commission, caps on what makes the hero run away, and how the sims measure it.

## Decided (with Artur, 25 Sep 2026)

- **Premise:** you are the King's officer, taking bounty contracts on villains. Each run is a new commission: a new province, a new set of villains, and a deadline of 100 days.
- **Runs:** 20 to 30 minutes on a freshly generated map each time.
- **No time loops or rewind lore.** Any bigger story runs quietly from one commission to the next.
- **Run shape:** explore the fogged map, open chests (gold or leadership?), recruit at dwellings, fight roaming stacks. Every 7 days is payday: the King pays you, your troops take wages, and dwellings restock. Beating a villain's castle earns the bounty and a torn piece of the map. Dig in the right spot for the sceptre to win. If you reach day 100 without it, you lose.
- **Characters vs troops:** your hero is the character, levelling up and learning skills, and maybe a second hero later. Troops are just numbers: 400 peasants are 400 peasants.
- **Captains** (changed 29 Sep): the enemy's only. Aldric is the only hero you ever have, and every villain has named captains who lead his bands and fight as heroes do. See `WORLD.md` and #15.
- **Villains have gimmicks and personality,** for example Baron Grimsby, who stole the royal goose.
- **Tone:** warm, funny, storybook. The flavour text in `sketches/2d-map-mockup/` shows the voice. Since 30 Sep 2026 (#149) the words are plain, full sentences that speak to the player, as HoMM2's messages are, with no colons, dashes or clipped phrases in the narration. [VOICE.md](VOICE.md) sets out the rules.
- **One hero across a campaign** (25 Sep, after the first playtest): levels, skills and gear carry over, and each commission is a new province. RPG depth goes into build choices first (a background, then skills and perks), then story choices.
- **Battles are HoMM2-style:** a hex battlefield where stacks take turns, and the hero casts spells and uses skills. Auto-resolve uses the same engine.
- **Adventure map is turn-based by day:** each day the hero gets a movement allowance. (Artur asked whether real time would suit a browser better. Turn-based days are assumed for now.)

## Look

- **Target:** the look and feel of Heroes of Might and Magic 2's adventure map. **2D only.** On 25 Sep 2026 Artur rejected a 3D look test (pixel-art and toy-diorama renders of KayKit models): "it doesn't need to be 3D at all".
- **Plan:** pixel art at HoMM2's own 640×480, scaled up in whole pixels, with square 32 px tiles and HoMM2's screen layout (map view in a carved frame, right-hand panel with minimap, hero, buttons and status). A 256-colour indexed palette, with water animated by palette cycling as HoMM2 did. The panel, with the minimap and the hero, came in with #106 and went again with #130 (see below): this game has no castles or towns to manage, so the map fills the width, a small minimap sits over its top right corner, and the buttons and status are on the bottom bar, with the journal.
- **Art sources:** Battle for Wesnoth's hand-painted units for the troops and the hero, and code for everything else (terrain, buildings, portraits, the title painting, the interface). Code-drawn figures couldn't reach HoMM2, and HoMM2's own art belongs to Ubisoft, so on 28 Sep 2026 Artur chose Wesnoth's sprites (https://units.wesnoth.org/1.18/mainline/en_US/era_default.html) and accepted that the game becomes open source under the GPL. The PNGs come unchanged from Wesnoth's repository at tag 1.18.8, are recoloured and scaled in code, and every file is credited in `public/assets/CREDITS.md`.
- **Real HoMM2 art is possible only locally:** loading your own copy of the game's data files, as the fheroes2 project does. The game couldn't then be shared publicly.
- **No image-model art.** Artur rejected generated images.
- **Licence:** the game is GPL-2.0-or-later (`LICENSE`), as Wesnoth's art asks. Wesnoth's images keep their own licences: GPL-2.0-or-later, and CC BY-SA 4.0 for what was added after 30 Jul 2017.

## Stack

TypeScript and Vite, drawing to a 2D canvas. HTML/CSS for menus, panels and dialogs. Vitest for the game rules and Playwright for screenshots. Hosted on GitHub Pages from the public repo `arturcrmbot/crown-and-bounty`: https://arturcrmbot.github.io/crown-and-bounty/

## Status (28 Sep 2026)

- **Look test:** done in 2D. A hand-authored 40 x 30 tile map, drawn in code: forests, a mountain range, a river and waterfall, landmarks, restrained fog of war and paper grain.
- **First playable loop:** in. Click to ride (pathfinding, daily movement, red marks for tomorrow), parchment cards for the hero and every place, a chest (gold or leadership), recruiting, the mill, payday every 7 days, two enemy types and Baron Grimsby's hideout.
- **Map AI (27 Sep, made fair 28 Sep):** enemies act at night on the same walk grid as the hero. Guards hold their posts. Roamers wander their territory, like Grimsby's patrol round the crossroads. Hunters, like the Fenmarch goblins, come for a weaker hero who strays into their territory, but never into a castle or village. The first night they only pick up his trail: at dawn the card says so and the mist lifts round them, so he can ride clear, shelter in a town or turn and fight, and the hunter's own card says whether it has his scent. If he's still in reach the next night, they fall on his camp at dawn, and the ambush card gives the odds: fight, leave it to the sergeants, or run for it at the cost of a fifth of his army. Afterwards the hunter rests three nights. Villains recruit 5% more men every payday, for five paydays, so dawdling costs.
- **Battle AI (27 Sep):** the commander picks its moves by trying every option with the real rules (average damage, no dice) and scoring what's left: the worth of each side, less what the enemy could take back over the next two turns, plus what it could take itself. It focuses fire, screens its shooters, charges shooters it can't out-shoot and casts whatever spell is worth most. It never names a spell or troop. It beats the old greedy AI 39 to 1 with mixed armies, and takes about 1 ms a move. It plays your side on auto, and a careful player does about as well by hand. The enemy uses the same judgement but never waits, defends or backs off (28 Sep): its shooters keep shooting and step out of melee when they can, its fighters make for your shooters and gang up on a stack that has already struck back, and trolls count on healing. A battle is called off only after three rounds with no blow struck while the enemy gets no closer: the enemy counts as beaten if it's under a third of your strength; otherwise it keeps its army, and you've left the field as in a retreat, or, if it had no way through to you at all, both sides simply draw off and nobody is cut down.
- **Battles (M1):** HoMM2-style, on an 11 x 9 hex field. There are seven troop types and four spells (Lightning Bolt, Bless, Slow and Haste). You get an attack forecast on hover, can inspect any stack, and can retreat. "Let the sergeants handle it" auto-resolves with the same engine and AI, and the odds hint on each card comes from simulated fights.
- **Hero builds (M2):** four backgrounds (Knight, Hedge Wizard, Ranger and Courtier), each with its own army, stats, purse and signature perk. Battles and discoveries give experience. Each level raises a stat and offers a pick of three, drawn from 9 skills (three ranks each) and 6 perks. There are 39 artifacts in seven slots: one each for weapon, armour, helm and banner, and three interchangeable trinket slots. They are found on the map or bought at the castle armoury, which buys spares back. The bot wins Aldmoor with every background, by day 7 to 10.
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
  now and then. A tired hero on foot hears that his legs are spent, not his horse. Since #189 the heroes are painted
  figures, and the Courtier wears a red coat trimmed with gold and a broad red hat with a big yellow plume over his
  long brown hair. His portrait and his kneeling figure at court wear the same (2 Oct, #231).
- **Heroes and captains behind the line (29 Sep, #36; before, from 28 Sep, Aldric fought in the line and could
  be carried off):** Aldric, the villains and the enemy's captains lead from behind their troops, and nothing can
  reach them there: no blow, shot or spell, friend or foe (a Fireball passes over them), so their blows get no
  strike back. Each stands off the hex field at the back of his side, below its standard, in a ring: Aldric's gold,
  as on the map, and the enemy's red. Each fights his own way from there. The Knight rides out, in from his side's
  edge through free hexes and as far as his speed takes him, charges a stack and rides back, all in one move. The
  Hedge Wizard throws bolts from his staff, as hard as his spell power, and the Ranger shoots, both at any stack on
  the field. The Courtier strikes no blow: he's a bard (see below). Grimsby casts and gives orders; Mother Mirrow and
  Aunt Bramble throw hexes and cast. A leader takes a turn only when he has something to do with it, and casts on
  his side's turns all battle long. His damage grows with his level (and a caster's with his spell power), and his
  attack counts for his blows; his health no longer matters. A battle ends when a side's troops are gone, or when
  it retreats: if Aldric's army is beaten he retreats, and rides home to raise another; if a villain's army is
  beaten he's taken, and the bounty is paid. The field and the card say it in the same words ("Their army is
  beaten, and Baron Grimsby is taken"), and on the field the villain throws up his hands, or Aldric rides off.
  Grimsby calls his guard once his men are down to three fifths of their health. So these went: Aldric's health
  bar and the villains', the warning that an enemy could reach him, his bodyguard, being carried from the field,
  villains who fall, and the Courtier's rally with its gold ring. On his turn the ribbon says what he can do, the
  Knight's reach is lit, and the forecast says his blow gets no answer. The rule is data (the `leads` and `rides`
  abilities in `content/troops.ts`), so a captain (#15) needs only his troop. The sergeants and the enemy know it
  all: nobody aims at a leader or counts on striking back at him. How the tiers moved is in #36's PR; the balance
  is tuned in #14.
- **The Courtier becomes a bard (29 Sep, #42):** Artur: "Courtier has no attack but can bribe / demotivate /
  sing etc." He keeps his name and his Master at Arms in a plumed hat (Wesnoth has no bard to give him; Artur can
  rename him later), and his line at the start says he "pays, jeers and sings instead of fighting". From behind the
  line he takes a turn like any leader with something to do, and makes one move with it:
  - **Pay:** a stack of theirs goes home for 2 gold for every point of its power, or, if it fits under his banner
    (leadership for all of it, and a place in his line), comes over for 6, fights for him and rides on with him
    after. Only as much of it takes his gold as his army outweighs it, none while his army is no stronger (30 Sep,
    `outweighs`). His Silver Tongue halves both, and no bribe is ever more than half off. Beasts take no gold, and villains and captains can't
    be bought: nothing reaches them. The gold comes out of his purse, and the card says what his bribes cost.
  - **Jeer:** a stack of theirs loses heart: −30% morale for two rounds, so three times in ten it loses its turn.
  - **Sing:** a marching song (+25% morale: a chance each stack goes again) or a lucky song (+20% luck: a chance a
    blow lands twice as hard), over every stack of his for two rounds.
  - On his turn a click on one of their stacks opens a card with each move's price or effect (the hover line gives
    them too), and the Defend button reads Sing. His sergeants jeer and sing on auto but never spend his gold:
    bribes are for when you command. So his odds on the cards leave his purse out.
  - Morale and luck are now per stack: its side's (the hero's, for yours) plus what songs and jeers add. Good
    morale still wins another turn; bad morale, new, loses one. The moves are data: the `bard` ability in
    `content/troops.ts`, and the `jeered`, `heartened` and `charmed` statuses in `content/spells.ts`. His rally and
    its gold ring went with #36.
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
- **Spares sell (29 Sep, #30):** Aldric finds more gear than he can wear, so the castle armoury buys anything in his pack: half its price, or 400 gold for gear with no price (relics, the villains' things, most finds). Worn gear comes off first (H). *Sell him your spares* lists the pack a line to a button, with the gold on each, so a full pack still fits on the card; the armourer says what he pays in his own words, and what he's just bought. Gear with a price goes back on his wall at full price, so a sale can be undone at a loss; the rest is gone for good. Gear a choice on the map still asks for (`needs.artifact`, or a page's `when`) can't be sold, and its button says where it's wanted. The castle's card offers the armoury while there's anything to buy or sell. The bot doesn't sell yet, so the balance reports are unchanged (#14).
- **Mana wells (the first slice of the spellbook, #9):** a new kind of place, one to a province (St Aldhelm's Well
  in Aldmoor, St Wendel's Spring in the Fenmarch): a drink fills the hero's mana to the brim, once a day, so a
  caster can plan a second battle's worth of spells round it. It does nothing for a hero with no mana to fill, or
  one already full, and waits for a day he needs it. The rest of #9 (circles, a mage guild, scrolls, map spells,
  Eagle Eye) is still to build.
- **Sound and music:** the music is yubatake's (#178; Artur, 1 Oct: no orchestra, but the cute, retro 90s MIDI tunes he loved in HoMM2, made by people). It's tunes from his JRPG Collection and his Northern Isles (CC BY 4.0), his MIDI files played on a small band of General MIDI instruments cut from GeneralUser GS (flute, oboe, clarinet, recorder, horn, harp, harpsichord, plucked strings, glockenspiel, guitar, strings, an upright bass and a few soft drums), as a 90s sound card played them, in a small room's echo. Artur heard it three ways and chose yubatake's notes on these gentle instruments over his own buzzy chip sound. Each land has four or five tunes that take turns, each playing through (twice, if it's short) before the next begins after a breath: Aldmoor's Fields, Shop, Inn, Town and Tavern, the Fenmarch's Mystic Isle, Northern Isles, Docks and Temple, and the three lands beyond mixing them. Each villain has a theme, played near his lair and filling out in his battle: Grimsby's Boss Battle, Mother Mirrow's Labyrinth, Aunt Bramble's Dungeon. The battle tune builds with the fight, a glockenspiel rings over it while you're winning, and the oboe takes the tune while you're losing. The court plays Royal Court and Princess, and the title Main Theme. Payday brings the feast (#191), and Vincenzo Galilei's Saltarello, a lute dance from the 1500s, plays on the harp and the lute until payday's card is closed. A castle's or a village's card leaves the map's music as it is: the music changes only between the map, a battle, the title and the court (Artur, 1 Oct). The sound effects, the stings and the ambience are synthesised with Web Audio, with no files. Music crossfades between screens. Every change of screen is a change of scene (28 Sep): the picture sinks into the dark and the next rises out of it, or dissolves, and riding into battle a gleaming edge sweeps across the map like a blade; under a second, and a click skips it. Stings mark each: a harp sweeping up into court, a drum roll and a clash of steel into battle, heralds' trumpets for court, brass for a win (in battle or left to the sergeants), a tolling bell for a defeat, the bells for a paid bounty, the knell for a lost commission (and the dark stays over the map), a ta-da on payday and a harp and brass for a level. The score ducks under them (about 10 LU, down in 80 ms, held while the sting rings, back over a second), and the land's sounds dip a little too; the heralds' fanfare and the bard's songs, being music themselves, duck it about 6 LU, and a lighter duck under a sting never lets the score back up early. Under it runs ambience: a faint wind on the heath and a colder one in the fen, and a crackling fire at court. On 1 Oct the wind went 10 dB down, and off the title altogether, because under the gentler music Artur heard its swell as noise. On the map the land joins in around the hero (28 Sep), louder the nearer he is and panned to its side: running water by the river and a roar at the falls, voices and a smith's anvil at villages and castles, arrows into straw at the butts, crows at the tower, the abbey's bell and plainchant, wind whistling over crags and cliffs, blackbirds, a cuckoo and a woodpecker in the woods, frogs by the fen's meres, a creaking mill and a pick in the mine. As the day's riding runs out the birds go quiet and crickets and an owl come out; a cockerel greets the morning. Plus effects for clicks, coins, the day bell, fanfares, arrows and spells. Cards land with a soft pat as they open, and another as they're put away; a card replaced by the next only pats once. (From 29 Sep, #10, they crackled like parchment, but under the gentler music Artur heard that as a scratch, and on 1 Oct the crackle went.) In battle every troop sounds like what it is (29 Sep, #10), in `TROOP_SOUNDS`: its blow (a pitchfork's knock, a sword's swish and cut, a lance's crash at the charge, a wolf's snarl and snap, a cudgel's thud, a troll's fist like a falling tree, a goblin's quick jab, a boar's grunt and gore, a knife, a staff); its shot as it leaves and as it lands (a bowstring and a thock, a crossbow's clack and a heavy thunk, a hex that warbles and bubbles, a mage's crackling bolt); steel ringing on the armoured (knights, swordsmen, crossbowmen, the Baron); its cry, a grunt, yelp, squeak, roar or squeal when a blow hurts it and a longer one as it falls; and its feet as it crosses the field (boots, hooves, paws, a troll's stomp, trotters, a goblin's patter). Each comes from its side of the field. Every effect has a mark in the mix, measured as the ear hears loudness (K-weighted LUFS over its loudest tenth of a second, by `npm run listen`): faint for footfalls, soft under the music for clicks, cards and a cry of pain, firm level with it for coins, blows and death cries, loud over it for the heralds' fanfare and the hunting horn. A test plays every effect through a stand-in for Web Audio as strict as a browser, since nobody can listen here. The mix is even (29 Sep, #10): every track plays at the music's mark (−19.5 LUFS through the master, `MARKS` in `audio/context.ts`), so no screen is louder than another; a villain's theme is as loud by his lair (its sparer arrangement played up, `calm`) as in his battle, and the battle tune still swells a little as the fight heats up. Every sting sits at −17 and stands about 12 LU over the ducked score. The heath's and the fen's winds sit within a decibel of each other, under the land's layers. A soft ceiling at the end of the master rounds off any pile-up of sounds above −2 dBFS rather than clipping it. `npm run listen -- --check` fails if anything drifts off its mark. A test checks that every one of yubatake's parts is arranged, and every note sits in its instrument's range. The title waits for a click, so the music starts with it. M or the Sound button in the top right corner mutes.
- **Perks that bend rules (28 Sep):** the flat perks became small rules. Quartermaster: wages a fifth less, and
  recruiters throw in one free for every five. Night Rider: movement left unused rides on tomorrow, up to half a
  day. Treasure Hunter: half as much again from treasure, and at dawn the mist lifts over any within 300 paces. War
  Chest: the King's bankers pay a tenth of the purse every payday, up to 500. Two new ones: Scholar (four choices at
  every level-up) and the King's Favourite (four boons at court).
- **The court remembers, and a boon carries someone forward (29 Sep, #79):** after a commission, King Osric's
  welcome picks up to three things you did from the story's flags, the most telling first: Sergeant Pike home with
  his mother, the goose's hymn under Grimsby's walls, Old Nan warm in the wolf pelt, the dwarf's kettle (or his
  missing cart), the poachers off his deer, Pike's father's banner. An officer who did none of it gets a plain word
  ("You went straight at him without any nonsense"). His gold and boons follow on a card of their own. People you helped
  can ride on with you, as boons: up to two of the three on offer (one is always the King's own), each with his face
  and what he'd do. Sergeant Pike brings his old patrol, 20 swordsmen if you can lead them, and drills yours (+1
  attack and defence); Old Nan rides in the baggage cart, and after every battle you win her charms put a tenth of
  your fallen back on their feet; the Old Mine's dwarf smells gold (at dawn the mist lifts over treasure within 300
  paces, and treasure gives a quarter more); from the Fenmarch, Brother Anselm prays over your men (+10% morale).
  A companion rides with Aldric for the rest of the campaign, says hello as the next province opens, and shows on
  the hero screen under his name. It's all data: each commission's `memories` and `friends` in
  `content/campaign.ts`, the people in `content/friends.ts`. A generated province's villain has his own memory (his
  weakness, used), beside the ones every generated province shares; generated provinces have no companions yet.
- **The bounty paid, with a scene (29 Sep, #79):** when a villain's army is beaten, the fight stops on his last line,
  in his own voice: after VICTORY, a bubble over his head with his words (Grimsby's *"Unhand me, sir! This doublet is
  Flemish!"*), a babble pitched to him (the Baron rumbles, the witches cackle high), and the ribbon says it too. It
  stays three seconds at any pace, or until a click. The card that says he's taken shows his face and his last words,
  with the fallen after the story. Claiming the bounty puts his WANTED poster back up, PAID slammed across his face in
  red ink with a thump, the reward "paid in full", and what came home: in Aldmoor, the royal goose in her crown. The
  poster's price is now what the Crown pays at his lair (2,000 for Grimsby; the King's gold at court comes on top, as
  before), and a deal that pays otherwise says why ("The poster said 2,000 gold. The Crown pays 1,000, because the
  other half went to the Baron's old nanny"). Put away, a won commission waits on its poster, which rides to court.
  It's data: each commission's (and generated villain's) `face`, `wanted`, `lastWords` and `returned`, a leader's
  `voice`, and a winning choice's `because`.
- **Grimsby's parley has a price (29 Sep, #79):** in playtest 01, "Talk the Baron round" ended Aldmoor in one free
  click. Now the Courtier sings him round, the bard's way, and it takes a song and half the bounty. Ask Old Nan about
  the Baron and she turns out to have been his nanny (*"Screamed the house down every night, he did, till I sang him
  this"*), and sings you the lullaby: a condition built towards, as the goose's hymn is. At his walls, a Courtier who
  knows it can sing him Old Nan's lullaby: by the third verse the Baron is sobbing into the goose, and he comes
  quietly on one condition, that half his bounty goes to his old nanny. The stamped poster says so, and so does the
  King at court (*"I suppose she did bring him up."*). Other heroes see the button greyed, "(Courtier)", as a hint; for
  them the song is a story, and the King hopes they never sang it to him. The King also remembers Grimsby's dig on
  the heath (*"He won't find it there"*) and Mrs Pike's pie. Generated commissions keep their parleys, each with its
  reason, until the four crooks (`docs/act1/crooks.md`) replace them.
- **Big maps (29 Sep, the groundwork for a bigger Aldmoor, #77):** the land is painted in tiles of 128 pixels as they
  come into view, with its trees and buildings, and the rest a tile a frame while nothing much is happening, so a
  province six times the size opens at once. Tufts, petals, reeds and lily pads are sprinkled tile by tile, as thickly
  as before. The fog, the walk grid and the start's explored land are worked out only where something is. Routes are
  read off one search from the hero, which answers the way to every place at once (for the bot, and for the hover
  label's days), and he rides up to an enemy from his own side of it: to a patrol on a bridge from his own bank, not
  the long way round to the far one.
- **Luck and morale you can see (#6, 29 Sep):** HoMM2's two dice, built on the per-stack morale and luck the bard
  brought (#42). Luck is the chance any blow lands lucky, twice as hard. Morale above nought is the chance a stack
  goes again before the round moves on, and it jumps for joy; below nought, the chance it loses heart as its turn
  comes, and falters. Each is tested at most once a round: not again after a wait, nor after a spell cast before the
  stack acts. Aldric brings both to his side: the perk Fortune's Favour, the Pair of Bone Dice in Aldmoor's armoury,
  the Aldmoor poachers' Rabbit's Foot (luck: beat them for it, and a line on their card hints at it) and the
  Castellan's Bagpipes in Harrowgate Keep's armoury (morale). The enemy has none of its own, beyond a bard's jeers.
  - **Mixed armies.** Every troop belongs to one of Act I's peoples (`WORLD.md`): the King's folk, outlaws, elves,
    dwarves or wild things. Aldric and the villains belong to none. Two pairs won't march together: the King's folk
    and wild things (knights beside wolves), and elves and dwarves. Every stack of either people in one army loses 10%
    morale for each people it won't march beside, on either side of the field, and stops grumbling once they've
    fallen. That counts turncoats a bard pays to come over, and stacks a spell calls in. Outlaws don't mind their
    hounds, so today's enemy bands don't grumble. The rule is one table of pairs (`FEUDS`), so later peoples just
    join it.
  - **Where it shows.** A stack's card on the hero screen gives its luck and morale, and why among its traits: each
    gift by name, and "Uneasy company". In battle the bar gives the numbers (a long line shrinks to fit), and
    pointing at a stack on your turn says why, songs and jeers included; a stack that falters says whom it's uneasy
    beside. Castle, village, tame and hire cards warn before a new quarrel starts.
  - **The AI** counts luck at its average damage and morale as the turns a stack can expect, in what a stack is worth
    as well as in the blows it threatens, since it looks ahead without dice. The very first stack to act in a battle
    isn't tested for low spirits.
  - **Balance** isn't retuned here (#14): mixing now costs something, so the bot's Knight with tamed boars beats
    Grimsby less often once explored (94% to 56%), and every tier stays inside its targets.
- **Aldmoor, bigger (29 Sep, #77, as sketched in `act1/aldmoor.md`):** the first commission is 100 by 75 tiles, two and
  a half times as wide and as tall, so a day's ride on a road crosses about a third of it. Aldric starts at the east edge
  on the King's road, facing into the land. The land has regions painted their own way: a patchwork of fields and hedges
  round Castle Aldmoor and Westmere (every place keeps a green of its own), the heath west of the river (heather, dry grass
  and gorse), the pale rolling downs to the north-east, the crags along the north, Darkwood (all pines) and the King's
  chase (mostly oaks). The river runs from edge to edge. Pike's patrol no longer roams: it holds the old bridge, and the
  ford below the falls in the crags is the long way round: the road wades over stepping stones, slower than a road (it
  costs what grass does), with a splash underfoot. Everywhere west of the river is two days or more by the ford until
  the patrol goes. Grimsby's stockade can be reached from day one, the long way: by the ford, over the heath and down the
  track he rides out by; the wolves hold the short way from the bridge, and the dwarf's delving now runs from his mine in
  the crags to Darkwood, behind them. Today's places moved into the new land, where the sketch puts them: the shrine by
  the King's road, the chest on the downs, the butts, the mill on the river, Old Nan at the edge of the chase, the tower
  and the highwaymen on the heath, St Aldhelm's Well on the heath road, the deserters at the crossroads over the bridge,
  and Pike's camp on Westmere green. The difficulty model's explored checkpoint grows with a province's width (15 days in
  Aldmoor, 6 elsewhere). Saves are version 7: an Aldmoor commission saved on the old map begins again on the new one,
  with the hero it began with; later commissions carry on. Heather stays plum in the morning, the evening and the night,
  and fades into the mist under the fog like the rest of the land. The bot takes on a gatekeeper or Grimsby only when
  it's a sure thing (19 in 20 over sixteen battles), and looks again when it gets there: losing the whole army costs
  weeks in a province this size, while Grimsby recruits. It wins Aldmoor with every background, by day 9 to 13 at the
  median (6 to 38 in all).
- **Mrs Pike and Grimsby's dig (29 Sep, #77):** Mrs Pike lives on Westmere green, her boy's sergeant's coat on the
  washing line. Until he's home she only talks about him, and hints that his father wrote everything down; if the
  patrol is beaten or paid off, she knows he's gone into Darkwood. Once the journal sends Pike home (his camp moves
  to Westmere green), she thanks Aldric with her late husband's lucky horseshoe, or a word round Westmere (+20
  leadership): no flat stats, as with every find. Grimsby's men dig for the old King's treasure on the heath under the
  crags, forty holes and a spade: a band worth a real fight from day one (32 swordsmen, 14 crossbowmen, 30 peasants),
  with his wages and his orders in the biggest hole, which hint that what he's after isn't gold. Beating them sets
  `flags.dig = 'raided'`, which Grimsby riding out (#75) answers to. The patrol's every ending sets a flag too
  (`patrolGone`, or `pikeHome`). A new player's pace: the bot, which knows where everything is, wins by day 11 to 14 at
  the median; the scripted play-through, waiting for paydays, on day 15; a player who explores in the fog and goes the
  wrong way now and then should take about three weeks. That is an estimate, not a measurement.
- **Grimsby rides out (29 Sep, #75):** hurt Grimsby and he comes out to meet you, as the heroes do in HoMM. Raid his dig
  on the heath, or take his patrol off the bridge (beaten, paid off, sent back with his orders, or home with Pike), and
  the first night Aldric is within his reach he rides out of his stockade on his best pony, the goose under one arm and a
  third of his men at his back (his guard). The dawn says so, and the mist lifts round him as he comes: 80 a night along
  the roads (Aldric rides 150 a day), round his own wolves, as far as the heath and the old bridge, whatever the odds. He
  falls on the camp at dawn as the hunters do, with a day's warning, and never comes into a town. While he's out, his
  gate is barred ("for once nobody inside is honking"), and the men he left won't open it. Beat his guard, when he falls
  on you or when you ride out to him, and he flees home without it: the field and the card say "Their army is beaten, and
  Baron Grimsby flees home", and he turns and runs off the field. Beaten once, he stays behind his walls, a third weaker.
  If he can't find Aldric (over the river, behind a town's walls, a ranger in the woods, or after a week of looking), he
  rides home with his guard, and the next hurt sends him out again. On the map he's himself, the Grand Marshal in a red
  ring, and his march plays near him instead of at his empty stockade. It's data: a villain's `sortie` (the story flags
  that hurt him, the share that rides with him, his band and its words), and his band is a `bold` hunter with a `sight`,
  `pace` and `patience` of its own. A hunter now makes for Aldric himself and stops short of him, so one waiting on the
  bridge is met on it, not by the long way round. The bot still wins Aldmoor with every background; Grimsby rides out in
  every run (64 of 64 over sixteen seeds) and is beaten in the open in most, which weakens the stockade, so the bot wins a
  day sooner at the median (knight 12, wizard 9, ranger 11, courtier 11, against 13, 10, 12 and 11) and its worst runs are
  shorter. The difficulty tiers don't move.
- **The minimap, in HoMM2's right-hand panel (29 Sep, #106; the panel went with #130, below, and the minimap stayed):** on a province three days' ride across, the whole of it
  at a glance, so a player plans routes instead of just clicking: where the ford is, what's left to explore, which way
  the stockade lies.
  - **The layout.** Only the adventure map has the panel: its view is now 712 by 464 (22 tiles by 14, HoMM2's
    proportions), and the panel's column stands beside it, where the map's frame ended, in the same slate and gold
    trims. The battle, the court and the title keep the whole width. The bottom bar is as it was.
  - **The minimap** sits at the top of the panel, under the sound buttons: 200 by 150, two pixels a tile in Aldmoor and
    five in the smaller provinces (any other size would be fitted and centred). It's drawn in the game's palette from
    the rules' walk grid and the painter's own regions: the fields in their crops, the heath in heather, the downs pale,
    meadow green in its broad light and shade, each wood in its own mix of trees (Darkwood dark with pines, the chase
    lighter with oaks, the Fenmarch's willows), crags and cliffs grey, the river blue with its falls, the meres and fen
    pools a darker blue (blue, not the map's peaty green, so water never reads as woods), roads pale, bridges stone and
    the ford white water. Roads and crossings win over whatever else a pixel covers, so they never break.
  - **The fog** lies where the map's does: the land shows through the fog's own colours, with no roads, as it does on the
    map, so the lie of the land (the river, the woods) is known but not the way through it. The minimap is a chart, not
    a window: it doesn't darken at night or under the lost commission's gloom.
  - **Marks** for what the map shows clear of the fog: castles and villages blue (troops for hire), enemy bands he knows
    of red (not one out of sight, #125), the villain red with a gold heart (at his lair, or where he rides when he's out,
    his lair then red like any band of his men), treasure (and the X over the sceptre) gold, other places cream, and a
    place used up grey; what's gone from the map is gone from the minimap. Aldric is a gold diamond with a white heart,
    the one shape no place has, drawn over everything. A white frame shows the part of the map on screen.
  - **Using it.** A press on it looks there at once, as in HoMM2, and a drag steers the view, even off its edge; the
    hover label names the place under the pointer, or says the land is unexplored. The keys card says so too.
  - **Cost.** It only reads the rules state. The land is worked out once when the province opens (10 to 40 ms), the fog
    is laid again only round what the hero has just seen, and it paints into the interface's frame only when the fog,
    the places, the hero's pixel or the view's frame change: a frame where nothing moves costs nothing.
  - **The plates under it**, so the panel is whole: Aldric's (his face, name, background and level, experience, and
    HoMM2's movement and mana gauges; a click opens the hero screen), and the bounty's, as King's Bounty's sidebar had
    its contract and its puzzle map: WANTED over the villain's face (stamped PAID once he's taken, as the poster is), the
    reward or what the Crown paid, the days left (red in the last ten) and the torn pieces of the old map found so far
    (a click shows the poster). Each has its hover label.
  - Cards keep over the map's view, clear of the panel, unless they could only fit there by covering what they're
    about; while the opening card asks who he was, Aldric stands low in the view so it fits above him. Changes of
    scene fade or sweep the panel with the picture.
- **Captains: Rook the Huntsman (29 Sep, #15):** captains are the enemy's named lieutenants, who lead a villain's bands,
  and they're data, so any villain can have them. A captain is a troop with the leader's rule from #36 (he stands behind
  his band, nothing can reach him, and he's taken when his band is beaten), a face on his band's cards (`face`), last
  words as he's taken (the band's `lastWords`, in the speech bubble from #104), and a trick of his own, which is an
  ability. Rook the Huntsman is the first: Grimsby's huntsman, the best poacher Aldmoor ever had until the Baron gave him
  the old King's huntsmen's job. He's Wesnoth's Trapper, the poacher he was, grown up, and his portrait has a rook's
  black feather in his cap and a red cloth over his face. He leads the Baron's 84 wolves from the kennels, under
  Grimsby's goose. His trick: he shoots from behind the pack, and whatever his arrows hit is marked for it ("The arrow
  marks them for the pack": 3 less defence for two rounds). His wolves hold the kennels through week 1; on day VIII the
  news says the Baron has told him to bring you in (`wakes`), and from then on he hunts anyone his pack could beat who
  camps near their ground. He sees further than other hunters (380 paces against 260), gives a day's warning, and never
  comes into a town. On the map he stands in his red ring with a wolf at his heel: every leader now has one of his men
  beside him, so Grimsby rides out with a swordsman of his guard. Taken, he begs you not to tell the Baron ("He'll give
  my job back to the old King's lot!"), and taking him hurts Grimsby, who rides out. A ranger the pack respects still
  wins the wolves over, and Rook, with nobody left to lead, gives himself up. The villains' faces now show on their
  lairs' cards too, and on the card when their band falls on your camp. Every tier stays inside its targets (the wolves
  are still 0% at the start and 100% once explored), and the bot wins Aldmoor with every background (64 of 64 over
  sixteen seeds; median day 12 for the knight, 8 for the wizard, 11 for the ranger and 9 for the courtier, since taking
  Rook sends Grimsby out sooner).
- **The old King's hunt hall (29 Sep, #76, as sketched in `act1/aldmoor.md`):** down a lane off the bridge road, on
  Westmere's side of the river, stands the old King's hunt hall, shut up since he died: shutters closed, a bar across
  the door, a stag's antlers on the gable. Its card says only that, with no button at all, greyed out or not. Once
  Aldric has been there, Old Nan can be asked about it (a choice with a `when` isn't on the card until it holds): the old
  King kept the key at his hunting lodge in the chase, on a nail by the door, and bears sleep on the track to it now.
  The mist lifts over the lodge. The track runs on from her back door into the King's chase. Seven bears (Wesnoth's
  Cave Bear: 80 health, attack 9, defence 7, damage 10–16, 12 leadership) hold it, a band: a fair fight for a fresh
  army, and a costly one for the Knight, who loses about a third of his; the Wizard, the Ranger and the Courtier do
  better. They're beasts, so a Ranger who has room can tame them, and a Ranger (or anyone in the Greenwood Cloak) can
  go round them through the woods. The lodge gives up the key and a purse of the old King's crowns (150 gold). With
  the key the hall opens: the door stands open, the windows glow, smoke rises and the King's pennant flies again, and
  twelve of the old King's huntsmen (Wesnoth's Huntsman) come back to it. They're veteran bowmen (18 health, attack 7,
  defence 4, damage 3–5, 16 shots, 3 leadership) who ask no price and draw no wages, and who hunt: their shots and
  blows land half as hard again on beasts, Rook's wolves among them. Grimsby gave their job to Rook, and they'd like a
  word with him. They wait at the hall for as long as it takes Aldric to find room to lead them, and no more come. The
  Armourer's mail covers them, and Expert Offence's charge counts bears among the fighters. Castles and villages now
  show a page written as content first, while one holds, and their recruit card after a choice there; an effect can put
  volunteers at a place (`recruits`, free, or with no payday restock); and beasts are wild things with no wages, so the
  huntsmen say on their card why they serve for nothing. The bot opens the hall and takes the huntsmen when it has the
  key. It wins Aldmoor with every background at much the same pace, over thirty seeds: by day 12, 11, 10 and 10 at the
  median for the Knight, the Wizard, the Ranger and the Courtier (12, 8, 12 and 10 before), and its worst runs are a
  little shorter (28 days at most, against 31). Balancing Aldmoor to its budget (#95) counts the bears and the
  huntsmen in.
- **The grain cart (29 Sep, #78, as sketched in `act1/aldmoor.md`):** every payday from the first (day VIII), while Pike's
  patrol holds the bridge, a squad of it (a fifth of each of its troops: 10 swordsmen and 6 crossbowmen to begin with)
  loads Westmere's grain onto an ox cart for the Baron, and the payday card says so. The cart keeps to the road, over the
  old bridge, past the kennels and through Darkwood to Grimsby's stockade, 360 paces a night: at Westmere on payday, in
  front of the bridge the next morning, over the river after that, and at the stockade before the next payday, when the
  squad walks back to the bridge. So the patrol holds the bridge all the while, a fifth weaker while its squad is out. The
  cart passes through Grimsby's own people (the patrol, Rook's wolves, the Baron's riders) but never ends a night on top of
  them, and it stops short of Aldric if he stands in its road, which is how to catch it. It's a band: a fair fight, and an
  easy one for most armies by then. Caught, its squad never goes back, so the patrol stays that much smaller and the next
  squad is a fifth of what's left. The grain is Aldric's: a week's rations in his baggage, so his troops eat instead of
  drawing wages on the next payday, or, on the victory card, he can take it home to Westmere, which gives 30 more
  peasants to recruit and +10 leadership (Westmere won't forget it). Once the patrol is gone (beaten, paid off, sent back
  with the Baron's orders, or home with Pike), no more carts leave; one already on the road goes on to the stockade. It's
  data: an enemy's `convoy` (who sends it, their share, its road, its pace, and the payday's words), `rations` in the state
  and in effects, and a victory's spoils can name a page whose choices the victory card offers (`spoils.page`). The bot
  wins Aldmoor with every background at the same pace as before (by day 12, 11, 9 and 8 at the median for the Knight,
  the Wizard, the Ranger and the Courtier, over thirty seeds).
- **The old King's falconer (29 Sep, #105):** the south-west heath, west of the river, was a long ride to nothing. Now a
  track off Grimsby's road leads out across the heather to a stone bothy with a turf roof, and a hawk on a block outside.
  Old Wat was the old King's falconer, and Meg is the last of his hawks. He has a clue for anyone who comes (the old King
  never buried gold: whatever he put in the ground, it was warm), and one of two things: Meg herself (a trinket: see 80
  paces further, and she counts every band you see), or, once the huntsmen are back at the hunt hall, himself and his
  three apprentices, who go home to the hall as four more huntsmen, free. That second choice isn't on his card until the
  hall is open (no greyed-out button gives it away), and he has a word for Rook, his old apprentice, on the way. It's
  content, a new look drawn in code (`mews`), and Meg's picture. The deep chase keeps its wild woods: the lodge and its
  bears (#76) give the chase its ride, and past them it's pathless forest only a Ranger (or anyone in the Greenwood
  Cloak) can cross. The bot wins Aldmoor with every background at much the same pace (by day 12, 9, 9 and 8 at the
  median for the Knight, the Wizard, the Ranger and the Courtier).
- **The fog of war, as in HoMM2 (29 Sep, #125):** Artur, on the live build: "You'd expect the fog never to be there
  where your party has been… In Heroes, once you'd explored something, it stayed." In the rules it had stayed: explored
  land never shrinks, and the fog was drawn from it exactly (not a regression from #81). It only looked as if the fog came
  back. The light of the day (28 Sep) fell on the fog and on the land alike, so by evening the land he'd ridden through
  was as amber as the fog, and at nightfall as blue; and the fog's soft edge was centred on the edge of what he'd seen, so
  the rim of it stayed misty. Now:
  - **Land he has seen is clear, all of it, for the rest of the commission:** the terrain, the roads and the places. The
    fog covers only land he has never seen, and its soft edge (three cells) lies over that land, not over what he's seen.
    The minimap shows the same cells.
  - **The light falls on the land he knows,** and on everything that stands on it, never on the fog: in the morning and
    the evening the fog keeps its own grey, and as night falls it goes dark while the known land is moonlit. What he has
    seen is always the lit part of the map.
  - **What moves is the exception.** A band on the move that walks off in the night where Aldric can't see it from his
    camp is out of sight, and gone from the map and the minimap, until he sees it again: within his sight as he rides
    (150 paces, more with Scouting), or wherever the mist lifts (the tower, Far Sight, his scouts at dawn). The issue left
    it open whether to show such a band where it was last seen or to hide it: it's hidden. Bands only move at night, so
    whatever he has seen since dawn is where he saw it; a band he hasn't is nowhere he knows of, rather than a ghost to
    ride to. A hunter on his trail he sees at dawn, as the news says, and one he watches walk off shows until it leaves
    his sight. Guards, lairs and places never move, so they stay once seen. The grain cart is a band on the move too: the
    payday card says it has left Westmere, and it's found on its road. Expert Scouting (scouts shadowing every band) now
    shows every band each dawn, wherever it is. The rules keep it (`unseen` on a band, `rules/map/sight.ts`), so a save
    keeps what he knows.
  - Saves carry on as they were, with no new version: nothing had lost explored land, and the new field is optional. Two
    new frozen scenes, `evening` and `nightfall` (`?movement=N` leaves that much of the day's riding), keep the look honest.
- **The map gets its width back, and a journal (29 Sep, #130):** Artur, playing the live build: the right-hand panel
  (#106) made no sense for this game, which has no castles or towns to manage. It showed a portrait he already knew and
  a poster he'd already read, and took a quarter of the map. So the panel is gone, and the map's view is the whole
  928 by 464 again, as on every other screen.
  - **The minimap stays, small,** over the view's top right corner, under the sound buttons: 160 by 120 in its gold
    moulding (a pixel for every 20 paces in Aldmoor, four a tile in the smaller provinces), with all it had: the land, the
    fog, the marks, Aldric's diamond and the view's frame, and a press looks there and a drag steers. It's laid over the
    map after the light, the weather and the night, so it stays a chart. A button in its corner folds it away with a
    rustle of parchment (so does Tab), and folded, the button alone stays in the corner, a little map that brings it
    back. Whether it's out is kept like the sound's settings, not in the save.
  - **The journal:** J, the book beside the hourglass on the bar, or the bounty's name on the bar opens a parchment
    spread. On the left page, the commission: its number, the province, the day and the days left, the WANTED poster
    pinned in (stamped PAID once he's taken), what he's wanted for, the reward (or what the Crown paid) and the pieces of
    the old map. On the right, **things heard**: what people said or wrote on the road, quoted and not explained, with
    who said it, and a box ticked in red ink once it has paid off (the open ones come first). The playtests (#119,
    #129) asked for it: on a map this size the threads spread out and get lost. It's data: each commission's `heard`
    in `content/campaign.ts` gives the words, who said them, when they count as heard (story flags, where a flag spent
    since still counts, or a place visited) and when they've paid off (flags, or a place used up). Aldmoor has ten
    (Old Pike's journal, the Baron's letter and the orders on the spade, Old Wat, Old Nan three times, the huntsmen,
    the saint and the youngest poacher), and the Fenmarch has Brother Anselm's letter; the generated provinces have
    none yet. The first thing heard in the first commission comes with a hint saying where it's gone.
  - **Nothing important went:** movement and mana stay on the bar, where they always were, with their hover labels;
    Aldric's face, level, experience and stats are on the hero screen (H). The army's stacks on the bar sit a little
    closer, to make room for the book. The save doesn't change. A save from before this has all the journal reads but
    one: Old Nan's word on the hall needs a new flag (`nanHall`), and a place already visited keeps the choices it
    offered (`withNewPlaces`), so a hero who had met her before this won't find that one written down.
- **Never more than a day's ride without something worth it (29 Sep, #124):** Artur found the distances on the bigger
  Aldmoor "just insane", and the playtest rode days VI to X in straight lines between landmarks. Now a check measures it:
  a player rides from one thing to another the cheapest way, and from every spot on those ways the nearest thing is some
  ride off, so twice the furthest any ridden spot is from the nearest thing is the longest ride between things
  (`rules/map/rides.ts`, `npm run rides`). Before, it was 1.3 days on the roads (the ford road, from the signpost to the
  old mine) and up to 2 days across the downs and the fields; now it's 0.6 day on the roads and under 0.9 day in every
  land, and a test keeps it there. Eighteen small finds fill the gaps, as content (`content/aldmoorFinds.ts`): signposts
  with a joke (the crossroads, the Baron's toll-board), two cold campfires with a scrap of Grimsby's orders, the Baron's
  hamper and two lost packs (a little gold each), an eagle's nest, Old Tam's fold and the rustlers who took his ewes (fight
  them, buy the ewes back, or, as a Courtier, shame them into driving the sheep home), the Baron's tax collectors (fight,
  pay, or, as a Courtier, audit them), an eel-catcher, Widow Hesketh's bees, St Hubert's shrine (a longer day's ride, once
  each), the Grey Wethers (climb them to see half the heath), a hayrick, the goose pond and the charcoal burners
  (gossip). None of them answers a quest. They're small for the balance's sake: in all, at most 510 gold, 760 experience
  (520 of it for finding them) and no troops, about a tenth of what Aldmoor already had lying about (a hero who hires
  bands can buy the rustlers or the collectors, at the usual price; a Courtier talks them round instead). Each has a look drawn
  in code, and the land round them is as it was, but for the odd tree or rock that stood where a find does. The bot wins
  Aldmoor with every background at much the same pace.
- **Commission I, shared (30 Sep, #146):** Artur is sharing the game on LinkedIn once Commission I is ready, to get
  feedback before building the other four. So the public game stops after it: at the court after Aldmoor, once the boon
  is taken, a closing card says Commission I is complete and more are coming, and the King lets slip who's next (Black
  Hollis, the Bandit King, in the Fenmarch: #87). Two links open Artur's LinkedIn in a new tab, to follow him for the
  next commissions and to tell him what you thought (in the comments on his post, or a message), and the way on is back
  to the title, whose Continue returns to that card. Its words are plain, full sentences, as Artur asked for everything
  a player reads (#145): no colons, dashes or clipped phrases. How far the public game goes, and the tease, are one place
  (`LAUNCH` in `src/content/launch.ts`); the bot and the debug routes (`?commission=`, `?chapter=`, and `?court=` after
  a later commission) ride on past it. The page has a link preview: Open Graph tags in `index.html`, and a 1200×630
  picture cropped from the title painting by `npm run linkpreview` (`public/link-preview.png`). The name is in the
  page's title and the preview's (`index.html`), and on the painting, and the site's address only in `og:image`, so a
  rename or a move (#147) changes those and re-runs `npm run linkpreview`.
- **A visitor counter (30 Sep, #157):** to see how many people come from LinkedIn and how far they get, the live site
  counts with GoatCounter, which sets no cookies: the page view, then a new campaign, the hero chosen, the first battle
  won and lost, days 5, 10 and 20, Grimsby taken and the closing card, each once a visit. Nothing personal is sent (no
  save, no IDs, no names), and GoatCounter tells a phone from a desktop by the screen's size. Its script loads a second
  after the first frame, pinned to a version by its hash, and only main's build has the site code (the repository
  variable `GOATCOUNTER_CODE`), so nothing else counts.
- **The odds at a glance (30 Sep, #154):** Artur lost with the Knight, and clicking a band never told him plainly whether
  he would win. Now the sergeants' verdict leads every card about a fight, in its colour: green for *You should win*
  (nine chances in ten or better), amber for *The odds are on your side*, red for *The odds are against you* (under 55%)
  and dark red for *You'd likely lose* (under 30%), the thresholds the cards always used. It is the first thing on a
  band's card from afar, on its card when he rides up, and on an ambush, and it sits under a band's name in the label
  when the pointer rests on it, on the map or the minimap, or when a finger holds it. The army's own words still follow
  the threat ("They look nervous."), and scouts who put a number on the odds say it from afar too. The odds come from
  simulated fights, so a worker works out every band's ahead of time, and a hover or a tap never waits for them.
- **What a click will do, in battle (30 Sep, #156):** Artur played as the Knight and couldn't see what a click would
  do. Every action has its own pointer now, drawn in code like the map's crossed swords. A sword (a lance for a charge)
  points the way the blow goes in, and there's a bow for a shot, boots for a march (a horseshoe for riders, a paw for
  beasts), the spell's sign while aiming one, a lute for the Courtier's business, and a red "no" wherever on the field a
  click would do nothing. The stacks a click would reach light up gold, and your own that a spell would catch too light
  up red. A blow's hex is lit, with an arrow into the stack it lands on. A parchment tag beside them says what happens in
  short plain sentences. It gives the damage, how many perish, and whether they strike back or first and how many of
  yours that costs. Its numbers are the rules' own reckoning, from the rules playing the action out without dice, so it
  never disagrees with what happens. On a phone the first tap shows all of it with "Tap again to attack", and the second
  tap acts. The ribbon keeps the full line.
- **Power decides, and leadership you can grow (30 Sep, #167):** the Courtier bought his way past Grimsby, and the
  Ranger and the Wizard hit a wall at the stockade (#171), the Ranger held back by leadership. Artur: one number, the
  army's power, decides who comes over, as in Heroes. Beasts follow, bands take coin and stacks take a bard's gold only
  as far as his army outweighs theirs, none at all while it's no stronger and all of them once it's twice as strong,
  and whoever doesn't come attacks at once. Bribes are priced by power, and never more than half off. Beasts and the
  old King's huntsmen draw no wages and need no leadership. Every level-up offers +25 leadership in place of a skill,
  and the steward at the castle raises 20 more for 500 gold, as often as he can pay.
- **The enemy keeps its losses (30 Sep, #167, #171):** the Wizard and the Ranger hit a wall at Grimsby's stockade,
  because it was whole again after every fight they lost there. The Wizard's defeat killed 69 of its 73 swordsmen and
  every crossbowman, and his next try met all of them again. Artur: a retreat or a defeat leaves the enemy's losses
  standing, as in HoMM2. A band, a convoy or a lair that holds the field keeps whoever of it still stands, and those paid
  to go home or to come over are gone for good. The guard the Baron calls to the field can make up his losses, but never
  leaves him more men than he had. The cards say how many are left, and the map, the hover label and the odds show the
  enemy as it is now. A lair recruits from what's left, a sortie's band and a convoy's squad go home with whoever is
  left of them, and the goose's hymn isn't offered once no crossbowmen are left to run after her.
- **Every find answers back (1 Oct, #192):** Artur asked for more juice, and for exploring Aldmoor to be an adventure.
  This is the first slice of the ideas he picked on #192. Whatever Aldric gains rises off him in its own colour and with
  its own sound: movement, mana, a new spell and gear, with its picture, as well as gold, troops, leadership and
  experience, which rose before. Gold flies from where it was found to the bar as coins, and the count there rolls up as
  they land, lit while it does. Treasure still lying where he can see it twinkles now and then, and when something new
  goes into the journal a page turns and the book on the bar lights up. Four new sounds were measured onto their marks
  with `npm run listen`: a harp and a bell for gear, a glassy run for mana, hoofbeats for movement, and a clink for each
  coin. It is drawing and sound only, so the rules, the balance and the saves are as they were.
- **Combat with juice (1 Oct, #190):** Artur asked for more juice in combat too. A design session played fights by hand,
  frame by frame, and ranked twelve ideas on #190; ten were picked and built in four slices (#198, #200, #201 and the
  last). A blow holds the field still for a few frames as it lands, shows its target white for a frame and kicks the
  field the way it went, with a thump under it. How many fell pops out of the stack's own badge as its count rolls down.
  The last of a stack falls over and lands in dust, and the leaders behind each line hop for joy or sag. Shooters loose
  volleys, and the arrows that miss stay in the ground. A lucky blow has a rainbow come down onto its stack, good morale
  a gold ring, and faltering a grey cloud. A charge throws up dust and its target stands in front of it. A victory makes
  your stacks hop and the enemy's standard fall, and a defeat dips yours. Lightning lights the field and rolls thunder, a
  Fireball booms and smokes, and the field keeps the blood, the scorches and what the fallen dropped. Your stacks bounce
  as their turns come. Only the holds add time, about a second to a fight on Auto, and a switch for gentle effects in the
  mix panel turns the kick, the flashes and the holds down. Squash and stretch (#197) and a living battlefield (#196)
  wait for Artur to pick them.
- **The payday feast (1 Oct, #191):** Artur asked for camping with a picture, music and animation, and then for it not
  to come every night, but once a week as a break from the routine. So on the night that brings payday, the night falls
  into Aldric's camp celebrating round the fire: a pig on the spit, ale, bread and cheese, the King's chest of gold,
  Aldric as his background (the Knight raising a goblet, the Courtier playing his lute) and a figure for each of his
  three biggest stacks, the peasants dancing and the Ranger's beasts asleep by the fire. Payday's card stands beside it
  with the week's news, a line under the fire says how the camp celebrates, and the Saltarello plays. It costs no extra
  click, because payday's card needed one already, and the other nights end as they always did.
- **Chests with a surprise inside (1 Oct, #192):** the second slice. Eight more chests stand in Aldmoor, one or two
  a land, and they all look the same, as King's Bounty's do. Four hold gold (670 in all), which you keep or hand out
  for leadership. One holds a scroll of Slow, or for a hero who knows it, the notes in its margins. One holds a map
  of the King's chase, and two hold a piece of gear, each guarded in plain sight: 45 wolves lie round a gilded chest
  on the heath with the Breastplate of the Crown in it, and 40 boars root round one in the chase with a wizard's
  button. Each guard wins on day one but costs a fifth to a third of the army, so it's worth coming back to later. An
  opened chest stays on the map, open and empty, with a creak, and the journal keeps a tally of the chests opened.
  The careful player still wins every run (`npm run sim -- 10`), with every tier inside its targets
  (`npm run difficulty`). He spends a few more days and a level or two before Grimsby, opening chests and fighting
  their guards, except the Ranger, whom a chest by the start leads to the chase to tame its boars and bears on day
  three, so he takes the bridge on day five or six.
- **Things you pick up as you ride (1 Oct, #192):** the third slice. 34 small things lie by Aldmoor's roads and on
  the tracks across open land, about a quarter of a day apart, and Aldric takes them as he rides by, without a card or
  a stop, as Heroes II's piles are taken: eleven purses (250 gold in all), eleven sheaves of oats (20 movement for the
  day), six clusters of blue crystals by the crags and in Darkwood (5 mana), and six lost letters (25 experience).
  Each one he picks up the same day chimes a step higher than the last, and what it gave rises off him. A letter's
  words go in the journal, from young Pike's letter home to the Baron's list for the cart, and the book on the bar
  lights up, and if he rode to it on purpose he stops and reads it there. The journal counts what he has picked up. They aren't places: finding one gives no experience of its own, the
  minimap doesn't mark them, and `npm run rides` doesn't count them as stops. The bot picks them up as it rides, and
  the careful player still wins every run, taking Grimsby on the same days or a little sooner, with every tier inside
  its targets.
- **The lost geese, and lookouts with glints (1 Oct, #192):** the last slice. Seven of the royal goose's cousins have
  wandered off across Aldmoor, tucked away by things a curious rider looks at, such as the Grey Wethers, the
  falconer's cabbages and the mouth of the old delving. Found, each goes home to the goose pond with a honk and a
  flurry of feathers, "Goose 3 of 7" rises off Aldric, and she swims on the pond with the others. Once all seven are
  home the goose-girl gives him her lucky feather, and the King hears of it at court. Four lookouts stand in the lands
  that had none (the beacon on the downs, the lone pine in Darkwood, the old King's hunting stand in the chase and a
  cairn on the crags), and each lifts the mist round it as the Grey Wethers do, with a gust of wind. Treasure glints
  once as it comes into sight, and now and then through the edge of the mist, and the journal counts the geese sent
  home and the lookouts climbed. Idea 7, luck or heart for the next fight, waits in #206 for the battle's luck and
  morale to settle.
- **The lullaby, the gates and taming (2 Oct, #167, #232, #219):** Artur's calls after the Courtier's playtest. Old
  Nan's lullaby works only once Grimsby has been beaten in the field, and she says so (*"Give him a good fright
  first"*). Sung under the stockade, it sends two in five of his garrison home to their mothers, and the Courtier still
  has to take the rest. The bridge costs 2,700 gold to pay off, three times what it did. Taming stays before the fight,
  and the Ranger, the hero beasts follow, wins over far more of a pack (half of one as strong as his army, all of one
  two thirds as strong). Taming takes anyone the rest of the day, so it needs half a day left. The bigger design of the Ranger's beasts comes later.
- **Spells are found, and a Wizard's skills are his own (2 Oct, #240):** Artur: *"You shouldn't start with all these
  spells... you shouldn't get the amazing spells like the lightning bolt out of the gate."* The Wizard starts with
  Magic Arrow, a new spell that does half a bolt's damage (10 a point of spell power, for 4 mana), and Bless. The
  Knight, the Ranger and the Courtier start with none, as might heroes in HoMM2 do, and learn every spell on the map.
  Every level-up offers one of his background's own three skills while any has a rank left, as well as a trick.
  Wizardry (Sorcery, Mysticism, Spellcraft, Battle Mage and Far Sight) is offered to the Wizard alone. Spellcraft
  takes Scouting's place among his own three skills (#228's fix): Basic makes his damage spells do 15% more, Advanced
  lays Bless, Haste and Stone Skin on every stack of his at once, and Expert makes his Fireball do 18 a point of spell
  power, not 12. Scroll stones stand on the map, as HoMM2's shrines of the 1st, 2nd and 3rd circle
  do: a standing stone with a scroll bound to it under a seal of red wax, blue wax or gold, that teaches one spell to
  any hero, or gives one who knows it the notes in its margins (100 experience). Bless's and Magic Arrow's, of the 1st
  circle, stand by St Aldhelm's shrine and on the edge of the downs. Still to come: the Lightning Bolt's, of the 3rd
  circle, by the river behind #239's outlaws, and Curse's, of the 2nd, on the heath.
