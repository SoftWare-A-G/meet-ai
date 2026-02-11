import { Hono } from 'hono'
import type { AppEnv } from '../lib/types'
import { LandingPage } from '../components/landing/LandingPage'

export const pagesRoute = new Hono<AppEnv>()

pagesRoute.get('/', (c) => {
  return c.html(<LandingPage />)
})
