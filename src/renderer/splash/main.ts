// The main process passes the version in the URL and updates the status line
// with webContents.executeJavaScript('fcSplash(...)') between startup steps.
const params = new URLSearchParams(location.search)
const version = document.getElementById('version')
const status = document.getElementById('status')
if (version) version.textContent = params.get('v') ? `v${params.get('v')}` : ''

declare global {
  interface Window {
    fcSplash: (text: string) => void
  }
}

window.fcSplash = (text) => {
  if (status) status.textContent = text
}

export {}
