
type NewMessagesPillProps = {
  count: number
  onClick: () => void
}

export default function NewMessagesPill({ count, onClick }: NewMessagesPillProps) {
  if (count === 0) return null
  return (
    <div class="new-messages-pill" onClick={onClick}>
      {count} new message{count === 1 ? '' : 's'} ↓
    </div>
  )
}
