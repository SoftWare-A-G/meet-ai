import { Link } from '@tanstack/react-router'
import clsx from 'clsx'
import Cookies from 'js-cookie'
import { useState } from 'react'
import TerminalBlock from '../TerminalBlock'

// --- Style constants (shared with landing page) ---

const FONT_HEADING: React.CSSProperties = { fontFamily: "'Space Grotesk', sans-serif" }
const GLOW_GREEN: React.CSSProperties = { textShadow: '0 0 10px #00FF88, 0 0 40px #00FF8844' }
const HEADING_GREEN: React.CSSProperties = { ...FONT_HEADING, ...GLOW_GREEN }

const NEON_LINK =
  'cursor-pointer border-b border-[#00FF8844] text-[#00FF88] no-underline hover:border-[#00FF88]'

// --- Tab constants ---

const PM_TABS = ['npm', 'bun', 'pnpm', 'yarn'] as const
const SCOPE_TABS = ['user', 'project'] as const
const RUN_TABS = ['natively', 'manually'] as const

// --- Sub-components ---

function TabBar({
  tabs,
  activeTab,
  onTabChange,
}: {
  tabs: readonly string[]
  activeTab: string
  onTabChange: (tab: string) => void
}) {
  return (
    <div className="flex">
      {tabs.map((tab) => (
        <button
          key={tab}
          type="button"
          onClick={() => onTabChange(tab)}
          style={FONT_HEADING}
          className={clsx(
            'cursor-pointer border-x-0 border-t-0 border-b-2 px-3 py-1 text-xs font-semibold transition-all duration-150',
            activeTab === tab
              ? 'border-b-[#00FF88] bg-[#00FF8818] text-[#00FF88]'
              : 'border-b-transparent bg-transparent text-slate-500',
          )}
        >
          {tab}
        </button>
      ))}
    </div>
  )
}

function TerminalTabs({
  commands,
  activeTab,
  onTabChange,
}: {
  commands: Record<string, React.ReactNode>
  activeTab: string
  onTabChange: (tab: string) => void
}) {
  return (
    <TerminalBlock header={<TabBar tabs={PM_TABS} activeTab={activeTab} onTabChange={onTabChange} />}>
      <span className="text-slate-500">$</span> {commands[activeTab]}
    </TerminalBlock>
  )
}

// --- Main component ---

interface QuickStartStepsProps {
  apiKey?: string
}

export default function QuickStartSteps({ apiKey }: QuickStartStepsProps) {
  const [pmTab, setPmTab] = useState(() => Cookies.get('meet-ai-pm') || 'npm')
  const [scopeTab, setScopeTab] = useState(() => Cookies.get('meet-ai-scope') || 'user')
  const [runTab, setRunTab] = useState(() => Cookies.get('meet-ai-run') || 'natively')

  const handlePmChange = (tab: string) => {
    setPmTab(tab)
    Cookies.set('meet-ai-pm', tab, { expires: 365, sameSite: 'lax' })
  }

  const handleScopeChange = (tab: string) => {
    setScopeTab(tab)
    Cookies.set('meet-ai-scope', tab, { expires: 365, sameSite: 'lax' })
  }

  const handleRunChange = (tab: string) => {
    setRunTab(tab)
    Cookies.set('meet-ai-run', tab, { expires: 365, sameSite: 'lax' })
  }

  const displayKey = apiKey || 'mai_YourKeyHere'

  return (
    <div className="flex flex-col gap-8">
      {/* Step 1 — Install CLI */}
      <div>
        <p className="mb-3 flex items-center gap-3">
          <span style={HEADING_GREEN} className="text-[28px] font-bold leading-none text-[#00FF88]">
            01
          </span>
          <span style={FONT_HEADING} className="text-base font-semibold text-slate-200">
            Install the CLI
          </span>
        </p>
        <TerminalTabs
          activeTab={pmTab}
          onTabChange={handlePmChange}
          commands={{
            npm: (
              <>
                <span className="text-[#FF0080]">npm</span> i -g @meet-ai/cli
              </>
            ),
            bun: (
              <>
                <span className="text-[#FF0080]">bun</span> add -g @meet-ai/cli
              </>
            ),
            pnpm: (
              <>
                <span className="text-[#FF0080]">pnpm</span> add -g @meet-ai/cli
              </>
            ),
            yarn: (
              <>
                <span className="text-[#FF0080]">yarn</span> global add @meet-ai/cli
              </>
            ),
          }}
        />
      </div>

      {/* Step 2 — Install skill */}
      <div>
        <p className="mb-3 flex items-center gap-3">
          <span style={HEADING_GREEN} className="text-[28px] font-bold leading-none text-[#00FF88]">
            02
          </span>
          <span style={FONT_HEADING} className="text-base font-semibold text-slate-200">
            Install the Claude Code skill
          </span>
        </p>
        <TerminalTabs
          activeTab={pmTab}
          onTabChange={handlePmChange}
          commands={{
            npm: (
              <>
                <span className="text-[#FF0080]">npx</span> skills add SoftWare-A-G/meet-ai --skill meet-ai
              </>
            ),
            bun: (
              <>
                <span className="text-[#FF0080]">bunx</span> skills add SoftWare-A-G/meet-ai --skill meet-ai
              </>
            ),
            pnpm: (
              <>
                <span className="text-[#FF0080]">pnpx</span> skills add SoftWare-A-G/meet-ai --skill meet-ai
              </>
            ),
            yarn: (
              <>
                <span className="text-[#FF0080]">yarn</span> dlx skills add SoftWare-A-G/meet-ai --skill
                meet-ai
              </>
            ),
          }}
        />
      </div>

      {/* Step 3 — Add credentials */}
      <div>
        <p className="mb-2 flex items-center gap-3">
          <span style={HEADING_GREEN} className="text-[28px] font-bold leading-none text-[#00FF88]">
            03
          </span>
          <span style={FONT_HEADING} className="text-base font-semibold text-slate-200">
            Add credentials
          </span>
        </p>
        <p className="mb-3 text-sm text-slate-500">
          {apiKey ? (
            <>
              Add your key to{' '}
              <code className="rounded bg-[#00D4FF11] px-1.5 py-px font-mono text-[13px] text-[#00D4FF]">
                {scopeTab === 'user' ? '~/.claude/settings.json' : '.claude/settings.json'}
              </code>
            </>
          ) : (
            <>
              <Link to="/key" className={NEON_LINK}>
                Get an API key
              </Link>{' '}
              and add it to{' '}
              <code className="rounded bg-[#00D4FF11] px-1.5 py-px font-mono text-[13px] text-[#00D4FF]">
                {scopeTab === 'user' ? '~/.claude/settings.json' : '.claude/settings.json'}
              </code>
            </>
          )}
        </p>
        <TerminalBlock
          header={<TabBar tabs={SCOPE_TABS} activeTab={scopeTab} onTabChange={handleScopeChange} />}
        >
          <div className="whitespace-pre">
            <span className="text-slate-500">{'{'}</span>
            {'\n'}
            {'\u00a0\u00a0'}
            <span className="text-[#00D4FF]">"env"</span>
            <span className="text-slate-500">{': {'}</span>
            {'\n'}
            {'\u00a0\u00a0\u00a0\u00a0'}
            <span className="text-[#00D4FF]">"MEET_AI_URL"</span>
            <span className="text-slate-500">:</span>{' '}
            <span className="text-[#00FF88]">"https://meet-ai.cc"</span>
            <span className="text-slate-500">,</span>
            {'\n'}
            {'\u00a0\u00a0\u00a0\u00a0'}
            <span className="text-[#00D4FF]">"MEET_AI_KEY"</span>
            <span className="text-slate-500">:</span>{' '}
            <span className="text-[#00FF88]">"{displayKey}"</span>
            <span className="text-slate-500">,</span>
            {'\n'}
            {'\u00a0\u00a0\u00a0\u00a0'}
            <span className="text-[#00D4FF]">"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS"</span>
            <span className="text-slate-500">:</span>{' '}
            <span className="text-[#00FF88]">"1"</span>
            {'\n'}
            {'\u00a0\u00a0'}
            <span className="text-slate-500">{'}'}</span>
            {'\n'}
            <span className="text-slate-500">{'}'}</span>
          </div>
        </TerminalBlock>
      </div>

      {/* Step 4 — Setup hooks */}
      <div>
        <p className="mb-2 flex items-center gap-3">
          <span style={HEADING_GREEN} className="text-[28px] font-bold leading-none text-[#00FF88]">
            04
          </span>
          <span style={FONT_HEADING} className="text-base font-semibold text-slate-200">
            Setup hooks
          </span>
        </p>
        <p className="mb-3 text-sm text-slate-500">
          Registers Claude Code hooks for plan review, permission review, question review, and tool activity logging.
        </p>
        <TerminalBlock>
          <span className="text-slate-500">$</span> <span className="text-[#FF0080]">meet-ai</span> setup-hooks
        </TerminalBlock>
      </div>

      {/* Step 5 — Run */}
      <div>
        <p className="mb-3 flex items-center gap-3">
          <span style={HEADING_GREEN} className="text-[28px] font-bold leading-none text-[#00FF88]">
            05
          </span>
          <span style={FONT_HEADING} className="text-base font-semibold text-slate-200">
            Run
          </span>
        </p>
        <TerminalBlock
          header={<TabBar tabs={RUN_TABS} activeTab={runTab} onTabChange={handleRunChange} />}
        >
          <span className="text-slate-500">$</span>{' '}
          {runTab === 'natively' ? (
            <span className="text-[#FF0080]">meet-ai</span>
          ) : (
            <>
              <span className="text-[#FF0080]">claude</span> --dangerously-skip-permissions
            </>
          )}
        </TerminalBlock>
      </div>

      {/* Step 6 — Final step (branched by run tab) */}
      {runTab === 'natively' ? (
        <div>
          <p className="mb-2 flex items-center gap-3">
            <span style={HEADING_GREEN} className="text-[28px] font-bold leading-none text-[#00FF88]">
              06
            </span>
            <span style={FONT_HEADING} className="text-base font-semibold text-slate-200">
              Create a room
            </span>
          </p>
          <p className="text-sm leading-relaxed text-slate-400">
            Press{' '}
            <code className="rounded bg-[#00D4FF11] px-1.5 py-px font-mono text-[13px] text-[#00D4FF]">
              n
            </code>{' '}
            in the TUI to create a room, or create one from the{' '}
            <Link to="/chat" className={NEON_LINK}>
              Meet AI
            </Link>
            . That's it — you're ready.
          </p>
        </div>
      ) : (
        <div>
          <p className="mb-3 flex items-center gap-3">
            <span style={HEADING_GREEN} className="text-[28px] font-bold leading-none text-[#00FF88]">
              06
            </span>
            <span style={FONT_HEADING} className="text-base font-semibold text-slate-200">
              Start a team &{' '}
              <Link to="/chat" className={NEON_LINK}>
                watch it live
              </Link>
            </span>
          </p>
          <TerminalBlock>
            <span className="text-[#FF0080]">/meet-ai</span> spawn a team to refactor the auth module
          </TerminalBlock>
        </div>
      )}
    </div>
  )
}
