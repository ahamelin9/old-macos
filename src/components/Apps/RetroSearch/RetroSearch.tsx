import React, { useState } from 'react';
import './RetroSearch.css';

interface SearchResult {
  title: string;
  content: string;
  url: string;
}

const RetroSearch: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [correction, setCorrection] = useState<string | null>(null);

  const fetchResults = async (searchQuery: string) => {
    setLoading(true);
    setError(null);
    setResults([]);
    setCorrection(null);

    try {
      const endpoint = `https://corsproxy.io/?https://searx.perennialte.ch/search?q=${encodeURIComponent(
        searchQuery
      )}&format=json`;

      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const data = await response.json();
      setResults(data.results || []);
      setCorrection(data.correction || null);
    } catch (err: any) {
      console.error(err);
      setError('Failed to fetch results. Try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      fetchResults(query.trim());
    }
  };

  return (
    <div className="retro-search-container">
      <h1 className="retro-logo">RetroSearch</h1>
      <form onSubmit={handleSearch} className="retro-search-form">
        <input
          type="text"
          className="retro-search-input"
          placeholder="Search the web..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="retro-search-button" type="submit">
          Search
        </button>
      </form>

      {correction && correction !== query && (
        <div className="did-you-mean">
          Did you mean{' '}
          <button
            className="correction-link"
            onClick={() => {
              setQuery(correction);
              fetchResults(correction);
            }}
          >
            {correction}
          </button>
          ?
        </div>
      )}

      {loading && <p className="retro-loading">Loading results...</p>}
      {error && <p className="retro-error">{error}</p>}

      <ul className="retro-results-list">
        {results.map((result, idx) => (
          <li key={idx} className="retro-result">
            <a
              href={result.url}
              target="_blank"
              rel="noopener noreferrer"
              className="retro-result-title"
            >
              {result.title || result.url}
            </a>
            <p className="retro-result-url">{result.url}</p>
            <p className="retro-result-snippet">{result.content}</p>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default RetroSearch;
