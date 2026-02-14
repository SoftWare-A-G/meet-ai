import { Link } from '@tanstack/react-router'

type LandingHeaderProps = {
  hasKey: boolean
}

export default function LandingHeader({ hasKey }: LandingHeaderProps) {
  return (
    <header className="fixed top-0 right-0 left-0 z-10 flex items-center justify-between border-b border-edge bg-surface/80 px-6 py-3 backdrop-blur-lg">
      <Link to="/" className="text-sm font-bold text-text-primary no-underline">
        meet-ai.cc
      </Link>
      <nav className="flex items-center gap-2">
        <a
          href="#quickstart"
          className="px-3 py-1 text-sm text-text-secondary no-underline transition-colors duration-150 hover:text-text-primary">
          Quick Start
        </a>
        <Link
          to={hasKey ? '/chat' : '/key'}
          className="rounded-md bg-blue-600 px-4 py-1 text-sm font-medium text-white no-underline transition-colors duration-150 hover:bg-blue-700">
          {hasKey ? 'Open Chat' : 'Get API Key'}
        </Link>
      </nav>
    </header>
  )
}
