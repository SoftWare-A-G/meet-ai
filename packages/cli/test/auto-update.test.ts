import { test, expect, mock } from 'bun:test'
import { EventEmitter } from 'node:events'
import { isNewer, CURRENT_VERSION, restartApp } from '@meet-ai/cli/lib/auto-update'

test('CURRENT_VERSION is a valid semver string', () => {
  expect(CURRENT_VERSION).toMatch(/^\d+\.\d+\.\d+/)
})

test('isNewer returns true when remote is greater (patch)', () => {
  expect(isNewer('0.3.2', '0.3.1')).toBe(true)
})

test('isNewer returns true when remote is greater (minor)', () => {
  expect(isNewer('0.4.0', '0.3.1')).toBe(true)
})

test('isNewer returns true when remote is greater (major)', () => {
  expect(isNewer('1.0.0', '0.3.1')).toBe(true)
})

test('isNewer returns false when versions are equal', () => {
  expect(isNewer('0.3.1', '0.3.1')).toBe(false)
})

test('isNewer returns false when remote is older (patch)', () => {
  expect(isNewer('0.3.0', '0.3.1')).toBe(false)
})

test('isNewer returns false when remote is older (minor)', () => {
  expect(isNewer('0.2.9', '0.3.1')).toBe(false)
})

test('isNewer returns false when remote is older (major)', () => {
  expect(isNewer('0.3.1', '1.0.0')).toBe(false)
})

test('isNewer handles large version numbers', () => {
  expect(isNewer('10.20.30', '10.20.29')).toBe(true)
  expect(isNewer('10.20.29', '10.20.30')).toBe(false)
})

test('restartApp spawns the replacement on the inherited TTY without detaching', async () => {
  const child = new EventEmitter() as EventEmitter & { pid: number }
  child.pid = 4242

  const spawn = mock((_execPath: string, _argv: readonly string[], options: object) => {
    queueMicrotask(() => {
      child.emit('exit', 0, null)
    })
    expect(options).toEqual({ stdio: 'inherit' })
    return child as never
  })
  const exit = mock((_code?: number) => undefined as never)
  const kill = mock((_pid: number, _signal?: string | number) => true as const)

  void restartApp({
    execPath: '/usr/local/bin/node',
    argv: ['dist/index.js'],
    spawn,
    exit,
    kill,
  })

  await new Promise(resolve => setTimeout(resolve, 0))

  expect(spawn).toHaveBeenCalledTimes(1)
  expect(exit).toHaveBeenCalledWith(0)
  expect(kill).not.toHaveBeenCalled()
})

test('restartApp mirrors child signal exits onto the current process', async () => {
  const child = new EventEmitter() as EventEmitter & { pid: number }
  child.pid = 31337

  const spawn = mock((_execPath: string, _argv: readonly string[], _options: object) => {
    queueMicrotask(() => {
      child.emit('exit', null, 'SIGTERM')
    })
    return child as never
  })
  const exit = mock((_code?: number) => undefined as never)
  const kill = mock((_pid: number, _signal?: string | number) => true as const)

  void restartApp({
    execPath: '/usr/local/bin/node',
    argv: ['dist/index.js'],
    spawn,
    exit,
    kill,
  })

  await new Promise(resolve => setTimeout(resolve, 0))

  expect(kill).toHaveBeenCalledWith(process.pid, 'SIGTERM')
  expect(exit).not.toHaveBeenCalled()
})
