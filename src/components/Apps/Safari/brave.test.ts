import { afterEach, describe, expect, it, vi } from 'vitest';
import { readBraveAnswer, searchBrave } from './brave';

const results = { type: 'search', web: { results: [{ title: 'A', url: 'https://a.example' }] } };
const tooFast = { type: 'ErrorResponse', error: { status: 429, detail: 'Request rate limit exceeded for plan', meta: { rate_limit: 1, quota_limit: 2000, quota_current: 9 } } };
const usedUp = { type: 'ErrorResponse', error: { status: 429, detail: 'Request quota limit exceeded for plan', meta: { rate_limit: 1, quota_limit: 2000, quota_current: 2000 } } };
const reply = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));

describe('readBraveAnswer', () => {
  it('reads results', () => {
    expect(readBraveAnswer(results)).toEqual({ kind: 'results', results: results.web.results });
  });
  it('reads a search with no matches as no results', () => {
    expect(readBraveAnswer({ type: 'search' })).toEqual({ kind: 'results', results: [] });
  });
  it('tells a rate limit apart from no results', () => {
    expect(readBraveAnswer(tooFast)).toEqual({ kind: 'too-fast' });
  });
  it('tells a used-up month apart from a rate limit', () => {
    expect(readBraveAnswer(usedUp)).toEqual({ kind: 'month-used-up' });
  });
});

describe('searchBrave', () => {
  afterEach(() => vi.restoreAllMocks());

  it('waits and tries once more when Brave says too fast', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementationOnce(() => reply(tooFast)).mockImplementationOnce(() => reply(results));
    const wait = vi.fn(() => Promise.resolve());
    await expect(searchBrave('mac', wait)).resolves.toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledOnce();
  });

  it('says so, instead of "no results", when it is still too fast', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => reply(tooFast));
    await expect(searchBrave('mac', () => Promise.resolve())).rejects.toThrow(/too fast/);
  });

  it('does not retry when the month is used up', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(() => reply(usedUp));
    await expect(searchBrave('mac', () => Promise.resolve())).rejects.toThrow(/used up/);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
