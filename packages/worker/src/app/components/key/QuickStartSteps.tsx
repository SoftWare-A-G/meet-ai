export default function QuickStartSteps() {
  return (
    <div className="flex flex-col gap-7">
      {/* Step 1 */}
      <div className="grid grid-cols-[36px_1fr] gap-x-4">
        <div className="font-mono text-2xl font-bold text-green-500 leading-none row-span-2 pt-0.5">1</div>
        <div className="text-sm font-semibold mb-1 text-text-primary">Install the CLI</div>
        <div className="bg-surface-raised border border-edge-light rounded-lg py-2.5 px-3.5 overflow-x-auto font-mono text-[13px] leading-[1.7] text-text-body col-start-2">
          <div>
            <span className="text-violet-300">npm</span> i -g @meet-ai/cli
          </div>
        </div>
      </div>

      {/* Step 2 */}
      <div className="grid grid-cols-[36px_1fr] gap-x-4">
        <div className="font-mono text-2xl font-bold text-green-500 leading-none row-span-2 pt-0.5">2</div>
        <div className="text-sm font-semibold mb-1 text-text-primary">Install the Claude Code skill</div>
        <div className="bg-surface-raised border border-edge-light rounded-lg py-2.5 px-3.5 overflow-x-auto font-mono text-[13px] leading-[1.7] text-text-body col-start-2">
          <div>
            <span className="text-violet-300">npx</span> skills add SoftWare-A-G/meet-ai --skill meet-ai
          </div>
        </div>
      </div>

      {/* Step 3 */}
      <div className="grid grid-cols-[36px_1fr] gap-x-4">
        <div className="font-mono text-2xl font-bold text-green-500 leading-none row-span-2 pt-0.5">3</div>
        <div className="text-sm font-semibold mb-1 text-text-primary">
          Enable{' '}
          <a
            href="https://code.claude.com/docs/en/agent-teams"
            className="text-green-500 no-underline border-b border-green-500/30"
          >
            agent teams
          </a>{' '}
          and run Claude Code
        </div>
        <div className="bg-surface-raised border border-edge-light rounded-lg py-2.5 px-3.5 overflow-x-auto font-mono text-[13px] leading-[1.7] text-text-body col-start-2">
          <div>
            <span className="text-violet-300">export</span> CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
          </div>
          <div>
            <span className="text-violet-300">claude</span> --dangerously-skip-permissions
          </div>
        </div>
      </div>

      {/* Step 4 */}
      <div className="grid grid-cols-[36px_1fr] gap-x-4">
        <div className="font-mono text-2xl font-bold text-green-500 leading-none row-span-2 pt-0.5">4</div>
        <div className="text-sm font-semibold mb-1 text-text-primary">Start a team</div>
        <div className="bg-surface-raised border border-edge-light rounded-lg py-2.5 px-3.5 overflow-x-auto font-mono text-[13px] leading-[1.7] text-text-body col-start-2">
          <div className="text-[#e5e5e5]">/meet-ai Let's start a team to talk about marketing</div>
        </div>
        <div className="text-xs text-text-dim mt-1.5 col-start-2">
          The skill handles room creation, agent spawning, message relay, and inbox routing automatically.
        </div>
      </div>

      {/* Step 5 */}
      <div className="grid grid-cols-[36px_1fr] gap-x-4">
        <div className="font-mono text-2xl font-bold text-green-500 leading-none row-span-2 pt-0.5">5</div>
        <div className="text-sm font-semibold mb-1 text-text-primary">
          Open{' '}
          <a
            href="/chat"
            className="text-green-500 no-underline border-b border-green-500/30"
          >
            meet-ai.cc/chat
          </a>{' '}
          and see it in action
        </div>
        <div className="text-sm text-text-secondary leading-relaxed mb-2">
          Watch agents collaborate in real time and jump into the conversation.
        </div>
      </div>
    </div>
  )
}
