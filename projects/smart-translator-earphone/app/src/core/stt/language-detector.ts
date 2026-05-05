/**
 * Light-weight language detector that observes the first few finals from a
 * speaker and votes on a `detectedLang` value.
 *
 * The actual language identification is delegated to the underlying STT
 * provider (Whisper returns `language`; Google returns `languageCode`); this
 * detector simply aggregates the votes so the rest of the app can rely on a
 * single stable value per session.
 *
 * Once `commitAfterFinals` finals have been observed, the detector locks in
 * its top vote and returns it on subsequent `bestLang` calls.
 */

export interface LanguageDetectorOptions {
  /** Number of finals required before locking. Default 3. */
  commitAfterFinals?: number;
  /** Fallback language if no votes were observed. Default 'en'. */
  fallbackLang?: string;
}

export class LanguageDetector {
  private readonly votes = new Map<string, number>();
  private finalsSeen = 0;
  private locked: string | null = null;
  private readonly commitAfter: number;
  private readonly fallback: string;

  constructor(options: LanguageDetectorOptions = {}) {
    this.commitAfter = options.commitAfterFinals ?? 3;
    this.fallback = options.fallbackLang ?? 'en';
  }

  observe(detectedLang: string | undefined): void {
    if (this.locked) return;
    if (!detectedLang) return;
    const normalized = detectedLang.split('-')[0]!.toLowerCase();
    this.votes.set(normalized, (this.votes.get(normalized) ?? 0) + 1);
    this.finalsSeen += 1;
    if (this.finalsSeen >= this.commitAfter) this.locked = this.computeTop();
  }

  /** True once `commitAfterFinals` finals have been observed. */
  get isLocked(): boolean {
    return this.locked !== null;
  }

  bestLang(): string {
    return this.locked ?? this.computeTop();
  }

  private computeTop(): string {
    let bestLang = this.fallback;
    let bestVotes = 0;
    for (const [lang, votes] of this.votes) {
      if (votes > bestVotes) {
        bestLang = lang;
        bestVotes = votes;
      }
    }
    return bestLang;
  }
}
