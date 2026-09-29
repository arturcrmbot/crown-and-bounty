/**
 * Plays the sound effects (see `audio/effects.ts`) on the effects bus of the shared audio context,
 * each at its level. Browsers only allow sound after the player has clicked or pressed a key, so
 * the audio starts then. M mutes it, and that sticks.
 */
import { audio, isMuted } from '../audio/context';
import { babble, EFFECTS, type EffectDef, type EffectId, type Ground } from '../audio/effects';
import { duckMusic } from '../audio/music';
import { sting } from '../audio/stings';
import { Terrain } from '../rules/map/model';

export type Sound = EffectId | 'victory' | 'defeat' | 'levelUp';

/** Sound effects go to the effects bus of the shared audio context (see `audio/context.ts`). */
export { toggleMute, wakeAudio as wakeSound } from '../audio/context';

/** The last few effects asked for, footfalls aside, for scripts to check: what a player would have heard. */
const asked: string[] = [];
export const effectsHeard = () => [...asked];

/** Plays an effect at its level, `delay` seconds from now, from the left or the right (`pan`, -1 to 1). */
function sound(id: EffectId, pan: number, delay: number) {
  sounded(EFFECTS[id], pan, delay);
}

function sounded(def: EffectDef, pan: number, delay: number) {
  const a = audio();
  if (!a || isMuted()) return;
  try {
    const { ctx, sfx } = a;
    const out = ctx.createGain();
    out.gain.value = def.level;
    const side = pan ? ctx.createStereoPanner() : null;
    if (side) {
      side.pan.value = Math.max(-1, Math.min(1, pan));
      out.connect(side).connect(sfx);
    } else out.connect(sfx);
    def.play(ctx, out, ctx.currentTime + 0.01 + delay);
    // Music over music clashes: the score steps back a little under a fanfare or a song.
    if (def.duck) duckMusic(def.duck + delay, 0.5);
    // Let go of it once the longest of them (a troll's groan) has rung out.
    setTimeout(() => (side ?? out).disconnect(), (delay + 4) * 1000);
  } catch {
    // A sound that can't be made is not worth stopping the game for.
  }
}

export function play(id: Sound, pan = 0, delay = 0) {
  asked.push(id);
  if (asked.length > 120) asked.shift();
  if (id === 'victory' || id === 'defeat' || id === 'levelUp') {
    if (audio() && !isMuted()) sting(id);
    return;
  }
  sound(id, pan, delay);
}

/**
 * Someone says `words` aloud in his own voice: a babble around `pitch` (Hz), about a syllable a word,
 * at the level of the `speech` effect. A villain taken says his last words this way.
 */
export function speak(pitch: number, words: string) {
  asked.push('speech');
  if (asked.length > 120) asked.shift();
  const syllables = Math.min(12, Math.max(3, Math.round(words.split(' ').length * 1.2)));
  sounded({ ...EFFECTS.speech, play: babble(pitch, syllables) }, 0, 0);
}

const GROUND: Partial<Record<Terrain, Ground>> = { [Terrain.Road]: 'road', [Terrain.Bridge]: 'bridge', [Terrain.Ford]: 'ford', [Terrain.Forest]: 'forest' };

/** One footfall (or hoofbeat, mounted), coloured by the terrain underfoot. */
export function playStep(terrain: Terrain, rides: boolean) {
  sound(`${rides ? 'hoof' : 'foot'}:${GROUND[terrain] ?? 'grass'}`, 0, 0);
}
