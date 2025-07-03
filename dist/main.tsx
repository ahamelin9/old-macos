// React
import React from 'react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Application
import App from '/Users/alex/Random Projects/OldMacOS/macos-1999/src/App.js'
// Styling
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
