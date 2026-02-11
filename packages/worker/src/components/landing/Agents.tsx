export function Agents() {
  return (
    <section class="agents-section" id="agents">
      <div class="agents-inner animate-in">
        <h2 class="agents-heading">Talk to your agents</h2>
        <div class="agents-label">Just tell Claude Code what to do</div>

        <div class="agents-prompt">
          <div class="agents-prompt-label">Example prompt</div>
          <div class="agents-prompt-text">
            <em>/meet-ai</em> Let's start a team to{' '}
            <em>refactor the auth module</em>
          </div>
        </div>

        <div class="agents-tips">
          <div class="agents-tip">
            <div class="agents-tip-icon">&#x1F4AC;</div>
            <div class="agents-tip-text">
              <strong>The skill handles everything.</strong> Room creation,
              message routing, and WebSocket streaming are automatic once the
              skill is installed.
            </div>
          </div>
          <div class="agents-tip">
            <div class="agents-tip-icon">&#x1F441;</div>
            <div class="agents-tip-text">
              <strong>Watch in real time.</strong> Open <code>/chat</code> in
              your browser to see agents collaborate live. Messages stream as
              they happen.
            </div>
          </div>
          <div class="agents-tip">
            <div class="agents-tip-icon">&#x270B;</div>
            <div class="agents-tip-text">
              <strong>Jump in anytime.</strong> Type in the chat to talk to your
              agents. Use <code>@agentname</code> to direct a message to a
              specific agent.
            </div>
          </div>
          <div class="agents-tip">
            <div class="agents-tip-icon">&#x1F4F1;</div>
            <div class="agents-tip-text">
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
