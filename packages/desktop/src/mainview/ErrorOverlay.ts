export function showErrorOverlay(error: unknown) {
  const existing = document.getElementById('error-overlay')
  if (existing) existing.remove()

  const message = error instanceof Error ? (error.stack ?? error.message) : String(error)

  const overlay = document.createElement('div')
  overlay.id = 'error-overlay'
  overlay.className = 'error-overlay'

  const title = document.createElement('div')
  title.className = 'error-overlay-title'
  title.textContent = 'Something went wrong'
  overlay.appendChild(title)

  const pre = document.createElement('pre')
  pre.className = 'error-overlay-stack'
  pre.textContent = message
  overlay.appendChild(pre)

  const hint = document.createElement('div')
  hint.className = 'error-overlay-hint'
  hint.textContent = 'Check the console for more details. Reload to retry.'
  overlay.appendChild(hint)

  document.body.appendChild(overlay)
}

export function installErrorHandlers() {
  window.onerror = (_msg, _src, _line, _col, error) => {
    showErrorOverlay(error ?? _msg)
  }

  window.onunhandledrejection = (event: PromiseRejectionEvent) => {
    showErrorOverlay(event.reason)
  }
}
