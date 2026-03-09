import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { queries } from '../db/queries'
import { requireAuth } from '../middleware/auth'
import { createProjectSchema, updateProjectSchema } from '../schemas/projects'
import type { AppEnv } from '../lib/types'

export const projectsRoute = new Hono<AppEnv>()

  // GET /api/projects — list projects for this API key
  .get('/', requireAuth, async c => {
    const keyId = c.get('keyId')
    const db = queries(c.env.DB)
    const projects = await db.listProjects(keyId)
    return c.json(projects)
  })

  // POST /api/projects — create or upsert a project
  .post('/', requireAuth, zValidator('json', createProjectSchema), async c => {
    const keyId = c.get('keyId')
    const body = c.req.valid('json')
    const db = queries(c.env.DB)
    const project = await db.upsertProject(body.id, keyId, body.name)
    return c.json(project, 201)
  })

  // GET /api/projects/:id — get a single project
  .get('/:id', requireAuth, async c => {
    const keyId = c.get('keyId')
    const projectId = c.req.param('id')
    if (!/^[0-9a-f]{16}$/.test(projectId)) {
      return c.json({ error: 'invalid project id' }, 400)
    }
    const db = queries(c.env.DB)
    const project = await db.findProject(projectId, keyId)
    if (!project) {
      return c.json({ error: 'project not found' }, 404)
    }
    return c.json(project)
  })

  // PATCH /api/projects/:id — rename a project
  .patch('/:id', requireAuth, zValidator('json', updateProjectSchema), async c => {
    const keyId = c.get('keyId')
    const projectId = c.req.param('id')
    if (!/^[0-9a-f]{16}$/.test(projectId)) {
      return c.json({ error: 'invalid project id' }, 400)
    }
    const body = c.req.valid('json')
    const db = queries(c.env.DB)

    const existing = await db.findProject(projectId, keyId)
    if (!existing) {
      return c.json({ error: 'project not found' }, 404)
    }

    const project = await db.upsertProject(projectId, keyId, body.name)
    return c.json(project)
  })
