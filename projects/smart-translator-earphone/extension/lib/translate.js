/**
 * Free Google Translate provider — no API key. Mirrors the
 * `GoogleTranslateFreeProvider` shipped in the Expo app so the
 * extension stays consistent with the main translation pipeline.
 *
 * The endpoint is rate-limited and not officially supported; treat it
 * as a personal-use convenience.
 *
 * @param {{ text: string; sourceLang: string; targetLang: string; signal?: AbortSignal }} opts
 * @returns {Promise<{ text: string; detectedLang?: string }>}
 */
export async function translateFree({ text, sourceLang, targetLang, signal }) {
  if (!text.trim()) return { text: '' };
  const url = new URL('https://translate.googleapis.com/translate_a/single');
  url.searchParams.set('client', 'gtx');
  url.searchParams.set('sl', sourceLang || 'auto');
  url.searchParams.set('tl', targetLang);
  url.searchParams.set('dt', 't');
  url.searchParams.set('q', text);
  const res = await fetch(url.toString(), { signal });
  if (!res.ok) {
    throw new Error(`google-free translation failed: HTTP ${res.status}`);
  }
  const data = await res.json();
  // Response shape: [[ [ "Hello", "Xin chao", null, null, ... ], ... ], null, "vi", ...]
  const segments = Array.isArray(data?.[0]) ? data[0] : [];
  const translated = segments
    .map((seg) => (Array.isArray(seg) ? seg[0] : ''))
    .filter(Boolean)
    .join('');
  const detectedLang = typeof data?.[2] === 'string' ? data[2] : undefined;
  return { text: translated, detectedLang };
}
