import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import {
  DeepLError,
  TARGET_LANGUAGE_CODES,
  requestDeepLTranslation,
} from './deepl.mjs';

const HOST = process.env.TRANSLATION_SERVER_HOST ?? '127.0.0.1';
const PORT = parsePort(process.env.TRANSLATION_SERVER_PORT ?? '8787');
const DEEPL_API_KEY = process.env.DEEPL_API_KEY?.trim();
const DEEPL_API_URL =
  process.env.DEEPL_API_URL ?? 'https://api-free.deepl.com/v2/translate';
const MAX_REQUEST_BYTES = 128 * 1024;
const REQUEST_TIMEOUT_MS = 20_000;

if (!DEEPL_API_KEY) {
  throw new Error('DEEPL_API_KEY is missing. Add it to .env.');
}

const server = createServer((request, response) => {
  void handleRequest(request, response).catch((error) => {
    const status =
      error instanceof HttpError || error instanceof DeepLError
        ? error.status
        : 500;
    const message =
      error instanceof HttpError || error instanceof DeepLError
        ? error.message
        : 'Internal server error.';

    if (!(error instanceof HttpError) && !(error instanceof DeepLError)) {
      console.error('Translation server error:', error);
    }

    sendJson(response, status, { error: message });
  });
});

server.listen(PORT, HOST, () => {
  console.log(`SnipLingo translation backend: http://${HOST}:${PORT}`);
});

async function handleRequest(request, response) {
  const origin = request.headers.origin;
  if (!isAllowedOrigin(origin)) {
    throw new HttpError(403, 'Origin is not allowed.');
  }

  setCorsHeaders(response, origin);

  if (request.method === 'OPTIONS') {
    response.writeHead(204);
    response.end();
    return;
  }

  const url = new URL(request.url ?? '/', `http://${HOST}:${PORT}`);

  if (request.method === 'GET' && url.pathname === '/health') {
    sendJson(response, 200, { ok: true, provider: 'deepl' });
    return;
  }

  if (request.method !== 'POST' || url.pathname !== '/v1/translate') {
    throw new HttpError(404, 'Route not found.');
  }

  const body = await readJsonBody(request);
  const text = readText(body);
  const targetLanguage = readTargetLanguage(body);
  const requestId = randomUUID();

  const result = await requestDeepLTranslation(text, targetLanguage, {
    apiKey: DEEPL_API_KEY,
    apiUrl: DEEPL_API_URL,
    timeoutMs: REQUEST_TIMEOUT_MS,
  });
  console.log(
    `[${requestId}] translated ${Buffer.byteLength(text, 'utf8')} bytes to ${targetLanguage}`,
  );

  sendJson(response, 200, {
    translatedText: result.text,
    detectedSourceLanguage: result.detectedSourceLanguage,
  });
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_REQUEST_BYTES) {
      throw new HttpError(413, 'Request body is too large.');
    }
    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'Request body must be valid JSON.');
  }
}

function readText(body) {
  const text = body?.text;
  if (typeof text !== 'string' || text.trim().length === 0) {
    throw new HttpError(400, 'Text is required.');
  }

  return text.trim();
}

function readTargetLanguage(body) {
  const language = body?.targetLanguage;
  if (
    typeof language !== 'string' ||
    !Object.hasOwn(TARGET_LANGUAGE_CODES, language)
  ) {
    throw new HttpError(400, 'Target language is not supported.');
  }

  return language;
}

function isAllowedOrigin(origin) {
  return (
    origin === undefined ||
    /^moz-extension:\/\/[a-z0-9-]+$/i.test(origin) ||
    /^chrome-extension:\/\/[a-z0-9]+$/i.test(origin)
  );
}

function setCorsHeaders(response, origin) {
  if (origin !== undefined) {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Vary', 'Origin');
  }
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
}

function sendJson(response, status, body) {
  if (response.headersSent) return;

  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(body));
}

function parsePort(value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('TRANSLATION_SERVER_PORT must be a valid TCP port.');
  }
  return port;
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
