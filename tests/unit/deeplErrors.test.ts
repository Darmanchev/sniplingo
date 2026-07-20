import { describe, expect, it, vi } from 'vitest';
import {
  requestDeepLUsage,
  requestDeepLTranslation,
} from '../../backend/deepl.mjs';

const options = {
  apiKey: 'test-key',
  apiUrl: 'https://example.test/translate',
  maxRetries: 0,
};

function responseWithStatus(status: number): Response {
  return new Response('{}', { status });
}

describe('DeepL error mapping', () => {
  it.each([401, 403])('maps %s to an authentication error', async (status) => {
    const request = requestDeepLTranslation('Hello', 'ru', {
      ...options,
      fetchImpl: vi.fn().mockResolvedValue(responseWithStatus(status)),
    });

    await expect(request).rejects.toMatchObject({
      name: 'DeepLError',
      status: 502,
      message: 'DeepL authentication failed.',
    });
  });

  it.each([
    [429, 429, 'DeepL rate limit exceeded. Try again later.'],
    [456, 402, 'DeepL character quota exceeded.'],
    [500, 502, 'DeepL upstream error (status 500).'],
  ])('maps upstream status %s', async (upstreamStatus, status, message) => {
    const request = requestDeepLTranslation('Hello', 'ru', {
      ...options,
      fetchImpl: vi
        .fn()
        .mockResolvedValue(responseWithStatus(upstreamStatus)),
    });

    await expect(request).rejects.toMatchObject({ status, message });
  });

  it.each(['TimeoutError', 'AbortError'])('maps %s to a timeout error', async (name) => {
    const timeout = new Error('aborted');
    timeout.name = name;
    const request = requestDeepLTranslation('Hello', 'ru', {
      ...options,
      fetchImpl: vi.fn().mockRejectedValue(timeout),
    });

    await expect(request).rejects.toMatchObject({
      name: 'DeepLError',
      status: 504,
      code: 'deepl_timeout',
      message: 'DeepL request timed out.',
    });
  });

  it('retries 429 with exponential backoff', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(responseWithStatus(429))
      .mockResolvedValueOnce(responseWithStatus(429))
      .mockResolvedValueOnce(
        Response.json({
          translations: [
            { text: 'Привет', detected_source_language: 'EN' },
          ],
        }),
      );
    const sleepImpl = vi.fn().mockResolvedValue(undefined);

    await expect(
      requestDeepLTranslation('Hello', 'ru', {
        ...options,
        maxRetries: 2,
        retryBaseDelayMs: 100,
        fetchImpl,
        sleepImpl,
      }),
    ).resolves.toMatchObject({ text: 'Привет' });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleepImpl).toHaveBeenNthCalledWith(1, 100);
    expect(sleepImpl).toHaveBeenNthCalledWith(2, 200);
  });

  it('reads character usage without exposing credentials in the result', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      Response.json({ character_count: 450_000, character_limit: 500_000 }),
    );

    await expect(
      requestDeepLUsage({ ...options, fetchImpl }),
    ).resolves.toEqual({
      characterCount: 450_000,
      characterLimit: 500_000,
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      options.apiUrl,
      expect.objectContaining({ method: 'GET' }),
    );
  });
});
