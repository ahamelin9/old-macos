import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import MapPreview from './MapPreview';
import SpeciesRange, { TaxonSuggestion, TaxonDetail, TaxonAncestor } from './SpeciesRange';
import { useGridColumns } from './useGridColumns';
import { ConservationStatusRecord, globalIucnStatus } from './conservation';
import MonthChart from './MonthChart';
import { MONTH_NAMES, peakMonths } from './months';
import {
  ChecklistPlace,
  EstablishmentStatus,
  StatusResult,
  SpeciesFilter,
  StatusTotals,
  countEstablishmentStatuses,
  fetchWithRetry,
  getEstablishmentStatuses,
  resolveChecklistPlaces,
  speciesFilterParams
} from './establishmentStatus';
import './FieldGuide.css';

interface Taxon {
  id: number;
  name: string; // Scientific name (e.g. Sequoiadendron giganteum)
  preferred_common_name?: string;
  rank: string;
  iconic_taxon_name: string;
  default_photo?: {
    medium_url?: string;
    square_url?: string;
    attribution?: string;
    url?: string;
  };
  wikipedia_url?: string;
  ancestor_ids?: number[];
  /** Present when the taxon came from a full /v1/taxa/{id} record. */
  conservation_statuses?: ConservationStatusRecord[];
  /** Present when the taxon came from a full /v1/taxa/{id} record. */
  ancestors?: TaxonAncestor[];
}

// The classic ranks. iNaturalist also lists subphyla, tribes and so on,
// which would make the tree twice as deep for little gain.
const LINEAGE_RANKS = ['kingdom', 'phylum', 'class', 'order', 'family', 'genus', 'species'];

// Genus names and below are italicised by convention
const ITALIC_RANKS = new Set(['genus', 'subgenus', 'species', 'subspecies', 'variety', 'form', 'hybrid']);

interface SpeciesResult {
  count: number;
  taxon: Taxon;
}

interface LocationInfo {
  name: string;
  displayName: string;
  lat: number;
  lng: number;
  /** True when the point came from the device's location, not a search. */
  fromDevice?: boolean;
}

interface LocationSuggestion {
  name?: string;
  display_name: string;
  lat: string;
  lon: string;
}

type TabType =
  | 'all'
  | 'plants'
  | 'fungi'
  | 'birds'
  | 'mammals'
  | 'herps'
  | 'insects'
  | 'fish'
  | 'molluscs';

interface CategoryTab {
  id: TabType;
  icon: string;
  label: string;
  /** Tooltip: what the tab really holds, where the label has to be short */
  title: string;
  /** species_counts params for this group; empty means no filter at all */
  filter: string;
  /** "Of 312 bird species within 25 km" -- also names the group when the tabs are icons only */
  noun: string;
}

/**
 * The category tabs. "All" sends no group filter: iNaturalist's iconic taxon
 * "Animalia" means "other animals" (slugs, crabs, worms...), so the old
 * Plantae,Animalia,Fungi list left out every bird, mammal, insect and fish --
 * about half of what lives in Tokyo. Fish goes by taxon id because sharks and
 * rays have no iconic taxon of their own (they fall under "Animalia").
 */
const CATEGORY_TABS: CategoryTab[] = [
  { id: 'all', icon: '🌍', label: 'All Species', title: 'Everything recorded here', filter: '', noun: 'species' },
  { id: 'plants', icon: '🌿', label: 'Plants', title: 'Plants', filter: 'iconic_taxa=Plantae', noun: 'plant species' },
  { id: 'fungi', icon: '🍄', label: 'Fungi', title: 'Mushrooms, lichens and other fungi', filter: 'iconic_taxa=Fungi', noun: 'species of fungi' },
  { id: 'birds', icon: '🦅', label: 'Birds', title: 'Birds', filter: 'iconic_taxa=Aves', noun: 'bird species' },
  { id: 'mammals', icon: '🦌', label: 'Mammals', title: 'Mammals', filter: 'iconic_taxa=Mammalia', noun: 'mammal species' },
  { id: 'herps', icon: '🐸', label: 'Reptiles & Amphibians', title: 'Reptiles and amphibians', filter: 'iconic_taxa=Reptilia,Amphibia', noun: 'reptile & amphibian species' },
  { id: 'insects', icon: '🦋', label: 'Insects & Spiders', title: 'Insects, plus spiders, ticks, mites and other arachnids', filter: 'iconic_taxa=Insecta,Arachnida', noun: 'insect & spider species' },
  { id: 'fish', icon: '🐟', label: 'Fish', title: 'Bony fish, sharks and rays', filter: 'taxon_id=47178,47273', noun: 'fish species' },
  { id: 'molluscs', icon: '🐚', label: 'Molluscs', title: 'Snails, slugs, clams, octopuses and squid', filter: 'iconic_taxa=Mollusca', noun: 'mollusc species' }
];

const TAB_FILTERS = Object.fromEntries(CATEGORY_TABS.map(tab => [tab.id, tab.filter])) as Record<TabType, string>;

/**
 * 'places' searches a location and lists what lives there.
 * 'species' searches a plant or animal and maps where it is native.
 */
type SearchMode = 'places' | 'species';

type StatusFilter = 'all' | EstablishmentStatus;

/**
 * Where the user was before a jump -- a species' range from a place's
 * inspector, a place from a species' range, or a group from the lineage
 * tree -- so Back can return there. Only the fields for `mode` are restored.
 */
interface NavSpot {
  mode: SearchMode;
  label: string;
  searchInput: string;
  scrollTop: number;
  location: LocationInfo;
  /** The places-mode inspector that was open, reopened on the way back. */
  inspected: SpeciesResult | null;
  selectedTaxon: TaxonSuggestion | null;
}

const MAX_BACK_STEPS = 20;

// Key order is the order of the filter buttons
const STATUS_LABELS: Record<EstablishmentStatus, string> = {
  native: 'Native',
  endemic: 'Endemic',
  introduced: 'Introduced',
  unknown: 'Unknown'
};

// Same colour key as the range view. "Unknown" is its "Present": seen here,
// but no checklist says how it arrived.
const STATUS_SWATCHES: Record<EstablishmentStatus, string> = {
  native: 'swatch-native',
  endemic: 'swatch-endemic',
  introduced: 'swatch-introduced',
  unknown: 'swatch-present'
};

// Endemic species are native too, so the Native filter and count take them in
const matchesStatusFilter = (status: EstablishmentStatus | undefined, filter: StatusFilter) =>
  filter === 'all' || status === filter || (filter === 'native' && status === 'endemic');

const statusTooltip = (result: StatusResult) =>
  result.status === 'endemic'
    ? `Endemic: native here and found nowhere outside ${result.endemicTo} (per ${result.source})`
    : result.source
      ? `${STATUS_LABELS[result.status]} (per ${result.source})`
      : 'No checklist or sighting data says whether it is native here';

const STATUS_FILTER_TITLES: Record<EstablishmentStatus, string> = {
  native: 'Show only native species (endemic ones included)',
  endemic: 'Show only endemic species: native here and found nowhere outside this state or country',
  introduced: 'Show only introduced species',
  unknown: 'Show only species no checklist covers'
};

// Each hotspot is a radius around one city centre, so the city leads the
// name; the region it stands in for is just flavour. ("Sinnoh (Hokkaido)"
// promised all of Hokkaido but searched 25 km around Sapporo.)
const POPULAR_LOCATIONS: { name: string; query: string; displayName: string; lat: number; lng: number }[] = [
  { name: '⚡ Tokyo (Kanto)', query: 'Tokyo, Japan', displayName: 'Tokyo, Japan', lat: 35.6762, lng: 139.6503 },
  { name: '🏯 Kyoto (Johto)', query: 'Kyoto, Japan', displayName: 'Kyoto, Japan', lat: 35.0116, lng: 135.7681 },
  { name: '❄️ Sapporo (Sinnoh)', query: 'Sapporo, Hokkaido, Japan', displayName: 'Sapporo, Hokkaido, Japan', lat: 43.0642, lng: 141.3469 },
  { name: '🗽 New York City (Unova)', query: 'New York City, USA', displayName: 'New York City, USA', lat: 40.7128, lng: -74.0060 }
];

/**
 * Ancestor taxon ids used to pull a random discovery feed. `/v1/taxa` ignores
 * `iconic_taxa` entirely (it returns the same page whatever you pass), but
 * `taxon_id` filters to descendants, so this is how you actually get "a random
 * bird" rather than another page of common plants.
 */
const RANDOM_GROUPS: { id: number; name: string }[] = [
  { id: 40151, name: 'Mammals' },
  { id: 3, name: 'Birds' },
  { id: 26036, name: 'Reptiles' },
  { id: 20978, name: 'Amphibians' },
  { id: 47158, name: 'Insects' },
  { id: 47119, name: 'Arachnids' },
  { id: 47126, name: 'Plants' },
  { id: 47178, name: 'Fish' },
  { id: 47115, name: 'Molluscs' }
];

// Each batch draws from a few groups at once so rows stay mixed. Page depth is
// capped well inside every group's total so a draw never lands on an empty page.
const GROUPS_PER_BATCH = 3;
const PER_GROUP = 8;
const MAX_RANDOM_PAGE = 25;

const pickRandom = <T,>(items: T[], count: number): T[] =>
  [...items].sort(() => Math.random() - 0.5).slice(0, count);

const PAGE_SIZE = 36;

// Below this many sightings in the search circle, "when to look" widens to
// the state or country around it rather than chart a handful of records
const MIN_LOCAL_SIGHTINGS = 20;


/** "Grey_heron" from an English Wikipedia article link; null for anything else. */
const articleTitleFromUrl = (url?: string): string | null => {
  const match = url?.match(/^https?:\/\/en\.wikipedia\.org\/wiki\/([^?#]+)/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]).replace(/_/g, ' ');
  } catch {
    return null;
  }
};

/** Genus and epithet of a scientific name, lower-cased ("ardea", "cinerea"). */
const nameParts = (scientificName: string) =>
  scientificName
    .toLowerCase()
    .split(/\s+/)
    .filter(part => part.length > 2 && !part.includes('.'));

/**
 * Whether a Wikipedia summary found by common name is about this organism,
 * not something else that shares the name. The extract usually drops the
 * "(Ardea cinerea)" after the name, so the article's Wikidata item settles
 * it: a taxon item carries its scientific name (P225), which must share the
 * genus or the epithet (genera get renamed; epithets mostly survive).
 */
const isArticleAboutTaxon = async (
  summary: { extract: string; wikibase_item?: string },
  scientificName: string
): Promise<boolean> => {
  const parts = nameParts(scientificName);
  const extract = summary.extract.toLowerCase();
  if (parts.some(part => extract.includes(part))) return true;
  if (!summary.wikibase_item || !/^Q\d+$/.test(summary.wikibase_item)) return false;
  try {
    const res = await fetch(
      `https://www.wikidata.org/w/api.php?action=wbgetclaims&entity=${summary.wikibase_item}` +
        '&property=P225&format=json&origin=*'
    );
    if (!res.ok) return false;
    const data = await res.json();
    const taxonName: string | undefined = data.claims?.P225?.[0]?.mainsnak?.datavalue?.value;
    return !!taxonName && nameParts(taxonName).some(part => parts.includes(part));
  } catch {
    return false;
  }
};
/** One page of the places-mode list: species seen in the circle, most-seen first */
const speciesCountsUrl = (loc: LocationInfo, radiusKm: number, filter: SpeciesFilter, page: number) =>
  `https://api.inaturalist.org/v1/observations/species_counts?lat=${loc.lat}&lng=${loc.lng}` +
  `&radius=${radiusKm}${speciesFilterParams(filter)}&quality_grade=research&hrank=species` +
  `&page=${page}&per_page=${PAGE_SIZE}`;

const FieldGuide: React.FC = () => {
  // Opens on the first hotspot
  const [searchInput, setSearchInput] = useState(POPULAR_LOCATIONS[0].query);
  const [currentLocation, setCurrentLocation] = useState<LocationInfo>(() => {
    const { name, displayName, lat, lng } = POPULAR_LOCATIONS[0];
    return { name, displayName, lat, lng };
  });
  const [radiusKm, setRadiusKm] = useState<number>(25);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  // "In season now": only species recorded here in the current calendar
  // month, in any year -- what is likely to be out there right now
  const [inSeasonOnly, setInSeasonOnly] = useState(false);
  const thisMonth = new Date().getMonth() + 1;
  const seasonMonth = inSeasonOnly ? thisMonth : null;
  const [searchMode, setSearchMode] = useState<SearchMode>('places');
  const [speciesList, setSpeciesList] = useState<SpeciesResult[]>([]);
  const [filterQuery, setFilterQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Native/introduced status comes from iNaturalist checklists for the places
  // containing the search point -- never from how often a species is seen.
  // Both are tagged with the location they belong to so a slow response for
  // an old location is never shown against a new one.
  const [checklistPlaces, setChecklistPlaces] = useState<{ key: string; places: ChecklistPlace[] } | null>(null);
  const [statuses, setStatuses] = useState<{ key: string; byTaxon: Record<number, StatusResult> }>({
    key: '',
    byTaxon: {}
  });
  // Counts across every species in the area, not just the loaded pages.
  // `totals` is null when counting failed.
  const [statusTotals, setStatusTotals] = useState<{ key: string; totals: StatusTotals | null } | null>(null);
  
  // Pagination & Infinite Scroll states
  const [page, setPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [totalRecords, setTotalRecords] = useState<number | null>(null);
  
  // UI states
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [isLoadingSpecies, setIsLoadingSpecies] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(true);
  
  // Location suggestions
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // "Near Me": the device's own location. Each request gets an id so a fix
  // that arrives after the user has picked somewhere else is ignored.
  const [isLocatingUser, setIsLocatingUser] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  const locateRequestRef = useRef(0);

  // Species-mode search ("where does this animal live?")
  const [taxonSuggestions, setTaxonSuggestions] = useState<TaxonSuggestion[]>([]);
  const [selectedTaxon, setSelectedTaxon] = useState<TaxonSuggestion | null>(null);
  const [isSearchingTaxa, setIsSearchingTaxa] = useState(false);
  const [featuredTaxa, setFeaturedTaxa] = useState<TaxonSuggestion[]>([]);
  const [isLoadingFeatured, setIsLoadingFeatured] = useState(false);
  const featuredRequestedRef = useRef(false);
  const seenFeaturedIdsRef = useRef<Set<number>>(new Set());
  const gallerySentinelRef = useRef<HTMLDivElement | null>(null);

  // Full rows only, so the layout never ends on a ragged edge
  const [galleryGridRef, galleryColumns] = useGridColumns(160, 8);

  // Sentinel ref for infinite scroll observer
  const observerTargetRef = useRef<HTMLDivElement | null>(null);

  // Inspector modal state
  const [selectedSpecies, setSelectedSpecies] = useState<SpeciesResult | null>(null);
  const [wikiSummary, setWikiSummary] = useState<string | null>(null);
  const [isLoadingWiki, setIsLoadingWiki] = useState(false);
  // The inspected taxon's full record: its ancestors for the lineage tree and
  // its conservation assessments. Tagged with its id so a slow response never
  // shows under a different specimen; `failed` when it could not be loaded.
  const [taxonRecord, setTaxonRecord] = useState<{
    taxonId: number;
    failed: boolean;
    ancestors: TaxonAncestor[];
    conservationStatuses: ConservationStatusRecord[];
  } | null>(null);

  // Sightings by month for the inspected taxon. `key` ties it to the taxon
  // and the area it was counted over; `counts` is null when loading failed.
  const [monthly, setMonthly] = useState<{ key: string; counts: number[] | null; scope: string } | null>(null);

  // Back navigation between modes, newest last
  const [backStack, setBackStack] = useState<NavSpot[]>([]);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const pendingScrollRef = useRef<number | null>(null);
  const [scrollRequest, setScrollRequest] = useState(0);

  // Drop any pending "Near Me" request: the user has chosen a place by hand.
  const cancelLocateUser = () => {
    locateRequestRef.current++;
    setIsLocatingUser(false);
    setLocateError(null);
  };

  // Turn a GPS fix into a short place name for the banner. Returns null on
  // failure; the species search only needs the coordinates anyway.
  const describeCoordinates = async (lat: number, lng: number) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=10`,
        { headers: { 'Accept-Language': 'en' }, signal: controller.signal }
      );
      if (!res.ok) return null;
      const data = await res.json();
      const a = data.address || {};
      const locality = a.city || a.town || a.village || a.hamlet || a.suburb || a.municipality || a.county;
      const region = a.state || a.province || a.region;
      const parts = [...new Set([locality, region, a.country].filter(Boolean))] as string[];
      if (parts.length === 0) return null;
      return {
        name: parts[0],
        fullName: parts.join(', '),
        displayName: (data.display_name as string) || parts.join(', ')
      };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  };

  // Ask the browser where the user is and search around that point
  const locateUser = () => {
    const requestId = ++locateRequestRef.current;
    setLocateError(null);
    setErrorMessage(null);
    setShowSuggestions(false);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!('geolocation' in navigator)) {
      setLocateError("This browser can't share its location. Type a place instead.");
      return;
    }
    if (!window.isSecureContext) {
      setLocateError('Your location can only be shared over a secure (https) connection. Type a place instead.');
      return;
    }

    setIsLocatingUser(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude: lat, longitude: lng } = position.coords;
        const place = await describeCoordinates(lat, lng);
        if (locateRequestRef.current !== requestId) return;
        setCurrentLocation({
          name: place?.name || 'My Location',
          displayName: place?.displayName || 'Your current location',
          lat,
          lng,
          fromDevice: true
        });
        setSearchInput(place?.fullName || '');
        setLocationSuggestions([]);
        setIsLocatingUser(false);
      },
      (err) => {
        if (locateRequestRef.current !== requestId) return;
        setIsLocatingUser(false);
        setLocateError(
          err.code === err.PERMISSION_DENIED
            ? 'Location access is blocked. Allow it for this site in your browser settings, then try again.'
            : err.code === err.TIMEOUT
              ? 'Finding your location took too long. Try again, or type a place instead.'
              : "Your location isn't available right now. Try again, or type a place instead."
        );
      },
      // Low accuracy is plenty for a 10 km+ radius, and much faster
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 5 * 60 * 1000 }
    );
  };

  // Search location using OpenStreetMap Nominatim API
  const searchLocation = async (query: string) => {
    if (!query.trim()) return;
    cancelLocateUser();
    setIsSearchingLocation(true);
    setErrorMessage(null);
    setShowSuggestions(false);

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
        {
          headers: {
            'Accept-Language': 'en',
          }
        }
      );

      if (!response.ok) {
        throw new Error('Could not reach geocoding service.');
      }

      const results: LocationSuggestion[] = await response.json();
      if (results && results.length > 0) {
        const topResult = results[0];
        const newLoc: LocationInfo = {
          name: query.trim(),
          displayName: topResult.display_name,
          lat: parseFloat(topResult.lat),
          lng: parseFloat(topResult.lon)
        };
        setCurrentLocation(newLoc);
      } else {
        setErrorMessage(`No coordinates found for "${query}". Try adding a city, state, or country.`);
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error looking up location.');
    } finally {
      setIsSearchingLocation(false);
    }
  };

  // Search species by name using the iNaturalist taxa autocomplete
  const searchTaxa = async (query: string) => {
    if (!query.trim()) return;
    setIsSearchingTaxa(true);
    setErrorMessage(null);

    try {
      const res = await fetch(
        `https://api.inaturalist.org/v1/taxa/autocomplete?q=${encodeURIComponent(query)}&per_page=8&is_active=true`
      );
      if (!res.ok) {
        throw new Error(`iNaturalist API error: HTTP ${res.status}`);
      }

      const data = await res.json();
      const results: TaxonSuggestion[] = data.results || [];

      if (results.length === 0) {
        setErrorMessage(`No species matched "${query}". Try a common name like "red fox" or a scientific name.`);
        return;
      }

      // A single confident hit goes straight to the range map
      setTaxonSuggestions(results);
      if (results.length === 1) {
        setSelectedTaxon(results[0]);
        setShowSuggestions(false);
      } else {
        setShowSuggestions(true);
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error looking up species.');
    } finally {
      setIsSearchingTaxa(false);
    }
  };

  // Debounced autocomplete — hits Nominatim or iNaturalist depending on mode
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchInput(val);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (val.trim().length <= 2) {
      setLocationSuggestions([]);
      setTaxonSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        if (searchMode === 'species') {
          const res = await fetch(
            `https://api.inaturalist.org/v1/taxa/autocomplete?q=${encodeURIComponent(val)}&per_page=8&is_active=true`
          );
          if (res.ok) {
            const data = await res.json();
            setTaxonSuggestions(data.results || []);
            setShowSuggestions(true);
          }
        } else {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(val)}&format=json&limit=4`,
            {
              headers: { 'Accept-Language': 'en' }
            }
          );
          if (res.ok) {
            const data: LocationSuggestion[] = await res.json();
            setLocationSuggestions(data);
            setShowSuggestions(true);
          }
        }
      } catch {
        // ignore background suggestion errors
      }
    }, 400);
  };

  // Switching modes by hand is a fresh start, so the pinned species goes with
  // the search box. Leaving it behind meant coming back to species mode showed
  // the last animal's range with an empty search field, as if it had half
  // cleared itself. The two jump helpers below set searchMode directly to keep
  // the species they are carrying across.
  const switchMode = (mode: SearchMode) => {
    if (mode === searchMode) return;
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    cancelLocateUser();
    setBackStack([]);
    setSearchMode(mode);
    setSearchInput('');
    setSelectedTaxon(null);
    setShowSuggestions(false);
    setLocationSuggestions([]);
    setTaxonSuggestions([]);
    setErrorMessage(null);
  };

  // A new species replaces the whole range panel, so start at the top: its
  // header, and the toolbar with Back, in view rather than the reader left
  // mid-page where the similar-species row or gallery was.
  const selectTaxon = (taxon: TaxonSuggestion) => {
    scrollContentTo(0);
    setSelectedTaxon(taxon);
    setSearchInput(taxon.preferred_common_name || taxon.name);
    setShowSuggestions(false);
    setErrorMessage(null);
  };

  // Jump from the inspector into a range map: the inspected species' own
  // ("Where Else It Lives"), or a group's from the lineage tree.
  // Sets searchMode directly rather than going through switchMode, which
  // deliberately clears the search box and the pinned species.
  const viewRangeFromInspector = (inspected: TaxonSuggestion) => {
    rememberSpot();
    scrollContentTo(0);
    setSelectedSpecies(null);
    setSearchMode('species');
    setSelectedTaxon(inspected);
    setSearchInput(inspected.preferred_common_name || inspected.name);
    setTaxonSuggestions([]);
    setShowSuggestions(false);
    setErrorMessage(null);
  };

  // Open the same Specimen Inspector from the range view's header photo. The
  // modal is shaped for a places-mode row, so the worldwide observation total
  // stands in for that row's local count -- the label reads accordingly.
  const inspectRangeTaxon = (inspected: TaxonDetail, observationCount: number) => {
    setSelectedSpecies({
      count: observationCount,
      taxon: {
        ...inspected,
        rank: inspected.rank || 'species',
        iconic_taxon_name: inspected.iconic_taxon_name || ''
      }
    });
  };

  // Jump from a species' range back into place mode for that region. The
  // species stays selected so its range view stays mounted for Back.
  const explorePlaceFromRange = (placeName: string) => {
    rememberSpot();
    scrollContentTo(0);
    setSearchMode('places');
    setSearchInput(placeName);
    setTaxonSuggestions([]);
    setShowSuggestions(false);
    searchLocation(placeName);
  };

  const selectSuggestion = (sug: LocationSuggestion) => {
    const newLoc: LocationInfo = {
      name: sug.name || sug.display_name.split(',')[0],
      displayName: sug.display_name,
      lat: parseFloat(sug.lat),
      lng: parseFloat(sug.lon)
    };
    cancelLocateUser();
    setSearchInput(newLoc.name);
    setCurrentLocation(newLoc);
    setShowSuggestions(false);
  };

  // Initial fetch on location, radius, or tab change
  useEffect(() => {
    if (!currentLocation) return;

    let isMounted = true;
    const fetchInitialSpecies = async () => {
      setIsLoadingSpecies(true);
      setErrorMessage(null);
      setPage(1);
      setHasMore(true);

      try {
        const url = speciesCountsUrl(currentLocation, radiusKm, { taxa: TAB_FILTERS[activeTab], month: seasonMonth }, 1);

        // Retries a rate-limited request: flicking through the tabs quickly
        // is a burst iNaturalist will turn away for a moment
        const response = await fetchWithRetry(url);
        if (!response.ok) {
          throw new Error(`iNaturalist API error: HTTP ${response.status}`);
        }

        const data = await response.json();
        if (isMounted) {
          const results: SpeciesResult[] = data.results || [];
          setSpeciesList(results);
          setTotalRecords(data.total_results || results.length);
          setHasMore(results.length >= PAGE_SIZE);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setErrorMessage(err instanceof Error ? err.message : 'Unable to retrieve biodiversity data from iNaturalist.');
        }
      } finally {
        if (isMounted) {
          setIsLoadingSpecies(false);
        }
      }
    };

    fetchInitialSpecies();

    return () => {
      isMounted = false;
    };
  }, [currentLocation, radiusKm, activeTab, seasonMonth]);

  const locationKey = `${currentLocation.lat},${currentLocation.lng}`;
  const statusKey = `${locationKey},${radiusKm}`;

  // Which country / prefecture / city checklists apply to this point
  useEffect(() => {
    let cancelled = false;
    const key = `${currentLocation.lat},${currentLocation.lng}`;
    resolveChecklistPlaces(currentLocation.lat, currentLocation.lng)
      .catch(() => [] as ChecklistPlace[])
      .then(places => {
        if (!cancelled) setChecklistPlaces({ key, places });
      });
    return () => {
      cancelled = true;
    };
  }, [currentLocation]);

  // Classify everything loaded so far. Re-running on each new page is cheap:
  // lookups are cached per place, so only the new taxa hit the network.
  useEffect(() => {
    if (isLoadingSpecies || speciesList.length === 0) return;
    if (!checklistPlaces || checklistPlaces.key !== locationKey) return;

    let cancelled = false;
    getEstablishmentStatuses(
      speciesList.map(s => s.taxon.id),
      checklistPlaces.places,
      { lat: currentLocation.lat, lng: currentLocation.lng, radiusKm }
    ).then(result => {
      if (!cancelled) setStatuses({ key: statusKey, byTaxon: Object.fromEntries(result) });
    });
    return () => {
      cancelled = true;
    };
  }, [speciesList, isLoadingSpecies, checklistPlaces, locationKey, statusKey, currentLocation, radiusKm]);

  // Whole-area totals for the summary line above the list
  const totalsKey = `${statusKey},${activeTab},${seasonMonth}`;
  useEffect(() => {
    if (!checklistPlaces || checklistPlaces.key !== locationKey) return;

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    // A failure is usually iNaturalist turning away a burst (flicking through
    // the tabs), so try again after a pause rather than give up on the counts
    const RETRY_PAUSES_MS = [8000, 20000];
    const attempt = (n: number) => {
      countEstablishmentStatuses(
        checklistPlaces.places,
        { lat: currentLocation.lat, lng: currentLocation.lng, radiusKm },
        { taxa: TAB_FILTERS[activeTab], month: seasonMonth }
      )
        .then(totals => {
          if (!cancelled) setStatusTotals({ key: totalsKey, totals });
        })
        .catch(() => {
          if (cancelled) return;
          if (n < RETRY_PAUSES_MS.length) {
            retryTimer = setTimeout(() => attempt(n + 1), RETRY_PAUSES_MS[n]);
          } else {
            setStatusTotals({ key: totalsKey, totals: null });
          }
        });
    };
    attempt(0);
    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
    };
  }, [checklistPlaces, locationKey, totalsKey, currentLocation, radiusKm, activeTab, seasonMonth]);

  const currentTotals = statusTotals?.key === totalsKey ? statusTotals : undefined;
  const activeTabInfo = CATEGORY_TABS.find(tab => tab.id === activeTab)!;
  const seasonPhrase = seasonMonth ? ` seen in ${MONTH_NAMES[seasonMonth - 1]}` : '';
  const totalsByStatus = currentTotals?.totals?.byStatus;

  const statusOf = (taxonId: number): StatusResult | undefined =>
    statuses.key === statusKey ? statuses.byTaxon[taxonId] : undefined;

  // A chip over the card photo, or plain swatch + label in the inspector
  const renderStatusBadge = (taxonId: number, inline = false) => {
    const result = statusOf(taxonId);
    const className = inline ? 'status-inline' : 'status-badge';
    if (!result) {
      return <span className={`${className} status-pending`}>Checking…</span>;
    }
    return (
      <span className={className} title={statusTooltip(result)}>
        <span className={`status-swatch ${STATUS_SWATCHES[result.status]}`} />
        {STATUS_LABELS[result.status]}
      </span>
    );
  };

  // Load more species for infinite scroll
  const loadMoreSpecies = async () => {
    if (!hasMore || isLoadingSpecies || isLoadingMore || !currentLocation) return;

    setIsLoadingMore(true);
    const nextPage = page + 1;

    try {
      const url = speciesCountsUrl(currentLocation, radiusKm, { taxa: TAB_FILTERS[activeTab], month: seasonMonth }, nextPage);

      const response = await fetchWithRetry(url);
      if (response.ok) {
        const data = await response.json();
        const newResults: SpeciesResult[] = data.results || [];

        if (newResults.length > 0) {
          setSpeciesList(prev => {
            const seen = new Set(prev.map(p => p.taxon.id));
            const unique = newResults.filter(p => !seen.has(p.taxon.id));
            return [...prev, ...unique];
          });
          setPage(nextPage);
          setHasMore(newResults.length >= PAGE_SIZE);
        } else {
          setHasMore(false);
        }
      } else {
        setHasMore(false);
      }
    } catch {
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const filteredSpecies = speciesList.filter(item => {
    if (statusFilter !== 'all' && !matchesStatusFilter(statusOf(item.taxon.id)?.status, statusFilter)) return false;
    if (!filterQuery.trim()) return true;
    const query = filterQuery.toLowerCase();
    const common = item.taxon.preferred_common_name?.toLowerCase() || '';
    const scientific = item.taxon.name.toLowerCase();
    const taxonName = item.taxon.iconic_taxon_name?.toLowerCase() || '';
    return common.includes(query) || scientific.includes(query) || taxonName.includes(query);
  });

  // Under a status filter, how many matches were showing when the last page
  // was auto-loaded. -1 means "not yet", so the first load always goes ahead.
  const [statusAutoLoadFloor, setStatusAutoLoadFloor] = useState(-1);
  useEffect(() => {
    setStatusAutoLoadFloor(-1);
  }, [statusFilter, currentLocation, radiusKm, activeTab, seasonMonth]);

  // Whether scrolling will keep loading pages by itself. The footer shows a
  // progress bar while this holds and the Load More button only when it does
  // not, so the button never flashes up just before an automatic load.
  //  - A text filter pauses it: its sentinel is usually already on screen, so
  //    auto-loading would page through the whole dataset in a burst.
  //  - Under a status filter, new species stay hidden until classified, so the
  //    next page waits for that (otherwise pages load back to back). A page
  //    that adds no matches -- e.g. "Unknown" where every species has a
  //    checklist entry -- pauses it too.
  const statusesPending = speciesList.some(item => !statusOf(item.taxon.id));
  const autoLoadEnabled =
    !filterQuery &&
    (statusFilter === 'all' || statusesPending || filteredSpecies.length > statusAutoLoadFloor);
  const canAutoLoadNow = autoLoadEnabled && (statusFilter === 'all' || !statusesPending);

  // IntersectionObserver for seamless infinite scrolling
  useEffect(() => {
    const target = observerTargetRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          hasMore &&
          canAutoLoadNow &&
          !isLoadingSpecies &&
          !isLoadingMore
        ) {
          if (statusFilter !== 'all') setStatusAutoLoadFloor(filteredSpecies.length);
          loadMoreSpecies();
        }
      },
      {
        threshold: 0.1,
        rootMargin: '300px'
      }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, isLoadingSpecies, isLoadingMore, page, currentLocation, radiusKm, activeTab, seasonMonth, canAutoLoadNow, statusFilter, filteredSpecies.length, searchMode]);

  // Pull one more batch of random species for the discovery gallery
  const loadFeaturedBatch = async () => {
    if (isLoadingFeatured) return;
    setIsLoadingFeatured(true);

    try {
      const groups = pickRandom(RANDOM_GROUPS, GROUPS_PER_BATCH);
      const batches = await Promise.all(
        groups.map(async (group) => {
          const page = Math.floor(Math.random() * MAX_RANDOM_PAGE) + 1;
          try {
            const res = await fetch(
              `https://api.inaturalist.org/v1/taxa?is_active=true&rank=species&taxon_id=${group.id}` +
                `&order_by=observations_count&order=desc&per_page=${PER_GROUP}&page=${page}`
            );
            if (!res.ok) return [];
            const data = await res.json();
            return (data.results || []) as TaxonSuggestion[];
          } catch {
            return [];
          }
        })
      );

      // Interleave the groups so a row is a mix rather than eight beetles
      const fresh = pickRandom(batches.flat(), Number.MAX_SAFE_INTEGER).filter(
        t => t.default_photo && !seenFeaturedIdsRef.current.has(t.id)
      );
      fresh.forEach(t => seenFeaturedIdsRef.current.add(t.id));
      if (fresh.length > 0) setFeaturedTaxa(prev => [...prev, ...fresh]);
    } finally {
      setIsLoadingFeatured(false);
    }
  };

  // Seed the gallery the first time species mode is opened. The ref guard
  // matters: tracking "already requested" in state would change a dependency
  // mid-flight, and the re-run's cleanup would cancel the request.
  useEffect(() => {
    if (searchMode !== 'species' || featuredRequestedRef.current) return;
    featuredRequestedRef.current = true;
    loadFeaturedBatch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchMode]);

  // Endless discovery scroll for the gallery
  useEffect(() => {
    const target = gallerySentinelRef.current;
    if (!target || searchMode !== 'species' || selectedTaxon) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoadingFeatured) {
          loadFeaturedBatch();
        }
      },
      { threshold: 0.1, rootMargin: '300px' }
    );

    observer.observe(target);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchMode, selectedTaxon, isLoadingFeatured, featuredTaxa.length]);

  // Fetch Wikipedia summary when species is selected
  useEffect(() => {
    if (!selectedSpecies) {
      setWikiSummary(null);
      return;
    }

    let isMounted = true;
    const fetchWiki = async () => {
      setIsLoadingWiki(true);
      setWikiSummary(null);

      const { name, preferred_common_name, wikipedia_url } = selectedSpecies.taxon;

      // The article iNaturalist links the taxon to is the surest match, then
      // the scientific name, then the common name -- which is the one most
      // likely to land on the wrong page ("Robin" is a disambiguation page).
      const linkedTitle = articleTitleFromUrl(wikipedia_url);
      const targets: { title: string; byCommonName: boolean }[] = [
        ...(linkedTitle ? [{ title: linkedTitle, byCommonName: false }] : []),
        { title: name, byCommonName: false },
        ...(preferred_common_name ? [{ title: preferred_common_name, byCommonName: true }] : [])
      ];

      for (const { title, byCommonName } of targets) {
        try {
          const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`;
          const res = await fetch(wikiUrl);
          if (!res.ok) continue;
          const data = await res.json();
          if (data.type !== 'standard' || !data.extract) continue;
          // A page found by common name may be about something else entirely
          if (byCommonName && !(await isArticleAboutTaxon(data, name))) continue;
          if (isMounted) {
            setWikiSummary(data.extract);
            setIsLoadingWiki(false);
          }
          return;
        } catch {
          // try next
        }
      }

      if (isMounted) {
        setWikiSummary('No encyclopedia summary found for this specimen.');
        setIsLoadingWiki(false);
      }
    };

    fetchWiki();

    return () => {
      isMounted = false;
    };
  }, [selectedSpecies]);

  // The window's content box, not the app, is what scrolls
  const getScrollParent = () => {
    for (let el = rootRef.current?.parentElement; el; el = el.parentElement) {
      const { overflowY } = getComputedStyle(el);
      if (overflowY === 'auto' || overflowY === 'scroll') return el;
    }
    return null;
  };

  // Scroll once the next render has committed, so the restored view is laid
  // out before the offset is applied
  const scrollContentTo = (top: number) => {
    pendingScrollRef.current = top;
    setScrollRequest(n => n + 1);
  };

  useLayoutEffect(() => {
    const top = pendingScrollRef.current;
    if (top === null) return;
    pendingScrollRef.current = null;
    const scroller = getScrollParent();
    if (scroller) scroller.scrollTop = top;
  }, [scrollRequest]);

  // Save the current view before jumping to the other mode
  const rememberSpot = () => {
    const spot: NavSpot = {
      mode: searchMode,
      label:
        searchMode === 'places'
          ? currentLocation.name
          : selectedTaxon?.preferred_common_name || selectedTaxon?.name || 'species',
      searchInput,
      scrollTop: getScrollParent()?.scrollTop ?? 0,
      location: currentLocation,
      inspected: selectedSpecies,
      selectedTaxon
    };
    setBackStack(stack => [...stack, spot].slice(-MAX_BACK_STEPS));
  };

  const goBack = () => {
    const spot = backStack[backStack.length - 1];
    if (!spot) return;
    setBackStack(stack => stack.slice(0, -1));
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    cancelLocateUser();
    setShowSuggestions(false);
    setLocationSuggestions([]);
    setTaxonSuggestions([]);
    setErrorMessage(null);
    setSearchMode(spot.mode);
    setSearchInput(spot.searchInput);
    if (spot.mode === 'places') {
      // Same object if nothing changed since, so the list is not refetched
      setCurrentLocation(spot.location);
    } else {
      setSelectedTaxon(spot.selectedTaxon);
    }
    // Reopens the inspector when the jump was made from it
    setSelectedSpecies(spot.inspected);
    scrollContentTo(spot.scrollTop);
  };

  // Lineage and conservation status for the inspector. The range view's
  // record already carries both; a places-mode row has neither, so fetch it.
  useEffect(() => {
    if (!selectedSpecies) return;
    const { id, ancestors, conservation_statuses } = selectedSpecies.taxon;
    if (ancestors?.length && conservation_statuses) {
      setTaxonRecord({ taxonId: id, failed: false, ancestors, conservationStatuses: conservation_statuses });
      return;
    }

    let cancelled = false;
    fetchWithRetry(`https://api.inaturalist.org/v1/taxa/${id}`)
      .then(res => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then(data => {
        const record = data.results?.[0];
        if (!cancelled) {
          setTaxonRecord({
            taxonId: id,
            failed: false,
            ancestors: record?.ancestors || [],
            conservationStatuses: record?.conservation_statuses || []
          });
        }
      })
      .catch(() => {
        if (!cancelled) setTaxonRecord({ taxonId: id, failed: true, ancestors: [], conservationStatuses: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [selectedSpecies]);

  // "When to look": in places mode, sightings around the search point (or
  // its state/country when that circle has too few); from the range view,
  // worldwide.
  const monthlyKey = selectedSpecies
    ? `${selectedSpecies.taxon.id}|${searchMode === 'places' ? statusKey : 'world'}`
    : '';
  const regionPlace =
    checklistPlaces?.key === locationKey
      ? checklistPlaces.places.find(p => p.adminLevel === 10) ?? checklistPlaces.places[0]
      : undefined;
  useEffect(() => {
    if (!selectedSpecies) return;
    const id = selectedSpecies.taxon.id;
    const key = monthlyKey;
    let cancelled = false;

    const histogram = async (scopeParams: string) => {
      const res = await fetchWithRetry(
        `https://api.inaturalist.org/v1/observations/histogram?taxon_id=${id}&date_field=observed` +
          `&interval=month_of_year&quality_grade=research${scopeParams}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const byMonth = (await res.json()).results?.month_of_year || {};
      return Array.from({ length: 12 }, (_, i) => Number(byMonth[i + 1]) || 0);
    };
    const sum = (counts: number[]) => counts.reduce((a, b) => a + b, 0);

    (async () => {
      try {
        if (searchMode !== 'places') {
          const counts = await histogram('');
          if (!cancelled) setMonthly({ key, counts, scope: 'worldwide' });
          return;
        }
        const local = await histogram(
          `&lat=${currentLocation.lat}&lng=${currentLocation.lng}&radius=${radiusKm}`
        );
        if (sum(local) >= MIN_LOCAL_SIGHTINGS || !regionPlace) {
          if (!cancelled) setMonthly({ key, counts: local, scope: `within ${radiusKm} km` });
          return;
        }
        const wider = await histogram(`&place_id=${regionPlace.id}`);
        if (!cancelled) {
          setMonthly(
            sum(wider) > sum(local)
              ? { key, counts: wider, scope: `across ${regionPlace.name} (few sightings nearby)` }
              : { key, counts: local, scope: `within ${radiusKm} km` }
          );
        }
      } catch {
        if (!cancelled) setMonthly({ key, counts: null, scope: '' });
      }
    })();
    return () => {
      cancelled = true;
    };
    // Keyed on monthlyKey: the location and radius only matter through it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthlyKey, regionPlace?.id]);
  const inspectedMonthly = monthly?.key === monthlyKey ? monthly : null;

  const inspectedRecord =
    selectedSpecies && taxonRecord?.taxonId === selectedSpecies.taxon.id ? taxonRecord : null;
  const inspectedIucn = inspectedRecord ? globalIucnStatus(inspectedRecord.conservationStatuses) : null;

  // Show whole rows only; the remainder waits for the next draw to fill it in
  const visibleFeaturedTaxa = featuredTaxa.slice(
    0,
    Math.max(galleryColumns, Math.floor(featuredTaxa.length / galleryColumns) * galleryColumns)
  );

  const getTaxonIcon = (iconicName: string) => {
    switch (iconicName) {
      case 'Plantae': return '🌿';
      case 'Aves': return '🦅';
      case 'Mammalia': return '🦌';
      case 'Reptilia': return '🦎';
      case 'Amphibia': return '🐸';
      case 'Insecta': return '🦋';
      case 'Arachnida': return '🕷️';
      case 'Fungi': return '🍄';
      case 'Actinopterygii': return '🐟';
      case 'Mollusca': return '🐚';
      default: return '🐾';
    }
  };

  return (
    <div className="fieldguide-app" ref={rootRef}>
      {/* Header: the mode tabs sit on the search panel's top edge and the
          active one opens into it, like the category tabs further down.
          Back floats above as a plain button on the left, where it is
          expected; the tabs stay put on the right whether or not it shows. */}
      <div className="fieldguide-header">
        {/* Search mode: browse a place, or look up one species' range */}
        <div className="fieldguide-mode-switch">
          {backStack.length > 0 && (
            <button
              type="button"
              className="fieldguide-back-btn"
              onClick={goBack}
              title={`Return to ${backStack[backStack.length - 1].label}`}
            >
              ◀ Back to {backStack[backStack.length - 1].label}
            </button>
          )}
          <span className="mode-switch-hint-box">
            <span className="mode-switch-hint">
              {searchMode === 'places'
                ? 'What lives near a location?'
                : 'Where in the world is it native?'}
            </span>
          </span>
          <div className="mode-switch-buttons" role="group" aria-label="Search mode">
            <button
              type="button"
              className={`retro-tab mode-tab ${searchMode === 'places' ? 'active' : ''}`}
              onClick={() => switchMode('places')}
              aria-pressed={searchMode === 'places'}
            >
              📍 <span className="mode-tab-verb">Search </span>Places
            </button>
            <button
              type="button"
              className={`retro-tab mode-tab ${searchMode === 'species' ? 'active' : ''}`}
              onClick={() => switchMode('species')}
              aria-pressed={searchMode === 'species'}
            >
              🐾 <span className="mode-tab-verb">Search </span>Species
            </button>
          </div>
        </div>

        <div className="fieldguide-toolbar">
          <form
            className="fieldguide-search-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (searchMode === 'species') {
                searchTaxa(searchInput);
              } else {
                searchLocation(searchInput);
              }
            }}
          >
            <div className="fieldguide-input-wrapper">
              <span className="fieldguide-search-icon">{searchMode === 'species' ? '🐾' : '🔍'}</span>
              <input
                type="text"
                className="fieldguide-search-input"
                value={searchInput}
                onChange={handleInputChange}
                onFocus={() => {
                  const pool = searchMode === 'species' ? taxonSuggestions : locationSuggestions;
                  if (pool.length > 0) setShowSuggestions(true);
                }}
                placeholder={
                  searchMode === 'species'
                    ? 'Search a plant or animal (e.g. red fox, monarch butterfly, giant sequoia...)'
                    : 'Search location (e.g. Tokyo, Kyoto, Yellowstone, Maui...)'
                }
              />
              {searchInput && (
                <button
                  type="button"
                  className="fieldguide-clear-btn"
                  title={searchMode === 'species' ? 'Clear and return to the gallery' : 'Clear'}
                  onClick={() => {
                    setSearchInput('');
                    setShowSuggestions(false);
                    // In species mode this is also the way back to the gallery
                    if (searchMode === 'species') {
                      setSelectedTaxon(null);
                      setTaxonSuggestions([]);
                    }
                  }}
                >
                  ×
                </button>
              )}
              {showSuggestions && searchMode === 'places' && locationSuggestions.length > 0 && (
                <ul className="fieldguide-suggestions-box">
                  {locationSuggestions.map((sug, i) => (
                    <li key={i} onClick={() => selectSuggestion(sug)} className="suggestion-row">
                      <span className="sug-pin">📍</span>
                      <span className="sug-text">{sug.display_name}</span>
                    </li>
                  ))}
                </ul>
              )}
              {showSuggestions && searchMode === 'species' && taxonSuggestions.length > 0 && (
                <ul className="fieldguide-suggestions-box">
                  {taxonSuggestions.map((sug) => (
                    <li
                      key={sug.id}
                      onClick={() => selectTaxon(sug)}
                      className="suggestion-row taxon-suggestion-row"
                    >
                      {sug.default_photo?.square_url ? (
                        <img
                          src={sug.default_photo.square_url}
                          alt=""
                          className="sug-thumb"
                          loading="lazy"
                        />
                      ) : (
                        <span className="sug-pin">
                          {getTaxonIcon(sug.iconic_taxon_name || '')}
                        </span>
                      )}
                      <span className="sug-text">
                        <strong>{sug.preferred_common_name || sug.name}</strong>
                        {sug.preferred_common_name && (
                          <em className="sug-sci"> · {sug.name}</em>
                        )}
                      </span>
                      <span className="sug-rank">{sug.rank}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button
              type="submit"
              className="retro-button search-btn"
              disabled={searchMode === 'species' ? isSearchingTaxa : isSearchingLocation}
            >
              {searchMode === 'species'
                ? (isSearchingTaxa ? 'Tracking...' : 'Track')
                : (isSearchingLocation ? 'Locating...' : 'Explore')}
            </button>
            {searchMode === 'places' && (
              <button
                type="button"
                className={`retro-button near-me-btn ${currentLocation.fromDevice ? 'active' : ''} ${isLocatingUser ? 'locating' : ''}`}
                onClick={locateUser}
                disabled={isLocatingUser}
                aria-pressed={!!currentLocation.fromDevice}
                aria-label={isLocatingUser ? 'Finding your location' : 'Use my location'}
                title={isLocatingUser ? 'Finding your location…' : 'Use my location to see what lives nearby'}
              >
                {/* Crosshair "my location" mark; currentColor follows the button state */}
                <svg className="near-me-icon" viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
                  <circle cx="8" cy="8" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                  <circle cx="8" cy="8" r="1.75" fill="currentColor" />
                  <path
                    d="M8 0.75V3.5M8 12.5v2.75M0.75 8H3.5M12.5 8h2.75"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            )}
          </form>

          <div
            className="fieldguide-quick-locations"
            style={searchMode === 'species' ? { display: 'none' } : undefined}
          >
            <span className="quick-label">Hotspots:</span>
            {POPULAR_LOCATIONS.map((loc) => (
              <button
                key={loc.name}
                type="button"
                className={`retro-mini-button ${currentLocation.name === loc.name ? 'active-location' : ''}`}
                onClick={() => {
                  cancelLocateUser();
                  setSearchInput(loc.query);
                  setCurrentLocation({
                    name: loc.name,
                    displayName: loc.displayName,
                    lat: loc.lat,
                    lng: loc.lng
                  });
                  setShowSuggestions(false);
                }}
              >
                {loc.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Location Status, Map & Category Tabs (places mode only) */}
      {searchMode === 'places' && (
        <>
          <div className="fieldguide-location-banner">
            <div className="location-info-bar">
              <div className="location-title-row">
                <span className="location-badge">📍 {currentLocation.name}</span>
                <span className="location-coords">
                  ({currentLocation.lat.toFixed(4)}°, {currentLocation.lng.toFixed(4)}°)
                </span>
              </div>
              <div className="location-controls-row">
                <div className="radius-selector-group">
                  <label htmlFor="radius-select">Radius:</label>
                  <select
                    id="radius-select"
                    className="retro-select"
                    value={radiusKm}
                    onChange={(e) => setRadiusKm(Number(e.target.value))}
                  >
                    <option value={10}>10 km</option>
                    <option value={25}>25 km</option>
                    <option value={50}>50 km</option>
                    <option value={100}>100 km</option>
                  </select>
                </div>
                <label
                  className={`season-toggle ${inSeasonOnly ? 'active' : ''}`}
                  title={`Only species with sightings within ${radiusKm} km in ${MONTH_NAMES[thisMonth - 1]} (any year): what is likely to be out there this month`}
                >
                  <input
                    type="checkbox"
                    checked={inSeasonOnly}
                    onChange={(e) => setInSeasonOnly(e.target.checked)}
                  />
                  In season now
                </label>
                <button
                  type="button"
                  className="retro-button map-toggle-btn"
                  onClick={() => setShowMap(!showMap)}
                >
                  {showMap ? '▲ Hide Map' : '▼ Show Map'}
                </button>
              </div>
            </div>

            {showMap && (
              <MapPreview
                lat={currentLocation.lat}
                lng={currentLocation.lng}
                locationName={currentLocation.name}
                radiusKm={radiusKm}
              />
            )}
          </div>

          {/* Category Tabs. The bar is a size container so the filters can move
              above the tabs when the *window* is narrow, whatever the viewport. */}
          <div className="fieldguide-tabs-bar">
            <div className="fieldguide-tabs-container">
              <div className="fieldguide-tabs" role="tablist" aria-label="Species group">
                {CATEGORY_TABS.map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === tab.id}
                    className={`retro-tab category-tab ${activeTab === tab.id ? 'active' : ''}`}
                    onClick={() => setActiveTab(tab.id)}
                    title={tab.title}
                    aria-label={tab.label}
                  >
                    <span aria-hidden="true">{tab.icon}</span>
                    <span className="category-tab-label">{tab.label}</span>
                  </button>
                ))}
              </div>

              <div className="fieldguide-filter-box">
                <div className="subfilter-field">
                  <input
                    type="text"
                    className="fieldguide-subfilter-input"
                    placeholder="Filter list..."
                    value={filterQuery}
                    onChange={(e) => setFilterQuery(e.target.value)}
                  />
                  {filterQuery && (
                    <button
                      type="button"
                      className="filter-clear-btn"
                      onClick={() => setFilterQuery('')}
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Error Message */}
      {(errorMessage || locateError) && (
        <div className="fieldguide-error-banner">
          <span className="error-icon">⚠️</span>
          <span className="error-text">{errorMessage || locateError}</span>
          <button
            className="retro-mini-button retry-btn"
            onClick={() => {
              if (!errorMessage) locateUser();
              else if (searchMode === 'species') searchTaxa(searchInput);
              else searchLocation(searchInput);
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Results Content Area */}
      <div className="fieldguide-content-area">
        {/* Stays mounted, only hidden, while a place opened from it is shown,
            so Back finds it exactly as it was: map, expanded lists and all. */}
        {selectedTaxon && (
          <div hidden={searchMode !== 'species'}>
            <SpeciesRange
              taxon={selectedTaxon}
              onExplorePlace={explorePlaceFromRange}
              onSelectTaxon={selectTaxon}
              onInspect={inspectRangeTaxon}
              getTaxonIcon={getTaxonIcon}
            />
          </div>
        )}
        {searchMode === 'species' ? (
          selectedTaxon ? null : (
            <div className="featured-species-view">
              <div className="featured-intro">
                <h3>🐾 Track a species across the globe</h3>
                <p>
                  Search any plant or animal above to see its native range, where it has been
                  introduced, and everywhere it has been recorded — or keep scrolling for a
                  random draw from the archive.
                </p>
              </div>

              {isLoadingFeatured && featuredTaxa.length === 0 ? (
                <div className="fieldguide-loading-box">
                  <div className="retro-progress-container">
                    <div className="retro-progress-bar-animated" />
                  </div>
                  <p className="loading-caption">Opening the specimen archive...</p>
                </div>
              ) : (
                <div
                  className="species-grid"
                  ref={galleryGridRef}
                  style={{ gridTemplateColumns: `repeat(${galleryColumns}, 1fr)` }}
                >
                  {visibleFeaturedTaxa.map((taxon) => {
                    const photoUrl =
                      taxon.default_photo?.medium_url ||
                      taxon.default_photo?.square_url ||
                      taxon.default_photo?.url;

                    return (
                      <div
                        key={taxon.id}
                        className="species-card"
                        onClick={() => selectTaxon(taxon)}
                      >
                        <div className="species-photo-container">
                          {photoUrl ? (
                            <img
                              src={photoUrl}
                              alt={taxon.name}
                              className="species-photo"
                              loading="lazy"
                            />
                          ) : (
                            <div className="species-photo-placeholder">
                              <span className="placeholder-icon">
                                {getTaxonIcon(taxon.iconic_taxon_name || '')}
                              </span>
                            </div>
                          )}
                          <span className="species-badge">
                            {getTaxonIcon(taxon.iconic_taxon_name || '')}{' '}
                            {taxon.iconic_taxon_name || 'Specimen'}
                          </span>
                        </div>

                        <div className="species-info">
                          <h4 className="species-common-name">
                            {taxon.preferred_common_name || taxon.name}
                          </h4>
                          <p className="species-scientific-name">{taxon.name}</p>
                          <div className="species-footer">
                            <span className="observation-count">
                              📊 {(taxon.observations_count ?? 0).toLocaleString()} sightings
                            </span>
                            <span className="inspect-link">Range ▶</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Endless draw: loading more keeps the last row complete */}
              {featuredTaxa.length > 0 && (
                <div ref={gallerySentinelRef} className="infinite-scroll-footer">
                  {isLoadingFeatured ? (
                    <div className="infinite-scroll-loading">
                      <div className="mini-progress-bar">
                        <div className="mini-progress-fill" />
                      </div>
                      <span className="infinite-loading-text">
                        Drawing more specimens from the archive...
                      </span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="retro-button load-more-button"
                      onClick={loadFeaturedBatch}
                    >
                      ⬇ Draw More Specimens ({visibleFeaturedTaxa.length} shown)
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        ) : isLoadingSpecies ? (
          <div className="fieldguide-loading-box">
            <div className="retro-progress-container">
              <div className="retro-progress-bar-animated" />
            </div>
            <p className="loading-caption">
              Cataloging species in {currentLocation.name}...
            </p>
          </div>
        ) : (
          <>
            {/* Whole-area breakdown, and the status filter: each count is a
                toggle. The buttons stay even without counts (still counting,
                area too big, request failed) so filtering always works. */}
            <div className="status-summary">
              <span className="quick-label">
                {!currentTotals ? (
                  <span className="status-summary-note">Counting species by status…</span>
                ) : currentTotals.totals && totalsByStatus ? (
                  `Of ${currentTotals.totals.total.toLocaleString()} ${activeTabInfo.noun}${seasonPhrase} within ${radiusKm} km:`
                ) : currentTotals.totals ? (
                  <>
                    {currentTotals.totals.total.toLocaleString()} {activeTabInfo.noun}{seasonPhrase} within {radiusKm} km
                    <span className="status-summary-note">
                      {' '}— too many to count by status; show:
                    </span>
                  </>
                ) : (
                  'Show:'
                )}
              </span>
              {(Object.keys(STATUS_LABELS) as EstablishmentStatus[]).map(status => (
                <button
                  key={status}
                  type="button"
                  className={`retro-mini-button ${statusFilter === status ? 'active-filter' : ''}`}
                  aria-pressed={statusFilter === status}
                  title={statusFilter === status ? 'Show all statuses' : STATUS_FILTER_TITLES[status]}
                  onClick={() => setStatusFilter(statusFilter === status ? 'all' : status)}
                >
                  <span className={`status-swatch ${STATUS_SWATCHES[status]}`} />
                  {totalsByStatus &&
                    `${(status === 'native'
                      ? totalsByStatus.native + totalsByStatus.endemic
                      : totalsByStatus[status]
                    ).toLocaleString()} `}
                  {STATUS_LABELS[status]}
                </button>
              ))}
            </div>

            {filteredSpecies.length === 0 ? (
              <div className="fieldguide-empty-box">
                <div className="empty-icon">🔎</div>
                {filterQuery || statusFilter !== 'all' ? (
                  <>
                    <h3>
                      No loaded specimens match
                      {statusFilter !== 'all' && ` "${STATUS_LABELS[statusFilter]}"`}
                      {filterQuery && statusFilter !== 'all' && ' and'}
                      {filterQuery && ` "${filterQuery}"`}
                    </h3>
                    <p>
                      {hasMore
                        ? 'Load more specimens below to widen the search, or clear the filter.'
                        : 'Every specimen for this area is already loaded. Try another term or clear the filter.'}
                    </p>
                  </>
                ) : (
                  <>
                    <h3>
                      No {activeTabInfo.noun} recorded here{seasonPhrase && ` in ${MONTH_NAMES[seasonMonth! - 1]}`}
                    </h3>
                    <p>
                      {seasonMonth
                        ? 'Turn off "In season now" to see the whole year, or widen the radius.'
                        : 'Try expanding the observation radius or switching tabs to explore other taxa.'}
                    </p>
                  </>
                )}
              </div>
            ) : (
              <div className="species-grid">
                {filteredSpecies.map((item) => {
                  const photoUrl =
                    item.taxon.default_photo?.medium_url ||
                    item.taxon.default_photo?.square_url ||
                    item.taxon.default_photo?.url;

                  return (
                    <div
                      key={item.taxon.id}
                      className="species-card"
                      onClick={() => setSelectedSpecies(item)}
                    >
                      <div className="species-photo-container">
                        {photoUrl ? (
                          <img
                            src={photoUrl}
                            alt={item.taxon.name}
                            className="species-photo"
                            loading="lazy"
                          />
                        ) : (
                          <div className="species-photo-placeholder">
                            <span className="placeholder-icon">
                              {getTaxonIcon(item.taxon.iconic_taxon_name)}
                            </span>
                          </div>
                        )}
                        <span className="species-badge">
                          {getTaxonIcon(item.taxon.iconic_taxon_name)}{' '}
                          {item.taxon.iconic_taxon_name || 'Specimen'}
                        </span>
                        {renderStatusBadge(item.taxon.id)}
                      </div>

                      <div className="species-info">
                        <h4 className="species-common-name">
                          {item.taxon.preferred_common_name || item.taxon.name}
                        </h4>
                        <p className="species-scientific-name">
                          {item.taxon.name}
                        </p>
                        <div className="species-footer">
                          <span className="observation-count">
                            📊 {item.count.toLocaleString()} sightings
                          </span>
                          <span className="inspect-link">Details ▶</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Infinite scroll sentinel. It stays mounted while auto-loading is
                paused (see autoLoadEnabled) so the list can keep growing by
                hand; the button only appears then. */}
            {hasMore && (
              <div ref={observerTargetRef} className="infinite-scroll-footer">
                {isLoadingMore || autoLoadEnabled ? (
                  <div className="infinite-scroll-loading">
                    <div className="mini-progress-bar">
                      <div className="mini-progress-fill" />
                    </div>
                    <span className="infinite-loading-text">
                      {!isLoadingMore && statusFilter !== 'all' && statusesPending
                        ? 'Checking which new specimens are native or introduced...'
                        : 'Loading more specimens from iNaturalist...'}
                    </span>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="retro-button load-more-button"
                    onClick={loadMoreSpecies}
                  >
                    ⬇ Load More Specimens ({speciesList.length}{totalRecords ? ` of ${totalRecords}` : ''} loaded)
                  </button>
                )}
              </div>
            )}

            {!hasMore && speciesList.length > 0 && (
              <div className="all-loaded-banner">
                ✓ All {speciesList.length} cataloged specimens loaded for {currentLocation.name}
              </div>
            )}
          </>
        )}
      </div>

      {/* Retro Mac Specimen Details Inspector Modal */}
      {selectedSpecies && (
        <div className="retro-modal-overlay" onClick={() => setSelectedSpecies(null)}>
          <div
            className="retro-modal-window"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="retro-modal-header">
              <div className="retro-modal-controls">
                <button
                  className="retro-modal-close"
                  onClick={() => setSelectedSpecies(null)}
                >
                  ×
                </button>
              </div>
              <span className="retro-modal-title">
                Specimen Inspector: {selectedSpecies.taxon.preferred_common_name || selectedSpecies.taxon.name}
              </span>
            </div>

            <div className="retro-modal-body">
              <div className="inspector-layout">
                <div className="inspector-media">
                  {selectedSpecies.taxon.default_photo ? (
                    <>
                      <div className="inspector-image-frame">
                        <img
                          src={
                            selectedSpecies.taxon.default_photo.medium_url ||
                            selectedSpecies.taxon.default_photo.url
                          }
                          alt={selectedSpecies.taxon.name}
                          className="inspector-image"
                        />
                      </div>
                      {selectedSpecies.taxon.default_photo.attribution && (
                        <p className="inspector-attribution">
                          📷 {selectedSpecies.taxon.default_photo.attribution}
                        </p>
                      )}
                    </>
                  ) : (
                    <div className="inspector-image-frame placeholder">
                      <span className="big-icon">
                        {getTaxonIcon(selectedSpecies.taxon.iconic_taxon_name)}
                      </span>
                    </div>
                  )}

                  <div className="inspector-stats-box">
                    <div className="stat-row">
                      <span className="stat-label">Taxon ID:</span>
                      <span className="stat-value">#{selectedSpecies.taxon.id}</span>
                    </div>
                    <div className="stat-row">
                      <span className="stat-label">Taxonomic Rank:</span>
                      <span className="stat-value">{selectedSpecies.taxon.rank || 'Species'}</span>
                    </div>
                    <div className="stat-row">
                      <span className="stat-label">Category:</span>
                      <span className="stat-value">
                        {getTaxonIcon(selectedSpecies.taxon.iconic_taxon_name)}{' '}
                        {selectedSpecies.taxon.iconic_taxon_name}
                      </span>
                    </div>
                    <div className="stat-row">
                      <span className="stat-label">Global Status:</span>
                      <span className="stat-value">
                        {!inspectedRecord ? (
                          <span className="status-pending">Checking…</span>
                        ) : inspectedIucn ? (
                          <a
                            className="iucn-link"
                            href={inspectedIucn.url || 'https://www.iucnredlist.org/'}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="IUCN Red List category: a worldwide assessment, not for any one place"
                          >
                            <span className={`iucn-code iucn-${inspectedIucn.code.toLowerCase()}`}>
                              {inspectedIucn.code}
                            </span>
                            {inspectedIucn.label}
                            <span className="status-source">IUCN Red List</span>
                          </a>
                        ) : (
                          <span className="status-source">
                            {inspectedRecord.failed ? 'Couldn’t load' : 'No IUCN assessment on file'}
                          </span>
                        )}
                      </span>
                    </div>
                    {searchMode === 'places' && (
                      <div className="stat-row">
                        <span className="stat-label">Status Here:</span>
                        <span className="stat-value">
                          {renderStatusBadge(selectedSpecies.taxon.id, true)}
                          {statusOf(selectedSpecies.taxon.id)?.status === 'endemic' && (
                            <span className="status-source">
                              found only in {statusOf(selectedSpecies.taxon.id)!.endemicTo}
                            </span>
                          )}
                          {statusOf(selectedSpecies.taxon.id)?.source && (
                            <span className="status-source">
                              per {statusOf(selectedSpecies.taxon.id)!.source}
                            </span>
                          )}
                        </span>
                      </div>
                    )}
                    <div className="stat-row">
                      <span className="stat-label">
                        {searchMode === 'species' ? 'Worldwide Sightings:' : 'Local Sightings:'}
                      </span>
                      <span className="stat-value">
                        {selectedSpecies.count.toLocaleString()}{' '}
                        {searchMode === 'species' ? 'observations' : 'research observations'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="inspector-details">
                  <div className="inspector-names">
                    <h3 className="inspector-common">
                      {selectedSpecies.taxon.preferred_common_name || selectedSpecies.taxon.name}
                    </h3>
                    <p className="inspector-scientific">
                      <em>{selectedSpecies.taxon.name}</em>
                    </p>
                  </div>

                  <div className="inspector-encyclopedia">
                    <h4>📖 Encyclopedia Summary</h4>
                    {isLoadingWiki ? (
                      <div className="mini-loading">Consulting Wikipedia archives...</div>
                    ) : (
                      <p className="encyclopedia-text">
                        {wikiSummary || 'No additional summary available.'}
                      </p>
                    )}
                  </div>

                  <div className="inspector-external-links">
                    {/* Completes the loop: species mode sends you to a country,
                        this sends a country's species back to its range map.
                        Hidden when the inspector was opened from that very map. */}
                    {searchMode !== 'species' && (
                      <button
                        type="button"
                        className="retro-button external-btn range-jump-btn"
                        onClick={() => viewRangeFromInspector(selectedSpecies.taxon)}
                      >
                        🌍 Where Else It Lives
                      </button>
                    )}
                    {selectedSpecies.taxon.wikipedia_url && (
                      <a
                        href={selectedSpecies.taxon.wikipedia_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="retro-button external-btn"
                      >
                        🌐 View Wikipedia Article
                      </a>
                    )}
                    <a
                      href={`https://www.inaturalist.org/taxa/${selectedSpecies.taxon.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="retro-button external-btn"
                    >
                      🌿 View on iNaturalist
                    </a>
                  </div>
                </div>
              </div>

              <div className="inspector-season">
                <h4>
                  📅 When to look
                  {inspectedMonthly?.counts && (
                    <span className="lineage-hint">
                      sightings by month, {inspectedMonthly.scope}, all years
                    </span>
                  )}
                </h4>
                {!inspectedMonthly ? (
                  <div className="mini-loading">Checking the calendar...</div>
                ) : !inspectedMonthly.counts ? (
                  <div className="mini-loading">Couldn&rsquo;t load sightings by month.</div>
                ) : inspectedMonthly.counts.every(c => c === 0) ? (
                  <div className="mini-loading">No dated sightings to chart.</div>
                ) : (
                  <>
                    <p className="season-headline">
                      Most sightings: <strong>{peakMonths(inspectedMonthly.counts)}</strong>
                      {inspectedMonthly.scope === 'worldwide' && (
                        <span className="season-caveat">
                          {' '}· worldwide, so seasons south of the equator are flipped
                        </span>
                      )}
                    </p>
                    <MonthChart counts={inspectedMonthly.counts} currentMonth={thisMonth} />
                  </>
                )}
              </div>

              <div className="inspector-lineage">
                <h4>
                  🧬 Lineage
                  <span className="lineage-hint">click a group to map where it lives</span>
                </h4>
                {!inspectedRecord ? (
                  <div className="mini-loading">Tracing the family tree...</div>
                ) : inspectedRecord.failed ? (
                  <div className="mini-loading">Couldn&rsquo;t load the lineage for this specimen.</div>
                ) : (
                  <ol className="lineage-tree">
                    {[
                      ...inspectedRecord.ancestors.filter(node => LINEAGE_RANKS.includes(node.rank)),
                      selectedSpecies.taxon
                    ].map((node, depth, rows) => {
                      const isCurrent = depth === rows.length - 1;
                      const label = (
                        <>
                          <span className="lineage-rank">{node.rank}</span>
                          <span className={`lineage-name ${ITALIC_RANKS.has(node.rank) ? 'italic' : ''}`}>
                            {node.name}
                          </span>
                          {node.preferred_common_name && (
                            <span className="lineage-common">· {node.preferred_common_name}</span>
                          )}
                        </>
                      );
                      return (
                        <li
                          key={`${node.rank}-${node.name}`}
                          className={`lineage-node ${isCurrent ? 'current' : ''}`}
                          style={{ '--depth': depth } as React.CSSProperties}
                        >
                          {isCurrent ? (
                            <span className="lineage-label">{label}</span>
                          ) : (
                            <button
                              type="button"
                              className="lineage-label lineage-link"
                              title={`See the range of ${node.preferred_common_name || node.name}`}
                              onClick={() => viewRangeFromInspector(node)}
                            >
                              {label}
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>

              <div className="inspector-footer">
                <button
                  className="retro-button close-dialog-btn"
                  onClick={() => setSelectedSpecies(null)}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FieldGuide;
