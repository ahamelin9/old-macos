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
import './PokemonSearch.css';
const PokemonSearch = () => {
    const [pokemonData, setPokemonData] = useState(null);
    const [speciesData, setSpeciesData] = useState(null);
    const [typeData, setTypeData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('pikachu');
    const [showShiny, setShowShiny] = useState(false);
    const [retryCount, setRetryCount] = useState(0);
    const createTimeoutSignal = (ms) => {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), ms);
        return controller.signal;
    };
    const fetchPokemon = (pokemonName) => __awaiter(void 0, void 0, void 0, function* () {
        const endpoints = [
            `https://pokeapi.co/api/v2/pokemon/${pokemonName}`,
            `https://pokedex-api.vercel.app/api/v2/pokemon/${pokemonName}`,
            `https://pokeapi.fly.dev/pokeapi/v2/pokemon/${pokemonName}`
        ];
        for (const endpoint of endpoints) {
            try {
                const response = yield fetch(endpoint, {
                    signal: createTimeoutSignal(8000),
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    }
                });
                if (response.ok) {
                    return yield response.json();
                }
            }
            catch (error) {
                console.warn(`Failed with endpoint ${endpoint}:`, error);
                continue;
            }
        }
        throw new Error('All API endpoints failed');
    });
    useEffect(() => {
        const controller = new AbortController();
        const loadData = () => __awaiter(void 0, void 0, void 0, function* () {
            if (!searchTerm.trim())
                return;
            setLoading(true);
            setError(null);
            setPokemonData(null);
            setSpeciesData(null);
            setTypeData([]);
            try {
                const pokemon = yield fetchPokemon(searchTerm.toLowerCase());
                if (controller.signal.aborted)
                    return;
                const [species, types] = yield Promise.all([
                    fetch(pokemon.species.url).then(res => res.json()),
                    Promise.all(pokemon.types.map((t) => fetch(t.type.url).then(res => res.json())))
                ]);
                if (!controller.signal.aborted) {
                    setPokemonData(pokemon);
                    setSpeciesData(species);
                    setTypeData(types);
                }
            }
            catch (err) {
                if (!controller.signal.aborted) {
                    setError(err instanceof Error ? err.message : 'Failed to load Pokémon');
                    console.error('API Error:', err);
                }
            }
            finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        });
        loadData();
        return () => controller.abort();
    }, [searchTerm, retryCount]);
    const getEnglishDescription = () => {
        if (!speciesData)
            return 'No description available';
        const entry = speciesData.flavor_text_entries.find(entry => entry.language.name === 'en');
        return (entry === null || entry === void 0 ? void 0 : entry.flavor_text.replace(/\f/g, ' ')) || 'No description available';
    };
    const getWeaknesses = () => {
        if (typeData.length === 0)
            return [];
        const weaknesses = new Set();
        typeData.forEach(type => {
            type.damage_relations.double_damage_from.forEach(weakness => {
                weaknesses.add(weakness.name);
            });
        });
        return Array.from(weaknesses);
    };
    const handleSearch = (e) => {
        e.preventDefault();
        const input = e.currentTarget.elements.namedItem('pokemonSearch');
        setSearchTerm(input.value);
    };
    const handleRetry = () => {
        setRetryCount(prev => prev + 1);
    };
    const getImageUrl = () => {
        if (!pokemonData)
            return '';
        try {
            return showShiny
                ? pokemonData.sprites.front_shiny
                : pokemonData.sprites.front_default;
        }
        catch (_a) {
            return 'https://via.placeholder.com/150?text=Image+Not+Found';
        }
    };
    if (loading) {
        return (_jsxs("div", { className: "pokemon-container loading", children: [_jsx("div", { className: "loading-spinner" }), _jsx("p", { children: "Loading Pok\u00E9mon data..." })] }));
    }
    return (_jsxs("div", { className: "pokemon-container", children: [_jsx("h2", { className: "pokemon-title", children: "Pok\u00E9mon Search" }), _jsxs("form", { onSubmit: handleSearch, className: "search-form", children: [_jsx("input", { type: "text", name: "pokemonSearch", placeholder: "Enter Pok\u00E9mon name or ID", defaultValue: searchTerm, className: "search-input", "aria-label": "Search for Pok\u00E9mon" }), _jsx("button", { type: "submit", className: "search-button", children: "Search" })] }), error && (_jsxs("div", { className: "error-state", children: [_jsxs("p", { children: ["Error: ", error] }), _jsx("button", { onClick: handleRetry, className: "retry-button", children: "Retry" }), _jsx("p", { className: "error-tip", children: "If this persists, try a different Pok\u00E9mon or check your connection" })] })), pokemonData && (_jsxs("div", { className: "pokemon-details", children: [_jsx("div", { className: "pokemon-header", children: _jsxs("h3", { className: "pokemon-name", children: ["#", pokemonData.id, " - ", pokemonData.name.charAt(0).toUpperCase() + pokemonData.name.slice(1)] }) }), _jsxs("div", { className: "pokemon-image-container", children: [_jsx("div", { className: "pokemon-image-wrapper", children: _jsx("img", { src: getImageUrl(), alt: pokemonData.name, className: "pokemon-image", loading: "lazy", onError: (e) => {
                                        const target = e.target;
                                        target.src = 'https://via.placeholder.com/150?text=Image+Failed';
                                    } }) }), _jsx("button", { className: `shiny-toggle ${showShiny ? 'active' : ''}`, onClick: () => setShowShiny(!showShiny), children: showShiny ? '★ Shiny' : '☆ Shiny' })] }), _jsxs("div", { className: "pokemon-info", children: [_jsxs("div", { className: "info-section", children: [_jsx("h4", { children: "Types" }), _jsx("div", { className: "types-container", children: pokemonData.types.map(type => (_jsx("span", { className: `type-badge type-${type.type.name}`, children: type.type.name }, type.slot))) })] }), _jsxs("div", { className: "info-section", children: [_jsx("h4", { children: "Weaknesses" }), _jsx("div", { className: "weaknesses-container", children: getWeaknesses().length > 0 ? (getWeaknesses().map(weakness => (_jsx("span", { className: `type-badge type-${weakness}`, children: weakness }, weakness)))) : (_jsx("span", { children: "No weaknesses" })) })] }), _jsxs("div", { className: "info-section", children: [_jsx("h4", { children: "Stats" }), _jsxs("p", { children: ["Height: ", (pokemonData.height / 10).toFixed(1), " m"] }), _jsxs("p", { children: ["Weight: ", (pokemonData.weight / 10).toFixed(1), " kg"] })] }), _jsxs("div", { className: "info-section", children: [_jsx("h4", { children: "Pok\u00E9dex Entry" }), _jsx("p", { className: "pokedex-description", children: getEnglishDescription() })] })] })] }))] }));
};
export default PokemonSearch;
