import { describe, expect, it } from 'bun:test'
import { parsePaneListLine, parseVersion } from './tmux-client'

describe('parsePaneListLine', () => {
  it('parses a well-formed row', () => {
    expect(parsePaneListLine('0\tmy-pane\t1')).toEqual({
      index: 0,
      title: 'my-pane',
      active: true,
    })
  })

  it('treats a non-"1" active column as inactive', () => {
    expect(parsePaneListLine('2\ttitle\t0')).toEqual({
      index: 2,
      title: 'title',
      active: false,
    })
  })

  it('returns null when older tmux echoes the literal format token', () => {
    // Reproduces the crash reported by client running inside tmux-in-docker:
    // older tmux versions emit "#{pane_index}" verbatim when they don't know the token,
    // which becomes NaN and then "session.NaN" when concatenated into a capture target.
    expect(parsePaneListLine('#{pane_index}\tterm\t1')).toBeNull()
  })

  it('returns null when a tab inside pane_title shifts the columns', () => {
    // PROMPT_COMMAND can stuff a tab into pane_title; the first column then becomes
    // a non-numeric fragment of the title rather than the index.
    expect(parsePaneListLine('weird-title-fragment\trest\t1')).toBeNull()
  })

  it('defaults missing active column to inactive (not throw)', () => {
    expect(parsePaneListLine('1\ttitle')).toEqual({
      index: 1,
      title: 'title',
      active: false,
    })
  })
})

describe('parseVersion', () => {
  it('parses standard tmux version output', () => {
    expect(parseVersion('tmux 3.4')).toEqual([3, 4])
  })

  it('returns [0, 0] for null input', () => {
    expect(parseVersion(null)).toEqual([0, 0])
  })

  it('returns [0, 0] when no version match exists', () => {
    expect(parseVersion('not-a-version')).toEqual([0, 0])
  })
})
