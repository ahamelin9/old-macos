// React
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Application
import App from './App'
// Styling
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
