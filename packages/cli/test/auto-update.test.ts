import { test, expect } from 'bun:test'
import { isNewer, CURRENT_VERSION } from '@meet-ai/cli/lib/auto-update'

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
