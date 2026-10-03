import { afterEach, describe, expect, it } from 'vitest';
import { language, setLanguage, translate } from './i18n';

afterEach(() => setLanguage('en'));

describe('localization', () => {
  it('keeps English as the default and leaves its words unchanged', () => {
    expect(language()).toBe('en');
    expect(translate('Continue')).toBe('Continue');
  });

  it('translates Polish interface text and dynamic battle instructions', () => {
    setLanguage('pl');
    expect(translate('Continue')).toBe('Kontynuuj');
    expect(translate('Cast Far Sight: pick a target (Esc to cancel)')).toBe('Rzuć zaklęcie Daleki Wzrok: wybierz cel (Esc, aby anulować)');
  });

  it('preserves unlisted text instead of altering game values', () => {
    setLanguage('pl');
    expect(translate('story flag: pikeLetter')).toBe('story flag: pikeLetter');
  });

  it('translates dynamic commission status messages', () => {
    setLanguage('pl');
    expect(translate('You are on day IV of Commission II.')).toBe('Jesteś w dniu IV misji II.');
    expect(translate('Commission I is complete, and the King is waiting for you at court.')).toBe('Misja I jest zakończona. Król czeka na ciebie na dworze.');
  });
});
