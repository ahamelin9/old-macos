---
name: field-guide
description: The Field Guide app (src/components/Apps/FieldGuide/), the biggest app on the site. Covers what it does (Search Places, Search Species, the Specimen Inspector, Back), which file holds what, what iNaturalist's API fields really mean, the decisions behind the tabs, the badges and the range map, how native/endemic/introduced is decided, and the live spot-checks that prove the data is right. Read it before any Field Guide change, when Alex asks whether its information is accurate, or when its data looks wrong (missing species, wrong badges, an empty chip, a wrong Wikipedia article).
---

# Field Guide

A naturalist's field guide in a retro Mac window. It has two modes:

- **Search Places** lists what lives around a place.
- **Search Species** shows where a plant or animal lives.

All of its data comes live from iNaturalist, plus OpenStreetMap for
places and Wikipedia for summaries. No key is needed.

## Contents

1. [What's in it](#1-whats-in-it)
2. [Which file holds what](#2-which-file-holds-what)
3. [What iNaturalist's API really returns](#3-what-inaturalists-api-really-returns)
4. [Decisions, and why (don't undo these by accident)](#4-decisions-and-why)
5. [Native, endemic, introduced: how it's decided](#5-native-endemic-introduced-how-its-decided)
6. [Checking the data is right](#6-checking-the-data-is-right)
7. [Testing a change](#7-testing-a-change)
8. [Ideas not done yet](#8-ideas-not-done-yet)

---

## 1. What's in it

**Search Places** (the default). It opens on Tokyo.

- Ways to pick a place:
  - type a place (Nominatim search, with suggestions);
  - **Near Me**, the crosshair button next to Explore, which uses browser
    geolocation and names the spot with a Nominatim reverse lookup;
  - a **Hotspot**: Tokyo (Kanto), Kyoto (Johto), Sapporo (Sinnoh) or
    New York City (Unova).
- Radius 10, 25, 50 or 100 km, with a map preview of the circle (`MapPreview`).
- **Category tabs:**
  - All Species, Plants, Fungi, Birds, Mammals, Reptiles & Amphibians,
    Insects & Spiders, Fish, Molluscs;
  - in a narrow window the closed tabs shrink to their icons.
- **Status summary**, for example "Of 251 bird species within 25 km…", with
  Native, Endemic, Introduced and Unknown counts that also filter the list.
- **In season now**, a checkbox that limits the list and the counts to
  species seen in this month in past years.
- A species grid with infinite scroll. Each page is 36 species
  (`PAGE_SIZE`).

**Search Species:**

- Searches with taxa autocomplete. Before you search, it shows a random
  discovery gallery (`RANDOM_GROUPS`).
- The **range view** (`SpeciesRange`) shows:
  - a header card with a conservation chip;
  - a map with two layers: the known range and the sightings grid
    (`RangeMap`);
  - **Where it lives**: continents, then countries, each Native, Introduced
    or Present;
  - an encyclopedia summary;
  - similar species.
- Click a country to explore that place.

**Specimen Inspector** (the modal you get by clicking a species):

- photo, stats, the status here, and the global IUCN status;
- **When to look**: a sightings-by-month chart (`MonthChart`) and the peak
  months;
- the encyclopedia summary;
- the 🧬 **Lineage** tree (kingdom → species). Clicking a group row opens
  that group's range.

**Back**: a "◀ Back to …" button above the tabs, on the left.

- It returns you to the exact spot after a jump: the mode, the place or
  species, the scroll position, and the inspector if one was open.
- It works both ways (place → species range, and range → place), up to 20
  steps (`MAX_BACK_STEPS`).
- Clicking the Search Places or Search Species tab yourself starts fresh and
  clears the Back history.

## 2. Which file holds what

| File | Holds |
|---|---|
| `FieldGuide.tsx` | The app: state, the places list, the inspector, Back, Near Me, the tabs (`CATEGORY_TABS`), the hotspots (`POPULAR_LOCATIONS`), the Wikipedia guard (`isArticleAboutTaxon`), the month histogram |
| `SpeciesRange.tsx` | The range view in Search Species. Exports `TaxonSuggestion`, `TaxonAncestor`, `TaxonDetail` |
| `RangeMap.tsx` | The Leaflet map with the `taxon_ranges` and `grid` tile layers |
| `MapPreview.tsx` | The small Leaflet map of the search circle |
| `establishmentStatus.ts` | Native, endemic, introduced or unknown: checklists, sighting flags, totals, `fetchWithRetry`, caches. **Pure logic, fully unit-tested.** |
| `establishmentStatus.test.ts` | Unit tests for the status rules, with a mocked `fetch` |
| `conservation.ts` | The global IUCN status from `conservation_statuses` |
| `months.ts` / `months.test.ts` | `peakMonths()`: "Apr–May, Sep–Oct", "year-round"…, and its tests |
| `MonthChart.tsx` | The 12-column sightings chart, with the current month highlighted |
| `palette.ts` | The colour key for the map tiles. **Mirrored as CSS custom properties on `.fieldguide-app` in `FieldGuide.css`: change both together.** |
| `useGridColumns.ts` | How many cards fit on a row, measured from the element and not the browser (it returns a callback ref) |
| `FieldGuide.css` | All the styles. It uses container queries (`container-type: inline-size`) at 1000, 830 and 480px |

To find a function in `FieldGuide.tsx`, search for its name. Line numbers
move:

```bash
grep -nE '^\s{2}const [a-zA-Z]+ = (async )?\(' src/components/Apps/FieldGuide/FieldGuide.tsx
```

## 3. What iNaturalist's API really returns

Base URL: `https://api.inaturalist.org/v1`. The endpoints the app uses:

| Endpoint | Used for | Gotcha |
|---|---|---|
| `observations/species_counts` | The places list and the totals | Params: `lat`, `lng`, `radius` (km), `iconic_taxa` or `taxon_id`, `quality_grade=research`, `hrank=species`, `month`, `page`, `per_page`. `per_page=0` returns only the total. |
| `taxa/{ids}` | Full records, with `ancestors` and `conservation_statuses` | At most 30 ids per call; more gives "Too many IDs" (`TAXA_BATCH_SIZE`) |
| `taxa` | The random discovery feed | **Ignores `iconic_taxa`** (returns the same page whatever you pass). Filter by `taxon_id` (an ancestor id) instead. |
| `taxa/autocomplete` | Species search | Can return a "complex" before the species. When checking, pin the taxon id (ivy is 55882, not the "Hedera helix complex"). |
| `taxon_ranges/{id}` tiles | The known-range layer | **The current range, introduced areas included.** Not the native range. |
| `grid` tiles | The sightings layer | Accepts `color`, like `taxon_ranges` |
| `observations/histogram` | When to look | `interval=month_of_year`, `date_field=observed` |
| `identifications/similar_species` | Similar species | |
| `places/…` | Checklist places | Admin level 0 is a country, 10 is a state or prefecture |

Field meanings that bit us:

- **The iconic taxon `Animalia` means "other animals"**: worms, crabs,
  slugs' relatives. It does not mean all animals. Birds, mammals, insects
  and fish each have their own iconic taxon.
- **Sharks and rays have no iconic taxon.** They fall under `Animalia`.
  That's why the Fish tab filters by `taxon_id=47178,47273` (bony fish,
  then sharks and rays).
- **`conservation_status` (singular) is useless:** `status_name` is always
  null, and it is often missing or a NatureServe rank. Use
  `conservation_statuses[]` and take the IUCN Red List entry with no place
  (`conservation.ts`).
- **Rate limits:** bursts get HTTP 429, so every iNaturalist call goes
  through `fetchWithRetry`. The symptoms and test pacing are in know-how
  (`apis.md`).

Wikipedia: `en.wikipedia.org/api/rest_v1/page/summary/<title>`. Its `type`
can be `disambiguation` ("Robin" is one).

## 4. Decisions, and why

Each of these fixed a real error found in the audit of 2026-11-09. Don't undo
them without a new reason.

| Decision | Why |
|---|---|
| **All Species sends no group filter** | It used to send `Plantae,Animalia,Fungi`, which left out every bird, mammal, insect and fish: Tokyo showed 2,091 species of 5,145. Busy cities now pass `MAX_SPECIES_FOR_BREAKDOWN` (4,000) and get a plain total with no status counts. That was agreed with Alex. |
| **Tabs are named for exactly what they hold** | "Wildlife (Fauna)" held only mammals, reptiles and amphibians, and "Insects" held spiders too. Fungi, fish and molluscs had no tab: Portland's 5th most-seen species, the Pacific banana slug, was in no tab at all. |
| **The range layer is "Known range (may include introduced areas)", in neutral slate** | It used to be native green, which showed house sparrows and starlings as native across North America. Green means native only where a checklist says so. |
| **Conservation status comes from `conservation_statuses`** | The old field was always empty, so the chip never appeared. Now the panda shows VU and the crested ibis EN. |
| **The Wikipedia guard** | It tries the article iNaturalist links to first and skips disambiguation pages. A page found only by common name has to match on Wikidata (P225, scientific name, sharing the genus or epithet), so "Paris" can't stand in for the plant. |
| **Hotspots are named by city** | Each searches the chosen radius around a city centre. "Sinnoh (Hokkaido)" promised all of Hokkaido but searched around Sapporo. |
| **Endemic is its own badge (purple), and counted inside Native** | "Found only here" is the most interesting thing a field guide can say. The Native count and filter include endemic species, so the totals still add up. |
| **"Unknown" is never read as native** | A missing status means no source says. Common does not mean native: white clover is one of the most-seen plants in Tokyo and is introduced there. |
| **Lineage shows only the classic ranks** | Kingdom, phylum, class, order, family, genus, species. The in-between ranks (subphylum, tribe) would double the depth for little gain. |
| **The range view stays mounted but hidden while you look at a place** | So Back returns to it without reloading, with expanded rows still expanded. |
| **The range map's first zoom isn't animated** | See know-how (`maps-and-layout.md`): Leaflet threw `_leaflet_pos` when you clicked away mid-zoom. |

## 5. Native, endemic, introduced: how it's decided

The full rule and its reasons are in the header comment of
`establishmentStatus.ts`. In short, in the order `classifyStatus` applies
them:

1. **"Introduced" at the country or the state level wins.** A species
   introduced to the whole country can't be native to part of it.
2. **Endemic to the state** (or prefecture), **then endemic to the
   country.**
3. **Otherwise the state's answer, then the country's.** The state comes
   first because "native to the country" says little about a big one: black
   locust is native to the US but introduced in New York.
4. **No checklist answers:** use iNaturalist's per-sighting native/introduced
   flags inside the circle, but only when they all agree.
5. **Anything else is Unknown.**

A few more rules:

- Only country and state checklists count. County and city lists only added
  disputed calls in testing, and continent lists are too broad ("native to
  Asia" includes white clover).
- Every badge's tooltip names its source ("per Japan checklist").
- Endemic badges also name the place: "found nowhere outside Japan".

## 6. Checking the data is right

When Alex asks "is this accurate?", or after a data change, spot-check
against live iNaturalist. These answers were confirmed on 2026-11-09:

| Case | Expected |
|---|---|
| White clover around Tokyo | Introduced (Japan checklist) |
| Oregon grape in Oregon | Native |
| European starling in Oregon | Introduced |
| Common ivy (taxon 55882) in Oregon | Introduced |
| Houttuynia around Tokyo | **Disputed inside iNaturalist itself:** the Japan list says native, the Tokyo list says introduced. The app follows the more local list and names it. That's not a bug. |
| *Delphinium leucophaeum* in Oregon | Endemic (US/Oregon data) |
| Honolulu | About 46 of the 500 most-seen species are endemic to Hawaii (ʻōhiʻa lehua, koa, Hawaiian monk seal) |
| Tokyo endemics | All from the Japan checklist (the Tokyo list marks none): green pheasant, Japanese green woodpecker |
| All Species around Tokyo / Portland | About 5,145 / 5,475 species within 25 km (Tokyo was 5,152 on 2026-11-15) |
| Giant panda (taxon 41659) / crested ibis / red fox / monarch | IUCN VU / EN / LC / LC |
| Wikipedia summaries | 49 of 50 matched the right article. The miss was the single-species genus *Tellima*. |

Counts drift as people add sightings, so a total within a few percent is a
pass. A badge that flips is worth a look.

To compare a species total with the app's "Of N species within 25 km", use
the same circle and filter (this is Tokyo, with no group filter):

```bash
curl -s 'https://api.inaturalist.org/v1/observations/species_counts?lat=35.6762&lng=139.6503&radius=25&quality_grade=research&hrank=species&per_page=0' | python3 -c 'import json,sys;print(json.load(sys.stdin)["total_results"])'
```

To check many species, pace the requests (about 1 per second for iNaturalist
and Wikipedia).

## 7. Testing a change

1. `npm test` covers the status rules and the month runs. Add a test to
   `establishmentStatus.test.ts` for any rule change. Its `fetch` mock shows
   how to fake the checklist responses.
2. `npx tsc -b`, then `npx eslint src/components/Apps/FieldGuide/`. One
   warning is expected: the infinite-scroll `useEffect` doesn't list
   `loadMoreSpecies` in its dependencies.
3. Check it in a real browser with know-how (`checking.md`). It covers the
   helper, pacing and window sizes. What's specific to the Field Guide:
   - `openFieldGuide()` opens the window; maximize it for list checks;
   - a list is ready when `.species-card` exists and
     `.fieldguide-loading-box` is gone;
   - fake Near Me with `setGeolocation(lat, lng)`.

Selectors that held up in tests:

- `.dock-item` (with the text "Field Guide"), `.window-maximize`
- `.category-tab[aria-label="Birds"]`
- `.status-summary` (its buttons hold the counts)
- `.species-card .species-badge`, `.location-badge`
- `.fieldguide-quick-locations button`, `.fieldguide-back-btn`
- `.near-me-btn`

## 8. Ideas not done yet

For the app's history, use
`git log --oneline -- src/components/Apps/FieldGuide`.

Ideas raised but not asked for yet:

- recent sightings;
- a life list;
- bird sounds;
- showing the endemic place on the badge itself (offered 2026-11-09, no
  answer yet).
