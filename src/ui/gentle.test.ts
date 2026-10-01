import { describe, expect, it } from 'vitest';
import { gentleFrom, isGentle, setGentle } from './gentle';

describe('gentle effects', () => {
  it('follow what the player chose, and the device until they choose', () => {
    expect(gentleFrom(null, false)).toBe(false);
    expect(gentleFrom(null, true)).toBe(true);
    expect(gentleFrom('1', false)).toBe(true);
    expect(gentleFrom('0', true)).toBe(false);
  });

  it('can be switched on and off, even where nothing can be stored', () => {
    setGentle(true);
    expect(isGentle()).toBe(true);
    setGentle(false);
    expect(isGentle()).toBe(false);
  });
});
