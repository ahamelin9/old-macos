import { describe, expect, it } from 'vitest';
import { formatCores, formatDisplay, formatMemory, NOT_SHARED, readSpecs } from './specs';

describe('formatCores', () => {
  it('counts cores, with one in the singular', () => {
    expect(formatCores(8)).toBe('8 cores');
    expect(formatCores(1)).toBe('1 core');
  });

  it('says so when the browser keeps it back', () => {
    for (const value of [undefined, 0, -2, NaN, Infinity, '8']) expect(formatCores(value)).toBe(NOT_SHARED);
  });
});

describe('formatMemory', () => {
  it('writes GB, and MB under one, as "About": the browser rounds it to a power of two', () => {
    expect(formatMemory(4)).toBe('About 4 GB');
    expect(formatMemory(16)).toBe('About 16 GB');
    expect(formatMemory(0.5)).toBe('About 512 MB');
    expect(formatMemory(0.25)).toBe('About 256 MB');
  });

  it('falls back where the browser has no deviceMemory (Safari, Firefox)', () => {
    expect(formatMemory(undefined)).toBe(NOT_SHARED);
    expect(formatMemory(0)).toBe(NOT_SHARED);
  });
});

describe('formatDisplay', () => {
  it('gives the size and the pixel ratio, trimmed', () => {
    expect(formatDisplay(1512, 982, 2)).toBe('1512 × 982 at 2×');
    expect(formatDisplay(390, 844, 3)).toBe('390 × 844 at 3×');
    expect(formatDisplay(1280, 800, 1.5)).toBe('1280 × 800 at 1.5×');
    expect(formatDisplay(1280, 800, 2.625)).toBe('1280 × 800 at 2.63×');
  });

  it('leaves out a missing pixel ratio, and falls back without a size', () => {
    expect(formatDisplay(1024, 768, undefined)).toBe('1024 × 768');
    expect(formatDisplay(0, 768, 1)).toBe(NOT_SHARED);
  });
});

describe('readSpecs', () => {
  it('reads all three from the browser objects', () => {
    expect(readSpecs({ hardwareConcurrency: 10, deviceMemory: 8 }, { width: 1512, height: 982 }, 2)).toEqual({
      processor: '10 cores',
      memory: 'About 8 GB',
      display: '1512 × 982 at 2×'
    });
  });

  it('copes with a browser that shares nothing', () => {
    expect(readSpecs({}, {}, undefined)).toEqual({ processor: NOT_SHARED, memory: NOT_SHARED, display: NOT_SHARED });
  });
});
