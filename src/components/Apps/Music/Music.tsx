import React, { useState, useRef, useEffect } from 'react';
import './Music.css';

// Mock music library
const trackList = [
  {
    id: 1,
    name: "I love you forever",
    artist: "Logic",
    audioUrl: "/Music/i-love-you-forever.mp3",
    duration: "4:16"
  },
];

const Music = () => {
  const [tracks] = useState(trackList);
  const [currentTrack, setCurrentTrack] = useState(tracks[0]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [currentTime, setCurrentTime] = useState("0:00");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Handle play/pause
  const togglePlay = () => {
    if (isPlaying) {
      audioRef.current?.pause();
    } else {
      audioRef.current?.play();
    }
    setIsPlaying(!isPlaying);
  };

  // Change track
  const playTrack = (track: typeof trackList[0]) => {
    setCurrentTrack(track);
    setIsPlaying(true);
    setTimeout(() => audioRef.current?.play(), 0);
  };

  // Skip to next/previous track
  const skipTrack = (direction: 'next' | 'prev') => {
    const currentIndex = tracks.findIndex(t => t.id === currentTrack.id);
    let newIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
    
    if (newIndex < 0) newIndex = tracks.length - 1;
    if (newIndex >= tracks.length) newIndex = 0;
    
    playTrack(tracks[newIndex]);
  };

  // Update progress bar and time display
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateProgress = () => {
      setProgress((audio.currentTime / audio.duration) * 100);
      setCurrentTime(formatTime(audio.currentTime));
    };

    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('ended', () => {
      setIsPlaying(false);
      skipTrack('next');
    });

    return () => {
      audio.removeEventListener('timeupdate', updateProgress);
      audio.removeEventListener('ended', () => setIsPlaying(false));
    };
  }, [currentTrack]);

  // Format seconds to MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Handle volume change
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  return (
    <div className="retro-itunes">
      <div className="title-bar">
        <h1>iTunes</h1>
      </div>
      
      <div className="player-window">
        <div className="track-list">
          {tracks.map((track) => (
            <div
              key={track.id}
              className={`track ${currentTrack.id === track.id ? 'active' : ''}`}
              onClick={() => playTrack(track)}
            >
              <span className="track-name">{track.name}</span>
              <span className="track-artist">{track.artist}</span>
              <span className="track-duration">{track.duration}</span>
            </div>
          ))}
        </div>

        <div className="player-controls">
          <div className="now-playing">
            <div className="now-playing-title">
              {currentTrack.name} - {currentTrack.artist}
            </div>
            <div className="time-display">
              {currentTime} / {currentTrack.duration}
            </div>
          </div>

          <div className="progress-container">
            <input
              type="range"
              min="0"
              max="100"
              value={progress}
              onChange={(e) => {
                if (audioRef.current) {
                  const newTime = (Number(e.target.value) / 100) * audioRef.current.duration;
                  audioRef.current.currentTime = newTime;
                }
              }}
              className="progress-bar"
            />
          </div>

          <div className="control-buttons">
            <button onClick={() => skipTrack('prev')} className="control-button">⏮</button>
            <button onClick={togglePlay} className="control-button play-pause">
              {isPlaying ? '⏸' : '▶'}
            </button>
            <button onClick={() => skipTrack('next')} className="control-button">⏭</button>
          </div>

          <div className="volume-control">
            <span className="volume-icon">🔊</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="volume-slider"
            />
          </div>
        </div>

        {/* Hidden audio element */}
        <audio
          ref={audioRef}
          src={currentTrack.audioUrl}
          preload="auto"
        />
      </div>
    </div>
  );
};

export default Music;