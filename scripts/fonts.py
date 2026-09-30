"""
Bounty Serif, the game's lettering (#148): TeX Gyre Pagella 2.501, a free Palatino, made smaller for the
web. It downloads the four faces from CTAN, cuts each down to the letters the game uses, renames it as
the GUST Font License asks, gives it the Mac's Palatino line spacing (so text sits where it always did),
sets the signs Pagella draws wider or narrower than Palatino in Palatino's room, adds the two shapes the
cards use that no Palatino has, and saves it as WOFF2 in public/assets/fonts/.
README-bounty-serif.txt there lists every change.

Needs Python 3 with fontTools and brotli: pip3 install fonttools brotli. Run: npm run fonts
"""

import math
import os
import sys
import tempfile
import urllib.request

from fontTools import subset
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.t2CharStringPen import T2CharStringPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

CTAN = 'https://mirrors.ctan.org/fonts/tex-gyre/opentype/texgyrepagella-{}.otf'
VERSION = '2.501'
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets', 'fonts')
FAMILY = 'Bounty Serif'

# (Pagella's file, ours, the style's name)
FACES = [
    ('regular', 'regular', 'Regular'),
    ('bold', 'bold', 'Bold'),
    ('italic', 'italic', 'Italic'),
    ('bolditalic', 'bold-italic', 'Bold Italic'),
]

# Basic Latin, Latin-1 (accents, the middle dot, the times sign), dashes and quotes, the dagger, bullet
# and ellipsis, primes, single guillemets, arrows, the minus sign, and the triangles and diamond the
# cards and the hero screen use.
UNICODES = [
    *range(0x20, 0x7F),
    *range(0xA0, 0x100),
    *range(0x2010, 0x2016),
    *range(0x2018, 0x201F),
    0x2020, 0x2021, 0x2022, 0x2026, 0x2032, 0x2033, 0x2039, 0x203A,
    0x2190, 0x2191, 0x2192, 0x2193, 0x2197,
    0x2212,
    0x25B2, 0x25B6, 0x25BC, 0x25C0,
]

# The Mac's Palatino (the look Artur approved): ascent 1685 and descent 568 in 2048 units, no line gap.
ASCENT, DESCENT = round(1685 / 2048 * 1000), round(568 / 2048 * 1000)

# Pagella's letters and figures are as wide as Palatino's, but it draws its own brackets, slashes,
# maths signs and a few more, wider or narrower. These are the Mac's Palatino's, measured from
# /System/Library/Fonts/Palatino.ttc: each sign's advance and ink box (x0, y0, x1, y1), in thousandths
# of an em. Pagella's own drawing of each is fitted into that box, so the words take the room they
# always did, and the middle dot between the bar's figures sits where Palatino's did.
PALATINO = {
    'regular': {
        0x0023: (606, 54, 0, 490, 694), 0x0028: (333, 59, -166, 299, 771), 0x0029: (333, 59, -166, 299, 771), 0x002B: (606, 51, 37, 558, 543),
        0x002F: (606, 135, -116, 469, 780), 0x003C: (606, 20, 28, 590, 504), 0x003D: (606, 37, 147, 571, 359), 0x003E: (606, 16, 28, 587, 504),
        0x005B: (333, 82, -176, 286, 757), 0x005C: (606, 114, -116, 448, 780), 0x005D: (333, 42, -176, 246, 757), 0x007B: (333, 58, -174, 283, 726),
        0x007C: (606, 275, 0, 331, 731), 0x007D: (333, 51, -174, 275, 726), 0x00A4: (606, 21, 0, 569, 548), 0x00AC: (606, 51, 122, 551, 382),
        0x00B1: (549, 21, 0, 528, 587), 0x00B5: (576, 23, -174, 494, 485), 0x00B7: (250, 66, 245, 183, 362), 0x00D7: (606, 86, 80, 528, 509),
        0x00F7: (549, 7, 76, 515, 511), 0x2012: (500, 0, 213, 500, 271), 0x2015: (1000, 0, 213, 1000, 271), 0x2022: (606, 131, 172, 475, 516),
        0x2026: (1000, 109, -5, 891, 112), 0x2032: (219, 67, 418, 197, 704), 0x2033: (417, 79, 418, 376, 704), 0x2212: (606, 36, 268, 571, 322),
    },
    'bold': {
        0x0023: (606, 39, 0, 453, 683), 0x0028: (333, 62, -106, 302, 722), 0x0029: (333, 28, -106, 268, 722), 0x002A: (444, 34, 422, 355, 730),
        0x002B: (606, 51, 37, 558, 543), 0x002F: (296, -9, -116, 308, 780), 0x003C: (606, 20, 29, 574, 507), 0x003D: (606, 35, 162, 573, 414),
        0x003E: (606, 32, 28, 586, 505), 0x005B: (333, 76, -106, 306, 722), 0x005C: (606, 146, -116, 463, 780), 0x005D: (333, 35, -106, 270, 722),
        0x007B: (310, 0, -121, 277, 739), 0x007C: (606, 264, 0, 341, 731), 0x007D: (310, 29, -121, 310, 740), 0x00A4: (606, 21, 0, 569, 548),
        0x00AC: (606, 46, 118, 546, 391), 0x00B1: (549, 21, 0, 528, 592), 0x00B5: (576, 22, -223, 554, 485), 0x00B7: (250, 47, 227, 200, 380),
        0x00D7: (606, 73, 63, 533, 523), 0x00F7: (549, 6, 21, 543, 560), 0x2012: (500, 0, 206, 500, 289), 0x2015: (1000, 0, 206, 1000, 289),
        0x2026: (1000, 97, -11, 903, 142), 0x2032: (250, 42, 457, 208, 708), 0x2033: (500, 55, 457, 445, 708), 0x2212: (606, 34, 253, 572, 329),
    },
    'italic': {
        0x0023: (606, 43, 0, 467, 693), 0x0027: (333, 140, 509, 289, 733), 0x0028: (333, 55, -101, 330, 732), 0x0029: (333, 7, -104, 284, 729),
        0x002B: (606, 51, 37, 558, 543), 0x002F: (296, -6, -116, 305, 780), 0x003C: (606, 20, 28, 590, 504), 0x003D: (606, 37, 134, 571, 346),
        0x003E: (606, 16, 28, 587, 504), 0x005B: (333, 18, -103, 325, 726), 0x005C: (606, 124, -116, 438, 780), 0x005D: (333, 8, -102, 315, 726),
        0x007B: (333, 44, -99, 343, 734), 0x007C: (606, 275, 0, 331, 733), 0x007D: (333, -10, -99, 289, 734), 0x00A4: (606, 21, 0, 569, 548),
        0x00A5: (667, 97, 0, 659, 693), 0x00AC: (606, 51, 122, 551, 382), 0x00B1: (549, 21, 0, 528, 587), 0x00B5: (576, 11, -174, 494, 485),
        0x00B7: (250, 73, 243, 176, 361), 0x00D7: (606, 86, 80, 528, 509), 0x00F7: (549, 7, 76, 515, 511), 0x2012: (500, -7, 222, 526, 271),
        0x2015: (1000, 0, 222, 1019, 271), 0x2022: (500, 85, 172, 429, 515), 0x2026: (1000, 93, -5, 864, 113), 0x2032: (333, 140, 509, 289, 733),
        0x2212: (606, 36, 268, 570, 319),
    },
    'bold-italic': {
        0x0023: (606, 67, 0, 553, 683), 0x0028: (333, 79, -125, 388, 725), 0x0029: (333, 79, -125, 388, 725), 0x002A: (444, 136, 424, 434, 730),
        0x002B: (606, 51, 37, 558, 543), 0x002F: (315, -19, -116, 333, 780), 0x003C: (606, 20, 29, 572, 507), 0x003D: (606, 34, 131, 572, 381),
        0x003E: (606, 33, 28, 586, 505), 0x005B: (333, 37, -124, 393, 717), 0x005C: (606, 130, -116, 488, 780), 0x005D: (333, -34, -124, 315, 719),
        0x007B: (333, 17, -125, 318, 718), 0x007C: (606, 264, 0, 341, 731), 0x007D: (333, 38, -104, 341, 718), 0x00A4: (606, 21, 0, 569, 548),
        0x00AC: (606, 46, 118, 546, 391), 0x00B1: (549, 21, 0, 528, 592), 0x00B5: (576, 0, -223, 561, 484), 0x00B7: (250, 50, 229, 200, 379),
        0x00D7: (606, 73, 63, 533, 523), 0x00F7: (549, 6, 21, 543, 560), 0x2012: (500, 1, 213, 518, 282), 0x2015: (1000, 0, 213, 1019, 282),
        0x2026: (1000, 82, -13, 888, 140), 0x2032: (250, 107, 457, 273, 708), 0x2033: (500, 107, 457, 498, 708), 0x2212: (606, 34, 251, 572, 335),
    },
}

# Shapes no Palatino has, so each device drew them from a font of its own: the diamond before every
# choice on a card, and the small triangle of "more ▾". Each is drawn here at the size and place the
# Mac drew it (from Lucida Grande), as (codepoint, glyph name, advance, outline), in font units.
SHAPES = [
    (0x25C6, 'uni25C6', 723, [(361, 0), (629, 268), (361, 536), (93, 268)]),
    (0x25BE, 'uni25BE', 639, [(319, 121), (608, 410), (30, 410)]),
]
UNICODES += [code for code, *_ in SHAPES]

CHANGES = (
    f'{FAMILY} is TeX Gyre Pagella {VERSION} (GUST e-foundry: B. Jackowski, J. M. Nowacki, P. Pianowski, '
    'P. Strzelczyk), changed for Crown & Bounty: renamed; cut down to Basic Latin, Latin-1 and a few '
    'punctuation marks, arrows and shapes; brackets, slashes, maths signs and a few more fitted to '
    "Palatino's widths and places; a diamond (U+25C6) and a small down triangle (U+25BE) added; "
    'kerning and ligatures only; no hints; the line spacing of Palatino (ascent '
    f'{ASCENT}, descent {DESCENT}); saved as WOFF2. See README-bounty-serif.txt. '
    'The original: https://ctan.org/pkg/tex-gyre-pagella'
)


def download(name):
    cache = os.path.join(tempfile.gettempdir(), f'tex-gyre-pagella-{VERSION}')
    os.makedirs(cache, exist_ok=True)
    path = os.path.join(cache, f'texgyrepagella-{name}.otf')
    if not os.path.exists(path):
        print(f'downloading {CTAN.format(name)}')
        urllib.request.urlretrieve(CTAN.format(name), path)
    return path


def rename(font, style):
    ps = f'{FAMILY.replace(" ", "")}-{style.replace(" ", "")}'
    full = FAMILY if style == 'Regular' else f'{FAMILY} {style}'
    names = font['name']
    copyright = names.getDebugName(0)
    names.names = []
    for nid, text in [
        (0, copyright),
        (1, FAMILY),
        (2, style),
        (3, f'{VERSION};{ps}'),
        (4, full),
        (5, f'Version {VERSION}; {FAMILY}'),
        (6, ps),
        (10, CHANGES),
        (13, 'This font is released under the GUST Font License, an instance of the LaTeX Project '
             'Public License, version 1.3c or later.'),
        (14, 'https://www.gust.org.pl/projects/e-foundry/licenses'),
    ]:
        names.setName(text, nid, 3, 1, 0x409)
    cff = font['CFF '].cff
    cff.fontNames = [ps]
    top = cff.topDictIndex[0]
    top.FullName = full
    top.FamilyName = FAMILY


def space_as_palatino(font):
    hhea, os2 = font['hhea'], font['OS/2']
    hhea.ascent, hhea.descent, hhea.lineGap = ASCENT, -DESCENT, 0
    os2.sTypoAscender, os2.sTypoDescender, os2.sTypoLineGap = ASCENT, -DESCENT, 0
    os2.fsSelection |= 1 << 7  # USE_TYPO_METRICS: every system spaces lines the same way.


def fit_to_palatino(font, style):
    """Scales and moves each PALATINO sign into Palatino's box, and gives it Palatino's advance."""
    cff = font['CFF '].cff
    top = cff.topDictIndex[0]
    glyphs = font.getGlyphSet()
    cmap = font.getBestCmap()
    fitted = set()
    for code, (advance, x0, y0, x1, y1) in PALATINO[style].items():
        name = cmap[code]
        if name in fitted:
            continue
        fitted.add(name)
        bounds = BoundsPen(glyphs)
        glyphs[name].draw(bounds)
        gx0, gy0, gx1, gy1 = bounds.bounds
        scale = min((x1 - x0) / (gx1 - gx0), (y1 - y0) / (gy1 - gy0))
        dx = (x0 + x1 - scale * (gx0 + gx1)) / 2
        dy = (y0 + y1 - scale * (gy0 + gy1)) / 2
        pen = T2CharStringPen(advance, glyphs)
        glyphs[name].draw(TransformPen(pen, (scale, 0, 0, scale, dx, dy)))
        top.CharStrings[name] = pen.getCharString(private=top.Private, globalSubrs=cff.GlobalSubrs)
        font['hmtx'][name] = (advance, round(scale * gx0 + dx))


def add_shapes(font):
    """Draws SHAPES into the font, leaning with its italic."""
    lean = math.tan(math.radians(-font['post'].italicAngle))
    cff = font['CFF '].cff
    top = cff.topDictIndex[0]
    strings = top.CharStrings
    glyphs = font.getGlyphSet()
    for code, name, advance, outline in SHAPES:
        pen = T2CharStringPen(advance, glyphs)
        points = [(round(x + y * lean), y) for x, y in outline]
        pen.moveTo(points[0])
        for point in points[1:]:
            pen.lineTo(point)
        pen.closePath()
        strings.charStringsIndex.append(pen.getCharString(private=top.Private, globalSubrs=cff.GlobalSubrs))
        strings.charStrings[name] = len(strings.charStringsIndex) - 1
        top.charset.append(name)
        font['hmtx'][name] = (advance, min(x for x, _ in points))
        for table in font['cmap'].tables:
            if table.isUnicode():
                table.cmap[code] = name
    # The charset is the glyph order: the font's copy of it must say the same.
    font.setGlyphOrder(list(top.charset))
    bounds = BoundsPen(font.getGlyphSet())
    font.getGlyphSet()[SHAPES[0][1]].draw(bounds)
    assert bounds.bounds, 'the shapes did not draw'


def build(source, ours, style):
    options = subset.Options()
    options.flavor = 'woff2'
    options.layout_features = ['kern', 'liga']
    options.hinting = False
    options.desubroutinize = True
    options.name_IDs = ['*']
    options.notdef_outline = True
    options.glyph_names = False
    options.drop_tables += ['FFTM']
    font = TTFont(download(source))
    version = font['name'].getDebugName(5) or ''
    if f'Version {VERSION}' not in version:
        sys.exit(f'expected TeX Gyre Pagella {VERSION}, got "{version}"')
    add_shapes(font)
    fit_to_palatino(font, ours)
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=UNICODES)
    subsetter.subset(font)
    rename(font, style)
    space_as_palatino(font)
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, f'bounty-serif-{ours}.woff2')
    subset.save_font(font, path, options)
    print(f'saved {os.path.relpath(path)}: {os.path.getsize(path)} bytes, {len(font.getGlyphOrder())} glyphs')


for source, ours, style in FACES:
    build(source, ours, style)
