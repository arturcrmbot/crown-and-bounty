"""
The sound effects, recorded (#257): every take of every effect, cut from recordings made by people,
layered as the game plays them, levelled and packed losslessly, one FLAC and one JSON index for each
pack (`public/assets/sfx/`), as `soundfont.py` packs the band. Each source is fetched once, from the
pinned address below, into a cache, and each is credited by name in `public/assets/CREDITS.md` (a test
checks).

A take is one or more layers: a recording, cut (`impact` puts its loudest onset `lead` seconds in, so
every blow lands as the game expects it to; `onset` its first strong one; `span` a stretch; `events` a
run of its onsets), at a gain against the first layer, at a time (or on the first layer's impact),
and at a rate. Every take of an effect is set to the same loudness, and the game sets each effect's
level in the mix (`npm run listen -- effects`).

Needs Python 3 with numpy and scipy, and ffmpeg.

    python3 scripts/sfx.py              (every pack)
    python3 scripts/sfx.py battle
"""
import io, json, os, subprocess, sys, urllib.request, zipfile

import numpy as np
from scipy.signal import lfilter

# 32 kHz keeps everything up to 16 kHz, where most of these recordings (Vorbis and MP3 at the source) stop anyway.
RATE = 32000
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets', 'sfx')
CACHE = '/tmp/kc-sfx'
# Every take's loudest tenth of a second, as the ear hears it (K-weighted LUFS), with its peaks held
# within `CREST` dB of that by a gentle limiter, so the mix can bring any of them up to its mark.
LOUD = -15
CREST = 12

WESNOTH = 'https://raw.githubusercontent.com/wesnoth/wesnoth/1.18.8/data/core/sounds/'
KENNEY = {
    'impact': 'https://kenney.nl/media/pages/assets/impact-sounds/87b4ddecda-1677589768/kenney_impact-sounds.zip',
    'rpg': 'https://kenney.nl/media/pages/assets/rpg-audio/8e99002d76-1677590336/kenney_rpg-audio.zip',
}
LEAMON = 'https://opengameart.org/sites/default/files/fleshy_fight_sounds.zip'
# Freesound's recordings, all CC0, each by its id: its preview's address, who recorded it, and what it is.
FREESOUND = {
    165532: ('https://cdn.freesound.org/previews/165/165532_1799601-hq.mp3', 'StephenSaldanha', 'SRS_Foley_Horse_Galloping.wav'),
    205938: ('https://cdn.freesound.org/previews/205/205938_3842302-hq.mp3', 'Twisted_Euphoria', 'Arrow Impact'),
    384918: ('https://cdn.freesound.org/previews/384/384918_984733-hq.mp3', 'Ali_6868', 'Bow Release (Bow and Arrow) 3'),
    384919: ('https://cdn.freesound.org/previews/384/384919_984733-hq.mp3', 'Ali_6868', 'Crossbow Firing and Hitting Target'),
    394179: ('https://cdn.freesound.org/previews/394/394179_7280678-hq.mp3', 'saturdaysoundguy', 'Longbow Release 2.wav'),
    417994: ('https://cdn.freesound.org/previews/417/417994_7482766-hq.mp3', 'DylanTheFish', 'Body fall.wav'),
    504626: ('https://cdn.freesound.org/previews/504/504626_4437257-hq.mp3', 'leonelmail', 'BODY FALL - V HVY - DIRT'),
    521552: ('https://cdn.freesound.org/previews/521/521552_11543986-hq.mp3', 'omerbhatti34', 'Arrow Impact'),
    683179: ('https://cdn.freesound.org/previews/683/683179_2578040-hq.mp3', 'NearTheAtmoshphere', 'Fireball'),
}


# ---------------------------------------------------------------- sources

def fetch(url):
    path = os.path.join(CACHE, url.split('://', 1)[1].replace('/', '_'))
    if not os.path.exists(path):
        os.makedirs(CACHE, exist_ok=True)
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (crown-and-bounty sfx.py)'})
        with urllib.request.urlopen(req, timeout=60) as r, open(path + '.part', 'wb') as f:
            f.write(r.read())
        os.replace(path + '.part', path)
    return path


def member(url, name):
    """A file from inside a zip, by the end of its path."""
    path = os.path.join(CACHE, 'zip', url.rsplit('/', 1)[1], name.replace('/', '_'))
    if not os.path.exists(path):
        with zipfile.ZipFile(fetch(url)) as z:
            found = [n for n in z.namelist() if n.endswith('/' + name) or n == name]
            assert found, f'{name} not in {url}'
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, 'wb') as f:
                f.write(z.read(found[0]))
    return path


def wesnoth(name):
    return ('wesnoth', name)


def kenney(pack, name):
    return ('kenney', pack, name)


def leamon(name):
    return ('leamon', name)


def freesound(sound):
    return ('freesound', sound)


def path_of(source):
    kind = source[0]
    if kind == 'wesnoth':
        return fetch(WESNOTH + source[1])
    if kind == 'kenney':
        return member(KENNEY[source[1]], f'Audio/{source[2]}.ogg')
    if kind == 'leamon':
        return member(LEAMON, f'{source[1]}.wav')
    if kind == 'freesound':
        return fetch(FREESOUND[source[1]][0])
    raise ValueError(source)


# ---------------------------------------------------------------- cutting

_decoded = {}


def decode(path):
    if path not in _decoded:
        raw = subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(RATE), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
        _decoded[path] = np.frombuffer(raw, dtype=np.float32).astype(np.float64)
    return _decoded[path]


def env_db(x, hop=128):
    n = max(1, len(x) // hop)
    f = np.pad(x, (0, max(0, n * hop - len(x))))[: n * hop].reshape(n, hop)
    return 20 * np.log10(np.sqrt((f ** 2).mean(axis=1)) + 1e-9)


def onsets(x, hop=256, rise=9, floor=30, gap=0.1):
    """Where sounds begin: (sample, peak dB against the loudest) for each sudden rise."""
    db = env_db(x, hop)
    top = db.max()
    found, last = [], -10 ** 9
    for i in range(1, len(db)):
        if db[i] > top - floor and db[i] - db[max(0, i - 8):i].min() > rise and i - last > gap * RATE / hop:
            found.append(i)
            last = i
    if not found:
        found = [int(np.argmax(db > top - 20))]
    out = []
    for j, i in enumerate(found):
        nxt = found[j + 1] if j + 1 < len(found) else len(db)
        out.append((i * hop, db[i:nxt].max() - top))
    return out


def fade(x, fin=0.002, fout=0.03):
    x = x.copy()
    a, b = min(len(x) // 2, int(fin * RATE)), min(len(x) // 2, int(fout * RATE))
    if a:
        x[:a] *= 0.5 - 0.5 * np.cos(np.linspace(0, np.pi, a))
    if b:
        x[-b:] *= 0.5 + 0.5 * np.cos(np.linspace(0, np.pi, b))
    return x


def tail(x, under=42, longest=4.0):
    """Ends a sound once it has died away for good, `under` dB below its loudest (out of hearing under a fight), or at `longest` seconds."""
    x = x[: int(longest * RATE)]
    db = env_db(x)
    keep = np.where(db > db.max() - under)[0]
    end = min(len(x), (keep[-1] + 2) * 128 + int(0.01 * RATE)) if len(keep) else len(x)
    return fade(x[:end], 0, min(0.04, end / RATE / 4))


def cut(x, how):
    if how is None:
        db = env_db(x)
        start = max(0, int(np.argmax(db > db.max() - 50)) * 128 - int(0.003 * RATE))
        return tail(fade(x[start:], 0.002, 0))
    kind = how[0]
    if kind in ('impact', 'onset'):
        found = onsets(x)
        at = max(found, key=lambda o: o[1])[0] if kind == 'impact' else next(o[0] for o in found if o[1] >= -6)
        start = max(0, at - int(how[1] * RATE))
        return tail(fade(x[start:], 0.002, 0), longest=how[2] if len(how) > 2 else 4.0)
    if kind == 'events':
        found = [o for o in onsets(x) if o[1] >= -14]
        first, count, longest = how[1] % len(found), how[2], how[3]
        start = max(0, found[first][0] - int(0.01 * RATE))
        end = found[first + count][0] - int(0.008 * RATE) if first + count < len(found) else len(x)
        return tail(fade(x[start:min(end, start + int(longest * RATE))], 0.002, 0))
    if kind == 'to':
        return tail(fade(x[: int(how[1] * RATE)], 0.002, 0.02))
    if kind == 'from':
        return cut(x[int(how[1] * RATE):], None)
    if kind == 'span':
        return fade(x[int(how[1] * RATE):int((how[1] + how[2]) * RATE)], 0.02, min(1.0, 0.3 * how[2]))
    raise ValueError(how)


def kweight(x):
    # ITU-R BS.1770's pre-filter and high-pass (given for 48 kHz: near enough to level takes against each other).
    k = lfilter([1.53512485958697, -2.69169618940638, 1.19839281085285], [1, -1.69065929318241, 0.73248077421585], x)
    return lfilter([1, -2, 1], [1, -1.99004745483398, 0.99007225036621], k)


def loudest(x, window=0.1):
    k = kweight(x)
    size = int(window * RATE)
    k = np.pad(k, (0, max(0, size - len(k))))
    power = np.convolve(k * k, np.ones(size) / size, mode='valid')[:: max(1, size // 4)]
    return -0.691 + 10 * np.log10(max(power.max(), 1e-20))


def at_rate(x, rate):
    if rate == 1:
        return x
    n = int(len(x) / rate)
    return np.interp(np.arange(n) * rate, np.arange(len(x)), x)


def layer(source, how=None, gain=0.0, at=0.0, rate=1.0):
    return (source, how, gain, at, rate)


IMPACT = 'impact'


def take(*layers):
    """Mixes a take's layers: each first set to one loudness, then to its gain against the first; a layer
    `at` IMPACT (or (IMPACT, seconds)) lands on the first layer's loudest onset."""
    parts, hit = [], 0
    for n, (source, how, gain, at, rate) in enumerate(layers):
        y = at_rate(cut(decode(path_of(source)), how), rate)
        y = y * 10 ** ((-20 - loudest(y)) / 20) * 10 ** (gain / 20)
        if n == 0:
            hit = max(onsets(y), key=lambda o: o[1])[0]
        if at == IMPACT:
            at = hit / RATE
        elif isinstance(at, tuple):
            at = hit / RATE + at[1]
        parts.append((int(max(0, at) * RATE), y))
    out = np.zeros(max(o + len(y) for o, y in parts))
    for o, y in parts:
        out[o:o + len(y)] += y
    # Level it, hold its peaks, and level it again until it settles (holding the peaks takes a little off its loudness).
    for _ in range(12):
        out = limit(out * 10 ** ((LOUD - loudest(out)) / 20), 10 ** ((LOUD + CREST) / 20))
        if abs(loudest(out) - LOUD) < 0.3:
            break
    return out


def limit(x, ceiling, look=0.0015, release=0.05):
    """A limiter that sees each peak coming (`look` seconds ahead) and lets go over `release` seconds."""
    from scipy.ndimage import minimum_filter1d
    need = np.minimum(1, ceiling / np.maximum(np.abs(x), 1e-9))
    if need.min() >= 1:
        return x
    n = max(1, int(look * RATE))
    need = minimum_filter1d(need, size=2 * n + 1, mode='nearest')
    let_go = np.exp(-1 / (release * RATE))
    gain = np.empty_like(need)
    g = 1.0
    for i, v in enumerate(need):
        g = v if v < g else let_go * g + (1 - let_go) * v
        gain[i] = g
    return x * gain


# ---------------------------------------------------------------- the packs

def each(make, keys):
    return [make(k) for k in keys]


BLOW = ('impact', 0.05)
HIT = ('impact', 0.004)
CRY_FALL = lambda: layer(freesound(417994), ('impact', 0.01, 0.5), -9, 0.4)
HEAVY_FALL = lambda: layer(freesound(504626), ('impact', 0.01, 0.6), -5, 0.6)
STEP = ('onset', 0.004, 0.3)

def battle():
    return {
        # The blow itself, each troop's own weapon as Wesnoth has it, landing 50 ms in (`CONTACT`); what it
        # lands on (flesh or steel) is a hit of its own, played with it.
        'blow:blade': [take(layer(wesnoth('sword-1.ogg'), BLOW))],
        'blow:fork': [take(layer(wesnoth('spear.wav'), BLOW))],
        'blow:lance': [take(layer(wesnoth('spear.ogg'), BLOW), layer(kenney('impact', 'impactWood_heavy_000'), HIT, -9, IMPACT))],
        'blow:bite': [take(layer(wesnoth('bite.ogg'), BLOW)), take(layer(wesnoth('bite-small.ogg'), BLOW))],
        'blow:club': [take(layer(wesnoth('club.ogg'), BLOW))],
        'blow:mace': [take(layer(wesnoth('mace.ogg'), BLOW)), take(layer(wesnoth('mace.wav'), BLOW))],
        # A troll swings the same club, bigger and slower, and the ground takes it.
        'blow:fist': [take(layer(wesnoth('club.ogg'), BLOW, 0, 0, 0.82), layer(kenney('impact', 'impactSoft_heavy_000'), HIT, -6, IMPACT))],
        'blow:spear': [take(layer(wesnoth('spear.ogg'), BLOW))],
        'blow:tusk': [take(layer(wesnoth('tusker-charge.ogg'), BLOW))],
        'blow:dagger': [take(layer(wesnoth('knife.ogg'), BLOW)), take(layer(kenney('rpg', 'knifeSlice'), BLOW)), take(layer(kenney('rpg', 'knifeSlice2'), BLOW))],
        'blow:staff': [take(layer(wesnoth('staff.wav'), BLOW))],
        # What a blow or a shot lands on: Will Leamon's hits on flesh, and on armour (his `-arm` takes, which ring).
        'hit:sword': each(lambda k: take(layer(leamon(f'sword-1{k}'), HIT)), 'ab'),
        'hit:sword:armour': each(lambda k: take(layer(leamon(f'sword-arm-2{k}'), HIT)), 'ab'),
        'hit:hammer': each(lambda k: take(layer(leamon(f'hammer-1{k}'), HIT)), 'ab'),
        'hit:hammer:armour': each(lambda k: take(layer(leamon(f'hammer-arm-2{k}'), HIT)), 'ab'),
        'hit:pierce': each(lambda k: take(layer(leamon(f'piercing-1{k}'), HIT)), 'ab'),
        'hit:pierce:armour': each(lambda k: take(layer(leamon(f'piercing-arm-2{k}'), HIT)), 'ab'),
        'hit:punch': each(lambda k: take(layer(leamon(f'punch_1{k}'), HIT)), 'ab'),
        # The weight under a blow, as heavy as what it did (#190).
        'thump:light': each(lambda k: take(layer(kenney('impact', f'impactSoft_medium_00{k}'), HIT)), '012'),
        'thump:heavy': each(lambda k: take(layer(leamon(f'punch_alt-2{k}'), HIT)), 'ab'),
        'thump:huge': [take(layer(freesound(504626), ('impact', 0.004, 0.7)))],
        # Shots, as they leave and as they land.
        'loose:arrow': [take(layer(freesound(394179), ('onset', 0.01))), take(layer(freesound(384918), ('onset', 0.01))), take(layer(wesnoth('bow.ogg'), ('to', 0.36)))],
        'land:arrow': [take(layer(freesound(205938), ('onset', 0.004))), take(layer(freesound(521552), ('onset', 0.004)))],
        'loose:quarrel': [take(layer(wesnoth('crossbow.ogg'), ('to', 0.26))), take(layer(freesound(384919), ('to', 0.68)))],
        'land:quarrel': [take(layer(wesnoth('crossbow.ogg'), ('from', 0.26))), take(layer(freesound(384919), ('from', 0.7)))],
        'loose:hex': [take(layer(wesnoth('magic-dark.ogg')))],
        'land:hex': [take(layer(wesnoth('magic-dark-big.ogg')))],
        'loose:magic': each(lambda k: take(layer(wesnoth(f'magic-missile-{k}.ogg'))), '123'),
        'land:magic': [take(layer(leamon('punch_alt-2b'), HIT))],
        # Cries: a wince, and a death cry with the body falling after it.
        'hurt:man': each(lambda k: take(layer(wesnoth(f'human-hit-{k}.ogg'))), '12345'),
        'hurt:woman': each(lambda k: take(layer(wesnoth(f'human-female-hit-{k}.ogg'))), '123'),
        'hurt:wolf': each(lambda k: take(layer(wesnoth(f'wolf-hit-{k}.ogg'))), '124'),
        'hurt:goblin': each(lambda k: take(layer(wesnoth(f'goblin-hit-{k}.ogg'))), '123'),
        'hurt:spider': [take(layer(wesnoth('hiss-hit.wav')))],
        'hurt:troll': each(lambda k: take(layer(wesnoth(f'troll-hit-{k}.ogg'))), '1234'),
        'hurt:bear': [take(layer(wesnoth('yeti-hit.ogg')))],
        'hurt:boar': [take(layer(wesnoth('tusker-hit.ogg')))],
        'dies:man': each(lambda k: take(layer(wesnoth(f'human-die-{k}.ogg')), CRY_FALL()), '123'),
        'dies:woman': each(lambda k: take(layer(wesnoth(f'human-female-die-{k}.ogg')), CRY_FALL()), '123'),
        'dies:wolf': each(lambda k: take(layer(wesnoth(f'wolf-die-{k}.ogg')), CRY_FALL()), '13'),
        'dies:goblin': each(lambda k: take(layer(wesnoth(f'goblin-die-{k}.ogg')), CRY_FALL()), '12'),
        'dies:spider': [take(layer(wesnoth('hiss-big.wav')), CRY_FALL()), take(layer(wesnoth('hiss-die.wav')), CRY_FALL())],
        'dies:troll': each(lambda k: take(layer(wesnoth(f'troll-die-{k}.ogg')), HEAVY_FALL()), '123'),
        'dies:bear': [take(layer(wesnoth('drake-die.ogg')), HEAVY_FALL())],
        # Wesnoth's boar dies in a low-quality recording, so ours is its wince, a little lower.
        'dies:boar': [take(layer(wesnoth('tusker-hit.ogg'), None, 0, 0, 0.85), HEAVY_FALL())],
        # Feet on the field's grass.
        'feet:boots': each(lambda k: take(layer(kenney('impact', f'footstep_grass_00{k}'), STEP)), '01234'),
        'feet:hooves': each(lambda k: take(layer(freesound(165532), ('events', k, 2, 0.35))), (4, 8, 12)),
        'feet:paws': [take(layer(kenney('impact', 'footstep_grass_003'), STEP, 0, 0, 1.3), layer(kenney('impact', 'footstep_grass_004'), STEP, -3, 0.07, 1.3))],
        'feet:stomp': [take(layer(freesound(504626), ('impact', 0.004, 0.5), 0, 0, 0.8), layer(kenney('impact', 'impactSoft_heavy_000'), HIT, -6))],
        'feet:trotters': [take(layer(kenney('impact', 'footstep_grass_001'), STEP, 0, 0, 1.5), layer(kenney('impact', 'footstep_grass_002'), STEP, -2, 0.06, 1.5))],
        'feet:patter': [take(layer(kenney('impact', 'footstep_grass_000'), STEP, 0, 0, 1.7), layer(kenney('impact', 'footstep_grass_002'), STEP, -2, 0.035, 1.7), layer(kenney('impact', 'footstep_grass_004'), STEP, -4, 0.07, 1.7))],
        # Spells.
        'spell': each(lambda k: take(layer(wesnoth(f'magic-holy-{k}.ogg'))), '12'),
        'bolt': [take(layer(wesnoth('lightning.ogg')))],
        'whoosh': [take(layer(freesound(683179)))],
        'boom': [take(layer(wesnoth('explosion.ogg')))],
        'luck': [take(layer(wesnoth('magic-faeriefire.ogg')))],
        # One of your stacks is ready: a light knock on wood.
        'ready': each(lambda k: take(layer(kenney('impact', f'impactWood_light_00{k}'), HIT)), '012'),
        # Into battle: a war horn calls three times (the sting). And the knights' charge: a horse breaking into a gallop, under the band's horn.
        'sting:battle': [take(layer(wesnoth('horn-signals/horn-1.ogg')))],
        'charge:gallop': [take(layer(freesound(165532), ('span', 0.6, 1.1)))],
    }


# Each pack, made only when it's built.
PACKS = {'battle': battle}


def build(name):
    effects = PACKS[name]()
    pcm, index, at = [], {}, 0
    for effect, takes in effects.items():
        index[effect] = []
        for x in takes:
            s = np.clip(np.round(x * 32767), -32768, 32767).astype('<i2')
            index[effect].append({'offset': at, 'length': len(s)})
            pcm.append(s)
            at += len(s)
    os.makedirs(OUT, exist_ok=True)
    raw = os.path.join(OUT, f'{name}.raw')
    np.concatenate(pcm).tofile(raw)
    flac = os.path.join(OUT, f'{name}.flac')
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-f', 's16le', '-ar', str(RATE), '-ac', '1', '-i', raw, '-c:a', 'flac', '-compression_level', '12', flac], check=True)
    os.remove(raw)
    with open(os.path.join(OUT, f'{name}.json'), 'w') as f:
        json.dump({'rate': RATE, 'effects': index}, f, separators=(',', ':'))
    takes = sum(len(t) for t in index.values())
    print(f'{name}: {len(index)} effects, {takes} takes, {at / RATE:.1f} s, {os.path.getsize(flac) / 1e6:.2f} MB')


if __name__ == '__main__':
    for name in sys.argv[1:] or list(PACKS):
        build(name)
