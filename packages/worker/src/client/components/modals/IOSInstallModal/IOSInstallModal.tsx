type IOSInstallModalProps = {
  onClose: () => void
}

export default function IOSInstallModal({ onClose }: IOSInstallModalProps) {
  return (
    <div class="ios-install-overlay" onClick={onClose}>
      <div class="ios-install-panel" onClick={(e: Event) => e.stopPropagation()}>
        <h3>Install meet-ai</h3>
        <div class="ios-install-steps">
          <div class="ios-install-step">
            <span class="ios-step-num">1</span>
            <span class="ios-step-text">
              Tap the <strong>Share</strong> button
              <svg class="ios-share-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" /></svg>
              in the toolbar
            </span>
          </div>
          <div class="ios-install-step">
            <span class="ios-step-num">2</span>
            <span class="ios-step-text">Scroll down and tap <strong>Add to Home Screen</strong></span>
          </div>
          <div class="ios-install-step">
            <span class="ios-step-num">3</span>
            <span class="ios-step-text">Tap <strong>Add</strong> in the top right</span>
          </div>
        </div>
        <button class="ios-install-close" onClick={onClose}>Got it</button>
      </div>
    </div>
  )
}
