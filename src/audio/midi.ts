/**
 * Reads a Standard MIDI File into what the band needs: each part (a track, by its name) as notes
 * in seconds, with the tempo changes worked in, and where the music comes round again: the end of
 * the tune, on the nearest bar line.
 */

export type MidiNote = { at: number; length: number; key: number; velocity: number };
export type MidiPart = { name: string; notes: MidiNote[] };
export type Midi = {
  parts: MidiPart[];
  /** Where the tune ends and, if it loops, comes round again: the bar line nearest the end of its longest track, in seconds. */
  seconds: number;
  /** Beats in a bar, from its first time signature (4 if it has none). */
  beatsPerBar: number;
};

/** A cursor over the file's bytes. */
class Reader {
  at = 0;
  constructor(readonly bytes: Uint8Array) {}
  byte = () => this.bytes[this.at++];
  word = (n: number) => {
    let v = 0;
    for (let i = 0; i < n; i++) v = (v << 8) | this.byte();
    return v >>> 0;
  };
  /** A variable-length quantity: seven bits a byte, high bit set on all but the last. */
  vlq = () => {
    let v = 0;
    for (let i = 0; i < 4; i++) {
      const b = this.byte();
      v = (v << 7) | (b & 0x7f);
      if (!(b & 0x80)) break;
    }
    return v;
  };
  text = (n: number) => String.fromCharCode(...this.bytes.subarray(this.at, (this.at += n)));
}

type Event = { tick: number; kind: 'on' | 'off'; channel: number; key: number; velocity: number };

export function readMidi(bytes: Uint8Array): Midi {
  const r = new Reader(bytes);
  if (r.text(4) !== 'MThd') throw new Error('Not a MIDI file');
  const headerLength = r.word(4);
  const start = r.at;
  r.word(2);
  const tracks = r.word(2);
  const division = r.word(2);
  if (division & 0x8000) throw new Error('SMPTE time is not supported');
  r.at = start + headerLength;

  const tempos: [tick: number, perBeat: number][] = [];
  let beatsPerBar = 0;
  let lastTick = 0;
  const raw: { name: string; events: Event[] }[] = [];
  for (let t = 0; t < tracks && r.at < bytes.length; t++) {
    const id = r.text(4);
    const length = r.word(4);
    const end = r.at + length;
    if (id !== 'MTrk') {
      r.at = end;
      continue;
    }
    let tick = 0;
    let status = 0;
    let name = `Track ${t}`;
    const events: Event[] = [];
    while (r.at < end) {
      tick += r.vlq();
      let b = r.byte();
      if (b === 0xff) {
        const type = r.byte();
        const n = r.vlq();
        if (type === 0x03) name = r.text(n);
        else if (type === 0x51) tempos.push([tick, ((bytes[r.at] << 16) | (bytes[r.at + 1] << 8) | bytes[r.at + 2]) / 1e6]);
        else if (type === 0x58 && !beatsPerBar) beatsPerBar = bytes[r.at] * (4 / 2 ** bytes[r.at + 1]);
        if (type !== 0x03) r.at += n;
        if (type === 0x2f) break;
        continue;
      }
      if (b === 0xf0 || b === 0xf7) {
        r.at += r.vlq();
        continue;
      }
      // Running status: a data byte where a status byte would be repeats the last status.
      if (b < 0x80) r.at--;
      else status = b;
      b = status;
      const kind = b & 0xf0;
      const channel = b & 0x0f;
      if (kind === 0xc0 || kind === 0xd0) {
        r.at++;
        continue;
      }
      const key = r.byte();
      const velocity = r.byte();
      if (kind === 0x90 && velocity > 0) events.push({ tick, kind: 'on', channel, key, velocity });
      else if (kind === 0x80 || kind === 0x90) events.push({ tick, kind: 'off', channel, key, velocity: 0 });
    }
    r.at = end;
    lastTick = Math.max(lastTick, tick);
    raw.push({ name, events });
  }

  // Ticks to seconds, through every change of tempo (120 a minute until the first).
  tempos.sort((a, b) => a[0] - b[0]);
  const marks: [tick: number, second: number, perTick: number][] = [[0, 0, 0.5 / division]];
  for (const [tick, perBeat] of tempos) {
    const [t0, s0, k0] = marks[marks.length - 1];
    const here: [number, number, number] = [tick, s0 + (tick - t0) * k0, perBeat / division];
    if (tick === t0) marks[marks.length - 1] = here;
    else marks.push(here);
  }
  const seconds = (tick: number) => {
    let m = marks[0];
    for (const next of marks) if (next[0] <= tick) m = next;
    return m[1] + (tick - m[0]) * m[2];
  };

  const parts: MidiPart[] = [];
  for (const { name, events } of raw) {
    const held = new Map<number, Event[]>();
    const notes: MidiNote[] = [];
    for (const e of events) {
      const id = e.channel * 128 + e.key;
      if (e.kind === 'on') {
        held.set(id, [...(held.get(id) ?? []), e]);
        continue;
      }
      const on = held.get(id)?.shift();
      if (on) notes.push({ at: seconds(on.tick), length: seconds(e.tick) - seconds(on.tick), key: on.key, velocity: on.velocity });
    }
    if (notes.length) parts.push({ name, notes: notes.sort((a, b) => a.at - b.at) });
  }
  beatsPerBar ||= 4;
  const bar = beatsPerBar * division;
  return { parts, seconds: seconds(Math.max(bar, Math.round(lastTick / bar) * bar)), beatsPerBar };
}
