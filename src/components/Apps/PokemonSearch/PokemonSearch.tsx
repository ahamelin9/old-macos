import React, { useState, useEffect } from 'react';
import fuzzysort from 'fuzzysort';
import './PokemonSearch.css';

interface PokemonData {
  id: number;
  name: string;
  sprites: {
    front_default: string;
    front_shiny: string;
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
  const [inputTerm, setInputTerm] = useState<string>('dragonite');
  const [searchTerm, setSearchTerm] = useState<string>('dragonite');
  const [retryCount, setRetryCount] = useState<number>(0);
  const [allPokemonNames, setAllPokemonNames] = useState<string[]>([]);
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const [showShiny, setShowShiny] = useState<boolean>(false);

  const createTimeoutSignal = (ms: number) => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), ms);
    return controller.signal;
  };

  useEffect(() => {
    const loadAllPokemon = async () => {
      try {
        const res = await fetch('https://pokeapi.co/api/v2/pokemon?limit=10000');
        const data = await res.json();
        const names = data.results.map((p: any) => p.name);
        setAllPokemonNames(names);
      } catch (err) {
        console.error('Failed to load Pokémon names', err);
      }
    };
    loadAllPokemon();
  }, []);

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
    if (!searchTerm.trim()) return;
    const controller = new AbortController();

    const loadData = async () => {
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
          setShowShiny(false);
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    setInputTerm(input);

    if (input.trim() === '') {
      setFilteredSuggestions([]);
      return;
    }

    const results = fuzzysort.go(input, allPokemonNames, { limit: 5, threshold: -1000 });
    setFilteredSuggestions(results.map(r => r.target));
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputTerm.trim() !== '') {
      setSearchTerm(inputTerm.trim());
      setFilteredSuggestions([]);
    }
  };

  const handleSuggestionClick = (name: string) => {
    setInputTerm(name);
    setSearchTerm(name);
    setFilteredSuggestions([]);
  };

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
  };

  const getImageUrl = () => {
    if (!pokemonData) return '';
    try {
      return showShiny 
        ? pokemonData.sprites.front_shiny 
        : pokemonData.sprites.front_default;
    } catch {
      return 'https://via.placeholder.com/150?text=Image+Not+Found';
    }
  };

  const fetchPokemonNameById = async (id: number): Promise<string | null> => {
    try {
      const existingPokemon = allPokemonNames.find((_, index) => index + 1 === id);
      if (existingPokemon) return existingPokemon;
  
      const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
      const data = await response.json();
      return data.name;
    } catch (error) {
      console.error(`Failed to fetch Pokémon name for ID ${id}:`, error);
      return null;
    }
  };

  const handlePrevious = () => {
    if (pokemonData && pokemonData.id > 1) {
      fetchPokemonNameById(pokemonData.id - 1).then(name => {
        if (name) {
          setSearchTerm(name);
          setInputTerm(name);
        }
      });
    }
  };
  
  const handleNext = () => {
    if (pokemonData) {
      fetchPokemonNameById(pokemonData.id + 1).then(name => {
        if (name) {
          setSearchTerm(name);
          setInputTerm(name);
        }
      });
    }
  };

  const convertToFeetInches = (heightInDecimeters: number): string => {
    const heightInMeters = heightInDecimeters / 10;
    const heightInInches = heightInMeters * 39.37;
    const feet = Math.floor(heightInInches / 12);
    const inches = Math.round(heightInInches % 12);
    
    return `${feet} ft ${inches} in`;
  };

  const convertToPounds = (weightInHectograms: number): string => {
    const weightInKg = weightInHectograms / 10;
    const weightInLbs = (weightInKg * 2.20462).toFixed(1); // 1 decimal place
    return weightInLbs;
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

      <div className="search-wrapper">
        <form onSubmit={handleSearch} className="search-form">
          <input
            type="text"
            name="pokemonSearch"
            placeholder="Enter Pokémon name or ID"
            value={inputTerm}
            onChange={handleInputChange}
            className="search-input"
            aria-label="Search for Pokémon"
            autoComplete="off"
          />
          <button type="submit" className="search-button">Search</button>
        </form>

        {filteredSuggestions.length > 0 && (
          <ul className="suggestions-list">
            {filteredSuggestions.map(name => (
              <li
                key={name}
                className="suggestion-item"
                onClick={() => handleSuggestionClick(name)}
              >
                {name}
              </li>
            ))}
          </ul>
        )}
      </div>

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
            <button
              className="nav-button"
              onClick={handlePrevious}
              disabled={pokemonData.id === 1}
              aria-label="Previous Pokémon"
              title="Previous Pokémon"
            >
              ←
            </button>

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
              className="nav-button"
              onClick={handleNext}
              aria-label="Next Pokémon"
              title="Next Pokémon"
            >
              →
            </button>
          </div>
          
          <div className="shiny-toggle-wrapper">
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
              <p>Height: {convertToFeetInches(pokemonData.height)}</p>
              <p>Weight: {convertToPounds(pokemonData.weight)} lbs</p>
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
