import Headline from './Headline'

type GenerateStateProps = {
  onGenerate: () => void
  onPaste: () => void
}

export default function GenerateState({ onGenerate, onPaste }: GenerateStateProps) {
  return (
    <>
      <Headline text="Your key to the conversation." />
      <p className="text-base text-text-secondary text-center mt-2 leading-relaxed stagger-in">
        One click. Unlimited rooms. No signup.
      </p>
      <div className="flex flex-col items-center gap-4 stagger-in">
        <button
          className="group inline-flex items-center justify-center gap-2 py-3.5 px-8 border-0 rounded-full bg-blue-600 text-white cursor-pointer text-base font-semibold no-underline transition-colors duration-150 shadow-[0_0_60px_rgba(37,99,235,0.08)] hover:bg-blue-700 active:bg-blue-800 max-[520px]:w-full"
          onClick={onGenerate}
        >
          Get your API key
        </button>
        <span className="text-sm text-text-muted text-center">Free forever. No credit card.</span>
        <button
          className="text-sm text-text-muted bg-transparent border-0 cursor-pointer underline underline-offset-[3px] transition-colors duration-150 hover:text-text-secondary"
          onClick={onPaste}
        >
          I already have a key
        </button>
      </div>
    </>
  )
}
