import { afterEach, describe, expect, it, vi } from 'vitest';
import { findPreview, pickPreview, simplify } from './itunes';

describe('simplify', () => {
  it('drops accents, punctuation and version tails', () => {
    expect(simplify('Clair de Lune (Remastered)')).toBe('clair de lune');
    expect(simplify('Here Comes The Sun - Remastered 2009')).toBe('here comes the sun');
    expect(simplify('Beyoncé')).toBe('beyonce');
    expect(simplify('Simon & Garfunkel')).toBe('simon and garfunkel');
  });
});

describe('pickPreview', () => {
  const results = [
    { artistName: 'Some Cover Band', trackName: 'Something in the Orange', previewUrl: 'cover.m4a' },
    { artistName: 'Zach Bryan', trackName: 'Something in the Orange', previewUrl: 'real.m4a' }
  ];

  it('skips a cover by someone else', () => {
    expect(pickPreview(results, 'Zach Bryan', 'Something in the Orange')).toBe('real.m4a');
  });

  it('matches the first of several artists, and ignores a feat. tail', () => {
    expect(
      pickPreview(
        [{ artistName: 'Zach Bryan & Kacey Musgraves', trackName: 'I Remember Everything', previewUrl: 'duet.m4a' }],
        'Zach Bryan, Kacey Musgraves',
        'I Remember Everything (feat. Kacey Musgraves)'
      )
    ).toBe('duet.m4a');
  });

  it('gives up rather than play the wrong song', () => {
    expect(pickPreview(results, 'Claude Debussy', 'Clair de Lune')).toBeNull();
    expect(pickPreview([{ artistName: 'Zach Bryan', trackName: 'Something in the Orange' }], 'Zach Bryan', 'Something in the Orange')).toBeNull();
  });
});

describe('findPreview', () => {
  afterEach(() => vi.restoreAllMocks());

  it('looks a track up once, then remembers it', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ results: [{ artistName: 'Adele', trackName: 'Hello', previewUrl: 'hello.m4a' }] })))
    );
    await expect(findPreview('Adele', 'Hello')).resolves.toBe('hello.m4a');
    await expect(findPreview('Adele', 'Hello')).resolves.toBe('hello.m4a');
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('tries again next time after a failed request', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockImplementationOnce(() => Promise.reject(new TypeError('Failed to fetch')))
      .mockImplementationOnce(() =>
        Promise.resolve(new Response(JSON.stringify({ results: [{ artistName: 'Lorde', trackName: 'Royals', previewUrl: 'royals.m4a' }] })))
      );
    await expect(findPreview('Lorde', 'Royals')).rejects.toThrow();
    await expect(findPreview('Lorde', 'Royals')).resolves.toBe('royals.m4a');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
