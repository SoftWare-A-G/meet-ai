import type { Child } from 'hono/jsx'

type HeaderProps = {
  nav?: Child
}

export function Header({ nav }: HeaderProps = {}) {
  return (
    <header class="header">
      <a href="/" class="header-logo">meet-ai.cc</a>
      <nav class="header-nav">
        {nav ?? (
          <>
            <a href="#quickstart" class="header-link">Quick Start</a>
            <a href="/key" class="header-btn" data-cta>Get API Key</a>
          </>
        )}
      </nav>
    </header>
  )
}
