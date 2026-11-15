# Wikipedia and Wikidata

Part of the `apis` skill. Used by the Field Guide's Specimen Inspector
(`FieldGuide.tsx`: the encyclopedia summary and the guard that checks the
article is about the right animal).

## What the site uses

- `https://en.wikipedia.org/api/rest_v1/page/summary/{title}`: the summary.
  Its `type` can be `disambiguation` ("Robin" is one); the app only takes
  `standard`.
- `https://www.wikidata.org/w/api.php?action=wbgetclaims&entity={Q-id}&property=P225&format=json&origin=*`:
  the article's taxon name (P225), when the summary doesn't name the
  species. `origin=*` is what lets a browser call it.
- Why the guard exists, and how it decides: `field-guide` skill, section 4.

## Setup and limits

- No key. Browsers are fine as they are.
- **Scripts get 429** if they send a generic User-Agent. Send a descriptive
  one, like `macos-1999-field-guide-check/1.0`, but **never Alex's email**.
  Pace requests to about 1 a second.

## Known issues

None open.

## Probe

```bash
curl -s -A "macos-1999-api-check/1.0" "https://en.wikipedia.org/api/rest_v1/page/summary/Grey_heron" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d['type'], d['wikibase_item'])"
```

Should print `standard Q25273`.
