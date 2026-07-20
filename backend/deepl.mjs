export const TARGET_LANGUAGE_CODES = Object.freeze({
  bg: 'BG',
  de: 'DE',
  en: 'EN-US',
  es: 'ES',
  ru: 'RU',
});

export class DeepLError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'DeepLError';
    this.status = status;
  }
}

export async function requestDeepLTranslation(
  text,
  targetLanguage,
  {
    apiKey,
    apiUrl,
    fetchImpl = fetch,
    timeoutMs = 20_000,
  },
) {
  let response;

  try {
    response = await fetchImpl(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `DeepL-Auth-Key ${apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'SnipLingo/0.0.0',
      },
      body: JSON.stringify({
        text: [text],
        target_lang: TARGET_LANGUAGE_CODES[targetLanguage],
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (isTimeoutError(error)) {
      throw new DeepLError(504, 'DeepL request timed out.');
    }

    throw error;
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throwDeepLError(response.status);
  }

  const translation = payload?.translations?.[0];
  if (
    typeof translation?.text !== 'string' ||
    typeof translation?.detected_source_language !== 'string'
  ) {
    throw new DeepLError(502, 'DeepL returned an invalid response.');
  }

  return {
    text: translation.text,
    detectedSourceLanguage: translation.detected_source_language,
  };
}

function throwDeepLError(status) {
  if (status === 401 || status === 403) {
    throw new DeepLError(502, 'DeepL authentication failed.');
  }
  if (status === 429) {
    throw new DeepLError(429, 'DeepL rate limit exceeded. Try again later.');
  }
  if (status === 456) {
    throw new DeepLError(402, 'DeepL character quota exceeded.');
  }

  throw new DeepLError(502, `DeepL upstream error (status ${status}).`);
}

function isTimeoutError(error) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error.name === 'TimeoutError' || error.name === 'AbortError')
  );
}
