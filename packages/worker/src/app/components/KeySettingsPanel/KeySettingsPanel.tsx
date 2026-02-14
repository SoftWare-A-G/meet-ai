import { useState, useCallback, type ReactNode } from 'react'
import { Tabs } from '@base-ui/react/tabs'
import clsx from 'clsx'

type Tab = 'user' | 'project' | 'env'

type TabConfig = {
  path: string
  hint: ReactNode
  cmd?: string
  hint2?: string
}

const TAB_DATA: Record<Tab, TabConfig> = {
  user: {
    path: '~/.claude/settings.json',
    hint: (
      <>
        Applies to <strong className="text-[#bbb]">all projects</strong>. Run this to create and open the file:
      </>
    ),
    cmd: 'mkdir -p ~/.claude && touch ~/.claude/settings.json && open ~/.claude/settings.json',
    hint2: 'Paste the JSON above into the file and save.',
  },
  project: {
    path: '.claude/settings.json',
    hint: (
      <>
        Applies to <strong className="text-[#bbb]">this project only</strong>. Run from your project root:
      </>
    ),
    cmd: 'mkdir -p .claude && touch .claude/settings.json && open .claude/settings.json',
    hint2: 'Paste the JSON above into the file and save.',
  },
  env: {
    path: '.env',
    hint: (
      <>
        Add to your <strong className="text-[#bbb]">project root</strong>. Bun and most frameworks load{' '}
        <code className="rounded bg-white/[0.08] px-1.5 py-px font-mono text-[11px] text-[#ccc]">.env</code>{' '}
        automatically.
      </>
    ),
  },
}

const TABS: { key: Tab; label: string }[] = [
  { key: 'user', label: 'User-level' },
  { key: 'project', label: 'Project-level' },
  { key: 'env', label: '.env' },
]

function JsonCode({ apiKey }: { apiKey: string }) {
  return (
    <>
      <span className="text-text-secondary">{'{'}</span>
      {'\n  '}
      <span className="text-sky-300">"env"</span>
      <span className="text-text-secondary">:</span>{' '}
      <span className="text-text-secondary">{'{'}</span>
      {'\n    '}
      <span className="text-sky-300">"MEET_AI_URL"</span>
      <span className="text-text-secondary">:</span>{' '}
      <span className="text-green-300">"https://meet-ai.cc"</span>
      <span className="text-text-secondary">,</span>
      {'\n    '}
      <span className="text-sky-300">"MEET_AI_KEY"</span>
      <span className="text-text-secondary">:</span>{' '}
      <span className="text-green-300">"{apiKey}"</span>
      {'\n  '}
      <span className="text-text-secondary">{'}'}</span>
      {'\n'}
      <span className="text-text-secondary">{'}'}</span>
    </>
  )
}

function EnvCode({ apiKey }: { apiKey: string }) {
  return (
    <>
      <span className="text-sky-300">MEET_AI_URL</span>
      <span className="text-text-secondary">=</span>
      <span className="text-green-300">https://meet-ai.cc</span>
      {'\n'}
      <span className="text-sky-300">MEET_AI_KEY</span>
      <span className="text-text-secondary">=</span>
      <span className="text-green-300">{apiKey}</span>
    </>
  )
}

function TabPanel({ tabKey, apiKey, cmdCopied, blockCopied, onCmdCopy, onBlockCopy }: { tabKey: Tab; apiKey: string; cmdCopied: boolean; blockCopied: boolean; onCmdCopy: () => void; onBlockCopy: () => void }) {
  const config = TAB_DATA[tabKey]
  return (
    <Tabs.Panel value={tabKey} className="group/settings relative rounded-[0_0.5rem_0.5rem_0.5rem] border border-edge-light bg-edge p-4 transition-[border-color] duration-150 hover:border-edge-hover">
      <div className="mb-1.5 font-mono text-[11px] text-text-dim">{config.path}</div>
      <p className="mt-2 mb-1.5 text-xs leading-[1.4] text-text-secondary">{config.hint}</p>
      {config.cmd && (
        <div className="relative mb-3 flex items-center gap-2 rounded-md border border-edge-light bg-surface-raised px-3 py-2">
          <code className="flex-1 break-all font-mono text-xs text-violet-300">{config.cmd}</code>
          <button
            type="button"
            className={clsx('shrink-0 cursor-pointer rounded-md border bg-surface-raised px-2.5 py-1 text-xs transition-[color,border-color] duration-150 hover:border-edge-hover hover:text-text-primary', cmdCopied ? 'border-green-500/25 text-green-500' : 'border-edge-light text-text-secondary')}
            onClick={onCmdCopy}>
            {cmdCopied ? '\u2713' : 'Copy'}
          </button>
        </div>
      )}
      <pre className="m-0 overflow-x-auto whitespace-pre font-mono text-[13px] leading-normal">
        {tabKey === 'env' ? <EnvCode apiKey={apiKey} /> : <JsonCode apiKey={apiKey} />}
      </pre>
      {config.hint2 && <p className="mt-2 mb-1.5 text-xs leading-[1.4] text-text-secondary">{config.hint2}</p>}
      <button
        type="button"
        className={clsx('absolute top-2.5 right-2.5 cursor-pointer rounded-md border bg-surface-raised px-2.5 py-1 text-xs opacity-0 transition-[opacity,color,border-color] duration-150 group-hover/settings:opacity-100 hover:border-edge-hover hover:text-text-primary', blockCopied ? 'border-green-500/25 text-green-500' : 'border-edge-light text-text-secondary')}
        onClick={onBlockCopy}>
        {blockCopied ? '\u2713' : 'Copy'}
      </button>
    </Tabs.Panel>
  )
}

export default function KeySettingsPanel({ apiKey }: { apiKey: string }) {
  const [activeTab, setActiveTab] = useState<Tab>('user')
  const [cmdCopied, setCmdCopied] = useState(false)
  const [blockCopied, setBlockCopied] = useState(false)

  const config = TAB_DATA[activeTab]

  const handleTabChange = useCallback((value: Tab) => {
    setActiveTab(value)
    setCmdCopied(false)
    setBlockCopied(false)
  }, [])

  const handleCmdCopy = useCallback(() => {
    if (!config.cmd) return
    navigator.clipboard.writeText(config.cmd).then(() => {
      setCmdCopied(true)
      setTimeout(() => setCmdCopied(false), 2000)
    })
  }, [config.cmd])

  const handleBlockCopy = useCallback(() => {
    const text =
      activeTab === 'env'
        ? `MEET_AI_URL=https://meet-ai.cc\nMEET_AI_KEY=${apiKey}`
        : JSON.stringify({ env: { MEET_AI_URL: 'https://meet-ai.cc', MEET_AI_KEY: apiKey } }, null, 2)
    navigator.clipboard.writeText(text).then(() => {
      setBlockCopied(true)
      setTimeout(() => setBlockCopied(false), 2000)
    })
  }, [activeTab, apiKey])

  return (
    <Tabs.Root defaultValue="user" value={activeTab} onValueChange={(value: string) => handleTabChange(value as Tab)} className="text-left">
      <h3 className="mb-3 text-sm font-semibold text-text-primary">Add your credentials</h3>
      <p className="mb-3 text-[13px] leading-normal text-text-secondary">Choose where to store your API key:</p>
      <Tabs.List className="flex">
        {TABS.map(({ key, label }) => (
          <Tabs.Tab
            key={key}
            value={key}
            className={clsx('cursor-pointer rounded-t-lg border border-b-0 border-edge-light px-4 py-2 text-[13px] transition-colors duration-150 hover:text-text-primary bg-transparent text-text-secondary data-[selected]:bg-edge data-[selected]:text-text-primary')}>
            {label}
          </Tabs.Tab>
        ))}
      </Tabs.List>
      {TABS.map(({ key }) => (
        <TabPanel key={key} tabKey={key} apiKey={apiKey} cmdCopied={cmdCopied} blockCopied={blockCopied} onCmdCopy={handleCmdCopy} onBlockCopy={handleBlockCopy} />
      ))}
    </Tabs.Root>
  )
}
