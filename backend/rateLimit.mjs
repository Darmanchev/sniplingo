export function createRateLimiter({ maxRequests, windowMs }) {
  const records = new Map();

  return {
    consume(identifier, now = Date.now()) {
      let record = records.get(identifier);
      if (!record || record.expiresAt <= now) {
        record = createRecord(records, identifier, windowMs, now, { count: 0 });
      }

      if (record.count >= maxRequests) {
        return {
          allowed: false,
          remaining: 0,
          retryAfterSeconds: secondsUntil(record.expiresAt, now),
        };
      }

      record.count += 1;
      return {
        allowed: true,
        remaining: maxRequests - record.count,
        retryAfterSeconds: 0,
      };
    },

    clear() {
      for (const record of records.values()) clearTimeout(record.timer);
      records.clear();
    },

    get size() {
      return records.size;
    },
  };
}

export function createCharacterQuota({ maxCharacters, windowMs }) {
  const records = new Map();

  return {
    consume(identifier, characterCount, now = Date.now()) {
      let record = records.get(identifier);
      if (!record || record.expiresAt <= now) {
        record = createRecord(records, identifier, windowMs, now, {
          characterCount: 0,
        });
      }

      if (record.characterCount + characterCount > maxCharacters) {
        return {
          allowed: false,
          remaining: Math.max(0, maxCharacters - record.characterCount),
          retryAfterSeconds: secondsUntil(record.expiresAt, now),
        };
      }

      record.characterCount += characterCount;
      return {
        allowed: true,
        remaining: maxCharacters - record.characterCount,
        retryAfterSeconds: 0,
      };
    },

    clear() {
      for (const record of records.values()) clearTimeout(record.timer);
      records.clear();
    },

    get size() {
      return records.size;
    },
  };
}

function createRecord(records, identifier, windowMs, now, values) {
  const record = {
    ...values,
    expiresAt: now + windowMs,
    timer: undefined,
  };
  record.timer = setTimeout(() => {
    if (records.get(identifier) === record) records.delete(identifier);
  }, windowMs);
  record.timer.unref?.();
  records.set(identifier, record);
  return record;
}

function secondsUntil(expiresAt, now) {
  return Math.max(1, Math.ceil((expiresAt - now) / 1_000));
}
