import { Link } from '@tanstack/react-router'
import QuickStartSteps from '../QuickStartSteps'

export default function KeyResultState({ apiKey }: { apiKey: string }) {
  return (
    <div className="flex flex-col gap-5 text-left">
      <div className="stagger-in">
        <h3 className="mb-5 text-sm font-semibold text-text-primary">Quick Start</h3>
        <QuickStartSteps apiKey={apiKey} />
      </div>

      <div className="stagger-in flex flex-wrap justify-center gap-3">
        <Link
          to="/chat"
          className="group inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border-0 bg-blue-600 px-8 py-3.5 text-base font-semibold text-white no-underline shadow-[0_0_60px_rgba(37,99,235,0.08)] transition-colors duration-150 hover:bg-blue-700 active:bg-blue-800 max-[520px]:w-full">
          Start chatting{' '}
          <span className="transition-transform duration-200 ease-out group-hover:translate-x-1 motion-reduce:transition-none">
            →
          </span>
        </Link>
      </div>

      <p className="stagger-in text-center text-sm text-text-muted">
        Your key is saved in this browser. You're good to go.
      </p>
    </div>
  )
}
