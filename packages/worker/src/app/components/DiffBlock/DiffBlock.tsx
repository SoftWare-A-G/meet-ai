import { Collapsible } from '@base-ui/react/collapsible'
import { DiffView, DiffModeEnum, DiffFile } from '@git-diff-view/react'
import { useMemo } from 'react'
import { formatTimeWithSeconds } from '../../lib/dates'

type DiffBlockProps = {
  filename: string
  hunks: string[]
  timestamp: string
  changeCount?: number
}

export function isNewFileDiff(hunks: string[]): boolean {
  return hunks.every(hunk => {
    const normalized = hunk.trimStart()
    return normalized.startsWith('--- /dev/null') || /^@@\s+-0,0\s/.test(normalized)
  })
}

function getLangFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    ts: 'typescript',
    tsx: 'tsx',
    js: 'javascript',
    jsx: 'jsx',
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    java: 'java',
    css: 'css',
    scss: 'scss',
    html: 'html',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    md: 'markdown',
    sh: 'bash',
    sql: 'sql',
    swift: 'swift',
    kt: 'kotlin',
    c: 'c',
    cpp: 'cpp',
    h: 'c',
    hpp: 'cpp',
  }
  return map[ext] ?? ext
}

export default function DiffBlock({ filename, hunks, timestamp, changeCount }: DiffBlockProps) {
  const isNewFile = isNewFileDiff(hunks)

  const diffFile = useMemo(() => {
    const lang = getLangFromFilename(filename)
    const file = DiffFile.createInstance({
      newFile: { fileName: filename, fileLang: lang },
      hunks,
    })

    file.initTheme('dark')
    file.init()
    file.initSyntax()
    file.buildUnifiedDiffLines()

    return file

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <Collapsible.Root
      defaultOpen={false}
      className={`diff-block text-msg-text my-px rounded font-mono text-xs opacity-65${isNewFile ? ' diff-block--new-file' : ''}`}>
      <Collapsible.Trigger className="group/diff font-inherit flex w-full cursor-pointer items-center gap-1.5 rounded border-none bg-transparent px-2 py-[3px] text-left text-inherit select-none hover:bg-white/[0.08] hover:opacity-100">
        <span className="inline w-3 shrink-0 text-center text-[10px] group-data-[panel-open]/diff:hidden">
          {'\u25B8'}
        </span>
        <span className="hidden w-3 shrink-0 text-center text-[10px] group-data-[panel-open]/diff:inline">
          {'\u25BE'}
        </span>
        <span className="min-w-0 flex-1">
          {isNewFile ? 'Created' : 'Edited'} {filename}
          {changeCount ? ` (${changeCount} changes)` : ''}
        </span>
        <span className="text-[11px] whitespace-nowrap opacity-50">
          {formatTimeWithSeconds(timestamp)}
        </span>
      </Collapsible.Trigger>
      <Collapsible.Panel className="overflow-x-auto px-2 pb-2 pl-5">
        <DiffView
          diffFile={diffFile}
          diffViewMode={DiffModeEnum.Unified}
          diffViewTheme="dark"
          diffViewFontSize={12}
          diffViewWrap
          diffViewHighlight
        />
      </Collapsible.Panel>
    </Collapsible.Root>
  )
}
