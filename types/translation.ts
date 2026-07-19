export const TRANSLATE_TEXT_MESSAGE = 'TRANSLATE_TEXT' as const;

export const TARGET_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ru', label: 'Russian' },
  { code: 'bg', label: 'Bulgarian' },
  { code: 'de', label: 'German' },
  { code: 'es', label: 'Spanish' },
] as const;

export type TargetLanguage = (typeof TARGET_LANGUAGES)[number]['code'];

export interface TranslateTextMessage {
  type: typeof TRANSLATE_TEXT_MESSAGE;
  requestId: string;
  targetLanguage: TargetLanguage;
  text: string;
}

export type TranslateTextResponse =
  | { ok: true; translatedText: string }
  | { ok: false; error: string };

export function isTranslateTextMessage(
  message: unknown,
): message is TranslateTextMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message.type === TRANSLATE_TEXT_MESSAGE &&
    'requestId' in message &&
    typeof message.requestId === 'string' &&
    message.requestId.length > 0 &&
    'targetLanguage' in message &&
    isTargetLanguage(message.targetLanguage) &&
    'text' in message &&
    typeof message.text === 'string' &&
    message.text.trim().length > 0
  );
}

export function isTargetLanguage(value: unknown): value is TargetLanguage {
  return TARGET_LANGUAGES.some(({ code }) => code === value);
}
