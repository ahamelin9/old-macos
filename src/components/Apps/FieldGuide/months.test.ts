import { describe, expect, it } from 'vitest';
import { peakMonths } from './months';

describe('peakMonths', () => {
  it('names one busy run', () => {
    expect(peakMonths([1, 1, 2, 5, 9, 10, 8, 4, 2, 1, 1, 1])).toBe('Apr–Jul');
  });

  it('names separate runs, like spring and autumn migration', () => {
    expect(peakMonths([0, 0, 1, 10, 9, 1, 0, 1, 8, 10, 1, 0])).toBe('Apr–May, Sep–Oct');
  });

  it('keeps a winter run whole across the year end', () => {
    expect(peakMonths([10, 9, 3, 1, 0, 0, 0, 0, 1, 2, 6, 9])).toBe('Nov–Feb');
  });

  it('calls a nearly flat year "year-round" and names the quietest month', () => {
    expect(peakMonths([50, 48, 52, 55, 60, 58, 40, 20, 45, 50, 49, 51])).toBe('year-round, fewest in Aug');
  });

  it('says year-round when no month is quiet, and nothing without data', () => {
    expect(peakMonths([5, 6, 5, 6, 5, 6, 5, 6, 5, 6, 5, 6])).toBe('year-round');
    expect(peakMonths(new Array(12).fill(0))).toBe('');
  });
});
