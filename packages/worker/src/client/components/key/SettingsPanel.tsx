import { useState, useCallback, useRef } from 'hono/jsx/dom'

type Tab = 'user' | 'project' | 'env'

type TabConfig = {
  path: string
  hint: string
  cmd?: string
  hint2?: string
}

const TAB_DATA: Record<Tab, TabConfig> = {
  user: {
    path: '~/.claude/settings.json',
    hint: 'Applies to <strong>all projects</strong>. Run this to create and open the file:',
    cmd: 'mkdir -p ~/.claude && touch ~/.claude/settings.json && open ~/.claude/settings.json',
    hint2: 'Paste the JSON above into the file and save.',
  },
  project: {
    path: '.claude/settings.json',
    hint: 'Applies to <strong>this project only</strong>. Run from your project root:',
    cmd: 'mkdir -p .claude && touch .claude/settings.json && open .claude/settings.json',
    hint2: 'Paste the JSON above into the file and save.',
  },
  env: {
    path: '.env',
    hint: 'Add to your <strong>project root</strong>. Bun and most frameworks load <code>.env</code> automatically.',
  },
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function copyText(text: string, btnEl: HTMLElement, label = 'Copy') {
  navigator.clipboard.writeText(text).then(() => {
    btnEl.textContent = '\u2713'
    btnEl.classList.add('copied')
    setTimeout(() => {
      btnEl.textContent = label
      btnEl.classList.remove('copied')
    }, 2000)
  })
}

function colorizeJson(key: string): string {
  const ek = escapeHtml(key)
  return [
    '<span class="syn-punct">{</span>',
    '  <span class="syn-key">"env"</span><span class="syn-punct">:</span> <span class="syn-punct">{</span>',
    '    <span class="syn-key">"MEET_AI_URL"</span><span class="syn-punct">:</span> <span class="syn-str">"https://meet-ai.cc"</span><span class="syn-punct">,</span>',
    `    <span class="syn-key">"MEET_AI_KEY"</span><span class="syn-punct">:</span> <span class="syn-str">"${ek}"</span>`,
    '  <span class="syn-punct">}</span>',
    '<span class="syn-punct">}</span>',
  ].join('\n')
}

function colorizeEnv(key: string): string {
  const ek = escapeHtml(key)
  return [
    '<span class="syn-key">MEET_AI_URL</span><span class="syn-punct">=</span><span class="syn-str">https://meet-ai.cc</span>',
    `<span class="syn-key">MEET_AI_KEY</span><span class="syn-punct">=</span><span class="syn-str">${ek}</span>`,
  ].join('\n')
}

export default function SettingsPanel({ apiKey }: { apiKey: string }) {
  const [activeTab, setActiveTab] = useState<Tab>('user')
  const cmdCopyRef = useRef<HTMLButtonElement>(null)
  const blockCopyRef = useRef<HTMLButtonElement>(null)

  const config = TAB_DATA[activeTab]

  const handleTabClick = useCallback((tab: Tab) => {
    setActiveTab(tab)
  }, [])

  const handleCmdCopy = useCallback(() => {
    if (cmdCopyRef.current && config.cmd) {
      copyText(config.cmd, cmdCopyRef.current)
    }
  }, [activeTab])

  const handleBlockCopy = useCallback(() => {
    if (!blockCopyRef.current) return
    const text =
      activeTab === 'env'
        ? 'MEET_AI_URL=https://meet-ai.cc\nMEET_AI_KEY=' + apiKey
        : JSON.stringify({ env: { MEET_AI_URL: 'https://meet-ai.cc', MEET_AI_KEY: apiKey } }, null, 2)
    copyText(text, blockCopyRef.current)
  }, [activeTab, apiKey])

  const colorizedCode = activeTab === 'env' ? colorizeEnv(apiKey) : colorizeJson(apiKey)

  return (
    <div class="text-left">
      <h3 class="text-sm font-semibold mb-3 text-text-primary">Add your credentials</h3>
      <p class="text-[13px] text-text-secondary mb-3 leading-normal">Choose where to store your API key:</p>
      <div class="settings-tabs">
        <button
          class={`py-2 px-4 border border-edge-light border-b-0 rounded-t-lg cursor-pointer text-[13px] transition-colors duration-150 hover:text-text-primary ${activeTab === 'user' ? 'bg-edge text-text-primary' : 'bg-transparent text-text-secondary'}`}
          onClick={() => handleTabClick('user')}
        >
          User-level
        </button>
        <button
          class={`py-2 px-4 border border-edge-light border-b-0 rounded-t-lg cursor-pointer text-[13px] transition-colors duration-150 hover:text-text-primary ${activeTab === 'project' ? 'bg-edge text-text-primary' : 'bg-transparent text-text-secondary'}`}
          onClick={() => handleTabClick('project')}
        >
          Project-level
        </button>
        <button
          class={`py-2 px-4 border border-edge-light border-b-0 rounded-t-lg cursor-pointer text-[13px] transition-colors duration-150 hover:text-text-primary ${activeTab === 'env' ? 'bg-edge text-text-primary' : 'bg-transparent text-text-secondary'}`}
          onClick={() => handleTabClick('env')}
        >
          .env
        </button>
      </div>
      <div class="group/settings bg-edge border border-edge-light rounded-[0_0.5rem_0.5rem_0.5rem] p-4 relative transition-[border-color] duration-150 hover:border-edge-hover">
        <div class="text-[11px] text-text-dim mb-1.5 font-mono">{config.path}</div>
        <p class="settings-hint" dangerouslySetInnerHTML={{ __html: config.hint }} />
        {config.cmd && (
          <div class="bg-surface-raised border border-edge-light rounded-md py-2 px-3 mb-3 flex items-center gap-2 relative">
            <code class="flex-1 font-mono text-xs text-violet-300 break-all">{config.cmd}</code>
            <button
              class="static opacity-100 shrink-0 py-1 px-2.5 border border-edge-light rounded-md bg-surface-raised text-text-secondary cursor-pointer text-xs transition-[color,border-color] duration-150 hover:text-text-primary hover:border-edge-hover"
              ref={cmdCopyRef}
              onClick={handleCmdCopy}
            >
              Copy
            </button>
          </div>
        )}
        <pre class="font-mono text-[13px] leading-normal whitespace-pre overflow-x-auto m-0" dangerouslySetInnerHTML={{ __html: colorizedCode }} />
        {config.hint2 && <p class="settings-hint">{config.hint2}</p>}
        <button
          class="absolute top-2.5 right-2.5 py-1 px-2.5 border border-edge-light rounded-md bg-surface-raised text-text-secondary cursor-pointer text-xs opacity-0 transition-[opacity,color,border-color] duration-150 group-hover/settings:opacity-100 hover:text-text-primary hover:border-edge-hover"
          ref={blockCopyRef}
          onClick={handleBlockCopy}
        >
          Copy
        </button>
      </div>
    </div>
  )
}
