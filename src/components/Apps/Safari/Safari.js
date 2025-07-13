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
import './Safari.css';
const Safari = () => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const handleSearch = (e) => __awaiter(void 0, void 0, void 0, function* () {
        e.preventDefault();
        if (!query.trim())
            return;
        setError(null);
        setResults([]);
        setLoading(true);
        try {
            const res = yield fetch(`https://brave-search-worker.ahamelin9.workers.dev?q=${encodeURIComponent(query)}`);
            if (!res.ok)
                throw new Error('Failed to fetch results');
            const data = yield res.json();
            setResults(data.web.results || []);
        }
        catch (err) {
            setError(err.message || 'Failed to fetch results. Try again later.');
        }
        finally {
            setLoading(false);
        }
    });
    return (_jsxs("div", { className: "safari-container", children: [_jsxs("div", { className: "safari-header", children: [_jsx("div", { className: "safari-logo", children: "Search \uD83D\uDD0E " }), _jsxs("form", { className: "safari-search-box", onSubmit: handleSearch, children: [_jsx("input", { className: "safari-input", type: "text", value: query, onChange: (e) => setQuery(e.target.value), placeholder: "Search the web..." }), _jsx("button", { className: "safari-button", type: "submit", children: "Search" })] })] }), error && _jsx("div", { className: "safari-error", children: error }), loading && _jsx("div", { className: "safari-error", children: "Loading..." }), _jsx("div", { className: "safari-results", children: results.map((result, index) => (_jsxs("div", { className: "safari-result", children: [_jsx("a", { href: result.url, className: "safari-result-title", target: "_blank", rel: "noopener noreferrer", children: result.title }), _jsx("div", { className: "safari-result-url", children: result.url }), _jsx("div", { children: _jsx("p", { className: "safari-result-snippet", dangerouslySetInnerHTML: { __html: result.description } }) })] }, index))) })] }));
};
export default Safari;
