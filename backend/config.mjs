const DEFAULT_DEEPL_API_BASE_URL = 'https://api-free.deepl.com/v2';

export function loadConfig(environment = process.env) {
  const nodeEnvironment = environment.NODE_ENV ?? 'development';
  const deeplApiBaseUrl =
    environment.DEEPL_API_BASE_URL?.trim() || DEFAULT_DEEPL_API_BASE_URL;
  const deeplTranslateUrl =
    environment.DEEPL_API_URL?.trim() || `${deeplApiBaseUrl}/translate`;
  const inferredApiBaseUrl = environment.DEEPL_API_BASE_URL?.trim()
    ? deeplApiBaseUrl
    : deeplTranslateUrl.replace(/\/translate\/?$/, '');

  return Object.freeze({
    nodeEnvironment,
    host: environment.TRANSLATION_SERVER_HOST?.trim() || '127.0.0.1',
    port: readInteger(environment, 'TRANSLATION_SERVER_PORT', 8787, 1, 65_535),
    deeplApiKey: readRequired(environment, 'DEEPL_API_KEY'),
    deeplTranslateUrl,
    deeplUsageUrl:
      environment.DEEPL_USAGE_API_URL?.trim() || `${inferredApiBaseUrl}/usage`,
    deeplTimeoutMs: readInteger(
      environment,
      'DEEPL_REQUEST_TIMEOUT_MS',
      20_000,
      1_000,
      120_000,
    ),
    deeplMaxRetries: readInteger(
      environment,
      'DEEPL_MAX_RETRIES',
      2,
      0,
      5,
    ),
    deeplRetryBaseDelayMs: readInteger(
      environment,
      'DEEPL_RETRY_BASE_DELAY_MS',
      250,
      10,
      10_000,
    ),
    deeplRetryMaxDelayMs: readInteger(
      environment,
      'DEEPL_RETRY_MAX_DELAY_MS',
      5_000,
      10,
      30_000,
    ),
    deeplUsageRefreshMs: readInteger(
      environment,
      'DEEPL_USAGE_REFRESH_MS',
      5 * 60_000,
      10_000,
      60 * 60_000,
    ),
    deeplQuotaStopRatio: readNumber(
      environment,
      'DEEPL_QUOTA_STOP_RATIO',
      0.95,
      0.5,
      1,
    ),
    maxRequestBytes: readInteger(
      environment,
      'MAX_REQUEST_BYTES',
      32 * 1024,
      1_024,
      128 * 1024,
    ),
    maxTextCharacters: readInteger(
      environment,
      'MAX_TEXT_CHARACTERS',
      10_000,
      1,
      100_000,
    ),
    rateLimitRequests: readInteger(
      environment,
      'RATE_LIMIT_REQUESTS',
      20,
      1,
      10_000,
    ),
    rateLimitWindowMs: readInteger(
      environment,
      'RATE_LIMIT_WINDOW_MS',
      60_000,
      1_000,
      24 * 60 * 60_000,
    ),
    dailyCharacterLimit: readInteger(
      environment,
      'DAILY_CHARACTER_LIMIT',
      40_000,
      1,
      10_000_000,
    ),
    dailyQuotaWindowMs: readInteger(
      environment,
      'DAILY_QUOTA_WINDOW_MS',
      24 * 60 * 60_000,
      60_000,
      7 * 24 * 60 * 60_000,
    ),
    globalDailyCharacterLimit: readInteger(
      environment,
      'GLOBAL_DAILY_CHARACTER_LIMIT',
      250_000,
      1,
      100_000_000,
    ),
    logRequestMetrics: readBoolean(
      environment,
      'LOG_REQUEST_METRICS',
      false,
    ),
    logUsageMetrics: readBoolean(
      environment,
      'LOG_USAGE_METRICS',
      true,
    ),
    blockedClientAddresses: readList(environment.BLOCKED_CLIENT_ADDRESSES),
    trustProxy: readBoolean(environment, 'TRUST_PROXY', false),
    allowMissingOrigin: readBoolean(
      environment,
      'ALLOW_MISSING_ORIGIN',
      nodeEnvironment !== 'production',
    ),
    allowAnyChromeExtension: readBoolean(
      environment,
      'ALLOW_ANY_CHROME_EXTENSION',
      nodeEnvironment !== 'production',
    ),
    allowedChromeExtensionIds: readList(
      environment.ALLOWED_CHROME_EXTENSION_IDS,
    ),
  });
}

function readRequired(environment, name) {
  const value = environment[name]?.trim();
  if (!value) {
    throw new Error(`${name} is missing.`);
  }
  return value;
}

function readInteger(environment, name, fallback, minimum, maximum) {
  const rawValue = environment[name];
  if (rawValue === undefined || rawValue === '') return fallback;

  const value = Number(rawValue);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer from ${minimum} to ${maximum}.`);
  }
  return value;
}

function readNumber(environment, name, fallback, minimum, maximum) {
  const rawValue = environment[name];
  if (rawValue === undefined || rawValue === '') return fallback;

  const value = Number(rawValue);
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be a number from ${minimum} to ${maximum}.`);
  }
  return value;
}

function readBoolean(environment, name, fallback) {
  const rawValue = environment[name];
  if (rawValue === undefined || rawValue === '') return fallback;
  if (rawValue === 'true') return true;
  if (rawValue === 'false') return false;
  throw new Error(`${name} must be either true or false.`);
}

function readList(value) {
  if (!value) return Object.freeze([]);
  return Object.freeze(
    value
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  );
}
