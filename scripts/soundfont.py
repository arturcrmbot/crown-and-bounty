"""
The band's instruments: the few General MIDI instruments the score uses, cut out of GeneralUser GS
(S. Christian Collins's free SoundFont, pinned below) into one small sample pack the game loads,
`public/assets/music/band.flac` and `band.json`.

For each instrument it keeps the zones a note in its range could play (`RANGES` in
`src/audio/band.ts`, which the score folds every note into): one velocity layer, one layer of a
layered sound, one side of a stereo pair, and every `STRIDE`th sample where the SoundFont has more
than a small band needs. Each zone keeps its sample, root key, tuning, loop and volume envelope,
and a gain that brings every instrument to the same loudness at full volume. The samples are
resampled to 22 kHz at most, as a 90s sound card had them, with each loop resampled as the cycle
it is so it stays seamless, and a tail that rings longer than `TAIL` seconds is faded out there.
They are stored one after another in a single FLAC file, which is lossless, so they play exactly as
cut, and the game decodes it once as it loads (`src/audio/band.ts`). (A 4-bit ADPCM pack was a third
of the size, but Artur heard its hiss at the start of every note, on 1 Oct.)

Needs Python 3 with numpy (`pip3 install numpy`), and ffmpeg.

    python3 scripts/soundfont.py              (downloads the SoundFont to /tmp the first time)
    python3 scripts/soundfont.py path/to/GeneralUser-GS.sf2
"""
import json, math, os, struct, subprocess, sys, urllib.request
from array import array

import numpy as np

COMMIT = '684543d5e5efaef08d02be50dcda8d552478fa60'  # GeneralUser GS v2.0.3
URL = f'https://github.com/mrbumpy409/GeneralUser-GS/raw/{COMMIT}/GeneralUser-GS.sf2'
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets', 'music')

# Our name for each instrument, and its General MIDI program (bank 0).
MELODIC = {
    'flute': 73, 'oboe': 68, 'recorder': 74, 'horn': 60, 'trumpet': 56, 'trombone': 57,
    'harp': 46, 'harpsichord': 6, 'guitar': 24, 'bells': 14, 'timpani': 47,
    'strings': 48, 'violin': 40, 'viola': 41, 'cello': 42, 'upright': 32,
}
# The drums, from the standard kit (bank 128, program 0): our name and its General MIDI key.
DRUMS = {'kick': 36, 'stick': 37, 'snare': 38, 'tom': 45, 'crash': 49, 'ride': 51}
# The keys each instrument plays, as `RANGES` in src/audio/band.ts has them (its test checks the two agree).
RANGES = {
    'flute': (60, 96), 'recorder': (60, 96), 'oboe': (58, 91), 'horn': (41, 77), 'trumpet': (52, 84), 'trombone': (40, 72),
    'harp': (36, 96), 'harpsichord': (36, 96), 'guitar': (40, 79), 'bells': (60, 77), 'timpani': (36, 57),
    'strings': (40, 88), 'violin': (53, 100), 'viola': (40, 88), 'cello': (36, 76), 'upright': (33, 64),
}
# Keep every Nth sample of these: their notes are a few keys apart, and a pad or a flute bends further well.
STRIDE = {'strings': 2, 'flute': 2, 'guitar': 2, 'trumpet': 2, 'trombone': 2, 'violin': 2, 'viola': 3, 'cello': 3}
RATE = 22050
TAIL = {'crash': 1.6, 'ride': 1.4, 'tom': 1.0, 'timpani': 1.6, 'bells': 2.2}

# Generators (SoundFont 2.04, section 8.1.2).
START, END, LOOP_START, LOOP_END, START_COARSE = 0, 1, 2, 3, 4
FILTER_FC, FILTER_Q, END_COARSE = 8, 9, 12
ATTACK, HOLD, DECAY, SUSTAIN, RELEASE = 34, 35, 36, 37, 38
INSTRUMENT, KEY_RANGE, VEL_RANGE, LOOP_START_COARSE = 41, 43, 44, 45
ATTENUATION, LOOP_END_COARSE, COARSE_TUNE, FINE_TUNE, SAMPLE, SAMPLE_MODES, ROOT_KEY = 48, 50, 51, 52, 53, 54, 58
DEFAULTS = {FILTER_FC: 13500, FILTER_Q: 0, ATTACK: -12000, HOLD: -12000, DECAY: -12000, SUSTAIN: 0, RELEASE: -12000, ATTENUATION: 0, COARSE_TUNE: 0, FINE_TUNE: 0}
RANGE_GENS = (KEY_RANGE, VEL_RANGE)


def chunks(data, at, end):
    while at < end:
        tag, size = data[at:at + 4].decode('latin1'), struct.unpack_from('<I', data, at + 4)[0]
        yield tag, at + 8, size
        at += 8 + size + (size & 1)


def read(path):
    data = open(path, 'rb').read()
    assert data[:4] == b'RIFF' and data[8:12] == b'sfbk', 'not a SoundFont'
    found = {}
    for tag, at, size in chunks(data, 12, len(data)):
        if tag == 'LIST':
            for sub, sat, ssize in chunks(data, at + 4, at + size):
                found[sub] = (sat, ssize)
    smpl_at, smpl_size = found['smpl']
    smpl = array('h')
    smpl.frombytes(data[smpl_at:smpl_at + smpl_size])

    def records(tag, fmt):
        at, size = found[tag]
        n = struct.calcsize(fmt)
        return [struct.unpack_from(fmt, data, at + i * n) for i in range(size // n)]

    def gens(tag):
        out = []
        for oper, amount in records(tag, '<HH'):
            if oper in RANGE_GENS:
                out.append((oper, (amount & 0xFF, amount >> 8)))
            else:
                out.append((oper, amount - 65536 if amount >= 32768 else amount))
        return out

    phdr = records('phdr', '<20sHHHIII')
    pbag, pgen = records('pbag', '<HH'), gens('pgen')
    inst, ibag, igen = records('inst', '<20sH'), records('ibag', '<HH'), gens('igen')
    shdr = records('shdr', '<20sIIIIIBbHH')

    def zones(bags, gen, first, last):
        out = [dict(gen[bags[b][0]:bags[b + 1][0]]) for b in range(first, last)]
        return out

    presets = {}
    for i in range(len(phdr) - 1):
        name, program, bank, bag = phdr[i][:4]
        presets[(bank, program)] = zones(pbag, pgen, bag, phdr[i + 1][3])
    instruments = [zones(ibag, igen, inst[i][1], inst[i + 1][1]) for i in range(len(inst) - 1)]
    return presets, instruments, shdr, smpl


def flatten(preset, instruments, shdr):
    """Every (preset zone, instrument zone) pair that sounds: its key and velocity range and its merged generators."""
    pglobal = preset[0] if preset and INSTRUMENT not in preset[0] else {}
    for pz in preset:
        if INSTRUMENT not in pz:
            continue
        izones = instruments[pz[INSTRUMENT]]
        iglobal = izones[0] if izones and SAMPLE not in izones[0] else {}
        for iz in izones:
            if SAMPLE not in iz:
                continue
            p = {**pglobal, **pz}
            g = {**iglobal, **iz}
            key = intersect(p.get(KEY_RANGE, (0, 127)), g.get(KEY_RANGE, (0, 127)))
            vel = intersect(p.get(VEL_RANGE, (0, 127)), g.get(VEL_RANGE, (0, 127)))
            if not key or not vel:
                continue
            merged = {k: g.get(k, DEFAULTS.get(k, 0)) + (p.get(k, 0) if k not in (SAMPLE, SAMPLE_MODES, ROOT_KEY) else 0) for k in set(DEFAULTS) | set(g) | set(p) if k not in RANGE_GENS + (INSTRUMENT,)}
            merged[SAMPLE] = g[SAMPLE]
            merged[SAMPLE_MODES] = g.get(SAMPLE_MODES, 0)
            merged[ROOT_KEY] = g.get(ROOT_KEY, -1)
            yield key, vel, merged


def intersect(a, b):
    lo, hi = max(a[0], b[0]), min(a[1], b[1])
    return (lo, hi) if lo <= hi else None


seconds = lambda timecents: round(2 ** (timecents / 1200), 4)


def zone_of(key, vel, g, shdr):
    name, start, end, loop_start, loop_end, rate, pitch, correction, link, kind = shdr[g[SAMPLE]]
    start += g.get(START, 0) + 32768 * g.get(START_COARSE, 0)
    end += g.get(END, 0) + 32768 * g.get(END_COARSE, 0)
    loop_start += g.get(LOOP_START, 0) + 32768 * g.get(LOOP_START_COARSE, 0)
    loop_end += g.get(LOOP_END, 0) + 32768 * g.get(LOOP_END_COARSE, 0)
    root = g[ROOT_KEY] if g[ROOT_KEY] >= 0 else pitch
    return {
        'keys': list(key), 'vels': list(vel), 'kind': kind, 'name': name.split(b'\0')[0].decode('latin1'),
        'start': start, 'end': end, 'loopStart': loop_start, 'loopEnd': loop_end, 'rate': rate,
        'root': root, 'tune': g[COARSE_TUNE] * 100 + g[FINE_TUNE] + correction,
        'loop': g[SAMPLE_MODES] in (1, 3),
        'attack': seconds(g[ATTACK]), 'hold': seconds(g[HOLD]), 'decay': seconds(g[DECAY]),
        # Sustain is an attenuation in centibels; FluidSynth reads the initial attenuation at 0.4 of
        # its value, as the EMU cards did, and so do we.
        'sustain': round(10 ** (-max(0, g[SUSTAIN]) / 200), 4), 'release': seconds(g[RELEASE]),
        'attenuation': round(10 ** (-0.4 * max(0, g[ATTENUATION]) / 200), 4),
        'cutoff': round(8.176 * 2 ** (g[FILTER_FC] / 1200)) if g[FILTER_FC] < 13500 else None,
    }


def pick(zones, at_key=None, keys=(0, 127), stride=1):
    """
    One velocity layer (the one a note at velocity 100 plays), one side of a stereo pair (the left,
    or mono), the first of a layered sound (a zone over keys an earlier one already covers is the
    next layer), only zones that reach into `keys`, and every `stride`th of those, each stretched
    over the keys of the ones left out.
    """
    kept, covered = [], set()
    for z in zones:
        if not (z['vels'][0] <= 100 <= z['vels'][1] and z['kind'] & 0x7 in (1, 4)):
            continue
        span = set(range(z['keys'][0], z['keys'][1] + 1))
        if span & covered:
            continue
        covered |= span
        kept.append(z)
    if at_key is not None:
        return [z for z in kept if z['keys'][0] <= at_key <= z['keys'][1]][:1]
    kept = sorted((z for z in kept if z['keys'][1] >= keys[0] and z['keys'][0] <= keys[1]), key=lambda z: z['keys'][0])
    if stride > 1:
        thinned = kept[::stride]
        for a, b in zip(thinned, thinned[1:]):
            mid = (a['root'] + b['root']) // 2
            a['keys'][1], b['keys'][0] = mid, mid + 1
        kept = thinned
    kept[0]['keys'][0], kept[-1]['keys'][1] = 0, 127
    return kept


def resample(data, rate, loop, loop_start, loop_end, tail):
    """
    Band-limited resampling (a windowed sinc) down to `RATE`. A looped sample's loop is resampled as
    one cycle of a repeating sound, to a whole number of samples (the zone's rate shifts a hair to
    keep its pitch), so it joins as cleanly as before; nothing after the loop is ever heard, so it goes.
    """
    x = np.asarray(data, dtype=np.float64)
    if loop:
        x = x[:loop_end]
    elif tail:
        x = x[:int(rate * tail)]
        fade = min(len(x), int(rate * 0.25))
        x[len(x) - fade:] *= np.linspace(1, 0, fade)
    if rate <= RATE:
        return x, rate, loop_start, loop_end
    q = RATE / rate
    if loop:
        span = loop_end - loop_start
        q = round(span * q) / span
    n = int(round(len(x) * q))
    pos = np.arange(n) / q
    taps = 24
    base = np.floor(pos).astype(np.int64)
    out = np.zeros(n)
    for k in range(-taps + 1, taps + 1):
        idx = base + k
        if loop:
            over = idx >= loop_end
            idx = np.where(over, loop_start + (idx - loop_start) % (loop_end - loop_start), idx)
        valid = (idx >= 0) & (idx < len(x))
        t = (pos - (base + k)) * q
        w = np.sinc(t) * q * (0.5 + 0.5 * np.cos(np.pi * np.clip((pos - (base + k)) / taps, -1, 1)))
        out += np.where(valid, x[np.clip(idx, 0, len(x) - 1)], 0) * w
    if loop:
        return out, rate * q, int(round(loop_start * q)), int(round(loop_end * q))
    return out, rate * q, 0, n


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else '/tmp/GeneralUser-GS.sf2'
    if not os.path.exists(path):
        print(f'Downloading GeneralUser GS ({COMMIT[:7]})...')
        urllib.request.urlretrieve(URL, path)
    presets, instruments, shdr, smpl = read(path)
    band, used = {}, {}
    for ours, program in MELODIC.items():
        zones = [zone_of(k, v, g, shdr) for k, v, g in flatten(presets[(0, program)], instruments, shdr)]
        band[ours] = pick(zones, keys=RANGES[ours], stride=STRIDE.get(ours, 1))
    for ours, key in DRUMS.items():
        zones = [zone_of(k, v, g, shdr) for k, v, g in flatten(presets[(128, 0)], instruments, shdr)]
        z = pick(zones, key)
        assert z, ours
        band[ours] = [{**z[0], 'keys': [key, key], 'drum': True}]
    # Each sample once, in a single pack, trimmed to what a zone plays and resampled.
    pack, samples = [], []
    at = 0
    for ours, zones in band.items():
        for z in zones:
            span = (z['start'], z['end'], z['loopStart'], z['loopEnd'], z['loop'])
            if span not in used:
                data, rate, ls, le = resample(smpl[z['start']:z['end']], z['rate'], z['loop'], z['loopStart'] - z['start'], z['loopEnd'] - z['start'], TAIL.get(ours, 2.5))
                pcm = np.clip(np.round(data), -32768, 32767).astype(np.int16)
                # How loud the sample sounds, as the mean power of its first half second (or its
                # loop): the gain that brings every instrument to the same level at full volume.
                body = data[:max(1, int(rate * 0.5))]
                level = math.sqrt(float(np.mean(body * body))) / 32768
                used[span] = (len(samples), level)
                samples.append({'offset': at, 'length': len(pcm), 'rate': round(rate, 3), 'loopStart': ls, 'loopEnd': le})
                pack.append(pcm)
                at += len(pcm)
            z['sample'], level = used[span]
            z['gain'] = round(min(50, 1 / max(1e-6, level)), 4)
            for k in ('start', 'end', 'kind', 'vels', 'name', 'loopStart', 'loopEnd', 'rate', 'attenuation'):
                z.pop(k)
    os.makedirs(OUT, exist_ok=True)
    raw = os.path.join(OUT, 'band.raw')
    np.concatenate(pack).astype('<i2').tofile(raw)
    flac = os.path.join(OUT, 'band.flac')
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-f', 's16le', '-ar', str(RATE), '-ac', '1', '-i', raw, '-c:a', 'flac', '-compression_level', '12', flac], check=True)
    os.remove(raw)
    with open(os.path.join(OUT, 'band.json'), 'w') as f:
        json.dump({'source': f'GeneralUser GS v2.0.3 ({COMMIT[:7]})', 'rate': RATE, 'samples': samples, 'instruments': band}, f, separators=(',', ':'))
    print(f'{len(band)} instruments, {sum(len(z) for z in band.values())} zones, {len(samples)} samples, {os.path.getsize(flac) / 1e6:.2f} MB')
    for ours, zones in band.items():
        print(f"  {ours:12s} {len(zones)} zones  " + ' '.join(f"{z['keys'][0]}-{z['keys'][1]}{'L' if z['loop'] else ''}" for z in zones))


if __name__ == '__main__':
    main()
