import { jsx as _jsx } from "react/jsx-runtime";
// React
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Application
import App from './App';
// Styling
import './index.css';
createRoot(document.getElementById('root')).render(_jsx(StrictMode, { children: _jsx(App, {}) }));
