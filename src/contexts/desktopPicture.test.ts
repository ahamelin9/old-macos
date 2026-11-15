import { describe, expect, it } from 'vitest';
import { MAX_FILE_BYTES, fitWithin, pictureProblem } from './desktopPicture';

describe('pictureProblem', () => {
  it('accepts a picture under 25 MB', () => {
    expect(pictureProblem({ type: 'image/jpeg', size: 3_000_000 })).toBeNull();
    expect(pictureProblem({ type: 'image/png', size: MAX_FILE_BYTES })).toBeNull();
    expect(pictureProblem({ type: 'image/svg+xml', size: 2_000 })).toBeNull();
  });

  it('turns away a file that is not a picture, saying so', () => {
    expect(pictureProblem({ type: 'application/pdf', size: 1_000 })).toMatch(/isn't a picture/);
    expect(pictureProblem({ type: 'text/plain', size: 10 })).toMatch(/isn't a picture/);
    // A file the browser can't name a type for
    expect(pictureProblem({ type: '', size: 10 })).toMatch(/isn't a picture/);
  });

  it('turns away a picture over 25 MB, giving its size', () => {
    expect(pictureProblem({ type: 'image/jpeg', size: MAX_FILE_BYTES + 1 })).toMatch(/25 MB/);
    expect(pictureProblem({ type: 'image/tiff', size: 40 * 1024 * 1024 })).toBe('That picture is 40 MB. Choose one under 25 MB.');
  });
});

describe('fitWithin', () => {
  it('shrinks the longer side to 2560, keeping the shape', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 2560, height: 1920 });
    expect(fitWithin(3024, 4032)).toEqual({ width: 1920, height: 2560 });
    expect(fitWithin(6000, 6000)).toEqual({ width: 2560, height: 2560 });
  });

  it('never enlarges a small picture', () => {
    expect(fitWithin(1024, 768)).toEqual({ width: 1024, height: 768 });
    expect(fitWithin(2560, 1600)).toEqual({ width: 2560, height: 1600 });
  });

  it('rounds to whole pixels and keeps at least one', () => {
    expect(fitWithin(10000, 10)).toEqual({ width: 2560, height: 3 });
    expect(fitWithin(100000, 1)).toEqual({ width: 2560, height: 1 });
  });

  it('takes another limit', () => {
    expect(fitWithin(800, 600, 400)).toEqual({ width: 400, height: 300 });
  });
});
