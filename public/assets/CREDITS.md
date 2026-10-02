# Asset credits

## Aldmoor's map and the troops

Aldmoor's places, trees, crags, bridge, river and ground (`public/assets/map/`), and the troops' and
Aldric's figures (`public/assets/troops/`), were made on 1 October 2026
with [Retro Diffusion](https://www.retrodiffusion.ai/), an image model, at Artur's direction (#178),
in the spirit of Heroes of Might and Magic II's adventure map. The sheets it made are kept as they
came in `art/map/sheets/`; `npm run mapart` (`scripts/mapart.py`) cuts them into pieces, sizes them
to the map and puts them in the game's palette. They're part of Crown & Bounty, under its licence.

A second set of sheets was made the same day, after Artur put the map beside HoMM2's: the bright
trees (`groves.png`, `conifers.png`), the waterside (`shore.png`), farm things (`farm.png`), hills and
outcrops (`hills.png`), treasure (`treasure.png`), the battlefield's obstacles (`battle.png`), and the
troops and Aldric drawn again with HoMM2's battle screen as the reference (`units-a.png` to `units-d.png`).

The payday feast's people and things (`public/assets/feast/`, #191) were made the same way on 1 October 2026,
with our own unit and place sheets as the reference: Aldric as each background, the troops celebrating, the fire,
the roast, the tents and the horses (`feast-1.png` to `feast-4.png` in `art/map/sheets/`).

The troops and captains that came later were drawn the same way on 2 October 2026 (#255), with HoMM2's battle screens
and our own unit sheets as the reference: the cutpurses, the outlaws' captains and Darkwood's giant spiders
(`units-e.png`), and the Baron's pikemen, men-at-arms, sergeants, picket captain and foreman in his red and gold
(`units-f.png`). The request for each sheet is kept in `art/map/jobs/`.

## The units: Battle for Wesnoth

Under the painted figures, the troops and the hero are units from [Battle for Wesnoth](https://www.wesnoth.org/) 1.18:
Wesnoth's frames time each troop's blows, and stand in for a painted figure until it loads. They're taken
from [its official repository](https://github.com/wesnoth/wesnoth) at the pinned tag `1.18.8`. Thank
you to Wesnoth's artists: the full list is in Wesnoth's
[`data/core/about.cfg`](https://github.com/wesnoth/wesnoth/blob/1.18.8/data/core/about.cfg), and each
file below names the artists its history records.

- **Licences.** Wesnoth's art is under the
  [GNU GPL v2 or later](https://www.gnu.org/licenses/old-licenses/gpl-2.0.html). What was added to
  Wesnoth after 30 July 2017 is under [Creative Commons BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)
  (see [Wesnoth:Copyrights](https://wiki.wesnoth.org/Wesnoth:Copyrights)). Each file's licence is
  listed below. Crown & Bounty itself is GPL-2.0-or-later (`LICENSE`).
- **Unchanged files.** The PNGs are kept exactly as Wesnoth has them, in
  `public/assets/wesnoth/units/`: they are the preferred form for modification. `npm run wesnoth`
  downloads them again from the tag.
- **Changes, made in code as the game runs** (`src/render/wesnoth.ts`):
  - Wesnoth's magenta team colour is recoloured to our blue or red, by Wesnoth's own rule.
  - The images are scaled: 1.5× in battle, 0.9× on the map, and the hero at 1×.
  - On the map they are brightened a little and given an ink outline.
  - Every image is matched to the game's 256-colour palette.
  - The animations follow each unit's `.cfg`, as listed below.
- **Artists, from the history.** For each file: the author of each commit that changed the image, or
  the artist the commit message names ("by …"). Commits that only recompress or move files are left
  out.

## The lettering: TeX Gyre Pagella

The game's words, on the canvas and on the cards, are set in Bounty Serif, a changed version of
[TeX Gyre Pagella](https://ctan.org/pkg/tex-gyre-pagella) 2.501, a free Palatino by the GUST
e-foundry (Bogusław Jackowski, Janusz M. Nowacki, Piotr Pianowski and Piotr Strzelczyk), based on
URW Palladio L. Thank you to them. It comes with the game, so the words look the same on every
device, Android phones included, which have no Palatino of their own.

- **Licence.** The [GUST Font License](https://www.gust.org.pl/projects/e-foundry/licenses), which is
  the [LaTeX Project Public License](https://www.latex-project.org/lppl.txt) 1.3c or later. The fonts
  are separate files that the game loads, next to it rather than part of it.
- **Changes** (`scripts/fonts.py`, `npm run fonts`): renamed, as the licence asks; cut down to the
  letters the game uses; a few signs fitted to Palatino's widths; two shapes added (◆ and ▾); Palatino's
  line spacing; saved as WOFF2. `public/assets/fonts/README-bounty-serif.txt` lists every change and
  where to get the original, and `GUST-FONT-LICENSE.txt` is beside it.

## The music: yubatake

The music is yubatake's: tunes from the
[JRPG Collection](https://opengameart.org/content/jrpg-collection), the
[JRPG Collection 2](https://opengameart.org/content/jrpg-collection-2),
[Northern Isles](https://opengameart.org/content/northern-isles) and
[The Ride](https://opengameart.org/content/the-ride), on OpenGameArt. Thank you to them.

- **Licence.** [Creative Commons BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- **Unchanged files.** The MIDI files are kept exactly as they come in each page's download, in
  `public/assets/music/`.
- **Changes, made in code as the game plays them** (`src/audio/score.ts`): we chose a General MIDI
  instrument for each of his parts, and how loud it plays; some notes move by octaves into their
  instrument's range; each tune is set to a common loudness; and the band plays in a small room's echo.

| File | Tune | From | Licence | Plays |
| --- | --- | --- | --- | --- |
| `JRPG_mainTheme.mid` | Main Theme | JRPG Collection | CC BY 4.0 | the title |
| `NorthernIsles.mid` | Northern Isles | Northern Isles | CC BY 4.0 | Aldmoor, the Fenmarch, and two later lands |
| `JRPG_fields.mid` | Fields | JRPG Collection | CC BY 4.0 | Aldmoor, and two later lands |
| `JRPG_mysticIsle.mid` | Mystic Isle | JRPG Collection 2 | CC BY 4.0 | the Fenmarch, and two later lands |
| `TheRide.mid` | The Ride | The Ride | CC BY 4.0 | battles, on violins, viola and cello |
| `JRPG_battleBoss.mid` | Boss Battle | JRPG Collection 2 | CC BY 4.0 | Baron Grimsby's battle |
| `JRPG_dungeon.mid` | Dungeon | JRPG Collection | CC BY 4.0 | Mother Mirrow's and Aunt Bramble's battles |

## The court's music: the Mutopia Project

Two Renaissance pieces play at the King's court, and a third at the payday feast, from the [Mutopia Project](https://www.mutopiaproject.org/)'s
free editions. The MIDI files are kept as Mutopia publishes them, in `public/assets/music/`, and are
played by the same band and arrangement rules as the rest (`src/audio/score.ts`): a small consort of
recorder, shawm, lute and viol at court, and the harp and the lute at the feast.

| File | Piece | Edition | Licence | Plays |
| --- | --- | --- | --- | --- |
| `Arbeau_BelleQui.mid` | Belle qui tiens ma vie, Thoinot Arbeau (1589) | [Mutopia](https://www.mutopiaproject.org/cgibin/make-table.cgi?searchingfor=Belle+qui) | Public domain | the court |
| `Dowland_UnquietThoughts.mid` | Unquiet Thoughts, John Dowland (1597) | [Mutopia](https://www.mutopiaproject.org/cgibin/make-table.cgi?searchingfor=Unquiet+Thoughts) | Public domain | the court |
| `Galilei_Saltarello.mid` | Saltarello, Vincenzo Galilei (16th century) | [Mutopia](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=110) | Public domain | the payday feast, on harp and lute |

## The instruments: GeneralUser GS

The band plays its notes on samples from [GeneralUser GS](https://www.schristiancollins.com/generaluser.php)
v2.0.3, S. Christian Collins's General MIDI SoundFont, taken from
[its repository](https://github.com/mrbumpy409/GeneralUser-GS) at commit
`684543d5e5efaef08d02be50dcda8d552478fa60`. Thank you to him.

- **Licence.** GeneralUser GS License v2.0, which lets software use it and change it:
  `public/assets/music/GeneralUser-GS-LICENSE.txt`.
- **Changes** (`scripts/soundfont.py`): cut down to the sixteen instruments and six drums the music
  uses, and to the keys it plays; one velocity layer, one layer of a layered sound and one side of a
  stereo sample; every other sample (or every third) of the strings, the flute, the guitar and the
  brass; tails over a second or two faded out; resampled to 22 kHz; stored losslessly, one after another, in `band.flac`, with each sample's zones, tuning,
  loop and envelope in `band.json`.

## The sounds of a fight: recordings made by people

Every sound of a battle is a recording (#257): a troop's weapon, what it lands on, its cries, its feet,
and the spells. `scripts/sfx.py` fetches each recording below from the address it names, cuts it,
layers it as the game plays it (a blow with a hit on flesh or on armour under it, a death cry with a
body falling after it), sets every take to one loudness with a gentle limiter on its peaks, and packs
the takes losslessly, at 32 kHz, into `public/assets/sfx/battle.flac` with their index in
`battle.json`. The game plays each at its level in the mix (`src/audio/blows.ts`), a little higher or
lower each time. Thank you to everyone below.

### Battle for Wesnoth's sounds

From [its repository](https://github.com/wesnoth/wesnoth) at the tag `1.18.8`, `data/core/sounds/`,
by the people its `copyrights.csv` names. Each troop's weapon and cries are its own Wesnoth unit's,
as its pictures are. **Licence:** the [GNU GPL v2 or later](https://www.gnu.org/licenses/old-licenses/gpl-2.0.html).

| File | By | Licence |
| --- | --- | --- |
| `bite-small.ogg` | Lari Nieminen | GPL v2+ |
| `bite.ogg` | Lari Nieminen | GPL v2+ |
| `bow.ogg` | Lari Nieminen | GPL v2+ |
| `club.ogg` | Leonardo Magno Sampaio | GPL v2+ |
| `crossbow.ogg` | Lari Nieminen | GPL v2+ |
| `drake-die.ogg` | Lari Nieminen | GPL v2+ |
| `explosion.ogg` | Lari Nieminen | GPL v2+ |
| `goblin-die-1.ogg` | Lari Nieminen | GPL v2+ |
| `goblin-die-2.ogg` | Lari Nieminen | GPL v2+ |
| `goblin-hit-1.ogg` | Lari Nieminen | GPL v2+ |
| `goblin-hit-2.ogg` | Lari Nieminen | GPL v2+ |
| `goblin-hit-3.ogg` | Lari Nieminen | GPL v2+ |
| `hiss-big.wav` | J.W. Bjerk | GPL v2+ |
| `hiss-die.wav` | J.W. Bjerk | GPL v2+ |
| `hiss-hit.wav` | J.W. Bjerk | GPL v2+ |
| `human-die-1.ogg` | Lari Nieminen | GPL v2+ |
| `human-die-2.ogg` | Lari Nieminen | GPL v2+ |
| `human-die-3.ogg` | Lari Nieminen | GPL v2+ |
| `human-female-die-1.ogg` | Lari Nieminen | GPL v2+ |
| `human-female-die-2.ogg` | Lari Nieminen | GPL v2+ |
| `human-female-die-3.ogg` | Lari Nieminen | GPL v2+ |
| `human-female-hit-1.ogg` | Lari Nieminen | GPL v2+ |
| `human-female-hit-2.ogg` | Lari Nieminen | GPL v2+ |
| `human-female-hit-3.ogg` | Lari Nieminen | GPL v2+ |
| `human-hit-1.ogg` | Lari Nieminen | GPL v2+ |
| `human-hit-2.ogg` | Lari Nieminen | GPL v2+ |
| `human-hit-3.ogg` | Lari Nieminen | GPL v2+ |
| `human-hit-4.ogg` | Lari Nieminen | GPL v2+ |
| `human-hit-5.ogg` | Lari Nieminen | GPL v2+ |
| `knife.ogg` | Lari Nieminen | GPL v2+ |
| `lightning.ogg` | Lari Nieminen | GPL v2+ |
| `mace.ogg` | Leonardo Magno Sampaio | GPL v2+ |
| `mace.wav` | Leonardo Magno Sampaio | GPL v2+ |
| `magic-dark-big.ogg` | Lari Nieminen | GPL v2+ |
| `magic-dark.ogg` | Lari Nieminen | GPL v2+ |
| `magic-faeriefire.ogg` | Lari Nieminen | GPL v2+ |
| `magic-holy-1.ogg` | Richard Kettering | GPL v2+ |
| `magic-holy-2.ogg` | Richard Kettering | GPL v2+ |
| `magic-missile-1.ogg` | Lari Nieminen | GPL v2+ |
| `magic-missile-2.ogg` | Lari Nieminen | GPL v2+ |
| `magic-missile-3.ogg` | Lari Nieminen | GPL v2+ |
| `spear.ogg` | Lari Nieminen | GPL v2+ |
| `spear.wav` | unknown | GPL v2+ |
| `staff.wav` | Leonardo Magno Sampaio | GPL v2+ |
| `sword-1.ogg` | Lari Nieminen | GPL v2+ |
| `troll-die-1.ogg` | Lari Nieminen | GPL v2+ |
| `troll-die-2.ogg` | Lari Nieminen | GPL v2+ |
| `troll-die-3.ogg` | Lari Nieminen | GPL v2+ |
| `troll-hit-1.ogg` | Lari Nieminen | GPL v2+ |
| `troll-hit-2.ogg` | Lari Nieminen | GPL v2+ |
| `troll-hit-3.ogg` | Lari Nieminen | GPL v2+ |
| `troll-hit-4.ogg` | Lari Nieminen | GPL v2+ |
| `tusker-charge.ogg` | Phil Barber | GPL v2+ |
| `tusker-hit.ogg` | Phil Barber | GPL v2+ |
| `wolf-die-1.ogg` | Lari Nieminen | GPL v2+ |
| `wolf-die-3.ogg` | Lari Nieminen | GPL v2+ |
| `wolf-hit-1.ogg` | Lari Nieminen | GPL v2+ |
| `wolf-hit-2.ogg` | Lari Nieminen | GPL v2+ |
| `wolf-hit-4.ogg` | Lari Nieminen | GPL v2+ |
| `yeti-hit.ogg` | Lari Nieminen | GPL v2+ |

### Will Leamon's Fleshy Fight Sounds

[Fleshy Fight Sounds](https://opengameart.org/content/fleshy-fight-sounds) by Will Leamon, on
OpenGameArt: the hit of a sword, a hammer, a point and a fist, each on flesh (`-1a`, `-1b`) and on
armour (`-arm-2a`, `-arm-2b`), and his alternative punches (`punch_alt-2a`, `punch_alt-2b`), dull
and low, for the weight under a heavy blow. Additional sound effects by Will Leamon.
**Licence:** [OGA-BY 3.0](https://static.opengameart.org/OGA-BY-3.0.txt).

`sword-1a.wav`, `sword-1b.wav`, `sword-arm-2a.wav`, `sword-arm-2b.wav`, `hammer-1a.wav`,
`hammer-1b.wav`, `hammer-arm-2a.wav`, `hammer-arm-2b.wav`, `piercing-1a.wav`, `piercing-1b.wav`,
`piercing-arm-2a.wav`, `piercing-arm-2b.wav`, `punch_1a.wav`, `punch_1b.wav`, `punch_alt-2a.wav`,
`punch_alt-2b.wav`.

### Kenney's sounds

[Impact Sounds](https://kenney.nl/assets/impact-sounds) and [RPG Audio](https://kenney.nl/assets/rpg-audio)
by Kenney (kenney.nl). **Licence:** [CC0](https://creativecommons.org/publicdomain/zero/1.0/).

- Impact Sounds: `footstep_grass_000.ogg`, `footstep_grass_001.ogg`, `footstep_grass_002.ogg`,
  `footstep_grass_003.ogg` and `footstep_grass_004.ogg` (boots, paws, trotters and patter on the
  field); `impactSoft_medium_000.ogg`, `impactSoft_medium_001.ogg` and `impactSoft_medium_002.ogg`
  (the weight under a scratch); `impactSoft_heavy_000.ogg` (a troll's blow and stomp);
  `impactWood_heavy_000.ogg` (a lance's shaft); `impactWood_light_000.ogg`, `impactWood_light_001.ogg`
  and `impactWood_light_002.ogg` (your turn).
- RPG Audio: `knifeSlice.ogg`, `knifeSlice2.ogg` (a knife).

### Freesound's recordings

Each recorded by the person named, on [Freesound](https://freesound.org). **Licence:**
[CC0](https://creativecommons.org/publicdomain/zero/1.0/), and credited all the same. The pack is cut
from Freesound's high-quality previews of them.

| Recording | By | Plays |
| --- | --- | --- |
| [SRS_Foley_Horse_Galloping.wav](https://freesound.org/s/165532/) | StephenSaldanha | a knight's hooves on the field |
| [Arrow Impact](https://freesound.org/s/205938/) | Twisted_Euphoria | an arrow landing |
| [Arrow Impact](https://freesound.org/s/521552/) | omerbhatti34 | an arrow landing |
| [Bow Release (Bow and Arrow) 3](https://freesound.org/s/384918/) | Ali_6868 | an arrow loosed |
| [Longbow Release 2.wav](https://freesound.org/s/394179/) | saturdaysoundguy | an arrow loosed |
| [Crossbow Firing and Hitting Target](https://freesound.org/s/384919/) | Ali_6868 | a crossbow bolt, loosed and landing |
| [Body fall.wav](https://freesound.org/s/417994/) | DylanTheFish | a body falling after a death cry |
| [BODY FALL - V HVY - DIRT](https://freesound.org/s/504626/) | leonelmail | a heavy body falling, a troll's stomp, and the weight under a charge |
| [Fireball](https://freesound.org/s/683179/) | NearTheAtmoshphere | a Fireball falling |

## Everything else

The terrain, buildings, portraits, title painting, interface, icon, the sound effects outside a
fight, the stings and the ambience are all made in code (`src/render/`, `src/audio/`). No
image-generation models are used.

## Wesnoth files

<!-- wesnoth-files -->
From [wesnoth/wesnoth](https://github.com/wesnoth/wesnoth) at tag `1.18.8` (commit `9f54f6a4f65b0d942a70436372e7cf28c4ba14d0`), `data/core/images/units/`, kept unchanged in `public/assets/wesnoth/units/`.

### Peasant (our peasants)

Frames and timings from `data/core/units/humans/Peasant.cfg`.

| File | Licence | Artists, from the history | Added | Last changed |
| --- | --- | --- | --- | --- |
| `human-peasants/peasant.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-04-29 |
| `human-peasants/peasant-defend.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-04-29 |
| `human-peasants/peasant-idle-1.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-04-29 |
| `human-peasants/peasant-idle-2.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-04-29 |
| `human-peasants/peasant-idle-3.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-04-29 |
| `human-peasants/peasant-idle-4.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-04-29 |
| `human-peasants/peasant-idle-5.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-04-29 |
| `human-peasants/peasant-idle-6.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-04-29 |
| `human-peasants/peasant-idle-7.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-04-29 |
| `human-peasants/peasant-attack1.png` | CC BY-SA 4.0 | doofus-01 | 2018-06-10 | 2022-04-29 |
| `human-peasants/peasant-attack2.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-04-29 |
| `human-peasants/peasant-attack3.png` | CC BY-SA 4.0 | doofus-01 | 2018-06-10 | 2022-04-29 |
| `human-peasants/peasant-attack4.png` | CC BY-SA 4.0 | doofus-01 | 2018-06-10 | 2022-04-29 |
| `human-peasants/peasant-attack5.png` | CC BY-SA 4.0 | doofus-01 | 2018-06-10 | 2022-04-29 |
| `human-peasants/peasant-die1.png` | CC BY-SA 4.0 | doofus-01 | 2024-01-07 | 2024-01-07 |
| `human-peasants/peasant-die2.png` | CC BY-SA 4.0 | doofus-01 | 2024-01-07 | 2024-01-07 |
| `human-peasants/peasant-die3.png` | CC BY-SA 4.0 | doofus-01 | 2024-01-07 | 2024-01-07 |
| `human-peasants/peasant-die4.png` | CC BY-SA 4.0 | doofus-01 | 2024-01-07 | 2024-01-07 |
| `human-peasants/peasant-die5.png` | CC BY-SA 4.0 | doofus-01 | 2024-01-07 | 2024-01-07 |
| `human-peasants/peasant-die6.png` | CC BY-SA 4.0 | doofus-01 | 2024-01-07 | 2024-01-07 |
| `human-peasants/peasant-die7.png` | CC BY-SA 4.0 | doofus-01 | 2024-01-07 | 2024-01-07 |
| `human-peasants/peasant-die8.png` | CC BY-SA 4.0 | doofus-01 | 2024-01-07 | 2024-01-07 |
| `human-peasants/peasant-die9.png` | CC BY-SA 4.0 | doofus-01 | 2024-01-07 | 2024-01-07 |

### Bowman (our archers)

Frames and timings from `data/core/units/humans/Loyalist_Bowman.cfg`.

| File | Licence | Artists, from the history | Added | Last changed |
| --- | --- | --- | --- | --- |
| `human-loyalists/bowman.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering, thespaceinvader | 2007-05-16 | 2022-06-04 |
| `human-loyalists/bowman-melee-defend-2.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2008-05-28 | 2022-06-04 |
| `human-loyalists/bowman-bow-defend.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2008-05-28 | 2022-06-04 |
| `human-loyalists/bowman-melee-defend-1.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2008-05-28 | 2022-06-04 |
| `human-loyalists/bowman-melee-attack-1.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2008-05-28 | 2022-06-04 |
| `human-loyalists/bowman-melee-attack-2.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2008-05-28 | 2022-06-04 |
| `human-loyalists/bowman-melee-attack-3.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2008-05-28 | 2022-06-04 |
| `human-loyalists/bowman-melee-attack-4.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2008-05-28 | 2022-06-04 |
| `human-loyalists/bowman-bow.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2008-05-28 | 2022-06-04 |
| `human-loyalists/bowman-bow-attack-1.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2008-05-28 | 2022-06-04 |
| `human-loyalists/bowman-bow-attack-2.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2008-05-28 | 2022-06-04 |
| `human-loyalists/bowman-bow-attack-3.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2008-05-28 | 2022-06-04 |
| `human-loyalists/bowman-bow-attack-4.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2008-05-28 | 2022-06-04 |

### Knight (our knights)

Frames and timings from `data/core/units/humans/Horse_Knight.cfg`.

| File | Licence | Artists, from the history | Added | Last changed |
| --- | --- | --- | --- | --- |
| `human-loyalists/knight/knight.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2013-06-10 | 2022-06-04 |
| `human-loyalists/knight/knight-se-defend2.png` | CC BY-SA 4.0 | doofus-01, Richard Kettering | 2017-08-21 | 2022-06-04 |
| `human-loyalists/knight/knight-breeze-1.png` | CC BY-SA 4.0 | doofus-01 | 2022-06-05 | 2022-06-05 |
| `human-loyalists/knight/knight-breeze-2.png` | CC BY-SA 4.0 | doofus-01 | 2022-06-05 | 2022-06-05 |
| `human-loyalists/knight/knight-breeze-3.png` | CC BY-SA 4.0 | doofus-01 | 2022-06-05 | 2022-06-05 |
| `human-loyalists/knight/knight-breeze-4.png` | CC BY-SA 4.0 | doofus-01 | 2022-06-05 | 2022-06-05 |
| `human-loyalists/knight/knight-breeze-5.png` | CC BY-SA 4.0 | doofus-01 | 2022-06-05 | 2022-06-05 |
| `human-loyalists/knight/knight-se-run1.png` | CC BY-SA 4.0 | doofus-01, Richard Kettering | 2017-08-21 | 2022-06-04 |
| `human-loyalists/knight/knight-se-run2.png` | CC BY-SA 4.0 | doofus-01, Richard Kettering | 2017-08-21 | 2022-06-04 |
| `human-loyalists/knight/knight-se-run3.png` | CC BY-SA 4.0 | doofus-01, Richard Kettering | 2017-08-21 | 2022-06-04 |
| `human-loyalists/knight/knight-se-run4.png` | CC BY-SA 4.0 | doofus-01, Richard Kettering | 2017-08-21 | 2022-06-04 |
| `human-loyalists/knight/knight-se-run5.png` | CC BY-SA 4.0 | doofus-01, Richard Kettering | 2017-08-21 | 2022-06-04 |
| `human-loyalists/knight/knight-se-run6.png` | CC BY-SA 4.0 | doofus-01, Richard Kettering | 2017-08-21 | 2022-06-04 |
| `human-loyalists/knight/knight-se-run7.png` | CC BY-SA 4.0 | doofus-01, Richard Kettering | 2017-08-21 | 2022-06-04 |
| `human-loyalists/knight/knight-se-run8.png` | CC BY-SA 4.0 | doofus-01, Richard Kettering | 2017-08-21 | 2022-06-04 |
| `human-loyalists/knight/knight-se-slash1.png` | CC BY-SA 4.0 | doofus-01, Richard Kettering | 2017-08-21 | 2022-06-04 |
| `human-loyalists/knight/knight-se-slash2.png` | CC BY-SA 4.0 | doofus-01, Richard Kettering | 2017-08-21 | 2022-06-04 |
| `human-loyalists/knight/knight-se-slash3.png` | CC BY-SA 4.0 | doofus-01, Richard Kettering | 2017-08-21 | 2022-06-04 |
| `human-loyalists/knight/knight-se-slash4.png` | CC BY-SA 4.0 | doofus-01, Richard Kettering | 2017-08-21 | 2022-06-04 |
| `human-loyalists/knight/knight-se-slash5.png` | CC BY-SA 4.0 | doofus-01, Richard Kettering | 2017-08-21 | 2022-06-04 |
| `human-loyalists/knight/knight-se-slash6.png` | CC BY-SA 4.0 | doofus-01, Richard Kettering | 2017-08-21 | 2022-06-04 |
| `human-loyalists/knight/knight-se-slash7.png` | CC BY-SA 4.0 | doofus-01, Richard Kettering | 2017-08-21 | 2022-06-04 |
| `human-loyalists/knight/knight-se-slash8.png` | CC BY-SA 4.0 | doofus-01, Richard Kettering | 2017-08-21 | 2022-06-04 |
| `human-loyalists/knight/knight-se-slash9.png` | CC BY-SA 4.0 | doofus-01, Richard Kettering | 2017-08-21 | 2022-06-04 |
| `human-loyalists/knight/knight-se-slash10.png` | CC BY-SA 4.0 | doofus-01, Richard Kettering | 2017-08-21 | 2022-06-04 |
| `human-loyalists/knight/knight-se-slash11.png` | CC BY-SA 4.0 | doofus-01, Richard Kettering | 2017-08-21 | 2022-06-04 |
| `human-loyalists/knight/knight-se-slash12.png` | CC BY-SA 4.0 | doofus-01, Richard Kettering | 2017-08-21 | 2022-06-04 |
| `human-loyalists/knight/knight-se-attack1.png` | CC BY-SA 4.0 | doofus-01, Richard Kettering | 2017-08-21 | 2022-06-04 |
| `human-loyalists/knight/knight-se-attack2.png` | CC BY-SA 4.0 | doofus-01, Richard Kettering | 2017-08-21 | 2022-06-04 |
| `human-loyalists/knight/knight-se-attack3.png` | CC BY-SA 4.0 | doofus-01, Richard Kettering | 2017-08-21 | 2022-06-04 |
| `human-loyalists/knight/knight-se-attack4.png` | CC BY-SA 4.0 | doofus-01, Richard Kettering | 2017-08-21 | 2022-06-04 |
| `human-loyalists/knight/knight-se-attack5.png` | CC BY-SA 4.0 | doofus-01, Richard Kettering | 2017-08-21 | 2022-06-04 |
| `human-loyalists/knight/knight-se-attack6.png` | CC BY-SA 4.0 | doofus-01, Richard Kettering | 2017-08-21 | 2022-06-04 |
| `human-loyalists/knight/knight-se-attack7.png` | CC BY-SA 4.0 | doofus-01, Richard Kettering | 2017-08-21 | 2022-06-04 |
| `human-loyalists/knight/knight-se-attack8.png` | CC BY-SA 4.0 | doofus-01, Richard Kettering | 2017-08-21 | 2022-06-04 |
| `human-loyalists/knight/knight-se-attack9.png` | CC BY-SA 4.0 | doofus-01, Richard Kettering | 2017-08-21 | 2022-06-04 |
| `human-loyalists/knight/knight-se-attack10.png` | CC BY-SA 4.0 | doofus-01, Richard Kettering | 2017-08-21 | 2022-06-04 |
| `human-loyalists/knight/knight-se-attack11.png` | CC BY-SA 4.0 | doofus-01, Richard Kettering | 2017-08-21 | 2022-06-04 |
| `human-loyalists/knight/knight-se-attack12.png` | CC BY-SA 4.0 | doofus-01, Richard Kettering | 2017-08-21 | 2022-06-04 |
| `human-loyalists/knight/knight-se-die1.png` | CC BY-SA 4.0 | doofus-01, Richard Kettering | 2017-08-21 | 2022-06-04 |
| `human-loyalists/knight/knight-se-die2.png` | CC BY-SA 4.0 | doofus-01, Richard Kettering | 2017-08-21 | 2022-06-04 |
| `human-loyalists/knight/knight-se-die3.png` | CC BY-SA 4.0 | doofus-01, Richard Kettering | 2017-08-21 | 2022-06-04 |
| `human-loyalists/knight/knight-se-die4.png` | CC BY-SA 4.0 | doofus-01, Richard Kettering | 2017-08-21 | 2022-06-04 |
| `human-loyalists/knight/knight-se-die5.png` | CC BY-SA 4.0 | doofus-01, Richard Kettering | 2017-08-21 | 2022-06-04 |

### Swordsman (our swordsmen)

Frames and timings from `data/core/units/humans/Loyalist_Swordsman.cfg`.

| File | Licence | Artists, from the history | Added | Last changed |
| --- | --- | --- | --- | --- |
| `human-loyalists/swordsman.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-07-11 |
| `human-loyalists/swordsman-defend-2.png` | CC BY-SA 4.0 | doofus-01 | 2022-07-11 | 2023-10-30 |
| `human-loyalists/swordsman-bob-s-1.png` | CC BY-SA 4.0 | doofus-01 | 2023-10-30 | 2023-10-30 |
| `human-loyalists/swordsman-bob-s-2.png` | CC BY-SA 4.0 | doofus-01 | 2023-10-30 | 2023-10-30 |
| `human-loyalists/swordsman-bob-s-3.png` | CC BY-SA 4.0 | doofus-01 | 2023-10-30 | 2023-10-30 |
| `human-loyalists/swordsman-attack-se-1.png` | CC BY-SA 4.0 | doofus-01 | 2022-07-11 | 2022-07-11 |
| `human-loyalists/swordsman-attack-se-2.png` | CC BY-SA 4.0 | doofus-01 | 2022-07-11 | 2022-07-11 |
| `human-loyalists/swordsman-attack-se-3.png` | CC BY-SA 4.0 | doofus-01 | 2022-07-11 | 2022-07-11 |
| `human-loyalists/swordsman-attack-se-4.png` | CC BY-SA 4.0 | doofus-01 | 2022-07-11 | 2022-07-11 |
| `human-loyalists/swordsman-attack-se-5.png` | CC BY-SA 4.0 | doofus-01 | 2022-07-11 | 2022-07-11 |
| `human-loyalists/swordsman-attack-se-6.png` | CC BY-SA 4.0 | doofus-01 | 2022-07-11 | 2022-07-11 |
| `human-loyalists/swordsman-attack-se-7.png` | CC BY-SA 4.0 | doofus-01 | 2022-07-11 | 2022-07-11 |
| `human-loyalists/swordsman-attack-se-8.png` | CC BY-SA 4.0 | doofus-01 | 2022-07-11 | 2022-07-11 |

### Sergeant (our crossbowmen)

Frames and timings from `data/core/units/humans/Loyalist_Sergeant.cfg`.

| File | Licence | Artists, from the history | Added | Last changed |
| --- | --- | --- | --- | --- |
| `human-loyalists/sergeant-crossbow.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-07-11 |
| `human-loyalists/sergeant-defend-2.png` | CC BY-SA 4.0 | doofus-01 | 2022-07-11 | 2022-07-11 |
| `human-loyalists/sergeant-crossbow-defend.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-12-25 | 2022-07-11 |
| `human-loyalists/sergeant-attack-sword-1.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-07-11 |
| `human-loyalists/sergeant-attack-sword-2.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-07-11 |
| `human-loyalists/sergeant-attack-sword-3.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-07-11 |
| `human-loyalists/sergeant-attack-sword-4.png` | CC BY-SA 4.0 | doofus-01 | 2022-07-11 | 2022-07-11 |
| `human-loyalists/sergeant.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-07-11 |
| `human-loyalists/sergeant-crossbow-attack1.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-12-25 | 2022-07-11 |
| `human-loyalists/sergeant-crossbow-attack2.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-12-25 | 2022-07-11 |

### Wolf (our wolves)

Frames and timings from `data/core/units/monsters/Wolf.cfg`.

| File | Licence | Artists, from the history | Added | Last changed |
| --- | --- | --- | --- | --- |
| `monsters/wolf.png` | GPL-2.0-or-later | Richard Kettering, J.W. Bjerk | 2007-05-26 | 2010-01-01 |
| `monsters/wolf-defend-2.png` | GPL-2.0-or-later | Richard Kettering | 2010-01-01 | 2010-01-01 |
| `monsters/wolf-moving.png` | GPL-2.0-or-later | Richard Kettering, J.W. Bjerk | 2007-05-26 | 2010-01-01 |
| `monsters/wolf-attack.png` | GPL-2.0-or-later | Richard Kettering, J.W. Bjerk | 2007-05-26 | 2010-01-01 |

### Grand Marshal (our baron)

Frames and timings from `data/core/units/humans/Loyalist_Grand_Marshal.cfg`.

| File | Licence | Artists, from the history | Added | Last changed |
| --- | --- | --- | --- | --- |
| `human-loyalists/marshal.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-06-04 |
| `human-loyalists/marshal-defend-2.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-12-25 | 2022-06-04 |
| `human-loyalists/marshal-defend-1.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-12-25 | 2022-06-04 |
| `human-loyalists/marshal-attack-sword1.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-06-04 |
| `human-loyalists/marshal-attack-sword2.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-06-04 |
| `human-loyalists/marshal-attack-sword3.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-12-25 | 2022-06-04 |
| `human-loyalists/marshal-attack-sword4.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-12-25 | 2022-06-04 |
| `human-loyalists/marshal-attack-sword5.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-12-25 | 2022-06-04 |
| `human-loyalists/marshal-die-1.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-06-04 |
| `human-loyalists/marshal-die-2.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-06-04 |
| `human-loyalists/marshal-die-3.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-06-04 |
| `human-loyalists/marshal-die-4.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-06-04 |
| `human-loyalists/marshal-die-5.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-06-04 |
| `human-loyalists/marshal-die-6.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-06-04 |
| `human-loyalists/marshal-die-7.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-06-04 |
| `human-loyalists/marshal-die-8.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-06-04 |
| `human-loyalists/marshal-die-9.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-06-04 |
| `human-loyalists/marshal-die-10.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-06-04 |

### Goblin Spearman (our goblins)

Frames and timings from `data/core/units/goblins/Spearman.cfg`.

| File | Licence | Artists, from the history | Added | Last changed |
| --- | --- | --- | --- | --- |
| `goblins/spearman.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-05-01 |
| `goblins/spearman-defend.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-05-01 |
| `goblins/spearman-idle-1.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-05-01 |
| `goblins/spearman-idle-2.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-05-01 |
| `goblins/spearman-idle-3.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-05-01 |
| `goblins/spearman-idle-4.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-05-01 |
| `goblins/spearman-idle-5.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-05-01 |
| `goblins/spearman-idle-6.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-05-01 |
| `goblins/spearman-idle-7.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-05-01 |
| `goblins/spearman-idle-8.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-05-01 |
| `goblins/spearman-idle-9.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-05-01 |
| `goblins/spearman-idle-10.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-05-01 |
| `goblins/spearman-idle-11.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-05-01 |
| `goblins/spearman-idle-12.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-05-01 |
| `goblins/spearman-se-run1.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Simon Forsyth | 2011-09-20 | 2022-05-01 |
| `goblins/spearman-se-run2.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Simon Forsyth | 2011-09-20 | 2022-05-01 |
| `goblins/spearman-se-run3.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Simon Forsyth | 2011-09-20 | 2022-05-01 |
| `goblins/spearman-se-run4.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Simon Forsyth | 2011-09-20 | 2022-05-01 |
| `goblins/spearman-se-run5.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Simon Forsyth | 2011-09-20 | 2022-05-01 |
| `goblins/spearman-se-run6.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Simon Forsyth | 2011-09-20 | 2022-05-01 |
| `goblins/spearman-se-run7.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Simon Forsyth | 2011-09-20 | 2022-05-01 |
| `goblins/spearman-se-run8.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Simon Forsyth | 2011-09-20 | 2022-05-01 |
| `goblins/spearman-se-run9.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Simon Forsyth | 2011-09-20 | 2022-05-01 |
| `goblins/spearman-attack-se1.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-05-01 |
| `goblins/spearman-attack-se2.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-05-01 |
| `goblins/spearman-die-1.png` | CC BY-SA 4.0 | doofus-01, nemaara | 2019-11-02 | 2022-05-01 |
| `goblins/spearman-die-2.png` | CC BY-SA 4.0 | doofus-01, nemaara | 2019-11-02 | 2022-05-01 |
| `goblins/spearman-die-3.png` | CC BY-SA 4.0 | doofus-01, nemaara | 2019-11-02 | 2022-05-01 |
| `goblins/spearman-die-4.png` | CC BY-SA 4.0 | doofus-01, nemaara | 2019-11-02 | 2022-05-01 |

### Troll (our trolls)

Frames and timings from `data/core/units/trolls/Troll.cfg`.

| File | Licence | Artists, from the history | Added | Last changed |
| --- | --- | --- | --- | --- |
| `trolls/grunt.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering, Shadow Master, Lari Nieminen | 2007-05-16 | 2022-04-30 |
| `trolls/grunt-defend2.png` | CC BY-SA 4.0 | doofus-01 | 2021-07-19 | 2022-04-30 |
| `trolls/grunt-attack-1.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering, Shadow Master, Lari Nieminen | 2007-05-16 | 2022-04-30 |
| `trolls/grunt-attack-2.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering, Shadow Master, Lari Nieminen | 2007-05-16 | 2022-04-30 |
| `trolls/grunt-attack-3.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering, Shadow Master, Lari Nieminen | 2007-05-16 | 2022-04-30 |
| `trolls/grunt-attack-4.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering, Shadow Master, Lari Nieminen | 2007-05-16 | 2022-04-30 |
| `trolls/grunt-defend.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering, Shadow Master, Lari Nieminen | 2007-05-16 | 2022-04-30 |

### Dark Adept (female) (our witch)

Frames and timings from `data/core/units/undead/Necro_Dark_Adept.cfg`.

| File | Licence | Artists, from the history | Added | Last changed |
| --- | --- | --- | --- | --- |
| `undead-necromancers/adept+female.png` | GPL-2.0-or-later |  |  |  |
| `undead-necromancers/adept+female-defend-2.png` | GPL-2.0-or-later |  |  |  |
| `undead-necromancers/adept+female-magic-1.png` | GPL-2.0-or-later |  |  |  |
| `undead-necromancers/adept+female-magic-2.png` | GPL-2.0-or-later |  |  |  |
| `undead-necromancers/adept+female-magic-3.png` | GPL-2.0-or-later |  |  |  |

### Dark Sorcerer (female) (our bramble)

Frames and timings from `data/core/units/undead/Necro_Dark_Sorcerer.cfg`.

| File | Licence | Artists, from the history | Added | Last changed |
| --- | --- | --- | --- | --- |
| `undead-necromancers/dark-sorcerer+female.png` | GPL-2.0-or-later |  |  |  |
| `undead-necromancers/dark-sorcerer+female-defend.png` | GPL-2.0-or-later |  |  |  |
| `undead-necromancers/dark-sorcerer+female-attack-staff-1.png` | GPL-2.0-or-later |  |  |  |
| `undead-necromancers/dark-sorcerer+female-attack-staff-2.png` | GPL-2.0-or-later |  |  |  |
| `undead-necromancers/dark-sorcerer+female-magic-1.png` | GPL-2.0-or-later |  |  |  |
| `undead-necromancers/dark-sorcerer+female-magic-2.png` | GPL-2.0-or-later |  |  |  |
| `undead-necromancers/dark-sorcerer+female-magic-3.png` | GPL-2.0-or-later |  |  |  |

### Poacher (our poachers)

Frames and timings from `data/core/units/humans/Woodsman_Poacher.cfg`.

| File | Licence | Artists, from the history | Added | Last changed |
| --- | --- | --- | --- | --- |
| `human-outlaws/poacher.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, ghype, Kwandulin, thespaceinvader | 2007-05-16 | 2022-04-29 |
| `human-outlaws/poacher-dagger-defend2.png` | CC BY-SA 4.0 | doofus-01 | 2021-01-25 | 2022-04-29 |
| `human-outlaws/poacher-bow-defend.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, ghype, Kwandulin, thespaceinvader | 2007-05-16 | 2022-04-29 |
| `human-outlaws/poacher-dagger-defend1.png` | CC BY-SA 4.0 | doofus-01 | 2021-01-25 | 2022-04-29 |
| `human-outlaws/poacher-attack.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Kwandulin, thespaceinvader | 2007-05-16 | 2022-04-29 |
| `human-outlaws/poacher-dagger.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, ghype, Kwandulin, thespaceinvader, Lari Nieminen | 2007-06-09 | 2022-04-29 |
| `human-outlaws/poacher-bow-attack1.png` | CC BY-SA 4.0 | doofus-01, ghype | 2020-05-24 | 2022-04-29 |
| `human-outlaws/poacher-bow-attack2.png` | CC BY-SA 4.0 | doofus-01, ghype | 2020-05-24 | 2022-04-29 |
| `human-outlaws/poacher-bow-attack3.png` | CC BY-SA 4.0 | doofus-01, ghype | 2020-05-24 | 2022-04-29 |
| `human-outlaws/poacher-bow-attack4.png` | CC BY-SA 4.0 | doofus-01, ghype | 2020-05-24 | 2022-04-29 |
| `human-outlaws/poacher-bow-attack5.png` | CC BY-SA 4.0 | doofus-01, ghype | 2020-05-24 | 2022-04-29 |
| `human-outlaws/poacher-bow-attack6.png` | CC BY-SA 4.0 | doofus-01, ghype | 2020-05-24 | 2022-04-29 |
| `human-outlaws/poacher-bow-attack7.png` | CC BY-SA 4.0 | doofus-01, ghype | 2020-05-24 | 2022-04-29 |

### Bandit (our bandits)

Frames and timings from `data/core/units/humans/Outlaw_Bandit.cfg`.

| File | Licence | Artists, from the history | Added | Last changed |
| --- | --- | --- | --- | --- |
| `human-outlaws/bandit.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Ignacio R. Morelle, Richard Kettering, thespaceinvader | 2007-05-16 | 2022-04-29 |
| `human-outlaws/bandit-defend-2.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2009-10-01 | 2022-04-29 |
| `human-outlaws/bandit-idle-1.png` | CC BY-SA 4.0 | doofus-01, nemaara | 2019-11-02 | 2022-04-29 |
| `human-outlaws/bandit-idle-2.png` | CC BY-SA 4.0 | doofus-01, nemaara | 2019-11-02 | 2022-04-29 |
| `human-outlaws/bandit-idle-3.png` | CC BY-SA 4.0 | doofus-01, nemaara | 2019-11-02 | 2022-04-29 |
| `human-outlaws/bandit-idle-4.png` | CC BY-SA 4.0 | doofus-01, nemaara | 2019-11-02 | 2022-04-29 |
| `human-outlaws/bandit-idle-5.png` | CC BY-SA 4.0 | doofus-01, nemaara | 2019-11-02 | 2022-04-29 |
| `human-outlaws/bandit-idle-6.png` | CC BY-SA 4.0 | doofus-01, nemaara | 2019-11-02 | 2022-04-29 |
| `human-outlaws/bandit-melee-1.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering, thespaceinvader | 2007-05-16 | 2022-04-29 |
| `human-outlaws/bandit-melee-2.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering, thespaceinvader | 2007-05-16 | 2022-04-29 |
| `human-outlaws/bandit-melee-3.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering, thespaceinvader | 2007-05-16 | 2022-04-29 |
| `human-outlaws/bandit-melee-4.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2009-10-01 | 2022-04-29 |
| `human-outlaws/bandit-melee-5.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2009-10-01 | 2022-04-29 |
| `human-outlaws/bandit-melee-6.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2009-10-01 | 2022-04-29 |
| `human-outlaws/bandit-melee-7.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2009-10-01 | 2022-04-29 |
| `human-outlaws/bandit-melee-8.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2009-10-01 | 2022-04-29 |

### Trapper (our rook)

Frames and timings from `data/core/units/humans/Woodsman_Trapper.cfg`.

| File | Licence | Artists, from the history | Added | Last changed |
| --- | --- | --- | --- | --- |
| `human-outlaws/trapper.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, ghype | 2007-05-16 | 2022-04-29 |
| `human-outlaws/trapper-bow-defend.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, ghype | 2007-05-16 | 2022-04-29 |
| `human-outlaws/trapper-bow-attack1.png` | CC BY-SA 4.0 | doofus-01, ghype | 2020-05-24 | 2022-04-29 |
| `human-outlaws/trapper-bow-attack2.png` | CC BY-SA 4.0 | doofus-01, ghype | 2020-05-24 | 2022-04-29 |
| `human-outlaws/trapper-bow-attack3.png` | CC BY-SA 4.0 | doofus-01, ghype | 2020-05-24 | 2022-04-29 |
| `human-outlaws/trapper-bow-attack4.png` | CC BY-SA 4.0 | doofus-01, ghype | 2020-05-24 | 2022-04-29 |
| `human-outlaws/trapper-bow-attack5.png` | CC BY-SA 4.0 | doofus-01, ghype | 2020-05-24 | 2022-04-29 |
| `human-outlaws/trapper-bow-attack6.png` | CC BY-SA 4.0 | doofus-01, ghype | 2020-05-24 | 2022-04-29 |
| `human-outlaws/trapper-bow-attack7.png` | CC BY-SA 4.0 | doofus-01, ghype | 2020-05-24 | 2022-04-29 |
| `human-outlaws/trapper-bow.png` | CC BY-SA 4.0 | doofus-01, ghype | 2020-05-24 | 2022-04-29 |

### Woodland Boar (our boars)

Frames and timings from `data/core/units/monsters/Boar.cfg`.

| File | Licence | Artists, from the history | Added | Last changed |
| --- | --- | --- | --- | --- |
| `monsters/boar/woodland.png` | CC BY-SA 4.0 | doofus-01 | 2021-04-04 | 2021-04-19 |
| `monsters/boar/woodland-defend2.png` | CC BY-SA 4.0 | doofus-01 | 2021-04-19 | 2021-04-19 |
| `monsters/boar/woodland-moving.png` | CC BY-SA 4.0 | doofus-01 | 2021-04-04 | 2021-04-19 |
| `monsters/boar/woodland-charge1.png` | CC BY-SA 4.0 | doofus-01 | 2021-04-19 | 2021-04-19 |
| `monsters/boar/woodland-charge2.png` | CC BY-SA 4.0 | doofus-01 | 2021-04-19 | 2021-04-19 |
| `monsters/boar/woodland-charge3.png` | CC BY-SA 4.0 | doofus-01 | 2021-04-19 | 2021-04-19 |
| `monsters/boar/woodland-charge4.png` | CC BY-SA 4.0 | doofus-01 | 2021-04-19 | 2021-04-19 |
| `monsters/boar/woodland-charge5.png` | CC BY-SA 4.0 | doofus-01 | 2021-04-19 | 2021-04-19 |

### Cave Bear (our bears)

Frames and timings from `data/core/units/monsters/Bear.cfg`.

| File | Licence | Artists, from the history | Added | Last changed |
| --- | --- | --- | --- | --- |
| `monsters/bear/bear.png` | CC BY-SA 4.0 | doofus-01 | 2020-09-21 | 2020-09-21 |
| `monsters/bear/bear-defend2.png` | CC BY-SA 4.0 | doofus-01 | 2020-09-21 | 2020-09-21 |
| `monsters/bear/bear-bite1.png` | CC BY-SA 4.0 | doofus-01 | 2020-09-21 | 2020-09-21 |
| `monsters/bear/bear-bite2.png` | CC BY-SA 4.0 | doofus-01 | 2020-09-21 | 2020-09-21 |
| `monsters/bear/bear-bite3.png` | CC BY-SA 4.0 | doofus-01 | 2020-09-21 | 2020-09-21 |
| `monsters/bear/bear-bite4.png` | CC BY-SA 4.0 | doofus-01 | 2020-09-21 | 2020-09-21 |
| `monsters/bear/bear-bite5.png` | CC BY-SA 4.0 | doofus-01 | 2020-09-21 | 2020-09-21 |
| `monsters/bear/bear-bite6.png` | CC BY-SA 4.0 | doofus-01 | 2020-09-21 | 2020-09-21 |

### Huntsman (our huntsmen)

Frames and timings from `data/core/units/humans/Woodsman_Huntsman.cfg`.

| File | Licence | Artists, from the history | Added | Last changed |
| --- | --- | --- | --- | --- |
| `human-outlaws/huntsman.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Ignacio R. Morelle, Richard Kettering, Eric S. Raymond | 2007-07-22 | 2022-04-29 |
| `human-outlaws/huntsman-defend.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Ignacio R. Morelle, Richard Kettering, Eric S. Raymond | 2007-07-22 | 2022-04-29 |
| `human-outlaws/huntsman-bow-defend.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Ignacio R. Morelle, Richard Kettering | 2007-10-29 | 2022-04-29 |
| `human-outlaws/huntsman-attack-melee.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Ignacio R. Morelle, Richard Kettering | 2007-10-29 | 2022-04-29 |
| `human-outlaws/huntsman-bow.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Ignacio R. Morelle, Richard Kettering | 2007-10-29 | 2022-04-29 |
| `human-outlaws/huntsman-attack1.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Ignacio R. Morelle, Richard Kettering, Eric S. Raymond | 2007-07-22 | 2022-04-29 |
| `human-outlaws/huntsman-attack2.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Ignacio R. Morelle, Richard Kettering, Eric S. Raymond | 2007-07-22 | 2022-04-29 |
| `human-outlaws/huntsman-attack3.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Ignacio R. Morelle, Richard Kettering | 2007-10-29 | 2022-04-29 |

### Pikeman (our pikemen)

Frames and timings from `data/core/units/humans/Loyalist_Pikeman.cfg`.

| File | Licence | Artists, from the history | Added | Last changed |
| --- | --- | --- | --- | --- |
| `human-loyalists/pikeman.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-07-11 |
| `human-loyalists/pikeman-defend-2.png` | CC BY-SA 4.0 | doofus-01 | 2022-07-11 | 2022-07-11 |
| `human-loyalists/pikeman-idle-1.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering, Karen Baskins | 2007-06-16 | 2022-06-04 |
| `human-loyalists/pikeman-idle-2.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering, Karen Baskins | 2007-06-16 | 2022-06-04 |
| `human-loyalists/pikeman-idle-3.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering, Karen Baskins | 2007-06-16 | 2022-06-04 |
| `human-loyalists/pikeman-idle-4.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering, Karen Baskins | 2007-06-16 | 2022-06-04 |
| `human-loyalists/pikeman-attack-se.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-07-11 |
| `human-loyalists/pikeman-die-1.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-06-04 |
| `human-loyalists/pikeman-die-2.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-06-04 |
| `human-loyalists/pikeman-die-3.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-06-04 |
| `human-loyalists/pikeman-die-4.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-06-04 |
| `human-loyalists/pikeman-die-5.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-06-04 |

### Heavy Infantryman (our menAtArms)

Frames and timings from `data/core/units/humans/Loyalist_Heavy_Infantryman.cfg`.

| File | Licence | Artists, from the history | Added | Last changed |
| --- | --- | --- | --- | --- |
| `human-loyalists/heavyinfantry.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Charles Dang, Richard Kettering, Ignacio R. Morelle | 2007-05-16 | 2022-06-04 |
| `human-loyalists/heavyinfantry-defend-1.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Charles Dang, Richard Kettering, Ignacio R. Morelle | 2007-05-16 | 2022-06-04 |
| `human-loyalists/heavyinfantry-attack-1.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Charles Dang, Zoomo, Richard Kettering, Ignacio R. Morelle | 2007-05-16 | 2022-06-04 |
| `human-loyalists/heavyinfantry-attack-2.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Zoomo, Charles Dang, Richard Kettering, Ignacio R. Morelle | 2007-05-16 | 2022-06-04 |
| `human-loyalists/heavyinfantry-attack-3.png` | CC BY-SA 4.0 | doofus-01, Zoomo | 2018-03-14 | 2022-06-04 |
| `human-loyalists/heavyinfantry-attack-4.png` | CC BY-SA 4.0 | doofus-01, Charles Dang, Zoomo | 2018-03-14 | 2022-06-04 |
| `human-loyalists/heavyinfantry-attack-5.png` | CC BY-SA 4.0 | doofus-01, Charles Dang, Zoomo | 2018-03-14 | 2022-06-04 |
| `human-loyalists/heavyinfantry-attack-6.png` | CC BY-SA 4.0 | doofus-01, Zoomo | 2018-03-14 | 2022-06-04 |
| `human-loyalists/heavyinfantry-attack-7.png` | CC BY-SA 4.0 | doofus-01, Zoomo | 2018-03-14 | 2022-06-04 |
| `human-loyalists/heavyinfantry-attack-8.png` | CC BY-SA 4.0 | doofus-01, Charles Dang, Zoomo | 2018-03-14 | 2022-06-04 |
| `human-loyalists/heavyinfantry-attack-9.png` | CC BY-SA 4.0 | doofus-01, Charles Dang, Zoomo | 2018-03-14 | 2022-06-04 |
| `human-loyalists/heavyinfantry-attack-10.png` | CC BY-SA 4.0 | doofus-01, Charles Dang, Zoomo | 2018-03-14 | 2022-06-04 |
| `human-loyalists/heavyinfantry-attack-11.png` | CC BY-SA 4.0 | doofus-01, Zoomo | 2018-03-14 | 2022-06-04 |
| `human-loyalists/heavyinfantry-attack-12.png` | CC BY-SA 4.0 | doofus-01, Charles Dang, Zoomo | 2018-03-14 | 2022-06-04 |
| `human-loyalists/heavyinfantry-attack-13.png` | CC BY-SA 4.0 | doofus-01, Charles Dang, Zoomo | 2018-03-14 | 2022-06-04 |
| `human-loyalists/heavyinfantry-attack-14.png` | CC BY-SA 4.0 | doofus-01, Zoomo | 2018-03-14 | 2022-06-04 |
| `human-loyalists/heavyinfantry-attack-15.png` | CC BY-SA 4.0 | doofus-01, Zoomo | 2018-03-14 | 2022-06-04 |

### Thief (our cutpurses)

Frames and timings from `data/core/units/humans/Outlaw_Thief.cfg`.

| File | Licence | Artists, from the history | Added | Last changed |
| --- | --- | --- | --- | --- |
| `human-outlaws/thief.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, thespaceinvader | 2007-05-16 | 2022-04-29 |
| `human-outlaws/thief-defend.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, thespaceinvader | 2007-05-16 | 2022-04-29 |
| `human-outlaws/thief-idle-1.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-12-24 | 2022-04-29 |
| `human-outlaws/thief-idle-2.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-12-24 | 2022-04-29 |
| `human-outlaws/thief-idle-3.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-12-24 | 2022-04-29 |
| `human-outlaws/thief-idle-4.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-12-24 | 2022-04-29 |
| `human-outlaws/thief-idle-5.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-12-24 | 2022-04-29 |
| `human-outlaws/thief-idle-6.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-12-24 | 2022-04-29 |
| `human-outlaws/thief-idle-7.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-12-24 | 2022-04-29 |
| `human-outlaws/thief-attack.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, thespaceinvader | 2007-05-16 | 2022-04-29 |
| `human-outlaws/thief-die-1.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, thespaceinvader | 2007-05-16 | 2022-04-29 |
| `human-outlaws/thief-die-2.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, thespaceinvader | 2007-05-16 | 2022-04-29 |
| `human-outlaws/thief-die-3.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, thespaceinvader | 2007-05-16 | 2022-04-29 |
| `human-outlaws/thief-die-4.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, thespaceinvader | 2007-05-16 | 2022-04-29 |
| `human-outlaws/thief-die-5.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, thespaceinvader | 2007-05-16 | 2022-04-29 |
| `human-outlaws/thief-die-6.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, thespaceinvader | 2007-05-16 | 2022-04-29 |
| `human-outlaws/thief-die-7.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, thespaceinvader | 2007-05-16 | 2022-04-29 |

### Giant Spider (our spiders)

Frames and timings from `data/core/units/monsters/Giant_Spider.cfg`.

| File | Licence | Artists, from the history | Added | Last changed |
| --- | --- | --- | --- | --- |
| `monsters/spider.png` | GPL-2.0-or-later | beetlenaut | 2010-03-20 | 2010-03-20 |
| `monsters/spider-melee-1.png` | GPL-2.0-or-later | beetlenaut | 2010-03-20 | 2010-03-20 |
| `monsters/spider-melee-2.png` | GPL-2.0-or-later | beetlenaut | 2010-03-20 | 2010-03-20 |
| `monsters/spider-melee-3.png` | GPL-2.0-or-later | beetlenaut | 2010-03-20 | 2010-03-20 |
| `monsters/spider-melee-4.png` | GPL-2.0-or-later | beetlenaut | 2010-03-20 | 2010-03-20 |
| `monsters/spider-melee-5.png` | GPL-2.0-or-later | beetlenaut | 2010-03-20 | 2010-03-20 |
| `monsters/spider-melee-6.png` | GPL-2.0-or-later | beetlenaut | 2010-03-20 | 2010-03-20 |
| `monsters/spider-melee-7.png` | GPL-2.0-or-later | beetlenaut | 2010-03-20 | 2010-03-20 |
| `monsters/spider-melee-8.png` | GPL-2.0-or-later | beetlenaut | 2010-03-20 | 2010-03-20 |
| `monsters/spider-melee-9.png` | GPL-2.0-or-later | beetlenaut | 2010-03-20 | 2010-03-20 |
| `monsters/spider-melee-10.png` | GPL-2.0-or-later | beetlenaut | 2010-03-20 | 2010-03-20 |
| `monsters/spider-melee-11.png` | GPL-2.0-or-later | beetlenaut | 2010-03-20 | 2010-03-20 |
| `monsters/spider-melee-12.png` | GPL-2.0-or-later | beetlenaut | 2010-03-20 | 2010-03-20 |
| `monsters/spider-melee-13.png` | GPL-2.0-or-later | beetlenaut | 2010-03-20 | 2010-03-20 |

### Lieutenant (our sergeant)

Frames and timings from `data/core/units/humans/Loyalist_Lieutenant.cfg`.

| File | Licence | Artists, from the history | Added | Last changed |
| --- | --- | --- | --- | --- |
| `human-loyalists/lieutenant.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-07-11 |
| `human-loyalists/lieutenant-defend-2.png` | CC BY-SA 4.0 | doofus-01 | 2022-07-11 | 2022-07-11 |
| `human-loyalists/lieutenant-attack-sword-1.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-07-11 |
| `human-loyalists/lieutenant-attack-sword-2.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-07-11 |
| `human-loyalists/lieutenant-attack-sword-3.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-07-11 |
| `human-loyalists/lieutenant-die-1.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-07-11 |
| `human-loyalists/lieutenant-die-2.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-07-11 |
| `human-loyalists/lieutenant-die-3.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-07-11 |
| `human-loyalists/lieutenant-die-4.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-07-11 |
| `human-loyalists/lieutenant-die-5.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-07-11 |
| `human-loyalists/lieutenant-die-6.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-07-11 |
| `human-loyalists/lieutenant-die-7.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-07-11 |
| `human-loyalists/lieutenant-die-8.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-07-11 |
| `human-loyalists/lieutenant-die-9.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-07-11 |

### Halberdier (our pike)

Frames and timings from `data/core/units/humans/Loyalist_Halberdier.cfg`.

| File | Licence | Artists, from the history | Added | Last changed |
| --- | --- | --- | --- | --- |
| `human-loyalists/halberdier.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-07-11 |
| `human-loyalists/halberdier-defend-2.png` | CC BY-SA 4.0 | doofus-01 | 2022-07-11 | 2022-07-11 |
| `human-loyalists/halberdier-idle-1.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-06-04 |
| `human-loyalists/halberdier-idle-2.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-06-04 |
| `human-loyalists/halberdier-idle-3.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-06-04 |
| `human-loyalists/halberdier-idle-4.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-06-04 |
| `human-loyalists/halberdier-idle-5.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-06-04 |
| `human-loyalists/halberdier-idle-6.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-06-04 |
| `human-loyalists/halberdier-idle-7.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-06-04 |
| `human-loyalists/halberdier-idle-8.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-06-04 |
| `human-loyalists/halberdier-idle-9.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-06-04 |
| `human-loyalists/halberdier-idle-10.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-06-04 |
| `human-loyalists/halberdier-idle-11.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-06-04 |
| `human-loyalists/halberdier-idle-12.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-06-04 |
| `human-loyalists/halberdier-slash-se-1.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-07-11 |
| `human-loyalists/halberdier-slash-se-2.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-07-11 |
| `human-loyalists/halberdier-slash-se-3.png` | CC BY-SA 4.0 | doofus-01 | 2022-07-11 | 2022-07-11 |
| `human-loyalists/halberdier-slash-se-4.png` | CC BY-SA 4.0 | doofus-01 | 2022-07-11 | 2022-07-11 |

### Thug (our foreman)

Frames and timings from `data/core/units/humans/Outlaw_Thug.cfg`.

| File | Licence | Artists, from the history | Added | Last changed |
| --- | --- | --- | --- | --- |
| `human-outlaws/thug.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering, Ignacio R. Morelle | 2007-05-16 | 2022-04-29 |
| `human-outlaws/thug-defend-2.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2009-08-14 | 2022-04-29 |
| `human-outlaws/thug-idle-1.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering, Lari Nieminen | 2007-12-25 | 2022-04-29 |
| `human-outlaws/thug-idle-2.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering, Lari Nieminen | 2007-12-25 | 2022-04-29 |
| `human-outlaws/thug-idle-3.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering, Lari Nieminen | 2007-12-25 | 2022-04-29 |
| `human-outlaws/thug-idle-4.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering, Lari Nieminen | 2007-12-25 | 2022-04-29 |
| `human-outlaws/thug-idle-5.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering, Lari Nieminen | 2007-12-25 | 2022-04-29 |
| `human-outlaws/thug-melee-1.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2009-08-14 | 2022-04-29 |
| `human-outlaws/thug-melee-2.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2009-08-14 | 2022-04-29 |
| `human-outlaws/thug-melee-3.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2009-08-14 | 2022-04-29 |
| `human-outlaws/thug-melee-4.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2009-08-14 | 2022-04-29 |
| `human-outlaws/thug-melee-5.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2009-08-14 | 2022-04-29 |
| `human-outlaws/thug-melee-6.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2009-08-14 | 2022-04-29 |
| `human-outlaws/thug-melee-7.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2009-08-14 | 2022-04-29 |
| `human-outlaws/thug-melee-8.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2009-08-14 | 2022-04-29 |

### Shock Trooper (our picketCaptain)

Frames and timings from `data/core/units/humans/Loyalist_Shock_Trooper.cfg`.

| File | Licence | Artists, from the history | Added | Last changed |
| --- | --- | --- | --- | --- |
| `human-loyalists/shocktrooper.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Charles Dang, Richard Kettering | 2007-05-16 | 2022-06-04 |
| `human-loyalists/shocktrooper-defend-1.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Charles Dang, Richard Kettering | 2007-05-16 | 2022-06-04 |
| `human-loyalists/shocktrooper-attack-1.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Charles Dang, Richard Kettering | 2007-05-16 | 2022-06-04 |
| `human-loyalists/shocktrooper-attack-2.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Charles Dang, Richard Kettering | 2007-05-16 | 2022-06-04 |
| `human-loyalists/shocktrooper-attack-3.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Charles Dang, Richard Kettering | 2007-05-16 | 2022-06-04 |
| `human-loyalists/shocktrooper-attack-4.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Charles Dang, Richard Kettering | 2007-05-16 | 2022-06-04 |
| `human-loyalists/shocktrooper-attack-5.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Charles Dang, Richard Kettering | 2007-05-16 | 2022-06-04 |
| `human-loyalists/shocktrooper-attack-6.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Charles Dang, Richard Kettering | 2007-05-16 | 2022-06-04 |

### Rogue (our cutpurseCaptain)

Frames and timings from `data/core/units/humans/Outlaw_Rogue.cfg`.

| File | Licence | Artists, from the history | Added | Last changed |
| --- | --- | --- | --- | --- |
| `human-outlaws/rogue.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Charles Dang, thespaceinvader | 2007-05-16 | 2022-04-29 |
| `human-outlaws/rogue-defend-1.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Charles Dang | 2016-08-21 | 2022-04-29 |

### Highwayman (our highwaymanCaptain)

Frames and timings from `data/core/units/humans/Outlaw_Highwayman.cfg`.

| File | Licence | Artists, from the history | Added | Last changed |
| --- | --- | --- | --- | --- |
| `human-outlaws/highwayman.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering, thespaceinvader, Lari Nieminen | 2007-07-22 | 2022-04-29 |
| `human-outlaws/highwayman-defend-2.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2010-04-23 | 2022-04-29 |
| `human-outlaws/highwayman-melee-1.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2010-04-23 | 2022-04-29 |
| `human-outlaws/highwayman-melee-2.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2010-04-23 | 2022-04-29 |
| `human-outlaws/highwayman-melee-3.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2010-04-23 | 2022-04-29 |
| `human-outlaws/highwayman-melee-4.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2010-04-23 | 2022-04-29 |
| `human-outlaws/highwayman-melee-5.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2010-04-23 | 2022-04-29 |
| `human-outlaws/highwayman-melee-6.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2010-04-23 | 2022-04-29 |
| `human-outlaws/highwayman-melee-7.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2010-04-23 | 2022-04-29 |
| `human-outlaws/highwayman-melee-8.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2010-04-23 | 2022-04-29 |

### Woodsman (our poacherCaptain)

Frames and timings from `data/core/units/humans/Woodsman.cfg`.

| File | Licence | Artists, from the history | Added | Last changed |
| --- | --- | --- | --- | --- |
| `human-peasants/woodsman.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-04-29 |
| `human-peasants/woodsman-defend.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-04-29 |
| `human-peasants/woodsman-bow-defend.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2009-08-15 | 2022-04-29 |
| `human-peasants/woodsman-idle-1.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2010-03-29 | 2022-04-29 |
| `human-peasants/woodsman-idle-2.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2010-03-29 | 2022-04-29 |
| `human-peasants/woodsman-idle-3.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2010-03-29 | 2022-04-29 |
| `human-peasants/woodsman-idle-4.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2010-03-29 | 2022-04-29 |
| `human-peasants/woodsman-idle-5.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2010-03-29 | 2022-04-29 |
| `human-peasants/woodsman-idle-6.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2010-03-29 | 2022-04-29 |
| `human-peasants/woodsman-idle-7.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2010-03-29 | 2022-04-29 |
| `human-peasants/woodsman-idle-8.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2010-03-29 | 2022-04-29 |
| `human-peasants/woodsman-idle-9.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2010-03-29 | 2022-04-29 |
| `human-peasants/woodsman-idle-10.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2010-03-29 | 2022-04-29 |
| `human-peasants/woodsman-idle-11.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2010-03-29 | 2022-04-29 |
| `human-peasants/woodsman-idle-12.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2010-03-29 | 2022-04-29 |
| `human-peasants/woodsman-idle-13.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2010-03-29 | 2022-04-29 |
| `human-peasants/woodsman-idle-14.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2010-03-29 | 2022-04-29 |
| `human-peasants/woodsman-melee-1.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-04-29 |
| `human-peasants/woodsman-bow.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2009-08-15 | 2022-04-29 |
| `human-peasants/woodsman-bow-attack-1.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2009-08-15 | 2022-04-29 |
| `human-peasants/woodsman-bow-attack-2.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2009-08-15 | 2022-04-29 |
| `human-peasants/woodsman-bow-attack-3.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2009-08-15 | 2022-04-29 |
| `human-peasants/woodsman-bow-attack-4.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2009-08-15 | 2022-04-29 |

### Horseman (our hero, as a Knight)

Frames and timings from `data/core/units/humans/Horseman.cfg`.

| File | Licence | Artists, from the history | Added | Last changed |
| --- | --- | --- | --- | --- |
| `human-loyalists/horseman/horseman.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01 | 2013-06-10 | 2022-06-04 |
| `human-loyalists/horseman/horseman-se-defend2.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01 | 2013-06-10 | 2022-06-04 |
| `human-loyalists/horseman/horseman-breeze-1.png` | CC BY-SA 4.0 | doofus-01 | 2022-06-05 | 2022-06-05 |
| `human-loyalists/horseman/horseman-breeze-2.png` | CC BY-SA 4.0 | doofus-01 | 2022-06-05 | 2022-06-05 |
| `human-loyalists/horseman/horseman-breeze-3.png` | CC BY-SA 4.0 | doofus-01 | 2022-06-05 | 2022-06-05 |
| `human-loyalists/horseman/horseman-breeze-4.png` | CC BY-SA 4.0 | doofus-01 | 2022-06-05 | 2022-06-05 |
| `human-loyalists/horseman/horseman-breeze-5.png` | CC BY-SA 4.0 | doofus-01 | 2022-06-05 | 2022-06-05 |
| `human-loyalists/horseman/horseman-se-run1.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01 | 2013-06-10 | 2022-06-04 |
| `human-loyalists/horseman/horseman-se-run2.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01 | 2013-06-10 | 2022-06-04 |
| `human-loyalists/horseman/horseman-se-run3.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01 | 2013-06-10 | 2022-06-04 |
| `human-loyalists/horseman/horseman-se-run4.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01 | 2013-06-10 | 2022-06-04 |
| `human-loyalists/horseman/horseman-se-run5.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01 | 2013-06-10 | 2022-06-04 |
| `human-loyalists/horseman/horseman-se-run6.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01 | 2013-06-10 | 2022-06-04 |
| `human-loyalists/horseman/horseman-se-run7.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01 | 2013-06-10 | 2022-06-04 |
| `human-loyalists/horseman/horseman-se-run8.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01 | 2013-06-10 | 2022-06-04 |
| `human-loyalists/horseman/horseman-se-attack1.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01 | 2013-06-10 | 2022-06-04 |
| `human-loyalists/horseman/horseman-se-attack2.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01 | 2013-06-10 | 2022-06-04 |
| `human-loyalists/horseman/horseman-se-attack3.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01 | 2013-06-10 | 2022-06-04 |
| `human-loyalists/horseman/horseman-se-attack4.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01 | 2013-06-10 | 2022-06-04 |
| `human-loyalists/horseman/horseman-se-attack5.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01 | 2013-06-10 | 2022-06-04 |
| `human-loyalists/horseman/horseman-se-attack6.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01 | 2013-06-10 | 2022-06-04 |
| `human-loyalists/horseman/horseman-se-attack7.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01 | 2013-06-10 | 2022-06-04 |
| `human-loyalists/horseman/horseman-se-attack8.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01 | 2013-06-10 | 2022-06-04 |
| `human-loyalists/horseman/horseman-se-attack9.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01 | 2013-06-10 | 2022-06-04 |
| `human-loyalists/horseman/horseman-se-attack10.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01 | 2013-06-10 | 2022-06-04 |
| `human-loyalists/horseman/horseman-se-attack11.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01 | 2013-06-10 | 2022-06-04 |
| `human-loyalists/horseman/horseman-se-attack12.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01 | 2013-06-10 | 2022-06-04 |
| `human-loyalists/horseman/horseman-se-die1.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01 | 2013-06-10 | 2022-06-04 |
| `human-loyalists/horseman/horseman-se-die2.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01 | 2013-06-10 | 2022-06-04 |
| `human-loyalists/horseman/horseman-se-die3.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01 | 2013-06-10 | 2022-06-04 |
| `human-loyalists/horseman/horseman-se-die4.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01 | 2013-06-10 | 2022-06-04 |
| `human-loyalists/horseman/horseman-se-die5.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01 | 2013-06-10 | 2022-06-04 |

### Arch Mage (our hero, as a Wizard)

Frames and timings from `data/core/units/humans/Mage_Arch.cfg`.

| File | Licence | Artists, from the history | Added | Last changed |
| --- | --- | --- | --- | --- |
| `human-magi/arch-mage.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-07-25 |
| `human-magi/arch-mage-defend.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-07-25 |
| `human-magi/arch-mage-idle-1.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2008-10-31 | 2022-07-25 |
| `human-magi/arch-mage-idle-2.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2008-10-31 | 2022-07-25 |
| `human-magi/arch-mage-idle-3.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2008-10-31 | 2022-07-25 |
| `human-magi/arch-mage-idle-4.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2008-10-31 | 2022-07-25 |
| `human-magi/arch-mage-idle-5.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2008-10-31 | 2022-07-25 |
| `human-magi/arch-mage-attack-staff-1.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-07-25 |
| `human-magi/arch-mage-attack-staff-2.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-07-25 |
| `human-magi/arch-mage-attack-magic-1.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-07-25 |
| `human-magi/arch-mage-attack-magic-2.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-07-25 |

### Ranger (our hero, as a Ranger)

Frames and timings from `data/core/units/humans/Woodsman_Ranger.cfg`.

| File | Licence | Artists, from the history | Added | Last changed |
| --- | --- | --- | --- | --- |
| `human-outlaws/ranger.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Charles Dang, Richard Kettering | 2007-07-22 | 2022-04-29 |
| `human-outlaws/ranger-sword-defend-2.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Charles Dang, Richard Kettering | 2007-12-24 | 2022-04-29 |
| `human-outlaws/ranger-bow-defend.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Charles Dang, Richard Kettering | 2007-12-24 | 2022-04-29 |
| `human-outlaws/ranger-sword-defend-1.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Charles Dang, Richard Kettering | 2007-12-24 | 2022-04-29 |
| `human-outlaws/ranger-sword-attack1.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Charles Dang, Richard Kettering | 2007-12-24 | 2022-04-29 |
| `human-outlaws/ranger-sword-attack2.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Charles Dang, Richard Kettering | 2007-12-24 | 2022-04-29 |
| `human-outlaws/ranger-sword-attack3.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Charles Dang, Richard Kettering | 2007-12-24 | 2022-04-29 |
| `human-outlaws/ranger-sword-attack4.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Charles Dang, Richard Kettering | 2008-04-27 | 2022-04-29 |
| `human-outlaws/ranger-bow.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Charles Dang, Richard Kettering | 2007-12-24 | 2022-04-29 |
| `human-outlaws/ranger-bow-attack1.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Charles Dang, Richard Kettering | 2007-12-24 | 2022-04-29 |
| `human-outlaws/ranger-bow-attack2.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Charles Dang, Richard Kettering | 2007-12-24 | 2022-04-29 |
| `human-outlaws/ranger-bow-attack3.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Charles Dang, Richard Kettering | 2007-12-24 | 2022-04-29 |
| `human-outlaws/ranger-bow-attack4.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Charles Dang, Richard Kettering | 2007-12-24 | 2022-04-29 |

### Master at Arms (our hero, as a Courtier)

Frames and timings from `data/core/units/humans/Loyalist_Master_at_Arms.cfg`.

| File | Licence | Artists, from the history | Added | Last changed |
| --- | --- | --- | --- | --- |
| `human-loyalists/master-at-arms.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-06-04 |
| `human-loyalists/master-at-arms-defend-2.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering, Lari Nieminen | 2007-06-08 | 2022-06-04 |
| `human-loyalists/master-at-arms-victory-1.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Jérémy Rosen | 2010-01-30 | 2022-06-04 |
| `human-loyalists/master-at-arms-victory-2.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Jérémy Rosen | 2010-01-30 | 2022-06-04 |
| `human-loyalists/master-at-arms-victory-3.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Jérémy Rosen | 2010-01-30 | 2022-06-04 |
| `human-loyalists/master-at-arms-victory-4.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Jérémy Rosen | 2010-01-30 | 2022-06-04 |
| `human-loyalists/master-at-arms-victory-5.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Jérémy Rosen | 2010-01-30 | 2022-06-04 |
| `human-loyalists/master-at-arms-victory-6.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Jérémy Rosen | 2010-01-30 | 2022-06-04 |
| `human-loyalists/master-at-arms-melee-1-1.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-06-04 |
| `human-loyalists/master-at-arms-melee-1-2.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-06-04 |
| `human-loyalists/master-at-arms-melee-1-3.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-06-04 |
| `human-loyalists/master-at-arms-recover-1.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-06-04 |
| `human-loyalists/master-at-arms-recover-2.png` | GPL-2.0-or-later, changes since 2017 CC BY-SA 4.0 | doofus-01, Richard Kettering | 2007-05-16 | 2022-06-04 |
<!-- /wesnoth-files -->
