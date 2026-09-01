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

  const imageUrl = apodData.hdurl || apodData.url;
  const isDirectVideo = Boolean(
    apodData.url &&
    (
      apodData.url.endsWith('.mp4') ||
      apodData.url.endsWith('.webm') ||
      apodData.url.endsWith('.ogg') ||
      apodData.url.endsWith('.mov') ||
      apodData.url.endsWith('.m4v') ||
      apodData.url.includes('.mp4?')
    )
  );

  return (
    <div className="nasa-container">
      <h2 className="nasa-title">NASA Astronomy Picture of the Day</h2>
      
      <div className="apod-container">
        <h3 className="apod-title">{apodData.title}</h3>
        <p className="apod-date">{apodData.date}</p>
        
        {apodData.media_type === 'image' ? (
          <div className="apod-image-container">
            <img 
              src={imageUrl} 
              alt={apodData.title} 
              className="apod-image"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                if (apodData.url && target.src !== apodData.url) {
                  target.src = apodData.url;
                }
              }}
            />
            {apodData.hdurl && (
              <div className="button-row">
                <a href={apodData.hdurl} target="_blank" rel="noopener noreferrer" className="download-link">
                  Open Full Resolution Original ↗
                </a>
              </div>
            )}
          </div>
        ) : apodData.media_type === 'video' ? (
          <div className="apod-video-container">
            {isDirectVideo ? (
              <video
                src={apodData.url}
                controls
                playsInline
                className="apod-video"
              >
                Your browser does not support the video tag.
              </video>
            ) : (
              <iframe
                src={apodData.url}
                title={apodData.title}
                className="apod-video"
                allowFullScreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              />
            )}
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