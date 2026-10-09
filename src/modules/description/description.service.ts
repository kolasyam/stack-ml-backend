import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppLogger } from '../../common/logger/logger.service';

/**
 * OpenRouter & Grammarify-backed description improver.
 *
 * Uses OpenRouter AI (poolside/laguna-xs-2.1:free) as the primary engine to fix
 * grammar, spelling, and tone. Falls back to Grammarify and local fallback if
 * API key or network is unavailable.
 */
@Injectable()
export class DescriptionService {
  private grammarify: { clean: (input: string) => string } | null = null;
  private triedLoad = false;

  constructor(
    private readonly logger: AppLogger,
    private readonly configService: ConfigService,
  ) {}

  async improve(raw: string): Promise<string> {
    const text = (raw ?? '').trim();
    if (!text) return raw ?? '';

    // Primary engine: OpenRouter API
    const apiKey =
      this.configService.get<string>('app.openRouterApiKey') ||
      process.env.OPENROUTER_API_KEY;
    const model =
      this.configService.get<string>('app.openRouterModel') ||
      'poolside/laguna-xs-2.1:free';

    if (apiKey) {
      try {
        const response = await fetch(
          'https://openrouter.ai/api/v1/chat/completions',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model,
              messages: [
                {
                  role: 'system',
                  content:
                    'You are an expert editor for an online learning platform.\n\nImprove the user\'s learning resource description.\n\nRules:\n- Fix spelling and grammar.\n- Improve sentence structure.\n- Make the description clear and professional.\n- Preserve the original meaning.\n- Do not invent facts or add information.\n- Keep it concise.\n- Return ONLY the improved description.\n- Do not use quotation marks around the answer.\n- Do not explain what you changed.',
                },
                {
                  role: 'user',
                  content: text,
                },
              ],
              temperature: 0.3,
              max_tokens: 1000,
            }),
          },
        );

        if (response.ok) {
          const data = (await response.json()) as {
            choices?: { message?: { content?: string, reasoning?: string } }[];
          };
          
          const message = data?.choices?.[0]?.message;
          let improved = message?.content?.trim();
          
          // If using a reasoning model and it hit max_tokens before writing content,
          // it might only have reasoning available. Or it might have output it in reasoning.
          if (!improved && message?.reasoning) {
            improved = message.reasoning.trim();
          }
          if (improved) {
            if (
              (improved.startsWith('"') && improved.endsWith('"')) ||
              (improved.startsWith("'") && improved.endsWith("'"))
            ) {
              improved = improved.slice(1, -1).trim();
            }
            if (improved.length > 0) {
              return improved;
            }
          }
        } else {
          const errorText = await response.text();
          this.logger.warn(
            `OpenRouter API returned status ${response.status}: ${errorText}`,
            'Description',
          );
        }
      } catch (err) {
        this.logger.warn(
          `OpenRouter API call failed (${err instanceof Error ? err.message : String(err)}); falling back.`,
          'Description',
        );
      }
    }

    // Secondary engine: Grammarify
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
      // eslint-disable-next-line @typescript-eslint/no-require-imports
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
