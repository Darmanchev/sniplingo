interface DeepLUsage {
  characterCount: number;
  characterLimit: number;
}

interface QuotaSnapshot extends DeepLUsage {
  estimatedSinceRefresh: number;
  lastRefreshAt: number;
  quotaExceeded: boolean;
}

export function createDeepLQuotaGuard(options: {
  fetchUsage: () => Promise<DeepLUsage>;
  stopRatio: number;
  refreshIntervalMs: number;
  onRefreshError?: () => void;
}): {
  reserve(characterDelta: number, now?: number): Promise<boolean>;
  markExceeded(): void;
  refresh(): Promise<boolean>;
  start(): void;
  stop(): void;
  snapshot(): QuotaSnapshot;
};
