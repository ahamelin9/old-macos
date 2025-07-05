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
  evolution_chain: {
    url: string;
  };
  generation: {
    name: string;
  };
}

interface TypeData {
  damage_relations: {
    double_damage_from: {
      name: string;
    }[];
  };
}

interface EvolutionStage {
  id: number;
  name: string;
  sprite: string;
}

const PokemonSearch: React.FC = () => {
  const [pokemonData, setPokemonData] = useState<PokemonData | null>(null);
  const [speciesData, setSpeciesData] = useState<PokemonSpecies | null>(null);
  const [typeData, setTypeData] = useState<TypeData[]>([]);
  const [evolutionChain, setEvolutionChain] = useState<EvolutionStage[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [inputTerm, setInputTerm] = useState<string>('dragonite');
  const [searchTerm, setSearchTerm] = useState<string>('dragonite');
  const [retryCount, setRetryCount] = useState<number>(0);
  const [allPokemonNames, setAllPokemonNames] = useState<string[]>([]);
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const [showShiny, setShowShiny] = useState<boolean>(false);
  const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);


  useEffect(() => {
    const loadAllPokemon = async () => {
      try {
        const res = await fetch('https://pokeapi.co/api/v2/pokemon?limit=10000');
        const data = await res.json();
        setAllPokemonNames(data.results.map((p: any) => p.name));
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
        const response = await fetch(endpoint);
        if (response.ok) {
          return await response.json();
        }
      } catch {
        continue;
      }
    }
    throw new Error('If on mobile try turning off wifi or the PokeAPI might be down.');
  };

  const fetchEvolutionChain = async (url: string) => {
    const res = await fetch(url);
    const data = await res.json();
    const stages: EvolutionStage[] = [];
    let node = data.chain;
    while (node) {
      const pokeRes = await fetch(`https://pokeapi.co/api/v2/pokemon/${node.species.name}`);
      const pokeData = await pokeRes.json();
      stages.push({
        id: pokeData.id,
        name: pokeData.name,
        sprite: pokeData.sprites.front_default,
      });
      node = node.evolves_to[0];
    }
    setEvolutionChain(stages);
  };

  useEffect(() => {
    if (!searchTerm) return;

    const loadData = async () => {
      setLoading(true);
      setError(null);
      setPokemonData(null);
      setSpeciesData(null);
      setTypeData([]);
      setEvolutionChain([]);
      try {
        const pokemon = await fetchPokemon(searchTerm.toLowerCase());
        setPokemonData(pokemon);

        const speciesRes = await fetch(pokemon.species.url);
        const species = await speciesRes.json();
        setSpeciesData(species);

        const types = await Promise.all(
          pokemon.types.map((t: any) =>
            fetch(t.type.url).then(res => res.json())
          )
        );
        setTypeData(types);

        if (species.evolution_chain?.url) {
          fetchEvolutionChain(species.evolution_chain.url);
        }

        setShowShiny(false);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [searchTerm, retryCount]);

  const getImageUrl = () => {
    if (!pokemonData) return '';
    return showShiny ? pokemonData.sprites.front_shiny : pokemonData.sprites.front_default;
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

  const getWeaknesses = () => {
    const weaknesses = new Set<string>();
    typeData.forEach(type =>
      type.damage_relations.double_damage_from.forEach(w => weaknesses.add(w.name))
    );
    return Array.from(weaknesses);
  };

  const fetchPokemonNameById = async (id: number): Promise<string | null> => {
    try {
      const existingPokemon = allPokemonNames.find((_, index) => index + 1 === id);
      if (existingPokemon) return existingPokemon;
  
      const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
      const data = await response.json();
      return data.name;
    } catch (error) {
      console.error(`Failed to fetch Pokémon name for ID ${id}:, error`);
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

  const convertToFeetInches = (heightInDecimeters: number) => {
    const inches = (heightInDecimeters / 10) * 39.37;
    const feet = Math.floor(inches / 12);
    const remInches = Math.round(inches % 12);
    return `${feet} ft ${remInches} in`;
  };

  const convertToPounds = (weightInHectograms: number) => {
    const lbs = (weightInHectograms / 10) * 2.20462;
    return lbs.toFixed(1);
  };

  return (
    <div className="pokemon-container">
      <h2 className="pokemon-title">Pokémon Search</h2>
      <div className="search-wrapper">
        <form onSubmit={handleSearch} className="search-form">
          <input
            type="text"
            value={inputTerm}
            onChange={handleInputChange}
            placeholder="Enter Pokémon name or ID"
            className="search-input"
          />
          <button type="submit" className="search-button">Search</button>
        </form>
        {filteredSuggestions.length > 0 && (
          <ul className="suggestions-list">
            {filteredSuggestions.map(name => (
              <li key={name} onClick={() => {
                setInputTerm(name);
                setSearchTerm(name);
                setFilteredSuggestions([]);
              }} className="suggestion-item">{name}</li>
            ))}
          </ul>
        )}
      </div>
      {loading && <div className="loading">Loading...</div>}
      {error && <div className="error-state">{error}</div>}
      {pokemonData && (
        <div className="pokemon-details">
          <h3 className='pokemon-name'>#{pokemonData.id} - {capitalize(pokemonData.name)}</h3>
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
              <img src={getImageUrl()} alt={pokemonData.name} className="pokemon-image" />
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
            <button onClick={() => setShowShiny(!showShiny)} className={`shiny-toggle ${showShiny ? 'active' : ''}`}>
              {showShiny ? '★ Shiny' : '☆ Shiny'}
            </button>
          </div>
          {evolutionChain.length > 0 && (
            <div className="evolution-chain">
              <h4>Evolution Chain</h4>
              <div className="evolution-stages">
                {evolutionChain.map(stage => (
                  <div key={stage.id} className="evolution-stage">
                    <img src={stage.sprite} alt={stage.name} />
                    <span>{capitalize(stage.name)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="pokemon-info">
            <div className="info-section">
              <h4>Types</h4>
              <div className="types-container">
                {pokemonData.types.map(t => (
                  <span key={t.type.name} className={`type-badge type-${t.type.name}`}>{t.type.name}</span>
                ))}
              </div>
            </div>
            <div className="info-section">
              <h4>Weaknesses</h4>
              <div className="weaknesses-container">
                {getWeaknesses().map(w => (
                  <span key={w} className={`type-badge type-${w}`}>{w}</span>
                ))}
              </div>
            </div>
            <div className="info-section">
              <h4>Stats</h4>
              <p>Height: {convertToFeetInches(pokemonData.height)}</p>
              <p>Weight: {convertToPounds(pokemonData.weight)} lbs</p>
            </div>
            <div className="info-section">
              <h4>Pokédex Entry</h4>
              <p className="pokedex-description">
                {speciesData?.flavor_text_entries.find(e => e.language.name === 'en')?.flavor_text.replace(/\f/g, ' ') || 'No description available'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PokemonSearch;
