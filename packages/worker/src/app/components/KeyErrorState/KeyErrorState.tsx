import KeyHeadline from '../KeyHeadline'

type KeyErrorStateProps = {
  message: string
  onRetry: () => void
}

export default function KeyErrorState({ message, onRetry }: KeyErrorStateProps) {
  return (
    <>
      <KeyHeadline text="Your key to the conversation." />
      <div className="stagger-in rounded-lg border border-red-900/40 bg-red-950 px-4 py-3 text-sm text-red-400">
        <div className="mb-1 font-semibold">Something went wrong</div>
        {message}
      </div>
      <div className="stagger-in flex flex-col items-center gap-4">
        <button
          type="button"
          className="group inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border-0 bg-blue-600 px-8 py-3.5 text-base font-semibold text-white no-underline shadow-[0_0_60px_rgba(37,99,235,0.08)] transition-colors duration-150 hover:bg-blue-700 active:bg-blue-800 max-[520px]:w-full"
          onClick={onRetry}>
          Try again
        </button>
      </div>
    </>
  )
}
