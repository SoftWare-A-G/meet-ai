import { useEffect } from 'hono/jsx/dom'

type ToastProps = {
  text: string
  onDone: () => void
}

export default function Toast({ text, onDone }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDone, 2100)
    return () => clearTimeout(timer)
  }, [onDone])

  return <div class="toast">{text}</div>
}
