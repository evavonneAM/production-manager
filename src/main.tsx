import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import './i18n'
import { AuthProvider } from './auth/AuthProvider'
import App from './App.tsx'

// Keep the installed PWA current: check for a new version every minute while the
// app is open. When the new service worker takes control, reload so the page
// actually runs it — without this, updates install but never take effect until
// a hard refresh (the staleness the owner kept hitting on phone and desktop).
let swRefreshing = false
navigator.serviceWorker?.addEventListener('controllerchange', () => {
  if (swRefreshing) return
  swRefreshing = true
  window.location.reload()
})
registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (registration) {
      setInterval(() => void registration.update(), 60 * 1000)
    }
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
