import { useMemo } from 'react'
import DOMPurify from 'dompurify'
import { Renderer, parse } from 'marked'
import ShikiCode from '../ShikiCode'
import { useChatContext } from '../../lib/chat-context'

type MarkdownContentProps = {
  content: string
  className?: string
}

type Segment =
  | { type: 'html'; html: string }
  | { type: 'code'; code: string; lang: string }

const MARKER_ATTR = 'data-shiki-idx'

type MentionMeta = {
  kind: 'current-user' | 'team-lead' | 'codex' | 'agent' | 'group' | 'generic'
  tone: number
}

const MENTION_REGEX = /(^|[^@\w])(@[A-Za-z0-9][\w-]*)/g
const GROUP_MENTIONS = new Set(['@channel', '@everyone', '@here', '@team', '@all'])

function hashTone(value: string): number {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 6
  }
  return hash
}

function getMentionMeta(
  mention: string,
  mentionLookup: Map<string, { role: string; name: string }>,
  currentUser: string
): MentionMeta {
  const normalizedMention = mention.toLowerCase()
  const mentionName = normalizedMention.slice(1)
  const normalizedCurrentUser = currentUser.trim().toLowerCase()

  if (GROUP_MENTIONS.has(normalizedMention)) {
    return { kind: 'group', tone: hashTone(normalizedMention) }
  }

  if (mentionName === normalizedCurrentUser) {
    return { kind: 'current-user', tone: hashTone(normalizedMention) }
  }

  const member = mentionLookup.get(mentionName)
  if (!member) {
    return { kind: 'generic', tone: hashTone(normalizedMention) }
  }

  const role = member.role.trim().toLowerCase()
  if (role === 'team-lead') {
    return { kind: 'team-lead', tone: hashTone(member.name) }
  }
  if (role === 'codex') {
    return { kind: 'codex', tone: hashTone(member.name) }
  }
  if (role.includes('agent')) {
    return { kind: 'agent', tone: hashTone(member.name) }
  }

  return { kind: 'generic', tone: hashTone(member.name) }
}

function renderMentionMarkup(
  text: string,
  mentionLookup: Map<string, { role: string; name: string }>,
  currentUser: string
): string {
  return text.replace(MENTION_REGEX, (full, prefix: string, mention: string) => {
    const meta = getMentionMeta(mention, mentionLookup, currentUser)
    return `${prefix}<span class="mention-token mention-token--${meta.kind} mention-token--tone-${meta.tone}">${mention}</span>`
  })
}

function parseContent(
  content: string,
  mentionLookup: Map<string, { role: string; name: string }>,
  currentUser: string
): Segment[] {
  const codeBlocks: { code: string; lang: string }[] = []

  const renderer = new Renderer()
  renderer.link = function ({ href, text }: { href: string; text: string }) {
    return `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`
  }

  renderer.code = function ({ text, lang }: { text: string; lang?: string }) {
    const idx = codeBlocks.length
    codeBlocks.push({ code: text, lang: lang || 'text' })
    // Render as a <pre> with a data attribute - DOMPurify will preserve it
    return `<pre ${MARKER_ATTR}="${idx}"></pre>`
  }
  renderer.text = function (token: string | { text?: string }) {
    const text = typeof token === 'string' ? token : (token.text ?? '')
    return renderMentionMarkup(text, mentionLookup, currentUser)
  }

  const rawHtml = parse(content, { breaks: true, renderer }).toString()

  // Allow the data attribute through DOMPurify
  const html = DOMPurify.sanitize(rawHtml, {
    ADD_ATTR: [MARKER_ATTR, 'target', 'rel'],
  })

  // If no code blocks, return the whole thing as HTML
  if (codeBlocks.length === 0) {
    return [{ type: 'html', html }]
  }

  // Split on marker <pre> tags and interleave HTML segments with code blocks
  const markerRegex = new RegExp(
    `<pre\\s+${MARKER_ATTR}="(\\d+)"\\s*>\\s*</pre>`,
    'g',
  )

  const segments: Segment[] = []
  let lastIndex = 0

  for (const match of html.matchAll(markerRegex)) {
    const before = html.slice(lastIndex, match.index)
    if (before) {
      segments.push({ type: 'html', html: before })
    }
    const idx = parseInt(match[1], 10)
    segments.push({ type: 'code', ...codeBlocks[idx] })
    lastIndex = (match.index ?? 0) + match[0].length
  }

  const after = html.slice(lastIndex)
  if (after) {
    segments.push({ type: 'html', html: after })
  }

  return segments
}

export default function MarkdownContent({ content, className }: MarkdownContentProps) {
  const { teamInfo, userName } = useChatContext()
  const mentionLookup = useMemo(
    () =>
      new Map(
        (teamInfo?.members ?? []).map(member => [
          member.name.trim().toLowerCase(),
          { role: member.role, name: member.name },
        ])
      ),
    [teamInfo]
  )
  const segments = useMemo(
    () => parseContent(content, mentionLookup, userName),
    [content, mentionLookup, userName]
  )

  return (
    <div className={className}>
      {segments.map((seg, i) =>
        seg.type === 'code' ? (
          <ShikiCode key={i} code={seg.code} lang={seg.lang} />
        ) : (
          <div key={i} dangerouslySetInnerHTML={{ __html: seg.html }} />
        ),
      )}
    </div>
  )
}
