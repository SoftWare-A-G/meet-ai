import KeyHeadline from '../KeyHeadline'
import { Button } from '../ui/button'

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
        <Button
          size="lg"
          className="group rounded-full bg-blue-600 px-8 py-3.5 text-base font-semibold text-white shadow-[0_0_60px_rgba(37,99,235,0.08)] hover:bg-blue-700 active:bg-blue-800 max-[520px]:w-full"
          onClick={onGenerate}>
          Get your API key
        </Button>
        <span className="text-center text-sm text-text-muted">Free forever. No credit card.</span>
        <Button
          variant="link"
          className="text-text-muted underline-offset-[3px] hover:text-text-secondary"
          onClick={onPaste}>
          I already have a key
        </Button>
      </div>
    </>
  )
}
