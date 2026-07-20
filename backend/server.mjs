import { createServer } from 'node:http';
import { createApp } from './app.mjs';
import { loadConfig } from './config.mjs';
import { requestDeepLUsage } from './deepl.mjs';
import { createDeepLQuotaGuard } from './quota.mjs';
import { createCharacterQuota, createRateLimiter } from './rateLimit.mjs';

const config = loadConfig();
const rateLimiter = createRateLimiter({
  maxRequests: config.rateLimitRequests,
  windowMs: config.rateLimitWindowMs,
});
const dailyCharacterQuota = createCharacterQuota({
  maxCharacters: config.dailyCharacterLimit,
  windowMs: config.dailyQuotaWindowMs,
});
const deeplQuotaGuard = createDeepLQuotaGuard({
  fetchUsage: () =>
    requestDeepLUsage({
      apiKey: config.deeplApiKey,
      apiUrl: config.deeplUsageUrl,
      timeoutMs: config.deeplTimeoutMs,
    }),
  stopRatio: config.deeplQuotaStopRatio,
  refreshIntervalMs: config.deeplUsageRefreshMs,
  onRefreshError: () =>
    console.warn(
      JSON.stringify({
        event: 'deepl_usage_refresh',
        errorType: 'deepl_usage_unavailable',
      }),
    ),
});
const app = createApp({
  config,
  rateLimiter,
  dailyCharacterQuota,
  deeplQuotaGuard,
});
const server = createServer(app);

deeplQuotaGuard.start();
server.listen(config.port, config.host, () => {
  console.log(
    JSON.stringify({
      event: 'server_started',
      host: config.host,
      port: config.port,
      environment: config.nodeEnvironment,
    }),
  );
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    deeplQuotaGuard.stop();
    rateLimiter.clear();
    dailyCharacterQuota.clear();
    server.close(() => process.exit(0));
  });
}
