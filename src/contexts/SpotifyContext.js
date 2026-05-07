var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useState, useEffect } from 'react';
const SpotifyContext = createContext(undefined);
export const SpotifyProvider = ({ children }) => {
    const [accessToken, setAccessToken] = useState(localStorage.getItem('spotify_access_token'));
    const [refreshToken, setRefreshToken] = useState(localStorage.getItem('spotify_refresh_token'));
    const [authError, setAuthError] = useState(null);
    const [isPremium, setIsPremium] = useState(false);
    useEffect(() => {
        // Check for tokens in URL (after redirect from backend)
        const urlParams = new URLSearchParams(window.location.search);
        const access = urlParams.get('access_token');
        const refresh = urlParams.get('refresh_token');
        const error = urlParams.get('error');
        if (access || refresh || error) {
            console.log('--- Spotify Auth Debug ---');
            console.log('Access Token:', access ? 'Present' : 'Missing');
            console.log('Refresh Token:', refresh ? 'Present' : 'Missing');
            console.log('Error from Spotify:', error || 'None');
            console.log('--------------------------');
        }
        if (error) {
            setAuthError(error);
        }
        if (access && refresh) {
            setAccessToken(access);
            setRefreshToken(refresh);
            localStorage.setItem('spotify_access_token', access);
            localStorage.setItem('spotify_refresh_token', refresh);
            const newUrl = window.location.origin + window.location.pathname;
            window.history.replaceState({}, document.title, newUrl);
        }
    }, []);
    useEffect(() => {
        if (accessToken) {
            // Fetch profile to verify Premium status
            fetch('https://api.spotify.com/v1/me', {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            })
                .then(res => res.json())
                .then(data => {
                console.log('--- Spotify Profile Debug ---');
                console.log('Product Type:', data.product);
                console.log('User Email:', data.email);
                console.log('-----------------------------');
                if (data.product === 'premium') {
                    setIsPremium(true);
                }
                else {
                    setIsPremium(false);
                    setAuthError('Spotify Premium is required for playback.');
                }
            })
                .catch(err => {
                console.error('Failed to fetch profile:', err);
                setIsPremium(false);
            });
        }
        else {
            setIsPremium(false);
        }
    }, [accessToken]);
    const login = () => {
        setAuthError(null);
        window.location.href = '/api/login';
    };
    const logout = () => {
        setAccessToken(null);
        setRefreshToken(null);
        setIsPremium(false);
        setAuthError(null);
        localStorage.removeItem('spotify_access_token');
        localStorage.removeItem('spotify_refresh_token');
    };
    const refreshAccessToken = () => __awaiter(void 0, void 0, void 0, function* () {
        if (!refreshToken)
            return;
        try {
            const response = yield fetch(`/api/refresh?refresh_token=${refreshToken}`);
            const data = yield response.json();
            if (data.access_token) {
                setAccessToken(data.access_token);
                localStorage.setItem('spotify_access_token', data.access_token);
            }
        }
        catch (error) {
            console.error('Failed to refresh token:', error);
            logout();
        }
    });
    return (_jsx(SpotifyContext.Provider, { value: { accessToken, refreshToken, isPremium, authError, login, logout, refreshAccessToken }, children: children }));
};
export const useSpotify = () => {
    const context = useContext(SpotifyContext);
    if (context === undefined) {
        throw new Error('useSpotify must be used within a SpotifyProvider');
    }
    return context;
};
