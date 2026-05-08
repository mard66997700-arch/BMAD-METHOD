/**
 * Glossary / custom translation terms.
 *
 * Users can register pairs like `{ source: "Original sin", target: "Tội nguyên tổ" }`
 * so the translator preserves domain-specific terminology that the
 * generic provider would otherwise mangle.
 *
 * The technique is the standard placeholder-substitution approach:
 *
 *   1. Before sending the source text to the translation provider, replace
 *      each glossary match with a non-translatable token (e.g. `__G0__`).
 *      Most providers leave ASCII tokens of that shape untouched in the
 *      output.
 *   2. After translation, swap the tokens back for the user's chosen
 *      target string.
 *
 * Entries with `sourceLang` / `targetLang` filters apply only to matching
 * directions; entries without filters apply universally.
 */

export interface GlossaryEntry {
  source: string;
  target: string;
  /** If set, only applies when the source language matches. */
  sourceLang?: string;
  /** If set, only applies when the target language matches. */
  targetLang?: string;
  /** Default false. When true, distinguishes "Apple" from "apple". */
  caseSensitive?: boolean;
  /**
   * Default true. When true the source pattern is anchored to ASCII word
   * boundaries (`\b`). Set to false for languages without word boundaries
   * (e.g. Chinese, Japanese, Thai) or for partial-word matches.
   */
  wholeWord?: boolean;
}

export interface AppliedGlossary {
  text: string;
  /** token → target replacement. Empty when no entries matched. */
  placeholders: ReadonlyMap<string, string>;
}

const TOKEN_PREFIX = '__G';
const TOKEN_SUFFIX = '__';

/**
 * Filter the entry list down to the ones that apply to a given direction.
 * Entries with no `sourceLang` filter apply to every source language;
 * likewise for `targetLang`. When `sourceLang` is the literal string
 * `'auto'`, only filter by `targetLang`.
 */
export function entriesForDirection(
  entries: readonly GlossaryEntry[],
  sourceLang: string | 'auto',
  targetLang: string,
): GlossaryEntry[] {
  return entries.filter((e) => {
    if (e.sourceLang && sourceLang !== 'auto' && e.sourceLang !== sourceLang) {
      return false;
    }
    if (e.targetLang && e.targetLang !== targetLang) {
      return false;
    }
    return e.source.length > 0 && e.target.length > 0;
  });
}

/**
 * Replace glossary matches in `text` with opaque tokens. Returns the
 * rewritten text plus a token → target map suitable for
 * `restoreGlossary()`.
 */
export function applyGlossary(
  text: string,
  entries: readonly GlossaryEntry[],
  sourceLang: string | 'auto',
  targetLang: string,
): AppliedGlossary {
  const applicable = entriesForDirection(entries, sourceLang, targetLang);
  if (applicable.length === 0) {
    return { text, placeholders: new Map() };
  }
  // Sort longest-first so "Original sin" wins over "Original".
  const sorted = applicable.slice().sort((a, b) => b.source.length - a.source.length);
  const placeholders = new Map<string, string>();
  let working = text;
  let counter = 0;
  for (const entry of sorted) {
    const pattern = buildPattern(entry);
    let token: string | null = null;
    working = working.replace(pattern, () => {
      if (!token) {
        token = `${TOKEN_PREFIX}${counter}${TOKEN_SUFFIX}`;
        counter += 1;
        placeholders.set(token, entry.target);
      }
      return token;
    });
  }
  return { text: working, placeholders };
}

/**
 * Reverse the substitution: replace each token in `translated` with the
 * mapped target term. Tokens missing from the translated text (because the
 * provider rewrote them) are dropped silently — callers can still display
 * the translation, just without the glossary swap.
 */
export function restoreGlossary(
  translated: string,
  placeholders: ReadonlyMap<string, string>,
): string {
  if (placeholders.size === 0) return translated;
  let working = translated;
  for (const [token, target] of placeholders) {
    // Replace every occurrence; some providers duplicate placeholders.
    working = working.split(token).join(target);
  }
  // Most providers preserve our tokens untouched. Some lowercase them, add
  // spaces between underscores, or strip leading/trailing underscores —
  // accept any of those mutations as long as the digit and `G` survive.
  for (const [token, target] of placeholders) {
    const idx = token.slice(TOKEN_PREFIX.length, -TOKEN_SUFFIX.length);
    const lenient = new RegExp(
      `_{1,2}\\s?[Gg]\\s?${idx}\\s?_{0,2}`,
      'g',
    );
    working = working.replace(lenient, target);
  }
  return working;
}

function buildPattern(entry: GlossaryEntry): RegExp {
  const flags = entry.caseSensitive ? 'g' : 'gi';
  const escaped = escapeRegex(entry.source);
  // Default to whole-word matching for Latin sources; Chinese / Japanese /
  // Thai sources need to opt out.
  const wholeWord = entry.wholeWord !== false;
  if (!wholeWord) return new RegExp(escaped, flags);
  // `\b` only fires at ASCII word boundaries. For sources like "OK?" the
  // trailing punctuation already prevents an internal match, so this is
  // safe for most user input.
  return new RegExp(`\\b${escaped}\\b`, flags);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
