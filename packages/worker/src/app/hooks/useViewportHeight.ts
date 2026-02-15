import { useEffect } from 'react'

export function useViewportHeight() {
  useEffect(() => {
    function update() {
      const vh = window.visualViewport?.height || window.innerHeight
      document.documentElement.style.setProperty('--vh', `${vh}px`)
    }

    update()
    window.visualViewport?.addEventListener('resize', update)
    window.addEventListener('resize', update)

    return () => {
      window.visualViewport?.removeEventListener('resize', update)
      window.removeEventListener('resize', update)
    }
  }, [])
}
