# Brave Search (through Alex's worker)

Part of the `apis` skill. Used by Safari (`src/components/Apps/Safari/Safari.tsx`).

## What the site uses

`GET https://brave-search-worker.ahamelin9.workers.dev?q=…`, a Cloudflare
Worker in Alex's Cloudflare account. **Its code is not in this repo.** It
holds the Brave Search API key and passes Brave's web search JSON back
unchanged. The results are in `web.results[]` (`title`, `url`,
`description`); `web` is missing when nothing matches.

## Setup and limits

- Brave's **free plan: 1 search a second, 2,000 a month.** Every Brave answer
  reports both in `meta` when it refuses.
- **The worker answers HTTP 200 even when Brave refuses.** The body is then
  `{"type": "ErrorResponse", "error": {"status": 429, "detail": …,
  "meta": {"rate_limit": 1, "quota_limit": 2000, "quota_current": …}}}`.
- The worker sends `Access-Control-Allow-Origin: *`, so any website could
  use it and spend the month's searches. Restricting it to the site's
  origins is a change in the worker, in Alex's Cloudflare dashboard.

## Known issues

### Safari says "No results found" for a real search

*2026-11-15. Fixed 2026-11-15.*

- **Symptom:** a second search within a second, or any search once the
  month's 2,000 are used, says "No results found".
- **Cause:** Brave refused (rate limit or quota), the worker passed the
  refusal on with status 200, and Safari read the missing `web` as "no
  matches".
- **Fix:** `Safari/brave.ts` reads the refusal. On a rate limit it waits
  1.1 s and tries once more, then says "Searching too fast"; when the
  month's quota is used up it says so.
- **Check:** `brave.test.ts`, and `app-check.mjs` with canned refusals.

## Probe

Each probe spends one of the month's 2,000 searches, so run one:

```bash
curl -s "https://brave-search-worker.ahamelin9.workers.dev?q=macintosh" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d.get('type'), len(d.get('web',{}).get('results',[])), d.get('error',{}).get('detail',''))"
```

Should print `search` and a count of results.
