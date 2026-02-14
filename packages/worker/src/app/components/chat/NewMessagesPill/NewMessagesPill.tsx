
type NewMessagesPillProps = {
  count: number
  onClick: () => void
}

export default function NewMessagesPill({ count, onClick }: NewMessagesPillProps) {
  if (count === 0) return null
  return (
    <div className="sticky bottom-2 self-center bg-primary text-primary-text px-4 py-1.5 rounded-2xl text-[13px] cursor-pointer z-5 shadow-[0_2px_8px_rgba(0,0,0,0.3)]" onClick={onClick}>
      {count} new message{count === 1 ? '' : 's'} ↓
    </div>
  )
}
