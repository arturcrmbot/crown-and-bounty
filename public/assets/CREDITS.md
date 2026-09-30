# Asset credits

## The units: Battle for Wesnoth

The troops and the hero are units from [Battle for Wesnoth](https://www.wesnoth.org/) 1.18, taken
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

## Everything else

The terrain, buildings, portraits, title painting, interface, music and sound are all made in code
(`src/render/`, `src/audio/`). No image-generation models are used.

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
