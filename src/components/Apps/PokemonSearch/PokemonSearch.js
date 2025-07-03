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
    const fetchWithRetry = (url_1, ...args_1) => __awaiter(void 0, [url_1, ...args_1], void 0, function* (url, options = {}, retries = 3) {
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
                const createTimeoutSignal = (ms) => {
                    const controller = new AbortController();
                    setTimeout(() => controller.abort(), ms);
                    return controller.signal;
                };
                const response = yield fetch(fullUrl, Object.assign(Object.assign({}, options), { headers: Object.assign({ 'Content-Type': 'application/json' }, (proxyUrl.includes('cors-anywhere') && { 'X-Requested-With': 'XMLHttpRequest' })), signal: createTimeoutSignal(2000) // 8 second timeout
                 }));
                if (!response.ok)
                    throw new Error(`HTTP ${response.status}`);
                return yield response.json();
            }
            catch (error) {
                console.warn(`Attempt ${attempt + 1} failed with proxy ${proxies[attempt] || 'none'}`, error);
                if (attempt === proxies.length - 1) {
                    if (retries > 0) {
                        yield new Promise(resolve => setTimeout(resolve, 1000 * (4 - retries)));
                        return fetchWithRetry(url, options, retries - 1);
                    }
                    throw error;
                }
            }
        }
        throw new Error('All proxy attempts failed');
    });
    useEffect(() => {
        const controller = new AbortController();
        const loadPokemonData = () => __awaiter(void 0, void 0, void 0, function* () {
            if (!searchTerm.trim())
                return;
            setLoading(true);
            setError(null);
            setPokemonData(null);
            setSpeciesData(null);
            setTypeData([]);
            try {
                // First try our primary API endpoint
                const pokemon = yield fetchWithRetry(`https://pokeapi.co/api/v2/pokemon/${searchTerm.toLowerCase()}`);
                if (controller.signal.aborted)
                    return;
                // Then fetch additional data
                const [species, types] = yield Promise.all([
                    fetchWithRetry(pokemon.species.url),
                    Promise.all(pokemon.types.map((t) => fetchWithRetry(t.type.url)))
                ]);
                if (!controller.signal.aborted) {
                    setPokemonData(pokemon);
                    setSpeciesData(species);
                    setTypeData(types);
                }
            }
            catch (err) {
                if (!controller.signal.aborted) {
                    const errorMessage = err instanceof Error ? err.message : 'Failed to load Pokémon';
                    setError(errorMessage);
                    console.error('Final fetch error:', err);
                }
            }
            finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        });
        loadPokemonData();
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
    const handleLoadExample = () => {
        setSearchTerm('pikachu');
    };
    const getImageUrl = () => {
        if (!pokemonData)
            return '';
        try {
            const url = showShiny
                ? pokemonData.sprites.other['official-artwork'].front_default
                : pokemonData.sprites.front_default;
            return url || 'https://via.placeholder.com/150?text=Image+Missing';
        }
        catch (_a) {
            return 'https://via.placeholder.com/150?text=Image+Error';
        }
    };
    if (loading) {
        return (_jsx("div", { className: "pokemon-container", children: _jsxs("div", { className: "loading-state", children: [_jsx("div", { className: "loading-spinner" }), _jsx("p", { children: "Loading Pok\u00E9mon data..." })] }) }));
    }
    return (_jsxs("div", { className: "pokemon-container", children: [_jsx("h1", { className: "pokemon-title", children: "Pok\u00E9mon Search" }), _jsxs("form", { onSubmit: handleSearch, className: "search-form", children: [_jsx("input", { type: "text", name: "pokemonSearch", placeholder: "Enter Pok\u00E9mon name or ID", defaultValue: searchTerm, className: "search-input", "aria-label": "Search for Pok\u00E9mon", required: true, minLength: 2 }), _jsx("button", { type: "submit", className: "search-button", children: "Search" })] }), error && (_jsxs("div", { className: "error-state", children: [_jsx("div", { className: "error-icon", children: "\u26A0\uFE0F" }), _jsx("h3", { children: "Oops! Something went wrong" }), _jsx("p", { className: "error-message", children: error }), _jsxs("div", { className: "error-actions", children: [_jsx("button", { onClick: handleRetry, className: "retry-button", children: "Try Again" }), _jsx("button", { onClick: handleLoadExample, className: "example-button", children: "Load Example" })] }), _jsxs("div", { className: "error-tips", children: [_jsx("p", { children: "If this keeps happening:" }), _jsxs("ul", { children: [_jsx("li", { children: "Check your internet connection" }), _jsx("li", { children: "Try a different Pok\u00E9mon name" }), _jsx("li", { children: "Wait a few minutes and try again" })] })] })] })), pokemonData && (_jsxs("div", { className: "pokemon-details", children: [_jsx("div", { className: "pokemon-header", children: _jsxs("h2", { className: "pokemon-name", children: ["#", pokemonData.id.toString().padStart(3, '0'), " - ", pokemonData.name.charAt(0).toUpperCase() + pokemonData.name.slice(1)] }) }), _jsxs("div", { className: "pokemon-image-container", children: [_jsx("div", { className: "pokemon-image-wrapper", children: _jsx("img", { src: getImageUrl(), alt: pokemonData.name, className: "pokemon-image", loading: "lazy", onError: (e) => {
                                        const target = e.target;
                                        target.src = 'https://via.placeholder.com/150?text=Image+Failed';
                                        target.className = 'pokemon-image-error';
                                    } }) }), _jsx("button", { className: `shiny-toggle ${showShiny ? 'active' : ''}`, onClick: () => setShowShiny(!showShiny), "aria-label": `Show ${showShiny ? 'normal' : 'shiny'} version`, children: showShiny ? '★ Shiny' : '☆ Shiny' })] }), _jsxs("div", { className: "pokemon-info-grid", children: [_jsxs("div", { className: "pokemon-info-section types-section", children: [_jsx("h3", { children: "Types" }), _jsx("div", { className: "types-container", children: pokemonData.types.map((type, index) => (_jsx("span", { className: `type-badge type-${type.type.name}`, children: type.type.name }, `${type.slot}-${index}`))) })] }), _jsxs("div", { className: "pokemon-info-section weaknesses-section", children: [_jsx("h3", { children: "Weaknesses" }), _jsx("div", { className: "weaknesses-container", children: getWeaknesses().length > 0 ? (getWeaknesses().map((weakness, index) => (_jsx("span", { className: `type-badge type-${weakness}`, children: weakness }, `${weakness}-${index}`)))) : (_jsx("span", { className: "no-weaknesses", children: "None" })) })] }), _jsxs("div", { className: "pokemon-info-section stats-section", children: [_jsx("h3", { children: "Stats" }), _jsxs("div", { className: "stats-grid", children: [_jsxs("div", { className: "stat-item", children: [_jsx("span", { className: "stat-label", children: "Height:" }), _jsxs("span", { className: "stat-value", children: [(pokemonData.height / 10).toFixed(1), " m"] })] }), _jsxs("div", { className: "stat-item", children: [_jsx("span", { className: "stat-label", children: "Weight:" }), _jsxs("span", { className: "stat-value", children: [(pokemonData.weight / 10).toFixed(1), " kg"] })] })] })] }), _jsxs("div", { className: "pokemon-info-section description-section", children: [_jsx("h3", { children: "Pok\u00E9dex Entry" }), _jsx("p", { className: "pokedex-description", children: getEnglishDescription() })] })] })] }))] }));
};
export default PokemonSearch;
