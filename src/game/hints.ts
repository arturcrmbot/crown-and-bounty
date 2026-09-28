export type HintId = 'ride' | 'place' | 'tired' | 'payday';

type HintStorage = Pick<Storage, 'getItem' | 'setItem'>;

const KEY = 'kings-commission/hints/v1';

const browserStorage = (): HintStorage | null => {
  try {
    return localStorage;
  } catch {
    return null;
  }
};

/** Remembers the small control hints a player has already met, independently of campaign saves. */
export class FirstTimeHints {
  private readonly seen = new Set<HintId>();

  constructor(private readonly storage: HintStorage | null = browserStorage()) {
    try {
      const saved = JSON.parse(this.storage?.getItem(KEY) ?? '[]');
      if (Array.isArray(saved)) for (const id of saved) if (id === 'ride' || id === 'place' || id === 'tired' || id === 'payday') this.seen.add(id);
    } catch {
      // A bad or unavailable store only means the hints may appear again next time.
    }
  }

  /** True once for each hint, when it should be shown. */
  take(id: HintId): boolean {
    if (this.seen.has(id)) return false;
    this.seen.add(id);
    try {
      this.storage?.setItem(KEY, JSON.stringify([...this.seen]));
    } catch {
      // The page still remembers until it is closed.
    }
    return true;
  }
}
