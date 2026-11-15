# iNaturalist

Part of the `apis` skill. Used by the Field Guide
(`src/components/Apps/FieldGuide/`: `FieldGuide.tsx`, `SpeciesRange.tsx`,
`RangeMap.tsx`, `establishmentStatus.ts`).

**Which endpoints the app calls, and what their fields really mean, live in
the `field-guide` skill, section 3.** This file is the service's rules and
problems.

## Setup and limits

- Base `https://api.inaturalist.org/v1`. No key for reading.
- iNaturalist's API docs ask for **about 60 requests a minute** (it throttles
  at 100) and about 10,000 a day. Bursts get **HTTP 429**.
- One range view makes about 30 requests, so test runs back to back hit the
  limit.
- The website host, `www.inaturalist.org`, blocks scripts (403). Always use
  `api.inaturalist.org`.
- Map tiles: `taxon_ranges/{id}/{z}/{x}/{y}.png` and `grid/{z}/{x}/{y}.png`
  both accept `color` (`FieldGuide/palette.ts`).

## Known issues

### "Failed to fetch", "Could not load this specimen", or a page of Unknown badges

*2026-11-09*

- **Symptom:** a range view fails to load, or a list suddenly shows Unknown
  everywhere. The console says "Failed to fetch".
- **Cause:** a 429, which the browser reports as a network failure.
- **Fix:** iNaturalist calls go through `fetchWithRetry`
  (`establishmentStatus.ts`), which waits 1 s, then 3 s, on a 429 or a 5xx.
  Use it for any new call. In test scripts, wait about 20 s between range
  loads.
- **Check:** the test `retries a rate-limited request instead of reporting
  unknown` in `establishmentStatus.test.ts`.

### Some calls skip the retry

*2026-11-15. Fixed 2026-11-15.* The species type-ahead and search in
`FieldGuide.tsx`, the discovery feed, and every call in `SpeciesRange.tsx`
used plain `fetch`, so a 429 there lost data instead of waiting. They all
use `fetchWithRetry` now; the Field Guide's only plain `fetch` calls left
are to Wikipedia, Wikidata and Nominatim.

### A field the code reads is always empty

*2026-11-09*

- **Symptom:** a UI piece never appears. The conservation chip was one: the
  code read `conservation_status`, which has no usable value (`field-guide`,
  section 3).
- **Fix:** before trusting a field name, look at a raw response for a case
  whose answer you know. For the giant panda:

  ```bash
  curl -s 'https://api.inaturalist.org/v1/taxa/41659' | python3 -c 'import json,sys;r=json.load(sys.stdin)["results"][0];print(r["name"],[(c.get("authority"),c.get("status")) for c in r.get("conservation_statuses",[]) if not c.get("place")])'
  ```

  This should print `Ailuropoda melanoleuca [('IUCN Red List', 'VU')]`.
  Look up taxon ids rather than guessing them: 41733 is the grey seal, not
  the panda.

## Probe

```bash
curl -s -o /dev/null -w "%{http_code} %{time_total}s\n" "https://api.inaturalist.org/v1/observations/species_counts?lat=35.6762&lng=139.6503&radius=25&per_page=0"
```

200 in about 3 s is normal for this call.
