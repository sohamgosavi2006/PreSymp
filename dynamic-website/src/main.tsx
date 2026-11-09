import '@fontsource/atkinson-hyperlegible/400.css'
import '@fontsource/atkinson-hyperlegible/700.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './tokens.css'
import './app.css'
import './print.css'

// ?reset only clears the url param; the store always starts from the seed
if (new URLSearchParams(location.search).has('reset')) history.replaceState(null, '', location.pathname + location.hash)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
