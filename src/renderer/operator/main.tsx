import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../src/styles.css'
import { App } from '../src/App'

// Platform-specific CSS (title bar spacing for the window buttons)
document.documentElement.dataset.platform = window.fc.platform

// Remembered UI state from before the rename used "wf." keys (current service, Bible version…)
try {
  for (const key of Object.keys(localStorage)) {
    if (!key.startsWith('wf.')) continue
    const next = `fc.${key.slice(3)}`
    if (localStorage.getItem(next) === null) localStorage.setItem(next, localStorage.getItem(key) ?? '')
    localStorage.removeItem(key)
  }
} catch {
  /* storage unavailable: nothing to carry over */
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
