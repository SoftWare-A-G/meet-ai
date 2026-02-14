/** @jsxImportSource hono/jsx */
import type { Child } from 'hono/jsx'

type HeaderProps = {
  nav?: Child
}

export function Header({ nav }: HeaderProps = {}) {
  return (
    <header class="fixed top-0 right-0 left-0 z-10 flex items-center justify-between border-b border-edge bg-surface/80 px-6 py-3 backdrop-blur-lg">
      <a href="/" class="text-sm font-bold text-text-primary no-underline">meet-ai.cc</a>
      <nav class="flex items-center gap-2">
        {nav ?? (
          <>
            <a href="#quickstart" class="px-3 py-1 text-sm text-text-secondary no-underline transition-colors duration-150 hover:text-text-primary">Quick Start</a>
            <a href="/key" class="rounded-md bg-blue-600 px-4 py-1 text-sm font-medium text-white no-underline transition-colors duration-150 hover:bg-blue-700" data-cta>Get API Key</a>
          </>
        )}
      </nav>
    </header>
  )
}
