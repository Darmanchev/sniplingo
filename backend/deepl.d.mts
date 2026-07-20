export const TARGET_LANGUAGE_CODES: Readonly<
  Record<'bg' | 'de' | 'en' | 'es' | 'ru', string>
>;

export class DeepLError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, message: string, code?: string);
}

interface DeepLRequestOptions {
  apiKey: string;
  apiUrl: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxRetries?: number;
  retryBaseDelayMs?: number;
  retryMaxDelayMs?: number;
  sleepImpl?: (milliseconds: number) => Promise<void>;
}

interface DeepLTranslation {
  text: string;
  detectedSourceLanguage: string;
}

export function requestDeepLTranslation(
  text: string,
  targetLanguage: keyof typeof TARGET_LANGUAGE_CODES,
  options: DeepLRequestOptions,
): Promise<DeepLTranslation>;

interface DeepLUsage {
  characterCount: number;
  characterLimit: number;
}

export function requestDeepLUsage(options: {
  apiKey: string;
  apiUrl: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<DeepLUsage>;
