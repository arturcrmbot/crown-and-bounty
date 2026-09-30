Bounty Serif
============

Bounty Serif is the lettering of Crown & Bounty (https://arturcrmbot.github.io/crown-and-bounty/).
It is a changed version of TeX Gyre Pagella 2.501, a free Palatino made by the GUST e-foundry
(Bogusław Jackowski, Janusz M. Nowacki, Piotr Pianowski and Piotr Strzelczyk) and based on
URW Palladio L. It is not TeX Gyre Pagella, and its makers do not support it: please report any
problem with it to https://github.com/arturcrmbot/crown-and-bounty/issues, not to them.

The original
------------

TeX Gyre Pagella 2.501 is at https://ctan.org/pkg/tex-gyre-pagella and
https://www.gust.org.pl/projects/e-foundry/tex-gyre/pagella. Its copyright line is:

  Copyright 2006-2018 for TeX Gyre extensions by B. Jackowski, J.M. Nowacki, et al.
  (on behalf of TeX USERS GROUPS). Vietnamese characters were added by Han The Thanh.

The licence
-----------

TeX Gyre Pagella, and so Bounty Serif, may be used, shared and changed under the GUST Font
License (GUST-FONT-LICENSE.txt, next to this file), which is the LaTeX Project Public License,
version 1.3c or later (https://www.latex-project.org/lppl.txt). As the GUST Font License asks,
the changed fonts and their files have new names. The fonts are separate files that the game
loads; the game itself is under the GPL, version 2 or later.

The files
---------

  bounty-serif-regular.woff2       from texgyrepagella-regular.otf
  bounty-serif-bold.woff2          from texgyrepagella-bold.otf
  bounty-serif-italic.woff2        from texgyrepagella-italic.otf
  bounty-serif-bold-italic.woff2   from texgyrepagella-bolditalic.otf

The changes
-----------

scripts/fonts.py in the game's repository makes each file from the original, with fontTools
(npm run fonts). It makes these changes:

1. The names. The family is "Bounty Serif" and the PostScript names are BountySerif-Regular,
   BountySerif-Bold, BountySerif-Italic and BountySerif-BoldItalic, instead of TeX Gyre Pagella's.
   The description in each font lists these changes and points to this file.
2. The letters. Only these characters are kept: Basic Latin (U+0020 to U+007E), Latin-1
   (U+00A0 to U+00FF), the dashes and quotation marks (U+2010 to U+2015, U+2018 to U+201E),
   the daggers, bullet and ellipsis (U+2020 to U+2022, U+2026), the primes (U+2032, U+2033),
   the single guillemets (U+2039, U+203A), five arrows (U+2190 to U+2193, U+2197), the minus
   sign (U+2212) and four triangles (U+25B2, U+25B6, U+25BC, U+25C0).
3. Two shapes are added: a black diamond (U+25C6) and a small black down-pointing triangle
   (U+25BE), drawn as plain polygons, and slanted in the italics.
4. Some signs are fitted to Palatino's room: # ( ) * + / < = > [ \ ] { | } ¤ ¥ ¬ ± µ · × ÷
   ‒ ― • … ′ ″ − and the italic apostrophe. Each keeps Pagella's drawing, scaled evenly and
   moved to fill the box, and takes the advance, that the same sign has in the Mac's Palatino
   (not all of them in every style: only where the two differ by more than a fiftieth of an em).
5. The line spacing is Palatino's: ascent 823 and descent 277 (in 1000 units), no line gap,
   in the hhea and OS/2 tables, with USE_TYPO_METRICS set.
6. Only the kerning (kern) and ligatures (liga) are kept of the OpenType features. The hints
   are removed, and the subroutines are expanded.
7. The fonts are saved as WOFF2.
