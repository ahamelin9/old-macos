import React, { useState, useEffect } from "react";
import fuzzysort from "fuzzysort";
import "./PokemonSearch.css";

const ALL_TYPES = [
  "normal", "fire", "water", "electric", "grass", "ice",
  "fighting", "poison", "ground", "flying", "psychic", "bug",
  "rock", "ghost", "dragon", "dark", "steel", "fairy"
];

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
  name: string;
  damage_relations: {
    double_damage_from: { name: string }[];
    half_damage_from: { name: string }[];
    no_damage_from: { name: string }[];
    double_damage_to: { name: string }[];
    half_damage_to: { name: string }[];
    no_damage_to: { name: string }[];
  };
}

interface EvolutionDetailParsed {
  conditionText: string;
  itemName?: string | null;
  itemSprite?: string | null;
}

interface EvolutionNode {
  id: number;
  name: string;
  sprite: string;
  evolvesTo: {
    target: EvolutionNode;
    details: EvolutionDetailParsed[];
  }[];
}

const parseEvolutionDetail = (d: any): EvolutionDetailParsed => {
  let conditionText = "";
  let itemSprite: string | null = null;
  let itemName: string | null = null;

  if (d.item) {
    const cleanName = d.item.name.replace(/-/g, " ");
    itemName = cleanName;
    itemSprite = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${d.item.name}.png`;
    conditionText = `Use ${cleanName}`;
  } else if (d.held_item) {
    const cleanName = d.held_item.name.replace(/-/g, " ");
    itemName = cleanName;
    itemSprite = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${d.held_item.name}.png`;
    if (d.trigger?.name === "trade") {
      conditionText = `Trade with ${cleanName}`;
    } else {
      conditionText = `Hold ${cleanName}`;
    }
  } else if (d.min_level) {
    conditionText = `Level ${d.min_level}`;
    if (d.time_of_day) {
      conditionText += ` (${d.time_of_day})`;
    }
    if (d.gender === 1) {
      conditionText += ` (Female)`;
    } else if (d.gender === 2) {
      conditionText += ` (Male)`;
    }
    if (d.needs_overworld_rain) {
      conditionText += ` (Rain)`;
    }
    if (d.turn_upside_down) {
      conditionText += ` (Upside down)`;
    }
    if (d.relative_physical_stats === 1) {
      conditionText += ` (Atk > Def)`;
    } else if (d.relative_physical_stats === -1) {
      conditionText += ` (Def > Atk)`;
    } else if (d.relative_physical_stats === 0) {
      conditionText += ` (Atk = Def)`;
    }
  } else if (d.min_happiness) {
    conditionText = `Friendship`;
    if (d.time_of_day) {
      conditionText += ` (${d.time_of_day})`;
    }
    if (d.known_move) {
      conditionText += ` + ${d.known_move.name.replace(/-/g, " ")}`;
    }
  } else if (d.min_affection) {
    conditionText = `Friendship`;
    if (d.known_move_type) {
      conditionText += ` + ${d.known_move_type.name} move`;
    }
  } else if (d.min_beauty) {
    conditionText = `High Beauty`;
  } else if (d.known_move) {
    conditionText = `Knows ${d.known_move.name.replace(/-/g, " ")}`;
  } else if (d.known_move_type) {
    conditionText = `Knows ${d.known_move_type.name} move`;
  } else if (d.location) {
    conditionText = `Level up near area`;
  } else if (d.trigger?.name === "trade") {
    if (d.trade_species) {
      conditionText = `Trade for ${d.trade_species.name.replace(/-/g, " ")}`;
    } else {
      conditionText = `Trade`;
    }
  } else if (d.trigger?.name === "shed") {
    conditionText = `Level 20 (Open slot)`;
  } else if (d.trigger?.name === "spin") {
    conditionText = `Spin with Sweet`;
  } else if (d.trigger?.name === "three-critical-hits") {
    conditionText = `3 Crits in 1 battle`;
  } else if (d.trigger?.name === "take-damage") {
    conditionText = `Stone arch (49+ dmg)`;
  } else if (d.trigger?.name) {
    conditionText = d.trigger.name.replace(/-/g, " ");
  } else {
    conditionText = "Evolves";
  }

  return {
    conditionText,
    itemName,
    itemSprite
  };
};

// Filter and deduplicate evolution details to keep modern canonical methods clean
const filterEvolutionDetails = (detailsList: any[]): EvolutionDetailParsed[] => {
  if (!detailsList || detailsList.length === 0) {
    return [{ conditionText: "Evolves" }];
  }

  const parsed = detailsList.map(parseEvolutionDetail);

  // If an item evolution exists (e.g. Leaf Stone, Ice Stone), prioritize the item method over obsolete area triggers
  const itemTrigger = parsed.find(p => p.itemName);
  if (itemTrigger) {
    return [itemTrigger];
  }

  const unique: EvolutionDetailParsed[] = [];
  const seen = new Set<string>();

  for (const p of parsed) {
    if (!seen.has(p.conditionText)) {
      seen.add(p.conditionText);
      unique.push(p);
    }
  }

  return unique.slice(0, 1);
};

const PokemonSearch: React.FC = () => {
  const [pokemonData, setPokemonData] = useState<PokemonData | null>(null);
  const [speciesData, setSpeciesData] = useState<PokemonSpecies | null>(null);
  const [typeData, setTypeData] = useState<TypeData[]>([]);
  const [evolutionTree, setEvolutionTree] = useState<EvolutionNode | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [inputTerm, setInputTerm] = useState<string>("dragonite");
  const [searchTerm, setSearchTerm] = useState<string>("dragonite");
  const [retryCount, setRetryCount] = useState<number>(0);
  const [allPokemonNames, setAllPokemonNames] = useState<string[]>([]);
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const [showShiny, setShowShiny] = useState<boolean>(false);
  const [selectedChartType, setSelectedChartType] = useState<string | null>(null);

  const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

  useEffect(() => {
    const loadAllPokemon = async () => {
      try {
        const res = await fetch("https://pokeapi.co/api/v2/pokemon?limit=10000");
        const data = await res.json();
        setAllPokemonNames(data.results.map((p: any) => p.name));
      } catch (err) {
        console.error("Failed to load Pokémon names", err);
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
    throw new Error("If on mobile try turning off wifi or the PokeAPI might be down.");
  };

  const fetchEvolutionTree = async (url: string) => {
    try {
      const res = await fetch(url);
      const data = await res.json();

      const buildTree = async (node: any): Promise<EvolutionNode> => {
        let pokeData: any = null;
        try {
          const pokeRes = await fetch(`https://pokeapi.co/api/v2/pokemon/${node.species.name}`);
          pokeData = await pokeRes.json();
        } catch {
          pokeData = { id: 0, name: node.species.name, sprites: { front_default: "" } };
        }

        const evolvesTo = await Promise.all(
          node.evolves_to.map(async (evo: any) => {
            const target = await buildTree(evo);
            const details = filterEvolutionDetails(evo.evolution_details);
            return { target, details };
          })
        );

        return {
          id: pokeData.id,
          name: pokeData.name,
          sprite: pokeData.sprites?.front_default || "",
          evolvesTo
        };
      };

      const root = await buildTree(data.chain);
      setEvolutionTree(root);
    } catch (err) {
      console.error("Failed to fetch evolution tree", err);
      setEvolutionTree(null);
    }
  };

  useEffect(() => {
    if (!searchTerm) return;

    const loadData = async () => {
      setLoading(true);
      setError(null);
      setPokemonData(null);
      setSpeciesData(null);
      setTypeData([]);
      setEvolutionTree(null);
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
          fetchEvolutionTree(species.evolution_chain.url);
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
    if (!pokemonData) return "";
    return showShiny ? pokemonData.sprites.front_shiny : pokemonData.sprites.front_default;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    setInputTerm(input);
    if (input.trim() === "") {
      setFilteredSuggestions([]);
      return;
    }
    const results = fuzzysort.go(input, allPokemonNames, { limit: 5, threshold: -1000 });
    setFilteredSuggestions(results.map(r => r.target));
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputTerm.trim() !== "") {
      setSearchTerm(inputTerm.trim());
      setFilteredSuggestions([]);
    }
  };

  // Calculate full multipliers for all 18 types
  const getTypeEffectiveness = () => {
    const effectivenessMap: Record<string, { multiplier: number; breakdown: string[] }> = {};

    ALL_TYPES.forEach(atkType => {
      let multiplier = 1.0;
      const breakdown: string[] = [];

      typeData.forEach(defType => {
        const isDouble = defType.damage_relations?.double_damage_from?.some(t => t.name === atkType);
        const isHalf = defType.damage_relations?.half_damage_from?.some(t => t.name === atkType);
        const isZero = defType.damage_relations?.no_damage_from?.some(t => t.name === atkType);

        if (isZero) {
          multiplier *= 0.0;
          breakdown.push(`${capitalize(defType.name)} is immune (0x)`);
        } else if (isDouble) {
          multiplier *= 2.0;
          breakdown.push(`${capitalize(defType.name)} takes 2x`);
        } else if (isHalf) {
          multiplier *= 0.5;
          breakdown.push(`${capitalize(defType.name)} resists (½x)`);
        } else {
          breakdown.push(`${capitalize(defType.name)} is neutral (1x)`);
        }
      });

      effectivenessMap[atkType] = { multiplier, breakdown };
    });

    const quadWeak: string[] = [];
    const doubleWeak: string[] = [];
    const immune: string[] = [];
    const quarterResist: string[] = [];
    const halfResist: string[] = [];
    const normalDamage: string[] = [];

    ALL_TYPES.forEach(t => {
      const mult = effectivenessMap[t].multiplier;
      if (mult >= 4) quadWeak.push(t);
      else if (mult > 1) doubleWeak.push(t);
      else if (mult === 0) immune.push(t);
      else if (mult <= 0.25) quarterResist.push(t);
      else if (mult < 1) halfResist.push(t);
      else normalDamage.push(t);
    });

    return {
      effectivenessMap,
      quadWeak,
      doubleWeak,
      immune,
      quarterResist,
      halfResist,
      normalDamage
    };
  };

  const formatMultiplier = (multiplier: number) => {
    if (multiplier === 0) return "0x";
    if (multiplier === 0.25) return "¼x";
    if (multiplier === 0.5) return "½x";
    if (multiplier === 1) return "1x";
    return `${multiplier}x`;
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

  // Render individual evolution node button
  const renderEvolutionNodeButton = (node: EvolutionNode) => {
    const isCurrent = pokemonData && (pokemonData.id === node.id || pokemonData.name.toLowerCase() === node.name.toLowerCase());

    return (
      <button
        key={node.id}
        type="button"
        className={`evolution-stage ${isCurrent ? "current-evolution-stage" : ""}`}
        onClick={() => {
          setSearchTerm(node.name);
          setInputTerm(node.name);
        }}
        title={`Go to ${capitalize(node.name)}`}
      >
        <img src={node.sprite} alt={node.name} />
        <span className="stage-name">{capitalize(node.name)}</span>
        {isCurrent && <span className="current-stage-tag">Current</span>}
      </button>
    );
  };

  // Render recursive evolution tree with branching grid support
  const renderEvolutionTree = (node: EvolutionNode): React.ReactNode => {
    if (!node.evolvesTo || node.evolvesTo.length === 0) {
      return (
        <div key={node.id} className="evo-single-node">
          {renderEvolutionNodeButton(node)}
        </div>
      );
    }

    // Multi-branching grid (e.g. Eevee with 8, Applin with 3, Tyrogue with 3, Wurmple with 2)
    if (node.evolvesTo.length > 1) {
      return (
        <div key={node.id} className="evo-branching-wrapper">
          <div className="evo-root-holder">
            {renderEvolutionNodeButton(node)}
          </div>
          <div className="evo-branches-grid">
            {node.evolvesTo.map((edge, idx) => (
              <div key={edge.target.id || idx} className="evo-branch-card">
                <div className="evo-card-top-pokemon">
                  {renderEvolutionNodeButton(edge.target)}
                </div>
                <div className="evo-card-bottom-trigger">
                  {edge.details.map((detail, dIdx) => (
                    <div key={dIdx} className="evo-trigger-pill">
                      {detail.itemSprite && (
                        <img
                          src={detail.itemSprite}
                          alt={detail.itemName || "Item"}
                          className="evo-item-icon"
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = "none";
                          }}
                        />
                      )}
                      <span className="evo-condition-text">{detail.conditionText}</span>
                    </div>
                  ))}
                </div>
                {/* Support subsequent evolutions from this branch (e.g. Dipplin -> Hydrapple) */}
                {edge.target.evolvesTo && edge.target.evolvesTo.length > 0 && (
                  <div className="evo-subsequent-chain">
                    {edge.target.evolvesTo.map((subEdge, sIdx) => (
                      <div key={subEdge.target.id || sIdx} className="evo-subsequent-row">
                        <div className="evo-linear-connector mini-connector">
                          {subEdge.details.map((sd, sdIdx) => (
                            <div key={sdIdx} className="evo-trigger-pill">
                              {sd.itemSprite && (
                                <img
                                  src={sd.itemSprite}
                                  alt=""
                                  className="evo-item-icon"
                                  onError={(e) => {
                                    (e.currentTarget as HTMLElement).style.display = "none";
                                  }}
                                />
                              )}
                              <span className="evo-condition-text">{sd.conditionText}</span>
                            </div>
                          ))}
                          <span className="evo-arrow-icon">➔</span>
                        </div>
                        {renderEvolutionTree(subEdge.target)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      );
    }

    // Linear Layout (e.g. Dratini -> Dragonair -> Dragonite)
    const edge = node.evolvesTo[0];
    return (
      <div key={node.id} className="evo-linear-chain">
        <div className="evo-parent-node">
          {renderEvolutionNodeButton(node)}
        </div>

        <div className="evo-linear-connector">
          {edge.details.map((detail, dIdx) => (
            <div key={dIdx} className="evo-trigger-pill">
              {detail.itemSprite && (
                <img
                  src={detail.itemSprite}
                  alt={detail.itemName || "Item"}
                  className="evo-item-icon"
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = "none";
                  }}
                />
              )}
              <span className="evo-condition-text">{detail.conditionText}</span>
            </div>
          ))}
          <span className="evo-arrow-icon">➔</span>
        </div>

        <div className="evo-child-container">
          {renderEvolutionTree(edge.target)}
        </div>
      </div>
    );
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
              <li
                key={name}
                onClick={() => {
                  setInputTerm(name);
                  setSearchTerm(name);
                  setFilteredSuggestions([]);
                }}
                className="suggestion-item"
              >
                {name}
              </li>
            ))}
          </ul>
        )}
      </div>
      {loading && <div className="loading">Loading...</div>}
      {error && <div className="error-state">{error}</div>}
      {pokemonData && (
        <div className="pokemon-details">
          <h3 className="pokemon-name">#{pokemonData.id} - {capitalize(pokemonData.name)}</h3>
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
            <button onClick={() => setShowShiny(!showShiny)} className={`shiny-toggle ${showShiny ? "active" : ""}`}>
              {showShiny ? "★ Shiny" : "☆ Shiny"}
            </button>
          </div>

          {/* Evolution Chain Section */}
          {evolutionTree && (
            <div className="evolution-chain">
              <div className="evolution-chain-header">
                <h4>Evolution Chain & Methods</h4>
                <span className="evolution-hint">Click any Pokémon in chain to navigate</span>
              </div>
              <div className="evolution-tree-viewport">
                {renderEvolutionTree(evolutionTree)}
              </div>
            </div>
          )}

          {/* Quick Info Bar */}
          <div className="quick-info-bar">
            <div className="quick-info-item">
              <span className="quick-info-label">Types:</span>
              <div className="types-container">
                {pokemonData.types.map(t => (
                  <span key={t.type.name} className={`type-badge type-${t.type.name}`}>
                    {t.type.name}
                  </span>
                ))}
              </div>
            </div>
            <div className="quick-info-divider" />
            <div className="quick-info-item">
              <span className="quick-info-label">Height:</span>
              <span className="quick-info-val">{convertToFeetInches(pokemonData.height)}</span>
            </div>
            <div className="quick-info-divider" />
            <div className="quick-info-item">
              <span className="quick-info-label">Weight:</span>
              <span className="quick-info-val">{convertToPounds(pokemonData.weight)} lbs</span>
            </div>
          </div>

          {/* Pokédex Description */}
          <div className="pokedex-entry-card">
            <h4>Pokédex Entry</h4>
            <p className="pokedex-description">
              {speciesData?.flavor_text_entries.find(e => e.language.name === "en")?.flavor_text.replace(/\s+/g, " ") || "No description available"}
            </p>
          </div>

          {/* Matchups & Type Chart Section */}
          {(() => {
            const {
              effectivenessMap,
              quadWeak,
              doubleWeak,
              immune,
              quarterResist,
              halfResist
            } = getTypeEffectiveness();

            const hasWeaknesses = quadWeak.length > 0 || doubleWeak.length > 0;
            const hasResistances = immune.length > 0 || quarterResist.length > 0 || halfResist.length > 0;

            // Default inspected type to first weakness if none selected
            const activeType = selectedChartType || (quadWeak[0] || doubleWeak[0] || immune[0] || halfResist[0] || "ice");
            const inspectedType = effectivenessMap[activeType]
              ? {
                  type: activeType,
                  ...effectivenessMap[activeType]
                }
              : null;

            return (
              <div className="matchup-system-container">
                {/* 2-Column Matchup Panels */}
                <div className="matchups-grid">
                  {/* Left Column: Weak Against */}
                  <div className="matchup-panel weak-panel">
                    <div className="panel-header">
                      <span className="panel-icon">💀</span>
                      <h4>Weak Against (Takes Extra Damage)</h4>
                    </div>
                    <div className="panel-body">
                      {hasWeaknesses ? (
                        <div className="matchup-group-list">
                          {quadWeak.length > 0 && (
                            <div className="matchup-subgroup">
                              <span className="subgroup-label critical-label">4x Critical Weakness:</span>
                              <div className="type-badge-container">
                                {quadWeak.map(type => (
                                  <button
                                    key={type}
                                    type="button"
                                    onClick={() => setSelectedChartType(type)}
                                    className={`type-badge interactive-badge type-${type} ${activeType === type ? "active-badge" : ""}`}
                                    title={`Click to inspect ${capitalize(type)} effectiveness`}
                                  >
                                    {type} <span className="multiplier-tag tag-4x">4x</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                          {doubleWeak.length > 0 && (
                            <div className="matchup-subgroup">
                              <span className="subgroup-label">2x Weakness:</span>
                              <div className="type-badge-container">
                                {doubleWeak.map(type => (
                                  <button
                                    key={type}
                                    type="button"
                                    onClick={() => setSelectedChartType(type)}
                                    className={`type-badge interactive-badge type-${type} ${activeType === type ? "active-badge" : ""}`}
                                    title={`Click to inspect ${capitalize(type)} effectiveness`}
                                  >
                                    {type} <span className="multiplier-tag tag-2x">2x</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="no-data-msg">None (No type weaknesses)</div>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Resistant & Immune */}
                  <div className="matchup-panel resist-panel">
                    <div className="panel-header">
                      <span className="panel-icon">🛡️</span>
                      <h4>Resistant & Immune (Takes Reduced Damage)</h4>
                    </div>
                    <div className="panel-body">
                      {hasResistances ? (
                        <div className="matchup-group-list">
                          {immune.length > 0 && (
                            <div className="matchup-subgroup">
                              <span className="subgroup-label immune-label">0x Immune (No Damage):</span>
                              <div className="type-badge-container">
                                {immune.map(type => (
                                  <button
                                    key={type}
                                    type="button"
                                    onClick={() => setSelectedChartType(type)}
                                    className={`type-badge interactive-badge type-${type} ${activeType === type ? "active-badge" : ""}`}
                                    title={`Click to inspect ${capitalize(type)} effectiveness`}
                                  >
                                    {type} <span className="multiplier-tag tag-0x">0x</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                          {quarterResist.length > 0 && (
                            <div className="matchup-subgroup">
                              <span className="subgroup-label super-resist-label">¼x Super Resistant:</span>
                              <div className="type-badge-container">
                                {quarterResist.map(type => (
                                  <button
                                    key={type}
                                    type="button"
                                    onClick={() => setSelectedChartType(type)}
                                    className={`type-badge interactive-badge type-${type} ${activeType === type ? "active-badge" : ""}`}
                                    title={`Click to inspect ${capitalize(type)} effectiveness`}
                                  >
                                    {type} <span className="multiplier-tag tag-quarter">¼x</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                          {halfResist.length > 0 && (
                            <div className="matchup-subgroup">
                              <span className="subgroup-label">½x Resistant:</span>
                              <div className="type-badge-container">
                                {halfResist.map(type => (
                                  <button
                                    key={type}
                                    type="button"
                                    onClick={() => setSelectedChartType(type)}
                                    className={`type-badge interactive-badge type-${type} ${activeType === type ? "active-badge" : ""}`}
                                    title={`Click to inspect ${capitalize(type)} effectiveness`}
                                  >
                                    {type} <span className="multiplier-tag tag-half">½x</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="no-data-msg">None (Takes normal damage from all types)</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Underneath: Interactive Type Effectiveness Matrix Bar */}
                <div className="type-chart-card">
                  <div className="chart-header">
                    <div className="chart-header-left">
                      <h4>📊 Complete Type Effectiveness Chart</h4>
                      <span className="chart-hint">Click any type below to inspect how incoming damage is calculated</span>
                    </div>
                  </div>

                  <div className="type-matrix-ribbon">
                    {ALL_TYPES.map(type => {
                      const data = effectivenessMap[type];
                      const mult = data ? data.multiplier : 1;
                      let multClass = "mult-1x";
                      let multDisplay = "1x";
                      if (mult >= 4) { multClass = "mult-4x"; multDisplay = "4x"; }
                      else if (mult > 1) { multClass = "mult-2x"; multDisplay = "2x"; }
                      else if (mult === 0) { multClass = "mult-0x"; multDisplay = "0x"; }
                      else if (mult <= 0.25) { multClass = "mult-quarter"; multDisplay = "¼x"; }
                      else if (mult < 1) { multClass = "mult-half"; multDisplay = "½x"; }

                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setSelectedChartType(type)}
                          className={`matrix-col-btn ${activeType === type ? "active-col" : ""}`}
                          title={`${capitalize(type)}: deals ${multDisplay} damage`}
                        >
                          <div className={`matrix-type-header type-${type}`}>
                            {type.slice(0, 3).toUpperCase()}
                          </div>
                          <div className={`matrix-mult-pill ${multClass}`}>
                            {mult === 1 ? "-" : multDisplay}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Inspector Detail Display */}
                  {inspectedType && (
                    <div className="chart-inspector-box">
                      <div className="inspector-title-row">
                        <span className={`type-badge type-${inspectedType.type}`}>{inspectedType.type}</span>
                        <span className="inspector-heading">
                          attacks deal <strong>{formatMultiplier(inspectedType.multiplier)}</strong> damage to {capitalize(pokemonData.name)}
                        </span>
                      </div>
                      <div className="inspector-breakdown">
                        Breakdown: {inspectedType.breakdown.join(" × ")} = <strong>{formatMultiplier(inspectedType.multiplier)}</strong>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};

export default PokemonSearch;
