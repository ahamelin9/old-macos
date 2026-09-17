import React, { useEffect, useRef, useState } from 'react';
import RangeMap, { ObservationBounds } from './RangeMap';
import { useGridColumns } from './useGridColumns';

export interface TaxonSuggestion {
  id: number;
  name: string;
  rank?: string;
  preferred_common_name?: string;
  iconic_taxon_name?: string;
  observations_count?: number;
  default_photo?: {
    square_url?: string;
    medium_url?: string;
    url?: string;
    attribution?: string;
  };
}

interface ListedTaxon {
  id: number;
  establishment_means?: string;
  place?: {
    id: number;
    name: string;
    display_name: string;
    admin_level?: number;
    ancestor_place_ids?: number[];
  };
}

interface TaxonDetail extends TaxonSuggestion {
  extinct?: boolean;
  wikipedia_url?: string;
  wikipedia_summary?: string;
  listed_taxa?: ListedTaxon[];
  listed_taxa_count?: number;
  conservation_status?: { status_name?: string };
  ancestors?: { rank: string; name: string }[];
}

interface SimilarSpecies {
  count: number; // how often identifiers have swapped between the two taxa
  taxon: TaxonSuggestion;
}

interface SpeciesRangeProps {
  taxon: TaxonSuggestion;
  onExplorePlace: (placeName: string) => void;
  onSelectTaxon: (taxon: TaxonSuggestion) => void;
  getTaxonIcon: (iconicName: string) => string;
}

const SIMILAR_SPECIES_LIMIT = 12;

interface CountryEntry {
  id: number;
  name: string;
  display: string;
  means: string | null;
}

// Bounds on the country-recovery pass, to keep it to a handful of requests
const ANCESTOR_LOOKUP_LIMIT = 60;
const RECOVERED_COUNTRY_LIMIT = 12;

// Continent place ids on iNaturalist. `listed_taxa` on the taxon record is
// capped at 100 rows out of (often) thousands, and the sample is arbitrary --
// a widespread species can come back looking purely "introduced". Asking for
// establishment_means one continent at a time is only six requests and gives
// a correct top-level answer to "where is this native?".
const CONTINENTS: { id: number; name: string }[] = [
  { id: 97394, name: 'North America' },
  { id: 97389, name: 'South America' },
  { id: 97391, name: 'Europe' },
  { id: 97392, name: 'Africa' },
  { id: 97395, name: 'Asia' },
  { id: 97393, name: 'Oceania' }
];

// Country-level checklist rows only; continents are covered above, and the API
// also returns counties and parks, which would drown the panel.
const COUNTRY_ADMIN_LEVEL = 0;

const MEANS_ORDER = ['endemic', 'native', 'introduced'];

// Each icon describes how the species came to be there, not how we rate it:
// it grew here, a ship brought it, or it is walled off in this one place.
// (Endemic is about geographic restriction, not rarity -- plenty of endemics
// are abundant inside their range -- so no "precious gem" imagery here.)
const MEANS_LABELS: Record<string, { label: string; short: string; icon: string }> = {
  endemic: { label: 'Endemic to', short: 'Endemic', icon: '🏝️' },
  native: { label: 'Native to', short: 'Native', icon: '🌱' },
  introduced: { label: 'Introduced to', short: 'Introduced', icon: '🚢' },
  other: { label: 'Also recorded in', short: 'Recorded', icon: '📋' }
};

// wikipedia_summary arrives as a small HTML fragment (<b>, <i>, links).
const stripHtml = (html: string) =>
  html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .trim();

/**
 * One establishment group, clamped to a single row of buttons with a toggle.
 * Country names vary in width, so the row is clamped in CSS and overflow is
 * detected by measurement rather than by counting items.
 */
const CountryRow: React.FC<{
  meta: { label: string; icon: string };
  countries: CountryEntry[];
  onExplorePlace: (placeName: string) => void;
}> = ({ meta, countries, onExplorePlace }) => {
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const [row, setRow] = useState<HTMLDivElement | null>(null);
  const buttonsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const box = buttonsRef.current;
    if (!row || !box) return;

    if (expanded) {
      box.style.maxHeight = '';
      return;
    }

    // Clamp to one actual button's height rather than a guessed pixel value --
    // a hardcoded max-height that is a pixel short makes every row look
    // overflowing. Observe the outer row, not the box we are resizing, so the
    // style write cannot feed back into the observer.
    const apply = () => {
      const first = box.firstElementChild as HTMLElement | null;
      if (!first) return;
      const rowHeight = first.offsetHeight;
      const clamp = `${rowHeight}px`;
      if (box.style.maxHeight !== clamp) box.style.maxHeight = clamp;
      setOverflowing(box.scrollHeight > rowHeight + 1);
    };

    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(row);
    return () => observer.disconnect();
  }, [row, expanded, countries.length]);

  return (
    <div className="range-means-row" ref={setRow}>
      <span className="quick-label">
        {meta.icon} {meta.label}:
      </span>
      <div
        ref={buttonsRef}
        className={`range-means-buttons ${expanded ? 'expanded' : 'clamped'}`}
      >
        {countries.map(country => (
          <button
            key={country.id}
            type="button"
            className="retro-mini-button"
            title={`See what else lives near ${country.name}`}
            onClick={() => onExplorePlace(country.name)}
          >
            {country.display}
          </button>
        ))}
      </div>
      {overflowing && (
        <button
          type="button"
          className="retro-mini-button range-expand-btn"
          onClick={() => setExpanded(prev => !prev)}
        >
          {expanded ? '▲ Fewer' : `▼ All ${countries.length}`}
        </button>
      )}
    </div>
  );
};

const SpeciesRange: React.FC<SpeciesRangeProps> = ({
  taxon,
  onExplorePlace,
  onSelectTaxon,
  getTaxonIcon
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const [similarSpecies, setSimilarSpecies] = useState<SimilarSpecies[]>([]);
  const [isLoadingSimilar, setIsLoadingSimilar] = useState(true);

  // Keep this section to exactly one row of whatever the window currently fits
  const [similarGridRef, similarColumns] = useGridColumns(116, 6);
  const [detail, setDetail] = useState<TaxonDetail | null>(null);
  const [bounds, setBounds] = useState<ObservationBounds | null>(null);
  const [totalObservations, setTotalObservations] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // continent place id -> what we know about the species there.
  // `means` is null whenever no checklist entry exists, which is NOT the same as
  // the species being absent: Monarch has 2,500+ verified sightings in Africa and
  // no African checklist row. `observations` separates those two cases.
  const [continentStatus, setContinentStatus] = useState<
    Record<number, { means: string | null; observations: number }>
  >({});
  const [isLoadingContinents, setIsLoadingContinents] = useState(true);

  // establishment means -> the countries we can actually stand behind
  const [countryGroups, setCountryGroups] = useState<Record<string, CountryEntry[]>>({});
  const [isLoadingCountries, setIsLoadingCountries] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchTaxonProfile = async (): Promise<TaxonDetail | null> => {
      setIsLoading(true);
      setErrorMessage(null);
      setDetail(null);
      setBounds(null);
      setTotalObservations(null);

      try {
        const [detailRes, boundsRes] = await Promise.all([
          fetch(`https://api.inaturalist.org/v1/taxa/${taxon.id}`),
          fetch(
            `https://api.inaturalist.org/v1/observations?taxon_id=${taxon.id}&per_page=0&verifiable=true&return_bounds=true`
          )
        ]);

        if (!detailRes.ok) {
          throw new Error(`iNaturalist API error: HTTP ${detailRes.status}`);
        }

        const detailData = await detailRes.json();
        const record: TaxonDetail | undefined = detailData.results?.[0];
        if (!record) {
          throw new Error('No record found for this species.');
        }

        if (boundsRes.ok) {
          const boundsData = await boundsRes.json();
          if (isMounted) {
            setBounds(boundsData.total_bounds || null);
            setTotalObservations(boundsData.total_results ?? null);
          }
        }

        if (isMounted) setDetail(record);
        return record;
      } catch (err: unknown) {
        if (isMounted) {
          setErrorMessage(
            err instanceof Error ? err.message : 'Unable to load range data for this species.'
          );
        }
        return null;
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    const fetchContinentalStatus = async () => {
      setIsLoadingContinents(true);
      setContinentStatus({});

      const entries = await Promise.all(
        CONTINENTS.map(async (continent) => {
          const empty = { means: null, observations: 0 };
          try {
            const [meansRes, obsRes] = await Promise.all([
              fetch(`https://api.inaturalist.org/v1/taxa/${taxon.id}?place_id=${continent.id}`),
              fetch(
                `https://api.inaturalist.org/v1/observations?taxon_id=${taxon.id}` +
                  `&place_id=${continent.id}&per_page=0&verifiable=true`
              )
            ]);

            const means = meansRes.ok
              ? (await meansRes.json()).results?.[0]?.establishment_means?.establishment_means ?? null
              : null;
            const observations = obsRes.ok ? (await obsRes.json()).total_results ?? 0 : 0;

            return [continent.id, { means, observations }] as const;
          } catch {
            return [continent.id, empty] as const;
          }
        })
      );

      if (isMounted) {
        setContinentStatus(Object.fromEntries(entries));
        setIsLoadingContinents(false);
      }
    };

    // "Similar species" here means taxa that identifiers have actually confused
    // with this one, which is far more useful than listing taxonomic siblings.
    const fetchSimilarSpecies = async () => {
      setIsLoadingSimilar(true);
      setSimilarSpecies([]);

      try {
        const res = await fetch(
          `https://api.inaturalist.org/v1/identifications/similar_species?taxon_id=${taxon.id}`
        );
        if (res.ok) {
          const data = await res.json();
          const results: SimilarSpecies[] = (data.results || [])
            .filter((r: SimilarSpecies) => r.taxon && r.taxon.id !== taxon.id)
            .slice(0, SIMILAR_SPECIES_LIMIT);
          if (isMounted) setSimilarSpecies(results);
        }
      } catch {
        // secondary section; the rest of the panel stands on its own
      } finally {
        if (isMounted) setIsLoadingSimilar(false);
      }
    };

    /**
     * `listed_taxa` is capped at 100 rows of (often) thousands and the sample is
     * arbitrary, so a species can come back looking purely introduced while the
     * continent table above says native -- the two sections then contradict each
     * other. The sub-national rows carry their country in `ancestor_place_ids`
     * though, so the countries missing from the sample can be recovered for free
     * and their real establishment looked up individually.
     */
    const recoverCountryRecords = async (record: TaxonDetail) => {
      setIsLoadingCountries(true);
      const listed = record.listed_taxa || [];

      const byCountry = new Map<number, CountryEntry>();
      for (const row of listed) {
        const place = row.place;
        if (!place || place.admin_level !== COUNTRY_ADMIN_LEVEL) continue;
        if (byCountry.has(place.id)) continue;
        byCountry.set(place.id, {
          id: place.id,
          name: place.name,
          display: place.display_name,
          means: (row.establishment_means || '').toLowerCase() || null
        });
      }

      const ancestorIds = new Set<number>();
      for (const row of listed) {
        for (const id of row.place?.ancestor_place_ids || []) {
          if (!byCountry.has(id)) ancestorIds.add(id);
        }
      }

      try {
        if (ancestorIds.size > 0) {
          const res = await fetch(
            `https://api.inaturalist.org/v1/places/${[...ancestorIds]
              .slice(0, ANCESTOR_LOOKUP_LIMIT)
              .join(',')}`
          );
          if (res.ok) {
            const data = await res.json();
            const candidates = (data.results || [])
              .filter(
                (p: { admin_level?: number }) => p.admin_level === COUNTRY_ADMIN_LEVEL
              )
              .slice(0, RECOVERED_COUNTRY_LIMIT);

            const resolved = await Promise.all(
              candidates.map(
                async (place: { id: number; name: string; display_name: string }) => {
                  try {
                    const r = await fetch(
                      `https://api.inaturalist.org/v1/taxa/${taxon.id}?place_id=${place.id}`
                    );
                    if (!r.ok) return null;
                    const d = await r.json();
                    const means =
                      d.results?.[0]?.establishment_means?.establishment_means ?? null;
                    return means
                      ? {
                          id: place.id,
                          name: place.name,
                          display: place.display_name,
                          means: means.toLowerCase()
                        }
                      : null;
                  } catch {
                    return null;
                  }
                }
              )
            );

            for (const entry of resolved) {
              if (entry && !byCountry.has(entry.id)) byCountry.set(entry.id, entry);
            }
          }
        }
      } catch {
        // fall back to whatever the checklist sample gave us
      }

      const groups: Record<string, CountryEntry[]> = {};
      for (const entry of byCountry.values()) {
        const key = entry.means && MEANS_ORDER.includes(entry.means) ? entry.means : 'other';
        (groups[key] ||= []).push(entry);
      }
      for (const list of Object.values(groups)) {
        list.sort((a, b) => a.display.localeCompare(b.display));
      }

      if (isMounted) {
        setCountryGroups(groups);
        setIsLoadingCountries(false);
      }
    };

    fetchTaxonProfile().then(record => {
      if (record && isMounted) recoverCountryRecords(record);
    });
    fetchContinentalStatus();
    fetchSimilarSpecies();

    return () => {
      isMounted = false;
    };
  }, [taxon.id]);

  // Jumping to a similar species swaps the whole panel; bring the new
  // specimen's header back into view instead of leaving the reader mid-page.
  useEffect(() => {
    panelRef.current?.scrollIntoView({ block: 'start' });
  }, [taxon.id]);

  if (isLoading) {
    return (
      <div className="fieldguide-loading-box">
        <div className="retro-progress-container">
          <div className="retro-progress-bar-animated" />
        </div>
        <p className="loading-caption">
          Plotting the range of {taxon.preferred_common_name || taxon.name}...
        </p>
      </div>
    );
  }

  if (errorMessage || !detail) {
    return (
      <div className="fieldguide-empty-box">
        <div className="empty-icon">⚠️</div>
        <h3>Could not load this specimen</h3>
        <p>{errorMessage}</p>
      </div>
    );
  }

  const orderedGroups = [...MEANS_ORDER, 'other'].filter(
    k => (countryGroups[k]?.length ?? 0) > 0
  );

  const listedTotal = detail.listed_taxa_count ?? 0;
  const listedReturned = detail.listed_taxa?.length ?? 0;
  const isTruncated = listedTotal > listedReturned;

  const photoUrl =
    detail.default_photo?.medium_url ||
    detail.default_photo?.url ||
    detail.default_photo?.square_url;

  const summary = detail.wikipedia_summary ? stripHtml(detail.wikipedia_summary) : null;

  const lineage = (detail.ancestors || [])
    .filter(a => ['kingdom', 'class', 'order', 'family'].includes(a.rank))
    .map(a => a.name)
    .join(' › ');

  return (
    <div className="species-range-panel" ref={panelRef}>
      {/* Identity header */}
      <div className="range-header-card">
        <div className="range-header-photo">
          {photoUrl ? (
            <img src={photoUrl} alt={detail.name} />
          ) : (
            <span className="big-icon">{getTaxonIcon(detail.iconic_taxon_name || '')}</span>
          )}
        </div>
        <div className="range-header-text">
          <h3 className="range-common-name">
            {detail.preferred_common_name || detail.name}
          </h3>
          <p className="range-scientific-name">
            <em>{detail.name}</em>
            <span className="range-rank-chip">{detail.rank || 'species'}</span>
          </p>
          {lineage && <p className="range-lineage">{lineage}</p>}
          <div className="range-header-stats">
            <span className="range-stat">
              {getTaxonIcon(detail.iconic_taxon_name || '')} {detail.iconic_taxon_name || 'Specimen'}
            </span>
            {totalObservations !== null && (
              <span className="range-stat">
                📊 {totalObservations.toLocaleString()} sightings worldwide
              </span>
            )}
            {detail.conservation_status?.status_name && (
              <span className="range-stat conservation-chip">
                🛡️ {detail.conservation_status.status_name}
              </span>
            )}
            {detail.extinct && <span className="range-stat extinct-chip">🦴 Extinct</span>}
          </div>
        </div>
      </div>

      <RangeMap
        taxonId={detail.id}
        taxonName={detail.preferred_common_name || detail.name}
        bounds={bounds}
      />

      {/* Where it lives — continent status first, then country detail */}
      <div className="range-places-section">
        <div className="range-section-header">
          <h4>🗺️ Where it lives</h4>
        </div>

        {/* Classic Platinum list view, matching the iTunes track list */}
        <div className="platinum-list">
          <div className="platinum-list-header">
            <div>Region</div>
            <div>Establishment</div>
          </div>
          <div className="platinum-list-body">
            {CONTINENTS.map(continent => {
              const status = continentStatus[continent.id];
              const means = status?.means;
              const observations = status?.observations ?? 0;

              // Three distinct states, because a missing checklist entry is not
              // evidence of absence -- only zero sightings is.
              const key = means && MEANS_ORDER.includes(means)
                ? means
                : observations > 0
                  ? 'present'
                  : 'absent';

              const label = isLoadingContinents
                ? 'Checking...'
                : key === 'absent'
                  ? 'No sightings'
                  : key === 'present'
                    ? `Present (${observations.toLocaleString()})`
                    : MEANS_LABELS[key].short;

              return (
                <div
                  key={continent.id}
                  className={`platinum-list-row ${key === 'absent' ? 'row-absent' : ''}`}
                  title={
                    key === 'present'
                      ? `${observations.toLocaleString()} verified sightings, but no checklist entry says whether it is native or introduced here`
                      : undefined
                  }
                >
                  <div className="list-cell-region">{continent.name}</div>
                  <div className="list-cell-status">
                    <span className={`status-swatch swatch-${key}`} />
                    {label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="range-country-header">
          <strong>Country records</strong>
          {!isLoadingCountries && orderedGroups.length > 0 && (
            // Sits with the buttons on purpose: when this hint lived down in the
            // legend, under the world map, it read as "click the map".
            <span className="range-country-hint">
              — pick a country button to see everything else that lives there
            </span>
          )}
          {isTruncated && (
            <span className="range-truncation-note">
              partial — iNaturalist caps this taxon&rsquo;s {listedTotal.toLocaleString()}{' '}
              checklist entries at {listedReturned}
            </span>
          )}
        </div>

        {isLoadingCountries ? (
          <p className="range-no-places">Checking country checklists...</p>
        ) : orderedGroups.length === 0 ? (
          <p className="range-no-places">
            No country-level checklist records published for this taxon. The continent summary
            and map above still show where it occurs.
          </p>
        ) : (
          orderedGroups.map(key => (
            <CountryRow
              key={key}
              meta={MEANS_LABELS[key]}
              countries={countryGroups[key]}
              onExplorePlace={onExplorePlace}
            />
          ))
        )}
        <p className="range-legend-line">
          <span className="status-swatch swatch-native" /> Native — occurs naturally &nbsp;·&nbsp;
          <span className="status-swatch swatch-introduced" /> Introduced — brought by humans
          &nbsp;·&nbsp;
          <span className="status-swatch swatch-endemic" /> Endemic — found nowhere else
          &nbsp;·&nbsp;
          <span className="status-swatch swatch-present" /> Present — seen here, but no checklist
          says how it arrived &nbsp;·&nbsp;
          <span className="status-swatch swatch-absent" /> No sightings on record
        </p>
      </div>

      {/* Encyclopedia */}
      {summary && (
        <div className="range-summary-section">
          <h4>📖 Encyclopedia Summary</h4>
          <p className="encyclopedia-text">{summary}</p>
        </div>
      )}

      {/* Commonly confused with — ordered by how often IDs were swapped */}
      {(isLoadingSimilar || similarSpecies.length > 0) && (
        <div className="similar-species-section">
          <div className="range-section-header">
            <h4>🔍 Similar Species</h4>
            <span className="range-truncation-note">
              most often confused with {detail.preferred_common_name || detail.name} by iNaturalist
              identifiers
            </span>
          </div>

          {isLoadingSimilar ? (
            <p className="similar-loading">Checking the identification records...</p>
          ) : (
            <div
              className="similar-species-grid"
              ref={similarGridRef}
              style={{ gridTemplateColumns: `repeat(${similarColumns}, 1fr)` }}
            >
              {similarSpecies.slice(0, similarColumns).map(({ taxon: similar, count }) => {
                const photoUrl =
                  similar.default_photo?.medium_url ||
                  similar.default_photo?.square_url ||
                  similar.default_photo?.url;

                return (
                  <button
                    key={similar.id}
                    type="button"
                    className="similar-card"
                    title={`View the range of ${similar.preferred_common_name || similar.name}`}
                    onClick={() => onSelectTaxon(similar)}
                  >
                    <div className="similar-photo">
                      {photoUrl ? (
                        <img src={photoUrl} alt={similar.name} loading="lazy" />
                      ) : (
                        <span className="similar-placeholder">
                          {getTaxonIcon(similar.iconic_taxon_name || '')}
                        </span>
                      )}
                    </div>
                    <div className="similar-info">
                      <span className="similar-common">
                        {similar.preferred_common_name || similar.name}
                      </span>
                      <span className="similar-scientific">{similar.name}</span>
                      <span className="similar-count">
                        {count.toLocaleString()} ID mix-ups
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="inspector-external-links range-links">
        {detail.wikipedia_url && (
          <a
            href={detail.wikipedia_url}
            target="_blank"
            rel="noopener noreferrer"
            className="retro-button external-btn"
          >
            🌐 View Wikipedia Article
          </a>
        )}
        <a
          href={`https://www.inaturalist.org/taxa/${detail.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="retro-button external-btn"
        >
          🌿 View on iNaturalist
        </a>
      </div>
    </div>
  );
};

export default SpeciesRange;
