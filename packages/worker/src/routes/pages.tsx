import { Hono } from 'hono'
import type { AppEnv } from '../lib/types'
import { LandingPage } from '../components/landing/LandingPage'
import { KeyPage } from '../components/key/KeyPage'

export const pagesRoute = new Hono<AppEnv>()

pagesRoute.get('/', (c) => {
  return c.html(<LandingPage />)
})

pagesRoute.get('/key', (c) => {
  return c.html(<KeyPage />)
})
