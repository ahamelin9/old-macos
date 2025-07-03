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

  const createTimeoutSignal = (ms: number) => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), ms);
    return controller.signal;
  };

  const fetchPokemon = async (pokemonName: string) => {
    const endpoints = [
      `https://pokeapi.co/api/v2/pokemon/${pokemonName}`,
      `https://pokedex-api.vercel.app/api/v2/pokemon/${pokemonName}`,
      `https://pokeapi.fly.dev/pokeapi/v2/pokemon/${pokemonName}`
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          signal: createTimeoutSignal(8000),
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        });
        
        if (response.ok) {
          return await response.json();
        }
      } catch (error) {
        console.warn(`Failed with endpoint ${endpoint}:`, error);
        continue;
      }
    }
    throw new Error('All API endpoints failed');
  };

  useEffect(() => {
    const controller = new AbortController();

    const loadData = async () => {
      if (!searchTerm.trim()) return;

      setLoading(true);
      setError(null);
      setPokemonData(null);
      setSpeciesData(null);
      setTypeData([]);

      try {
        const pokemon = await fetchPokemon(searchTerm.toLowerCase());
        if (controller.signal.aborted) return;

        const [species, types] = await Promise.all([
          fetch(pokemon.species.url).then(res => res.json()),
          Promise.all(pokemon.types.map((t: any) => fetch(t.type.url).then(res => res.json())))
        ]);

        if (!controller.signal.aborted) {
          setPokemonData(pokemon);
          setSpeciesData(species);
          setTypeData(types);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : 'Failed to load Pokémon');
          console.error('API Error:', err);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    loadData();
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

  const getImageUrl = () => {
    if (!pokemonData) return '';
    try {
      return showShiny 
        ? pokemonData.sprites.other['official-artwork'].front_default 
        : pokemonData.sprites.front_default;
    } catch {
      return 'https://via.placeholder.com/150?text=Image+Not+Found';
    }
  };

  if (loading) {
    return (
      <div className="pokemon-container loading">
        <div className="loading-spinner"></div>
        <p>Loading Pokémon data...</p>
      </div>
    );
  }

  return (
    <div className="pokemon-container">
      <h2 className="pokemon-title">Pokémon Search</h2>
      
      <form onSubmit={handleSearch} className="search-form">
        <input
          type="text"
          name="pokemonSearch"
          placeholder="Enter Pokémon name or ID"
          defaultValue={searchTerm}
          className="search-input"
          aria-label="Search for Pokémon"
        />
        <button type="submit" className="search-button">Search</button>
      </form>

      {error && (
        <div className="error-state">
          <p>Error: {error}</p>
          <button onClick={handleRetry} className="retry-button">
            Retry
          </button>
          <p className="error-tip">
            If this persists, try a different Pokémon or check your connection
          </p>
        </div>
      )}

      {pokemonData && (
        <div className="pokemon-details">
          <div className="pokemon-header">
            <h3 className="pokemon-name">
              #{pokemonData.id} - {pokemonData.name.charAt(0).toUpperCase() + pokemonData.name.slice(1)}
            </h3>
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
                }}
              />
            </div>
            <button
              className={`shiny-toggle ${showShiny ? 'active' : ''}`}
              onClick={() => setShowShiny(!showShiny)}
            >
              {showShiny ? '★ Shiny' : '☆ Shiny'}
            </button>
          </div>

          <div className="pokemon-info">
            <div className="info-section">
              <h4>Types</h4>
              <div className="types-container">
                {pokemonData.types.map(type => (
                  <span
                    key={type.slot}
                    className={`type-badge type-${type.type.name}`}
                  >
                    {type.type.name}
                  </span>
                ))}
              </div>
            </div>

            <div className="info-section">
              <h4>Weaknesses</h4>
              <div className="weaknesses-container">
                {getWeaknesses().length > 0 ? (
                  getWeaknesses().map(weakness => (
                    <span
                      key={weakness}
                      className={`type-badge type-${weakness}`}
                    >
                      {weakness}
                    </span>
                  ))
                ) : (
                  <span>No weaknesses</span>
                )}
              </div>
            </div>

            <div className="info-section">
              <h4>Stats</h4>
              <p>Height: {(pokemonData.height / 10).toFixed(1)} m</p>
              <p>Weight: {(pokemonData.weight / 10).toFixed(1)} kg</p>
            </div>

            <div className="info-section">
              <h4>Pokédex Entry</h4>
              <p className="pokedex-description">{getEnglishDescription()}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PokemonSearch;