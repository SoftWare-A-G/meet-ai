import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { formatTime } from '../../lib/dates'
import { useDecisionsCache } from '../../hooks/useDecisionsCache'
import { useReviewMutations } from '../../hooks/useReviewMutations'
import { Button } from '../ui/button'

type PermissionCardProps = {
  content: string
  timestamp?: string
  reviewId: string
  roomId: string
  userName: string
}

type ContentSegment =
  | { type: 'text'; value: string }
  | { type: 'bold'; value: string }
  | { type: 'code'; value: string }

function parseContent(content: string): ContentSegment[] {
  const segments: ContentSegment[] = []
  const regex = /\*\*(.+?)\*\*|`(.+?)`/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: content.slice(lastIndex, match.index) })
    }
    if (match[1]) {
      segments.push({ type: 'bold', value: match[1] })
    } else if (match[2]) {
      segments.push({ type: 'code', value: match[2] })
    }
    lastIndex = regex.lastIndex
  }

  if (lastIndex < content.length) {
    segments.push({ type: 'text', value: content.slice(lastIndex) })
  }

  return segments
}

export default function PermissionCard({ content, timestamp, reviewId, roomId, userName }: PermissionCardProps) {
  const { permissionDecisions } = useDecisionsCache(roomId)
  const { decidePermission } = useReviewMutations(roomId, userName)

  const decision = permissionDecisions[reviewId]
  const status = decision?.status ?? 'pending'
  const feedback = decision?.feedback

  const isPending = status === 'pending'
  const isApproved = status === 'approved'
  const isDenied = status === 'denied'
  const isExpired = status === 'expired'
  const [text, setText] = useState('')

  const segments = useMemo(() => parseContent(content), [content])

  return (
    <div className={clsx(
      'rounded-md border-l-2 px-3 py-2.5 text-sm',
      isExpired ? 'border-[#6b7280] bg-[#6b7280]/[0.06]'
        : isDenied ? 'border-[#ef4444] bg-[#ef4444]/[0.06]'
        : isApproved ? 'border-[#22c55e] bg-[#22c55e]/[0.06]'
        : 'border-[#f97316] bg-[#f97316]/[0.06]',
    )}>
      <div className="flex items-center gap-2 mb-2">
        <span className={clsx(
          'font-bold text-sm',
          isExpired ? 'text-[#6b7280]'
            : isDenied ? 'text-[#ef4444]'
            : isApproved ? 'text-[#22c55e]'
            : 'text-[#f97316]',
        )}>
          {isExpired ? 'Permission expired'
            : isDenied ? 'Permission denied'
            : isApproved ? 'Permission granted'
            : 'Permission request'}
        </span>
        {timestamp && (
          <span className="text-xs text-[#8b8fa3]">{formatTime(timestamp)}</span>
        )}
      </div>

      <div className="text-msg-text whitespace-pre-wrap break-words">
        {segments.map((seg, i) => {
          if (seg.type === 'bold') return <strong key={i}>{seg.value}</strong>
          if (seg.type === 'code') return <code key={i} className="text-xs bg-black/20 px-1 py-0.5 rounded">{seg.value}</code>
          return <span key={i}>{seg.value}</span>
        })}
      </div>

      {!isPending && feedback && (
        <div className="mt-2 text-xs text-[#8b8fa3] italic">
          {feedback}
        </div>
      )}

      {isPending && (
        <div className="mt-3 flex flex-col gap-2">
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Optional feedback..."
            rows={1}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-msg-text placeholder-[#8b8fa3] resize-none outline-none focus:border-[#f97316]/50"
          />
          <div className="flex gap-2 justify-end">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => decidePermission.mutate({ reviewId, approved: false, feedback: text || undefined })}
            >
              Deny
            </Button>
            <Button
              size="sm"
              className="bg-[#22c55e] text-black hover:bg-[#22c55e]/80"
              onClick={() => decidePermission.mutate({ reviewId, approved: true, feedback: text || undefined })}
            >
              Allow
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
