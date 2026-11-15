import React, { useState, useEffect } from 'react';
import './NasaNews.css';
import { fetchApod, type ApodData } from './apod';

const NasaNews: React.FC = () => {
  const [apodData, setApodData] = useState<ApodData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchApod()
      .then(data => {
        if (!cancelled) setApodData(data);
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Something went wrong.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <div className="nasa-container loading">Loading NASA data...</div>;
  }

  if (error) {
    return <div className="nasa-container error">{error}</div>;
  }

  if (!apodData) {
    return <div className="nasa-container">No data available</div>;
  }

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
              src={apodData.url}
              alt={apodData.alt || apodData.title}
              className="apod-image"
              onError={(e) => {
                // The web-size copy is missing now and then; try the full size
                const target = e.target as HTMLImageElement;
                if (apodData.hdurl && target.src !== apodData.hdurl) {
                  target.src = apodData.hdurl;
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
        
        {apodData.credit && <p className="apod-copyright">{apodData.credit}</p>}
      </div>
      
      <div className="nasa-links">
        <h4>More NASA Content:</h4>
        <ul>
          {apodData.link && (
            <li><a href={apodData.link} target="_blank" rel="noopener noreferrer">This picture on NASA Science</a></li>
          )}
          <li><a href="https://www.nasa.gov" target="_blank" rel="noopener noreferrer">NASA Official Website</a></li>
          <li><a href="https://science.nasa.gov/apod/archive/" target="_blank" rel="noopener noreferrer">APOD Archive</a></li>
          <li><a href="https://www.nasa.gov/image-of-the-day/" target="_blank" rel="noopener noreferrer">NASA Image of the Day</a></li>
          <li><a href="https://science.nasa.gov/mars/" target="_blank" rel="noopener noreferrer">Mars Exploration Program</a></li>
        </ul>
      </div>
    </div>
  );
};

export default NasaNews;