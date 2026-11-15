import React, { useState } from 'react';
import './Safari.css';

/** One web result from the Brave Search worker (only the fields shown here) */
interface SearchResult {
  title: string;
  url: string;
  description?: string;
}

/** A link only if it really is a web page (never javascript: or data:) */
const webUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : undefined;
  } catch {
    return undefined;
  }
};

/**
 * Brave marks the matched words in a description with <strong>. Show that as
 * bold and everything else as plain text, rather than putting outside HTML
 * into the page.
 */
const Snippet = ({ html }: { html: string }) => {
  const nodes = [...new DOMParser().parseFromString(html, 'text/html').body.childNodes];
  return (
    <>
      {nodes.map((node, i) =>
        node.nodeName === 'STRONG' || node.nodeName === 'B'
          ? <strong key={i}>{node.textContent}</strong>
          : node.textContent
      )}
    </>
  );
};

const Safari: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setError(null);
    setResults([]);
    setSearched(false);
    setLoading(true);

    try {
      const res = await fetch(`https://brave-search-worker.ahamelin9.workers.dev?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error('Failed to fetch results');
      const data = (await res.json()) as { web?: { results?: SearchResult[] } };
      // Brave leaves out `web` entirely when nothing matches
      setResults(data.web?.results ?? []);
      setSearched(true);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Failed to fetch results. Try again later.');
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

      {searched && !loading && !error && results.length === 0 && (
        <div className="safari-error">No results found.</div>
      )}

      <div className="safari-results">
        {results.map((result, index) => (
          <div key={index} className="safari-result">
            <a
              href={webUrl(result.url)}
              className="safari-result-title"
              target="_blank"
              rel="noopener noreferrer"
            >
              {result.title}
            </a>
            <div className="safari-result-url">{result.url}</div>
            <div>
              <p className="safari-result-snippet"><Snippet html={result.description ?? ''} /></p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Safari;
