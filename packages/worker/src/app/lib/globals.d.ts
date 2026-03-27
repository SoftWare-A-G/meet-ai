declare module '*.css?url' {
  const url: string
  export default url
}

interface Navigator {
  standalone?: boolean
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
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance
}

interface Window {
  retryMessage?: (retryEl: HTMLElement) => void
  MSStream?: unknown
  SpeechRecognition?: SpeechRecognitionConstructor
  webkitSpeechRecognition?: SpeechRecognitionConstructor
}

interface SyncManager {
  register(tag: string): Promise<void>
}

interface ServiceWorkerRegistration {
  sync?: SyncManager
}

interface WindowEventMap {
  'meet-ai:insert-mention': CustomEvent<{ name: string }>
}
