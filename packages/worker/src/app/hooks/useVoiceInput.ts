import { useState, useRef, useCallback, useEffect } from 'react'

interface SpeechRecognitionEvent {
  resultIndex: number
  results: SpeechRecognitionResultList
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onend: (() => void) | null
  onerror: ((event: { error: string }) => void) | null
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance
}

function isIOSStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
  const isStandalone =
    (navigator as unknown as { standalone?: boolean }).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  return isIOS && isStandalone
}

function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as Record<string, unknown>
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition) as SpeechRecognitionConstructor | null
}

type UseVoiceInputOptions = {
  onTranscript: (text: string, isFinal: boolean) => void
}

export function useVoiceInput({ onTranscript }: UseVoiceInputOptions) {
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const stoppingRef = useRef(false)

  const isSupported = !isIOSStandalone() && getSpeechRecognition() !== null

  const stop = useCallback(() => {
    stoppingRef.current = true
    recognitionRef.current?.stop()
    setIsListening(false)
  }, [])

  const start = useCallback(() => {
    const SpeechRecognition = getSpeechRecognition()
    if (!SpeechRecognition) return

    recognitionRef.current?.abort()

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognitionRef.current = recognition
    stoppingRef.current = false

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = ''
      let final = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          final += transcript
        } else {
          interim += transcript
        }
      }
      if (final) onTranscript(final, true)
      else if (interim) onTranscript(interim, false)
    }

    recognition.onend = () => {
      if (!stoppingRef.current) {
        // Auto-restart on unexpected end (browser silence timeout)
        try {
          recognition.start()
        } catch {
          setIsListening(false)
        }
        return
      }
      setIsListening(false)
    }

    recognition.onerror = (event: { error: string }) => {
      if (event.error === 'aborted' || event.error === 'no-speech') return
      stoppingRef.current = true
      setIsListening(false)
    }

    try {
      recognition.start()
      setIsListening(true)
    } catch {
      setIsListening(false)
    }
  }, [onTranscript])

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort()
    }
  }, [])

  return { isSupported, isListening, start, stop }
}
