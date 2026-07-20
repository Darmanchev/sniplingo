export const TARGET_LANGUAGE_CODES = Object.freeze({
  bg: 'BG',
  de: 'DE',
  en: 'EN-US',
  es: 'ES',
  ru: 'RU',
});

export class DeepLError extends Error {
  constructor(status, message, code = 'deepl_error') {
    super(message);
    this.name = 'DeepLError';
    this.status = status;
    this.code = code;
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
    maxRetries = 2,
    retryBaseDelayMs = 250,
    retryMaxDelayMs = 5_000,
    sleepImpl = sleep,
  },
) {
  for (let attempt = 0; ; attempt += 1) {
    const response = await makeRequest(fetchImpl, apiUrl, apiKey, timeoutMs, {
      text: [text],
      target_lang: TARGET_LANGUAGE_CODES[targetLanguage],
    });

    if (response.status === 429 && attempt < maxRetries) {
      const retryAfterMs = readRetryAfterMs(response.headers.get('retry-after'));
      const exponentialDelayMs = retryBaseDelayMs * 2 ** attempt;
      await sleepImpl(
        Math.min(retryMaxDelayMs, Math.max(retryAfterMs, exponentialDelayMs)),
      );
      continue;
    }

    const payload = await response.json().catch(() => null);
    if (!response.ok) throwDeepLError(response.status);

    const translation = payload?.translations?.[0];
    if (
      typeof translation?.text !== 'string' ||
      typeof translation?.detected_source_language !== 'string'
    ) {
      throw new DeepLError(
        502,
        'DeepL returned an invalid response.',
        'deepl_invalid_response',
      );
    }

    return {
      text: translation.text,
      detectedSourceLanguage: translation.detected_source_language,
    };
  }
}

export async function requestDeepLUsage({
  apiKey,
  apiUrl,
  fetchImpl = fetch,
  timeoutMs = 20_000,
}) {
  const response = await makeRequest(fetchImpl, apiUrl, apiKey, timeoutMs);
  const payload = await response.json().catch(() => null);
  if (!response.ok) throwDeepLError(response.status);

  if (
    !Number.isFinite(payload?.character_count) ||
    !Number.isFinite(payload?.character_limit) ||
    payload.character_count < 0 ||
    payload.character_limit <= 0
  ) {
    throw new DeepLError(
      502,
      'DeepL returned invalid usage data.',
      'deepl_invalid_usage',
    );
  }

  return {
    characterCount: payload.character_count,
    characterLimit: payload.character_limit,
  };
}

async function makeRequest(fetchImpl, apiUrl, apiKey, timeoutMs, body) {
  try {
    return await fetchImpl(apiUrl, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        Authorization: `DeepL-Auth-Key ${apiKey}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        'User-Agent': 'SnipLingo/0.0.0',
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (isTimeoutError(error)) {
      throw new DeepLError(
        504,
        'DeepL request timed out.',
        'deepl_timeout',
      );
    }

    throw new DeepLError(502, 'DeepL request failed.', 'deepl_network_error');
  }
}

function throwDeepLError(status) {
  if (status === 401 || status === 403) {
    throw new DeepLError(
      502,
      'DeepL authentication failed.',
      'deepl_authentication',
    );
  }
  if (status === 429) {
    throw new DeepLError(
      429,
      'DeepL rate limit exceeded. Try again later.',
      'deepl_rate_limit',
    );
  }
  if (status === 456) {
    throw new DeepLError(
      402,
      'DeepL character quota exceeded.',
      'deepl_quota',
    );
  }

  throw new DeepLError(
    502,
    `DeepL upstream error (status ${status}).`,
    'deepl_upstream',
  );
}

function readRetryAfterMs(value) {
  if (!value) return 0;

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;

  const date = Date.parse(value);
  return Number.isNaN(date) ? 0 : Math.max(0, date - Date.now());
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isTimeoutError(error) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error.name === 'TimeoutError' || error.name === 'AbortError')
  );
}
