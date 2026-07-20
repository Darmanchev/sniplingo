import { describe, expect, it, vi } from 'vitest';
import { createDeepLQuotaGuard } from '../../backend/quota.mjs';

describe('DeepL quota guard', () => {
  it('combines DeepL usage with locally reserved characters', async () => {
    const guard = createDeepLQuotaGuard({
      fetchUsage: vi.fn().mockResolvedValue({
        characterCount: 89,
        characterLimit: 100,
      }),
      stopRatio: 0.95,
      refreshIntervalMs: 60_000,
    });

    await expect(guard.reserve(5, 1)).resolves.toBe(true);
    await expect(guard.reserve(1, 2)).resolves.toBe(false);
  });

  it('blocks immediately after a provider quota response', async () => {
    const guard = createDeepLQuotaGuard({
      fetchUsage: vi.fn().mockRejectedValue(new Error('unavailable')),
      stopRatio: 0.95,
      refreshIntervalMs: 60_000,
    });

    guard.markExceeded();
    await expect(guard.reserve(1)).resolves.toBe(false);
  });

  it('fails open when usage is temporarily unavailable', async () => {
    const onRefreshError = vi.fn();
    const guard = createDeepLQuotaGuard({
      fetchUsage: vi.fn().mockRejectedValue(new Error('unavailable')),
      stopRatio: 0.95,
      refreshIntervalMs: 60_000,
      onRefreshError,
    });

    await expect(guard.reserve(10)).resolves.toBe(true);
    expect(onRefreshError).toHaveBeenCalledOnce();
  });

  it('keeps local estimates that are not reflected by the usage API yet', async () => {
    const fetchUsage = vi
      .fn()
      .mockResolvedValueOnce({ characterCount: 50, characterLimit: 100 })
      .mockResolvedValueOnce({ characterCount: 52, characterLimit: 100 });
    const guard = createDeepLQuotaGuard({
      fetchUsage,
      stopRatio: 0.95,
      refreshIntervalMs: 60_000,
    });

    await expect(guard.reserve(10, 1)).resolves.toBe(true);
    await guard.refresh();

    expect(guard.snapshot().estimatedSinceRefresh).toBe(8);
  });
});
