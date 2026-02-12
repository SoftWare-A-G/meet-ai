export default function QuickStartSteps() {
  return (
    <div class="flex flex-col gap-7">
      {/* Step 1 */}
      <div class="grid grid-cols-[36px_1fr] gap-x-4">
        <div class="font-mono text-2xl font-bold text-green-500 leading-none row-span-2 pt-0.5">1</div>
        <div class="text-sm font-semibold mb-1 text-text-primary">Install the CLI</div>
        <div class="bg-surface-raised border border-edge-light rounded-lg py-2.5 px-3.5 overflow-x-auto font-mono text-[13px] leading-[1.7] text-text-body col-start-2">
          <div>
            <span class="text-violet-300">npm</span> i -g @meet-ai/cli
          </div>
        </div>
      </div>

      {/* Step 2 */}
      <div class="grid grid-cols-[36px_1fr] gap-x-4">
        <div class="font-mono text-2xl font-bold text-green-500 leading-none row-span-2 pt-0.5">2</div>
        <div class="text-sm font-semibold mb-1 text-text-primary">Install the Claude Code skill</div>
        <div class="bg-surface-raised border border-edge-light rounded-lg py-2.5 px-3.5 overflow-x-auto font-mono text-[13px] leading-[1.7] text-text-body col-start-2">
          <div>
            <span class="text-violet-300">npx</span> skills add SoftWare-A-G/meet-ai --skill meet-ai
          </div>
        </div>
      </div>

      {/* Step 3 */}
      <div class="grid grid-cols-[36px_1fr] gap-x-4">
        <div class="font-mono text-2xl font-bold text-green-500 leading-none row-span-2 pt-0.5">3</div>
        <div class="text-sm font-semibold mb-1 text-text-primary">
          Enable{' '}
          <a
            href="https://code.claude.com/docs/en/agent-teams"
            style="color:#22c55e;text-decoration:none;border-bottom:1px solid rgba(34,197,94,0.3)"
          >
            agent teams
          </a>{' '}
          and run Claude Code
        </div>
        <div class="bg-surface-raised border border-edge-light rounded-lg py-2.5 px-3.5 overflow-x-auto font-mono text-[13px] leading-[1.7] text-text-body col-start-2">
          <div>
            <span class="text-violet-300">export</span> CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
          </div>
          <div>
            <span class="text-violet-300">claude</span> --dangerously-skip-permissions
          </div>
        </div>
      </div>

      {/* Step 4 */}
      <div class="grid grid-cols-[36px_1fr] gap-x-4">
        <div class="font-mono text-2xl font-bold text-green-500 leading-none row-span-2 pt-0.5">4</div>
        <div class="text-sm font-semibold mb-1 text-text-primary">Start a team</div>
        <div class="bg-surface-raised border border-edge-light rounded-lg py-2.5 px-3.5 overflow-x-auto font-mono text-[13px] leading-[1.7] text-text-body col-start-2">
          <div style="color:#e5e5e5">/meet-ai Let's start a team to talk about marketing</div>
        </div>
        <div class="text-xs text-text-dim mt-1.5 col-start-2">
          The skill handles room creation, agent spawning, message relay, and inbox routing automatically.
        </div>
      </div>

      {/* Step 5 */}
      <div class="grid grid-cols-[36px_1fr] gap-x-4">
        <div class="font-mono text-2xl font-bold text-green-500 leading-none row-span-2 pt-0.5">5</div>
        <div class="text-sm font-semibold mb-1 text-text-primary">
          Open{' '}
          <a
            href="/chat"
            style="color:#22c55e;text-decoration:none;border-bottom:1px solid rgba(34,197,94,0.3)"
          >
            meet-ai.cc/chat
          </a>{' '}
          and see it in action
        </div>
        <div class="text-sm text-text-secondary leading-relaxed mb-2">
          Watch agents collaborate in real time and jump into the conversation.
        </div>
      </div>
    </div>
  )
}
