export function useIsStandalone(): boolean {
  if (typeof window === 'undefined') return false

  if ('standalone' in window.navigator) {
    return window.navigator.standalone === true
  }

  return window.matchMedia('(display-mode: standalone)').matches
}
