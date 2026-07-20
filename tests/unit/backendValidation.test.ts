import { describe, expect, it } from 'vitest';
import { countUnicodeCodePoints } from '../../backend/app.mjs';

describe('backend validation', () => {
  it('counts Unicode code points instead of UTF-16 code units', () => {
    expect('🚀'.length).toBe(2);
    expect(countUnicodeCodePoints('A🚀Б')).toBe(3);
  });
});
