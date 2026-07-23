import { Injectable } from '@nestjs/common';
import { AppLogger } from '../../common/logger/logger.service';

/**
 * Grammarify-backed description improver.
 *
 * `grammarify` (and its native `spellchecker` binding) is required *lazily* on
 * first use rather than at module load. This keeps bootstrap resilient: if the
 * native binding cannot be built/loaded in a given environment, the server still
 * starts and every other endpoint keeps working — and `/description/improve`
 * transparently falls back to a dependency-free improver so the feature still
 * returns an improved string.
 */
@Injectable()
export class DescriptionService {
  private grammarify: { clean: (input: string) => string } | null = null;
  private triedLoad = false;

  constructor(private readonly logger: AppLogger) {}

  async improve(raw: string): Promise<string> {
    const text = (raw ?? '').trim();
    if (!text) return raw ?? '';

    // Primary engine: Grammarify (local npm package, with a native spellchecker
    // binding). If it isn't available or throws, degrade gracefully to the
    // dependency-free fallback below so the feature always returns an improved
    // string instead of failing.
    const grammarify = this.resolveGrammarify();
    if (grammarify) {
      try {
        const improved = grammarify.clean(text);
        if (improved && improved.trim().length) return improved;
      } catch (err) {
        this.logger.warn(
          `Grammarify clean() failed (${err instanceof Error ? err.message : String(err)}); falling back to built-in improver.`,
          'Description',
        );
      }
    } else {
      this.logger.warn(
        'Grammarify unavailable, using built-in fallback improver.',
        'Description',
      );
    }

    return this.fallbackImprove(text);
  }

  /**
   * Dependency-free, safe text improvement used when Grammarify is unavailable.
   *
   * Performs only conservative, non-destructive transforms that are useful for a
   * short description field: collapse whitespace, normalise spacing around
   * punctuation, capitalise the first letter and after sentence stops, and
   * ensure the text ends with terminal punctuation. No spellchecking — it never
   * rewrites words, so it cannot mangle meaning.
   */
  private fallbackImprove(input: string): string {
    let text = input.replace(/\s+/g, ' ').trim();
    // Space after comma / semicolon / colon.
    text = text.replace(/\s*([,;:])\s*/g, '$1 ');
    // Capitalise the first character.
    text = text.charAt(0).toUpperCase() + text.slice(1);
    // Capitalise the first letter after a sentence-ending punctuation + space.
    text = text.replace(/([.!?]\s+)([a-z])/g, (_m, p1, p2) => p1 + p2.toUpperCase());
    // Append a terminal period if missing.
    if (!/[.!?]$/.test(text)) text = `${text}.`;
    return text;
  }

  /** Load grammarify once, caching the result (success or failure). */
  private resolveGrammarify(): { clean: (input: string) => string } | null {
    if (this.triedLoad) return this.grammarify;
    this.triedLoad = true;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      this.grammarify = require('grammarify');
    } catch (err) {
      this.grammarify = null;
      this.logger.warn(
        `Could not load grammarify: ${err instanceof Error ? err.message : String(err)}`,
        'Description',
      );
    }
    return this.grammarify;
  }
}
