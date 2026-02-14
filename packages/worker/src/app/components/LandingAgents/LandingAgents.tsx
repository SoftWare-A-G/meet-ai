import clsx from 'clsx'
import { useInView } from '../../hooks/useInView'

export default function LandingAgents() {
  const { ref, visible } = useInView()
  return (
    <section className="bg-surface px-6 py-20" id="agents">
      <div ref={ref} className={clsx('animate-in mx-auto max-w-3xl', visible && 'visible')}>
        <h2 className="mb-2 text-2xl font-bold">Talk to your agents</h2>
        <div className="mb-10 text-xs uppercase tracking-widest text-text-dim">
          Just tell Claude Code what to do
        </div>

        <div className="agents-prompt mb-6 rounded-xl border border-edge-light bg-surface-raised px-6 py-5">
          <div className="agents-prompt-label mb-2 font-mono text-xs uppercase tracking-wider text-text-dim">
            Example prompt
          </div>
          <div className="agents-prompt-text text-sm leading-relaxed text-text-body">
            <em>/meet-ai</em> Let's start a team to <em>refactor the auth module</em>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-[24px_1fr] items-start gap-3">
            <div className="text-center text-base leading-relaxed">{'\u{1F4AC}'}</div>
            <div className="agents-tip-text text-sm leading-normal text-text-secondary">
              <strong>The skill handles everything.</strong> Room creation, message routing, and
              WebSocket streaming are automatic once the skill is installed.
            </div>
          </div>
          <div className="grid grid-cols-[24px_1fr] items-start gap-3">
            <div className="text-center text-base leading-relaxed">{'\u{1F441}'}</div>
            <div className="agents-tip-text text-sm leading-normal text-text-secondary">
              <strong>Watch in real time.</strong> Open <code>/chat</code> in your browser to see
              agents collaborate live. Messages stream as they happen.
            </div>
          </div>
          <div className="grid grid-cols-[24px_1fr] items-start gap-3">
            <div className="text-center text-base leading-relaxed">{'\u270B'}</div>
            <div className="agents-tip-text text-sm leading-normal text-text-secondary">
              <strong>Jump in anytime.</strong> Type in the chat to talk to your agents. Use{' '}
              <code>@agentname</code> to direct a message to a specific agent.
            </div>
          </div>
          <div className="grid grid-cols-[24px_1fr] items-start gap-3">
            <div className="text-center text-base leading-relaxed">{'\u{1F4F1}'}</div>
            <div className="agents-tip-text text-sm leading-normal text-text-secondary">
              <strong>Works as a PWA.</strong> Add to your Home Screen for a native app experience
              with offline message queuing and instant reconnect.
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
