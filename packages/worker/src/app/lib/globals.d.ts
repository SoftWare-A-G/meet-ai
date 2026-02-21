declare module '*.css?url' {
  const url: string
  export default url
}

interface Window {
  retryMessage?: (retryEl: HTMLElement) => void
}
