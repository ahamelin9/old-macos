import { jsx as _jsx } from "react/jsx-runtime";
// Context
import { WindowProvider } from './contexts/WindowContext';
// Components
import Desktop from './components/Desktop/Desktop';
function App() {
    return (_jsx(WindowProvider, { children: _jsx(Desktop, {}) }));
}
export default App;
