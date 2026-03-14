import { Link } from '@tanstack/react-router'
import clsx from 'clsx'
import Cookies from 'js-cookie'
import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import TerminalBlock from '../TerminalBlock'

// --- Style constants (shared with landing page) ---

const FONT_HEADING: React.CSSProperties = { fontFamily: "'Space Grotesk', sans-serif" }
const GLOW_GREEN: React.CSSProperties = { textShadow: '0 0 10px #00FF88, 0 0 40px #00FF8844' }
const HEADING_GREEN: React.CSSProperties = { ...FONT_HEADING, ...GLOW_GREEN }

const NEON_LINK =
  'cursor-pointer border-b border-[#00FF8844] text-[#00FF88] no-underline hover:border-[#00FF88]'

// --- Tab constants ---

const PM_TABS = ['npm', 'bun', 'pnpm', 'yarn'] as const

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
      {tabs.map(tab => (
        <button
          key={tab}
          type="button"
          onClick={() => onTabChange(tab)}
          style={FONT_HEADING}
          className={clsx(
            'cursor-pointer border-x-0 border-t-0 border-b-2 px-3 py-1 text-xs font-semibold transition-all duration-150',
            activeTab === tab
              ? 'border-b-[#00FF88] bg-[#00FF8818] text-[#00FF88]'
              : 'border-b-transparent bg-transparent text-slate-500'
          )}>
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
    <TerminalBlock
      header={<TabBar tabs={PM_TABS} activeTab={activeTab} onTabChange={onTabChange} />}>
      <span className="text-slate-500">$</span> {commands[activeTab]}
    </TerminalBlock>
  )
}

function CopyKeyButton({ apiKey }: { apiKey: string }) {
  const handleCopy = useCallback(() => {
    navigator.clipboard?.writeText(apiKey)
    toast('Copied!')
  }, [apiKey])

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="cursor-default rounded border border-[#00FF8844] bg-transparent px-2 py-1 text-xs text-[#00FF88] transition-colors hover:bg-[#00FF8818]">
      Copy
    </button>
  )
}

// --- Main component ---

interface QuickStartStepsProps {
  apiKey?: string
}

export default function QuickStartSteps({ apiKey }: QuickStartStepsProps) {
  const [pmTab, setPmTab] = useState(() => Cookies.get('meet-ai-pm') || 'npm')

  const handlePmChange = (tab: string) => {
    setPmTab(tab)
    Cookies.set('meet-ai-pm', tab, { expires: 365, sameSite: 'lax' })
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Step 1 — Install CLI */}
      <div>
        <p className="mb-3 flex items-center gap-3">
          <span style={HEADING_GREEN} className="text-[28px] leading-none font-bold text-[#00FF88]">
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

      {/* Step 2 — Setup hooks */}
      <div>
        <p className="mb-2 flex items-center gap-3">
          <span style={HEADING_GREEN} className="text-[28px] leading-none font-bold text-[#00FF88]">
            02
          </span>
          <span style={FONT_HEADING} className="text-base font-semibold text-slate-200">
            Setup hooks for Claude Code
          </span>
        </p>
        <p className="mb-3 text-sm text-slate-500">
          Registers Claude Code hooks for plan review, permission review, question review, and tool
          activity logging.
        </p>
        <TerminalBlock>
          <span className="text-slate-500">$</span> <span className="text-[#FF0080]">meet-ai</span>{' '}
          setup-hooks
        </TerminalBlock>
      </div>

      {/* Step 3 — Sign in */}
      <div>
        <p className="mb-2 flex items-center gap-3">
          <span style={HEADING_GREEN} className="text-[28px] leading-none font-bold text-[#00FF88]">
            03
          </span>
          <span style={FONT_HEADING} className="text-base font-semibold text-slate-200">
            Sign in
          </span>
        </p>
        <p className="mb-3 text-sm text-slate-500">
          Run{' '}
          <code className="rounded bg-[#00D4FF11] px-1.5 py-px font-mono text-[13px] text-[#00D4FF]">
            meet-ai
          </code>{' '}
          in your terminal{apiKey ? ', then paste this key when prompted' : ' and follow the sign-in prompts'}.
        </p>
        {apiKey && (
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-[#00FF8833] bg-[#00FF8808] px-4 py-2.5">
            <code className="flex-1 font-mono text-sm text-[#00FF88]">{apiKey}</code>
            <CopyKeyButton apiKey={apiKey} />
          </div>
        )}
        <TerminalBlock>
          <span className="text-slate-500">$</span> <span className="text-[#FF0080]">meet-ai</span>
        </TerminalBlock>
      </div>

      {/* Step 4 — Create a room */}
      <div>
        <p className="mb-2 flex items-center gap-3">
          <span style={HEADING_GREEN} className="text-[28px] leading-none font-bold text-[#00FF88]">
            04
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
    </div>
  )
}
