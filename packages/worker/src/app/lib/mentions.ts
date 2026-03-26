export function insertMention(name: string) {
  window.dispatchEvent(new CustomEvent('meet-ai:insert-mention', { detail: { name } }))
}
