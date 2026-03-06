import { useMemo, useState, useEffect } from 'react'
import { Collapsible } from '@base-ui/react/collapsible'
import { DiffView, DiffModeEnum, DiffFile } from '@git-diff-view/react'
import { getDiffViewHighlighter } from '@git-diff-view/shiki'
import type { DiffHighlighter } from '@git-diff-view/shiki'
import { formatTimeWithSeconds } from '../../lib/dates'

type DiffFileHighlighter = Omit<DiffHighlighter, 'getHighlighterEngine'>

let highlighterCache: DiffFileHighlighter | null = null
let highlighterPromise: Promise<DiffFileHighlighter> | null = null

function getHighlighter(): Promise<DiffFileHighlighter> {
  if (!highlighterPromise) {
    highlighterPromise = getDiffViewHighlighter().then((h) => {
      highlighterCache = h
      return h
    })
  }
  return highlighterPromise
}

function useShikiHighlighter() {
  const [highlighter, setHighlighter] = useState<DiffFileHighlighter | null>(highlighterCache)

  useEffect(() => {
    if (!highlighter) {
      getHighlighter().then(setHighlighter)
    }
  }, [highlighter])

  return highlighter
}

type DiffBlockProps = {
  filename: string
  hunks: string[]
  timestamp: string
  changeCount?: number
}

function getLangFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'tsx', js: 'javascript', jsx: 'jsx',
    py: 'python', rb: 'ruby', go: 'go', rs: 'rust', java: 'java',
    css: 'css', scss: 'scss', html: 'html', json: 'json', yaml: 'yaml',
    yml: 'yaml', md: 'markdown', sh: 'bash', sql: 'sql', swift: 'swift',
    kt: 'kotlin', c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp',
  }
  return map[ext] ?? ext
}

export default function DiffBlock({ filename, hunks, timestamp, changeCount }: DiffBlockProps) {
  const highlighter = useShikiHighlighter()

  const diffFile = useMemo(() => {
    const lang = getLangFromFilename(filename)
    const file = DiffFile.createInstance({
      newFile: { fileName: filename, fileLang: lang },
      hunks,
    })
    file.initTheme('dark')
    file.init()
    if (highlighter) {
      file.initSyntax({ registerHighlighter: highlighter })
    }
    file.buildUnifiedDiffLines()
    return file
  }, [filename, hunks, highlighter])

  return (
    <Collapsible.Root defaultOpen={false} className="diff-block rounded my-px text-xs font-mono text-msg-text opacity-65">
      <Collapsible.Trigger className="group/diff flex w-full items-center gap-1.5 px-2 py-[3px] cursor-pointer rounded select-none hover:bg-white/[0.08] hover:opacity-100 bg-transparent border-none text-inherit font-inherit text-left">
        <span className="text-[10px] w-3 text-center shrink-0 inline group-data-[panel-open]/diff:hidden">{'\u25B8'}</span>
        <span className="text-[10px] w-3 text-center shrink-0 hidden group-data-[panel-open]/diff:inline">{'\u25BE'}</span>
        <span className="flex-1 min-w-0">Edited {filename}{changeCount ? ` (${changeCount} changes)` : ''}</span>
        <span className="text-[11px] opacity-50 whitespace-nowrap">{formatTimeWithSeconds(timestamp)}</span>
      </Collapsible.Trigger>
      <Collapsible.Panel className="px-2 pb-2 pl-5 overflow-x-auto">
        <DiffView
          diffFile={diffFile}
          diffViewMode={DiffModeEnum.Unified}
          diffViewTheme="dark"
          diffViewFontSize={12}
          diffViewWrap
          diffViewHighlight
          registerHighlighter={highlighter ?? undefined}
        />
      </Collapsible.Panel>
    </Collapsible.Root>
  )
}
