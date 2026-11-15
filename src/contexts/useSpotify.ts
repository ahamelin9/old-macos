// The Spotify login's types, context and hook. The provider lives in
// SpotifyContext.tsx; keeping the hook here lets that file export only a
// component, which React Fast Refresh needs.
import { createContext, useContext } from 'react';

export interface SpotifyContextType {
  accessToken: string | null;
  refreshToken: string | null;
  isPremium: boolean;
  authError: string | null;
  login: () => void;
  logout: () => void;
  /** Swap the refresh token for a new access token; false when that fails */
  refreshAccessToken: () => Promise<boolean>;
}

export const SpotifyContext = createContext<SpotifyContextType | undefined>(undefined);

export const useSpotify = () => {
  const context = useContext(SpotifyContext);
  if (context === undefined) {
    throw new Error('useSpotify must be used within a SpotifyProvider');
  }
  return context;
};
