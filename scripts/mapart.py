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
    'signpost': ('wild', (120, 95, 144, 156), 30),
    'holes': ('wild', (136, 128, 175, 162), 40),
    'cragBig': ('land', (54, 4, 195, 77), 140),
    'cragMid': ('land', (13, 73, 87, 130), 74),
    'cragSmall': ('land', (178, 81, 234, 123), 56),
    'boulder1': ('land', (109, 90, 147, 121), 38),
    'boulder2': ('land', (11, 145, 57, 177), 46),
    'boulder3': ('land', (73, 151, 107, 176), 34),
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
# Trees: the tree sheet's rows, dark pines and blue firs, then broadleaves and autumn ones.
TREE_BOXES = [(79, 14, 111, 73), (146, 20, 177, 73), (46, 25, 74, 73), (181, 27, 211, 73), (216, 30, 242, 73), (14, 31, 39, 73), (79, 81, 111, 140), (146, 86, 177, 140), (46, 90, 76, 140), (181, 93, 211, 140), (13, 95, 42, 140), (215, 96, 243, 140), (49, 149, 74, 183), (83, 149, 109, 183), (117, 149, 141, 183), (149, 149, 176, 183), (183, 149, 210, 183), (217, 149, 243, 182), (15, 150, 39, 183), (183, 203, 209, 242), (216, 203, 243, 242), (48, 204, 74, 242), (81, 204, 108, 242), (149, 204, 175, 242), (13, 207, 40, 242)]
TREE_SCALE = 0.62
# The troops and Aldric (#178): each one's box on its sheet, and how tall he stands in battle, from
# his feet to the top of his head (a person about 65 px; on the map three fifths of that, Aldric two thirds).
FIGURES = {
    'peasants': ('troops-a', (9, 18, 68, 119), 66), 'archers': ('troops-a', (80, 8, 155, 119), 64), 'knights': ('troops-a', (153, 2, 252, 180), 105),
    'swordsmen': ('troops-a', (9, 133, 71, 252), 68), 'crossbowmen': ('troops-a', (86, 145, 158, 252), 68), 'wolves': ('troops-a', (161, 187, 250, 253), 44),
    'baron': ('troops-b', (7, 12, 83, 120), 82), 'goblins': ('troops-b', (94, 37, 169, 120), 48), 'trolls': ('troops-b', (166, 12, 245, 119), 86),
    'witch': ('troops-b', (23, 142, 82, 246), 70), 'bramble': ('troops-b', (94, 129, 167, 246), 82), 'poachers': ('troops-b', (177, 145, 249, 246), 64),
    'bandits': ('troops-c', (24, 9, 74, 83), 64), 'boars': ('troops-c', (174, 22, 252, 83), 42), 'bears': ('troops-c', (5, 102, 98, 171), 60),
    'huntsmen': ('troops-c', (110, 171, 156, 245), 66), 'heroKnight': ('troops-c', (173, 94, 251, 244), 96),
    'heroWizard': ('troops-d', (15, 19, 78, 123), 72), 'heroRanger': ('troops-d', (98, 17, 170, 123), 72), 'heroCourtier': ('troops-d', (182, 11, 240, 123), 72),
    'rook': ('troops-d', (180, 140, 250, 250), 68),
}
FIGURES['hero'] = FIGURES['heroKnight']
TROOPS_OUT = os.path.join(ROOT, 'public/assets/troops')
# Ground: the seamless square inside each ground sheet's frame.
GROUND = {'water': (36, 36, 92, 92), 'grass': (33, 33, 95, 95), 'dirt': (33, 33, 95, 95), 'wheat': (33, 36, 95, 95), 'heath': (14, 34, 114, 114), 'plough': (33, 33, 95, 95)}


def palette():
    js = "import('./src/render/palette.ts').then(m=>console.log(JSON.stringify({c:m.COLORS,cyc:[...m.CYCLING],sil:m.SILHOUETTE})))"
    out = subprocess.run(['npx', 'tsx', '-e', js], cwd=ROOT, capture_output=True, text=True, check=True).stdout
    d = json.loads(out.strip().splitlines()[-1])
    steady = [i for i in range(1, len(d['c'])) if i not in set(d['cyc']) and i != d['sil']]
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


def snap(rgb):
    """The nearest steady palette colour to each pixel, by OKLab."""
    flat = rgb.reshape(-1, 3).astype(float)
    best = np.zeros(len(flat), int)
    lab = oklab(flat)
    for s in range(0, len(flat), 8192):
        best[s:s + 8192] = ((lab[s:s + 8192, None] - LAB[None]) ** 2).sum(2).argmin(1)
    return COLORS[np.array(STEADY)[best]].reshape(rgb.shape)


def layers(sheet):
    """A sheet's pixels, what's background, and what's shadow (its flat grey touching the background)."""
    a = np.asarray(Image.open(os.path.join(SHEETS, sheet + '.png')).convert('RGB')).astype(int)
    bg = np.array(Counter(map(tuple, a.reshape(-1, 3))).most_common(1)[0][0])
    back = np.abs(a - bg).sum(2) <= 8
    rim = nd.binary_dilation(back) & ~back
    grey = (a.max(2) - a.min(2) < 12) & (a.sum(2) > 120) & (a.sum(2) < bg.sum() - 20)
    tone = np.array(Counter(map(tuple, a[rim & grey])).most_common(1)[0][0])
    flat = np.abs(a - tone).sum(2) <= 6
    lab, _ = nd.label(flat)
    touching = np.unique(lab[rim & flat])
    shadow = np.isin(lab, touching[touching > 0])
    return a, back, shadow


CACHE = {}


def cut(sheet, box, width, name='', height=None):
    """RGBA of one piece at `width` pixels across: painted pixels opaque, shadow at alpha 128."""
    if sheet not in CACHE:
        CACHE[sheet] = layers(sheet)
    a, back, shadow = CACHE[sheet]
    x0, y0, x1, y1 = box
    rgb, solid, sh = a[y0:y1, x0:x1].copy(), ~back[y0:y1, x0:x1] & ~shadow[y0:y1, x0:x1], shadow[y0:y1, x0:x1].copy()
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


def clumps(rgb, shades):
    """Pixel noise into drawn tufts, as HoMM2's ground is: a median over 3 pixels (wrapping, so it still
    tiles) turns static into little clumps, the contrast goes up so they read, and it's cut to a few
    flat shades of its own colours. No blur: every pixel stays sharp."""
    med = nd.median_filter(rgb, size=(3, 3, 1), mode='wrap')
    mean = med.reshape(-1, 3).mean(0)
    med = np.clip(mean + (med - mean) * 1.8, 0, 255)
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
    if 'trees' not in CACHE:
        CACHE['trees'] = layers('trees')
    a, back, shadow = CACHE['trees']
    pixels.append(a[~back & ~shadow])
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
    trees = []
    for i, box in enumerate(TREE_BOXES):
        px = cut('trees', box, max(8, round((box[2] - box[0]) * TREE_SCALE)))
        name = f'tree{i}'
        Image.fromarray(px).save(os.path.join(OUT, name + '.png'))
        feet[name] = foot(px) + 2
        trees.append(name)
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
        if name in ('grass', 'dirt', 'water'):
            rgb = clumps(rgb, 5)
        px = np.dstack([snap(rgb), np.full(rgb.shape[:2], 255)]).astype('uint8')
        Image.fromarray(px).save(os.path.join(OUT, 'ground-' + name + '.png'))
    pieces = ',\n'.join(f'  {n}: {f}' for n, f in feet.items())
    with open(os.path.join(ROOT, 'src/render/mapPieces.ts'), 'w') as f:
        f.write('// Written by `npm run mapart` (scripts/mapart.py): the map\'s pieces, and how far below its top each one stands.\n')
        f.write(f'export const PIECE_FEET = {{\n{pieces},\n}} as const;\n')
        f.write(f"export type PieceName = keyof typeof PIECE_FEET;\n")
        f.write(f"/** The trees: dark pines and blue firs first (0 to 11), then broadleaves (12 to 19) and autumn ones (20 to 24). */\n")
        f.write(f"export const TREES = {json.dumps(trees)} as const;\n")
        f.write(f"export const GROUNDS = {json.dumps(list(GROUND))} as const;\n")
        f.write(f"/** The troops and Aldric's figures, painted: in public/assets/troops/, each at battle and map size. */\nexport const FIGURES = {json.dumps(list(FIGURES))} as const;\n")
        f.write("export type GroundName = (typeof GROUNDS)[number];\n")
    print(f'{len(feet)} pieces and {len(GROUND)} grounds in {OUT}')


if __name__ == '__main__':
    main()
