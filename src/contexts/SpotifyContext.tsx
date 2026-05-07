import React, { createContext, useContext, useState, useEffect } from 'react';

interface SpotifyContextType {
  accessToken: string | null;
  refreshToken: string | null;
  isPremium: boolean;
  authError: string | null;
  login: () => void;
  logout: () => void;
  refreshAccessToken: () => Promise<void>;
}

const SpotifyContext = createContext<SpotifyContextType | undefined>(undefined);

export const SpotifyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [accessToken, setAccessToken] = useState<string | null>(localStorage.getItem('spotify_access_token'));
  const [refreshToken, setRefreshToken] = useState<string | null>(localStorage.getItem('spotify_refresh_token'));
  const [authError, setAuthError] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState<boolean>(false);

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
        } else {
          setIsPremium(false);
          setAuthError('Spotify Premium is required for playback.');
        }
      })
      .catch(err => {
        console.error('Failed to fetch profile:', err);
        setIsPremium(false);
      });
    } else {
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

  const refreshAccessToken = async () => {
    if (!refreshToken) return;
    try {
      const response = await fetch(`/api/refresh?refresh_token=${refreshToken}`);
      const data = await response.json();
      if (data.access_token) {
        setAccessToken(data.access_token);
        localStorage.setItem('spotify_access_token', data.access_token);
      }
    } catch (error) {
      console.error('Failed to refresh token:', error);
      logout();
    }
  };

  return (
    <SpotifyContext.Provider value={{ accessToken, refreshToken, isPremium, authError, login, logout, refreshAccessToken }}>
      {children}
    </SpotifyContext.Provider>
  );
};

export const useSpotify = () => {
  const context = useContext(SpotifyContext);
  if (context === undefined) {
    throw new Error('useSpotify must be used within a SpotifyProvider');
  }
  return context;
};
