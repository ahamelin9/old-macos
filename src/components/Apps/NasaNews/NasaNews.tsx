import React, { useState, useEffect } from 'react';
import './NasaNews.css';

interface ApodData {
  date?: string;
  explanation?: string;
  hdurl?: string;
  media_type?: string;
  service_version?: string;
  title?: string;
  url?: string;
  copyright?: string;
}

const NasaNews: React.FC = () => {
  const [apodData, setApodData] = useState<ApodData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showHD, setShowHD] = useState<boolean>(false);

  useEffect(() => {
    const fetchApodData = async () => {
      // Use DEMO_KEY as a fallback if the environment variable is missing
      const rawKey = import.meta.env.VITE_NASA_API_KEY || 'DEMO_KEY';
      try {
        // Build URL carefully, ensuring api_key is handled correctly
        const baseUrl = 'https://api.nasa.gov/planetary/apod';
        
        // Aggressively clean the key - remove anything after and including '&' or '='
        const nasaApiKey = rawKey.split('&')[0].split('=')[0].trim();
        
        const queryParams = new URLSearchParams();
        queryParams.append('api_key', nasaApiKey);
        queryParams.append('thumbs', 'true');

        const response = await fetch(`${baseUrl}?${queryParams.toString()}`);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data: ApodData = await response.json();
        setApodData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchApodData();
  }, []);

  if (loading) {
    return <div className="nasa-container loading">Loading NASA data...</div>;
  }

  if (error) {
    return <div className="nasa-container error">Error: {error}</div>;
  }

  if (!apodData) {
    return <div className="nasa-container">No data available</div>;
  }

  return (
    <div className="nasa-container">
      <h2 className="nasa-title">NASA Astronomy Picture of the Day</h2>
      
      <div className="apod-container">
        <h3 className="apod-title">{apodData.title}</h3>
        <p className="apod-date">{apodData.date}</p>
        
        {apodData.media_type === 'image' ? (
          <div className="apod-image-container">
            <div className="quality-indicator">
              Currently Viewing: <strong>{showHD ? 'HD Quality' : 'Standard Quality'}</strong>
            </div>
            <img 
              src={showHD && apodData.hdurl ? apodData.hdurl : apodData.url} 
              alt={apodData.title} 
              className={`apod-image ${showHD ? 'hd-active' : ''}`}
              onLoad={() => console.log(`Loaded ${showHD ? 'HD' : 'Standard'} image`)}
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = apodData.url || '';
              }}
            />
            <div className="button-row">
              {apodData.hdurl && (
                <button 
                  className="hd-toggle" 
                  onClick={() => setShowHD(!showHD)}
                >
                  {showHD ? '◀ Switch to Standard' : '▶ Switch to HD Quality'}
                </button>
              )}
              {showHD && apodData.hdurl && (
                <a href={apodData.hdurl} target="_blank" rel="noopener noreferrer" className="download-link">
                  Open Original HD File
                </a>
              )}
            </div>
          </div>
        ) : 
 apodData.media_type === 'video' ? (
          <div className="apod-video-container">
            <iframe
              src={apodData.url}
              title={apodData.title}
              className="apod-video"
              allowFullScreen
            />
          </div>
        ) : null}
        
        <p className="apod-explanation">{apodData.explanation}</p>
        
        {apodData.copyright && (
          <p className="apod-copyright">Copyright: {apodData.copyright}</p>
        )}
      </div>
      
      <div className="nasa-links">
        <h4>More NASA Content:</h4>
        <ul>
          <li><a href="https://www.nasa.gov" target="_blank" rel="noopener noreferrer">NASA Official Website</a></li>
          <li><a href="https://apod.nasa.gov/apod/archivepix.html" target="_blank" rel="noopener noreferrer">APOD Archive</a></li>
          <li><a href="https://www.nasa.gov/multimedia/imagegallery/iotd.html" target="_blank" rel="noopener noreferrer">NASA Image of the Day</a></li>
          <li><a href="https://mars.nasa.gov/" target="_blank" rel="noopener noreferrer">Mars Exploration Program</a></li>
        </ul>
      </div>
    </div>
  );
};

export default NasaNews;