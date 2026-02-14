
type EmptyStateProps = {
  message?: string
  showBackLink?: boolean
}

export default function EmptyState({ message = 'Select or create a channel to start chatting', showBackLink }: EmptyStateProps) {
  return (
    <div className="flex-1 flex items-center justify-center flex-col gap-2 opacity-50 text-[15px]">
      <div className="text-[32px] mb-1">#</div>
      <div>{message}</div>
      {showBackLink && (
        <div className="text-[13px] mt-1">
          <a href="/chat" className="text-primary">Back to channels</a>
        </div>
      )}
    </div>
  )
}
