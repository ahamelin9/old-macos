/**
 * Searching through Alex's Brave Search worker. The worker passes Brave's
 * answer on unchanged, and answers HTTP 200 even when Brave refuses, so a
 * refusal has to be read from the body (the `apis` skill, brave-search.md).
 */
export const BRAVE_WORKER = 'https://brave-search-worker.ahamelin9.workers.dev';

/** One web result (only the fields Safari shows) */
export interface SearchResult {
  title: string;
  url: string;
  description?: string;
}

interface BraveError {
  status?: number;
  detail?: string;
  meta?: { rate_limit?: number; quota_limit?: number; quota_current?: number };
}

export type BraveAnswer =
  | { kind: 'results'; results: SearchResult[] }
  | { kind: 'too-fast' }
  | { kind: 'month-used-up' }
  | { kind: 'refused'; detail: string };

/** What a body from the worker means */
export const readBraveAnswer = (data: unknown): BraveAnswer => {
  const body = (data ?? {}) as { type?: string; web?: { results?: SearchResult[] }; error?: BraveError };
  if (body.type === 'ErrorResponse') {
    const error = body.error ?? {};
    const quota = error.meta;
    if (quota?.quota_limit && (quota.quota_current ?? 0) >= quota.quota_limit) return { kind: 'month-used-up' };
    if (error.status === 429) return { kind: 'too-fast' };
    return { kind: 'refused', detail: error.detail || 'The search service refused the search.' };
  }
  // Brave leaves out `web` entirely when nothing matches
  return { kind: 'results', results: body.web?.results ?? [] };
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Search, waiting a second and trying once more if Brave says it was too
 * soon after the last search (the free plan allows one a second). Throws an
 * Error with a message fit to show.
 */
export const searchBrave = async (query: string, wait = sleep): Promise<SearchResult[]> => {
  for (let attempt = 0; attempt < 2; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${BRAVE_WORKER}?q=${encodeURIComponent(query)}`);
    } catch {
      throw new Error("Couldn't reach the search service. Check the connection and try again.");
    }
    if (!res.ok) throw new Error(`The search service had a problem (${res.status}). Try again in a bit.`);
    const answer = readBraveAnswer(await res.json());
    if (answer.kind === 'results') return answer.results;
    if (answer.kind === 'month-used-up') {
      throw new Error("This month's free searches are used up. Search works again next month.");
    }
    if (answer.kind === 'refused') throw new Error(answer.detail);
    if (attempt === 0) await wait(1100);
  }
  throw new Error('Searching too fast. Wait a second and try again.');
};
