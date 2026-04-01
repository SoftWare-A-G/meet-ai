import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { mkdirSync, unlinkSync, rmSync, writeFileSync } from 'node:fs'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { runCli } from '../helpers/run-cli'

// ---------- Mock server ----------

let server: ReturnType<typeof createServer> | undefined
let baseUrl: string
let serverStartError: Error | null = null

// Temp home dirs for writing ~/.meet-ai/config.json
let tempHome: string
let unreachableHome: string

function writeHomeConfig(homeDir: string, url: string, key: string) {
  const meetaiDir = `${homeDir}/.meet-ai`
  mkdirSync(meetaiDir, { recursive: true })
  writeFileSync(
    `${meetaiDir}/config.json`,
    JSON.stringify({
      $schema: 'https://meet-ai.cc/schemas/config.json',
      defaultEnv: 'default',
      envs: { default: { url, key } },
    }),
  )
}

function readJsonBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.setEncoding('utf8')
    req.on('data', chunk => {
      body += chunk
    })
    req.on('end', () => {
      try {
        const json = body ? JSON.parse(body) : {}
        resolve(json)
      } catch (error) {
        reject(error)
      }
    })
    req.on('error', reject)
  })
}

function sendJson(res: ServerResponse, status: number, payload: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(payload))
}

beforeAll(async () => {
  server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    const method = req.method ?? 'GET'

    // POST /api/projects — upsert project
    if (method === 'POST' && url.pathname === '/api/projects') {
      const body = (await readJsonBody(req)) as { id: string; name: string }
      sendJson(res, 201, { id: body.id, name: body.name })
      return
    }

    // POST /api/rooms — create room
    if (method === 'POST' && url.pathname === '/api/rooms') {
      const body = (await readJsonBody(req)) as { name: string; project_id?: string }
      sendJson(res, 200, { id: 'room-abc-123', name: body.name, project_id: body.project_id ?? null })
      return
    }

    // POST /api/rooms/:id/messages — send message
    if (method === 'POST' && /^\/api\/rooms\/[^/]+\/messages$/.test(url.pathname)) {
      const body = (await readJsonBody(req)) as { sender: string; content: string }
      sendJson(res, 200, {
        id: 'msg-001',
        roomId: 'room-abc-123',
        sender: body.sender,
        sender_type: 'agent',
        content: body.content,
      })
      return
    }

    // GET /api/rooms/:id/messages — poll
    if (method === 'GET' && /^\/api\/rooms\/[^/]+\/messages$/.test(url.pathname)) {
      sendJson(res, 200, [])
      return
    }

    // GET /api/rooms/:roomId/messages/:msgId/attachments — message attachments
    if (
      method === 'GET' &&
      /^\/api\/rooms\/[^/]+\/messages\/[^/]+\/attachments$/.test(url.pathname)
    ) {
      sendJson(res, 200, [])
      return
    }

    // POST /api/keys — generate key
    if (method === 'POST' && url.pathname === '/api/keys') {
      sendJson(res, 200, { key: 'mai_test_abc123', prefix: 'mai_test' })
      return
    }

    // GET /api/attachments/:id — download attachment
    if (method === 'GET' && /^\/api\/attachments\/[^/]+$/.test(url.pathname)) {
      res.statusCode = 200
      res.end(Buffer.from([1, 2, 3]))
      return
    }

    // DELETE /api/rooms/:id — delete room
    if (method === 'DELETE' && /^\/api\/rooms\/[^/]+$/.test(url.pathname)) {
      res.statusCode = 204
      res.end()
      return
    }

    sendJson(res, 404, { error: 'Not found' })
  })

  try {
    await new Promise<void>((resolve, reject) => {
      server!.listen(0, '127.0.0.1', () => resolve())
      server!.once('error', reject)
    })
  } catch (error) {
    serverStartError = error instanceof Error ? error : new Error(String(error))
    return
  }

  const address = server.address()
  if (!address || typeof address === 'string') {
    serverStartError = new Error('Failed to resolve integration test server address')
    return
  }
  baseUrl = `http://127.0.0.1:${address.port}`

  // Create temp home dirs with config files
  tempHome = '/tmp/meet-ai-cli-integ-home'
  unreachableHome = '/tmp/meet-ai-cli-integ-unreachable'
  rmSync(tempHome, { recursive: true, force: true })
  rmSync(unreachableHome, { recursive: true, force: true })
  writeHomeConfig(tempHome, baseUrl, 'mai_testkey123')
  writeHomeConfig(unreachableHome, 'http://127.0.0.1:1', 'mai_testkey123')
})

afterAll(() => {
  server?.close()
  rmSync(tempHome, { recursive: true, force: true })
  rmSync(unreachableHome, { recursive: true, force: true })
})

function env(extra?: Record<string, string>) {
  return { HOME: tempHome, ...extra }
}

function skipIfServerUnavailable() {
  if (serverStartError) {
    return true
  }
  return false
}

// ---------- Success paths ----------

describe('success paths (mock server)', () => {
  it('create-room prints room ID and exits 0', async () => {
    if (skipIfServerUnavailable()) return
    // GIVEN a running mock server
    // WHEN we create a room via CLI
    const result = await runCli(['create-room', 'test-room'], env())

    // THEN it exits 0 and stdout contains the room ID
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('room-abc-123')
  })

  it('send-message prints message ID and exits 0', async () => {
    if (skipIfServerUnavailable()) return
    // GIVEN a running mock server
    // WHEN we send a message via CLI
    const result = await runCli(['send-message', 'room-abc-123', 'bot', 'hello world'], env())

    // THEN it exits 0 and stdout contains the message ID
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('msg-001')
  })

  it('poll returns JSON array and exits 0', async () => {
    if (skipIfServerUnavailable()) return
    // GIVEN a running mock server
    // WHEN we poll messages via CLI
    const result = await runCli(['poll', 'room-abc-123'], env())

    // THEN it exits 0 and stdout is a valid JSON array
    expect(result.exitCode).toBe(0)
    const parsed = JSON.parse(result.stdout)
    expect(Array.isArray(parsed)).toBe(true)
  })

  it('generate-key prints key and exits 0', async () => {
    if (skipIfServerUnavailable()) return
    // GIVEN a running mock server
    // WHEN we generate a key via CLI
    const result = await runCli(['generate-key'], env())

    // THEN it exits 0 and stdout contains the key
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('mai_test_abc123')
  })

  it('delete-room prints success and exits 0', async () => {
    if (skipIfServerUnavailable()) return
    // GIVEN a running mock server
    // WHEN we delete a room via CLI
    const result = await runCli(['delete-room', 'room-abc-123'], env())

    // THEN it exits 0 and stdout confirms deletion
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('room-abc-123')
  })

  it('download-attachment downloads file and exits 0', async () => {
    if (skipIfServerUnavailable()) return
    // GIVEN a running mock server that serves attachment binary data
    // WHEN we download an attachment via CLI
    const result = await runCli(['download-attachment', 'test-att-123'], env())

    // THEN it exits 0 and stdout contains the local file path
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('/tmp/meet-ai-attachments/')

    // Clean up downloaded file
    try {
      unlinkSync('/tmp/meet-ai-attachments/test-att-123.bin')
    } catch {}
  })
})

// ---------- Validation failure paths ----------

describe('validation failure paths', () => {
  it('send-message with no args exits 1', async () => {
    if (skipIfServerUnavailable()) return
    // GIVEN no arguments
    // WHEN we invoke send-message
    const result = await runCli(['send-message'], env())

    // THEN it exits 1 and stderr has an error
    expect(result.exitCode).toBe(1)
    expect(result.stderr.length).toBeGreaterThan(0)
  })

  it('create-room with no args exits 1', async () => {
    if (skipIfServerUnavailable()) return
    // GIVEN no room name argument
    // WHEN we invoke create-room
    const result = await runCli(['create-room'], env())

    // THEN it exits 1 and stderr has an error
    expect(result.exitCode).toBe(1)
    expect(result.stderr.length).toBeGreaterThan(0)
  })

  it('send-message with empty roomId exits 1', async () => {
    if (skipIfServerUnavailable()) return
    // GIVEN an empty string for roomId
    // WHEN we invoke send-message
    const result = await runCli(['send-message', '', 'bot', 'hello'], env())

    // THEN it exits 1 due to zod validation (empty roomId)
    expect(result.exitCode).toBe(1)
    expect(result.stderr.length).toBeGreaterThan(0)
  })

  it('download-attachment with no args exits 1', async () => {
    if (skipIfServerUnavailable()) return
    // GIVEN no attachment ID argument
    // WHEN we invoke download-attachment
    const result = await runCli(['download-attachment'], env())

    // THEN it exits 1 and stderr has an error
    expect(result.exitCode).toBe(1)
    expect(result.stderr.length).toBeGreaterThan(0)
  })
})

// ---------- API failure paths ----------

describe('API failure paths', () => {
  it('bare meet-ai without a TTY exits 1 before launching the TUI', async () => {
    const result = await runCli([], {
      MEET_AI_RUNTIME: '',
      CODEX_HOME: '/nonexistent',
      HOME: '/nonexistent',
    })

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('requires an interactive terminal')
    expect(result.stderr).not.toContain('tmux is required')
    expect(result.stderr).not.toContain('Raw mode is not supported')
  })

  it('create-room with unreachable server exits 1 with error', async () => {
    // GIVEN a home config pointing to an unreachable server
    // WHEN we try to create a room
    const result = await runCli(['create-room', 'test-room'], {
      HOME: unreachableHome,
    })

    // THEN it exits 1 and stderr has an error (no raw stack traces)
    expect(result.exitCode).toBe(1)
    expect(result.stderr.length).toBeGreaterThan(0)
    expect(result.stderr).not.toContain('    at ')
  })

  it('send-message with unreachable server exits 1 with error', async () => {
    // GIVEN a home config pointing to an unreachable server
    // WHEN we try to send a message
    const result = await runCli(['send-message', 'room-123', 'bot', 'hello'], {
      HOME: unreachableHome,
    })

    // THEN it exits 1 and stderr has an error (no raw stack traces)
    expect(result.exitCode).toBe(1)
    expect(result.stderr.length).toBeGreaterThan(0)
    expect(result.stderr).not.toContain('    at ')
  }, 15_000)

  it('generate-key with unreachable server exits 1 with error', async () => {
    // GIVEN a home config pointing to an unreachable server
    // WHEN we try to generate a key
    const result = await runCli(['generate-key'], {
      HOME: unreachableHome,
    })

    // THEN it exits 1 and stderr has an error (no raw stack traces)
    expect(result.exitCode).toBe(1)
    expect(result.stderr.length).toBeGreaterThan(0)
    expect(result.stderr).not.toContain('    at ')
  })
})

// ---------- Missing credentials ----------

describe('missing credentials', () => {
  it('create-room with no home config exits 1 with setup error', async () => {
    // GIVEN: HOME points to a dir without .meet-ai/config.json
    const noConfigHome = '/tmp/meet-ai-cli-integ-no-config'
    rmSync(noConfigHome, { recursive: true, force: true })
    mkdirSync(noConfigHome, { recursive: true })

    // WHEN: we try to create a room
    const result = await runCli(['create-room', 'test-room'], {
      HOME: noConfigHome,
    })

    // THEN: it exits 1 and stderr contains the setup error
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain("No meet-ai credentials found. Run 'meet-ai' to set up.")

    rmSync(noConfigHome, { recursive: true, force: true })
  })
})

// ---------- Help text ----------

describe('help text', () => {
  it('--help exits 0 and shows command list', async () => {
    // GIVEN the --help flag
    // WHEN we invoke the CLI
    const result = await runCli(['--help'])

    // THEN it exits 0 and stdout lists available commands
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('create-room')
    expect(result.stdout).toContain('send-message')
    expect(result.stdout).toContain('poll')
  })

  it('create-room --help exits 0 and shows description', async () => {
    // GIVEN the --help flag on a subcommand
    // WHEN we invoke create-room --help
    const result = await runCli(['create-room', '--help'])

    // THEN it exits 0 and stdout describes the command
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('Create a new chat room')
  })

  it('send-message --help exits 0 and shows description', async () => {
    // GIVEN the --help flag on a subcommand
    // WHEN we invoke send-message --help
    const result = await runCli(['send-message', '--help'])

    // THEN it exits 0 and stdout describes the command
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('Send a message')
  })

  it('poll --help exits 0 and shows description', async () => {
    // GIVEN the --help flag on a subcommand
    // WHEN we invoke poll --help
    const result = await runCli(['poll', '--help'])

    // THEN it exits 0 and stdout describes the command
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('Poll for new messages')
  })
})
