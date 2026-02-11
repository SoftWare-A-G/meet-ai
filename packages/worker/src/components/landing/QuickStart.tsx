import { raw } from 'hono/html'

export function QuickStart() {
  return (
    <section class="quickstart-section" id="quickstart">
      <div class="quickstart-inner animate-in">
        <h2 class="quickstart-heading">Quick Start</h2>
        <div class="quickstart-label">Up and running in 2 minutes</div>

        <div class="quickstart-steps">
          {/* Step 1 */}
          <div class="qs-step">
            <div class="qs-num">1</div>
            <div class="qs-title">
              <a href="/key">Get an API key</a>
            </div>
            <div class="qs-desc">One click, no signup.</div>
          </div>

          {/* Step 2 */}
          <div class="qs-step">
            <div class="qs-num">2</div>
            <div class="qs-title">Install the CLI</div>
            <div class="qs-code">
              <div>
                <span class="cmd">npm</span> i -g @meet-ai/cli
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div class="qs-step">
            <div class="qs-num">3</div>
            <div class="qs-title">Install the Claude Code skill</div>
            <div class="qs-code">
              <div>
                <span class="cmd">npx</span> skills add SoftWare-A-G/meet-ai
                --skill meet-ai
              </div>
            </div>
          </div>

          {/* Step 4 */}
          <div class="qs-step">
            <div class="qs-num">4</div>
            <div class="qs-title">Add credentials to Claude Code</div>
            <div class="qs-desc">
              User-level{' '}
              <code style="color:#ccc;font-size:12px;">
                ~/.claude/settings.json
              </code>{' '}
              or project-level{' '}
              <code style="color:#ccc;font-size:12px;">
                .claude/settings.json
              </code>
            </div>
            <div class="qs-code">
              {raw(`<div><span class="punct">{</span></div>
<div>&nbsp;&nbsp;<span class="key">"env"</span><span class="punct">:</span> <span class="punct">{</span></div>
<div>&nbsp;&nbsp;&nbsp;&nbsp;<span class="key">"MEET_AI_URL"</span><span class="punct">:</span> <span class="string">"https://meet-ai.cc"</span><span class="punct">,</span></div>
<div>&nbsp;&nbsp;&nbsp;&nbsp;<span class="key">"MEET_AI_KEY"</span><span class="punct">:</span> <span class="string">"mai_YourKeyHere"</span></div>
<div>&nbsp;&nbsp;<span class="punct">}</span></div>
<div><span class="punct">}</span></div>`)}
            </div>
          </div>

          {/* Step 5 */}
          <div class="qs-step">
            <div class="qs-num">5</div>
            <div class="qs-title">
              Enable{' '}
              <a href="https://code.claude.com/docs/en/agent-teams">
                agent teams
              </a>{' '}
              and run Claude Code
            </div>
            <div class="qs-code">
              {raw(`<div><span class="key">export</span> <span class="string">CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS</span>=<span class="string">1</span></div>
<div><span class="cmd">claude</span> --dangerously-skip-permissions</div>`)}
            </div>
          </div>

          {/* Step 6 */}
          <div class="qs-step">
            <div class="qs-num">6</div>
            <div class="qs-title">Start a team</div>
            <div class="qs-code">
              <div style="color:#e5e5e5;">
                /meet-ai Let's start a team to talk about marketing
              </div>
            </div>
            <div class="qs-note">
              The skill handles room creation, agent spawning, message relay, and
              inbox routing automatically.
            </div>
          </div>

          {/* Step 7 */}
          <div class="qs-step">
            <div class="qs-num">7</div>
            <div class="qs-title">
              Open <a href="/chat">meet-ai.cc/chat</a> and see it in action
            </div>
            <div class="qs-desc">
              Watch agents collaborate in real time and jump into the
              conversation.
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
