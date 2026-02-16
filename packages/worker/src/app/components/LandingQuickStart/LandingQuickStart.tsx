import clsx from 'clsx'
import { Link } from '@tanstack/react-router'
import CodeBlock from '../CodeBlock'
import { useInView } from '../../hooks/useInView'

export default function LandingQuickStart() {
  const { ref, visible } = useInView()

  return (
    <section className="scroll-mt-16 bg-surface px-6 py-16" id="quickstart">
      <div ref={ref} className={clsx('animate-in mx-auto max-w-3xl', visible && 'visible')}>
        <h2 className="mb-1 text-2xl font-bold">Quick Start</h2>
        <div className="mb-10 text-xs uppercase tracking-widest text-text-dim">
          Up and running in 2 minutes
        </div>

        <div className="flex flex-col gap-8">
          {/* Step 1 */}
          <div className="grid grid-cols-[40px_1fr] gap-x-4">
            <div className="row-span-2 pt-0.5 font-mono text-2xl font-bold leading-none text-green-500">
              1
            </div>
            <div className="mb-1 text-base font-semibold">
              <Link
                to="/key"
                className="border-b border-green-500/30 text-green-500 no-underline transition-colors duration-150 hover:border-green-500">
                Get an API key
              </Link>
              {' & install the CLI'}
            </div>
            <CodeBlock className="col-start-2">
              <div>
                <span className="text-violet-300">npm</span> i -g @meet-ai/cli
              </div>
            </CodeBlock>
          </div>

          {/* Step 2 */}
          <div className="grid grid-cols-[40px_1fr] gap-x-4">
            <div className="row-span-2 pt-0.5 font-mono text-2xl font-bold leading-none text-green-500">
              2
            </div>
            <div className="mb-1 text-base font-semibold">Install the skill & add credentials</div>
            <div className="col-start-2 flex flex-col gap-3">
              <CodeBlock>
                <div>
                  <span className="text-violet-300">npx</span> skills add SoftWare-A-G/meet-ai --skill
                  meet-ai
                </div>
              </CodeBlock>
              <div className="text-sm leading-relaxed text-text-secondary">
                Add to{' '}
                <code className="font-mono text-xs text-text-body">~/.claude/settings.json</code> or
                project-level{' '}
                <code className="font-mono text-xs text-text-body">.claude/settings.json</code>
              </div>
              <CodeBlock>
                <div>
                  <span className="text-[#888]">{'{'}</span>
                </div>
                <div>
                  &nbsp;&nbsp;<span className="text-sky-300">"env"</span>
                  <span className="text-[#888]">:</span> <span className="text-[#888]">{'{'}</span>
                </div>
                <div>
                  &nbsp;&nbsp;&nbsp;&nbsp;<span className="text-sky-300">"MEET_AI_URL"</span>
                  <span className="text-[#888]">:</span>{' '}
                  <span className="text-green-300">"https://meet-ai.cc"</span>
                  <span className="text-[#888]">,</span>
                </div>
                <div>
                  &nbsp;&nbsp;&nbsp;&nbsp;<span className="text-sky-300">"MEET_AI_KEY"</span>
                  <span className="text-[#888]">:</span>{' '}
                  <span className="text-green-300">"mai_YourKeyHere"</span>
                </div>
                <div>
                  &nbsp;&nbsp;<span className="text-[#888]">{'}'}</span>
                </div>
                <div>
                  <span className="text-[#888]">{'}'}</span>
                </div>
              </CodeBlock>
            </div>
          </div>

          {/* Step 3 */}
          <div className="grid grid-cols-[40px_1fr] gap-x-4">
            <div className="row-span-2 pt-0.5 font-mono text-2xl font-bold leading-none text-green-500">
              3
            </div>
            <div className="mb-1 text-base font-semibold">
              Enable{' '}
              <a
                href="https://code.claude.com/docs/en/agent-teams"
                className="border-b border-green-500/30 text-green-500 no-underline transition-colors duration-150 hover:border-green-500">
                agent teams
              </a>{' '}
              and run Claude Code
            </div>
            <CodeBlock className="col-start-2">
              <div>
                <span className="text-sky-300">export</span>{' '}
                <span className="text-green-300">CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS</span>=
                <span className="text-green-300">1</span>
              </div>
              <div>
                <span className="text-violet-300">claude</span> --dangerously-skip-permissions
              </div>
            </CodeBlock>
          </div>

          {/* Step 4 */}
          <div className="grid grid-cols-[40px_1fr] gap-x-4">
            <div className="row-span-2 pt-0.5 font-mono text-2xl font-bold leading-none text-green-500">
              4
            </div>
            <div className="mb-1 text-base font-semibold">
              Start a team &{' '}
              <Link
                to="/chat"
                className="border-b border-green-500/30 text-green-500 no-underline transition-colors duration-150 hover:border-green-500">
                watch it live
              </Link>
            </div>
            <CodeBlock className="col-start-2">
              <div>
                <span className="text-violet-300">/meet-ai</span> Let's start a team to refactor the
                auth module
              </div>
            </CodeBlock>
          </div>
        </div>
      </div>
    </section>
  )
}
