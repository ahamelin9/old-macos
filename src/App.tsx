// Context
import { WindowProvider } from './contexts/WindowContext';
// Components
import Desktop from './components/Desktop/Desktop';

function App() {
  return (
    <WindowProvider>
      <Desktop />
    </WindowProvider>
  );
}

export default App;