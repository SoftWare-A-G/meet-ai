import { ClientOnly, createFileRoute } from '@tanstack/react-router'
import KeyApp from '../components/key/KeyApp'

export const Route = createFileRoute('/key')({
  component: KeyPage,
})

function KeyPage() {
  return (
    <ClientOnly fallback={<KeyLoadingFallback />}>
      <div className="min-h-screen flex flex-col items-center justify-center bg-surface text-text-primary p-6">
        <KeyApp />
      </div>
    </ClientOnly>
  )
}

function KeyLoadingFallback() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-surface text-text-primary p-6 min-h-[50vh]">
      <div className="text-[#888]">Loading...</div>
    </div>
  )
}
