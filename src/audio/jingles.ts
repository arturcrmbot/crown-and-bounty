/**
 * yubatake's jingles (CC BY 4.0, from his JRPG Collections), a few seconds of music each for a
 * moment that matters: a fight won or lost, a level, payday, Grimsby taken, gear found (#257). His
 * MIDI files are kept as they are in `public/assets/music/`, and each is played once on the band's
 * instruments as arranged here, as the music is. They load as sound wakes.
 */
import { readMidi } from './midi';
import { drums, notesOf, play, type Note, type Tune } from './score';

export type JingleId = 'winBattle' | 'winBattleBoss' | 'gameOver' | 'levelUp' | 'joinParty' | 'discovery';

export const JINGLES: Record<JingleId, Tune> = {
  // A fight won: trumpets up the chord, horns under them, the trombone and the timpani, and a drum fill.
  winBattle: {
    file: 'JRPG_winBattle.mid',
    title: 'Win Battle',
    parts: {
      Lead_Square: play('trumpet', 0.85),
      Middle_Square: play('horn', 0.75),
      Bass_Tri: [play('trombone', 0.75), play('timpani', 0.6)],
      Percussion: drums({ 69: 'tom', 70: 'tom', 71: 'snare', 72: 'snare', 73: 'crash' }, 0.45),
    },
    level: 1,
  },
  // Grimsby taken and the commission done: the same brass, longer, with strings and a gong.
  winBattleBoss: {
    file: 'JRPG_winBattleBoss.mid',
    title: 'Win Battle Boss',
    parts: {
      Lead_Square: play('trumpet', 0.85),
      Middle_Square: [play('horn', 0.7), play('strings', 0.35)],
      Bass_Tri: [play('trombone', 0.7), play('timpani', 0.5)],
      Percussion: drums({ 57: 'snare' }, 0.3),
      PinkNoiseGong: drums({ 38: 'crash' }, 0.6),
    },
    level: 1,
  },
  // A fight lost, or a commission: a horn over low strings.
  gameOver: {
    file: 'JRPG_gameOver.mid',
    title: 'Game Over',
    parts: { Lead_Tri: play('horn', 0.85), Middle_Pulse: play('strings', 0.6), Bass_Pulse: [play('cello', 0.7), play('timpani', 0.35)] },
    level: 1,
  },
  levelUp: {
    file: 'JRPG_levelUp.mid',
    title: 'Level Up',
    parts: { Lead_Pulse: play('trumpet', 0.85), Middle_Pulse: play('horn', 0.75) },
    level: 1,
  },
  // Payday: a flourish, the trumpets and horns running up together and the harp over them.
  joinParty: {
    file: 'JRPG_joinParty.mid',
    title: 'Join Party',
    parts: { Lead_Square: play('trumpet', 0.75), Middle_Square: play('horn', 0.65), Flourish_Tri: play('harp', 0.7) },
    level: 1,
  },
  // Gear found: the harp over the strings.
  discovery: {
    file: 'JRPG_discovery.mid',
    title: 'Discovery',
    parts: { Lead_Square: play('harp', 0.8), Lead_Square_Detuned: play('bells', 0.3), Pad_Tri: play('strings', 0.5) },
    level: 1,
  },
};

const notes = new Map<JingleId, Note[]>();
let loading: Promise<void> | null = null;

/** Fetches and reads every jingle, once (later calls wait on the first). */
export function loadJingles(base = import.meta.env.BASE_URL): Promise<void> {
  loading ??= Promise.all(
    (Object.keys(JINGLES) as JingleId[]).map((id) =>
      fetch(`${base}assets/music/${JINGLES[id].file}`)
        .then((r) => r.arrayBuffer())
        .then((b) => void notes.set(id, notesOf(JINGLES[id], readMidi(new Uint8Array(b))))),
    ),
  )
    .then(() => {})
    .catch((e) => {
      loading = null;
      throw e;
    });
  return loading;
}

/** A jingle's notes as the band plays them, once it has loaded (none until then). */
export const jingleNotes = (id: JingleId): Note[] => notes.get(id) ?? [];
