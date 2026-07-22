import type { IncomingMessage, ServerResponse } from 'node:http';

interface LimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

interface AppConfig {
  deeplApiKey: string;
  deeplTranslateUrl: string;
  deeplTimeoutMs: number;
  deeplMaxRetries: number;
  deeplRetryBaseDelayMs: number;
  deeplRetryMaxDelayMs: number;
  maxRequestBytes: number;
  maxTextCharacters: number;
  globalDailyCharacterLimit: number;
  logRequestMetrics: boolean;
  logUsageMetrics: boolean;
  blockedClientAddresses: readonly string[];
  trustProxy: boolean;
  allowMissingOrigin: boolean;
  allowAnyChromeExtension: boolean;
  allowedChromeExtensionIds: readonly string[];
}

interface AppOptions {
  config: AppConfig;
  rateLimiter: { consume(identifier: string, now?: number): LimitResult };
  dailyCharacterQuota: {
    consume(
      identifier: string,
      characterCount: number,
      now?: number,
    ): LimitResult;
  };
  globalDailyCharacterQuota: {
    consume(
      identifier: string,
      characterCount: number,
      now?: number,
    ): LimitResult;
  };
  deeplQuotaGuard: {
    reserve(characterCount: number, now?: number): Promise<boolean>;
    markExceeded(): void;
  };
  translate?: (...arguments_: any[]) => Promise<{
    text: string;
    detectedSourceLanguage: string;
  }>;
  logger?: { info(message: string): void };
  now?: () => number;
}

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly headers: Record<string, string>;
}

export function createApp(
  options: AppOptions,
): (request: IncomingMessage, response: ServerResponse) => Promise<void>;

export function countUnicodeCodePoints(text: string): number;
