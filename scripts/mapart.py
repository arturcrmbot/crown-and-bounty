"""The map's art (#178): cuts each piece out of the sheets in art/map/sheets/, sizes it to the map's
scale, snaps it to the game's palette and writes it to public/assets/map/, with the list in
src/render/mapPieces.ts. Python 3 with Pillow, numpy and scipy:  npm run mapart

The sheets were made with Retro Diffusion (RD Pro, with HoMM2's map as the style reference) on 1 Oct
2026, at Artur's request: see public/assets/CREDITS.md. Each sheet is objects on one flat grey, their
shadows one flatter grey; the ground sheets are a framed square of seamless texture.
"""
import json, os, subprocess
from collections import Counter

import numpy as np
from PIL import Image
from scipy import ndimage as nd

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHEETS = os.path.join(ROOT, 'art/map/sheets')
OUT = os.path.join(ROOT, 'public/assets/map')

# name: (sheet, box in the sheet, width on the map, keep only these columns below a row: (row, x0, x1)).
PIECES = {
    'castle': ('big', (6, 4, 123, 120), 120),
    'stockade': ('big', (131, 13, 241, 119), 92),
    'hallShut': ('big', (2, 146, 122, 243), 96),
    'hallOpen': ('big', (130, 133, 250, 244), 96),
    'well': ('village', (12, 12, 65, 71), 30),
    'watermill': ('village', (88, 6, 165, 76), 62),
    'hut': ('village', (182, 13, 242, 71), 36),
    'washing': ('village', (3, 88, 83, 163), 58),
    'fold': ('village', (93, 105, 162, 155), 56),
    'hayrick': ('village', (179, 95, 239, 157), 40),
    'skeps': ('village', (9, 171, 72, 218), 44),
    'kiln': ('village', (93, 171, 159, 246), 50),
    'boat': ('village', (185, 176, 235, 207), 48),
    'pond': ('village', (185, 216, 247, 248), 60),
    'lodge': ('wild', (9, 13, 92, 84), 62),
    'mews': ('wild', (103, 26, 165, 75), 50),
    'butts': ('wild', (179, 31, 242, 73), 50),
    'stones': ('wild', (14, 99, 82, 158), 56),
    'tents': ('wild', (174, 99, 248, 159), 60),
    'cart': ('wild', (15, 174, 88, 244), 60),
    'pack': ('wild', (104, 190, 154, 239), 28),
    'nest': ('wild', (177, 182, 244, 243), 46),
    'signpost': ('wild', (110, 95, 148, 152), 18),
    'holes': ('wild', (136, 128, 175, 162), 40),
    # The meadow's small things (bushes, flowers, grass, ferns, a stump, a log, mushrooms, stones, brambles).
    'decor0': ('decor', (11, 24, 39, 50), 12),
    'decor1': ('decor', (50, 22, 81, 50), 13),
    'decor2': ('decor', (89, 20, 123, 50), 14),
    'decor3': ('decor', (127, 15, 166, 50), 16),
    'decor4': ('decor', (169, 9, 208, 50), 16),
    'decor5': ('decor', (210, 7, 252, 50), 18),
    'decor6': ('decor', (5, 61, 45, 99), 17),
    'decor7': ('decor', (47, 61, 87, 99), 17),
    'decor8': ('decor', (90, 66, 127, 97), 16),
    'decor9': ('decor', (132, 64, 167, 97), 15),
    'decor10': ('decor', (172, 64, 207, 97), 15),
    'decor11': ('decor', (216, 64, 248, 98), 13),
    'decor12': ('decor', (9, 112, 40, 146), 13),
    'decor13': ('decor', (51, 110, 83, 146), 13),
    'decor14': ('decor', (93, 113, 122, 146), 12),
    'decor15': ('decor', (129, 113, 169, 147), 17),
    'decor16': ('decor', (171, 112, 209, 147), 16),
    'decor17': ('decor', (210, 115, 251, 147), 17),
    'decor18': ('decor', (4, 156, 67, 196), 26),
    'decor19': ('decor', (75, 161, 108, 193), 14),
    'decor20': ('decor', (112, 164, 144, 192), 13),
    'decor21': ('decor', (149, 170, 170, 192), 9),
    'decor22': ('decor', (175, 168, 204, 188), 12),
    'decor23': ('decor', (214, 166, 246, 192), 13),
    'decor24': ('decor', (4, 205, 60, 248), 24),
    'decor25': ('decor', (66, 212, 112, 247), 19),
    'decor26': ('decor', (116, 220, 166, 246), 21),
    'decor27': ('decor', (171, 211, 210, 248), 16),
    'decor28': ('decor', (213, 209, 249, 248), 15),
    'cragBig': ('land', (54, 4, 195, 77), 140),
    'cragMid': ('land', (13, 73, 87, 130), 74),
    'cragSmall': ('land', (178, 81, 234, 123), 56),
    'boulder1': ('land', (109, 90, 147, 121), 22),
    'boulder2': ('land', (11, 145, 57, 177), 28),
    'boulder3': ('land', (73, 151, 107, 176), 20),
    'bridge': ('land', (121, 123, 245, 196), 124),
    'tower': ('places', (114, 85, 142, 153), 28),
    'windmill': ('places', (185, 78, 238, 152), 53),
    'cottage': ('places', (11, 92, 81, 144), 52),
    'mine': ('places', (1, 157, 102, 205), 82),
    'campfire': ('places', (159, 215, 199, 249), 32),
    'logs': ('places', (102, 213, 151, 250), 36),
    'chest': ('places', (158, 161, 200, 199), 26),
    'gold': ('places', (205, 162, 255, 200), 32),
    'shrine': ('places', (212, 207, 248, 255), 30),
}
# The second batch (1 Oct, after Artur put the map beside HoMM2's): what makes each place a little scene.
# Farm things, waterside beds and reeds, rolling hills and outcrops, treasure, and the battle's own obstacles.
_more = {
    'farm': ['logPile', 'wagon', 'fence', 'haystack', 'barrels', 'crates', 'scarecrow', 'wellHouse', 'gazebo', 'fountain', None, 'garden'],
    'shore': ['bedPurple', 'bedPurple2', 'bedPink', 'bedPink2', 'bedRed', 'bedRed2', 'bedRed3', 'reeds', 'reeds2', 'reeds3', 'reeds4', 'lily', 'wetRock', 'wetRocks', 'wetRocks2', 'bedYellow', 'bedYellow2', 'driftLog'],
    'hills': ['hillSmall', 'hill', 'outcrop', 'hillWide', 'hillBig', 'outcrop2', 'outcrop3', 'rock', 'mound', 'mound2', 'peak'],
    'treasure': ['chestShut', 'chestGold', 'chestOpen', 'goldHeap', 'goldSmall', 'wood', 'ore', 'gems', None, 'crystals', 'lamp', 'cauldron', 'fire', 'bones'],
    'battle': ['bOak', 'bOak2', 'bOak3', 'bOak4', 'bFir', 'bFir2', 'bRock', 'bRock2', 'bRock3', 'bRock4', 'bRock5', 'bBramble', 'bLog', 'bStump', 'bPond'],
}
_boxes = {
    'farm': [(7, 12, 63, 50), (79, 8, 169, 56), (183, 16, 247, 48), (5, 60, 63, 109), (85, 64, 144, 108), (181, 56, 245, 110), (12, 117, 59, 177), (73, 114, 125, 176), (169, 109, 246, 180), (5, 185, 64, 245), (72, 182, 156, 248), (163, 193, 249, 244)],
    'shore': [(6, 1, 108, 44), (123, 9, 242, 44), (6, 44, 109, 87), (123, 52, 242, 87), (7, 94, 72, 126), (77, 94, 142, 127), (146, 94, 200, 127), (204, 90, 248, 128), (4, 137, 44, 189), (52, 133, 97, 189), (101, 133, 141, 189), (153, 140, 195, 168), (206, 134, 246, 168), (148, 174, 197, 209), (203, 173, 251, 209), (7, 198, 67, 251), (73, 198, 134, 251), (148, 212, 247, 251)],
    'hills': [(13, 21, 56, 45), (75, 12, 168, 54), (190, 9, 250, 56), (9, 73, 105, 121), (122, 67, 250, 126), (12, 134, 87, 191), (99, 134, 180, 193), (195, 145, 245, 182), (9, 206, 87, 246), (102, 208, 174, 246), (189, 200, 250, 248)],
    'treasure': [(72, 14, 119, 56), (135, 9, 185, 57), (197, 11, 243, 57), (7, 75, 63, 119), (77, 81, 118, 113), (132, 74, 185, 116), (194, 75, 247, 115), (8, 137, 62, 178), (48, 168, 60, 178), (72, 133, 124, 178), (131, 137, 187, 175), (199, 129, 244, 183), (73, 190, 120, 244), (130, 197, 190, 241)],
    'battle': [(3, 1, 61, 60), (67, 1, 125, 59), (132, 2, 187, 59), (198, 2, 249, 59), (13, 64, 50, 126), (78, 65, 115, 126), (133, 72, 183, 120), (198, 74, 246, 119), (6, 136, 54, 184), (70, 136, 118, 184), (138, 137, 182, 183), (198, 139, 247, 183), (10, 200, 117, 247), (131, 202, 186, 247), (194, 209, 254, 240)],
}
# Widths on the map (a tile is 32 px), and in battle for the battle's (a hex is 64 px across).
_widths = {
    'logPile': 26, 'wagon': 40, 'fence': 30, 'haystack': 24, 'barrels': 18, 'crates': 20, 'scarecrow': 14, 'wellHouse': 22, 'gazebo': 34, 'fountain': 28, 'garden': 36,
    'bedPurple': 46, 'bedPurple2': 50, 'bedPink': 44, 'bedPink2': 50, 'bedRed': 30, 'bedRed2': 30, 'bedRed3': 26, 'reeds': 18, 'reeds2': 16, 'reeds3': 18, 'reeds4': 16,
    'lily': 12, 'wetRock': 18, 'wetRocks': 22, 'wetRocks2': 22, 'bedYellow': 26, 'bedYellow2': 26, 'driftLog': 40,
    'hillSmall': 36, 'hill': 70, 'outcrop': 44, 'hillWide': 76, 'hillBig': 100, 'outcrop2': 52, 'outcrop3': 54, 'rock': 24, 'mound': 50, 'mound2': 46, 'peak': 50,
    'chestShut': 24, 'chestGold': 26, 'chestOpen': 24, 'goldHeap': 28, 'goldSmall': 20, 'wood': 28, 'ore': 26, 'gems': 26, 'crystals': 24, 'lamp': 20, 'cauldron': 24, 'fire': 24, 'bones': 30,
    'bOak': 74, 'bOak2': 74, 'bOak3': 70, 'bOak4': 66, 'bFir': 42, 'bFir2': 42, 'bRock': 58, 'bRock2': 56, 'bRock3': 56, 'bRock4': 56, 'bRock5': 50, 'bBramble': 56, 'bLog': 110, 'bStump': 52, 'bPond': 66,
}
for _sheet, _names in _more.items():
    for _name, _box in zip(_names, _boxes[_sheet]):
        if _name:
            PIECES[_name] = (_sheet, _box, _widths[_name])
# The bright trees: twenty round broadleaves (orange, gold, green, teal, red), and the conifers sheet's
# blue firs, dark pines, willows, birches and dead trees. Each is cut to a height on the map, not a width:
# HoMM2's trees stand a tile and a bit tall. Their kind is worked out from their colour (see `grove_kind`).
GROVES = [(74, 4, 107, 63), (158, 15, 188, 70), (45, 38, 78, 97), (106, 32, 138, 90), (14, 69, 47, 129), (77, 68, 110, 127), (138, 64, 171, 122), (186, 47, 217, 105), (49, 103, 82, 162), (111, 98, 145, 156), (164, 106, 195, 164), (212, 93, 245, 152), (29, 142, 59, 197), (84, 136, 117, 196), (137, 148, 170, 207), (188, 147, 221, 206), (59, 177, 92, 236), (111, 188, 144, 247), (162, 186, 196, 246)]
CONIFERS = [((5, 2, 37, 60), 'fir'), ((48, 2, 80, 60), 'fir'), ((90, 1, 123, 60), 'fir'), ((133, 2, 165, 60), 'fir'), ((176, 4, 208, 60), 'fir'), ((219, 4, 250, 59), 'fir'),
            ((4, 68, 39, 123), 'pine'), ((47, 67, 81, 123), 'pine'), ((89, 68, 124, 123), 'pine'), ((132, 68, 167, 123), 'pine'), ((175, 68, 209, 125), 'pine'), ((220, 67, 250, 123), 'pine'),
            ((2, 132, 47, 184), 'willow'), ((54, 133, 96, 183), 'willow'), ((105, 131, 150, 185), 'willow'), ((175, 129, 206, 188), 'birch'), ((215, 129, 248, 189), 'birch'),
            ((8, 193, 39, 252), 'birch'), ((54, 192, 86, 252), 'birch'), ((104, 192, 137, 252), 'birch'), ((168, 194, 203, 254), 'dead'), ((214, 195, 250, 254), 'dead')]
TREE_HEIGHT = {'orange': 40, 'gold': 40, 'green': 42, 'teal': 40, 'red': 40, 'fir': 44, 'pine': 44, 'willow': 34, 'birch': 38, 'dead': 36}


def grove_kind(px):
    """A broadleaf's kind, from the mean hue of its crown."""
    rgb = px[..., :3][px[..., 3] == 255].astype(float)
    hsv = np.asarray(Image.fromarray(rgb[None].astype('uint8')).convert('HSV'))[0].astype(float)
    crown = hsv[hsv[:, 1] > 80]
    h = np.median(crown[:, 0]) * 360 / 255
    return 'red' if h < 14 or h > 330 else 'orange' if h < 30 else 'gold' if h < 60 else 'green' if h < 150 else 'teal'


# The troops and Aldric (#178): each one's box on its sheet, and how tall he stands in battle, from
# his feet to the top of his head (a person about 65 px; on the map three fifths of that, Aldric two thirds).
FIGURES = {
    'peasants': ('units-a', (19, 19, 78, 124), 66), 'archers': ('units-a', (99, 20, 157, 125), 64), 'knights': ('units-a', (172, 0, 256, 127), 105),
    'swordsmen': ('units-a', (10, 128, 79, 252), 68), 'crossbowmen': ('units-a', (95, 140, 171, 252), 68), 'wolves': ('units-a', (167, 171, 249, 252), 44),
    'baron': ('units-b', (10, 9, 83, 124), 82), 'goblins': ('units-b', (96, 42, 174, 124), 48), 'trolls': ('units-b', (178, 7, 244, 124), 86),
    'witch': ('units-b', (22, 145, 84, 249), 70), 'bramble': ('units-b', (97, 131, 167, 249), 82), 'poachers': ('units-b', (177, 147, 250, 250), 64),
    'bandits': ('units-c', (8, 13, 83, 124), 64), 'boars': ('units-c', (163, 45, 253, 119), 42), 'bears': ('units-c', (0, 158, 98, 250), 60),
    'huntsmen': ('units-c', (96, 130, 170, 252), 66), 'heroKnight': ('units-c', (170, 118, 256, 255), 96),
    'heroWizard': ('units-d', (13, 8, 82, 124), 72), 'heroRanger': ('units-d', (98, 14, 170, 125), 72), 'heroCourtier': ('units-d', (178, 6, 243, 125), 72),
    'rook': ('units-d', (170, 138, 254, 252), 68),
}
FIGURES['hero'] = FIGURES['heroKnight']
TROOPS_OUT = os.path.join(ROOT, 'public/assets/troops')
# Ground: the seamless square inside each ground sheet's frame.
GROUND = {'heather': (14, 34, 114, 114), 'water': (36, 36, 92, 92), 'grass': (33, 33, 95, 95), 'dirt': (33, 33, 95, 95), 'wheat': (33, 36, 95, 95), 'heath': (14, 34, 114, 114), 'plough': (33, 33, 95, 95)}


def palette():
    js = "import('./src/render/palette.ts').then(m=>console.log(JSON.stringify({c:m.COLORS,cyc:[...m.CYCLING],sil:m.SILHOUETTE,unit:[...m.UNIT]})))"
    out = subprocess.run(['npx', 'tsx', '-e', js], cwd=ROOT, capture_output=True, text=True, check=True).stdout
    d = json.loads(out.strip().splitlines()[-1])
    steady = [i for i in range(1, len(d['c'])) if i not in set(d['cyc']) and i != d['sil']]
    global UNIT
    UNIT = set(d['unit'])
    return np.array(d['c'], float), steady


def oklab(rgb):
    c = rgb / 255.0
    c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    m1 = np.array([[0.4122214708, 0.5363325363, 0.0514459929], [0.2119034982, 0.6806995451, 0.1073969566], [0.0883024619, 0.2817188376, 0.6299787005]])
    lms = np.cbrt(np.maximum(c @ m1.T, 0))
    m2 = np.array([[0.2104542553, 0.7936177850, -0.0040720468], [1.9779984951, -2.4285922050, 0.4505937099], [0.0259040371, 0.7827717662, -0.8086757660]])
    return lms @ m2.T


COLORS, STEADY = palette()
try:
    MAP_NOW = [l for l in open(os.path.join(ROOT, 'src/render/mapPalette.ts')).read().split('[')[1].split(']')[0].split(',') if l.strip()]
except FileNotFoundError:
    MAP_NOW = []
LAB = oklab(COLORS[STEADY])


def snap(rgb, land=False):
    """The nearest steady palette colour to each pixel, by OKLab. The ground (`land`) keeps to the land's
    own ramps, not the units' colours: the day's light (evening, night) is tuned for those."""
    flat = rgb.reshape(-1, 3).astype(float)
    best = np.zeros(len(flat), int)
    lab = oklab(flat)
    allowed = np.array([i not in UNIT for i in STEADY]) if land else np.ones(len(STEADY), bool)
    table = np.where(allowed[:, None], LAB, 1e6)
    for s in range(0, len(flat), 8192):
        best[s:s + 8192] = ((lab[s:s + 8192, None] - table[None]) ** 2).sum(2).argmin(1)
    return COLORS[np.array(STEADY)[best]].reshape(rgb.shape)


def layers(sheet):
    """A sheet's pixels, what's background, and what's shadow (its flat grey touching the background)."""
    a = np.asarray(Image.open(os.path.join(SHEETS, sheet + '.png')).convert('RGB')).astype(int)
    bg = np.array(Counter(map(tuple, a.reshape(-1, 3))).most_common(1)[0][0])
    back = np.abs(a - bg).sum(2) <= 8
    rim = nd.binary_dilation(back) & ~back
    grey = (a.max(2) - a.min(2) < 12) & (a.sum(2) > 120) & (a.sum(2) < bg.sum() - 20)
    if sheet == 'heath':
        # A ground sheet: nothing is background, nothing is shadow; its pieces are cut by colour.
        return a, np.zeros(a.shape[:2], bool), np.zeros(a.shape[:2], bool)
    if not (rim & grey).any():
        return a, back, np.zeros(a.shape[:2], bool)
    tone = np.array(Counter(map(tuple, a[rim & grey])).most_common(1)[0][0])
    flat = np.abs(a - tone).sum(2) <= 6
    lab, _ = nd.label(flat)
    touching = np.unique(lab[rim & flat])
    shadow = np.isin(lab, touching[touching > 0])
    return a, back, shadow


CACHE = {}


def cut(sheet, box, width, name='', height=None, alone=False, cool=False):
    """RGBA of one piece at `width` pixels across: painted pixels opaque, shadow at alpha 128."""
    if sheet not in CACHE:
        CACHE[sheet] = layers(sheet)
    a, back, shadow = CACHE[sheet]
    x0, y0, x1, y1 = box
    rgb, solid, sh = a[y0:y1, x0:x1].copy(), ~back[y0:y1, x0:x1] & ~shadow[y0:y1, x0:x1], shadow[y0:y1, x0:x1].copy()
    if cool:
        # Blue firs and teal trees: the palette has no teal, and they snapped to a royal blue. Turned to a
        # blue-green that snaps to the pines' own ramp, as HoMM2's blue-green firs are.
        hsv = np.asarray(Image.fromarray(rgb.astype('uint8')).convert('HSV')).astype(float)
        blue = (hsv[..., 0] > 150 * 255 / 360) & (hsv[..., 0] < 260 * 255 / 360) & (hsv[..., 1] > 40)
        hsv[..., 0] = np.where(blue, 172 * 255 / 360, hsv[..., 0])
        hsv[..., 1] = np.where(blue, hsv[..., 1] * 0.65, hsv[..., 1])
        rgb = np.asarray(Image.fromarray(hsv.astype('uint8'), 'HSV').convert('RGB')).astype(int)
    if sheet == 'hills':
        # The hills came out a neon green: calmed to the meadow's own.
        hsv = np.asarray(Image.fromarray(rgb.astype('uint8')).convert('HSV')).astype(float)
        green = (hsv[..., 0] > 40) & (hsv[..., 0] < 110) & (hsv[..., 1] > 90)
        hsv[..., 1] = np.where(green, hsv[..., 1] * 0.72, hsv[..., 1])
        hsv[..., 2] = np.where(green, hsv[..., 2] * 0.86, hsv[..., 2])
        hsv[..., 0] = np.where(green, hsv[..., 0] + 4, hsv[..., 0])
        rgb = np.asarray(Image.fromarray(hsv.astype('uint8'), 'HSV').convert('RGB')).astype(int)
    if name == 'signpost':
        # The diggings' spoil heaps touch the post's foot: keep the post's columns only below the arms.
        solid[30:, :12] = False
        solid[30:, 27:] = False
        sh[30:, :12] = False
        sh[30:, 27:] = False
    if name.startswith('heather'):
        purple = (rgb[..., 2] > rgb[..., 1] + 10) & (rgb[..., 0] > rgb[..., 1])
        solid = nd.binary_closing(purple, iterations=1) & solid
        sh = np.zeros_like(solid)
    if name == 'cart':
        # A tent stands behind the cart: its pale canvas goes.
        hsv = np.asarray(Image.fromarray(rgb.astype('uint8')).convert('HSV')).astype(int)
        tent = (hsv[..., 2] > 150) & (hsv[..., 1] < 90)
        tent[:, :30] = False
        tent[32:] = False
        tent = nd.binary_dilation(tent, iterations=1) & solid
        lab, _ = nd.label(solid & ~tent)
        sizes = np.bincount(lab.ravel()); sizes[0] = 0
        solid = lab == sizes.argmax()
    if alone:
        # One tree among many: only its own biggest painted part, and the shadow that touches it.
        lab, _ = nd.label(solid, structure=np.ones((3, 3)))
        sizes = np.bincount(lab.ravel()); sizes[0] = 0
        solid = lab == sizes.argmax()
        lab, _ = nd.label(sh, structure=np.ones((3, 3)))
        touching = np.unique(lab[nd.binary_dilation(solid, iterations=2) & sh])
        sh = np.isin(lab, touching[touching > 0])
    # Keep only what's joined to the piece's biggest part, so a neighbour's edge doesn't come along.
    lab, _ = nd.label(solid | sh, structure=np.ones((3, 3)))
    sizes = np.bincount(lab.ravel()); sizes[0] = 0
    main = sizes > max(20, sizes.max() * 0.04)
    keep = main[lab]
    solid &= keep
    sh &= keep
    ys, xs = np.nonzero(solid | sh)
    rgb, solid, sh = rgb[ys.min():ys.max() + 1, xs.min():xs.max() + 1], solid[ys.min():ys.max() + 1, xs.min():xs.max() + 1], sh[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    k = width / rgb.shape[1] if height is None else height / (np.ptp(np.nonzero(solid.any(1))[0]) + 1)
    w, h = max(1, round(rgb.shape[1] * k)), max(1, round(rgb.shape[0] * k))
    if k != 1:
        own = np.unique(rgb[solid].reshape(-1, 3), axis=0).astype(float)
        weight = Image.fromarray((solid * 255).astype('uint8')).resize((w, h), Image.BOX)
        premult = Image.fromarray((rgb * solid[..., None]).astype('uint8')).resize((w, h), Image.BOX)
        cover = np.asarray(weight).astype(float) / 255
        mean = np.asarray(premult).astype(float) / np.maximum(cover, 1e-3)[..., None]
        # Back to colours the artist used, so shrinking doesn't blur.
        idx = ((mean[..., None, :] - own[None, None]) ** 2).sum(3).argmin(2)
        rgb = own[idx]
        shade = np.asarray(Image.fromarray((sh * 255).astype('uint8')).resize((w, h), Image.BOX)).astype(float) / 255
        solid = cover > 0.5
        sh = ~solid & (shade + cover > 0.5)
    out = np.zeros(rgb.shape[:2] + (4,), 'uint8')
    out[solid, :3] = snap(rgb)[solid]
    out[solid, 3] = 255
    out[sh, 3] = 128
    return out


def heath(rgb):
    """The heath's ground: the meadow's own grass gone dry and golden, so it's the same land as the grass.
    Its heather (the `heather` ground) is laid over it in patches, where the map's noise says, so it never repeats in a grid."""
    x0, y0, x1, y1 = GROUND['grass']
    grass = np.asarray(Image.open(os.path.join(SHEETS, 'grass.png')).convert('RGB')).astype(float)[y0:y1, x0:x1]
    grass = clumps(seamless(np.asarray(Image.fromarray(grass.astype('uint8')).resize(rgb.shape[1::-1], Image.NEAREST)).astype(float)), 5)
    hsv = np.asarray(Image.fromarray(grass.astype('uint8')).convert('HSV')).astype(float)
    hsv[..., 0] = hsv[..., 0] * 0.3 + 38 * 0.7
    hsv[..., 1] = np.minimum(255, hsv[..., 1] * 1.05)
    hsv[..., 2] = np.minimum(255, hsv[..., 2] * 1.25)
    out = np.asarray(Image.fromarray(hsv.astype('uint8'), 'HSV').convert('RGB')).astype(float)
    return np.clip(out, 0, 255)


def seamless(rgb):
    """A square that tiles without mirroring: blended with itself shifted half a square, the shifted copy
    showing at the edges (where it runs on round the wrap) and the square itself in the middle."""
    h, w = rgb.shape[:2]
    shifted = np.roll(np.roll(rgb, h // 2, 0), w // 2, 1)
    yy, xx = np.mgrid[0:h, 0:w]
    weight = np.minimum(np.minimum(xx, w - 1 - xx) / (w / 2), np.minimum(yy, h - 1 - yy) / (h / 2))
    weight = np.clip(weight * 1.6, 0, 1)[..., None]
    return rgb * weight + shifted * (1 - weight)


def clumps(rgb, shades, contrast=1.8):
    """Pixel noise into drawn tufts, as HoMM2's ground is: a median over 3 pixels (wrapping, so it still
    tiles) turns static into little clumps, the contrast goes up so they read, and it's cut to a few
    flat shades of its own colours. No blur: every pixel stays sharp."""
    med = nd.median_filter(rgb, size=(3, 3, 1), mode='wrap')
    mean = med.reshape(-1, 3).mean(0)
    med = np.clip(mean + (med - mean) * contrast, 0, 255)
    flat = med.reshape(-1, 3)
    lum = flat @ [0.3, 0.59, 0.11]
    edges = np.quantile(lum, np.linspace(0, 1, shades + 1)[1:-1])
    band = np.searchsorted(edges, lum)
    out = np.zeros_like(flat)
    for k in range(shades):
        out[band == k] = np.median(flat[band == k], 0)
    return out.reshape(rgb.shape)


def foot(px):
    """How far below the top the piece stands: the bottom of its painted part, a little up."""
    rows = np.nonzero((px[..., 3] == 255).any(1))[0]
    return int(rows.max() - max(2, round(len(rows) * 0.08)))


def pick_colours(n=8):
    """The `n` colours to add to the palette (`MAP_COLOURS`): k-means in OKLab over the art's pixels the
    palette without them matches worst, weighted by how badly."""
    global COLORS, STEADY, LAB
    pixels = []
    for name, (sheet, box, width) in PIECES.items():
        if sheet not in CACHE:
            CACHE[sheet] = layers(sheet)
        a, back, shadow = CACHE[sheet]
        x0, y0, x1, y1 = box
        m = ~back[y0:y1, x0:x1] & ~shadow[y0:y1, x0:x1]
        pixels.append(a[y0:y1, x0:x1][m])
    os.makedirs(TROOPS_OUT, exist_ok=True)
    for name, (sheet, box, tall) in FIGURES.items():
        for size, k in (('battle', 1), ('map', 2 / 3 if name.startswith('hero') else 0.6)):
            px = cut(sheet, box, 0, name, height=round(tall * k))
            Image.fromarray(px).save(os.path.join(TROOPS_OUT, f'{name}-{size}.png'))
    for name, (x0, y0, x1, y1) in GROUND.items():
        pixels.append(np.asarray(Image.open(os.path.join(SHEETS, name + '.png')).convert('RGB')).astype(int)[y0:y1, x0:x1].reshape(-1, 3))
    px = np.concatenate(pixels).astype(float)
    base = [i for i in STEADY if i < len(COLORS) - len(MAP_NOW)]
    lab = oklab(px)
    base_lab = oklab(COLORS[base])
    err = np.zeros(len(lab))
    for s in range(0, len(lab), 8192):
        err[s:s + 8192] = ((lab[s:s + 8192, None] - base_lab[None]) ** 2).sum(2).min(1)
    # The worst-matched third, leaving out near-black (outlines have the palette's ink).
    worst = (err > np.quantile(err, 0.66)) & (lab[:, 0] > 0.2)
    pts, w = lab[worst], np.sqrt(err[worst])
    rng = np.random.default_rng(1)
    centres = pts[rng.choice(len(pts), n, replace=False, p=w / w.sum())]
    for _ in range(40):
        lab_ = ((pts[:, None] - centres[None]) ** 2).sum(2).argmin(1)
        for k in range(n):
            if (lab_ == k).any():
                centres[k] = (pts[lab_ == k] * w[lab_ == k, None]).sum(0) / w[lab_ == k].sum()
    # Back to sRGB through the pixels nearest each centre.
    out = []
    for c in centres:
        i = ((lab - c) ** 2).sum(1).argmin()
        out.append('#%02x%02x%02x' % tuple(int(v) for v in px[i]))
    return sorted(out, key=lambda h: int(h[1:3], 16) * 0.3 + int(h[3:5], 16) * 0.59 + int(h[5:7], 16) * 0.11)


def main():
    import sys
    if '--palette' in sys.argv:
        colours = pick_colours()
        with open(os.path.join(ROOT, 'src/render/mapPalette.ts'), 'w') as f:
            f.write('// Written by `npm run mapart -- --palette`: the colours the painted map (#178) adds to the palette.\n')
            f.write('export const MAP_COLOURS: readonly string[] = [' + ', '.join(f"'{c}'" for c in colours) + '];\n')
        print('palette:', colours, '(run it again without --palette to cut the pieces in it)')
        return
    os.makedirs(OUT, exist_ok=True)
    feet = {}
    for name, (sheet, box, width) in PIECES.items():
        px = cut(sheet, box, width, name)
        Image.fromarray(px).save(os.path.join(OUT, name + '.png'))
        feet[name] = foot(px)
    kinds = {}
    bright = [('groves', box, None) for box in GROVES] + [('conifers', box, kind) for box, kind in CONIFERS]
    for i, (sheet, box, kind) in enumerate(bright):
        if kind is None:
            kind = grove_kind(cut(sheet, box, box[2] - box[0], alone=True))
        px = cut(sheet, box, 0, height=TREE_HEIGHT[kind] + (i % 3 - 1) * 3, alone=True, cool=kind in ('fir', 'teal'))
        name = f'{kind}{len(kinds.get(kind, []))}'
        Image.fromarray(px).save(os.path.join(OUT, name + '.png'))
        feet[name] = foot(px) + 2
        kinds.setdefault(kind, []).append(name)
    os.makedirs(TROOPS_OUT, exist_ok=True)
    for name, (sheet, box, tall) in FIGURES.items():
        for size, k in (('battle', 1), ('map', 2 / 3 if name.startswith('hero') else 0.6)):
            px = cut(sheet, box, 0, name, height=round(tall * k))
            Image.fromarray(px).save(os.path.join(TROOPS_OUT, f'{name}-{size}.png'))
    for name, (x0, y0, x1, y1) in GROUND.items():
        rgb = np.asarray(Image.open(os.path.join(SHEETS, name + '.png')).convert('RGB')).astype(float)[y0:y1, x0:x1]
        # HoMM2's ground is bright and clean: lift the grass and the rest out of the murk the sheets came in.
        lift = {'grass': (1.3, 1.25), 'water': (1.25, 1.2), 'heath': (1.15, 1.1), 'dirt': (1.2, 1.15)}.get(name, (1.1, 1.05))
        hsv = np.asarray(Image.fromarray(rgb.astype('uint8')).convert('HSV')).astype(float)
        hsv[..., 2] = np.minimum(255, hsv[..., 2] * lift[0])
        hsv[..., 1] = np.minimum(255, hsv[..., 1] * lift[1])
        rgb = np.asarray(Image.fromarray(hsv.astype('uint8'), 'HSV').convert('RGB')).astype(float)
        rgb = seamless(rgb)
        if name == 'water':
            rgb = clumps(rgb, 6, contrast=3.0)
        elif name == 'heath':
            rgb = heath(rgb)
        elif name == 'heather':
            rgb = clumps(rgb, 7, contrast=1.2)
        else:
            rgb = clumps(rgb, 5 if name in ('grass', 'dirt') else 7)
        px = np.dstack([snap(rgb, land=True), np.full(rgb.shape[:2], 255)]).astype('uint8')
        Image.fromarray(px).save(os.path.join(OUT, 'ground-' + name + '.png'))
    pieces = ',\n'.join(f'  {n}: {f}' for n, f in feet.items())
    with open(os.path.join(ROOT, 'src/render/mapPieces.ts'), 'w') as f:
        f.write('// Written by `npm run mapart` (scripts/mapart.py): the map\'s pieces, and how far below its top each one stands.\n')
        f.write(f'export const PIECE_FEET = {{\n{pieces},\n}} as const;\n')
        f.write(f"export type PieceName = keyof typeof PIECE_FEET;\n")
        f.write("/** The bright trees (1 Oct), by kind: woods are grouped by kind, as HoMM2's are. */\n")
        f.write(f"export const GROVE_TREES = {json.dumps(kinds)} as const;\n")
        f.write(f"export const GROUNDS = {json.dumps(list(GROUND))} as const;\n")
        f.write(f"/** The troops and Aldric's figures, painted: in public/assets/troops/, each at battle and map size. */\nexport const FIGURES = {json.dumps(list(FIGURES))} as const;\n")
        f.write("export type GroundName = (typeof GROUNDS)[number];\n")
    print(f'{len(feet)} pieces and {len(GROUND)} grounds in {OUT}')


if __name__ == '__main__':
    main()
