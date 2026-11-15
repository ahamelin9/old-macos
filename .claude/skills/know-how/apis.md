# Know-how: APIs and backends

Part of the `know-how` skill. The index is in `SKILL.md`. What iNaturalist's
fields mean, and the Field Guide's data decisions, live in the `field-guide`
skill. This file is only for troubleshooting.

## "Failed to fetch", "Could not load this specimen", or a page of Unknown badges

*2026-11-09*

- **Symptom:** in the Field Guide a range view fails to load, or a list
  suddenly shows Unknown everywhere. The console says "Failed to fetch".
- **Cause:** iNaturalist rate-limits bursts with HTTP 429, and the browser
  reports it as a network failure. One range view makes about 30 requests, so
  back-to-back test runs hit the limit.
- **Fix:** every iNaturalist call goes through `fetchWithRetry`
  (`establishmentStatus.ts`), which waits 1 s, then 3 s, on a 429 or a 5xx.
  Use it for any new call. In test scripts, wait about 20 s between range
  loads.
- **Check:** the test `retries a rate-limited request instead of reporting
  unknown` in `establishmentStatus.test.ts`.

## A field the code reads is always empty

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

## A script gets 403 or 429 from iNaturalist or Wikipedia

*2026-11-09*

- **Wikipedia 429:** Wikipedia throttles scripts that send a generic
  User-Agent. Send a descriptive one, like
  `macos-1999-field-guide-check/1.0`, but **never Alex's email**. Pace
  requests to about 1 per second.
- **403 from the iNaturalist website** (`www.inaturalist.org`, for example
  range GeoJSON): the website blocks scripts. Use the API host,
  `api.inaturalist.org`. For range checks, sample the API's `taxon_ranges`
  map tiles instead.

## Music logs "Guest fetch error" locally

*2026-11-15*

- **Symptom:** opening Music in dev logs `Guest fetch error: SyntaxError …
  Unexpected end of JSON input` from `fetchTracks`.
- **Cause:** with no Spotify login, Music fetches `/api/client_credentials`.
  Locally, Vite proxies that to the FastAPI backend on port 8000, and nothing
  is running there.
- **Fix:** `npm run backend` (or `npm run start:all`), with `backend/.env`
  filled in from `backend/.env.example`. In production, the Pages Function
  answers instead (`system-map`, section 5).

## NASA News says "HTTP error! status: 500", or loads forever

*2026-11-15. Diagnosed, not fixed yet.*

- **Symptom:** NASA News shows `Error: HTTP error! status: 500`, or stays on
  "Loading NASA data..." for 20 seconds or more. It happens on some days and
  not others.
- **Cause:** NASA's picture-of-the-day API itself, not our key or a rate
  limit (the key had about 9,960 requests left that hour). On 2026-11-15, a
  request for today (no `date`, which is what `NasaNews.tsx` sends) answered
  500 or hung past 20 s five times out of six. The same request with
  `date=2026-11-14` or `date=2026-11-10` answered 200 in under 4 s. So when
  the API can't serve a day's entry, it fails for that whole day.
- **Fix (to do):**
  - give the request a timeout of about 10 s (`AbortController`);
  - on a 5xx or a timeout, ask for yesterday (`date=`, counted in US Eastern
    time, NASA's calendar), and say that today's picture isn't available yet.
- **Check:** request with and without `date=`, without printing the key:
  read it into a shell variable from `.env`, and `unset` it afterwards.

