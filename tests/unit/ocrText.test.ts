import { describe, expect, it } from 'vitest';
import { sanitizeOcrText } from '@/services/ocr';

describe('sanitizeOcrText', () => {
  it.each([
    ['Latin letters', 'The quick brown fox', 'The quick brown fox'],
    ['Cyrillic letters', 'Быстрая коричневая лиса', 'Быстрая коричневая лиса'],
    ['digits', 'Invoice 123456', 'Invoice 123456'],
    ['Unicode letters', 'Café Ελληνικά 中文', 'Café Ελληνικά 中文'],
    ['foreign symbols', 'hello <> @#$%^&* world!', 'hello world'],
    ['spaces and line breaks', '  one\t two \r\n three\n\n\n four  ', 'one two\nthree\n\nfour'],
    ['empty input', '', ''],
  ])('sanitizes $0', (_caseName, input, expected) => {
    expect(sanitizeOcrText(input)).toBe(expected);
  });

  it('normalizes decomposed Unicode to NFC', () => {
    expect(sanitizeOcrText('Cafe\u0301')).toBe('Café');
  });
});
