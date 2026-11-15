import React from 'react'
import ReactDOM from 'react-dom/client'
// The shared styles load first: tokens.css sets the layer order (design skill)
import './styles/tokens.css'
import './styles/base.css'
import './styles/kit.css'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
