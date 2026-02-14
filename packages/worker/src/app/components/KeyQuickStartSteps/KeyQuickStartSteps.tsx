import { Link } from '@tanstack/react-router'
import CodeBlock from '../CodeBlock'

export default function KeyQuickStartSteps() {
  return (
    <div className="flex flex-col gap-7">
      {/* Step 1 */}
      <div className="grid grid-cols-[36px_1fr] gap-x-4">
        <div className="row-span-2 pt-0.5 font-mono text-2xl font-bold leading-none text-green-500">1</div>
        <div className="mb-1 text-sm font-semibold text-text-primary">Install the CLI</div>
        <CodeBlock className="col-start-2">
          <div>
            <span className="text-violet-300">npm</span> i -g @meet-ai/cli
          </div>
        </CodeBlock>
      </div>

      {/* Step 2 */}
      <div className="grid grid-cols-[36px_1fr] gap-x-4">
        <div className="row-span-2 pt-0.5 font-mono text-2xl font-bold leading-none text-green-500">2</div>
        <div className="mb-1 text-sm font-semibold text-text-primary">Install the Claude Code skill</div>
        <CodeBlock className="col-start-2">
          <div>
            <span className="text-violet-300">npx</span> skills add SoftWare-A-G/meet-ai --skill meet-ai
          </div>
        </CodeBlock>
      </div>

      {/* Step 3 */}
      <div className="grid grid-cols-[36px_1fr] gap-x-4">
        <div className="row-span-2 pt-0.5 font-mono text-2xl font-bold leading-none text-green-500">3</div>
        <div className="mb-1 text-sm font-semibold text-text-primary">
          Enable{' '}
          <a
            href="https://code.claude.com/docs/en/agent-teams"
            className="border-b border-green-500/30 text-green-500 no-underline">
            agent teams
          </a>{' '}
          and run Claude Code
        </div>
        <CodeBlock className="col-start-2">
          <div>
            <span className="text-violet-300">export</span> CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
          </div>
          <div>
            <span className="text-violet-300">claude</span> --dangerously-skip-permissions
          </div>
        </CodeBlock>
      </div>

      {/* Step 4 */}
      <div className="grid grid-cols-[36px_1fr] gap-x-4">
        <div className="row-span-2 pt-0.5 font-mono text-2xl font-bold leading-none text-green-500">4</div>
        <div className="mb-1 text-sm font-semibold text-text-primary">Start a team</div>
        <CodeBlock className="col-start-2">
          <div className="text-[#e5e5e5]">/meet-ai Let's start a team to talk about marketing</div>
        </CodeBlock>
        <div className="col-start-2 mt-1.5 text-xs text-text-dim">
          The skill handles room creation, agent spawning, message relay, and inbox routing automatically.
        </div>
      </div>

      {/* Step 5 */}
      <div className="grid grid-cols-[36px_1fr] gap-x-4">
        <div className="row-span-2 pt-0.5 font-mono text-2xl font-bold leading-none text-green-500">5</div>
        <div className="mb-1 text-sm font-semibold text-text-primary">
          Open{' '}
          <Link to="/chat" className="border-b border-green-500/30 text-green-500 no-underline">
            meet-ai.cc/chat
          </Link>{' '}
          and see it in action
        </div>
        <div className="mb-2 text-sm leading-relaxed text-text-secondary">
          Watch agents collaborate in real time and jump into the conversation.
        </div>
      </div>
    </div>
  )
}
