import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useRef, useEffect } from 'react';
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
    const audioRef = useRef(null);
    // Handle play/pause
    const togglePlay = () => {
        var _a, _b;
        if (isPlaying) {
            (_a = audioRef.current) === null || _a === void 0 ? void 0 : _a.pause();
        }
        else {
            (_b = audioRef.current) === null || _b === void 0 ? void 0 : _b.play();
        }
        setIsPlaying(!isPlaying);
    };
    // Change track
    const playTrack = (track) => {
        setCurrentTrack(track);
        setIsPlaying(true);
        setTimeout(() => { var _a; return (_a = audioRef.current) === null || _a === void 0 ? void 0 : _a.play(); }, 0);
    };
    // Skip to next/previous track
    const skipTrack = (direction) => {
        const currentIndex = tracks.findIndex(t => t.id === currentTrack.id);
        let newIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
        if (newIndex < 0)
            newIndex = tracks.length - 1;
        if (newIndex >= tracks.length)
            newIndex = 0;
        playTrack(tracks[newIndex]);
    };
    // Update progress bar and time display
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio)
            return;
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
    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };
    // Handle volume change
    useEffect(() => {
        if (audioRef.current)
            audioRef.current.volume = volume;
    }, [volume]);
    return (_jsxs("div", { className: "retro-itunes", children: [_jsx("div", { className: "title-bar", children: _jsx("h1", { children: "iTunes" }) }), _jsxs("div", { className: "player-window", children: [_jsx("div", { className: "track-list", children: tracks.map((track) => (_jsxs("div", { className: `track ${currentTrack.id === track.id ? 'active' : ''}`, onClick: () => playTrack(track), children: [_jsx("span", { className: "track-name", children: track.name }), _jsx("span", { className: "track-artist", children: track.artist }), _jsx("span", { className: "track-duration", children: track.duration })] }, track.id))) }), _jsxs("div", { className: "player-controls", children: [_jsxs("div", { className: "now-playing", children: [_jsxs("div", { className: "now-playing-title", children: [currentTrack.name, " - ", currentTrack.artist] }), _jsxs("div", { className: "time-display", children: [currentTime, " / ", currentTrack.duration] })] }), _jsx("div", { className: "progress-container", children: _jsx("input", { type: "range", min: "0", max: "100", value: progress, onChange: (e) => {
                                        if (audioRef.current) {
                                            const newTime = (Number(e.target.value) / 100) * audioRef.current.duration;
                                            audioRef.current.currentTime = newTime;
                                        }
                                    }, className: "progress-bar" }) }), _jsxs("div", { className: "control-buttons", children: [_jsx("button", { onClick: () => skipTrack('prev'), className: "control-button", children: "\u23EE" }), _jsx("button", { onClick: togglePlay, className: "control-button play-pause", children: isPlaying ? '⏸' : '▶' }), _jsx("button", { onClick: () => skipTrack('next'), className: "control-button", children: "\u23ED" })] }), _jsxs("div", { className: "volume-control", children: [_jsx("span", { className: "volume-icon", children: "\uD83D\uDD0A" }), _jsx("input", { type: "range", min: "0", max: "1", step: "0.01", value: volume, onChange: (e) => setVolume(Number(e.target.value)), className: "volume-slider" })] })] }), _jsx("audio", { ref: audioRef, src: currentTrack.audioUrl, preload: "auto" })] })] }));
};
export default Music;
