import { useEffect } from 'react'

type ToastProps = {
  text: string
  onDone: () => void
}

export default function Toast({ text, onDone }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDone, 2100)
    return () => clearTimeout(timer)
  }, [onDone])

  return <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-[#3FB950] text-black px-5 py-2.5 rounded-lg text-sm font-semibold z-[200] pointer-events-none animate-toast-fade">{text}</div>
}
