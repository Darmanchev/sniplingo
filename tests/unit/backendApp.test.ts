import { createServer, type Server } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../backend/app.mjs';
import {
  createCharacterQuota,
  createRateLimiter,
} from '../../backend/rateLimit.mjs';

let server: Server | undefined;

afterEach(async () => {
  if (server) await new Promise<void>((resolve) => server?.close(() => resolve()));
  server = undefined;
});

describe('translation HTTP app', () => {
  it('enforces origin and Unicode text limits without logging text', async () => {
    const translate = vi.fn().mockResolvedValue({
      text: 'translated-secret',
      detectedSourceLanguage: 'EN',
    });
    const logger = { info: vi.fn() };
    const app = createApp({
      config: {
        deeplApiKey: 'server-secret',
        deeplTranslateUrl: 'https://example.test/translate',
        deeplTimeoutMs: 1_000,
        deeplMaxRetries: 0,
        deeplRetryBaseDelayMs: 10,
        deeplRetryMaxDelayMs: 100,
        maxRequestBytes: 1_024,
        maxTextCharacters: 3,
        globalDailyCharacterLimit: 3,
        logRequestMetrics: false,
        logUsageMetrics: false,
        blockedClientAddresses: [],
        trustProxy: false,
        allowMissingOrigin: false,
        allowAnyChromeExtension: false,
        allowedChromeExtensionIds: ['allowedid'],
      },
      rateLimiter: createRateLimiter({ maxRequests: 10, windowMs: 60_000 }),
      dailyCharacterQuota: createCharacterQuota({
        maxCharacters: 100,
        windowMs: 60_000,
      }),
      globalDailyCharacterQuota: createCharacterQuota({
        maxCharacters: 3,
        windowMs: 60_000,
      }),
      deeplQuotaGuard: {
        reserve: vi.fn().mockResolvedValue(true),
        markExceeded: vi.fn(),
      },
      translate,
      logger,
    });

    server = createServer(app);
    await new Promise<void>((resolve) =>
      server?.listen(0, '127.0.0.1', () => resolve()),
    );
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('No test port.');
    const endpoint = `http://127.0.0.1:${address.port}/v1/translate`;

    const accepted = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'chrome-extension://allowedid',
      },
      body: JSON.stringify({ text: 'A🚀Б', targetLanguage: 'ru' }),
    });
    expect(accepted.status).toBe(200);
    expect(translate).toHaveBeenCalledOnce();

    const exhaustedBudget = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'chrome-extension://allowedid',
      },
      body: JSON.stringify({ text: 'ABC', targetLanguage: 'ru' }),
    });
    expect(exhaustedBudget.status).toBe(503);
    await expect(exhaustedBudget.json()).resolves.toEqual({
      error: 'The daily translation budget is temporarily exhausted.',
    });
    expect(translate).toHaveBeenCalledOnce();

    const tooLong = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'chrome-extension://allowedid',
      },
      body: JSON.stringify({ text: 'A🚀БC', targetLanguage: 'ru' }),
    });
    expect(tooLong.status).toBe(413);

    const missingOrigin = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'secret-ocr-text', targetLanguage: 'ru' }),
    });
    expect(missingOrigin.status).toBe(403);

    const logs = logger.info.mock.calls.flat().join('\n');
    expect(logger.info).not.toHaveBeenCalled();
    expect(logs).not.toContain('A🚀Б');
    expect(logs).not.toContain('secret-ocr-text');
    expect(logs).not.toContain('translated-secret');
    expect(logs).not.toContain('server-secret');
  });
});
