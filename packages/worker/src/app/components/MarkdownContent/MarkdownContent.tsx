import { useMemo } from 'react'
import DOMPurify from 'dompurify'
import { getRouteApi } from '@tanstack/react-router'
import { Renderer, parse, type Token } from 'marked'
import ShikiCode from '../ShikiCode'
import { useTeamInfoQuery } from '../../hooks/useTeamInfoQuery'
import { useChatContext } from '../../lib/chat-context'
import { ensureSenderContrast } from '../../lib/colors'

const chatRoute = getRouteApi('/chat/$id')

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
  color?: string
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
  mentionLookup: Map<string, { role: string; name: string; color: string }>,
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
    return { kind: 'team-lead', tone: hashTone(member.name), color: member.color }
  }
  if (role === 'codex') {
    return { kind: 'codex', tone: hashTone(member.name), color: member.color }
  }
  if (role.includes('agent')) {
    return { kind: 'agent', tone: hashTone(member.name), color: member.color }
  }

  return { kind: 'generic', tone: hashTone(member.name), color: member.color }
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
}

function renderMentionMarkup(
  text: string,
  mentionLookup: Map<string, { role: string; name: string; color: string }>,
  currentUser: string
): string {
  return text.replace(MENTION_REGEX, (full, prefix: string, mention: string) => {
    const meta = getMentionMeta(mention, mentionLookup, currentUser)
    const memberName = mention.slice(1)
    const colorStyle = meta.color ? ` style="--mention-accent:${escapeAttribute(ensureSenderContrast(meta.color))}"` : ''
    return `${prefix}<button type="button" class="mention-token mention-token--${meta.kind} mention-token--tone-${meta.tone}" data-mention-name="${escapeAttribute(memberName)}"${colorStyle}>${mention}</button>`
  })
}

function parseContent(
  content: string,
  mentionLookup: Map<string, { role: string; name: string; color: string }>,
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
  renderer.text = function (this: Renderer, token: { text?: string; tokens?: Token[] }) {
    const rendered = token.tokens
      ? this.parser.parseInline(token.tokens)
      : (token.text ?? '')
    return renderMentionMarkup(rendered, mentionLookup, currentUser)
  }

  const rawHtml = parse(content, { breaks: true, renderer })
    .toString()
    .replace(/<table[\s\S]*?<\/table>/g, match => `<div class="msg-table-wrap">${match}</div>`)

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
  const { id: roomId } = chatRoute.useParams()
  const { data: teamInfo } = useTeamInfoQuery(roomId)
  const { userName, insertMention } = useChatContext()
  const mentionLookup = useMemo(
    () =>
      new Map(
        (teamInfo?.members ?? []).map(member => [
          member.name.trim().toLowerCase(),
          { role: member.role, name: member.name, color: member.color },
        ])
      ),
    [teamInfo]
  )
  const segments = useMemo(
    () => parseContent(content, mentionLookup, userName),
    [content, mentionLookup, userName]
  )

  return (
    <div
      className={className}
      onClick={event => {
        const target = event.target
        if (!(target instanceof HTMLElement)) return
        const trigger = target.closest<HTMLElement>('[data-mention-name]')
        const mentionName = trigger?.dataset.mentionName?.trim()
        if (!mentionName) return
        event.preventDefault()
        insertMention(mentionName)
      }}
    >
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
