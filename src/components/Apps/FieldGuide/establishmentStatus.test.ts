import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ChecklistPlace,
  classifyStatus,
  clearStatusCaches,
  countEstablishmentStatuses,
  getEstablishmentStatuses,
  MAX_SPECIES_FOR_BREAKDOWN,
  normalizeMeans,
  resolveChecklistPlaces
} from './establishmentStatus';

// Real iNaturalist ids
const JAPAN = 6737;
const TOKYO = 10935;
const SUGINAMI = 34921;
const USA = 1;
const NEW_YORK = 48;
const WHITE_CLOVER = 55745;
const HOUTTUYNIA = 157642;
const COMMELINA = 52927;
const CAUSONIS = 795186;
const BLACK_LOCUST = 56088;
const BLACK_NIGHTSHADE = 79141;

const KANTO_PLACES: ChecklistPlace[] = [
  { id: JAPAN, name: 'Japan', adminLevel: 0 },
  { id: TOKYO, name: 'Tokyo, JP', adminLevel: 10 }
];
const NYC_PLACES: ChecklistPlace[] = [
  { id: USA, name: 'United States', adminLevel: 0 },
  { id: NEW_YORK, name: 'New York, US', adminLevel: 10 }
];
const KANTO_CIRCLE = { lat: 35.6762, lng: 139.6503, radiusKm: 25 };
const NYC_CIRCLE = { lat: 40.7128, lng: -74.006, radiusKm: 25 };

/** place id -> taxon id -> establishment_means, as the checklists have them */
type Checklists = Record<number, Record<number, string>>;
/** flag -> taxon id -> research-grade sighting count */
type Flags = Record<'native' | 'introduced', Record<number, number>>;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** Mimics /v1/taxa/{ids}?place_id= and /v1/observations/species_counts */
const mockInat = (
  checklists: Checklists,
  flags: Flags = { native: {}, introduced: {} },
  // `species`: everything recorded in the search circle, for whole-circle queries
  opts: { failPlace?: number; pageSize?: number; species?: number[] } = {}
) => {
  const fetchMock = vi.fn(async (input: string | URL | Request) => {
    const url = new URL(String(input));

    const taxaMatch = url.pathname.match(/^\/v1\/taxa\/([\d,]+)$/);
    if (taxaMatch) {
      const ids = taxaMatch[1].split(',').map(Number);
      if (ids.length > 30) return json({ error: 'Too many IDs' }, 422);
      const placeId = Number(url.searchParams.get('place_id'));
      if (placeId === opts.failPlace) return json({ error: 'boom' }, 500);
      return json({
        results: ids.map(id => {
          const means = checklists[placeId]?.[id];
          return {
            id,
            establishment_means: means
              ? { establishment_means: means, place: { id: placeId } }
              : undefined
          };
        })
      });
    }

    if (url.pathname === '/v1/observations/species_counts') {
      const taxonIds = url.searchParams.get('taxon_id');
      const ids = taxonIds ? taxonIds.split(',').map(Number) : opts.species ?? [];
      const flag = url.searchParams.get('native')
        ? 'native'
        : url.searchParams.get('introduced')
          ? 'introduced'
          : null;
      const preferred = Number(url.searchParams.get('preferred_place_id'));
      const rows = flag
        ? ids.filter(id => flags[flag][id]).map(id => ({ count: flags[flag][id], taxon: { id } }))
        : ids.map(id => {
            // preferred_place_id annotates each species with that place's entry
            const means = checklists[preferred]?.[id];
            return {
              count: 1,
              taxon: {
                id,
                establishment_means: means
                  ? { establishment_means: means, place: { id: preferred } }
                  : undefined
              }
            };
          });
      if (url.searchParams.get('per_page') === '0') {
        return json({ total_results: rows.length, per_page: 0, results: [] });
      }
      const perPage = opts.pageSize ?? Number(url.searchParams.get('per_page'));
      const page = Number(url.searchParams.get('page'));
      return json({
        total_results: rows.length,
        per_page: perPage,
        results: rows.slice((page - 1) * perPage, page * perPage)
      });
    }

    throw new Error(`Unexpected request: ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const requestedUrls = (fetchMock: ReturnType<typeof vi.fn>) =>
  fetchMock.mock.calls.map(([input]) => new URL(String(input)));

beforeEach(() => clearStatusCaches());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('normalizeMeans', () => {
  it('folds endemic into native and legacy values into introduced', () => {
    expect(normalizeMeans('native')).toBe('native');
    expect(normalizeMeans('endemic')).toBe('native');
    expect(normalizeMeans('Introduced')).toBe('introduced');
    expect(normalizeMeans('naturalised')).toBe('introduced');
    expect(normalizeMeans('invasive')).toBe('introduced');
  });

  it('returns null for anything it cannot vouch for', () => {
    expect(normalizeMeans(undefined)).toBeNull();
    expect(normalizeMeans(null)).toBeNull();
    expect(normalizeMeans('')).toBeNull();
    expect(normalizeMeans('extirpated')).toBeNull();
  });
});

describe('classifyStatus', () => {
  const japan = (means: 'native' | 'introduced' | null) => ({ placeName: 'Japan', means });
  const hokkaido = (means: 'native' | 'introduced' | null) => ({ placeName: 'Hokkaido, JP', means });

  it('prefers the state/prefecture over the country', () => {
    // Houttuynia is native to Japan but was brought to Hokkaido from Honshu
    expect(classifyStatus({ country: japan('native'), region: hokkaido('introduced') })).toEqual({
      status: 'introduced',
      source: 'Hokkaido, JP checklist'
    });
  });

  it('lets a country-wide "introduced" override a state-level "native"', () => {
    expect(
      classifyStatus({
        country: { placeName: 'United States', means: 'introduced' },
        region: { placeName: 'New York, US', means: 'native' }
      })
    ).toEqual({ status: 'introduced', source: 'United States checklist' });
  });

  it('falls back to the country when the state has no entry', () => {
    expect(classifyStatus({ country: japan('native'), region: hokkaido(null) })).toEqual({
      status: 'native',
      source: 'Japan checklist'
    });
    expect(classifyStatus({ country: japan('native') }).status).toBe('native');
  });

  it('uses sighting flags only when no checklist answers and the flags agree', () => {
    const none = { country: japan(null), region: hokkaido(null) };
    expect(classifyStatus(none, { native: 12, introduced: 0, label: 'sightings' })).toEqual({
      status: 'native',
      source: 'sightings'
    });
    expect(classifyStatus(none, { native: 0, introduced: 3, label: 'sightings' }).status).toBe(
      'introduced'
    );
    expect(classifyStatus(none, { native: 4, introduced: 2780, label: 'sightings' }).status).toBe(
      'unknown'
    );
    // A checklist answer is never second-guessed by the flags
    expect(
      classifyStatus({ country: japan('native') }, { native: 0, introduced: 9, label: 'sightings' })
        .status
    ).toBe('native');
  });

  it('never defaults to native, however common the species is', () => {
    expect(classifyStatus({})).toEqual({ status: 'unknown', source: null });
    expect(classifyStatus({ country: japan(null), region: hokkaido(null) })).toEqual({
      status: 'unknown',
      source: null
    });
    expect(classifyStatus({}, { native: 0, introduced: 0, label: 'sightings' }).status).toBe(
      'unknown'
    );
  });
});

describe('resolveChecklistPlaces', () => {
  it('keeps only the standard country and state/prefecture, and caches them', async () => {
    const fetchMock = vi.fn(async () =>
      json({
        results: {
          standard: [
            { id: SUGINAMI, name: 'Suginami', display_name: 'Suginami, JP, TK', admin_level: 20 },
            { id: 97395, name: 'Asia', display_name: 'Asia', admin_level: -10 },
            { id: TOKYO, name: 'Tokyo', display_name: 'Tokyo, JP', admin_level: 10 },
            { id: JAPAN, name: 'Japan', display_name: 'Japan', admin_level: 0 }
          ],
          community: [{ id: 133951, name: 'tokyo23', display_name: 'tokyo23', admin_level: null }]
        }
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const places = await resolveChecklistPlaces(35.6762, 139.6503);
    expect(places).toEqual(KANTO_PLACES);

    await resolveChecklistPlaces(35.6762, 139.6503);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0])).toContain('/v1/places/nearby');
  });
});

describe('getEstablishmentStatuses', () => {
  const kantoChecklists: Checklists = {
    [JAPAN]: { [WHITE_CLOVER]: 'introduced', [HOUTTUYNIA]: 'native' },
    // Tokyo's checklist calls Houttuynia introduced (it is native to Honshu)
    [TOKYO]: { [WHITE_CLOVER]: 'introduced', [HOUTTUYNIA]: 'introduced' }
  };
  const kantoFlags: Flags = {
    native: { [COMMELINA]: 1118 },
    introduced: { [WHITE_CLOVER]: 1096, [HOUTTUYNIA]: 1388 }
  };

  it('classifies the Kanto cases from the prefecture, country, then sightings', async () => {
    mockInat(kantoChecklists, kantoFlags);
    const result = await getEstablishmentStatuses(
      [WHITE_CLOVER, HOUTTUYNIA, COMMELINA, CAUSONIS],
      KANTO_PLACES,
      KANTO_CIRCLE
    );

    expect(result.get(WHITE_CLOVER)).toEqual({ status: 'introduced', source: 'Japan checklist' });
    // Follows the prefecture checklist, even where that checklist is wrong
    expect(result.get(HOUTTUYNIA)).toEqual({ status: 'introduced', source: 'Tokyo, JP checklist' });
    expect(result.get(COMMELINA)).toEqual({
      status: 'native',
      source: 'sightings within 25 km'
    });
    expect(result.get(CAUSONIS)).toEqual({ status: 'unknown', source: null });
  });

  it('handles the New York cases the US checklist alone would get wrong', async () => {
    mockInat({
      [USA]: { [BLACK_LOCUST]: 'native', [BLACK_NIGHTSHADE]: 'introduced' },
      [NEW_YORK]: { [BLACK_LOCUST]: 'introduced', [BLACK_NIGHTSHADE]: 'native' }
    });
    const result = await getEstablishmentStatuses(
      [BLACK_LOCUST, BLACK_NIGHTSHADE],
      NYC_PLACES,
      NYC_CIRCLE
    );

    // Native to the Appalachians, introduced in New York
    expect(result.get(BLACK_LOCUST)).toEqual({ status: 'introduced', source: 'New York, US checklist' });
    // Eurasian; introduced country-wide, whatever the state list says
    expect(result.get(BLACK_NIGHTSHADE)).toEqual({
      status: 'introduced',
      source: 'United States checklist'
    });
  });

  it('only consults the country and state checklists, and skips sightings when they answer', async () => {
    const fetchMock = mockInat(kantoChecklists, kantoFlags);
    await getEstablishmentStatuses(
      [WHITE_CLOVER, HOUTTUYNIA],
      [...KANTO_PLACES, { id: SUGINAMI, name: 'Suginami, JP, TK', adminLevel: 20 }],
      KANTO_CIRCLE
    );

    const urls = requestedUrls(fetchMock);
    expect(urls.map(u => Number(u.searchParams.get('place_id'))).sort((a, b) => a - b)).toEqual([JAPAN, TOKYO]);
    expect(urls.some(u => u.pathname.includes('species_counts'))).toBe(false);
  });

  it('ignores an entry that belongs to a different place', async () => {
    // e.g. the response carrying Asia's "native" for white clover
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) =>
        String(input).includes('/v1/taxa/')
          ? json({
              results: [
                {
                  id: WHITE_CLOVER,
                  establishment_means: { establishment_means: 'native', place: { id: 97395 } }
                }
              ]
            })
          : json({ total_results: 0, per_page: 500, results: [] })
      )
    );
    const result = await getEstablishmentStatuses(
      [WHITE_CLOVER],
      [{ id: JAPAN, name: 'Japan', adminLevel: 0 }],
      KANTO_CIRCLE
    );
    expect(result.get(WHITE_CLOVER)).toEqual({ status: 'unknown', source: null });
  });

  it('batches checklist lookups at 30 taxa per request', async () => {
    const fetchMock = mockInat({});
    const ids = Array.from({ length: 65 }, (_, i) => i + 1);
    await getEstablishmentStatuses(ids, [{ id: JAPAN, name: 'Japan', adminLevel: 0 }], KANTO_CIRCLE);

    const taxaCalls = requestedUrls(fetchMock).filter(u => u.pathname.startsWith('/v1/taxa/'));
    expect(taxaCalls.map(u => u.pathname.split('/').pop()!.split(',').length)).toEqual([30, 30, 5]);
  });

  it('follows species_counts pagination to the last page', async () => {
    const ids = Array.from({ length: 7 }, (_, i) => i + 1);
    const fetchMock = mockInat(
      {},
      { native: Object.fromEntries(ids.map(id => [id, 5])), introduced: {} },
      { pageSize: 3 }
    );
    const result = await getEstablishmentStatuses(ids, [], KANTO_CIRCLE);

    // 7 rows at 3 per page: pages 1-3 for native, one page for introduced
    const nativePages = requestedUrls(fetchMock)
      .filter(u => u.searchParams.get('native'))
      .map(u => u.searchParams.get('page'));
    expect(nativePages).toEqual(['1', '2', '3']);
    expect(ids.every(id => result.get(id)?.status === 'native')).toBe(true);
  });

  it('caches per place, so repeat lookups make no requests', async () => {
    const fetchMock = mockInat(kantoChecklists, kantoFlags);
    const ids = [WHITE_CLOVER, HOUTTUYNIA, COMMELINA, CAUSONIS];
    const first = await getEstablishmentStatuses(ids, KANTO_PLACES, KANTO_CIRCLE);
    const calls = fetchMock.mock.calls.length;

    const second = await getEstablishmentStatuses(ids, KANTO_PLACES, KANTO_CIRCLE);
    expect(fetchMock.mock.calls.length).toBe(calls);
    expect(second).toEqual(first);
  });

  it('does not answer from one level when the other level lookup fails, and retries later', async () => {
    vi.useFakeTimers();
    let fetchMock = mockInat(kantoChecklists, kantoFlags, { failPlace: TOKYO });
    const pending = getEstablishmentStatuses([HOUTTUYNIA], KANTO_PLACES, KANTO_CIRCLE);
    await vi.runAllTimersAsync(); // through the retries
    const failed = await pending;
    vi.useRealTimers();

    // One attempt plus two retries before giving up
    expect(
      requestedUrls(fetchMock).filter(u => u.searchParams.get('place_id') === String(TOKYO))
    ).toHaveLength(3);

    // Japan alone would say native; without the prefecture there is no answer
    expect(failed.get(HOUTTUYNIA)).toEqual({ status: 'unknown', source: null });
    expect(requestedUrls(fetchMock).some(u => u.pathname.includes('species_counts'))).toBe(false);

    fetchMock = mockInat(kantoChecklists, kantoFlags);
    const retried = await getEstablishmentStatuses([HOUTTUYNIA], KANTO_PLACES, KANTO_CIRCLE);
    expect(retried.get(HOUTTUYNIA)).toEqual({ status: 'introduced', source: 'Tokyo, JP checklist' });
    // Japan was cached on the first pass; only Tokyo is asked again
    expect(requestedUrls(fetchMock).map(u => u.searchParams.get('place_id'))).toEqual([String(TOKYO)]);
  });

  it('retries a rate-limited request instead of reporting unknown', async () => {
    vi.useFakeTimers();
    const inat = mockInat(kantoChecklists, kantoFlags);
    let limited = false;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) => {
        if (!limited) {
          limited = true;
          return json({ error: 'Too Many Requests' }, 429);
        }
        return inat(input);
      })
    );
    const pending = getEstablishmentStatuses([WHITE_CLOVER], KANTO_PLACES, KANTO_CIRCLE);
    await vi.runAllTimersAsync();
    const result = await pending;
    vi.useRealTimers();

    expect(result.get(WHITE_CLOVER)).toEqual({ status: 'introduced', source: 'Japan checklist' });
  });
});

describe('countEstablishmentStatuses', () => {
  const checklists: Checklists = {
    [JAPAN]: { [WHITE_CLOVER]: 'introduced', [HOUTTUYNIA]: 'native' },
    [TOKYO]: { [WHITE_CLOVER]: 'introduced', [HOUTTUYNIA]: 'introduced' }
  };
  const flags: Flags = {
    native: { [COMMELINA]: 1118 },
    introduced: { [WHITE_CLOVER]: 1096, [HOUTTUYNIA]: 1388 }
  };
  const species = [WHITE_CLOVER, HOUTTUYNIA, COMMELINA, CAUSONIS];

  it('counts every species in the circle by the same rule as the badges', async () => {
    mockInat(checklists, flags, { species, pageSize: 3 });
    const totals = await countEstablishmentStatuses(KANTO_PLACES, KANTO_CIRCLE, 'Plantae');

    expect(totals).toEqual({ total: 4, byStatus: { native: 1, introduced: 2, unknown: 1 } });

    const badges = await getEstablishmentStatuses(species, KANTO_PLACES, KANTO_CIRCLE);
    const tally = { native: 0, introduced: 0, unknown: 0 };
    for (const r of badges.values()) tally[r.status]++;
    expect(tally).toEqual(totals.byStatus);
  });

  it('leaves the badges nothing to look up in the checklists afterwards', async () => {
    mockInat(checklists, flags, { species });
    await countEstablishmentStatuses(KANTO_PLACES, KANTO_CIRCLE, 'Plantae');

    const fetchMock = mockInat(checklists, flags, { species });
    await getEstablishmentStatuses(species, KANTO_PLACES, KANTO_CIRCLE);
    expect(requestedUrls(fetchMock).some(u => u.pathname.startsWith('/v1/taxa/'))).toBe(false);
  });

  it('gives only a plain total when the area is too big to classify', async () => {
    const many = Array.from({ length: MAX_SPECIES_FOR_BREAKDOWN + 1 }, (_, i) => i + 1);
    const fetchMock = mockInat({}, { native: {}, introduced: {} }, { species: many });
    const totals = await countEstablishmentStatuses(KANTO_PLACES, KANTO_CIRCLE, 'Plantae');

    expect(totals).toEqual({ total: MAX_SPECIES_FOR_BREAKDOWN + 1, byStatus: null });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
