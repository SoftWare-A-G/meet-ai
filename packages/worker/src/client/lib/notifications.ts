import type { Message } from './types'

/**
 * Request notification permission if it hasn't been decided yet.
 * Returns the resulting permission state.
 */
export async function requestPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied'
  if (Notification.permission !== 'default') return Notification.permission
  return Notification.requestPermission()
}

/**
 * Show a browser notification for an incoming chat message.
 * Only shows when the tab is hidden and permission is granted.
 * Skips log messages and messages from the current user.
 */
export function notifyIfHidden(msg: Message, currentUser: string, roomName: string): void {
  if (!('Notification' in window)) return
  if (Notification.permission !== 'granted') return
  if (document.visibilityState !== 'hidden') return
  if (msg.type === 'log') return
  if (msg.sender === currentUser) return

  const notification = new Notification(msg.sender, {
    body: `${roomName}\n${msg.content.slice(0, 100)}`,
    tag: msg.id ?? msg.message_id ?? undefined,
    icon: '/favicon.ico',
  })

  notification.onclick = () => {
    window.focus()
    notification.close()
  }
}
