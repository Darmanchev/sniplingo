import {
  getTargetLanguageLabel,
  type TargetLanguage,
} from '@/types/translation';

const MOCK_DELAY_MS = 450;

export async function translateText(
  text: string,
  targetLanguage: TargetLanguage,
): Promise<string> {
  await delay(MOCK_DELAY_MS);

  const languageLabel = getTargetLanguageLabel(targetLanguage);
  return `[Mock translation to ${languageLabel}]\n\n${text}`;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
