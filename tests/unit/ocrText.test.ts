import { describe, expect, it } from 'vitest';
import { sanitizeOcrText } from '@/services/ocr';

describe('sanitizeOcrText', () => {
  it.each([
    ['Latin letters', 'The quick brown fox', 'The quick brown fox'],
    ['Cyrillic letters', 'Быстрая коричневая лиса', 'Быстрая коричневая лиса'],
    ['digits', 'Invoice 123456', 'Invoice 123456'],
    ['Unicode letters', 'Café Ελληνικά 中文', 'Café Ελληνικά 中文'],
    [
      'punctuation and technical text',
      'Hello, world! Price: $10.50 · docs@example.com https://example.com/a?x=1&y=2',
      'Hello, world! Price: $10.50 · docs@example.com https://example.com/a?x=1&y=2',
    ],
    ['unsafe controls', 'hello\u0000\u0007\u202E world!', 'hello world!'],
    ['spaces and line breaks', '  one\t two \r\n three\n\n\n four  ', 'one two\nthree\n\nfour'],
    ['empty input', '', ''],
  ])('sanitizes $0', (_caseName, input, expected) => {
    expect(sanitizeOcrText(input)).toBe(expected);
  });

  it('normalizes decomposed Unicode to NFC', () => {
    expect(sanitizeOcrText('Cafe\u0301')).toBe('Café');
  });
});
