import { describe, expect, it } from 'vitest';
import { formatBytes, titleCase } from './format.js';

describe('format utilities', () => {
  it('formats bytes without NaN output', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(10 * 1024 * 1024)).toBe('10.0 MB');
    expect(formatBytes(Number.NaN)).toBe('0 B');
  });
  it('turns internal keys into readable labels', () => {
    expect(titleCase('income_certificate')).toBe('Income Certificate');
    expect(titleCase('needs_review')).toBe('Needs Review');
  });
});
