import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createCharacterQuota,
  createRateLimiter,
} from '../../backend/rateLimit.mjs';

afterEach(() => vi.useRealTimers());

describe('in-memory request limits', () => {
  it('limits requests per identifier and resets after the window', () => {
    const limiter = createRateLimiter({ maxRequests: 2, windowMs: 60_000 });

    expect(limiter.consume('client', 1_000).allowed).toBe(true);
    expect(limiter.consume('client', 1_001).allowed).toBe(true);
    expect(limiter.consume('client', 1_002)).toMatchObject({
      allowed: false,
      retryAfterSeconds: 60,
    });
    expect(limiter.consume('client', 61_000).allowed).toBe(true);
    limiter.clear();
  });

  it('deletes expired records using TTL timers', () => {
    vi.useFakeTimers();
    const limiter = createRateLimiter({ maxRequests: 1, windowMs: 1_000 });
    limiter.consume('client');

    expect(limiter.size).toBe(1);
    vi.advanceTimersByTime(1_000);
    expect(limiter.size).toBe(0);
  });

  it('enforces a separate character quota', () => {
    const quota = createCharacterQuota({
      maxCharacters: 10_000,
      windowMs: 86_400_000,
    });

    expect(quota.consume('client', 7_000, 0).allowed).toBe(true);
    expect(quota.consume('client', 3_001, 1)).toMatchObject({
      allowed: false,
      remaining: 3_000,
    });
    quota.clear();
  });
});
