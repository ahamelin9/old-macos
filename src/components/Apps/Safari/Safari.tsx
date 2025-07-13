import React, { useState } from 'react';
import './Safari.css';

const Safari: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setError(null);
    setResults([]);
    setLoading(true);

    try {
      const res = await fetch(`https://brave-search-worker.ahamelin9.workers.dev?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error('Failed to fetch results');
      const data = await res.json();
      setResults(data.web.results || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch results. Try again later.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="safari-container">
      <div className="safari-header">
        <div className="safari-logo">Search 🔎 </div>
        <form className="safari-search-box" onSubmit={handleSearch}>
          <input
            className="safari-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the web..."
          />
          <button className="safari-button" type="submit">Search</button>
        </form>
      </div>

      {error && <div className="safari-error">{error}</div>}

      {loading && <div className="safari-error">Loading...</div>}

      <div className="safari-results">
        {results.map((result, index) => (
          <div key={index} className="safari-result">
            <a
              href={result.url}
              className="safari-result-title"
              target="_blank"
              rel="noopener noreferrer"
            >
              {result.title}
            </a>
            <div className="safari-result-url">{result.url}</div>
            <div>
              <p className="safari-result-snippet" dangerouslySetInnerHTML={{ __html: result.description }}></p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Safari;
