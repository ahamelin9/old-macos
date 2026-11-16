# OpenStreetMap: Nominatim, Photon and the map tiles

Part of the `apis` skill. Used by Planes (its map, place box and "over"
line; [adsb.md](adsb.md)) and by the Field Guide: place search and Near Me's
place name (`FieldGuide.tsx`), and the maps (`MapPreview.tsx`,
`RangeMap.tsx`). All three run on OpenStreetMap data, which is free, but
each server has its own rules.

## Nominatim (place search)

- `https://nominatim.openstreetmap.org/search?q=…&format=json&limit=1` turns
  the search box into coordinates; `/reverse?lat=…&lon=…&format=json`
  names Near Me's spot.
- Planes asks `/reverse?lat=…&lon=…&format=jsonv2&zoom=5&accept-language=en`
  for the state and country a found plane is over (`Planes/place.ts`):
  only on a find or a clicked row, spaced 1.1 s apart, kept for the visit.
  Over open sea it answers 200 with `{"error":"Unable to geocode"}`.
- **Usage policy:** at most 1 request a second; identify the app (a
  browser's `Referer` does that); no bulk jobs; and **no type-ahead**: the
  policy forbids autocomplete built on it. Breaking it can get the site
  blocked.

## Photon (type-ahead)

- `https://photon.komoot.io/api/?q=…&limit=4&lang=en`, by komoot, built on
  OSM data **for search-as-you-type**. It answers browsers from any site.
  Results are GeoJSON features: `geometry.coordinates` is `[lng, lat]`,
  and `properties` has `name`, `state`, `country` and `osm_value` (city,
  station…).
- Fair use, no key. Debounce typing (the app waits 400 ms).

## Map tiles

- `https://tile.openstreetmap.org/{z}/{x}/{y}.png`. No `{s}` subdomains: OSM
  retired them.
- **Tile usage policy:** show the credit "© OpenStreetMap contributors" on
  the map, don't bulk-download, and send a `Referer` (browsers do).

## Known issues

- *2026-11-15. Fixed 2026-11-15.* Both maps hid Leaflet's credit line
  and used the retired `{s}` subdomains. Both now add the tiles through
  `addOsmBaseLayer` (`FieldGuide/osm.ts`), which shows "© OpenStreetMap
  contributors" at the bottom left; the range map adds "Ranges & sightings:
  iNaturalist".
- *2026-11-15. Fixed 2026-11-15.* The place type-ahead called Nominatim,
  and an older, slower reply could replace newer suggestions. It now calls
  Photon (`FieldGuide/photon.ts`), and `suggestionRequestRef` drops any
  reply to an older keystroke. Nominatim is left for a pressed Search and
  Near Me's place name.

## Probe

```bash
curl -s -A "macos-1999-api-check/1.0" -o /dev/null -w "nominatim %{http_code}\n" "https://nominatim.openstreetmap.org/search?q=Kyoto&format=json&limit=1"; sleep 1
curl -s -A "macos-1999-api-check/1.0" -o /dev/null -w "photon %{http_code}\n" "https://photon.komoot.io/api/?q=Kyot&limit=4&lang=en"
curl -s -A "macos-1999-api-check/1.0" -o /dev/null -w "tile %{http_code}\n" "https://tile.openstreetmap.org/3/7/3.png"
```
