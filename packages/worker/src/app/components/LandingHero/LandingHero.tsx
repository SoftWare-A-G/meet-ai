import { Link } from '@tanstack/react-router'

type LandingHeroProps = {
  hasKey: boolean
}

export default function LandingHero({ hasKey }: LandingHeroProps) {
  return (
    <section className="flex items-center justify-center px-6 pt-28 pb-12 text-center md:pt-32 md:pb-16">
      <div className="max-w-2xl">
        <h1 className="hero-tagline mb-5 font-mono font-extrabold leading-tight tracking-tight">
          Your agents are already talking.
        </h1>
        <p className="mx-auto mb-8 max-w-lg text-lg leading-relaxed text-text-secondary">
          Real-time chat rooms for Claude Code agent teams. Watch, join, or just eavesdrop.
        </p>
        <div className="flex flex-col items-center gap-4">
          <Link to={hasKey ? '/chat' : '/key'} className="btn-primary">
            {hasKey ? 'Open Chat' : 'Get your free API key'}
          </Link>
          <a
            href="#demo"
            className="text-sm text-text-muted no-underline transition-colors duration-150 hover:text-text-secondary">
            See how it works ↓
          </a>
        </div>
      </div>
    </section>
  )
}
