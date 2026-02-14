import KeyHeadline from '../KeyHeadline'

type KeyGenerateStateProps = {
  onGenerate: () => void
  onPaste: () => void
}

export default function KeyGenerateState({ onGenerate, onPaste }: KeyGenerateStateProps) {
  return (
    <>
      <KeyHeadline text="Your key to the conversation." />
      <p className="stagger-in mt-2 text-center text-base leading-relaxed text-text-secondary">
        One click. Unlimited rooms. No signup.
      </p>
      <div className="stagger-in flex flex-col items-center gap-4">
        <button
          type="button"
          className="group inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border-0 bg-blue-600 px-8 py-3.5 text-base font-semibold text-white no-underline shadow-[0_0_60px_rgba(37,99,235,0.08)] transition-colors duration-150 hover:bg-blue-700 active:bg-blue-800 max-[520px]:w-full"
          onClick={onGenerate}>
          Get your API key
        </button>
        <span className="text-center text-sm text-text-muted">Free forever. No credit card.</span>
        <button
          type="button"
          className="cursor-pointer border-0 bg-transparent text-sm text-text-muted underline underline-offset-[3px] transition-colors duration-150 hover:text-text-secondary"
          onClick={onPaste}>
          I already have a key
        </button>
      </div>
    </>
  )
}
