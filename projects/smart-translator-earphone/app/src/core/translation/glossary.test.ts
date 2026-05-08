import {
  applyGlossary,
  entriesForDirection,
  restoreGlossary,
  type GlossaryEntry,
} from './glossary';

describe('glossary', () => {
  describe('entriesForDirection', () => {
    test('keeps entries with no language filters', () => {
      const entries: GlossaryEntry[] = [{ source: 'hi', target: 'xin chào' }];
      const out = entriesForDirection(entries, 'en', 'vi');
      expect(out).toEqual(entries);
    });

    test('filters by source language when set', () => {
      const entries: GlossaryEntry[] = [
        { source: 'hi', target: 'xin chào', sourceLang: 'en', targetLang: 'vi' },
      ];
      expect(entriesForDirection(entries, 'fr', 'vi')).toHaveLength(0);
      expect(entriesForDirection(entries, 'en', 'vi')).toHaveLength(1);
    });

    test('filters by target language when set', () => {
      const entries: GlossaryEntry[] = [
        { source: 'hi', target: 'xin chào', targetLang: 'vi' },
      ];
      expect(entriesForDirection(entries, 'en', 'fr')).toHaveLength(0);
      expect(entriesForDirection(entries, 'en', 'vi')).toHaveLength(1);
    });

    test('treats auto-source as wildcard for sourceLang', () => {
      const entries: GlossaryEntry[] = [
        { source: 'hi', target: 'xin chào', sourceLang: 'en', targetLang: 'vi' },
      ];
      expect(entriesForDirection(entries, 'auto', 'vi')).toHaveLength(1);
    });

    test('drops empty source/target rows', () => {
      const entries: GlossaryEntry[] = [
        { source: '', target: 'something' },
        { source: 'something', target: '' },
        { source: 'real', target: 'thật' },
      ];
      expect(entriesForDirection(entries, 'en', 'vi')).toHaveLength(1);
    });
  });

  describe('applyGlossary + restoreGlossary', () => {
    test('returns input unchanged when no entries match', () => {
      const out = applyGlossary('Hello world', [], 'en', 'vi');
      expect(out.text).toBe('Hello world');
      expect(out.placeholders.size).toBe(0);
    });

    test('substitutes tokens for case-insensitive matches', () => {
      const entries: GlossaryEntry[] = [{ source: 'Original sin', target: 'Tội nguyên tổ' }];
      const out = applyGlossary('We talked about original sin today', entries, 'en', 'vi');
      expect(out.text).not.toContain('original sin');
      expect(out.text).toMatch(/__G\d+__/);
      const restored = restoreGlossary(out.text, out.placeholders);
      expect(restored).toBe('We talked about Tội nguyên tổ today');
    });

    test('preserves case sensitivity when requested', () => {
      const entries: GlossaryEntry[] = [
        { source: 'Apple', target: 'Quả táo', caseSensitive: true },
      ];
      const out = applyGlossary('apple Apple APPLE', entries, 'en', 'vi');
      // Only the exact-case 'Apple' should be replaced.
      const restored = restoreGlossary(out.text, out.placeholders);
      expect(restored).toBe('apple Quả táo APPLE');
    });

    test('respects whole-word boundaries by default', () => {
      const entries: GlossaryEntry[] = [{ source: 'cat', target: 'mèo' }];
      const out = applyGlossary('a cat sits on a category', entries, 'en', 'vi');
      const restored = restoreGlossary(out.text, out.placeholders);
      expect(restored).toBe('a mèo sits on a category');
    });

    test('allows partial-word matches when wholeWord=false', () => {
      const entries: GlossaryEntry[] = [
        { source: '原罪', target: 'Tội nguyên tổ', wholeWord: false },
      ];
      const out = applyGlossary('我们谈论原罪今天', entries, 'zh', 'vi');
      const restored = restoreGlossary(out.text, out.placeholders);
      expect(restored).toBe('我们谈论Tội nguyên tổ今天');
    });

    test('handles longer entries first so suffix matches do not break prefix', () => {
      const entries: GlossaryEntry[] = [
        { source: 'Original', target: 'Nguyên' },
        { source: 'Original sin', target: 'Tội nguyên tổ' },
      ];
      const out = applyGlossary('Original sin and Original art', entries, 'en', 'vi');
      const restored = restoreGlossary(out.text, out.placeholders);
      expect(restored).toBe('Tội nguyên tổ and Nguyên art');
    });

    test('escapes regex metacharacters in source', () => {
      const entries: GlossaryEntry[] = [{ source: 'C++', target: 'Xê cộng cộng', wholeWord: false }];
      const out = applyGlossary('I love C++ code', entries, 'en', 'vi');
      const restored = restoreGlossary(out.text, out.placeholders);
      expect(restored).toBe('I love Xê cộng cộng code');
    });

    test('restoreGlossary recovers from common provider mutations', () => {
      const entries: GlossaryEntry[] = [{ source: 'Original sin', target: 'Tội nguyên tổ' }];
      const applied = applyGlossary('Original sin', entries, 'en', 'vi');
      // Simulate Google rewriting `__G0__` to `__ g 0 __` with spaces.
      const corrupted = applied.text.replace(/__G(\d+)__/, '__ g $1 __');
      expect(restoreGlossary(corrupted, applied.placeholders)).toBe('Tội nguyên tổ');
    });

    test('restoreGlossary leaves the translation alone when tokens vanish', () => {
      const entries: GlossaryEntry[] = [{ source: 'foo', target: 'bar' }];
      const out = applyGlossary('foo', entries, 'en', 'vi');
      // Provider replaced the token with something else entirely.
      expect(restoreGlossary('completely different', out.placeholders)).toBe('completely different');
    });
  });
});
