// Context
import { WindowProvider } from './contexts/WindowContext';
import { SpotifyProvider } from './contexts/SpotifyContext';
import { SettingsProvider } from './contexts/SettingsContext';
// Components
import Desktop from './components/Desktop/Desktop';

function App() {
  return (
    <SettingsProvider>
      <SpotifyProvider>
        <WindowProvider>
          <Desktop />
        </WindowProvider>
      </SpotifyProvider>
    </SettingsProvider>
  );
}

export default App;