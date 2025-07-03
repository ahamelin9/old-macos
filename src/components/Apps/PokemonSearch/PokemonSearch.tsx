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

  useEffect(() => {
    if (searchTerm.trim() === '') return;

    const fetchPokemonData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Fetch basic Pokémon data
        const pokemonResponse = await fetch(`${import.meta.env.VITE_POKEAPI_BASE_URL}/pokemon/${searchTerm.toLowerCase()}`);
        
        if (!pokemonResponse.ok) {
          throw new Error(`Pokémon not found!`);
        }
        
        const pokemon: PokemonData = await pokemonResponse.json();
        setPokemonData(pokemon);

        // Fetch species data for description
        const speciesResponse = await fetch(pokemon.species.url);
        const species: PokemonSpecies = await speciesResponse.json();
        setSpeciesData(species);

        // Fetch type data for weaknesses
        const typeRequests = pokemon.types.map(type => 
          fetch(type.type.url).then(res => res.json())
        );
        const typeResults = await Promise.all(typeRequests);
        setTypeData(typeResults);

      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
        setPokemonData(null);
        setSpeciesData(null);
        setTypeData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPokemonData();
  }, [searchTerm]);

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

  if (loading) {
    return <div className="pokemon-container loading">Loading Pokémon data...</div>;
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
        />
        <button type="submit" className="search-button">Search</button>
      </form>

      {error && (
        <div className="pokemon-error">Error: {error}</div>
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
                src={showShiny 
                  ? pokemonData.sprites.other['official-artwork'].front_default 
                  : pokemonData.sprites.front_default}
                alt={pokemonData.name}
                className="pokemon-image"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = 'https://via.placeholder.com/150?text=Pokemon+Not+Found';
                }}
              />
            </div>
            <button 
              className="shiny-toggle" 
              onClick={() => setShowShiny(!showShiny)}
            >
              {showShiny ? 'Show Normal' : 'Show Shiny'}
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
              <h4>Physical Attributes</h4>
              <p>Height: {(pokemonData.height / 10).toFixed(1)} m</p>
              <p>Weight: {(pokemonData.weight / 10).toFixed(1)} kg</p>
            </div>

            <div className="info-section">
              <h4>Pokédex Description</h4>
              <p className="pokedex-description">{getEnglishDescription()}</p>
            </div>
          </div>
        </div>
      )}

      <div className="pokemon-links">
        <h4>More Pokémon Resources:</h4>
        <ul>
          <li><a href="https://www.pokemon.com" target="_blank" rel="noopener noreferrer">Official Pokémon Website</a></li>
          <li><a href="https://www.serebii.net/" target="_blank" rel="noopener noreferrer">Serebii</a></li>
          <li><a href="https://pokeapi.co" target="_blank" rel="noopener noreferrer">PokéAPI Documentation</a></li>
        </ul>
      </div>
    </div>
  );
};

export default PokemonSearch;