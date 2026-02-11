
type EmptyStateProps = {
  message?: string
  showBackLink?: boolean
}

export default function EmptyState({ message = 'Select or create a channel to start chatting', showBackLink }: EmptyStateProps) {
  return (
    <div class="empty-state">
      <div class="icon">#</div>
      <div>{message}</div>
      {showBackLink && (
        <div style="font-size:13px;margin-top:4px">
          <a href="/chat" style="color:var(--c-primary)">Back to channels</a>
        </div>
      )}
    </div>
  )
}
