import { mock, beforeEach, afterEach } from 'bun:test'

/**
 * Saves globalThis.fetch before each test, replaces it with a bun mock,
 * and restores the original after each test.
 *
 * Returns the mock function so tests can configure responses.
 *
 * Usage:
 *   const mockFetch = withMockFetch()
 *   // inside a test:
 *   mockFetch.mockResolvedValueOnce(new Response(...))
 */
export function withMockFetch(defaultImpl?: (...args: unknown[]) => unknown) {
  const originalFetch = globalThis.fetch
  const mockFetch = defaultImpl ? mock(defaultImpl) : mock()

  beforeEach(() => {
    mockFetch.mockReset()
    if (defaultImpl) mockFetch.mockImplementation(defaultImpl)
    globalThis.fetch = mockFetch as unknown as typeof fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  return mockFetch
}
