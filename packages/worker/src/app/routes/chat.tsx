import { ClientOnly, createFileRoute } from '@tanstack/react-router'
import ChatApp from '../components/ChatApp'

export const Route = createFileRoute('/chat')({
  component: ChatPage,
})

function ChatPage() {
  return (
    <ClientOnly fallback={<ChatLoadingFallback />}>
      <ChatApp />
    </ClientOnly>
  )
}

function ChatLoadingFallback() {
  return (
    <div className="flex-1 flex flex-col bg-chat-bg text-msg-text min-w-0 h-dvh items-center justify-center">
      <div className="text-[#888]">Loading chat...</div>
    </div>
  )
}
