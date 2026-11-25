import React, { useState, useRef, useEffect } from 'react';
import SpotifyWebApi from 'spotify-web-api-js';
import { useSpotify } from '../../../contexts/useSpotify';
import './Music.css';
import { findPreview } from './itunes';

const spotifyApi = new SpotifyWebApi();

const ensureCleanId = (id: string) => id.split('?')[0].split('/').pop() || id;

const PLAYLISTS = [
  { name: "Jackie & Alex <3", id: "6UjgBHoOhSatQxMRDg30HI" },
  { name: "Tism", id: "0IVqQXdYjCuSIcRvBTdgjt" }, 
  { name: "Zach Bryan 24' Tour", id: "34LNnZ8iIV884x9xZZxDt6" },
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

// Define Spotify SDK Types with specific types
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

const DEFAULT_VOLUME = 0.7;
/** Pages of 100 tracks to load at most, so a huge playlist stops at 1,000 */
const MAX_TRACK_PAGES = 10;

const Music = () => {
  const { accessToken, isPremium, authError, login } = useSpotify();
  
  const [showSidebar, setShowSidebar] = useState(true);
  const [activePlaylistId, setActivePlaylistId] = useState(PLAYLISTS[0].id);

  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(DEFAULT_VOLUME);
  const [currentTime, setCurrentTime] = useState("0:00");
  const [player, setPlayer] = useState<SpotifyPlayer | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sdkError, setSdkError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Guest mode: the preview clip playing now, the tracks Apple has none for,
  // and a count of play presses so a slow lookup can't start an older track
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  // Bumped for each preview to start, so the effect below plays it even when
  // the same track is pressed twice
  const [previewPlays, setPreviewPlays] = useState(0);
  const [noPreviewIds, setNoPreviewIds] = useState<Set<string>>(() => new Set());
  const playRequestRef = useRef(0);
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
      // Guests hear a 30-second preview. Spotify no longer sends one, so it
      // comes from Apple's iTunes Search (the `apis` skill, itunes.md).
      const request = ++playRequestRef.current;
      audioRef.current?.pause();
      setIsPlaying(false);
      setPreviewUrl(null);
      let url = track.preview_url;
      if (!url) {
        try {
          url = await findPreview(track.artist, track.name);
        } catch (e) {
          console.error('Preview lookup failed:', e);
          return;
        }
      }
      if (request !== playRequestRef.current) return;
      if (!url) {
        setNoPreviewIds(prev => new Set(prev).add(track.id));
        return;
      }
      setPreviewUrl(url);
      setIsPlaying(true);
      setPreviewPlays(n => n + 1);
    }
  };

  // Start a guest preview once React has given the <audio> element its new
  // src. Calling play() any sooner got cut off by the new src loading.
  useEffect(() => {
    const audio = audioRef.current;
    if (isPremium || !audio || !previewUrl || previewPlays === 0) return;
    audio.currentTime = 0;
    audio.play().catch((e: unknown) => {
      // AbortError: another track was pressed and is loading; that's fine
      if (e instanceof DOMException && e.name === 'AbortError') return;
      // Some browsers only allow play() straight from a click; then the clip
      // waits, loaded, for the play button
      console.error('Playback failed:', e);
      setIsPlaying(false);
    });
    // previewUrl is read, not watched: previewPlays changes with every start
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewPlays, isPremium]);

  const skipTrack = React.useCallback((direction: 'next' | 'prev') => {
    if (tracks.length === 0) return;
    const currentIndex = tracks.findIndex(t => t.id === currentTrack?.id);
    let newIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
    if (newIndex < 0) newIndex = tracks.length - 1;
    if (newIndex >= tracks.length) newIndex = 0;
    playTrack(tracks[newIndex]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracks, currentTrack, activePlaylistId, accessToken, deviceId, isPremium]);

  // Fetch tracks
  useEffect(() => {
    // Switching playlists makes this one's answer stale: drop it when it lands
    let cancelled = false;
    const fetchTracks = async () => {
      setLoadError(null);
      let token = accessToken;
      
      if (!token) {
        try {
          const response = await fetch('/api/client_credentials');
          const data = (await response.json()) as { access_token: string };
          token = data.access_token;
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
          // Spotify sends 100 tracks a page, so keep asking until it says
          // there are no more (capped, to stay gentle with a huge playlist)
          const items: SpotifyApi.PlaylistTrackObject[] = [];
          for (let page = 0; page < MAX_TRACK_PAGES; page++) {
            const data = await spotifyApi.getPlaylistTracks(cleanId, { limit: 100, offset: page * 100 });
            if (cancelled) return;
            if (!data || !Array.isArray(data.items)) break;
            items.push(...data.items);
            if (!data.next) break;
          }

          if (items.length > 0) {
            const formattedTracks = items
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
          if (cancelled) return;
          console.error('Playlist fetch error:', error);
          setLoadError('Failed to load playlist.');
        }
      }
    };

    void fetchTracks();
    return () => {
      cancelled = true;
    };
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
        // Not `volume`: this effect would then rebuild the player on every
        // volume change. The effect below sets it once the player exists.
        volume: DEFAULT_VOLUME
      }) as unknown as SpotifyPlayer;

      setPlayer(newPlayer);

      newPlayer.addListener('initialization_error', ({ message }) => setSdkError(`Init Error: ${message || 'Unknown'}`));
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
        const playerState = state as unknown as SpotifyPlayerState | null;
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

      void newPlayer.connect();
    };

    return () => { if (player) player.disconnect(); };
  }, [isPremium, accessToken, player]);

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
      void player.togglePlay();
    } else if (audioRef.current) {
      if (!previewUrl) return;
      if (isPlaying) audioRef.current.pause();
      else {
        void audioRef.current.play();
      }
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
    // Removed by the same reference: a fresh arrow function in the cleanup
    // removed nothing, so every track added another 'ended' listener and
    // the end of a clip skipped once per track played so far
    const playNext = () => { setIsPlaying(false); skipTrack('next'); };
    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('ended', playNext);
    return () => {
      audio.removeEventListener('timeupdate', updateProgress);
      audio.removeEventListener('ended', playNext);
    };
  }, [currentTrack, isPremium, tracks, skipTrack]);

  // currentTrack too: the preview <audio> element first appears with the first track
  useEffect(() => {
    if (isPremium && player) {
      void player.setVolume(volume);
    } else if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume, isPremium, player, currentTrack]);

  return (
    <div className="retro-itunes">
      {!isPremium && (
        <div className="spotify-banner">
          <span className="warning-icon">⚠️</span>
          {authError ? (
            <span className="music-error-text"><strong>Login Error:</strong> {authError}</span>
          ) : (
            <span>Connect to Spotify Premium for full songs, or enjoy 30-second previews from Apple Music.</span>
          )}
        </div>
      )}
      
      {isPremium && sdkError && (
        <div className="spotify-banner music-banner-error">
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
              <div className="mac-message mac-message-error">{loadError}</div>
            ) : tracks.length === 0 ? (
              <div className="mac-message">Loading tracks...</div>
            ) : (
              tracks.map((track) => (
                <div
                  key={track.id}
                  className={`track-row ${currentTrack?.id === track.id ? 'active' : ''}`}
                  onClick={() => { void playTrack(track); }}
                >
                  <div>
                    {track.image && <img src={track.image} alt="album" className="track-thumb" />}
                  </div>
                  <div>{track.artist}</div>
                  <div>{track.name} {!isPremium && noPreviewIds.has(track.id) && <span title="No preview available">🚫</span>}</div>
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
            {showSidebar ? '◀︎' : '▶︎'}
          </button>

          <div className="transport-controls">
            <button onClick={() => skipTrack('prev')} className="control-button">⏮︎</button>
            <button onClick={() => { void togglePlay(); }} className="control-button play-pause">
              {isPlaying ? '⏸︎' : '▶︎'}
            </button>
            <button onClick={() => skipTrack('next')} className="control-button">⏭︎</button>
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
          <label className="music-volume" title="Volume">
            <span aria-hidden="true">🔈</span>
            <input
              type="range" min="0" max="100" value={Math.round(volume * 100)}
              onChange={(e) => setVolume(Number(e.target.value) / 100)}
              className="progress-bar music-volume-slider"
              aria-label="Volume"
            />
          </label>
          {!isPremium && (
            <button onClick={login} className="connect-spotify-btn">
              Connect<span className="music-connect-extra"> to Spotify</span>
            </button>
          )}
        </div>
      </div>

      {!isPremium && currentTrack && (
        <audio ref={audioRef} src={previewUrl ?? undefined} preload="auto" />
      )}
    </div>
  );
};

export default Music;
