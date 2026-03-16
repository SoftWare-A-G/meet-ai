import { create } from 'zustand'
import type { CommandItem } from '../lib/fetchers'

// ── Decision entry types ──────────────────────────────────────────────

export type PlanDecisionEntry = {
  status: 'pending' | 'approved' | 'denied' | 'expired'
  feedback?: string
  permissionMode?: string
}

export type QuestionDecisionEntry = {
  status: 'pending' | 'answered' | 'expired'
  answers?: Record<string, string>
}

export type PermissionDecisionEntry = {
  status: 'pending' | 'approved' | 'denied' | 'expired'
  feedback?: string
}

export type DecisionsData = {
  plan: Record<string, PlanDecisionEntry>
  question: Record<string, QuestionDecisionEntry>
  permission: Record<string, PermissionDecisionEntry>
}

export function emptyDecisionsData(): DecisionsData {
  return { plan: {}, question: {}, permission: {} }
}

// ── Store shape ───────────────────────────────────────────────────────

type RoomStoreState = {
  /** Per-room commands list (keyed by roomId) */
  commands: Record<string, CommandItem[]>
  /** Per-room WS-pushed decision overrides (keyed by roomId) */
  decisions: Record<string, DecisionsData>
}

type RoomStoreActions = {
  setCommands: (roomId: string, commands: CommandItem[]) => void

  setPlanDecision: (roomId: string, reviewId: string, entry: PlanDecisionEntry) => void
  setQuestionAnswer: (roomId: string, reviewId: string, entry: QuestionDecisionEntry) => void
  setPermissionDecision: (roomId: string, reviewId: string, entry: PermissionDecisionEntry) => void
}

export const useRoomStore = create<RoomStoreState & RoomStoreActions>()((set) => ({
  commands: {},
  decisions: {},

  setCommands: (roomId, commands) =>
    set((s) => ({
      commands: { ...s.commands, [roomId]: commands },
    })),

  setPlanDecision: (roomId, reviewId, entry) =>
    set((s) => {
      const current = s.decisions[roomId] ?? emptyDecisionsData()
      return {
        decisions: {
          ...s.decisions,
          [roomId]: {
            ...current,
            plan: { ...current.plan, [reviewId]: entry },
          },
        },
      }
    }),

  setQuestionAnswer: (roomId, reviewId, entry) =>
    set((s) => {
      const current = s.decisions[roomId] ?? emptyDecisionsData()
      return {
        decisions: {
          ...s.decisions,
          [roomId]: {
            ...current,
            question: { ...current.question, [reviewId]: entry },
          },
        },
      }
    }),

  setPermissionDecision: (roomId, reviewId, entry) =>
    set((s) => {
      const current = s.decisions[roomId] ?? emptyDecisionsData()
      return {
        decisions: {
          ...s.decisions,
          [roomId]: {
            ...current,
            permission: { ...current.permission, [reviewId]: entry },
          },
        },
      }
    }),
}))

// ── Selector hooks (convenience) ──────────────────────────────────────

// Stable fallback references to avoid new-object-every-render in selectors.
// Zustand uses Object.is for equality; without these, `[] !== []` and
// `{} !== {}` would cause infinite re-renders when a room has no data yet.
const EMPTY_COMMANDS: CommandItem[] = []
const EMPTY_DECISIONS: DecisionsData = emptyDecisionsData()

export function useCommands(roomId: string | null) {
  return useRoomStore((s) => (roomId ? s.commands[roomId] : undefined) ?? EMPTY_COMMANDS)
}

export function useDecisionOverrides(roomId: string) {
  return useRoomStore((s) => s.decisions[roomId] ?? EMPTY_DECISIONS)
}
