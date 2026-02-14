type KeyHeadlineProps = {
  text: string
}

export default function KeyHeadline({ text }: KeyHeadlineProps) {
  return (
    <h1 className="headline stagger-in text-center font-mono font-extrabold leading-tight tracking-tight">
      {text}
    </h1>
  )
}
