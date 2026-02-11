import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import './index.css'

// HashRouter uses URL hashes (e.g. /#/download) which work correctly with
// Electron's file:// protocol. BrowserRouter relies on the History API and
// breaks when the app is loaded via loadFile in the packaged desktop app.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
)
