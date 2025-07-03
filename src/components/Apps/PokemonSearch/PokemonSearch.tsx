import React, { useState, useEffect } from 'react';
import './PokemonSearch.css';

interface PokemonData {
  id: number;
  name: string;
  sprites: {
    front_default: string;
    other: {
      'official-artwork': {
        front_default: string;
      };
    };
  };
  types: {
    slot: number;
    type: {
      name: string;
      url: string;
    };
  }[];
  height: number;
  weight: number;
  species: {
    name: string;
    url: string;
  };
}

interface PokemonSpecies {
  flavor_text_entries: {
    flavor_text: string;
    language: {
      name: string;
    };
  }[];
}

interface TypeData {
  damage_relations: {
    double_damage_from: {
      name: string;
    }[];
  };
}

const PokemonSearch: React.FC = () => {
  const [pokemonData, setPokemonData] = useState<PokemonData | null>(null);
  const [speciesData, setSpeciesData] = useState<PokemonSpecies | null>(null);
  const [typeData, setTypeData] = useState<TypeData[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('pikachu');
  const [showShiny, setShowShiny] = useState<boolean>(false);
  const [retryCount, setRetryCount] = useState<number>(0);

  const fetchWithRetry = async (url: string, options = {}, retries = 3): Promise<any> => {
    const proxies = [
      '', // Direct connection first
      'https://corsproxy.io/?',
      'https://api.allorigins.win/raw?url=',
      'https://thingproxy.freeboard.io/fetch/',
      'https://cors-anywhere.herokuapp.com/'
    ];

    for (let attempt = 0; attempt < proxies.length; attempt++) {
      try {
        const proxyUrl = proxies[attempt];
        const fullUrl = proxyUrl + encodeURIComponent(url);

        const createTimeoutSignal = (ms: number) => {
          const controller = new AbortController();
          setTimeout(() => controller.abort(), ms);
          return controller.signal;
        };
        
        const response = await fetch(fullUrl, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            ...(proxyUrl.includes('cors-anywhere') && { 'X-Requested-With': 'XMLHttpRequest' })
          },
          signal: createTimeoutSignal(2000) // 8 second timeout
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
      } catch (error) {
        console.warn(`Attempt ${attempt + 1} failed with proxy ${proxies[attempt] || 'none'}`, error);
        if (attempt === proxies.length - 1) {
          if (retries > 0) {
            await new Promise(resolve => setTimeout(resolve, 1000 * (4 - retries)));
            return fetchWithRetry(url, options, retries - 1);
          }
          throw error;
        }
      }
    }
    throw new Error('All proxy attempts failed');
  };

  useEffect(() => {
    const controller = new AbortController();

    const loadPokemonData = async () => {
      if (!searchTerm.trim()) return;

      setLoading(true);
      setError(null);
      setPokemonData(null);
      setSpeciesData(null);
      setTypeData([]);

      try {
        // First try our primary API endpoint
        const pokemon = await fetchWithRetry(
          `https://pokeapi.co/api/v2/pokemon/${searchTerm.toLowerCase()}`
        );
        if (controller.signal.aborted) return;

        // Then fetch additional data
        const [species, types] = await Promise.all([
          fetchWithRetry(pokemon.species.url),
          Promise.all(pokemon.types.map((t: any) => fetchWithRetry(t.type.url)))
        ]);

        if (!controller.signal.aborted) {
          setPokemonData(pokemon);
          setSpeciesData(species);
          setTypeData(types);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to load Pokémon';
          setError(errorMessage);
          console.error('Final fetch error:', err);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    loadPokemonData();
    return () => controller.abort();
  }, [searchTerm, retryCount]);

  const getEnglishDescription = () => {
    if (!speciesData) return 'No description available';
    const entry = speciesData.flavor_text_entries.find(
      entry => entry.language.name === 'en'
    );
    return entry?.flavor_text.replace(/\f/g, ' ') || 'No description available';
  };

  const getWeaknesses = () => {
    if (typeData.length === 0) return [];
    const weaknesses = new Set<string>();
    typeData.forEach(type => {
      type.damage_relations.double_damage_from.forEach(weakness => {
        weaknesses.add(weakness.name);
      });
    });
    return Array.from(weaknesses);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const input = (e.currentTarget as HTMLFormElement).elements.namedItem('pokemonSearch') as HTMLInputElement;
    setSearchTerm(input.value);
  };

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
  };

  const handleLoadExample = () => {
    setSearchTerm('pikachu');
  };

  const getImageUrl = () => {
    if (!pokemonData) return '';
    try {
      const url = showShiny 
        ? pokemonData.sprites.other['official-artwork'].front_default 
        : pokemonData.sprites.front_default;
      return url || 'https://via.placeholder.com/150?text=Image+Missing';
    } catch {
      return 'https://via.placeholder.com/150?text=Image+Error';
    }
  };

  if (loading) {
    return (
      <div className="pokemon-container">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading Pokémon data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pokemon-container">
      <h1 className="pokemon-title">Pokémon Search</h1>
      
      <form onSubmit={handleSearch} className="search-form">
        <input
          type="text"
          name="pokemonSearch"
          placeholder="Enter Pokémon name or ID"
          defaultValue={searchTerm}
          className="search-input"
          aria-label="Search for Pokémon"
          required
          minLength={2}
        />
        <button type="submit" className="search-button">
          Search
        </button>
      </form>

      {error && (
        <div className="error-state">
          <div className="error-icon">⚠️</div>
          <h3>Oops! Something went wrong</h3>
          <p className="error-message">{error}</p>
          
          <div className="error-actions">
            <button onClick={handleRetry} className="retry-button">
              Try Again
            </button>
            <button onClick={handleLoadExample} className="example-button">
              Load Example
            </button>
          </div>
          
          <div className="error-tips">
            <p>If this keeps happening:</p>
            <ul>
              <li>Check your internet connection</li>
              <li>Try a different Pokémon name</li>
              <li>Wait a few minutes and try again</li>
            </ul>
          </div>
        </div>
      )}

      {pokemonData && (
        <div className="pokemon-details">
          <div className="pokemon-header">
            <h2 className="pokemon-name">
              #{pokemonData.id.toString().padStart(3, '0')} - {pokemonData.name.charAt(0).toUpperCase() + pokemonData.name.slice(1)}
            </h2>
          </div>

          <div className="pokemon-image-container">
            <div className="pokemon-image-wrapper">
              <img
                src={getImageUrl()}
                alt={pokemonData.name}
                className="pokemon-image"
                loading="lazy"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = 'https://via.placeholder.com/150?text=Image+Failed';
                  target.className = 'pokemon-image-error';
                }}
              />
            </div>
            <button
              className={`shiny-toggle ${showShiny ? 'active' : ''}`}
              onClick={() => setShowShiny(!showShiny)}
              aria-label={`Show ${showShiny ? 'normal' : 'shiny'} version`}
            >
              {showShiny ? '★ Shiny' : '☆ Shiny'}
            </button>
          </div>

          <div className="pokemon-info-grid">
            <div className="pokemon-info-section types-section">
              <h3>Types</h3>
              <div className="types-container">
                {pokemonData.types.map((type, index) => (
                  <span
                    key={`${type.slot}-${index}`}
                    className={`type-badge type-${type.type.name}`}
                  >
                    {type.type.name}
                  </span>
                ))}
              </div>
            </div>

            <div className="pokemon-info-section weaknesses-section">
              <h3>Weaknesses</h3>
              <div className="weaknesses-container">
                {getWeaknesses().length > 0 ? (
                  getWeaknesses().map((weakness, index) => (
                    <span
                      key={`${weakness}-${index}`}
                      className={`type-badge type-${weakness}`}
                    >
                      {weakness}
                    </span>
                  ))
                ) : (
                  <span className="no-weaknesses">None</span>
                )}
              </div>
            </div>

            <div className="pokemon-info-section stats-section">
              <h3>Stats</h3>
              <div className="stats-grid">
                <div className="stat-item">
                  <span className="stat-label">Height:</span>
                  <span className="stat-value">{(pokemonData.height / 10).toFixed(1)} m</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Weight:</span>
                  <span className="stat-value">{(pokemonData.weight / 10).toFixed(1)} kg</span>
                </div>
              </div>
            </div>

            <div className="pokemon-info-section description-section">
              <h3>Pokédex Entry</h3>
              <p className="pokedex-description">{getEnglishDescription()}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PokemonSearch;