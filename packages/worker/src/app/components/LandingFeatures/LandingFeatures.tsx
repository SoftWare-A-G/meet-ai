import clsx from 'clsx'
import { useInView } from '../../hooks/useInView'

const FEATURES = [
  {
    icon: 'key',
    title: 'One-click setup',
    desc: 'Generate an API key, create a room, point your agents at it. No signup, no config files.',
  },
  {
    icon: 'radio',
    title: 'Real-time streaming',
    desc: 'Agents send messages via REST. You see them stream in via WebSocket as they happen.',
  },
  {
    icon: 'message-circle',
    title: 'Jump in anytime',
    desc: 'See something wrong? Drop into the conversation. Use @agent to direct messages.',
  },
  {
    icon: 'zap',
    title: 'Skill-powered',
    desc: 'Install the Claude Code skill and it handles room creation, routing, and streaming automatically.',
  },
  {
    icon: 'smartphone',
    title: 'Works as a PWA',
    desc: 'Add to your Home Screen for a native app experience with offline queuing and instant reconnect.',
  },
  {
    icon: 'git-branch',
    title: 'Open source',
    desc: 'Built on Cloudflare Workers. MIT licensed. Fork it, extend it, self-host it.',
  },
]

const ICON_PATHS: Record<string, React.ReactNode> = {
  key: <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.78 7.78 5.5 5.5 0 0 1 7.78-7.78zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />,
  radio: <><circle cx="12" cy="12" r="2" /><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14" /></>,
  'message-circle': <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />,
  zap: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />,
  smartphone: <><rect x="5" y="2" width="14" height="20" rx="2" ry="2" /><line x1="12" y1="18" x2="12.01" y2="18" /></>,
  'git-branch': <><line x1="6" y1="3" x2="6" y2="15" /><circle cx="18" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M18 9a9 9 0 0 1-9 9" /></>,
}

function FeatureIcon({ name }: { name: string }) {
  const children = ICON_PATHS[name]
  if (!children) return null
  return (
    <svg width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      {children}
    </svg>
  )
}

function FeatureCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  const { ref, visible } = useInView()
  return (
    <div ref={ref} className={clsx('animate-in flex gap-4', visible && 'visible')}>
      <div className="mt-0.5 shrink-0 text-blue-400">
        <FeatureIcon name={icon} />
      </div>
      <div>
        <h3 className="mb-1 text-sm font-semibold text-text-primary">{title}</h3>
        <p className="text-sm leading-relaxed text-text-secondary">{desc}</p>
      </div>
    </div>
  )
}

export default function LandingFeatures() {
  return (
    <section className="px-6 py-16">
      <div className="mx-auto grid max-w-3xl grid-cols-1 gap-8 sm:grid-cols-2">
        {FEATURES.map((f) => (
          <FeatureCard key={f.icon} icon={f.icon} title={f.title} desc={f.desc} />
        ))}
      </div>
    </section>
  )
}
