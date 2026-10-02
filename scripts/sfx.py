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
import io, json, os, subprocess, sys, urllib.parse, urllib.request, zipfile

import numpy as np
from scipy.signal import butter, lfilter, sosfilt

# 32 kHz keeps everything up to 16 kHz, where most of these recordings (Vorbis and MP3 at the source) stop anyway.
# The land's sounds, under the music and long, keep up to 12 kHz (`PACKS`).
RATE = 32000
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets', 'sfx')
CACHE = '/tmp/kc-sfx'
# Every take's loudest tenth of a second, as the ear hears it (K-weighted LUFS), with its peaks held
# within `CREST` dB of that by a gentle limiter, so the mix can bring any of them up to its mark.
LOUD = -15
CREST = 12
# The lowest a pack keeps (Hz), set as it's built (`PACKS`): below it, a take holds only rumble.
FLOOR = 0

WESNOTH = 'https://raw.githubusercontent.com/wesnoth/wesnoth/1.18.8/data/core/sounds/'
KENNEY = {
    'impact': 'https://kenney.nl/media/pages/assets/impact-sounds/87b4ddecda-1677589768/kenney_impact-sounds.zip',
    'rpg': 'https://kenney.nl/media/pages/assets/rpg-audio/8e99002d76-1677590336/kenney_rpg-audio.zip',
    'casino': 'https://kenney.nl/media/pages/assets/casino-audio/2472606a04-1721639069/kenney_casino-audio.zip',
    'ui': 'https://kenney.nl/media/pages/assets/ui-audio/490d233f68-1677590494/kenney_ui-audio.zip',
}
LEAMON = 'https://opengameart.org/sites/default/files/fleshy_fight_sounds.zip'
# Little Robot Sound Factory's Fantasy Sound Effects Library (CC BY 3.0), and rubberduck's two packs (CC0).
LRSF = 'https://opengameart.org/sites/default/files/Fantasy%20Sound%20Library.zip'
RUBBERDUCK = {
    'rpg': 'https://opengameart.org/sites/default/files/80-CC0-RPG-SFX_0.zip',
    'sfx': 'https://opengameart.org/sites/default/files/100-CC0-SFX_0.zip',
}
# A single file on OpenGameArt, by its name there (or a zip there, and a file in it).
OGA = 'https://opengameart.org/sites/default/files/'
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
    146932: ('https://cdn.freesound.org/previews/146/146932_1274078-hq.mp3', 'crashoverride6', 'Wind Gust'),
    160685: ('https://cdn.freesound.org/previews/160/160685_2369092-hq.mp3', 'antique98', 'Lots of Geese'),
    160686: ('https://cdn.freesound.org/previews/160/160686_2369092-hq.mp3', 'antique98', 'A squeaking goose'),
    182504: ('https://cdn.freesound.org/previews/182/182504_854782-hq.mp3', 'swiftoid', 'Horse Clip Clopping Downhill (stereo)'),
    211624: ('https://cdn.freesound.org/previews/211/211624_71257-hq.mp3', 'qubodup', 'Magic Wand Glitter'),
    353907: ('https://cdn.freesound.org/previews/353/353907_5984825-hq.mp3', 'dr19', 'Shovel_dirt.wav'),
    384890: ('https://cdn.freesound.org/previews/384/384890_984733-hq.mp3', 'Ali_6868', 'Knight Right Footstep on Gravel 5 (With Chainmail)'),
    384901: ('https://cdn.freesound.org/previews/384/384901_984733-hq.mp3', 'Ali_6868', 'Knight Left Footstep Forest/Grass 5 (With Chainmail)'),
    564628: ('https://cdn.freesound.org/previews/564/564628_887696-hq.mp3', 'D4XX', 'Single Horse Galopp'),
    75162: ('https://cdn.freesound.org/previews/75/75162_1088850-hq.mp3', 'nigelcoop', 'crow.wav'),
    102972: ('https://cdn.freesound.org/previews/102/102972_1743164-hq.mp3', 'DjangoAltona', 'FX WOODPECKER.wav'),
    129678: ('https://cdn.freesound.org/previews/129/129678_2362707-hq.mp3', 'FreethinkerAnon', 'crickets'),
    131924: ('https://cdn.freesound.org/previews/131/131924_1661766-hq.mp3', 'felix.blume', 'A windmill is squeaking alone in the desert (USA, Arizona)'),
    233630: ('https://cdn.freesound.org/previews/233/233630_3610778-hq.mp3', 'abstraktgeneriert', 'Pickaxe #2.wav'),
    270588: ('https://cdn.freesound.org/previews/270/270588_3094998-hq.mp3', 'michorvath', 'Anvil Hit 2'),
    321129: ('https://cdn.freesound.org/previews/321/321129_3853968-hq.mp3', 'dleigh', 'arrow hitting target.wav'),
    346853: ('https://cdn.freesound.org/previews/346/346853_2247456-hq.mp3', 'Kinoton', 'Single Blackbird at Dawn'),
    354132: ('https://cdn.freesound.org/previews/354/354132_5462031-hq.mp3', 'betterchinese', 'Frog croaking sound effect'),
    361470: ('https://cdn.freesound.org/previews/361/361470_6512973-hq.mp3', 'Jofae', 'Crow Caw'),
    364992: ('https://cdn.freesound.org/previews/364/364992_4351264-hq.mp3', 'forfie', 'Bonfire'),
    378799: ('https://cdn.freesound.org/previews/378/378799_7025952-hq.mp3', 'kgeshev', 'BELL.wav'),
    387426: ('https://cdn.freesound.org/previews/387/387426_2247456-hq.mp3', 'Kinoton', 'Single Skylark'),
    435508: ('https://cdn.freesound.org/previews/435/435508_1196020-hq.mp3', 'BenjaminNelan', 'Rooster Crow 1'),
    465697: ('https://cdn.freesound.org/previews/465/465697_9159316-hq.mp3', 'Breviceps', 'Owl Hoot'),
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


def lrsf(name):
    return ('lrsf', name)


def rubberduck(pack, name):
    return ('rubberduck', pack, name)


def oga(name):
    return ('oga', name)


def oga_zip(archive, name):
    return ('oga_zip', archive, name)


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
    if kind == 'lrsf':
        return member(LRSF, f'{source[1]}.wav')
    if kind == 'rubberduck':
        return member(RUBBERDUCK[source[1]], f'{source[2]}.ogg')
    if kind == 'oga':
        return fetch(OGA + urllib.parse.quote(source[1]))
    if kind == 'oga_zip':
        return member(OGA + urllib.parse.quote(source[1]), source[2])
    raise ValueError(source)


# ---------------------------------------------------------------- cutting

_decoded = {}


def decode(path):
    if (path, RATE) not in _decoded:
        raw = subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(RATE), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
        _decoded[path, RATE] = np.frombuffer(raw, dtype=np.float32).astype(np.float64)
    return _decoded[path, RATE]


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
    if kind == 'raw':
        # A stretch exactly as it is, for a loop to be made from (`loop`).
        return x[int(how[1] * RATE):int((how[1] + how[2]) * RATE)]
    if kind == 'loudest':
        # Its loudest stretch, `how[1]` seconds long, as the ear hears it.
        size = int(how[1] * RATE)
        k = kweight(x)
        power = np.convolve(k * k, np.ones(size) / size, mode='valid')
        start = int(np.argmax(power[::480]) * 480)
        return fade(x[start:start + size], 0.02, min(1.0, 0.3 * how[1]))
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


def layer(source, how=None, gain=0.0, at=0.0, rate=1.0, top=0):
    """One recording in a take: how it's cut, its gain (dB), when it starts, its rate, and the highest it keeps (`top`, Hz; 0 keeps all)."""
    return (source, how, gain, at, rate, top)


IMPACT = 'impact'


def take(*layers):
    """Mixes a take's layers: each first set to one loudness, then to its gain against the first; a layer
    `at` IMPACT (or (IMPACT, seconds)) lands on the first layer's loudest onset."""
    parts, hit = [], 0
    for n, (source, how, gain, at, rate, top) in enumerate(layers):
        y = at_rate(cut(decode(path_of(source)), how), rate)
        if top:
            y = sosfilt(butter(2, top, 'lowpass', fs=RATE, output='sos'), y)
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
    if FLOOR:
        out = sosfilt(butter(4, FLOOR, 'highpass', fs=RATE, output='sos'), out)
    # Level it, hold its peaks, and level it again until it settles (holding the peaks takes a little off its loudness).
    for _ in range(12):
        out = limit(out * 10 ** ((LOUD - loudest(out)) / 20), 10 ** ((LOUD + CREST) / 20))
        if abs(loudest(out) - LOUD) < 0.3:
            break
    return out


def loop(source, start, length, fade=0.5):
    """A take that plays round and round: `length` seconds from `start`, made in full first (levelled, its
    rumble gone), then its last `fade` seconds laid over its first, so its end runs on into its start."""
    x = take(layer(source, ('raw', start, length + fade)))
    n, f = int(length * RATE), int(fade * RATE)
    t = np.linspace(0, np.pi / 2, f)
    out = x[:n].copy()
    out[:f] = x[n:n + f] * np.cos(t) + x[:f] * np.sin(t)
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


def everyday():
    return {
        # The cards: a playing card sliding out as one opens, laid down as it's put away, and a button's click (Kenney's).
        'unfold': each(lambda k: take(layer(kenney('casino', f'card-slide-{k}'))), '138'),
        'fold': each(lambda k: take(layer(kenney('casino', f'card-place-{k}'))), '124'),
        'click': each(lambda k: take(layer(kenney('ui', f'click{k}'))), '12'),
        # The hero's book and his gear: a page turned, cloth as a piece is lifted, a buckle as it's worn.
        'page': each(lambda k: take(layer(kenney('rpg', f'bookFlip{k}'))), '123'),
        'lift': each(lambda k: take(layer(kenney('rpg', f'cloth{k}'))), '123'),
        'equip': each(lambda k: take(layer(kenney('rpg', f'beltHandle{k}'))), '12'),
        # Gold: coins in the hand, one coin into the purse on the bar, and PAID stamped on a poster with a heavy knock, then the coins.
        'coins': [take(layer(kenney('rpg', 'handleCoins'))), take(layer(kenney('rpg', 'handleCoins2')))],
        'clink': [take(layer(rubberduck('rpg', 'item_coins_01'), ('to', 0.1))), take(layer(rubberduck('rpg', 'item_coins_03'), ('to', 0.13)))],
        'stamp': [take(layer(kenney('impact', 'impactWood_heavy_001'), HIT), layer(kenney('rpg', 'handleCoins'), None, -6, 0.15))],
        # Digging for treasure: three spadefuls of earth, and a glint of something found.
        'dig': [take(layer(freesound(353907), ('events', 0, 3, 1.6)), layer(rubberduck('rpg', 'item_gem_01'), None, -4, 1.5))],
        # Troops join: a knight's steps in mail, going off down the road.
        'march': [take(layer(freesound(384890)), layer(freesound(384901), ('from', 0.1), -2, 0.32), layer(freesound(384890), None, -4, 0.64), layer(freesound(384901), ('from', 0.1), -7, 0.96))],
        # Mana: a wand glittering, its brightest sparkle softened. Movement: a horse breaking into a gallop.
        'shimmer': [take(layer(freesound(211624), ('loudest', 1.2), top=6000))],
        'gallop': [take(layer(freesound(564628), ('span', 0.3, 1.0)))],
        # A chest opening on its old hinges.
        'creak': [take(layer(oga('open chest_0.wav')))],
        # Something picked up by the way: a small bell, rung a step higher for each one the same day (`PICKS` in effects.ts).
        'pick': [take(layer(rubberduck('sfx', 'bell_02')))],
        # A lost goose found: a goose squawking twice, or a gaggle.
        'honk': [take(layer(freesound(160686), ('events', 3, 1, 0.4)), layer(freesound(160686), ('events', 3, 1, 0.4), -2, 0.25, 0.9)), take(layer(freesound(160685), ('loudest', 1.0)))],
        # The mist rolling back from a lookout: a gust of wind.
        'gust': [take(layer(freesound(146932), ('loudest', 2.5)))],
        # The hero's feet on the map, and his horse's: grass, a road, a bridge's boards, the ford and the woods.
        # A horse's fore and hind feet fall together, so each hoofbeat is two clops: soft on grass and in
        # the woods (D4XX's horse), clipping on the road (swiftoid's), and knocking on the bridge's planks.
        'foot:grass': each(lambda k: take(layer(kenney('impact', f'footstep_grass_00{k}'), STEP)), '012'),
        'foot:road': each(lambda k: take(layer(lrsf(f'Footstep_Dirt_0{k}'), STEP)), '259'),
        'foot:bridge': each(lambda k: take(layer(kenney('impact', f'impactPlank_medium_00{k}'), STEP), layer(kenney('impact', f'footstep_wood_00{k}'), STEP, -4)), '012'),
        'foot:ford': each(lambda k: take(layer(lrsf(f'Footstep_Water_0{k}'))), '146'),
        'foot:forest': each(lambda k: take(layer(kenney('rpg', f'footstep0{k}'), STEP)), '036'),
        'hoof:grass': each(lambda k: take(layer(freesound(564628), ('events', k, 2, 0.35))), (0, 6)),
        'hoof:road': each(lambda k: take(layer(freesound(182504), ('events', k, 2, 0.45))), (2, 8, 12)),
        'hoof:bridge': each(lambda k: take(layer(kenney('impact', f'impactPlank_medium_00{k}'), STEP, 0, 0, 0.9), layer(kenney('impact', f'impactPlank_medium_00{k + 1}'), STEP, -2, 0.09, 0.9)), (3, 2)),
        'hoof:ford': [take(layer(lrsf('Footstep_Water_02')), layer(lrsf('Footstep_Water_05'), None, -2, 0.09))],
        'hoof:forest': each(lambda k: take(layer(freesound(564628), ('events', k, 2, 0.35))), (2, 10)),
    }


def land():
    return {
        # What goes on while you're near: a brook, the falls, the wind over high ground, a shower, the
        # crickets at night, and a fire at court and at the feast. Each loops, round and round.
        'brook': [loop(oga_zip('stream-waterfall.zip', 'stream4.ogg'), 2, 6)],
        'falls': [loop(oga_zip('stream-waterfall.zip', 'waterfall1.ogg'), 10, 5)],
        'gale': [loop(oga('wind1.wav'), 20, 9, 1)],
        'shower': [loop(oga_zip('Rain OGG.zip', '4.ogg'), 8, 5)],
        'crickets': [loop(freesound(129678), 3, 4)],
        'fire': [loop(wesnoth('ambient/campfire.ogg'), 1, 6)],
        # What comes from a place now and then: birds in the woods, crows at the tower, an owl at night,
        # a cockerel at dawn, frogs at the pools, the smith's anvil, a pick in the mine, the mill, the
        # archery butts, the abbey's bell, and a log settling in the fire.
        'songbird': [take(layer(wesnoth('ambient/birds1.ogg'), ('loudest', 2.5))), take(layer(wesnoth('ambient/birds2.ogg'), ('loudest', 2.5))), take(layer(wesnoth('ambient/birds3.ogg'), ('loudest', 2.5)))],
        'blackbird': [take(layer(freesound(346853), ('loudest', 3)))],
        'skylark': [take(layer(freesound(387426), ('loudest', 3.5)))],
        'woodpecker': [take(layer(freesound(102972), ('loudest', 2)))],
        'crow': [take(layer(freesound(361470))), take(layer(freesound(75162), ('loudest', 1.5)))],
        # A tawny owl's whole call, "hoo... hu, hu-hu-hoooo", a little quicker than it was recorded.
        'owl': [take(layer(freesound(465697), None, 0, 0, 1.1))],
        'cockerel': [take(layer(freesound(435508)))],
        'frog': [take(layer(freesound(354132), ('loudest', 1.2)))],
        'anvil': [take(layer(freesound(270588)))],
        'pick': [take(layer(freesound(233630)))],
        'creak': [take(layer(freesound(131924), ('loudest', 2.5)))],
        'arrow': [take(layer(freesound(321129)))],
        'chapelBell': [take(layer(freesound(378799)))],
        'crackle': each(lambda k: take(layer(freesound(364992), ('events', k, 2, 0.6))), (3, 9)),
    }


# Each pack, made only when it's built: the lowest it keeps, and its rate. The map's and the land's
# recordings carry a rumble under 40 Hz (wind, handling, a thud no phone or laptop plays) that would
# only be measured, not heard, so their packs keep what's over 50 Hz, the weight of a hoof or a spade
# included. The land's play quietly under the music, so 24 kHz (up to 12 kHz) keeps all they have.
PACKS = {'battle': (battle, 0, 32000), 'map': (everyday, 50, 32000), 'land': (land, 50, 24000)}


def build(name):
    global FLOOR, RATE
    make, FLOOR, RATE = PACKS[name]
    effects = make()
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
