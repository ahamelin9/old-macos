/**
 * Whether a species is native or introduced where the user is looking.
 *
 * Sighting counts measure how common a species is, not where it came from --
 * white clover is one of the most-seen plants in Tokyo and is not native to
 * Japan. The answer comes from iNaturalist's place checklists instead.
 *
 * The state/prefecture checklist is the primary answer, because "native to
 * the country" says little in a big one: black locust is native to the US but
 * introduced in New York, and Houttuynia is native to Japan but was brought to
 * Hokkaido from Honshu. The country checklist fills in where the state has no
 * entry, and a country-level "introduced" always wins -- a species introduced
 * to the whole country cannot be native to part of it (the New York checklist
 * calls Eurasian black nightshade native; the US one correctly does not).
 *
 * Nothing narrower than a state is used: county and city checklists never
 * filled a gap the state left in testing, only added disputed calls. Nothing
 * broader than a country is used either: "native to Asia" includes white clover.
 *
 * Last resort for species no checklist covers: iNaturalist's per-observation
 * native/introduced flags inside the search circle, only when they agree.
 * Anything else is 'unknown' -- a missing status is never read as native.
 */

export type EstablishmentStatus = 'native' | 'introduced' | 'unknown';

export interface StatusResult {
  status: EstablishmentStatus;
  /** Where the answer came from, e.g. "Japan checklist"; null when unknown */
  source: string | null;
}

export interface ChecklistPlace {
  id: number;
  name: string;
  adminLevel: number;
}

export interface SearchCircle {
  lat: number;
  lng: number;
  radiusKm: number;
}

type Means = 'native' | 'introduced';

const API = 'https://api.inaturalist.org/v1';

// iNaturalist admin levels
const COUNTRY_LEVEL = 0;
const REGION_LEVEL = 10; // state, prefecture, province
const CHECKLIST_ADMIN_LEVELS = [COUNTRY_LEVEL, REGION_LEVEL];

// `/v1/taxa/{ids}` rejects more than 30 ids with "Too many IDs"
const TAXA_BATCH_SIZE = 30;
const SPECIES_COUNTS_PAGE_SIZE = 500;
// Keeps the taxon_id list in the species_counts URL a sane length
const FLAG_BATCH_SIZE = 100;
// Above this many species an area gets a plain total, not a status breakdown:
// a breakdown is two full passes over the species list plus the sightings.
export const MAX_SPECIES_FOR_BREAKDOWN = 4000;

/**
 * iNaturalist's establishment_means vocabulary. Endemic is a kind of native;
 * the older naturalised/invasive/managed values are all kinds of introduced.
 */
export const normalizeMeans = (raw: string | null | undefined): Means | null => {
  switch ((raw || '').toLowerCase()) {
    case 'native':
    case 'endemic':
      return 'native';
    case 'introduced':
    case 'naturalised':
    case 'naturalized':
    case 'invasive':
    case 'managed':
      return 'introduced';
    default:
      return null;
  }
};

export interface ChecklistEntry {
  placeName: string;
  means: Means | null;
}

const fromChecklist = (entry: ChecklistEntry & { means: Means }): StatusResult => ({
  status: entry.means,
  source: `${entry.placeName} checklist`
});

/** The classification rule, free of any fetching. */
export const classifyStatus = (
  checklist: { country?: ChecklistEntry; region?: ChecklistEntry },
  flags?: { native: number; introduced: number; label: string }
): StatusResult => {
  const { country, region } = checklist;

  if (country?.means === 'introduced') return fromChecklist({ ...country, means: 'introduced' });
  if (region?.means) return fromChecklist({ ...region, means: region.means });
  if (country?.means) return fromChecklist({ ...country, means: country.means });

  if (flags) {
    if (flags.native > 0 && flags.introduced === 0) {
      return { status: 'native', source: flags.label };
    }
    if (flags.introduced > 0 && flags.native === 0) {
      return { status: 'introduced', source: flags.label };
    }
  }

  return { status: 'unknown', source: null };
};

// iNaturalist rate-limits bursts (HTTP 429). Without a retry, a busy moment
// would show up as a page of "Unknown" badges that are really failed requests.
const RETRY_DELAYS_MS = [1000, 3000];

const fetchWithRetry = async (url: string): Promise<Response> => {
  for (let attempt = 0; ; attempt++) {
    const delay = RETRY_DELAYS_MS[attempt];
    try {
      const res = await fetch(url);
      if ((res.status === 429 || res.status >= 500) && delay !== undefined) {
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      return res;
    } catch (err) {
      if (delay === undefined) throw err;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

const chunk = <T,>(items: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

interface SpeciesCountRow {
  count: number;
  taxon: {
    id: number;
    establishment_means?: { establishment_means?: string; place?: { id: number } };
  };
}

/** Every row of a species_counts query, following pagination to the end. */
const fetchAllSpeciesCounts = async (query: string): Promise<SpeciesCountRow[]> => {
  const rows: SpeciesCountRow[] = [];
  for (let page = 1; ; page++) {
    const res = await fetchWithRetry(
      `${API}/observations/species_counts?${query}&per_page=${SPECIES_COUNTS_PAGE_SIZE}&page=${page}`
    );
    if (!res.ok) throw new Error(`iNaturalist API error: HTTP ${res.status}`);
    const data = await res.json();
    const results: SpeciesCountRow[] = data.results || [];
    rows.push(...results);
    const total: number = data.total_results ?? 0;
    // Page by what the server actually used, in case it caps per_page lower
    const perPage: number = data.per_page || SPECIES_COUNTS_PAGE_SIZE;
    if (results.length === 0 || page * perPage >= total) break;
  }
  return rows;
};

const circleKey = (circle: SearchCircle) =>
  `${circle.lat.toFixed(4)},${circle.lng.toFixed(4)},${circle.radiusKm}`;

// Module-level caches: checklists rarely change, so they live for the session
const placesCache = new Map<string, ChecklistPlace[]>();
const checklistCache = new Map<number, Map<number, Means | null>>();
const flagCache = new Map<string, Map<number, { native: number; introduced: number }>>();
const totalsCache = new Map<string, StatusTotals>();

/** For tests */
export const clearStatusCaches = () => {
  placesCache.clear();
  checklistCache.clear();
  flagCache.clear();
  totalsCache.clear();
};

const checklistFor = (placeId: number) => {
  let byTaxon = checklistCache.get(placeId);
  if (!byTaxon) {
    byTaxon = new Map();
    checklistCache.set(placeId, byTaxon);
  }
  return byTaxon;
};

/** One place's checklist entry for a taxon, if that place was looked up */
const checklistEntry = (
  place: ChecklistPlace | undefined,
  means: Map<number, Means | null> | null,
  id: number
): ChecklistEntry | undefined =>
  place && means ? { placeName: place.name, means: means.get(id) ?? null } : undefined;

/**
 * The standard (non-community) country and state/prefecture containing a
 * point, country first. Either may be missing, e.g. at sea.
 */
export const resolveChecklistPlaces = async (
  lat: number,
  lng: number
): Promise<ChecklistPlace[]> => {
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  const cached = placesCache.get(key);
  if (cached) return cached;

  // A tiny box around the point; nearby returns every place intersecting it
  const d = 0.001;
  const res = await fetchWithRetry(
    `${API}/places/nearby?nelat=${lat + d}&nelng=${lng + d}&swlat=${lat - d}&swlng=${lng - d}`
  );
  if (!res.ok) throw new Error(`iNaturalist API error: HTTP ${res.status}`);
  const data = await res.json();

  const standard: { id: number; name: string; display_name?: string; admin_level?: number | null }[] =
    data.results?.standard || [];

  const places: ChecklistPlace[] = [];
  for (const level of CHECKLIST_ADMIN_LEVELS) {
    const place = standard.find(p => p.admin_level === level);
    if (place) {
      places.push({ id: place.id, name: place.display_name || place.name, adminLevel: level });
    }
  }

  placesCache.set(key, places);
  return places;
};

/** Checklist entries for these taxa at one place. Cached per place_id. */
const fetchChecklistMeans = async (
  placeId: number,
  taxonIds: number[]
): Promise<Map<number, Means | null>> => {
  const known = checklistFor(placeId);
  const missing = taxonIds.filter(id => !known.has(id));

  await Promise.all(
    chunk(missing, TAXA_BATCH_SIZE).map(async ids => {
      try {
        const res = await fetchWithRetry(`${API}/taxa/${ids.join(',')}?place_id=${placeId}`);
        if (!res.ok) return; // left uncached, so the next pass retries
        const data = await res.json();

        const found = new Map<number, Means | null>();
        for (const taxon of data.results || []) {
          const em = taxon.establishment_means;
          // Only trust an entry that is about this exact place
          const samePlace = !em?.place || em.place.id === placeId;
          found.set(taxon.id, samePlace ? normalizeMeans(em?.establishment_means) : null);
        }
        // Taxa missing from the response have no entry here either
        for (const id of ids) known.set(id, found.get(id) ?? null);
      } catch {
        // network failure: leave uncached
      }
    })
  );

  return known;
};

/**
 * Research-grade sighting counts inside the circle whose per-observation flag
 * says native, and separately introduced. Follows pagination to the end.
 */
const fetchSightingFlags = async (
  circle: SearchCircle,
  taxonIds: number[]
): Promise<Map<number, { native: number; introduced: number }>> => {
  const key = circleKey(circle);
  let byTaxon = flagCache.get(key);
  if (!byTaxon) {
    byTaxon = new Map();
    flagCache.set(key, byTaxon);
  }
  const known = byTaxon;
  const missing = taxonIds.filter(id => !known.has(id));

  const countFlag = async (ids: number[], flag: Means) => {
    const rows = await fetchAllSpeciesCounts(
      `lat=${circle.lat}&lng=${circle.lng}&radius=${circle.radiusKm}` +
        `&quality_grade=research&${flag}=true&taxon_id=${ids.join(',')}`
    );
    return new Map(rows.map(r => [r.taxon.id, r.count]));
  };

  await Promise.all(
    chunk(missing, FLAG_BATCH_SIZE).map(async ids => {
      try {
        const [native, introduced] = await Promise.all([
          countFlag(ids, 'native'),
          countFlag(ids, 'introduced')
        ]);
        for (const id of ids) {
          known.set(id, { native: native.get(id) ?? 0, introduced: introduced.get(id) ?? 0 });
        }
      } catch {
        // leave uncached; these fall through to unknown this pass
      }
    })
  );

  return known;
};

/** Status for every taxon id, given the places resolved for the search point. */
export const getEstablishmentStatuses = async (
  taxonIds: number[],
  places: ChecklistPlace[],
  circle: SearchCircle
): Promise<Map<number, StatusResult>> => {
  const ids = [...new Set(taxonIds)];
  const country = places.find(p => p.adminLevel === COUNTRY_LEVEL);
  const region = places.find(p => p.adminLevel === REGION_LEVEL);

  const [countryMeans, regionMeans] = await Promise.all([
    country ? fetchChecklistMeans(country.id, ids) : null,
    region ? fetchChecklistMeans(region.id, ids) : null
  ]);

  // A failed lookup leaves the taxon out of the map. Answering from the other
  // level alone could be exactly the wrong call (Houttuynia in Hokkaido), so
  // those taxa are unknown this pass and retried on the next.
  const failed = (id: number) =>
    (countryMeans !== null && !countryMeans.has(id)) ||
    (regionMeans !== null && !regionMeans.has(id));

  const checklists = new Map(
    ids.map(id => [
      id,
      {
        country: checklistEntry(country, countryMeans, id),
        region: checklistEntry(region, regionMeans, id)
      }
    ])
  );

  const open = ids.filter(
    id => !failed(id) && classifyStatus(checklists.get(id)!).status === 'unknown'
  );
  const flags = open.length > 0 ? await fetchSightingFlags(circle, open) : new Map();
  const flagLabel = `sightings within ${circle.radiusKm} km`;

  const out = new Map<number, StatusResult>();
  for (const id of ids) {
    if (failed(id)) {
      out.set(id, { status: 'unknown', source: null });
      continue;
    }
    const f = flags.get(id);
    out.set(id, classifyStatus(checklists.get(id)!, f && { ...f, label: flagLabel }));
  }
  return out;
};

export interface StatusTotals {
  /** Every species recorded in the circle for these iconic taxa */
  total: number;
  /** Null when the area is too big to classify everything */
  byStatus: Record<EstablishmentStatus, number> | null;
}

/**
 * Native / introduced / unknown counts across *every* species in the circle,
 * not just the page loaded so far -- by the same rule as the badges.
 *
 * `preferred_place_id` makes species_counts annotate each species with its
 * checklist entry for that place without filtering the list, 500 species a
 * request. (Checked against the per-taxon lookup: identical, once entries for
 * other places -- it sometimes hands back a continent's -- are dropped.) The
 * results also seed the per-place cache, so the badges then cost nothing.
 */
export const countEstablishmentStatuses = async (
  places: ChecklistPlace[],
  circle: SearchCircle,
  iconicTaxa: string
): Promise<StatusTotals> => {
  const country = places.find(p => p.adminLevel === COUNTRY_LEVEL);
  const region = places.find(p => p.adminLevel === REGION_LEVEL);
  const key = `${country?.id},${region?.id},${circleKey(circle)},${iconicTaxa}`;
  const cached = totalsCache.get(key);
  if (cached) return cached;

  const base =
    `lat=${circle.lat}&lng=${circle.lng}&radius=${circle.radiusKm}` +
    `&iconic_taxa=${encodeURIComponent(iconicTaxa)}&quality_grade=research&hrank=species`;

  const sizeRes = await fetchWithRetry(`${API}/observations/species_counts?${base}&per_page=0`);
  if (!sizeRes.ok) throw new Error(`iNaturalist API error: HTTP ${sizeRes.status}`);
  const total: number = (await sizeRes.json()).total_results ?? 0;
  if (total > MAX_SPECIES_FOR_BREAKDOWN) {
    const totals = { total, byStatus: null };
    totalsCache.set(key, totals);
    return totals;
  }

  const annotate = async (place: ChecklistPlace) => {
    const rows = await fetchAllSpeciesCounts(`${base}&preferred_place_id=${place.id}`);
    const means = new Map<number, Means | null>();
    for (const { taxon } of rows) {
      const em = taxon.establishment_means;
      means.set(
        taxon.id,
        em?.place?.id === place.id ? normalizeMeans(em.establishment_means) : null
      );
    }
    const cache = checklistFor(place.id);
    for (const [id, m] of means) cache.set(id, m);
    return means;
  };

  const [countryMeans, regionMeans] = await Promise.all([
    country ? annotate(country) : null,
    region ? annotate(region) : null
  ]);
  const annotated = countryMeans ?? regionMeans;
  const ids = annotated
    ? [...annotated.keys()]
    : (await fetchAllSpeciesCounts(base)).map(r => r.taxon.id);

  const checklists = new Map(
    ids.map(id => [
      id,
      {
        country: checklistEntry(country, countryMeans, id),
        region: checklistEntry(region, regionMeans, id)
      }
    ])
  );

  // Sightings for whatever no checklist answers -- one pass per flag over the
  // whole circle rather than batches of taxon ids
  const open = ids.filter(id => classifyStatus(checklists.get(id)!).status === 'unknown');
  const flags = new Map<number, { native: number; introduced: number }>();
  if (open.length > 0) {
    const [native, introduced] = await Promise.all(
      (['native', 'introduced'] as const).map(async flag =>
        new Map((await fetchAllSpeciesCounts(`${base}&${flag}=true`)).map(r => [r.taxon.id, r.count]))
      )
    );
    for (const id of open) {
      flags.set(id, { native: native.get(id) ?? 0, introduced: introduced.get(id) ?? 0 });
    }
  }

  const byStatus: Record<EstablishmentStatus, number> = { native: 0, introduced: 0, unknown: 0 };
  for (const id of ids) {
    const f = flags.get(id);
    byStatus[classifyStatus(checklists.get(id)!, f && { ...f, label: '' }).status]++;
  }

  const totals = { total: ids.length, byStatus };
  totalsCache.set(key, totals);
  return totals;
};
