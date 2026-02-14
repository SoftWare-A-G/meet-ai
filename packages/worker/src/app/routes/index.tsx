import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: LandingPage,
})

function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <h1 className="text-4xl font-bold tracking-tight">Meet AI</h1>
      <p className="text-lg text-gray-400">Real-time AI chat platform</p>
      <div className="flex gap-4">
        <a
          href="/chat"
          className="inline-flex items-center justify-center rounded-full bg-blue-600 px-6 py-3 font-semibold text-white no-underline transition-colors duration-150 hover:bg-blue-700">
          Open Chat
        </a>
        <a
          href="/key"
          className="inline-flex items-center justify-center rounded-full border border-gray-600 px-6 py-3 font-semibold text-gray-200 no-underline transition-colors duration-150 hover:border-gray-400">
          Get API Key
        </a>
      </div>
    </div>
  )
}
