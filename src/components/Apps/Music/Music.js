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
import React, { useState, useRef, useEffect } from 'react';
import SpotifyWebApi from 'spotify-web-api-js';
import { useSpotify } from '../../../contexts/SpotifyContext';
import './Music.css';
const spotifyApi = new SpotifyWebApi();
const ensureCleanId = (id) => id.split('?')[0].split('/').pop() || id;
const PLAYLISTS = [
    { name: "Jackie & Alex <3", id: "6UjgBHoOhSatQxMRDg30HI" },
    { name: "Tism", id: "0IVqQXdYjCuSIcRvBTdgjt" },
    { name: "Indy Eras 24' Tour", id: "2zZaspkKHdD8GVPuigHJPw" },
    { name: "Indy Eras 24' Tour", id: "2zZaspkKHdD8GVPuigHJPw" },
    { name: "Morgan Wallen 25' Tour", id: "46UZ7PIUiNkzqEjIdia9rv" }
];
const Music = () => {
    const { accessToken, isPremium, authError, login } = useSpotify();
    const [showSidebar, setShowSidebar] = useState(true);
    const [activePlaylistId, setActivePlaylistId] = useState(PLAYLISTS[0].id);
    const [tracks, setTracks] = useState([]);
    const [currentTrack, setCurrentTrack] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [volume, setVolume] = useState(0.7);
    const [currentTime, setCurrentTime] = useState("0:00");
    const [player, setPlayer] = useState(null);
    const [deviceId, setDeviceId] = useState(null);
    const [loadError, setLoadError] = useState(null);
    const [sdkError, setSdkError] = useState(null);
    const [isReady, setIsReady] = useState(false);
    const audioRef = useRef(null);
    const intervalRef = useRef(null);
    const formatTime = (seconds) => {
        if (!isFinite(seconds) || isNaN(seconds))
            return "0:00";
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };
    const playTrack = (track) => __awaiter(void 0, void 0, void 0, function* () {
        if (isPremium && !deviceId) {
            alert("Spotify player is connecting, please wait a moment...");
            return;
        }
        setCurrentTrack(track);
        if (isPremium && deviceId && accessToken) {
            try {
                const cleanId = ensureCleanId(activePlaylistId);
                const response = yield fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
                    method: 'PUT',
                    body: JSON.stringify({
                        context_uri: `spotify:playlist:${cleanId}`,
                        offset: { uri: track.uri }
                    }),
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` }
                });
                if (!response.ok) {
                    if (response.status === 404)
                        setSdkError("Device lost. Try refreshing.");
                }
                else {
                    setIsPlaying(true);
                }
            }
            catch (e) {
                console.error('Failed to send play command:', e);
            }
        }
        else {
            setIsPlaying(!!track.preview_url);
            setTimeout(() => {
                if (audioRef.current && track.preview_url) {
                    audioRef.current.play().catch(e => console.error("Playback failed:", e));
                }
            }, 0);
        }
    });
    const skipTrack = React.useCallback((direction) => {
        if (tracks.length === 0)
            return;
        const currentIndex = tracks.findIndex(t => t.id === (currentTrack === null || currentTrack === void 0 ? void 0 : currentTrack.id));
        let newIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
        if (newIndex < 0)
            newIndex = tracks.length - 1;
        if (newIndex >= tracks.length)
            newIndex = 0;
        playTrack(tracks[newIndex]);
    }, [tracks, currentTrack, activePlaylistId, accessToken, deviceId, isPremium]);
    // Fetch tracks
    useEffect(() => {
        const fetchTracks = () => __awaiter(void 0, void 0, void 0, function* () {
            setLoadError(null);
            let token = accessToken;
            if (!token) {
                try {
                    const response = yield fetch('/api/client_credentials');
                    const data = yield response.json();
                    token = data.access_token;
                }
                catch (error) {
                    console.error('Guest fetch error:', error);
                    setLoadError('Failed to connect to backend.');
                    return;
                }
            }
            if (token) {
                spotifyApi.setAccessToken(token);
                try {
                    const cleanId = ensureCleanId(activePlaylistId);
                    const data = yield spotifyApi.getPlaylistTracks(cleanId);
                    if (data && data.items && Array.isArray(data.items)) {
                        const formattedTracks = data.items
                            .filter((item) => item && item.track && item.track.type === 'track')
                            .map((item) => {
                            var _a;
                            const t = item.track;
                            return {
                                id: t.id,
                                name: t.name,
                                artist: t.artists.map((a) => a.name).join(', '),
                                album: t.album.name,
                                duration_ms: t.duration_ms,
                                uri: t.uri,
                                preview_url: t.preview_url,
                                image: ((_a = t.album.images[0]) === null || _a === void 0 ? void 0 : _a.url) || ''
                            };
                        });
                        setTracks(formattedTracks);
                    }
                }
                catch (error) {
                    console.error('Playlist fetch error:', error);
                    setLoadError('Failed to load playlist.');
                }
            }
        });
        fetchTracks();
    }, [accessToken, activePlaylistId]);
    // SDK Setup
    useEffect(() => {
        if (!isPremium || !accessToken)
            return;
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
                getOAuthToken: (cb) => { cb(accessToken); },
                volume: volume
            });
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
                var _a;
                const playerState = state;
                if (!playerState)
                    return;
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
                    image: (_a = track.album.images[0]) === null || _a === void 0 ? void 0 : _a.url
                });
                const pos = playerState.position;
                const dur = playerState.duration;
                setProgress((pos / dur) * 100);
                setCurrentTime(formatTime(pos / 1000));
            });
            newPlayer.connect();
        };
        return () => { if (player)
            player.disconnect(); };
    }, [isPremium, accessToken, volume, player]);
    // Polling for progress
    useEffect(() => {
        if (isPremium && isPlaying && player) {
            intervalRef.current = setInterval(() => __awaiter(void 0, void 0, void 0, function* () {
                const state = yield player.getCurrentState();
                if (state) {
                    const pos = state.position;
                    const dur = state.duration;
                    setProgress((pos / dur) * 100);
                    setCurrentTime(formatTime(pos / 1000));
                }
            }), 1000);
        }
        else {
            if (intervalRef.current)
                clearInterval(intervalRef.current);
        }
        return () => { if (intervalRef.current)
            clearInterval(intervalRef.current); };
    }, [isPremium, isPlaying, player]);
    const togglePlay = () => __awaiter(void 0, void 0, void 0, function* () {
        if (isPremium && player) {
            player.togglePlay();
        }
        else if (audioRef.current) {
            if (!(currentTrack === null || currentTrack === void 0 ? void 0 : currentTrack.preview_url))
                return;
            if (isPlaying)
                audioRef.current.pause();
            else
                audioRef.current.play();
            setIsPlaying(!isPlaying);
        }
    });
    // Progress for Guest Mode
    useEffect(() => {
        if (isPremium)
            return;
        const audio = audioRef.current;
        if (!audio)
            return;
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
        }
        else if (audioRef.current) {
            audioRef.current.volume = volume;
        }
    }, [volume, isPremium, player]);
    return (_jsxs("div", { className: "retro-itunes", children: [!isPremium && (_jsxs("div", { className: "spotify-banner", children: [_jsx("span", { className: "warning-icon", children: "\u26A0\uFE0F" }), authError ? (_jsxs("span", { style: { color: '#ff4444' }, children: [_jsx("strong", { children: "Login Error:" }), " ", authError] })) : (_jsx("span", { children: "Connect to Spotify Premium for full songs or enjoy 30-second previews." }))] })), isPremium && sdkError && (_jsx("div", { className: "spotify-banner", style: { backgroundColor: '#ffcccc', color: '#cc0000' }, children: _jsxs("span", { children: [_jsx("strong", { children: "Player Issue:" }), " ", sdkError] }) })), _jsxs("div", { className: "itunes-body", children: [showSidebar && (_jsxs("div", { className: "itunes-sidebar", children: [_jsxs("div", { className: "sidebar-header", children: [_jsx("span", { children: "\u25BC" }), " Playlists"] }), _jsx("ul", { className: "playlist-list", children: PLAYLISTS.map((pl) => (_jsxs("li", { className: `playlist-item ${activePlaylistId === pl.id ? "active" : ""}`, onClick: () => setActivePlaylistId(pl.id), children: ["\uD83C\uDFB5 ", pl.name] }, pl.id))) })] })), _jsxs("div", { className: "itunes-track-pane", children: [_jsxs("div", { className: "track-header", children: [_jsx("div", {}), _jsx("div", { children: "Artist" }), _jsx("div", { children: "Title" }), _jsx("div", { children: "Album" })] }), _jsx("div", { className: "track-list-scroll", children: loadError ? (_jsx("div", { style: { padding: '10px', color: '#ff4444' }, children: loadError })) : tracks.length === 0 ? (_jsx("div", { style: { padding: '10px', color: '#888' }, children: "Loading tracks..." })) : (tracks.map((track) => (_jsxs("div", { className: `track-row ${(currentTrack === null || currentTrack === void 0 ? void 0 : currentTrack.id) === track.id ? 'active' : ''}`, onClick: () => playTrack(track), children: [_jsx("div", { children: track.image && _jsx("img", { src: track.image, alt: "album", className: "track-thumb" }) }), _jsx("div", { children: track.artist }), _jsxs("div", { children: [track.name, " ", !track.preview_url && !isPremium && '🚫'] }), _jsx("div", { children: track.album })] }, track.id)))) })] })] }), _jsxs("div", { className: "itunes-bottom-bar", children: [_jsxs("div", { className: "bottom-bar-left", children: [_jsx("button", { onClick: () => setShowSidebar(!showSidebar), className: "sidebar-toggle-btn", children: showSidebar ? '◀' : '▶' }), _jsxs("div", { className: "transport-controls", children: [_jsx("button", { onClick: () => skipTrack('prev'), className: "control-button", children: "\u23EE" }), _jsx("button", { onClick: togglePlay, className: "control-button play-pause", children: isPlaying ? '⏸' : '▶' }), _jsx("button", { onClick: () => skipTrack('next'), className: "control-button", children: "\u23ED" })] })] }), _jsxs("div", { className: "lcd-display", children: [_jsx("div", { className: "lcd-text", children: currentTrack ? `${currentTrack.name} - ${currentTrack.artist}` : (isPremium ? (isReady ? 'Ready to Play' : 'Connecting...') : 'Guest Mode') }), _jsxs("div", { className: "lcd-progress-container", children: [_jsx("span", { className: "lcd-time", children: currentTime }), _jsx("input", { type: "range", min: "0", max: "100", value: progress, onChange: (e) => {
                                            const newProgress = Number(e.target.value);
                                            if (isPremium && player) {
                                                const newPos = (newProgress / 100) * ((currentTrack === null || currentTrack === void 0 ? void 0 : currentTrack.duration_ms) || 0);
                                                void player.seek(newPos);
                                            }
                                            else if (audioRef.current && isFinite(audioRef.current.duration)) {
                                                const newTime = (newProgress / 100) * audioRef.current.duration;
                                                if (isFinite(newTime))
                                                    audioRef.current.currentTime = newTime;
                                            }
                                            setProgress(newProgress);
                                        }, className: "progress-bar" }), _jsx("span", { className: "lcd-time", children: currentTrack ? formatTime(currentTrack.duration_ms / 1000) : "0:00" })] })] }), _jsx("div", { className: "action-area", children: !isPremium && (_jsx("button", { onClick: login, className: "connect-spotify-btn", children: "Connect to Spotify" })) })] }), !isPremium && currentTrack && (_jsx("audio", { ref: audioRef, src: currentTrack.preview_url || undefined, preload: "auto" }))] }));
};
export default Music;
