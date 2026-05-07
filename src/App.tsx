// Context
import { WindowProvider } from './contexts/WindowContext';
import { SpotifyProvider } from './contexts/SpotifyContext';
// Components
import Desktop from './components/Desktop/Desktop';

function App() {
  return (
    <SpotifyProvider>
      <WindowProvider>
        <Desktop />
      </WindowProvider>
    </SpotifyProvider>
  );
}

export default App;