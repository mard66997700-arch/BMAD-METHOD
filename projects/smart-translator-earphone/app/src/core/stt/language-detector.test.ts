import { LanguageDetector } from './language-detector';

describe('LanguageDetector', () => {
  test('returns the fallback language with no observations', () => {
    const detector = new LanguageDetector({ fallbackLang: 'en' });
    expect(detector.bestLang()).toBe('en');
    expect(detector.isLocked).toBe(false);
  });

  test('locks in the most-voted language after commitAfterFinals', () => {
    const detector = new LanguageDetector({ commitAfterFinals: 3 });
    detector.observe('es');
    detector.observe('es-ES');
    detector.observe('en');
    expect(detector.isLocked).toBe(true);
    expect(detector.bestLang()).toBe('es');
  });

  test('ignores subsequent votes once locked', () => {
    const detector = new LanguageDetector({ commitAfterFinals: 2 });
    detector.observe('fr');
    detector.observe('fr');
    expect(detector.bestLang()).toBe('fr');
    detector.observe('en');
    detector.observe('en');
    detector.observe('en');
    expect(detector.bestLang()).toBe('fr');
  });
});
