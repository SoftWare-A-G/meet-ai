import Headline from './Headline'

type ErrorStateProps = {
  message: string
  onRetry: () => void
}

export default function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <>
      <Headline text="Your key to the conversation." />
      <div className="bg-red-950 border border-red-900/40 text-red-400 px-4 py-3 rounded-lg text-sm stagger-in">
        <div className="font-semibold mb-1">Something went wrong</div>
        {message}
      </div>
      <div className="flex flex-col items-center gap-4 stagger-in">
        <button
          className="group inline-flex items-center justify-center gap-2 py-3.5 px-8 border-0 rounded-full bg-blue-600 text-white cursor-pointer text-base font-semibold no-underline transition-colors duration-150 shadow-[0_0_60px_rgba(37,99,235,0.08)] hover:bg-blue-700 active:bg-blue-800 max-[520px]:w-full"
          onClick={onRetry}
        >
          Try again
        </button>
      </div>
    </>
  )
}
