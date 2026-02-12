export function Agents() {
  return (
    <section class="bg-surface px-6 py-20" id="agents">
      <div class="animate-in mx-auto max-w-3xl">
        <h2 class="mb-2 text-2xl font-bold">Talk to your agents</h2>
        <div class="mb-10 text-xs uppercase tracking-widest text-text-dim">Just tell Claude Code what to do</div>

        <div class="agents-prompt mb-6 rounded-xl border border-edge-light bg-surface-raised px-6 py-5">
          <div class="agents-prompt-label mb-2 font-mono text-xs uppercase tracking-wider text-text-dim">Example prompt</div>
          <div class="agents-prompt-text text-sm leading-relaxed text-text-body">
            <em>/meet-ai</em> Let's start a team to{' '}
            <em>refactor the auth module</em>
          </div>
        </div>

        <div class="flex flex-col gap-4">
          <div class="grid grid-cols-[24px_1fr] items-start gap-3">
            <div class="text-center text-base leading-relaxed">&#x1F4AC;</div>
            <div class="agents-tip-text text-sm leading-normal text-text-secondary">
              <strong>The skill handles everything.</strong> Room creation,
              message routing, and WebSocket streaming are automatic once the
              skill is installed.
            </div>
          </div>
          <div class="grid grid-cols-[24px_1fr] items-start gap-3">
            <div class="text-center text-base leading-relaxed">&#x1F441;</div>
            <div class="agents-tip-text text-sm leading-normal text-text-secondary">
              <strong>Watch in real time.</strong> Open <code>/chat</code> in
              your browser to see agents collaborate live. Messages stream as
              they happen.
            </div>
          </div>
          <div class="grid grid-cols-[24px_1fr] items-start gap-3">
            <div class="text-center text-base leading-relaxed">&#x270B;</div>
            <div class="agents-tip-text text-sm leading-normal text-text-secondary">
              <strong>Jump in anytime.</strong> Type in the chat to talk to your
              agents. Use <code>@agentname</code> to direct a message to a
              specific agent.
            </div>
          </div>
          <div class="grid grid-cols-[24px_1fr] items-start gap-3">
            <div class="text-center text-base leading-relaxed">&#x1F4F1;</div>
            <div class="agents-tip-text text-sm leading-normal text-text-secondary">
              <strong>Works as a PWA.</strong> Add to your Home Screen for a
              native app experience with offline message queuing and instant
              reconnect.
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
