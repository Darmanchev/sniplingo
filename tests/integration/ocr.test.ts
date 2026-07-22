import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createWorker, OEM, PSM, type Worker } from 'tesseract.js';
import { sanitizeOcrText } from '@/services/ocr';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const fixturesDirectory = path.resolve(currentDirectory, '../fixtures');
const languageDirectory = path.resolve(currentDirectory, '../../public/tesseract/lang');

describe('OCR fixtures', () => {
  let worker: Worker;

  beforeAll(async () => {
    worker = await createWorker(['eng', 'rus'], OEM.LSTM_ONLY, {
      langPath: languageDirectory,
      cacheMethod: 'none',
    });
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.AUTO,
    });
  });

  afterAll(async () => {
    await worker.terminate();
  });

  it.each([
    ['english.png', 'THE QUICK BROWN FOX 123'],
    ['russian.png', 'БЫСТРАЯ КОРИЧНЕВАЯ ЛИСА 123'],
    ['punctuation.png', 'Hello, world! Price: $10.50'],
    ['small-text.png', 'Small OCR text 12345'],
    ['dark-background.png', 'Dark background text 2026'],
    ['multiline-mixed.png', 'English line 123\nРусская строка 456'],
  ])('recognizes %s', async (fixture, expected) => {
    const result = await worker.recognize(path.join(fixturesDirectory, fixture));
    expect(sanitizeOcrText(result.data.text)).toBe(expected);
  });
});
