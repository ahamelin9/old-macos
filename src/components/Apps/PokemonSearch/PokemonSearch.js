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
    const fetchPokemonData = () => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const apiUrl = `${import.meta.env.VITE_POKEAPI_BASE_URL}/pokemon/${encodeURIComponent(searchTerm.toLowerCase())}`;
            const response = yield fetch(apiUrl);
            if (!response.ok)
                throw new Error(`Pokémon not found (HTTP ${response.status})`);
            const data = yield response.json();
            return data;
        }
        catch (error) {
            console.error("Fetch error:", error);
            throw error;
        }
    });
    const fetchSpeciesData = (url) => __awaiter(void 0, void 0, void 0, function* () {
        const response = yield fetch(url);
        return yield response.json();
    });
    const fetchTypeData = (url) => __awaiter(void 0, void 0, void 0, function* () {
        const response = yield fetch(url);
        return yield response.json();
    });
    useEffect(() => {
        if (!searchTerm.trim())
            return;
        const loadData = () => __awaiter(void 0, void 0, void 0, function* () {
            setLoading(true);
            setError(null);
            try {
                const pokemon = yield fetchPokemonData();
                setPokemonData(pokemon);
                const species = yield fetchSpeciesData(pokemon.species.url);
                setSpeciesData(species);
                const types = yield Promise.all(pokemon.types.map((type) => fetchTypeData(type.type.url)));
                setTypeData(types);
            }
            catch (err) {
                setError(err instanceof Error ? err.message : 'An unknown error occurred');
                setPokemonData(null);
            }
            finally {
                setLoading(false);
            }
        });
        loadData();
    }, [searchTerm]);
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
    const getImageUrl = () => {
        if (!pokemonData)
            return '';
        try {
            return showShiny
                ? pokemonData.sprites.other['official-artwork'].front_default
                : pokemonData.sprites.front_default;
        }
        catch (_a) {
            return 'https://via.placeholder.com/150?text=Pokemon+Not+Found';
        }
    };
    if (loading) {
        return _jsx("div", { className: "pokemon-container loading", children: "Loading Pok\u00E9mon data..." });
    }
    return (_jsxs("div", { className: "pokemon-container", children: [_jsx("h2", { className: "pokemon-title", children: "Pok\u00E9mon Search" }), _jsxs("form", { onSubmit: handleSearch, className: "search-form", children: [_jsx("input", { type: "text", name: "pokemonSearch", placeholder: "Enter Pok\u00E9mon name or ID", defaultValue: searchTerm, className: "search-input" }), _jsx("button", { type: "submit", className: "search-button", children: "Search" })] }), error && (_jsxs("div", { className: "pokemon-error", children: ["Error: ", error] })), pokemonData && (_jsxs("div", { className: "pokemon-details", children: [_jsx("div", { className: "pokemon-header", children: _jsxs("h3", { className: "pokemon-name", children: ["#", pokemonData.id, " - ", pokemonData.name.charAt(0).toUpperCase() + pokemonData.name.slice(1)] }) }), _jsxs("div", { className: "pokemon-image-container", children: [_jsx("div", { className: "pokemon-image-wrapper", children: _jsx("img", { src: getImageUrl(), alt: pokemonData.name, className: "pokemon-image", onError: (e) => {
                                        const target = e.target;
                                        target.src = 'https://via.placeholder.com/150?text=Pokemon+Not+Found';
                                    } }) }), _jsx("button", { className: "shiny-toggle", onClick: () => setShowShiny(!showShiny), children: showShiny ? 'Show Normal' : 'Show Shiny' })] }), _jsxs("div", { className: "pokemon-info", children: [_jsxs("div", { className: "info-section", children: [_jsx("h4", { children: "Types" }), _jsx("div", { className: "types-container", children: pokemonData.types.map(type => (_jsx("span", { className: `type-badge type-${type.type.name}`, children: type.type.name }, type.slot))) })] }), _jsxs("div", { className: "info-section", children: [_jsx("h4", { children: "Weaknesses" }), _jsx("div", { className: "weaknesses-container", children: getWeaknesses().length > 0 ? (getWeaknesses().map(weakness => (_jsx("span", { className: `type-badge type-${weakness}`, children: weakness }, weakness)))) : (_jsx("span", { children: "No weaknesses" })) })] }), _jsxs("div", { className: "info-section", children: [_jsx("h4", { children: "Physical Attributes" }), _jsxs("p", { children: ["Height: ", (pokemonData.height / 10).toFixed(1), " m"] }), _jsxs("p", { children: ["Weight: ", (pokemonData.weight / 10).toFixed(1), " kg"] })] }), _jsxs("div", { className: "info-section", children: [_jsx("h4", { children: "Pok\u00E9dex Description" }), _jsx("p", { className: "pokedex-description", children: getEnglishDescription() })] })] })] }))] }));
};
export default PokemonSearch;
