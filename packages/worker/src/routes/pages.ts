import { Hono } from 'hono'
import { createElement } from 'hono/jsx'
import { ChatPage } from '../components/chat/ChatPage'
import { KeyPage } from '../components/key/KeyPage'
import { LandingPage } from '../components/landing/LandingPage'
import { landingMarkdown } from '../landing-md'
import type { AppEnv } from '../lib/types'

export const pagesRoute = new Hono<AppEnv>()

const render = (component: ReturnType<typeof createElement>) =>
  `<!DOCTYPE html>${component.toString()}`

pagesRoute.get('/', (c) => {
  const accept = c.req.header('Accept') || ''
  if (accept.includes('text/markdown')) {
    return c.text(landingMarkdown, 200, { 'Content-Type': 'text/markdown; charset=UTF-8' })
  }
  return c.html(render(createElement(LandingPage, {})))
})

pagesRoute.get('/key', c => c.html(render(createElement(KeyPage, {}))))

pagesRoute.get('/chat', c => c.html(render(createElement(ChatPage, {}))))

pagesRoute.get('/chat/:roomId', c => c.html(render(createElement(ChatPage, {}))))
