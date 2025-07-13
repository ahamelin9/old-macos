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
import { useState } from 'react';
import './RetroSearch.css';
const RetroSearch = () => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [correction, setCorrection] = useState(null);
    const fetchResults = (searchQuery) => __awaiter(void 0, void 0, void 0, function* () {
        setLoading(true);
        setError(null);
        setResults([]);
        setCorrection(null);
        try {
            const endpoint = `https://corsproxy.io/?https://searx.perennialte.ch/search?q=${encodeURIComponent(searchQuery)}&format=json`;
            const response = yield fetch(endpoint);
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            const data = yield response.json();
            setResults(data.results || []);
            setCorrection(data.correction || null);
        }
        catch (err) {
            console.error(err);
            setError('Failed to fetch results. Try again later.');
        }
        finally {
            setLoading(false);
        }
    });
    const handleSearch = (e) => {
        e.preventDefault();
        if (query.trim()) {
            fetchResults(query.trim());
        }
    };
    return (_jsxs("div", { className: "retro-search-container", children: [_jsx("h1", { className: "retro-logo", children: "RetroSearch" }), _jsxs("form", { onSubmit: handleSearch, className: "retro-search-form", children: [_jsx("input", { type: "text", className: "retro-search-input", placeholder: "Search the web...", value: query, onChange: (e) => setQuery(e.target.value) }), _jsx("button", { className: "retro-search-button", type: "submit", children: "Search" })] }), correction && correction !== query && (_jsxs("div", { className: "did-you-mean", children: ["Did you mean", ' ', _jsx("button", { className: "correction-link", onClick: () => {
                            setQuery(correction);
                            fetchResults(correction);
                        }, children: correction }), "?"] })), loading && _jsx("p", { className: "retro-loading", children: "Loading results..." }), error && _jsx("p", { className: "retro-error", children: error }), _jsx("ul", { className: "retro-results-list", children: results.map((result, idx) => (_jsxs("li", { className: "retro-result", children: [_jsx("a", { href: result.url, target: "_blank", rel: "noopener noreferrer", className: "retro-result-title", children: result.title || result.url }), _jsx("p", { className: "retro-result-url", children: result.url }), _jsx("p", { className: "retro-result-snippet", children: result.content })] }, idx))) })] }));
};
export default RetroSearch;
