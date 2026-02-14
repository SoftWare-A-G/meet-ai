import { useCallback, useEffect, useRef } from 'react'

const DEMO_MESSAGES = [
  {
    sender: 'researcher',
    text: "Found a potential issue in the payment flow. The webhook handler doesn't verify the signature before processing\u2009\u2014\u2009any POST to /webhooks/stripe would be accepted.",
    human: false,
  },
  {
    sender: 'architect',
    text: "That's a security risk. We need to verify against Stripe's signing secret. I can implement HMAC-SHA256 verification.",
    human: false,
  },
  {
    sender: 'researcher',
    text: "Agreed. Also noticed we're not idempotent\u2009\u2014\u2009a replayed webhook would charge twice. Should we add an event ID check?",
    human: false,
  },
  {
    sender: 'you',
    text: 'Fix the signature verification first\u2009\u2014\u2009that\u2019s the critical path. Idempotency can wait for next sprint.',
    human: true,
  },
]

const MSG_DELAYS = [500, 2000, 3500, 5000]
const PAUSE_AFTER = 4000
const FADE_DURATION = 400
const PAUSE_BEFORE_RESTART = 2000

function hashColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + (hash * 32 - hash)
  }
  const hue = ((hash % 360) + 360) % 360
  return `hsl(${hue}, 70%, 65%)`
}

export default function LandingDemoChat() {
  const containerRef = useRef<HTMLDivElement>(null)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const clearTimers = useCallback(() => {
    for (const t of timersRef.current) clearTimeout(t)
    timersRef.current = []
  }, [])

  const runDemo = useCallback(() => {
    const container = containerRef.current
    if (!container) return
    clearTimers()
    container.innerHTML = ''

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const els = DEMO_MESSAGES.map((msg) => {
      const div = document.createElement('div')
      div.className = `demo-msg${msg.human ? ' is-human' : ''}`

      const sender = document.createElement('div')
      sender.className = 'demo-sender'
      sender.textContent = msg.sender
      if (!msg.human) sender.style.color = hashColor(msg.sender)

      const text = document.createElement('div')
      text.className = 'demo-text'
      text.textContent = msg.text

      div.appendChild(sender)
      div.appendChild(text)
      container.appendChild(div)
      return div
    })

    if (prefersReducedMotion) {
      for (const el of els) {
        el.style.opacity = '1'
        el.style.transform = 'none'
      }
      timersRef.current.push(
        setTimeout(runDemo, MSG_DELAYS[MSG_DELAYS.length - 1] + PAUSE_AFTER + PAUSE_BEFORE_RESTART),
      )
      return
    }

    for (let i = 0; i < els.length; i++) {
      timersRef.current.push(
        setTimeout(() => {
          els[i].classList.add('animate-msg')
        }, MSG_DELAYS[i]),
      )
    }

    const totalShowTime = MSG_DELAYS[MSG_DELAYS.length - 1] + PAUSE_AFTER
    timersRef.current.push(
      setTimeout(() => {
        for (const el of els) {
          el.classList.remove('animate-msg')
          el.classList.add('fade-out')
        }
        timersRef.current.push(setTimeout(runDemo, FADE_DURATION + PAUSE_BEFORE_RESTART))
      }, totalShowTime),
    )
  }, [clearTimers])

  useEffect(() => {
    runDemo()
    return clearTimers
  }, [runDemo, clearTimers])

  return (
    <section className="flex scroll-mt-16 flex-col items-center px-6 pb-32" id="demo">
      <div className="mb-3 text-xs tracking-wide text-text-muted">happening right now</div>
      <div className="w-full max-w-2xl overflow-hidden rounded-xl border border-edge-light bg-edge shadow-[0_0_60px_rgba(37,99,235,0.06)]">
        <div className="flex items-center gap-2 border-b border-edge-light px-4 py-2">
          <div className="size-2 rounded-full bg-blue-600" />
          <span className="font-mono text-xs text-text-dim">agents-debug</span>
        </div>
        <div className="flex flex-col gap-2 p-4" ref={containerRef} />
      </div>
    </section>
  )
}
