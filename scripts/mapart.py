"""The map's art (#178): cuts each piece out of the sheets in art/map/sheets/, sizes it to the map's
scale, snaps it to the game's palette and writes it to public/assets/map/, with the list in
src/render/mapPieces.ts. Python 3 with Pillow, numpy and scipy:  npm run mapart

The sheets were made with Retro Diffusion (RD Pro, with HoMM2's map as the style reference) on 1 Oct
2026, at Artur's request: see public/assets/CREDITS.md. Each sheet is objects on one flat grey, their
shadows one flatter grey; the ground sheets are a framed square of seamless texture. The payday feast's
sheets (feast-1 to feast-4, #191) are cut into public/assets/feast/ at the size they were drawn.
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
    # The village sheet's rick is fine pale straw with no outline, and shrinking it turned it to mush (#311): the farm sheet's, crisp and outlined.
    'hayrick': ('farm', (5, 60, 63, 109), 38),
    'skeps': ('village', (9, 171, 72, 218), 44),
    'kiln': ('village', (93, 171, 159, 246), 50),
    'boat': ('village', (185, 176, 235, 207), 48),
    'pond': ('village', (185, 216, 247, 248), 60),
    'lodge': ('wild', (9, 13, 92, 84), 62),
    'mews': ('wild', (103, 26, 165, 75), 50),
    'butts': ('wild', (179, 31, 242, 73), 50),
    'stones': ('wild', (14, 99, 82, 158), 56),
    # One of the Grey Wethers on its own, at the size it was drawn: blown up, its pixels came out uneven (#311). The scroll stones' stone (#240).
    'menhir': ('wild', (30, 128, 47, 155), 16),
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
    # The Baron's hamper and a lost letter, painted (#311): they were drawn in code, flat beside the paintings.
    'hamper': ('finds', (8, 20, 84, 84), 26),
    'letter': ('finds', (9, 106, 78, 155), 16),
}
# The second batch (1 Oct, after Artur put the map beside HoMM2's): what makes each place a little scene.
# Farm things, waterside beds and reeds, rolling hills and outcrops, treasure, and the battle's own obstacles.
_more = {
    'farm': ['logPile', 'wagon', 'fence', 'haystack', 'barrels', 'crates', 'scarecrow', 'wellHouse', 'gazebo', 'fountain', None, 'garden'],
    'shore': ['bedPurple', 'bedPurple2', 'bedPink', 'bedPink2', 'bedRed', 'bedRed2', 'bedRed3', 'reeds', 'reeds2', 'reeds3', 'reeds4', 'lily', 'wetRock', 'wetRocks', 'wetRocks2', 'bedYellow', 'bedYellow2', 'driftLog'],
    'hills': ['hillSmall', 'hill', 'outcrop', 'hillWide', 'hillBig', 'outcrop2', 'outcrop3', 'rock', 'mound', 'mound2', 'peak'],
    'treasure': ['chestShut', 'chestGold', 'chestOpen', 'goldHeap', 'goldSmall', 'wood', 'ore', 'gems', None, 'crystals', 'lamp', 'cauldron', 'fire', 'bones'],
    # The battle's trees are painted bigger on their own sheet (#311), so they're never enlarged.
    'battle-trees': ['bOak', 'bOak2', 'bOak3', 'bFir', 'bFir2', 'bOak4'],
    'battle': [None, None, None, None, None, None, 'bRock', 'bRock2', 'bRock3', 'bRock4', 'bRock5', 'bBramble', 'bLog', 'bStump', 'bPond'],
}
_boxes = {
    'farm': [(7, 12, 63, 50), (79, 8, 169, 56), (183, 16, 247, 48), (5, 60, 63, 109), (85, 64, 144, 108), (181, 56, 245, 110), (12, 117, 59, 177), (73, 114, 125, 176), (169, 109, 246, 180), (5, 185, 64, 245), (72, 182, 156, 248), (163, 193, 249, 244)],
    'shore': [(6, 1, 108, 44), (123, 9, 242, 44), (6, 44, 109, 87), (123, 52, 242, 87), (7, 94, 72, 126), (77, 94, 142, 127), (146, 94, 200, 127), (204, 90, 248, 128), (4, 137, 44, 189), (52, 133, 97, 189), (101, 133, 141, 189), (153, 140, 195, 168), (206, 134, 246, 168), (148, 174, 197, 209), (203, 173, 251, 209), (7, 198, 67, 251), (73, 198, 134, 251), (148, 212, 247, 251)],
    'hills': [(13, 21, 56, 45), (75, 12, 168, 54), (190, 9, 250, 56), (9, 73, 105, 121), (122, 67, 250, 126), (12, 134, 87, 191), (99, 134, 180, 193), (195, 145, 245, 182), (9, 206, 87, 246), (102, 208, 174, 246), (189, 200, 250, 248)],
    'treasure': [(72, 14, 119, 56), (135, 9, 185, 57), (197, 11, 243, 57), (7, 75, 63, 119), (77, 81, 118, 113), (132, 74, 185, 116), (194, 75, 247, 115), (8, 137, 62, 178), (48, 168, 60, 178), (72, 133, 124, 178), (131, 137, 187, 175), (199, 129, 244, 183), (73, 190, 120, 244), (130, 197, 190, 241)],
    'battle-trees': [(2, 3, 83, 112), (90, 4, 171, 112), (173, 4, 253, 112), (11, 122, 76, 249), (99, 131, 160, 249), (173, 143, 253, 250)],
    'battle': [(3, 1, 61, 60), (67, 1, 125, 59), (132, 2, 187, 59), (198, 2, 249, 59), (13, 64, 50, 126), (78, 65, 115, 126), (133, 72, 183, 120), (198, 74, 246, 119), (6, 136, 54, 184), (70, 136, 118, 184), (138, 137, 182, 183), (198, 139, 247, 183), (10, 200, 117, 247), (131, 202, 186, 247), (194, 209, 254, 240)],
}
# Widths on the map (a tile is 32 px), and in battle for the battle's (a hex is 64 px across).
_widths = {
    'logPile': 26, 'wagon': 40, 'fence': 30, 'haystack': 24, 'barrels': 18, 'crates': 20, 'scarecrow': 14, 'wellHouse': 22, 'gazebo': 34, 'fountain': 28, 'garden': 36,
    'bedPurple': 46, 'bedPurple2': 50, 'bedPink': 44, 'bedPink2': 50, 'bedRed': 30, 'bedRed2': 30, 'bedRed3': 26, 'reeds': 18, 'reeds2': 16, 'reeds3': 18, 'reeds4': 16,
    'lily': 12, 'wetRock': 18, 'wetRocks': 22, 'wetRocks2': 22, 'bedYellow': 26, 'bedYellow2': 26, 'driftLog': 40,
    'hillSmall': 36, 'hill': 70, 'outcrop': 44, 'hillWide': 76, 'hillBig': 100, 'outcrop2': 52, 'outcrop3': 54, 'rock': 24, 'mound': 50, 'mound2': 46, 'peak': 50,
    'chestShut': 24, 'chestGold': 26, 'chestOpen': 24, 'goldHeap': 28, 'goldSmall': 20, 'wood': 28, 'ore': 26, 'gems': 26, 'crystals': 24, 'lamp': 20, 'cauldron': 24, 'fire': 24, 'bones': 30,
    # The battle's pieces never wider than they were painted (#311): enlarged, their pixels doubled unevenly.
    'bOak': 64, 'bOak2': 64, 'bOak3': 62, 'bOak4': 62, 'bFir': 42, 'bFir2': 38, 'bRock': 50, 'bRock2': 48, 'bRock3': 48, 'bRock4': 48, 'bRock5': 44, 'bBramble': 49, 'bLog': 107, 'bStump': 52, 'bPond': 60,
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
    'peasants': ('units-a', (19, 19, 78, 124), 66), 'archers': ('units-a', (99, 20, 157, 125), 64), 'knights': ('knights-rest', (0, 0, 133, 128), 104),
    'swordsmen': ('units-a', (10, 128, 79, 252), 68), 'crossbowmen': ('units-a', (95, 140, 171, 252), 68), 'wolves': ('units-a', (167, 171, 249, 252), 44),
    'baron': ('units-b', (10, 9, 83, 124), 82), 'goblins': ('units-b', (96, 42, 174, 124), 48), 'trolls': ('units-b', (178, 7, 244, 124), 86),
    'witch': ('units-b', (22, 145, 84, 249), 70), 'bramble': ('units-b', (97, 131, 167, 249), 82), 'poachers': ('units-b', (177, 147, 250, 250), 64),
    'bandits': ('units-c', (8, 13, 83, 124), 64), 'boars': ('units-c', (163, 45, 253, 119), 42), 'bears': ('units-c', (0, 158, 98, 250), 60),
    'huntsmen': ('units-c', (96, 130, 170, 252), 66), 'heroKnight': ('units-c', (170, 118, 256, 255), 96),
    'heroWizard': ('units-d', (13, 8, 82, 124), 72), 'heroRanger': ('units-d', (98, 14, 170, 125), 72), 'heroCourtier': ('units-d', (178, 6, 243, 125), 72),
    'rook': ('units-d', (170, 138, 254, 252), 68),
    # The troops and captains that came later (#255), drawn the same way: the outlaws and Darkwood's spiders (units-e).
    'cutpurses': ('units-e', (12, 25, 81, 128), 62), 'cutpurseCaptain': ('units-e', (94, 14, 161, 129), 68), 'highwaymanCaptain': ('units-e', (181, 8, 243, 129), 70),
    'poacherCaptain': ('units-e', (13, 132, 82, 250), 69), 'spiders': ('units-e', (80, 172, 170, 245), 50),
    # And the Baron's men, in his red and gold (units-f). The sergeant's sword, Pike's halberd and the Foreman's pick rise over their heads.
    'pikemen': ('units-f', (0, 7, 106, 127), 67), 'menAtArms': ('units-f', (101, 2, 159, 129), 71), 'sergeant': ('units-f', (174, 0, 242, 128), 76),
    'pike': ('units-f', (16, 128, 82, 256), 76), 'picketCaptain': ('units-f', (97, 136, 154, 256), 71), 'foreman': ('units-f', (185, 128, 255, 256), 76),
}
FIGURES['hero'] = FIGURES['heroKnight']
# Figures drawn bigger in battle than their standing painting (#310): their battle poses are cut from the sheet at
# that size (#311), never enlarged pixel by pixel as the game runs. Their standing painting keeps its size for the UI.
BATTLE_SIZE = {'heroWizard': 1.3}
TROOPS_OUT = os.path.join(ROOT, 'public/assets/troops')
# One scale for the whole body, not one fitted to each pose's weapon bounds. Boxes and feet are
# absolute sheet pixels; the cutter gives every frame of an animation the same canvas and anchor.
FIGURE_ANIMATIONS = {
    'trolls': {
        'move': {
            'sheet': 'map-trolls-move-atlas', 'scale': 86 / 117, 'sizes': ['map'],
            'frames': [
                ((29, 5, 100, 127), (64, 123), 100),
                ((157, 5, 228, 126), (192, 122), 100),
                ((29, 133, 100, 255), (64, 251), 100),
                ((157, 133, 228, 255), (192, 251), 100),
            ],
            'stride': 36, 'footfalls': [0, 200],
        },
        'idle': {
            'sheet': 'map-trolls-idle-atlas', 'scale': 86 / 117, 'sizes': ['map'],
            'frames': [
                ((29, 5, 100, 127), (64, 123), 2160),
                ((157, 5, 228, 127), (192, 123), 240),
                ((29, 133, 101, 255), (64, 251), 240),
                ((157, 133, 228, 255), (192, 251), 1440),
            ],
        },
    },
    'pikemen': {
        'move': {
            'sheet': 'map-pikemen-move-edit', 'scale': 67 / 116, 'sizes': ['map'],
            'frames': [
                ((8, 7, 119, 128), (45, 125), 100),
                ((136, 8, 247, 127), (173, 123), 100),
                ((8, 135, 119, 256), (45, 253), 100),
                ((136, 136, 247, 255), (173, 251), 100),
            ],
            'stride': 40, 'footfalls': [0, 200],
        },
        'idle': {
            'sheet': 'map-pikemen-idle-edit', 'scale': 67 / 116, 'sizes': ['map'],
            'frames': [
                ((8, 10, 119, 128), (45, 125), 2040),
                ((136, 10, 247, 128), (173, 125), 240),
                ((8, 137, 119, 256), (45, 253), 240),
                ((136, 137, 247, 256), (173, 253), 1200),
            ],
        },
    },
    'bears': {
        'move': {
            'sheet': 'map-bears-edit', 'scale': 60 / 73, 'sizes': ['map'],
            'frames': [
                ((0, 3, 85, 82), (43, 78), 100),
                ((84, 3, 171, 80), (128, 76), 100),
                ((170, 3, 256, 82), (213, 78), 100),
                ((0, 89, 85, 167), (43, 163), 100),
            ],
            'stride': 38, 'footfalls': [0, 200],
        },
        'idle': {
            'sheet': 'map-bears-edit', 'scale': 60 / 73, 'sizes': ['map'],
            'frames': [((86, 176, 171, 253), (128, 249), 2160), ((170, 177, 256, 253), (213, 249), 600)],
        },
    },
    'goblins': {
        'move': {
            'sheet': 'map-goblins-edit', 'scale': 48 / 116, 'sizes': ['map'],
            'frames': [
                ((0, 3, 101, 127), (44, 123), 100),
                ((87, 3, 183, 127), (129, 123), 100),
                ((165, 3, 256, 127), (214, 123), 100),
                ((0, 133, 106, 256), (44, 255), 100),
            ],
            'stride': 30, 'footfalls': [0, 200],
        },
        'idle': {
            'sheet': 'map-goblins-edit', 'scale': 48 / 116, 'sizes': ['map'],
            'frames': [((95, 128, 171, 256), (129, 256), 1560), ((177, 129, 253, 256), (214, 256), 480)],
        },
    },
    'huntsmen': {
        'move': {
            'sheet': 'map-huntsmen', 'scale': 66 / 109, 'sizes': ['map'],
            'frames': [
                ((11, 9, 88, 124), (46, 119), 100),
                ((96, 9, 172, 124), (131, 120), 100),
                ((177, 9, 254, 123), (215, 119), 100),
                ((14, 137, 89, 253), (46, 248), 100),
            ],
            'stride': 40, 'footfalls': [0, 200],
        },
        'idle': {
            'sheet': 'map-huntsmen', 'scale': 66 / 109, 'sizes': ['map'],
            'frames': [((95, 137, 172, 253), (131, 249), 2040), ((176, 137, 253, 253), (215, 249), 480)],
        },
    },
    'archers': {
        'move': {
            'sheet': 'map-archers', 'scale': 64 / 108, 'sizes': ['map'],
            'frames': [
                ((15, 11, 92, 124), (48, 120), 100),
                ((101, 11, 175, 124), (133, 120), 100),
                ((182, 11, 256, 124), (216, 120), 100),
                ((16, 138, 85, 252), (48, 248), 100),
            ],
            'stride': 42, 'footfalls': [0, 200],
        },
        'idle': {
            'sheet': 'map-archers-idle-atlas', 'scale': 64 / 105, 'sizes': ['map'],
            'frames': [
                ((33, 17, 96, 127), (64, 123), 1920),
                ((161, 17, 225, 127), (192, 123), 240),
                ((33, 145, 96, 255), (64, 251), 240),
                ((161, 145, 224, 255), (192, 251), 1200),
            ],
        },
        'ranged': {
            'sheet': 'battle-archers-ranged', 'scale': 64 / 103, 'sizes': ['battle'],
            'frames': [
                ((26, 15, 97, 128), (64, 123), 140),
                ((146, 0, 235, 128), (181, 123), 220),
                ((27, 127, 109, 256), (64, 251), 120),
                ((160, 143, 225, 256), (192, 251), 240),
            ],
            'hit': 360, 'launch': (38, -70),
        },
    },
    'swordsmen': {
        'move': {
            'sheet': 'map-swordsmen', 'scale': 68 / 118, 'sizes': ['map'],
            'frames': [
                ((9, 3, 81, 125), (45, 121), 100),
                ((92, 3, 163, 127), (128, 123), 100),
                ((178, 3, 249, 125), (213, 121), 100),
                ((9, 127, 81, 252), (45, 247), 100),
            ],
            'stride': 42, 'footfalls': [0, 200],
        },
        'idle': {
            'sheet': 'map-swordsmen', 'scale': 68 / 118, 'sizes': ['map'],
            'frames': [((89, 127, 161, 256), (128, 252), 2040), ((179, 130, 248, 256), (213, 252), 360)],
        },
        'melee': {
            'sheet': 'battle-swordsmen-melee', 'scale': 68 / 117, 'sizes': ['battle'],
            'frames': [
                ((8, 1, 81, 128), (45, 122), 140),
                ((83, 1, 164, 128), (128, 125), 100),
                ((9, 128, 100, 256), (45, 252), 120),
                ((178, 128, 249, 256), (213, 252), 220),
            ],
            'hit': 240,
        },
    },
    'crossbowmen': {
        'move': {
            'sheet': 'map-crossbowmen-edit', 'scale': 68 / 113, 'sizes': ['map'],
            'frames': [
                ((11, 10, 90, 128), (48, 121), 100),
                ((94, 10, 174, 128), (132, 125), 100),
                ((177, 10, 255, 128), (216, 120), 100),
                ((13, 140, 92, 253), (48, 247), 100),
            ],
            'stride': 38, 'footfalls': [0, 200],
        },
        'idle': {
            'sheet': 'map-crossbowmen-edit', 'scale': 68 / 113, 'sizes': ['map'],
            'frames': [((95, 141, 174, 256), (132, 253), 1920), ((179, 141, 255, 256), (216, 252), 480)],
        },
    },
    'menAtArms': {
        'move': {
            'sheet': 'map-menAtArms', 'scale': 71 / 117, 'sizes': ['map'],
            'frames': [
                ((16, 2, 79, 124), (45, 120), 100),
                ((104, 2, 164, 125), (130, 121), 100),
                ((182, 2, 250, 125), (215, 121), 100),
                ((16, 130, 78, 253), (45, 249), 100),
            ],
            'stride': 40, 'footfalls': [0, 200],
        },
        'idle': {
            'sheet': 'map-menAtArms', 'scale': 71 / 117, 'sizes': ['map'],
            'frames': [((102, 130, 160, 255), (130, 251), 2160), ((187, 132, 246, 255), (215, 251), 360)],
        },
    },
    'sergeant': {
        'move': {
            'sheet': 'map-sergeant', 'scale': 0.62, 'sizes': ['map'],
            'frames': [
                ((2, 0, 77, 127), (45, 123), 100),
                ((98, 5, 164, 128), (130, 125), 100),
                ((174, 0, 246, 128), (215, 124), 100),
                ((14, 128, 84, 255), (45, 251), 100),
            ],
            'stride': 42, 'footfalls': [0, 200],
        },
        'idle': {
            'sheet': 'map-sergeant', 'scale': 0.62, 'sizes': ['map'],
            'frames': [((103, 130, 156, 256), (130, 254), 1800), ((188, 132, 240, 256), (215, 255), 480)],
        },
    },
    'pike': {
        'move': {
            'sheet': 'map-pike', 'scale': 0.67, 'sizes': ['map'],
            'frames': [
                ((19, 2, 87, 125), (47, 121), 100),
                ((109, 1, 171, 126), (132, 122), 100),
                ((187, 2, 254, 125), (216, 121), 100),
                ((27, 129, 87, 255), (47, 251), 100),
            ],
            'stride': 40, 'footfalls': [0, 200],
        },
        'idle': {
            'sheet': 'map-pike', 'scale': 0.67, 'sizes': ['map'],
            'frames': [((109, 129, 166, 254), (132, 250), 2280), ((195, 129, 250, 255), (216, 251), 360)],
        },
    },
    'picketCaptain': {
        'move': {
            'sheet': 'map-picketCaptain', 'scale': 71 / 113, 'sizes': ['map'],
            'frames': [
                ((12, 9, 76, 126), (45, 122), 100),
                ((99, 10, 159, 127), (130, 123), 100),
                ((182, 9, 243, 126), (215, 122), 100),
                ((12, 133, 77, 251), (45, 247), 100),
            ],
            'stride': 42, 'footfalls': [0, 200],
        },
        'idle': {
            'sheet': 'map-picketCaptain', 'scale': 71 / 113, 'sizes': ['map'],
            'frames': [((98, 133, 158, 253), (130, 249), 2040), ((183, 133, 242, 253), (215, 249), 480)],
        },
    },
    'foreman': {
        'move': {
            'sheet': 'map-foreman', 'scale': 0.62, 'sizes': ['map'],
            'frames': [
                ((12, 0, 86, 123), (47, 117), 100),
                ((98, 0, 170, 123), (132, 119), 100),
                ((180, 0, 255, 123), (216, 119), 100),
                ((17, 127, 88, 256), (47, 252), 100),
            ],
            'stride': 38, 'footfalls': [0, 200],
        },
        'idle': {
            'sheet': 'map-foreman', 'scale': 0.62, 'sizes': ['map'],
            'frames': [((101, 127, 173, 256), (132, 253), 1920), ((185, 128, 256, 256), (216, 253), 360)],
        },
    },
    'peasants': {
        'move': {
            'sheet': 'map-peasants', 'scale': 66 / 104, 'sizes': ['map'],
            'frames': [
                ((18, 18, 81, 128), (45, 124), 100),
                ((101, 18, 168, 124), (130, 120), 100),
                ((183, 18, 254, 125), (215, 121), 100),
                ((19, 145, 83, 253), (45, 249), 100),
            ],
            'stride': 36, 'footfalls': [0, 200],
        },
        'idle': {
            'sheet': 'map-peasants', 'scale': 66 / 104, 'sizes': ['map'],
            'frames': [((102, 142, 167, 254), (130, 250), 1680), ((185, 142, 250, 253), (215, 249), 480)],
        },
    },
    'baron': {
        'move': {
            'sheet': 'map-baron', 'scale': 82 / 100, 'sizes': ['map'],
            'frames': [
                ((5, 7, 68, 112), (36, 107), 100),
                ((69, 7, 131, 112), (99, 108), 100),
                ((131, 7, 194, 113), (162, 109), 100),
                ((192, 7, 254, 113), (225, 109), 100),
            ],
            'stride': 38, 'footfalls': [0, 200],
        },
        'idle': {
            'sheet': 'map-baron', 'scale': 82 / 108, 'sizes': ['map'],
            'frames': [((15, 137, 87, 252), (51, 247), 2400), ((97, 137, 168, 252), (134, 247), 480)],
        },
    },
    'boars': {
        'move': {
            'sheet': 'map-boars', 'scale': 42 / 77, 'sizes': ['map'],
            'frames': [
                ((8, 2, 121, 84), (64, 80), 100),
                ((135, 2, 251, 81), (192, 77), 100),
                ((8, 84, 121, 169), (64, 165), 100),
                ((139, 85, 252, 165), (192, 161), 100),
            ],
            'stride': 36, 'footfalls': [0, 200],
        },
        'idle': {
            'sheet': 'map-boars', 'scale': 42 / 77, 'sizes': ['map'],
            'frames': [((4, 172, 120, 254), (64, 250), 1800), ((129, 172, 256, 254), (192, 250), 480)],
        },
    },
    'spiders': {
        'move': {
            'sheet': 'map-spiders', 'scale': 0.65, 'sizes': ['map'],
            'frames': [
                ((7, 2, 127, 89), (64, 85), 100),
                ((129, 1, 255, 85), (192, 81), 100),
                ((3, 86, 128, 170), (64, 166), 100),
                ((131, 86, 255, 173), (192, 169), 100),
            ],
            'stride': 32, 'footfalls': [0, 100, 200, 300],
        },
        'idle': {
            'sheet': 'map-spiders', 'scale': 0.78, 'sizes': ['map'],
            'frames': [((86, 172, 170, 248), (128, 243), 1560), ((169, 172, 255, 248), (212, 243), 480)],
        },
    },
    'witch': {
        'move': {
            'sheet': 'map-witch', 'scale': 70 / 110, 'sizes': ['map'],
            'frames': [
                ((15, 8, 85, 124), (46, 120), 100),
                ((98, 8, 171, 124), (131, 120), 100),
                ((183, 8, 254, 124), (215, 120), 100),
                ((18, 137, 87, 248), (46, 244), 100),
            ],
            'stride': 38, 'footfalls': [0, 200],
        },
        'idle': {
            'sheet': 'map-witch', 'scale': 70 / 110, 'sizes': ['map'],
            'frames': [((105, 137, 172, 249), (131, 245), 2160), ((188, 137, 254, 249), (215, 245), 480)],
        },
    },
    'bramble': {
        'move': {
            'sheet': 'map-bramble', 'scale': 82 / 116, 'sizes': ['map'],
            'frames': [
                ((7, 4, 83, 126), (45, 122), 100),
                ((90, 4, 168, 124), (130, 120), 100),
                ((173, 8, 250, 125), (215, 121), 100),
                ((8, 129, 85, 250), (45, 246), 100),
            ],
            'stride': 40, 'footfalls': [0, 200],
        },
        'idle': {
            'sheet': 'map-bramble', 'scale': 82 / 116, 'sizes': ['map'],
            'frames': [((96, 130, 170, 252), (130, 248), 2400), ((174, 136, 250, 252), (215, 248), 600)],
        },
    },
    'cutpurseCaptain': {
        'move': {
            'sheet': 'map-cutpurseCaptain', 'scale': 68 / 109, 'sizes': ['map'],
            'frames': [
                ((11, 11, 78, 125), (43, 121), 100),
                ((95, 11, 165, 126), (128, 123), 100),
                ((178, 11, 245, 125), (212, 121), 100),
                ((11, 136, 79, 248), (43, 244), 100),
            ],
            'stride': 40, 'footfalls': [0, 200],
        },
        'idle': {
            'sheet': 'map-cutpurseCaptain', 'scale': 68 / 109, 'sizes': ['map'],
            'frames': [((95, 137, 163, 251), (128, 247), 1920), ((178, 137, 242, 251), (212, 247), 360)],
        },
    },
    'cutpurses': {
        'move': {
            'sheet': 'map-cutpurses', 'scale': 62 / 107, 'sizes': ['map'],
            'frames': [
                ((5, 8, 64, 123), (33, 117), 100),
                ((72, 8, 125, 123), (97, 119), 100),
                ((133, 8, 191, 123), (160, 117), 100),
                ((196, 8, 251, 123), (225, 118), 100),
            ],
            'stride': 32, 'footfalls': [0, 200],
        },
        'idle': {
            'sheet': 'map-cutpurses', 'scale': 62 / 107, 'sizes': ['map'],
            'frames': [((11, 134, 65, 251), (35, 246), 1680), ((81, 135, 125, 251), (102, 247), 360)],
        },
    },
    'highwaymanCaptain': {
        'move': {
            'sheet': 'map-highwaymanCaptain', 'scale': 70 / 117, 'sizes': ['map'],
            'frames': [
                ((12, 8, 77, 128), (43, 127), 100),
                ((94, 9, 162, 128), (128, 127), 100),
                ((181, 8, 245, 128), (213, 127), 100),
                ((13, 135, 77, 256), (43, 251), 100),
            ],
            'stride': 44, 'footfalls': [0, 200],
        },
        'idle': {
            'sheet': 'map-highwaymanCaptain', 'scale': 70 / 117, 'sizes': ['map'],
            'frames': [((99, 131, 162, 254), (128, 251), 2160), ((181, 135, 244, 254), (213, 251), 360)],
        },
    },
    'bandits': {
        'move': {
            'sheet': 'map-bandits', 'scale': 64 / 113, 'sizes': ['map'],
            'frames': [
                ((5, 6, 80, 125), (43, 122), 100),
                ((93, 6, 165, 125), (128, 121), 100),
                ((178, 6, 251, 124), (213, 120), 100),
                ((10, 134, 80, 253), (43, 249), 100),
            ],
            'stride': 40, 'footfalls': [0, 200],
        },
        'idle': {
            'sheet': 'map-bandits', 'scale': 64 / 113, 'sizes': ['map'],
            'frames': [((101, 134, 166, 253), (128, 249), 1800), ((186, 134, 251, 254), (213, 250), 360)],
        },
    },
    'poacherCaptain': {
        'move': {
            'sheet': 'map-poacherCaptain', 'scale': 69 / 118, 'sizes': ['map'],
            'frames': [
                ((10, 9, 85, 128), (46, 127), 100),
                ((93, 9, 168, 128), (130, 127), 100),
                ((175, 9, 251, 128), (213, 127), 100),
                ((11, 132, 82, 255), (46, 252), 100),
            ],
            'stride': 42, 'footfalls': [0, 200],
        },
        'idle': {
            'sheet': 'map-poacherCaptain', 'scale': 69 / 118, 'sizes': ['map'],
            'frames': [((97, 132, 168, 255), (130, 252), 2040), ((178, 132, 250, 255), (213, 252), 360)],
        },
    },
    'poachers': {
        'move': {
            'sheet': 'map-poachers', 'scale': 64 / 109, 'sizes': ['map'],
            'frames': [
                ((3, 8, 85, 124), (43, 119), 100),
                ((85, 8, 171, 124), (128, 120), 100),
                ((172, 8, 255, 124), (213, 120), 100),
                ((8, 145, 85, 252), (43, 248), 100),
            ],
            'stride': 40, 'footfalls': [0, 200],
        },
        'idle': {
            'sheet': 'map-poachers', 'scale': 64 / 109, 'sizes': ['map'],
            'frames': [((92, 145, 169, 253), (128, 248), 1800), ((176, 146, 253, 254), (213, 249), 480)],
        },
    },
    'rook': {
        'move': {
            'sheet': 'map-rook', 'scale': 68 / 112, 'sizes': ['map'],
            'frames': [
                ((0, 8, 85, 124), (43, 121), 100),
                ((85, 8, 170, 124), (128, 121), 100),
                ((170, 8, 255, 124), (213, 120), 100),
                ((0, 136, 85, 254), (43, 250), 100),
            ],
            'stride': 42, 'footfalls': [0, 200],
        },
        'idle': {
            'sheet': 'map-rook', 'scale': 68 / 112, 'sizes': ['map'],
            'frames': [((85, 137, 170, 255), (128, 251), 1920), ((170, 137, 256, 255), (213, 251), 480)],
        },
    },
    'wolves': {
        'move': {
            'sheet': 'map-wolves', 'scale': 44 / 73, 'sizes': ['map'],
            'frames': [
                ((0, 1, 85, 79), (43, 76), 100),
                ((84, 1, 171, 79), (128, 75), 100),
                ((170, 1, 256, 79), (213, 75), 100),
                ((0, 87, 85, 167), (43, 160), 100),
            ],
            'stride': 40, 'footfalls': [0, 200],
        },
        'idle': {
            'sheet': 'map-wolves', 'scale': 44 / 73, 'sizes': ['map'],
            'frames': [((90, 174, 170, 254), (128, 250), 1560), ((164, 176, 254, 254), (213, 250), 480)],
        },
        'melee': {
            'sheet': 'battle-wolves-melee', 'scale': 44 / 73, 'sizes': ['battle'],
            'frames': [
                ((0, 7, 128, 85), (64, 81), 120),
                ((128, 0, 256, 85), (192, 80), 100),
                ((0, 89, 128, 172), (64, 166), 100),
                ((162, 172, 256, 256), (213, 251), 220),
            ],
            'hit': 220,
        },
    },
    'knights': {
        'stand': {
            'sheet': 'knights-rest', 'scale': 0.86, 'sizes': ['battle', 'map'],
            'frames': [((0, 0, 133, 128), (63, 122), 100)],
        },
        'idle': {
            'sheet': 'knights-rest', 'scale': 0.86, 'sizes': ['battle', 'map'],
            'frames': [
                ((0, 0, 133, 128), (63, 122), 1200),
                ((128, 0, 256, 128), (191, 121), 200),
                ((0, 128, 133, 256), (63, 252), 200),
                ((128, 128, 256, 256), (191, 253), 1200),
            ],
        },
        'move': {
            'sheet': 'knights-gait', 'scale': 0.86, 'sizes': ['battle', 'map'],
            'frames': [
                ((0, 0, 133, 128), (63, 117), 90),
                ((128, 0, 256, 128), (191, 117), 90),
                ((0, 128, 133, 256), (63, 245), 90),
                ((128, 128, 256, 256), (191, 245), 90),
            ],
            'stride': 64, 'footfalls': [0, 180],
        },
        'melee': {
            'sheet': 'knights-lance-melee', 'scale': 0.86, 'sizes': ['battle'],
            'frames': [
                ((0, 0, 133, 128), (63, 117), 140),
                ((128, 0, 256, 128), (191, 117), 100),
                ((0, 128, 133, 256), (63, 245), 100),
                ((128, 128, 256, 256), (191, 245), 200),
            ],
            'hit': 240,
        },
        'charge': {
            'sheet': 'knights-charge-sequence', 'scale': 0.86, 'sizes': ['battle'],
            'frames': [
                ((0, 0, 133, 128), (63, 117), 80),
                ((128, 0, 256, 128), (191, 117), 80),
                ((0, 128, 133, 256), (63, 245), 80),
                ((128, 128, 256, 256), (191, 245), 80),
                ((0, 256, 133, 384), (63, 373), 100),
                ((128, 256, 256, 384), (191, 373), 220),
            ],
            'hit': 320, 'footfalls': [0, 160],
        },
    },
    'heroWizard': {
        'move': {
            'sheet': 'wizard-walk-2', 'scale': 72 / 116, 'sizes': ['map'],
            'frames': [
                ((12, 7, 83, 126), (47, 124), 100),
                ((96, 6, 170, 126), (132, 124), 100),
                ((180, 6, 254, 126), (216, 124), 100),
                ((13, 132, 85, 252), (48, 250), 100),
                ((97, 131, 170, 252), (132, 250), 100),
                ((181, 131, 253, 252), (216, 249), 100),
            ],
            'stride': 48, 'footfalls': [100, 400],
        },
        'idle': {
            'sheet': 'map-wizard-idle-edit', 'scale': 72 / 116, 'sizes': ['map'],
            'frames': [
                ((12, 7, 83, 126), (47, 124), 1680),
                ((96, 6, 170, 126), (132, 124), 240),
                ((180, 6, 254, 126), (216, 124), 240),
                ((13, 131, 85, 252), (48, 249), 240),
                ((97, 131, 170, 252), (132, 248), 240),
                ((180, 131, 253, 252), (216, 249), 1200),
            ],
        },
        'cast': {
            'sheet': 'battle-wizard-cast', 'scale': 72 / 115, 'sizes': ['battle'],
            'frames': [
                ((11, 5, 85, 128), (47, 124), 140),
                ((97, 5, 172, 128), (132, 124), 180),
                ((0, 129, 99, 252), (47, 248), 140),
                ((183, 129, 255, 252), (216, 248), 180),
            ],
            'hit': 320, 'launch': (45, -110),
        },
    },
    'heroRanger': {
        'move': {
            'sheet': 'map-ranger-move', 'scale': 72 / 107, 'sizes': ['map'],
            'frames': [
                ((11, 13, 85, 124), (47, 121), 100),
                ((94, 13, 171, 124), (132, 120), 100),
                ((178, 13, 255, 124), (216, 122), 100),
                ((11, 138, 86, 250), (47, 247), 100),
                ((93, 138, 171, 250), (132, 247), 100),
                ((169, 138, 255, 250), (216, 247), 100),
            ],
            'stride': 44, 'footfalls': [100, 400],
        },
        'idle': {
            'sheet': 'map-ranger-idle', 'scale': 72 / 117, 'sizes': ['map'],
            'frames': [
                ((28, 7, 110, 126), (67, 124), 1920),
                ((153, 7, 236, 126), (192, 124), 240),
                ((28, 133, 110, 256), (67, 253), 240),
                ((153, 133, 236, 256), (192, 253), 1200),
            ],
        },
        'ranged': {
            'sheet': 'battle-ranger-ranged', 'scale': 72 / 118, 'sizes': ['battle'],
            'frames': [
                ((24, 4, 118, 128), (66, 124), 160),
                ((152, 0, 247, 128), (185, 124), 220),
                ((25, 127, 116, 256), (66, 253), 140),
                ((150, 131, 239, 256), (192, 253), 240),
            ],
            'hit': 380, 'launch': (43, -71),
        },
    },
    'heroCourtier': {
        'move': {
            'sheet': 'map-courtier-move', 'scale': 72 / 113, 'sizes': ['map'],
            'frames': [
                ((7, 6, 75, 124), (43, 121), 100),
                ((91, 8, 159, 124), (127, 121), 100),
                ((180, 9, 245, 124), (211, 121), 100),
                ((7, 133, 75, 251), (43, 247), 100),
                ((91, 135, 160, 251), (127, 248), 100),
                ((177, 133, 245, 251), (211, 247), 100),
            ],
            'stride': 42, 'footfalls': [100, 400],
        },
        'idle': {
            'sheet': 'map-courtier-idle', 'scale': 72 / 117, 'sizes': ['map'],
            'frames': [
                ((5, 5, 73, 127), (41, 124), 1440),
                ((177, 7, 245, 127), (211, 124), 240),
                ((5, 134, 73, 255), (41, 252), 240),
                ((177, 132, 245, 255), (211, 252), 1200),
            ],
        },
        'cast': {
            'sheet': 'battle-courtier-cast', 'scale': 72 / 117, 'sizes': ['battle'],
            'frames': [
                ((4, 3, 79, 128), (41, 124), 140),
                ((89, 4, 160, 128), (127, 124), 180),
                ((5, 132, 98, 256), (41, 252), 140),
                ((177, 130, 246, 256), (211, 252), 180),
            ],
            'hit': 320, 'launch': (50, -81),
        },
    },
    'heroKnight': {
        'stand': {
            'sheet': 'map-hero-knight-idle-edit', 'scale': 0.78, 'sizes': ['battle'],
            'frames': [((0, 0, 118, 123), (64, 120), 100)],
        },
        'move': {
            'sheet': 'map-hero-knight-move', 'scale': 0.78, 'sizes': ['map', 'battle'],
            'frames': [
                ((0, 0, 118, 123), (64, 119), 90),
                ((128, 0, 248, 123), (192, 119), 90),
                ((0, 125, 120, 252), (64, 248), 90),
                ((128, 125, 249, 252), (192, 247), 90),
            ],
            'stride': 64, 'footfalls': [0, 180],
        },
        'idle': {
            'sheet': 'map-hero-knight-idle-edit', 'scale': 0.78, 'sizes': ['map', 'battle'],
            'frames': [
                ((0, 0, 118, 123), (64, 120), 1800),
                ((128, 0, 248, 123), (192, 120), 240),
                ((0, 125, 120, 254), (64, 249), 240),
                ((128, 125, 249, 254), (192, 250), 1440),
            ],
        },
        'melee': {
            'sheet': 'hero-knight-lance-sequence', 'scale': 0.78, 'sizes': ['battle'],
            'frames': [
                ((0, 0, 170, 128), (64, 120), 140),
                ((0, 128, 170, 256), (64, 248), 100),
                ((0, 256, 170, 384), (64, 377), 100),
                ((0, 384, 170, 512), (64, 509), 200),
            ],
            'hit': 240,
        },
    },
}
FIGURE_ANIMATIONS['heroWizard']['ranged'] = FIGURE_ANIMATIONS['heroWizard']['cast']
# Battle reuses the inspected map bodies and rests on their grounded idle, never on a gait cell.
for _name, _poses in FIGURE_ANIMATIONS.items():
    for _anim in ('move', 'idle'):
        if 'battle' not in _poses[_anim]['sizes']:
            _poses[_anim]['sizes'].append('battle')
    if 'stand' not in _poses:
        _idle = _poses['idle']
        _poses['stand'] = {**_idle, 'sizes': ['battle'], 'frames': [(*_idle['frames'][0][:2], 100)]}

# These atlases pack inspected new poses with the existing grounded rests, already at battle scale.
for _name in ('swordsmen', 'wolves', 'archers', 'peasants', 'crossbowmen', 'pikemen', 'menAtArms',
              'goblins', 'trolls', 'poachers', 'bandits', 'boars', 'bears', 'huntsmen', 'cutpurses', 'spiders'):
    for _anim, _times in (('defend', (160, 160)), ('death', (80, 220, 200))):
        _poses = {
            'sheet': f'battle-{_name}-{_anim}-sequence', 'scale': 1, 'sizes': ['battle'],
            'frames': [
                ((i % 2 * 128, i // 2 * 128, i % 2 * 128 + 128, i // 2 * 128 + 128),
                 (i % 2 * 128 + 64, i // 2 * 128 + 124), ms)
                for i, ms in enumerate(_times)
            ],
        }
        if _anim == 'death':
            _poses['hit'] = 300
        FIGURE_ANIMATIONS[_name][_anim] = _poses
    FIGURE_ANIMATIONS[_name]['defendRanged'] = FIGURE_ANIMATIONS[_name]['defend']
    if _name not in ('swordsmen', 'wolves'):
        FIGURE_ANIMATIONS[_name]['melee'] = {
            'sheet': f'battle-{_name}-melee-sequence', 'scale': 1, 'sizes': ['battle'],
            'frames': [
                ((0, 0, 128, 128), (64, 124), 120),
                ((128, 0, 256, 128), (192, 124), 140),
                ((0, 128, 128, 256), (64, 252), 120),
                ((128, 128, 256, 256), (192, 252), 220),
            ],
            'hit': 260,
        }
FIGURE_ANIMATIONS['crossbowmen']['ranged'] = {
    'sheet': 'battle-crossbowmen-ranged-sequence', 'scale': 1, 'sizes': ['battle'],
    'frames': [
        ((0, 0, 128, 128), (64, 124), 140),
        ((128, 0, 256, 128), (192, 124), 220),
        ((0, 128, 128, 256), (64, 252), 120),
        ((128, 128, 256, 256), (192, 252), 240),
    ],
    'hit': 360, 'launch': (28, -48),
}
for _name, _launch in {
    'poachers': (25, -44), 'huntsmen': (30, -48), 'rook': (27, -50), 'poacherCaptain': (25, -49),
}.items():
    FIGURE_ANIMATIONS[_name]['ranged'] = {
        'sheet': f'battle-{_name}-ranged-sequence', 'scale': 1, 'sizes': ['battle'],
        'frames': [
            ((0, 0, 128, 128), (64, 124), 140),
            ((128, 0, 256, 128), (192, 124), 220),
            ((0, 128, 128, 256), (64, 252), 120),
            ((128, 128, 256, 256), (192, 252), 240),
        ],
        'hit': 360, 'launch': _launch,
    }
for _name, _launch in {
    'baron': (41, -55), 'sergeant': (29, -43), 'pike': (33, -48), 'foreman': (34, -44),
    'picketCaptain': (30, -44), 'cutpurseCaptain': (31, -49), 'highwaymanCaptain': (30, -39),
    'witch': (26, -44), 'bramble': (32, -53), 'heroRanger': (29, -46),
}.items():
    FIGURE_ANIMATIONS[_name]['cast'] = {
        'sheet': f'battle-{_name}-cast-sequence', 'scale': 1, 'sizes': ['battle'],
        'frames': [
            ((0, 0, 128, 128), (64, 124), 140),
            ((128, 0, 256, 128), (192, 124), 180),
            ((0, 128, 128, 256), (64, 252), 140),
            ((128, 128, 256, 256), (192, 252), 180),
        ],
        'hit': 320, 'launch': _launch,
    }
for _name in ('witch', 'bramble'):
    FIGURE_ANIMATIONS[_name]['ranged'] = FIGURE_ANIMATIONS[_name]['cast']
# The payday feast (#191): Aldric and his troops celebrating payday round the fire, and the camp's things. Four sheets
# (feast-1 to feast-4), cut at the size they were drawn, a little closer than the battle's (a person sitting is about
# 60 px), and with no shadow of their own: the feast lays its shadows away from its fire. Each troop's figure is named
# for the troop; a troop with none stands at the feast in its battle figure.
# The faces on the cards (#311), painted as the figures they stand for: each one's box on its sheet and its scale,
# cut into the portrait's 64 px square, standing on its bottom edge. The King is the court's cute King.
PORTRAITS = {
    'king': ('portraits-b', (4, 6, 84, 85), 0.8), 'knight': ('portraits-a', (91, 4, 161, 84), 0.8), 'wizard': ('portraits-a', (177, 4, 247, 84), 0.8),
    'ranger': ('portraits-a', (7, 96, 76, 167), 0.8), 'courtier': ('portraits-a', (90, 89, 166, 167), 0.8), 'grimsby': ('portraits-a', (172, 89, 251, 167), 0.8),
    'sergeant': ('portraits-a', (9, 177, 75, 250), 0.8), 'warren': ('portraits-a', (88, 179, 157, 250), 0.8), 'foreman': ('portraits-a', (172, 182, 247, 250), 0.8),
    'mirrow': ('portraits-b', (174, 3, 250, 86), 0.8), 'bramble': ('portraits-b', (9, 88, 83, 168), 0.8), 'rook': ('portraits-b', (88, 93, 168, 168), 0.8),
    'anselm': ('portraits-b', (172, 95, 252, 168), 0.8), 'nan': ('portraits-b', (6, 178, 81, 251), 0.8), 'dwarf': ('portraits-b', (88, 174, 168, 251), 0.8),
    'goose': ('portraits-b', (172, 173, 240, 251), 0.8),
}
PORTRAIT_SIZE = 64
PORTRAITS_OUT = os.path.join(ROOT, 'public/assets/portraits')


def cut_portrait(sheet, box, scale):
    px = cut(sheet, box, 0, scale=scale, figure=True)
    px[px[..., 3] == 128] = 0
    ys, xs = np.nonzero(px[..., 3])
    px = px[ys.min():ys.max() + 1, xs.min():xs.max() + 1][-PORTRAIT_SIZE:, :PORTRAIT_SIZE]
    out = np.zeros((PORTRAIT_SIZE, PORTRAIT_SIZE, 4), 'uint8')
    x = (PORTRAIT_SIZE - px.shape[1]) // 2
    out[PORTRAIT_SIZE - px.shape[0]:, x:x + px.shape[1]] = px
    return out


FEAST = {
    'heroKnight': ('feast-3', (110, 9, 159, 85)), 'heroWizard': ('feast-2', (6, 11, 87, 88)),
    'heroRanger': ('feast-2', (95, 10, 168, 90)), 'heroCourtier': ('feast-2', (192, 6, 245, 94)),
    'knights': ('feast-3', (181, 21, 246, 79)), 'archers': ('feast-3', (15, 101, 75, 160)), 'peasants': ('feast-3', (108, 91, 154, 167)),
    'swordsmen': ('feast-2', (96, 177, 166, 247)), 'crossbowmen': ('feast-2', (188, 176, 248, 246)),
    'wolves': ('feast-2', (10, 114, 80, 155)), 'boars': ('feast-2', (90, 111, 167, 153)), 'bears': ('feast-2', (174, 106, 253, 159)),
    'goblins': ('feast-4', (20, 26, 69, 79)), 'trolls': ('feast-4', (104, 9, 159, 86)), 'poachers': ('feast-4', (181, 21, 253, 85)),
    'bandits': ('feast-4', (9, 100, 75, 160)), 'huntsmen': ('feast-4', (96, 99, 159, 160)),
    'fire': ('feast-1', (179, 100, 246, 166)), 'spit': ('feast-4', (172, 194, 255, 243)), 'tent': ('feast-1', (90, 174, 168, 250)),
    'horseWhite': ('feast-1', (13, 107, 85, 165)), 'horseBrown': ('feast-1', (95, 107, 167, 165)),
    'barrel': ('feast-3', (185, 97, 242, 160)), 'chest': ('feast-3', (19, 184, 70, 241)), 'food': ('feast-3', (87, 188, 174, 241)),
    'banner': ('feast-3', (189, 176, 248, 247)),
}
FEAST_OUT = os.path.join(ROOT, 'public/assets/feast')
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
    # The finds sheet (#311) laid its shadow in a bluish grey.
    grey = (a.max(2) - a.min(2) < (24 if sheet == 'finds' else 12)) & (a.sum(2) > 120) & (a.sum(2) < bg.sum() - 20)
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


def figure_mask(rgb, solid, sh):
    """A figure's own pixels (#311): steel greys as light as the sheet's ground were taken for it, leaving
    holes in armour, and the soft edge of a painted shadow was left as grey specks round the feet."""
    holes = nd.binary_fill_holes(solid) & ~solid
    lab, _ = nd.label(holes)
    small = np.bincount(lab.ravel()) <= 12
    small[0] = False
    solid = solid | small[lab]
    lab, n = nd.label(solid, structure=np.ones((3, 3)))
    sizes = np.bincount(lab.ravel())
    grey = rgb.max(2) - rgb.min(2) < 18
    rows = np.nonzero(solid.any(1))[0]
    ground = rows.max() - (rows.max() - rows.min()) * 0.15 if len(rows) else 0
    for i in range(1, n + 1):
        part = lab == i
        if grey[part].all() and (sizes[i] < 16 or (sizes[i] < 60 and np.nonzero(part)[0].min() >= ground)):
            solid = solid & ~part
    return solid, sh & ~solid


def cut(sheet, box, width, name='', height=None, alone=False, cool=False, scale=None, figure=False):
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
    if name == 'menhir':
        # The stone's darker greys are as flat as the sheet's shadow: everything inside its outline is stone.
        lab, _ = nd.label(solid, structure=np.ones((3, 3)))
        sizes = np.bincount(lab.ravel()); sizes[0] = 0
        body = lab == sizes.argmax()
        for y in range(body.shape[0]):
            xs = np.nonzero(body[y])[0]
            if len(xs):
                body[y, xs[0]:xs[-1] + 1] = True
        solid = body
        sh &= ~solid
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
    if figure:
        solid, sh = figure_mask(rgb, solid, sh)
    # Keep only what's joined to the piece's biggest part, so a neighbour's edge doesn't come along.
    lab, _ = nd.label(solid | sh, structure=np.ones((3, 3)))
    sizes = np.bincount(lab.ravel()); sizes[0] = 0
    main = sizes > max(20, sizes.max() * 0.04)
    keep = main[lab]
    solid &= keep
    sh &= keep
    if scale is None:
        ys, xs = np.nonzero(solid | sh)
        rgb, solid, sh = rgb[ys.min():ys.max() + 1, xs.min():xs.max() + 1], solid[ys.min():ys.max() + 1, xs.min():xs.max() + 1], sh[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    k = scale if scale is not None else width / rgb.shape[1] if height is None else height / (np.ptp(np.nonzero(solid.any(1))[0]) + 1)
    w, h = max(1, round(rgb.shape[1] * k)), max(1, round(rgb.shape[0] * k))
    if k != 1:
        solid_src = solid
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
        if figure and k < 1:
            # A shaft or a bowstring one pixel wide covers under half of any pixel it crosses: keep it whole.
            thin = solid_src & ~nd.binary_opening(solid_src, structure=np.ones((2, 2)))
            line = np.asarray(Image.fromarray((thin * 255).astype('uint8')).resize((w, h), Image.BOX)).astype(float) / 255
            solid |= line > 0.3
        sh = ~solid & (shade + cover > 0.5)
    out = np.zeros(rgb.shape[:2] + (4,), 'uint8')
    out[solid, :3] = snap(rgb)[solid]
    out[solid, 3] = 255
    out[sh, 3] = 128
    return out


def cut_animation(name, anim, spec):
    if not spec['frames'] or spec['scale'] <= 0:
        raise ValueError(f'{name} {anim}: a sequence needs frames and a positive fixed scale')
    total = sum(ms for _, _, ms in spec['frames'])
    if any(ms <= 0 for _, _, ms in spec['frames']):
        raise ValueError(f'{name} {anim}: frame durations must be positive')
    if anim in ('melee', 'charge', 'ranged', 'cast') and 'hit' not in spec:
        raise ValueError(f'{name} {anim}: an attack needs its visible contact time')
    if 'hit' in spec and not 0 <= spec['hit'] < total:
        raise ValueError(f'{name} {anim}: hit must fall within the animation')
    if anim == 'move' and 'map' in spec['sizes']:
        if spec['stride'] <= 0 or not spec['footfalls'] or any(not 0 <= ms < total for ms in spec['footfalls']):
            raise ValueError(f'{name} {anim}: a map gait needs a stride and footfall phases')
    frames = [{'name': f'{name}-{anim}-{i}', 'ms': ms} for i, (_, _, ms) in enumerate(spec['frames'])]
    feet = {}
    for size in spec['sizes']:
        scale = spec['scale'] * (BATTLE_SIZE.get(name, 1) if size == 'battle' else 2 / 3 if name.startswith('hero') else 0.6)
        images = []
        for box, anchor, _ in spec['frames']:
            px = cut(spec['sheet'], box, 0, scale=scale, figure=True)
            px[px[..., 3] == 128] = 0
            foot = (round((anchor[0] - box[0]) * scale), round((anchor[1] - box[1]) * scale))
            images.append((px, foot))
        left = min(-foot[0] for _, foot in images)
        top = min(-foot[1] for _, foot in images)
        right = max(px.shape[1] - foot[0] for px, foot in images)
        bottom = max(px.shape[0] - foot[1] for px, foot in images)
        feet[size] = [-left, -top]
        for frame, (px, foot) in zip(frames, images):
            out = np.zeros((bottom - top, right - left, 4), 'uint8')
            x, y = -foot[0] - left, -foot[1] - top
            out[y:y + px.shape[0], x:x + px.shape[1]] = px
            Image.fromarray(out).save(os.path.join(TROOPS_OUT, f"{frame['name']}-{size}.png"))
    launch = {'launch': [round(n * spec['scale'] * BATTLE_SIZE.get(name, 1)) for n in spec['launch']]} if 'launch' in spec else {}
    return {'frames': frames, 'feet': feet, **{key: spec[key] for key in ('hit', 'stride', 'footfalls') if key in spec}, **launch}


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


def cut_feast(name, sheet, box):
    """A piece of the payday feast at the size it was drawn: its painted pixels, in the palette, and no shadow."""
    if sheet not in CACHE:
        CACHE[sheet] = layers(sheet)
    a, back, shadow = CACHE[sheet]
    x0, y0, x1, y1 = box
    rgb = a[y0:y1, x0:x1].copy()
    solid = ~back[y0:y1, x0:x1] & ~shadow[y0:y1, x0:x1]
    hsv = np.asarray(Image.fromarray(rgb.astype('uint8')).convert('HSV')).astype(float)
    if name == 'fire':
        # Its painted flames go, and the sparks over them: the feast draws its own flames each frame, behind the logs.
        flames = (hsv[..., 2] > 185) & (hsv[..., 0] < 62 * 255 / 360) & (hsv[..., 1] > 60)
        flames |= (hsv[..., 2] > 235) & (hsv[..., 1] < 90)
        solid &= ~flames
        lab, _ = nd.label(solid, structure=np.ones((3, 3)))
        sizes = np.bincount(lab.ravel()); sizes[0] = 0
        solid = lab == sizes.argmax()
    if name == 'spit':
        # Roasted, not raw (#191): the pig's orange goes a deep golden brown, its light and shade kept.
        pig = solid & (hsv[..., 0] < 40 * 255 / 360) & (hsv[..., 1] > 90) & (hsv[..., 2] > 120)
        hsv[..., 0] = np.where(pig, 19 * 255 / 360 + (hsv[..., 0] - 19 * 255 / 360) * 0.4, hsv[..., 0])
        hsv[..., 1] = np.where(pig, np.minimum(255, hsv[..., 1] * 1.05), hsv[..., 1])
        hsv[..., 2] = np.where(pig, hsv[..., 2] * 0.7, hsv[..., 2])
        rgb = np.asarray(Image.fromarray(hsv.astype('uint8'), 'HSV').convert('RGB')).astype(int)
    # Keep only what's joined to the piece's biggest part, so a neighbour's edge doesn't come along.
    lab, _ = nd.label(solid, structure=np.ones((3, 3)))
    sizes = np.bincount(lab.ravel()); sizes[0] = 0
    solid &= (sizes > max(12, sizes.max() * 0.03))[lab]
    ys, xs = np.nonzero(solid)
    rgb, solid = rgb[ys.min():ys.max() + 1, xs.min():xs.max() + 1], solid[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    out = np.zeros(rgb.shape[:2] + (4,), 'uint8')
    out[solid, :3] = snap(rgb)[solid]
    out[solid, 3] = 255
    return out


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
            px = cut(sheet, box, 0, name, height=round(tall * k), figure=True)
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
            px = cut(sheet, box, 0, name, height=round(tall * k), figure=True)
            Image.fromarray(px).save(os.path.join(TROOPS_OUT, f'{name}-{size}.png'))
    animations = {name: {anim: cut_animation(name, anim, spec) for anim, spec in poses.items()} for name, poses in FIGURE_ANIMATIONS.items()}
    os.makedirs(FEAST_OUT, exist_ok=True)
    os.makedirs(PORTRAITS_OUT, exist_ok=True)
    for name, (sheet, box, scale) in PORTRAITS.items():
        Image.fromarray(cut_portrait(sheet, box, scale)).save(os.path.join(PORTRAITS_OUT, name + '.png'))
    for name, (sheet, box) in FEAST.items():
        Image.fromarray(cut_feast(name, sheet, box)).save(os.path.join(FEAST_OUT, name + '.png'))
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
        f.write("export type FigureAnimation = {\n  frames: readonly { name: string; ms: number }[];\n  feet: Partial<Record<'battle' | 'map', readonly [number, number]>>;\n  hit?: number;\n  launch?: readonly [number, number];\n  stride?: number;\n  footfalls?: readonly number[];\n};\n")
        f.write("export const FIGURE_ANIMATIONS: Record<string, Partial<Record<import('./battleSprites').AnimName, FigureAnimation>>> = " + json.dumps(animations) + ";\n")
        f.write(f"/** The faces on the cards that are painted (#311), in public/assets/portraits/. */\nexport const PAINTED_PORTRAITS = {json.dumps(list(PORTRAITS))} as const;\n")
        f.write(f"/** The payday feast's pieces (#191), in public/assets/feast/: Aldric as each background, a figure for each troop that has one, and the camp's things. */\nexport const FEAST_PIECES = {json.dumps(list(FEAST))} as const;\n")
        f.write("export type FeastPieceName = (typeof FEAST_PIECES)[number];\n")
        f.write("export type GroundName = (typeof GROUNDS)[number];\n")
    print(f'{len(feet)} pieces and {len(GROUND)} grounds in {OUT}')


if __name__ == '__main__':
    main()
