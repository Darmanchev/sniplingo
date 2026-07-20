import type {
  TargetLanguage,
  TranslationResult,
} from '@/types/translation';

const TRANSLATION_API_URL =
  import.meta.env.WXT_TRANSLATION_API_URL ??
  (import.meta.env.DEV
    ? 'http://127.0.0.1:8787/v1/translate'
    : undefined);
const REQUEST_TIMEOUT_MS = 25_000;

interface TranslationApiResponse {
  detectedSourceLanguage?: unknown;
  error?: unknown;
  translatedText?: unknown;
}

export async function translateText(
  text: string,
  targetLanguage: TargetLanguage,
): Promise<TranslationResult> {
  if (!TRANSLATION_API_URL) {
    throw new Error('Translation API URL is not configured.');
  }

  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(TRANSLATION_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, targetLanguage }),
      signal: abortController.signal,
    });
    const payload = (await response.json().catch(() => null)) as
      | TranslationApiResponse
      | null;

    if (!response.ok) {
      throw new Error(readApiError(payload, response.status));
    }

    if (
      typeof payload?.translatedText !== 'string' ||
      typeof payload.detectedSourceLanguage !== 'string'
    ) {
      throw new Error('Translation backend returned an invalid response.');
    }

    return {
      detectedSourceLanguage: payload.detectedSourceLanguage,
      translatedText: payload.translatedText,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Translation request timed out.');
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function readApiError(
  payload: TranslationApiResponse | null,
  status: number,
): string {
  return typeof payload?.error === 'string'
    ? payload.error
    : `Translation backend failed with status ${status}.`;
}
