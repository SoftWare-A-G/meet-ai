type HeadlineProps = {
  text: string
}

export default function Headline({ text }: HeadlineProps) {
  return (
    <h1 className="headline font-mono font-extrabold tracking-tight leading-tight text-center stagger-in">
      {text}
    </h1>
  )
}
