import { describe, expect, it, vi } from 'vitest';
import {
  DeepLError,
  requestDeepLTranslation,
} from '../../backend/deepl.mjs';

const options = {
  apiKey: 'test-key',
  apiUrl: 'https://example.test/translate',
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

    await expect(request).rejects.toEqual(
      new DeepLError(504, 'DeepL request timed out.'),
    );
  });
});
