# adsb.lol and adsbdb: live planes

Part of the `apis` skill. Used by Planes
(`src/components/Apps/Planes/`): `aircraft.ts` asks adsb.lol where the
planes are, `adsbdb.ts` asks adsbdb who a plane belongs to and where its
flight usually goes, `photos.ts` asks planespotters.net for a photo of the
airframe, `picks.ts` holds Spotter's Picks, and `typeInfo.ts` fetches an
aircraft's page, with pictures and words from Wikipedia and Wikidata ([wikipedia.md](wikipedia.md)). The map and the place search are OpenStreetMap's
([openstreetmap.md](openstreetmap.md)): Photon for the place box, and
Nominatim's reverse lookup for the place a found plane is over.

## Contents

1. [adsb.lol: where the planes are](#adsblol-where-the-planes-are)
2. [The proxy: `/api/planes`](#the-proxy-apiplanes)
3. [adsbdb: routes and owners](#adsbdb-routes-and-owners)
4. [planespotters.net: a photo of the airframe](#planespottersnet-a-photo-of-the-airframe)
5. [Shapes on the map](#shapes-on-the-map)
6. [Spotter's Picks](#spotters-picks)
7. [How the app keeps it right](#how-the-app-keeps-it-right)
8. [Known issues](#known-issues)
9. [Ideas not done yet](#ideas-not-done-yet)
10. [Probe](#probe)

## adsb.lol: where the planes are

Positions come from volunteers' ADS-B receivers, worldwide, a second or two
old. No key. `https://api.adsb.lol/v2/…`:

| Path | Gives |
|---|---|
| `point/{lat}/{lon}/{radius}` | Every aircraft within `radius` nautical miles. **250 at most**: a wider circle answers 403 with the text "radius exceeds 250 NM" |
| `callsign/{UAL188}` | Aircraft sending that callsign (the airline's three-letter ICAO code and the number, not the ticket's "UA188") |
| `reg/{N24979}` | The aircraft with that tail number (hyphens as painted: `G-XLEA`) |
| `type/{A388}` | Every aircraft of that ICAO type heard right now, anywhere. A common type (B738) is thousands of rows and over a megabyte |
| `hex/{a254dd}` | One airframe by its 24-bit address (not used yet) |
| `mil` | Every military aircraft heard right now, anywhere, in one call (62 to 109 on the days tried) |

Each reply is `{ ac: [...] }`; nothing found is an empty `ac`, with status
200. Fields the app reads (`toPlanes`): `hex`, `flight` (padded with
spaces), `r` (tail number), `t` (type code), `lat`, `lon`, `alt_baro`
(feet, or the string `"ground"`), `gs` (knots), `track`, `baro_rate`
(feet a minute), `squawk`, `seen_pos` (seconds since the position was
heard), `category` (size: A1 light, A2 small, A3 large, A4 and A5 heavy,
A7 rotorcraft, B1 glider; often missing). A `flight` of filler
(`@@@@@@@@`) counts as none. An aircraft heard but with no position has no `lat`/`lon`; the app
leaves it out. There is no aircraft name, only the type code.

- **Usage:** free and open data (ODbL), so the map's credit line says
  "Planes: adsb.lol". The app asks once every 10 seconds while its map is
  showing, and never while minimized, behind Find a Plane, or in a hidden
  browser tab.
- **It rate-limits bursts, and says so with a 429.** No limit is
  published. On 2026-11-15, nine `type/` lookups 1.1 s apart from a script
  were answered, then twelve in a row got 429; a later run 4 s apart still
  got three 429s in fourteen (the app's own checks were running too). So:
  never loop over types or planes, in the app or in a script. Spotter's
  Picks looks a card up only when it is clicked for that reason.
- **Coverage is where volunteers are.** Mid-ocean and remote land have
  none, so "not found" is worded "not being picked up right now", never
  "not flying".
- **No CORS header**, so a browser can't call it from the site. Hence the
  proxy.

## The proxy: `/api/planes`

`functions/api/planes/[[path]].js` (a Cloudflare Pages Function) passes
`/api/planes/v2/…` to `api.adsb.lol/v2/…`. It holds no key or secret.

- Only the six paths above get through (a regular expression), so it is
  not an open relay. Anything else is a 404.
- It answers 429 when adsb.lol does, 502 for any other refusal and 504 on
  no answer in 10 s; `aircraft.ts` turns each into its own message.
- Replies carry `Cache-Control: public, max-age=5`, and the Function keeps
  each good reply in Cloudflare's cache for those five seconds
  (`caches.default`), so several visitors over one city cost adsb.lol one
  call. Cloudflare's outgoing addresses are shared with other sites, so
  adsb.lol's limit may bite the live site sooner than it does in dev: not
  yet seen either way.
- **In dev, Vite proxies the same path straight to adsb.lol**
  (`vite.config.ts`; the `/api/planes` rule must stay above `/api`). So
  Planes needs only `npm run dev`, and **there is no twin route in
  `backend/main.py`**: that rule is for secrets, and this has none. The
  dev proxy does not filter paths; only the Function does.
- A change to `vite.config.ts` restarts the dev server by itself.
- In browser checks `/api/planes` is the one `/api` path that is canned
  like an outside service (know-how, `checking.md`).

## adsbdb: routes and owners

`https://api.adsbdb.com/v0/…`, no key, answers browsers from any site.

| Path | Gives |
|---|---|
| `callsign/{UAL188 or UA188}` | The airline, the origin and destination airports (codes, city, coordinates) that flight number usually flies, and both forms of the number (`callsign_icao`, `callsign_iata`) |
| `aircraft/{hex}` | Maker, model, registered owner and country |

Not known is a 404. Each answer is kept for the visit (`adsbdb.ts`), and
only a clicked plane is looked up, so a plane clicked twice costs one call.
A failed call isn't kept.

## planespotters.net: a photo of the airframe

`GET https://api.planespotters.net/pub/photos/hex/{hex}`, no key, answers
browsers from any site. `{ photos: [...] }`, empty when it has none; the
first has `thumbnail` (200 wide), `thumbnail_large` (420×280), `link` (its
page) and `photographer`.

- **Their terms:** show the thumbnail they send, make it a link to `link`,
  and credit the photographer beside it. `toPhoto` gives no photo at all
  when the link or the credit is missing. The panel shows
  "© name, planespotters.net" under the picture.
- **It turns away anything that isn't a real browser.** A script gets 403
  ("Server User-Agent strings must include a contact URL or email"), and
  headless Chrome's fetch fails outright. So the browser check stubs it,
  `npm run probe` can't cover it, and a live look needs the browser pane.
- One call for a clicked plane, kept for the visit. Coverage is good for
  airliners (a United 787 that adsbdb had no photo for has one here).

## Shapes on the map

`shapes.ts`: each plane is drawn as one of six kinds (jet, heavy,
four-engine, twin turboprop, light, helicopter), bigger for bigger
aircraft. `kindOf` goes by the type code when it is in one of two short
lists (four engines, twin turboprops), otherwise by `category`; no
category and an unknown type is drawn as a jet. All original drawings, and
no extra requests. A type missing from the lists just gets its category's
shape: add it to the list.

## Spotter's Picks

`picks.ts`: the cards Find a Plane opens on. Each is an ICAO type code, a
name, a line about it and its English Wikipedia article.

- **A card is looked up only when clicked** (`type/{code}`, or `mil` for
  the military card). Never count them all for the cards: see the 429s
  above.
- **The pictures are one Wikipedia call** the first time Find a Plane
  opens: `w/api.php?action=query&prop=pageimages&pithumbsize=330&pilimit=max&redirects=1&origin=*&titles=A|B|…`.
  A renamed article still works (`toPickImages` follows `redirects`); a
  card with no picture shows a dark panel. The line under the cards says
  where the pictures come from, and each card's result links its article.
- **A card opens the aircraft's page** (Alex, 2026-11-16: a list of
  flights alone "isn't very intuitive"; Field Guide's species page was the
  model). `typeInfo.ts` fetches, on the click and once a visit:
  - the opening of its Wikipedia article and a 500px picture, in one call
    (`prop=extracts|pageimages|pageprops&exintro=1&explaintext=1`), cut to
    about 700 characters at the end of a sentence (`trimStory`);
  - its first flight, entry into service, retirement, wingspan, length and
    height from Wikidata (`wbgetentities&props=claims`, the id from
    `pageprops.wikibase_item`), lengths in feet first.
  Nothing on the page is written by hand except the card's one line, and
  the page says which part came from where. **Wikidata's "number built" is
  left out on purpose:** it said 110 for the 747-8 on 2026-11-16, and 155
  were built. Only facts that can't go stale are shown.
- **Under it, a world map of where each one is right now**
  (`WorldMap.tsx`), drawn from the lookup Find a Plane already made: the
  same shapes, fitted to hold them all, 400 planes at most. A tap opens
  that plane in Sky. Every search with results gets the map, typed ones
  too; the list stays below it.
- **Adding a card:** check the code first, `curl -s
  https://api.adsb.lol/v2/type/<CODE>`, at a time of day the type would be
  flying, and read a few tail numbers back. Codes confirmed that way on
  2026-11-15: A388, B748, B744, MD11, A35K, A124, C17, K35R, H47, C130,
  C172, GLF6, DHC6. The rest (BLCF, A3ST, A337, C5M, B52, U2, V22, A400,
  SPIT, P51, DC3, CL2T, SHIP) had none in the air when tried and rest on
  ICAO's designator list.

## How the app keeps it right

- **A route is checked against where the plane is** (`routeFits`). adsbdb
  lists what a flight number usually flies, and airlines reuse numbers. On
  2026-11-15 it gave Cleveland to San Francisco for UAL2811, which was at
  2,675 ft about to land at Newark. So the route shows only when the plane
  could be on it: on the ground at one of the two airports; below 10,000 ft
  within 150 nm of one; and not more than 10% plus 75 nm off the direct
  line. Otherwise the row is left out and the airline stays. The row is
  labelled "Usual route" because a route that passes can still be wrong.
- **Planes glide between updates** (`coast`): each second a plane is moved
  along its track at its speed from when its position was heard, for 30
  seconds at most, and never on the ground. The numbers in the panel are
  only ever what the plane sent.
- **The chosen plane leaves a trail** (`extendTrail`): the positions the
  app has heard for it while watching, joined up, with the end following
  the plane as it glides. It is not the flight's whole path, only what was
  seen. A silence of more than 45 seconds starts it afresh, so a gap is
  never drawn as a line the plane didn't fly; it keeps 120 points, about
  twenty minutes.
- **Find a Plane tries the likeliest lookup first** (`lookupOrder`): a
  hyphen means a tail number; four characters or fewer a type, then a
  flight, then a tail number; anything else a flight, then a tail number.
  It stops at the first that finds something. A ticket number that found
  nothing (`UA188`) is translated by adsbdb to the callsign (`UAL188`)
  and tried once more. Four calls at the very most.
- **A found plane says what it is over** ("over New Jersey, United
  States"): one Nominatim reverse lookup at state level (`place.ts`), for a
  single result at once and for a list only when a row is clicked. Nothing
  mapped there reads "Open sea"; a failed lookup says nothing. Planes
  clicked on the map aren't looked up: the map already says where they are.
- **The map opens over the visitor's own sky** (Alex, 2026-11-16: "when I
  hear a plane go by I can check what it was"). Opening asks the browser
  for the location, quietly: a no, or no answer, leaves the map over New
  York with nothing said, and the crosshair button (the same mark as Field
  Guide's) explains itself if pressed. Someone
  who has already said yes never sees New York first: the map holds its
  first request until their position arrives, three seconds at most, so
  no call is spent on the wrong city.
- **On a phone** (under 800px, or any touch screen) the tabs, buttons,
  filter and rows are big enough to tap, the place box is 16px, the filter
  lies in a row along the top of the map, and the chosen plane is a sheet
  at the bottom. Planes is the last of the phone Dock's five (Safari gave
  up its place, 2026-11-16).
- **A filter hides kinds of aircraft** (the six of `shapes.ts`), with a
  count of each in view. It only hides markers: the same planes are asked
  for, and the chosen plane stays whatever its kind.
- **The circle asked for is the map's**, middle to corner, with the spot
  rounded to two decimals. Zoomed out past 250 nm the status line says
  only the middle is covered.

## Known issues

- *2026-11-15.* airplanes.live (the same API shape) answers 403 with a
  note to email them, and OpenSky allows only its own website (CORS) with a
  small daily allowance. `opendata.adsb.fi/api/v2/…` has the same shape as
  adsb.lol and answered; it is the stand-in if adsb.lol goes away.

## Ideas not done yet

- The whole of a flight's path so far. The trail only knows what the app
  has heard; adsb.lol's map keeps full traces, but its API doesn't offer
  them.

## Probe

```bash
curl -s -A "macos-1999-api-check/1.0" "https://api.adsb.lol/v2/point/51.47/-0.45/25" | python3 -c "import json,sys;a=json.load(sys.stdin)['ac'];print(len(a),'aircraft near Heathrow;',sum('lat' in x for x in a),'with a position')"; sleep 1
curl -s -A "macos-1999-api-check/1.0" -o /dev/null -w "adsbdb %{http_code}\n" "https://api.adsbdb.com/v0/callsign/BAW117"
curl -s -o /dev/null -w "live proxy %{http_code}\n" "https://old-macos-2vr.pages.dev/api/planes/v2/point/51.47/-0.45/25"
```

`npm run probe -- planes` runs the first two. planespotters can't be
probed from a script (above).
