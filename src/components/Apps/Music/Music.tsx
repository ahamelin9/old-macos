import React, { useState, useRef, useEffect } from 'react';
import SpotifyWebApi from 'spotify-web-api-js';
import { useSpotify } from '../../../contexts/SpotifyContext';
import './Music.css';

const spotifyApi = new SpotifyWebApi();

const ensureCleanId = (id: string) => id.split('?')[0].split('/').pop() || id;

const PLAYLISTS = [
  { name: "Jackie & Alex <3", id: "6UjgBHoOhSatQxMRDg30HI" },
  { name: "Tism", id: "0IVqQXdYjCuSIcRvBTdgjt" }, 
  { name: "Indy Eras 24' Tour", id: "2zZaspkKHdD8GVPuigHJPw" },
  { name: "Indy Eras 24' Tour", id: "2zZaspkKHdD8GVPuigHJPw" },
  { name: "Morgan Wallen 25' Tour", id: "46UZ7PIUiNkzqEjIdia9rv" }
];

interface Track {
  id: string;
  name: string;
  artist: string;
  album: string;
  duration_ms: number;
  uri: string;
  preview_url: string | null;
  image: string;
}

// Define Spotify SDK Types with specific types instead of 'any'
interface SpotifyPlayer {
  addListener: (event: string, callback: (data: { 
    message?: string; 
    device_id?: string; 
    paused?: boolean;
    position?: number;
    duration?: number;
    track_window?: SpotifyPlayerState['track_window'];
  }) => void) => void;
  connect: () => Promise<boolean>;
  disconnect: () => void;
  togglePlay: () => Promise<void>;
  nextTrack: () => Promise<void>;
  previousTrack: () => Promise<void>;
  setVolume: (volume: number) => Promise<void>;
  seek: (position_ms: number) => Promise<void>;
  getCurrentState: () => Promise<SpotifyPlayerState | null>;
}

interface SpotifyPlayerState {
  paused: boolean;
  position: number;
  duration: number;
  track_window: {
    current_track: {
      id: string;
      name: string;
      uri: string;
      album: {
        name: string;
        images: { url: string }[];
      };
      artists: { name: string }[];
    };
  };
}

const Music = () => {
  const { accessToken, isPremium, authError, login } = useSpotify();
  
  const [showSidebar, setShowSidebar] = useState(true);
  const [activePlaylistId, setActivePlaylistId] = useState(PLAYLISTS[0].id);

  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [currentTime, setCurrentTime] = useState("0:00");
  const [player, setPlayer] = useState<SpotifyPlayer | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sdkError, setSdkError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const formatTime = (seconds: number) => {
    if (!isFinite(seconds) || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const playTrack = async (track: Track) => {
    if (isPremium && !deviceId) {
      alert("Spotify player is connecting, please wait a moment...");
      return;
    }

    setCurrentTrack(track);
    if (isPremium && deviceId && accessToken) {
      try {
        const cleanId = ensureCleanId(activePlaylistId);
        const response = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
          method: 'PUT',
          body: JSON.stringify({ 
            context_uri: `spotify:playlist:${cleanId}`,
            offset: { uri: track.uri }
          }),
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` }
        });
        
        if (!response.ok) {
          if (response.status === 404) setSdkError("Device lost. Try refreshing.");
        } else {
          setIsPlaying(true);
        }
      } catch (e) {
        console.error('Failed to send play command:', e);
      }
    } else {
      setIsPlaying(!!track.preview_url);
      setTimeout(() => {
        if (audioRef.current && track.preview_url) {
          audioRef.current.play().catch(e => console.error("Playback failed:", e));
        }
      }, 0);
    }
  };

  const skipTrack = React.useCallback((direction: 'next' | 'prev') => {
    if (tracks.length === 0) return;
    const currentIndex = tracks.findIndex(t => t.id === currentTrack?.id);
    let newIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
    if (newIndex < 0) newIndex = tracks.length - 1;
    if (newIndex >= tracks.length) newIndex = 0;
    playTrack(tracks[newIndex]);
  }, [tracks, currentTrack, activePlaylistId, accessToken, deviceId, isPremium]);

  // Fetch tracks
  useEffect(() => {
    const fetchTracks = async () => {
      setLoadError(null);
      let token = accessToken;
      
      if (!token) {
        try {
          const response = await fetch('/api/client_credentials');
          const data = await response.json();
          token = (data as { access_token: string }).access_token;
        } catch (error: unknown) {
          console.error('Guest fetch error:', error);
          setLoadError('Failed to connect to backend.');
          return;
        }
      }

      if (token) {
        spotifyApi.setAccessToken(token);
        try {
          const cleanId = ensureCleanId(activePlaylistId);
          const data = await spotifyApi.getPlaylistTracks(cleanId);
          
          if (data && data.items && Array.isArray(data.items)) {
            const formattedTracks = data.items
              .filter((item: SpotifyApi.PlaylistTrackObject) => item && item.track && item.track.type === 'track')
              .map((item: SpotifyApi.PlaylistTrackObject) => {
                const t = item.track as SpotifyApi.TrackObjectFull;
                return {
                  id: t.id,
                  name: t.name,
                  artist: t.artists.map((a: SpotifyApi.ArtistObjectSimplified) => a.name).join(', '),
                  album: t.album.name,
                  duration_ms: t.duration_ms,
                  uri: t.uri,
                  preview_url: t.preview_url,
                  image: t.album.images[0]?.url || ''
                };
              });
            
            setTracks(formattedTracks);
          }
        } catch (error: unknown) {
          console.error('Playlist fetch error:', error);
          setLoadError('Failed to load playlist.');
        }
      }
    };

    fetchTracks();
  }, [accessToken, activePlaylistId]);

  // SDK Setup
  useEffect(() => {
    if (!isPremium || !accessToken) return;

    if (!document.getElementById('spotify-sdk')) {
      const script = document.createElement("script");
      script.id = 'spotify-sdk';
      script.src = "https://sdk.scdn.co/spotify-player.js";
      script.async = true;
      document.body.appendChild(script);
    }

    window.onSpotifyWebPlaybackSDKReady = () => {
      const newPlayer = new window.Spotify.Player({
        name: 'Classic Mac OS Player',
        getOAuthToken: (cb: (token: string) => void) => { cb(accessToken); },
        volume: volume
      }) as SpotifyPlayer;

      setPlayer(newPlayer);

      newPlayer.addListener('initialization_error', ({ message }) => setSdkError(`Init Error: ${message}`));
      newPlayer.addListener('authentication_error', () => setSdkError('Auth Error. Try re-logging.'));
      newPlayer.addListener('account_error', () => setSdkError('Premium required.'));
      newPlayer.addListener('playback_error', ({ message }) => console.warn('Playback Warning:', message));

      newPlayer.addListener('ready', ({ device_id }) => {
        if (device_id) {
          setDeviceId(device_id);
          setIsReady(true);
          setSdkError(null);
        }
      });

      newPlayer.addListener('not_ready', () => {
        setDeviceId(null);
        setIsReady(false);
      });

      newPlayer.addListener('player_state_changed', (state) => {
        const playerState = state as SpotifyPlayerState | null;
        if (!playerState) return;
        
        setIsPlaying(!playerState.paused);
        const track = playerState.track_window.current_track;
        
        setCurrentTrack({
          id: track.id,
          name: track.name,
          artist: track.artists.map((a) => a.name).join(', '),
          album: track.album.name,
          duration_ms: playerState.duration,
          uri: track.uri,
          preview_url: null,
          image: track.album.images[0]?.url
        });

        const pos = playerState.position;
        const dur = playerState.duration;
        setProgress((pos / dur) * 100);
        setCurrentTime(formatTime(pos / 1000));
      });

      newPlayer.connect();
    };

    return () => { if (player) player.disconnect(); };
  }, [isPremium, accessToken, volume, player]);

  // Polling for progress
  useEffect(() => {
    if (isPremium && isPlaying && player) {
      intervalRef.current = setInterval(async () => {
        const state = await player.getCurrentState();
        if (state) {
          const pos = state.position;
          const dur = state.duration;
          setProgress((pos / dur) * 100);
          setCurrentTime(formatTime(pos / 1000));
        }
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isPremium, isPlaying, player]);

  const togglePlay = async () => {
    if (isPremium && player) {
      player.togglePlay();
    } else if (audioRef.current) {
      if (!currentTrack?.preview_url) return;
      if (isPlaying) audioRef.current.pause();
      else audioRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  // Progress for Guest Mode
  useEffect(() => {
    if (isPremium) return;
    const audio = audioRef.current;
    if (!audio) return;
    const updateProgress = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setProgress((audio.currentTime / audio.duration) * 100);
        setCurrentTime(formatTime(audio.currentTime));
      }
    };
    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('ended', () => { setIsPlaying(false); skipTrack('next'); });
    return () => {
      audio.removeEventListener('timeupdate', updateProgress);
      audio.removeEventListener('ended', () => setIsPlaying(false));
    };
  }, [currentTrack, isPremium, tracks, skipTrack]);

  useEffect(() => {
    if (isPremium && player) {
      void player.setVolume(volume);
    } else if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume, isPremium, player]);

  return (
    <div className="retro-itunes">
      {!isPremium && (
        <div className="spotify-banner">
          <span className="warning-icon">⚠️</span>
          {authError ? (
            <span style={{ color: '#ff4444' }}><strong>Login Error:</strong> {authError}</span>
          ) : (
            <span>Connect to Spotify Premium for full songs or enjoy 30-second previews.</span>
          )}
        </div>
      )}
      
      {isPremium && sdkError && (
        <div className="spotify-banner" style={{ backgroundColor: '#ffcccc', color: '#cc0000' }}>
          <span><strong>Player Issue:</strong> {sdkError}</span>
        </div>
      )}

      <div className="itunes-body">
        {showSidebar && (
          <div className="itunes-sidebar">
            <div className="sidebar-header">
              <span>▼</span> Playlists
            </div>
            <ul className="playlist-list">
              {PLAYLISTS.map((pl) => (
                <li 
                  key={pl.id} 
                  className={`playlist-item ${activePlaylistId === pl.id ? "active" : ""}`}
                  onClick={() => setActivePlaylistId(pl.id)}
                >
                  🎵 {pl.name}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="itunes-track-pane">
          <div className="track-header">
            <div></div>
            <div>Artist</div>
            <div>Title</div>
            <div>Album</div>
          </div>
          
          <div className="track-list-scroll">
            {loadError ? (
              <div style={{ padding: '10px', color: '#ff4444' }}>{loadError}</div>
            ) : tracks.length === 0 ? (
              <div style={{ padding: '10px', color: '#888' }}>Loading tracks...</div>
            ) : (
              tracks.map((track) => (
                <div
                  key={track.id}
                  className={`track-row ${currentTrack?.id === track.id ? 'active' : ''}`}
                  onClick={() => playTrack(track)}
                >
                  <div>
                    {track.image && <img src={track.image} alt="album" className="track-thumb" />}
                  </div>
                  <div>{track.artist}</div>
                  <div>{track.name} {!track.preview_url && !isPremium && '🚫'}</div>
                  <div>{track.album}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="itunes-bottom-bar">
        <div className="bottom-bar-left">
          <button 
            onClick={() => setShowSidebar(!showSidebar)} 
            className="sidebar-toggle-btn"
          >
            {showSidebar ? '◀' : '▶'}
          </button>

          <div className="transport-controls">
            <button onClick={() => skipTrack('prev')} className="control-button">⏮</button>
            <button onClick={togglePlay} className="control-button play-pause">
              {isPlaying ? '⏸' : '▶'}
            </button>
            <button onClick={() => skipTrack('next')} className="control-button">⏭</button>
          </div>
        </div>

        <div className="lcd-display">
          <div className="lcd-text">
            {currentTrack ? `${currentTrack.name} - ${currentTrack.artist}` : (isPremium ? (isReady ? 'Ready to Play' : 'Connecting...') : 'Guest Mode')}
          </div>
          <div className="lcd-progress-container">
            <span className="lcd-time">{currentTime}</span>
            <input
              type="range" min="0" max="100" value={progress}
              onChange={(e) => {
                const newProgress = Number(e.target.value);
                if (isPremium && player) {
                  const newPos = (newProgress / 100) * (currentTrack?.duration_ms || 0);
                  void player.seek(newPos);
                } else if (audioRef.current && isFinite(audioRef.current.duration)) {
                  const newTime = (newProgress / 100) * audioRef.current.duration;
                  if (isFinite(newTime)) audioRef.current.currentTime = newTime;
                }
                setProgress(newProgress);
              }}
              className="progress-bar"
            />
            <span className="lcd-time">
              {currentTrack ? formatTime(currentTrack.duration_ms / 1000) : "0:00"}
            </span>
          </div>
        </div>

        <div className="action-area">
          {!isPremium && (
            <button onClick={login} className="connect-spotify-btn">
              Connect to Spotify
            </button>
          )}
        </div>
      </div>

      {!isPremium && currentTrack && (
        <audio ref={audioRef} src={currentTrack.preview_url || undefined} preload="auto" />
      )}
    </div>
  );
};

export default Music;
