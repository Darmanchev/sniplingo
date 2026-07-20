interface LimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

interface Store {
  clear(): void;
  readonly size: number;
}

export function createRateLimiter(options: {
  maxRequests: number;
  windowMs: number;
}): Store & {
  consume(identifier: string, now?: number): LimitResult;
};

export function createCharacterQuota(options: {
  maxCharacters: number;
  windowMs: number;
}): Store & {
  consume(
    identifier: string,
    characterCount: number,
    now?: number,
  ): LimitResult;
};
