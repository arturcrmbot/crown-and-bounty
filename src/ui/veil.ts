import './veil.css';

let veiled = false;
let unveiling: ReturnType<typeof setTimeout> | null = null;
const listeners: (() => void)[] = [];

/** Whether cards are waiting out of sight for a screen change to finish. */
export const isVeiled = () => veiled;

/** Runs `f` each time the veil lifts. */
export function onUnveil(f: () => void) {
  listeners.push(f);
}

/** Hides every card while a screen changes (`true`); `false` lets them unfold again. */
export function setVeil(on: boolean) {
  if (on === veiled || typeof document === 'undefined') return;
  veiled = on;
  const body = document.body.classList;
  body.toggle('kc-veiled', on);
  if (unveiling) clearTimeout(unveiling);
  unveiling = null;
  body.remove('kc-unveiling');
  if (on) return;
  body.add('kc-unveiling');
  unveiling = setTimeout(() => body.remove('kc-unveiling'), 250);
  for (const f of listeners) f();
}
