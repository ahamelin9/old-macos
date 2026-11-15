import React, { useState, useEffect, useCallback, useRef } from 'react';
import { SpotifyContext } from './useSpotify';
import { readStored, removeStored, writeStored } from './storage';

const ACCESS_KEY = 'spotify_access_token';
const REFRESH_KEY = 'spotify_refresh_token';

/**
 * Tokens handed back by the login callback. They come in the URL fragment
 * (#access_token=…), which the browser never sends to a server or puts in a
 * Referer; the query string is still read for an older deploy of the backend.
 */
const readLoginRedirect = () => {
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const query = new URLSearchParams(window.location.search);
  const get = (key: string) => hash.get(key) ?? query.get(key);
  return { access: get('access_token'), refresh: get('refresh_token'), error: get('error') };
};

export const SpotifyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [accessToken, setAccessToken] = useState<string | null>(() => readStored(ACCESS_KEY));
  const [refreshToken, setRefreshToken] = useState<string | null>(() => readStored(REFRESH_KEY));
  const [authError, setAuthError] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState<boolean>(false);
  // When the token was last refreshed, so a token Spotify rejects right after
  // a refresh logs out instead of refreshing in a loop
  const lastRefresh = useRef(0);

  // After the redirect back from the login: keep the tokens, then clear them from the address bar
  useEffect(() => {
    const { access, refresh, error } = readLoginRedirect();
    if (error) setAuthError(error);
    if (access && refresh) {
      setAccessToken(access);
      setRefreshToken(refresh);
      writeStored(ACCESS_KEY, access);
      writeStored(REFRESH_KEY, refresh);
    }
    if (access || refresh || error) {
      window.history.replaceState({}, document.title, window.location.origin + window.location.pathname);
    }
  }, []);

  const logout = useCallback(() => {
    setAccessToken(null);
    setRefreshToken(null);
    setIsPremium(false);
    setAuthError(null);
    removeStored(ACCESS_KEY);
    removeStored(REFRESH_KEY);
  }, []);

  const refreshAccessToken = useCallback(async (): Promise<boolean> => {
    if (!refreshToken) return false;
    try {
      // POST, so the refresh token stays out of URLs and server logs
      const response = await fetch('/api/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken })
      });
      const data = (await response.json()) as { access_token?: string; refresh_token?: string };
      if (!response.ok || !data.access_token) return false;
      setAccessToken(data.access_token);
      writeStored(ACCESS_KEY, data.access_token);
      // Spotify sometimes rotates the refresh token; the old one then stops working
      if (data.refresh_token) {
        setRefreshToken(data.refresh_token);
        writeStored(REFRESH_KEY, data.refresh_token);
      }
      return true;
    } catch (error) {
      console.error('Failed to refresh the Spotify token:', error);
      return false;
    }
  }, [refreshToken]);

  // Check the account can play (Premium). An access token lasts an hour, so a
  // returning visitor's is often expired: refresh it once before giving up.
  useEffect(() => {
    if (!accessToken) {
      setIsPremium(false);
      return;
    }
    let cancelled = false;
    const checkProfile = async () => {
      try {
        const res = await fetch('https://api.spotify.com/v1/me', {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (cancelled) return;
        if (res.status === 401) {
          const recentlyRefreshed = Date.now() - lastRefresh.current < 60_000;
          lastRefresh.current = Date.now();
          const refreshed = !recentlyRefreshed && (await refreshAccessToken());
          if (cancelled) return;
          if (!refreshed) {
            logout();
            setAuthError('Your Spotify login expired. Connect again to play full songs.');
          }
          // A new token re-runs this check
          return;
        }
        const data = (await res.json()) as { product?: string };
        if (cancelled) return;
        if (data.product === 'premium') {
          setIsPremium(true);
        } else {
          setIsPremium(false);
          setAuthError('Spotify Premium is required for playback.');
        }
      } catch (err) {
        console.error('Failed to fetch the Spotify profile:', err);
        if (!cancelled) setIsPremium(false);
      }
    };
    void checkProfile();
    return () => {
      cancelled = true;
    };
  }, [accessToken, refreshAccessToken, logout]);

  const login = useCallback(() => {
    setAuthError(null);
    window.location.href = '/api/login';
  }, []);

  return (
    <SpotifyContext.Provider value={{ accessToken, refreshToken, isPremium, authError, login, logout, refreshAccessToken }}>
      {children}
    </SpotifyContext.Provider>
  );
};
