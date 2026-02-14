import { Hono } from 'hono'
import { createElement } from 'hono/jsx'
import { ChatPage } from '../components/chat/ChatPage'
import type { AppEnv } from '../lib/types'

export const pagesRoute = new Hono<AppEnv>()

const render = (component: ReturnType<typeof createElement>) =>
  `<!DOCTYPE html>${component.toString()}`

pagesRoute.get('/chat', c => c.html(render(createElement(ChatPage, {}))))

pagesRoute.get('/chat/:roomId', c => c.html(render(createElement(ChatPage, {}))))
