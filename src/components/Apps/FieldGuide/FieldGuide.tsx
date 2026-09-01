import React, { useState, useEffect, useRef } from 'react';
import MapPreview from './MapPreview';
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
  conservation_status?: {
    status_name?: string;
  };
}

interface SpeciesResult {
  count: number;
  taxon: Taxon;
}

interface LocationInfo {
  name: string;
  displayName: string;
  lat: number;
  lng: number;
}

interface LocationSuggestion {
  name?: string;
  display_name: string;
  lat: string;
  lon: string;
}

type TabType = 'all' | 'plants' | 'wildlife' | 'birds' | 'insects' | 'fungi';

const POPULAR_LOCATIONS: { name: string; query: string; displayName: string; lat: number; lng: number }[] = [
  { name: '⚡ Kanto (Kantō/Tokyo)', query: 'Kanto Region, Japan', displayName: 'Kantō Region (Tokyo), Japan', lat: 35.6762, lng: 139.6503 },
  { name: '🏯 Johto (Kyoto/Kansai)', query: 'Kyoto, Kansai, Japan', displayName: 'Kansai Region (Kyoto), Japan', lat: 35.0116, lng: 135.7681 },
  { name: '❄️ Sinnoh (Hokkaido)', query: 'Hokkaido, Japan', displayName: 'Hokkaido Region, Japan', lat: 43.0642, lng: 141.3469 },
  { name: '🗽 Unova (New York)', query: 'New York City, USA', displayName: 'New York City (Unova), USA', lat: 40.7128, lng: -74.0060 }
];

const TAXA_FILTER_MAP: Record<TabType, string> = {
  all: 'Plantae,Animalia,Fungi',
  plants: 'Plantae',
  wildlife: 'Mammalia,Reptilia,Amphibia',
  birds: 'Aves',
  insects: 'Insecta,Arachnida',
  fungi: 'Fungi'
};

const PAGE_SIZE = 36;

const FieldGuide: React.FC = () => {
  const [searchInput, setSearchInput] = useState('Kanto Region, Japan');
  const [currentLocation, setCurrentLocation] = useState<LocationInfo>({
    name: '⚡ Kanto (Kantō/Tokyo)',
    displayName: 'Kantō Region (Tokyo), Japan',
    lat: 35.6762,
    lng: 139.6503
  });
  const [radiusKm, setRadiusKm] = useState<number>(30);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [speciesList, setSpeciesList] = useState<SpeciesResult[]>([]);
  const [filterQuery, setFilterQuery] = useState('');
  
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

  // Sentinel ref for infinite scroll observer
  const observerTargetRef = useRef<HTMLDivElement | null>(null);

  // Inspector modal state
  const [selectedSpecies, setSelectedSpecies] = useState<SpeciesResult | null>(null);
  const [wikiSummary, setWikiSummary] = useState<string | null>(null);
  const [isLoadingWiki, setIsLoadingWiki] = useState(false);

  // Search location using OpenStreetMap Nominatim API
  const searchLocation = async (query: string) => {
    if (!query.trim()) return;
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

  // Fetch location autocomplete suggestions
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchInput(val);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (val.trim().length > 2) {
      searchTimeoutRef.current = setTimeout(async () => {
        try {
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
        } catch {
          // ignore background suggestion errors
        }
      }, 400);
    } else {
      setLocationSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const selectSuggestion = (sug: LocationSuggestion) => {
    const newLoc: LocationInfo = {
      name: sug.name || sug.display_name.split(',')[0],
      displayName: sug.display_name,
      lat: parseFloat(sug.lat),
      lng: parseFloat(sug.lon)
    };
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
        const taxaParam = TAXA_FILTER_MAP[activeTab];
        const url = `https://api.inaturalist.org/v1/observations/species_counts?lat=${currentLocation.lat}&lng=${currentLocation.lng}&radius=${radiusKm}&iconic_taxa=${encodeURIComponent(taxaParam)}&quality_grade=research&hrank=species&page=1&per_page=${PAGE_SIZE}`;

        const response = await fetch(url);
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
  }, [currentLocation, radiusKm, activeTab]);

  // Load more species for infinite scroll
  const loadMoreSpecies = async () => {
    if (!hasMore || isLoadingSpecies || isLoadingMore || !currentLocation) return;

    setIsLoadingMore(true);
    const nextPage = page + 1;

    try {
      const taxaParam = TAXA_FILTER_MAP[activeTab];
      const url = `https://api.inaturalist.org/v1/observations/species_counts?lat=${currentLocation.lat}&lng=${currentLocation.lng}&radius=${radiusKm}&iconic_taxa=${encodeURIComponent(taxaParam)}&quality_grade=research&hrank=species&page=${nextPage}&per_page=${PAGE_SIZE}`;

      const response = await fetch(url);
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

  // IntersectionObserver for seamless infinite scrolling
  useEffect(() => {
    const target = observerTargetRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingSpecies && !isLoadingMore) {
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
  }, [hasMore, isLoadingSpecies, isLoadingMore, page, currentLocation, radiusKm, activeTab]);

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

      const scName = selectedSpecies.taxon.name;
      const comName = selectedSpecies.taxon.preferred_common_name;

      const targets = [scName, comName].filter(Boolean) as string[];

      for (const target of targets) {
        try {
          const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(target.replace(/ /g, '_'))}`;
          const res = await fetch(wikiUrl);
          if (res.ok) {
            const data = await res.json();
            if (data.extract && isMounted) {
              setWikiSummary(data.extract);
              setIsLoadingWiki(false);
              return;
            }
          }
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

  const filteredSpecies = speciesList.filter(item => {
    if (!filterQuery.trim()) return true;
    const query = filterQuery.toLowerCase();
    const common = item.taxon.preferred_common_name?.toLowerCase() || '';
    const scientific = item.taxon.name.toLowerCase();
    const taxonName = item.taxon.iconic_taxon_name?.toLowerCase() || '';
    return common.includes(query) || scientific.includes(query) || taxonName.includes(query);
  });

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
      default: return '🐾';
    }
  };

  return (
    <div className="fieldguide-app">
      {/* App Toolbar / Search Header */}
      <div className="fieldguide-toolbar">
        <form
          className="fieldguide-search-form"
          onSubmit={(e) => {
            e.preventDefault();
            searchLocation(searchInput);
          }}
        >
          <div className="fieldguide-input-wrapper">
            <span className="fieldguide-search-icon">🔍</span>
            <input
              type="text"
              className="fieldguide-search-input"
              value={searchInput}
              onChange={handleInputChange}
              onFocus={() => locationSuggestions.length > 0 && setShowSuggestions(true)}
              placeholder="Search location (e.g. Kanto, Kyoto, Yellowstone, Maui...)"
            />
            {searchInput && (
              <button
                type="button"
                className="fieldguide-clear-btn"
                onClick={() => {
                  setSearchInput('');
                  setShowSuggestions(false);
                }}
              >
                ×
              </button>
            )}
            {showSuggestions && locationSuggestions.length > 0 && (
              <ul className="fieldguide-suggestions-box">
                {locationSuggestions.map((sug, i) => (
                  <li key={i} onClick={() => selectSuggestion(sug)} className="suggestion-row">
                    <span className="sug-pin">📍</span>
                    <span className="sug-text">{sug.display_name}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button
            type="submit"
            className="retro-button search-btn"
            disabled={isSearchingLocation}
          >
            {isSearchingLocation ? 'Locating...' : 'Explore'}
          </button>
        </form>

        <div className="fieldguide-quick-locations">
          <span className="quick-label">Hotspots:</span>
          {POPULAR_LOCATIONS.map((loc) => (
            <button
              key={loc.name}
              type="button"
              className={`retro-mini-button ${currentLocation.name === loc.name ? 'active-location' : ''}`}
              onClick={() => {
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

      {/* Location Status & Map Area */}
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

      {/* Category Tabs */}
      <div className="fieldguide-tabs-container">
        <div className="fieldguide-tabs">
          <button
            type="button"
            className={`retro-tab ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            🌍 All Species
          </button>
          <button
            type="button"
            className={`retro-tab ${activeTab === 'plants' ? 'active' : ''}`}
            onClick={() => setActiveTab('plants')}
          >
            🌿 Plants (Flora)
          </button>
          <button
            type="button"
            className={`retro-tab ${activeTab === 'wildlife' ? 'active' : ''}`}
            onClick={() => setActiveTab('wildlife')}
          >
            🦌 Wildlife (Fauna)
          </button>
          <button
            type="button"
            className={`retro-tab ${activeTab === 'birds' ? 'active' : ''}`}
            onClick={() => setActiveTab('birds')}
          >
            🦅 Birds
          </button>
          <button
            type="button"
            className={`retro-tab ${activeTab === 'insects' ? 'active' : ''}`}
            onClick={() => setActiveTab('insects')}
          >
            🦋 Insects
          </button>
          <button
            type="button"
            className={`retro-tab ${activeTab === 'fungi' ? 'active' : ''}`}
            onClick={() => setActiveTab('fungi')}
          >
            🍄 Fungi
          </button>
        </div>

        <div className="fieldguide-filter-box">
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

      {/* Error Message */}
      {errorMessage && (
        <div className="fieldguide-error-banner">
          <span className="error-icon">⚠️</span>
          <span className="error-text">{errorMessage}</span>
          <button
            className="retro-mini-button retry-btn"
            onClick={() => searchLocation(searchInput)}
          >
            Retry
          </button>
        </div>
      )}

      {/* Results Content Area */}
      <div className="fieldguide-content-area">
        {isLoadingSpecies ? (
          <div className="fieldguide-loading-box">
            <div className="retro-progress-container">
              <div className="retro-progress-bar-animated" />
            </div>
            <p className="loading-caption">
              Cataloging native species in {currentLocation.name}...
            </p>
          </div>
        ) : filteredSpecies.length === 0 ? (
          <div className="fieldguide-empty-box">
            <div className="empty-icon">🔎</div>
            <h3>No species recorded in this category</h3>
            <p>
              Try expanding the observation radius or switching tabs to explore other taxa.
            </p>
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

            {/* Infinite Scroll Sentinel & Status Indicator */}
            {hasMore && !filterQuery && (
              <div ref={observerTargetRef} className="infinite-scroll-footer">
                {isLoadingMore ? (
                  <div className="infinite-scroll-loading">
                    <div className="mini-progress-bar">
                      <div className="mini-progress-fill" />
                    </div>
                    <span className="infinite-loading-text">
                      Loading more specimens from iNaturalist...
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

            {!hasMore && speciesList.length > 0 && !filterQuery && (
              <div className="all-loaded-banner">
                ✓ All {speciesList.length} cataloged specimens loaded for {currentLocation.name}
              </div>
            )}
          </div>
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
                      <span className="stat-label">Local Sightings:</span>
                      <span className="stat-value">
                        {selectedSpecies.count.toLocaleString()} research observations
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
