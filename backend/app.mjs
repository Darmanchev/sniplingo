import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  DeepLError,
  TARGET_LANGUAGE_CODES,
  requestDeepLTranslation,
} from './deepl.mjs';

export class HttpError extends Error {
  constructor(status, message, code, headers = {}) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.headers = headers;
  }
}

export function createApp({
  config,
  rateLimiter,
  dailyCharacterQuota,
  deeplQuotaGuard,
  translate = requestDeepLTranslation,
  logger = console,
  now = Date.now,
}) {
  const identifierSalt = randomBytes(32);

  return async function app(request, response) {
    const startedAt = now();
    const requestId = randomUUID();
    let status = 500;
    let characterCount = 0;
    let targetLanguage;
    let errorType;

    response.setHeader('X-Request-Id', requestId);

    try {
      const url = new URL(request.url ?? '/', 'http://sniplingo.internal');

      if (request.method === 'GET' && url.pathname === '/health') {
        status = 200;
        sendJson(response, status, { ok: true, provider: 'deepl' });
        return;
      }

      const origin = request.headers.origin;
      if (!isAllowedOrigin(origin, config)) {
        throw new HttpError(
          403,
          'Origin is not allowed.',
          'origin_not_allowed',
        );
      }
      setCorsHeaders(response, origin);

      if (request.method === 'OPTIONS') {
        status = 204;
        response.writeHead(status);
        response.end();
        return;
      }

      if (request.method !== 'POST' || url.pathname !== '/v1/translate') {
        throw new HttpError(404, 'Route not found.', 'route_not_found');
      }

      const identifier = hashIdentifier(
        readClientAddress(request, config.trustProxy),
        identifierSalt,
      );
      const requestLimit = rateLimiter.consume(identifier, now());
      response.setHeader('X-RateLimit-Remaining', requestLimit.remaining);
      if (!requestLimit.allowed) {
        throw rateLimitError(
          'Too many translation requests. Try again later.',
          'request_rate_limit',
          requestLimit.retryAfterSeconds,
        );
      }

      const body = await readJsonBody(request, config.maxRequestBytes);
      const text = readText(body);
      targetLanguage = readTargetLanguage(body);
      characterCount = countUnicodeCodePoints(text);

      if (characterCount > config.maxTextCharacters) {
        throw new HttpError(
          413,
          `Text must not exceed ${config.maxTextCharacters} characters.`,
          'text_too_large',
        );
      }

      const dailyLimit = dailyCharacterQuota.consume(
        identifier,
        characterCount,
        now(),
      );
      if (!dailyLimit.allowed) {
        throw rateLimitError(
          'Daily character limit exceeded.',
          'daily_character_limit',
          dailyLimit.retryAfterSeconds,
        );
      }

      if (!(await deeplQuotaGuard.reserve(characterCount, now()))) {
        throw new HttpError(
          503,
          'Translation quota is temporarily unavailable.',
          'deepl_quota_guard',
        );
      }

      const result = await translate(text, targetLanguage, {
        apiKey: config.deeplApiKey,
        apiUrl: config.deeplTranslateUrl,
        timeoutMs: config.deeplTimeoutMs,
        maxRetries: config.deeplMaxRetries,
        retryBaseDelayMs: config.deeplRetryBaseDelayMs,
        retryMaxDelayMs: config.deeplRetryMaxDelayMs,
      });

      status = 200;
      sendJson(response, status, {
        translatedText: result.text,
        detectedSourceLanguage: result.detectedSourceLanguage,
      });
    } catch (error) {
      if (error instanceof DeepLError && error.status === 402) {
        deeplQuotaGuard.markExceeded();
      }

      status =
        error instanceof HttpError || error instanceof DeepLError
          ? error.status
          : 500;
      errorType =
        error instanceof HttpError || error instanceof DeepLError
          ? error.code
          : 'internal_error';
      const message =
        error instanceof HttpError || error instanceof DeepLError
          ? error.message
          : 'Internal server error.';
      const headers = error instanceof HttpError ? error.headers : {};
      sendJson(response, status, { error: message }, headers);
    } finally {
      logger.info(
        JSON.stringify({
          requestId,
          status,
          durationMs: Math.max(0, now() - startedAt),
          characterCount,
          targetLanguage: targetLanguage ?? null,
          errorType: errorType ?? null,
        }),
      );
    }
  };
}

export function countUnicodeCodePoints(text) {
  let count = 0;
  for (const _character of text) count += 1;
  return count;
}

async function readJsonBody(request, maxRequestBytes) {
  const contentLength = Number(request.headers['content-length']);
  if (Number.isFinite(contentLength) && contentLength > maxRequestBytes) {
    throw new HttpError(
      413,
      'Request body is too large.',
      'request_body_too_large',
    );
  }

  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxRequestBytes) {
      throw new HttpError(
        413,
        'Request body is too large.',
        'request_body_too_large',
      );
    }
    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(
      400,
      'Request body must be valid JSON.',
      'invalid_json',
    );
  }
}

function readText(body) {
  const text = body?.text;
  if (typeof text !== 'string' || text.trim().length === 0) {
    throw new HttpError(400, 'Text is required.', 'invalid_text');
  }
  return text.trim();
}

function readTargetLanguage(body) {
  const language = body?.targetLanguage;
  if (
    typeof language !== 'string' ||
    !Object.hasOwn(TARGET_LANGUAGE_CODES, language)
  ) {
    throw new HttpError(
      400,
      'Target language is not supported.',
      'invalid_target_language',
    );
  }
  return language;
}

function isAllowedOrigin(origin, config) {
  if (origin === undefined) return config.allowMissingOrigin;
  if (/^moz-extension:\/\/[a-z0-9-]+$/i.test(origin)) return true;

  const chromeMatch = /^chrome-extension:\/\/([a-z0-9]+)$/i.exec(origin);
  if (!chromeMatch) return false;
  return (
    config.allowAnyChromeExtension ||
    config.allowedChromeExtensionIds.includes(chromeMatch[1].toLowerCase())
  );
}

function setCorsHeaders(response, origin) {
  if (origin !== undefined) {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Vary', 'Origin');
  }
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
}

function sendJson(response, status, body, headers = {}) {
  if (response.headersSent) return;
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  });
  response.end(JSON.stringify(body));
}

function readClientAddress(request, trustProxy) {
  if (trustProxy) {
    const forwardedFor = request.headers['x-forwarded-for'];
    const firstAddress = Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : forwardedFor?.split(',')[0];
    if (firstAddress?.trim()) return firstAddress.trim();
  }

  return request.socket.remoteAddress ?? 'unknown';
}

function hashIdentifier(identifier, salt) {
  return createHash('sha256').update(salt).update(identifier).digest('base64url');
}

function rateLimitError(message, code, retryAfterSeconds) {
  return new HttpError(429, message, code, {
    'Retry-After': String(retryAfterSeconds),
  });
}
