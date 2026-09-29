import { describe, expect, it } from 'vitest';
import { newGame } from '../rules/scenario';
import { tiredResult } from './adventureCards';

describe('the tired card', () => {
  it.each([2, 8])('still appears on day %i', (day) => {
    const state = { ...newGame(), day, flags: { 'hint:rest': true } };
    const result = tiredResult(state, false, [10, 20]);
    const event = result.events.find((item) => item.type === 'card');

    expect(event?.type === 'card' && event.card.title).toBe('Your legs are spent');
    expect(event?.type === 'card' && event.card.choices.map((choice) => choice.label)).toEqual(['End the day (E)', 'Not yet']);
  });
});
