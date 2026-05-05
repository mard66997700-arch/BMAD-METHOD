/**
 * OpenAI GPT-4 translation provider — context-aware / nuanced translation.
 *
 * We POST a small chat-completion prompt that asks GPT-4 to translate the
 * input. When `translateStream()` is called, we set `stream: true` and parse
 * SSE chunks to yield the translation incrementally.
 *
 * This is the most expensive provider per character but produces the best
 * results when nuance matters — e.g. when the audio comes from a meeting,
 * lecture, or context-rich conversation.
 */

import type {
  TranslationProvider,
  TranslationRequest,
  TranslationResult,
} from './translation-types';

const ENDPOINT = 'https://api.openai.com/v1/chat/completions';

export interface OpenAiTranslationOptions {
  apiKey: string;
  model?: string;
  /** Override fetch (used by tests). */
  fetchFn?: typeof fetch;
}

export class OpenAiTranslationProvider implements TranslationProvider {
  readonly id = 'openai' as const;

  constructor(private readonly opts: OpenAiTranslationOptions) {}

  isAvailable(): boolean {
    return Boolean(this.opts.apiKey);
  }

  async translate(request: TranslationRequest): Promise<TranslationResult> {
    const fetchFn = this.opts.fetchFn ?? fetch;
    const res = await fetchFn(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.opts.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.opts.model ?? 'gpt-4o-mini',
        messages: buildMessages(request),
        temperature: 0.2,
      }),
    });
    if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}`);
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = json.choices?.[0]?.message?.content?.trim() ?? '';
    return {
      text,
      sourceLang: request.sourceLang === 'auto' ? 'auto' : request.sourceLang,
      targetLang: request.targetLang,
      engine: 'openai',
    };
  }

  async *translateStream(request: TranslationRequest): AsyncIterable<string> {
    const fetchFn = this.opts.fetchFn ?? fetch;
    const res = await fetchFn(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.opts.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.opts.model ?? 'gpt-4o-mini',
        messages: buildMessages(request),
        temperature: 0.2,
        stream: true,
      }),
    });
    if (!res.ok || !res.body) {
      const fallback = await this.translate(request);
      yield fallback.text;
      return;
    }
    let acc = '';
    const reader = (res.body as ReadableStream<Uint8Array>).getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl = buffer.indexOf('\n');
      while (nl >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        nl = buffer.indexOf('\n');
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (payload === '[DONE]') return;
        try {
          const json = JSON.parse(payload) as { choices?: Array<{ delta?: { content?: string } }> };
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) {
            acc += delta;
            yield acc;
          }
        } catch {
          // Ignore malformed chunks (some keep-alive payloads aren't JSON).
        }
      }
    }
  }
}

function buildMessages(request: TranslationRequest): Array<{ role: string; content: string }> {
  const sourceLabel = request.sourceLang === 'auto' ? 'the detected source language' : request.sourceLang;
  const system =
    `You are a professional translator. Translate the user's text from ${sourceLabel} to ${request.targetLang}. ` +
    'Preserve tone and meaning. Return ONLY the translated text — no explanations, no quotes, no language tags.';
  const userContent = request.context ? `Context: ${request.context}\n\nText: ${request.text}` : request.text;
  return [
    { role: 'system', content: system },
    { role: 'user', content: userContent },
  ];
}
