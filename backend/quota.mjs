export function createDeepLQuotaGuard({
  fetchUsage,
  stopRatio,
  refreshIntervalMs,
  onRefreshError = () => {},
}) {
  let characterCount = 0;
  let characterLimit = Number.POSITIVE_INFINITY;
  let providerBaseline;
  let locallyReserved = 0;
  let lastRefreshAt = 0;
  let refreshPromise;
  let quotaExceeded = false;
  let timer;

  async function refresh() {
    if (refreshPromise) return refreshPromise;

    refreshPromise = (async () => {
      try {
        const usage = await fetchUsage();
        if (providerBaseline === undefined) {
          providerBaseline = usage.characterCount;
        } else if (usage.characterCount < characterCount) {
          // DeepL started a new billing period.
          providerBaseline = usage.characterCount;
          locallyReserved = 0;
        }
        characterCount = usage.characterCount;
        characterLimit = usage.characterLimit;
        lastRefreshAt = Date.now();
        quotaExceeded = estimatedTotal() >= characterLimit * stopRatio;
        return true;
      } catch {
        onRefreshError();
        return false;
      } finally {
        refreshPromise = undefined;
      }
    })();

    return refreshPromise;
  }

  return {
    async reserve(characterDelta, now = Date.now()) {
      if (lastRefreshAt === 0 || now - lastRefreshAt >= refreshIntervalMs) {
        await refresh();
      }

      if (
        quotaExceeded ||
        estimatedTotal() + characterDelta >= characterLimit * stopRatio
      ) {
        return false;
      }

      locallyReserved += characterDelta;
      return true;
    },

    markExceeded() {
      quotaExceeded = true;
    },

    refresh,

    start() {
      if (timer) return;
      void refresh();
      timer = setInterval(() => void refresh(), refreshIntervalMs);
      timer.unref?.();
    },

    stop() {
      if (timer) clearInterval(timer);
      timer = undefined;
    },

    snapshot() {
      return {
        characterCount,
        characterLimit,
        estimatedSinceRefresh: Math.max(0, estimatedTotal() - characterCount),
        lastRefreshAt,
        quotaExceeded,
      };
    },
  };

  function estimatedTotal() {
    const localEstimate =
      (providerBaseline ?? characterCount) + locallyReserved;
    return Math.max(characterCount, localEstimate);
  }
}
