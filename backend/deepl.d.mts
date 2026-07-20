export const TARGET_LANGUAGE_CODES: Readonly<
  Record<'bg' | 'de' | 'en' | 'es' | 'ru', string>
>;

export class DeepLError extends Error {
  readonly status: number;
  constructor(status: number, message: string);
}

interface DeepLRequestOptions {
  apiKey: string;
  apiUrl: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
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
