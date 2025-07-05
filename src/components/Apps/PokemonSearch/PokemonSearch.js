var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import fuzzysort from 'fuzzysort';
import './PokemonSearch.css';
const PokemonSearch = () => {
    var _a;
    const [pokemonData, setPokemonData] = useState(null);
    const [speciesData, setSpeciesData] = useState(null);
    const [typeData, setTypeData] = useState([]);
    const [evolutionChain, setEvolutionChain] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [inputTerm, setInputTerm] = useState('dragonite');
    const [searchTerm, setSearchTerm] = useState('dragonite');
    const [retryCount, setRetryCount] = useState(0);
    const [allPokemonNames, setAllPokemonNames] = useState([]);
    const [filteredSuggestions, setFilteredSuggestions] = useState([]);
    const [showShiny, setShowShiny] = useState(false);
    const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);
    useEffect(() => {
        const loadAllPokemon = () => __awaiter(void 0, void 0, void 0, function* () {
            try {
                const res = yield fetch('https://pokeapi.co/api/v2/pokemon?limit=10000');
                const data = yield res.json();
                setAllPokemonNames(data.results.map((p) => p.name));
            }
            catch (err) {
                console.error('Failed to load Pokémon names', err);
            }
        });
        loadAllPokemon();
    }, []);
    const fetchPokemon = (pokemonName) => __awaiter(void 0, void 0, void 0, function* () {
        const endpoints = [
            `https://pokeapi.co/api/v2/pokemon/${pokemonName}`,
            `https://pokedex-api.vercel.app/api/v2/pokemon/${pokemonName}`,
            `https://pokeapi.fly.dev/pokeapi/v2/pokemon/${pokemonName}`
        ];
        for (const endpoint of endpoints) {
            try {
                const response = yield fetch(endpoint);
                if (response.ok) {
                    return yield response.json();
                }
            }
            catch (_a) {
                continue;
            }
        }
        throw new Error('If on mobile try turning off wifi or the PokeAPI might be down.');
    });
    const fetchEvolutionChain = (url) => __awaiter(void 0, void 0, void 0, function* () {
        const res = yield fetch(url);
        const data = yield res.json();
        const stages = [];
        let node = data.chain;
        while (node) {
            const pokeRes = yield fetch(`https://pokeapi.co/api/v2/pokemon/${node.species.name}`);
            const pokeData = yield pokeRes.json();
            stages.push({
                id: pokeData.id,
                name: pokeData.name,
                sprite: pokeData.sprites.front_default,
            });
            node = node.evolves_to[0];
        }
        setEvolutionChain(stages);
    });
    useEffect(() => {
        if (!searchTerm)
            return;
        const loadData = () => __awaiter(void 0, void 0, void 0, function* () {
            var _a;
            setLoading(true);
            setError(null);
            setPokemonData(null);
            setSpeciesData(null);
            setTypeData([]);
            setEvolutionChain([]);
            try {
                const pokemon = yield fetchPokemon(searchTerm.toLowerCase());
                setPokemonData(pokemon);
                const speciesRes = yield fetch(pokemon.species.url);
                const species = yield speciesRes.json();
                setSpeciesData(species);
                const types = yield Promise.all(pokemon.types.map((t) => fetch(t.type.url).then(res => res.json())));
                setTypeData(types);
                if ((_a = species.evolution_chain) === null || _a === void 0 ? void 0 : _a.url) {
                    fetchEvolutionChain(species.evolution_chain.url);
                }
                setShowShiny(false);
            }
            catch (err) {
                setError(err.message);
            }
            finally {
                setLoading(false);
            }
        });
        loadData();
    }, [searchTerm, retryCount]);
    const getImageUrl = () => {
        if (!pokemonData)
            return '';
        return showShiny ? pokemonData.sprites.front_shiny : pokemonData.sprites.front_default;
    };
    const handleInputChange = (e) => {
        const input = e.target.value;
        setInputTerm(input);
        if (input.trim() === '') {
            setFilteredSuggestions([]);
            return;
        }
        const results = fuzzysort.go(input, allPokemonNames, { limit: 5, threshold: -1000 });
        setFilteredSuggestions(results.map(r => r.target));
    };
    const handleSearch = (e) => {
        e.preventDefault();
        if (inputTerm.trim() !== '') {
            setSearchTerm(inputTerm.trim());
            setFilteredSuggestions([]);
        }
    };
    const getWeaknesses = () => {
        const weaknesses = new Set();
        typeData.forEach(type => type.damage_relations.double_damage_from.forEach(w => weaknesses.add(w.name)));
        return Array.from(weaknesses);
    };
    const fetchPokemonNameById = (id) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const existingPokemon = allPokemonNames.find((_, index) => index + 1 === id);
            if (existingPokemon)
                return existingPokemon;
            const response = yield fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
            const data = yield response.json();
            return data.name;
        }
        catch (error) {
            console.error(`Failed to fetch Pokémon name for ID ${id}:, error`);
            return null;
        }
    });
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
    const convertToFeetInches = (heightInDecimeters) => {
        const inches = (heightInDecimeters / 10) * 39.37;
        const feet = Math.floor(inches / 12);
        const remInches = Math.round(inches % 12);
        return `${feet} ft ${remInches} in`;
    };
    const convertToPounds = (weightInHectograms) => {
        const lbs = (weightInHectograms / 10) * 2.20462;
        return lbs.toFixed(1);
    };
    return (_jsxs("div", { className: "pokemon-container", children: [_jsx("h2", { className: "pokemon-title", children: "Pok\u00E9mon Search" }), _jsxs("div", { className: "search-wrapper", children: [_jsxs("form", { onSubmit: handleSearch, className: "search-form", children: [_jsx("input", { type: "text", value: inputTerm, onChange: handleInputChange, placeholder: "Enter Pok\u00E9mon name or ID", className: "search-input" }), _jsx("button", { type: "submit", className: "search-button", children: "Search" })] }), filteredSuggestions.length > 0 && (_jsx("ul", { className: "suggestions-list", children: filteredSuggestions.map(name => (_jsx("li", { onClick: () => {
                                setInputTerm(name);
                                setSearchTerm(name);
                                setFilteredSuggestions([]);
                            }, className: "suggestion-item", children: name }, name))) }))] }), loading && _jsx("div", { className: "loading", children: "Loading..." }), error && _jsx("div", { className: "error-state", children: error }), pokemonData && (_jsxs("div", { className: "pokemon-details", children: [_jsxs("h3", { className: 'pokemon-name', children: ["#", pokemonData.id, " - ", capitalize(pokemonData.name)] }), _jsxs("div", { className: "pokemon-image-container", children: [_jsx("button", { className: "nav-button", onClick: handlePrevious, disabled: pokemonData.id === 1, "aria-label": "Previous Pok\u00E9mon", title: "Previous Pok\u00E9mon", children: "\u2190" }), _jsx("div", { className: "pokemon-image-wrapper", children: _jsx("img", { src: getImageUrl(), alt: pokemonData.name, className: "pokemon-image" }) }), _jsx("button", { className: "nav-button", onClick: handleNext, "aria-label": "Next Pok\u00E9mon", title: "Next Pok\u00E9mon", children: "\u2192" })] }), _jsx("div", { className: "shiny-toggle-wrapper", children: _jsx("button", { onClick: () => setShowShiny(!showShiny), className: `shiny-toggle ${showShiny ? 'active' : ''}`, children: showShiny ? '★ Shiny' : '☆ Shiny' }) }), evolutionChain.length > 0 && (_jsxs("div", { className: "evolution-chain", children: [_jsx("h4", { children: "Evolution Chain" }), _jsx("div", { className: "evolution-stages", children: evolutionChain.map(stage => (_jsxs("div", { className: "evolution-stage", children: [_jsx("img", { src: stage.sprite, alt: stage.name }), _jsx("span", { children: capitalize(stage.name) })] }, stage.id))) })] })), _jsxs("div", { className: "pokemon-info", children: [_jsxs("div", { className: "info-section", children: [_jsx("h4", { children: "Types" }), _jsx("div", { className: "types-container", children: pokemonData.types.map(t => (_jsx("span", { className: `type-badge type-${t.type.name}`, children: t.type.name }, t.type.name))) })] }), _jsxs("div", { className: "info-section", children: [_jsx("h4", { children: "Weaknesses" }), _jsx("div", { className: "weaknesses-container", children: getWeaknesses().map(w => (_jsx("span", { className: `type-badge type-${w}`, children: w }, w))) })] }), _jsxs("div", { className: "info-section", children: [_jsx("h4", { children: "Stats" }), _jsxs("p", { children: ["Height: ", convertToFeetInches(pokemonData.height)] }), _jsxs("p", { children: ["Weight: ", convertToPounds(pokemonData.weight), " lbs"] })] }), _jsxs("div", { className: "info-section", children: [_jsx("h4", { children: "Pok\u00E9dex Entry" }), _jsx("p", { className: "pokedex-description", children: ((_a = speciesData === null || speciesData === void 0 ? void 0 : speciesData.flavor_text_entries.find(e => e.language.name === 'en')) === null || _a === void 0 ? void 0 : _a.flavor_text.replace(/\f/g, ' ')) || 'No description available' })] })] })] }))] }));
};
export default PokemonSearch;
