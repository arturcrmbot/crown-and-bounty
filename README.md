# Crown & Bounty

[![CI](https://github.com/arturcrmbot/crown-and-bounty/actions/workflows/ci.yml/badge.svg)](https://github.com/arturcrmbot/crown-and-bounty/actions/workflows/ci.yml)

A small browser game: King's Bounty (1990) rebuilt with the charm of Heroes of Might and Magic II. Commission I, The
Old King's Treasure, is open to play, and the next commissions are on their way.

**Play it:** https://arturcrmbot.github.io/crown-and-bounty/

## Run it

You need Node 20 or later. Run `npm install`, then `npm run dev`, and open http://127.0.0.1:5188.

- `npm run typecheck` and `npm run test:fast` are the quick checks. `npm test` adds the bot playing whole commissions.
- `npm run e2e` plays the commission through the real UI, and `npm run phone` does the same by touch.
- `npm run build` makes the site in `dist/`.

`AGENTS.md` lists every command, the debug links (`?quick=1`, `?battle=patrol`, `?reveal=1` and more) and where each
part of the game lives. `docs/` holds the design (`BRIEF.md`), the story (`WORLD.md`), the difficulty (`BALANCE.md`)
and the voice of its words (`VOICE.md`). Bugs and ideas go in
[Issues](https://github.com/arturcrmbot/crown-and-bounty/issues), and every merge to `main` is tested and deployed by
GitHub Actions.

The live game counts visits, and how far players get, with [GoatCounter](https://www.goatcounter.com/). It sets no
cookies and sends nothing personal, and a copy you build yourself counts nothing.

## Credits and licences

Crown & Bounty is free software under the GNU General Public License, version 2 or any later version (`LICENSE`).

- The map, the battlefield and the figures are painted from [Retro Diffusion](https://www.retrodiffusion.ai/) sheets,
  over units from [Battle for Wesnoth](https://www.wesnoth.org/) (GPL-2.0-or-later, or CC BY-SA 4.0).
- The music is yubatake's (CC BY 4.0), played on the GeneralUser GS instruments. The court's and the feast's tunes
  are Renaissance pieces from the Mutopia Project (public domain).
- The sounds are recordings by Battle for Wesnoth, Will Leamon, Kenney, Little Robot Sound Factory, Freesound's
  recordists and others, each under its own licence.
- The lettering is cut from TeX Gyre Pagella (GUST Font License).

[`public/assets/CREDITS.md`](public/assets/CREDITS.md) names every file, its author and its licence.
