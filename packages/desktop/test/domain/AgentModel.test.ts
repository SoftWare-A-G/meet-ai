import { describe, expect, it } from 'bun:test'
import {
  getLevel,
  addXP,
  createAgentData,
  computeSpawnPosition,
  computeZoneTarget,
  computeWanderTarget,
  checkIdleWander,
  lerpPosition,
} from '../../src/mainview/domain/models/AgentModel'
import type { AgentData } from '../../src/mainview/types'

function makeAgent(overrides: Partial<AgentData> = {}): AgentData {
  return {
    id: 'test',
    name: 'test-agent',
    color: '#ff0000',
    role: 'worker',
    status: 'working',
    xp: 0,
    level: 1,
    focus: 100,
    fatigue: 0,
    mood: 75,
    tasksCompleted: 0,
    messagesCount: 0,
    toolUses: 0,
    boosted: false,
    boostEndTime: 0,
    bobPhase: 0,
    bobSpeed: 2,
    lastActivity: Date.now(),
    spawnIndex: 0,
    nextWanderTime: Date.now() + 10000,
    lastToolXpTime: 0,
    ...overrides,
  }
}

describe('AgentModel', () => {
  describe('getLevel', () => {
    it('returns 1 for 0 XP', () => {
      expect(getLevel(0)).toBe(1)
    })

    it('returns 2 for 10 XP', () => {
      expect(getLevel(10)).toBe(2)
    })

    it('scales with square root', () => {
      // sqrt(40/10) = 2, floor + 1 = 3
      expect(getLevel(40)).toBe(3)
      // sqrt(90/10) = 3, floor + 1 = 4
      expect(getLevel(90)).toBe(4)
    })
  })

  describe('addXP', () => {
    it('adds XP and updates level', () => {
      const agent = makeAgent({ xp: 0, level: 1 })
      const result = addXP(agent, 5)
      expect(agent.xp).toBe(5)
      expect(result.leveledUp).toBe(false)
    })

    it('detects level up', () => {
      const agent = makeAgent({ xp: 9, level: 1 })
      const result = addXP(agent, 1)
      expect(agent.xp).toBe(10)
      expect(agent.level).toBe(2)
      expect(result.leveledUp).toBe(true)
      expect(result.newLevel).toBe(2)
    })

    it('does not false-positive level up', () => {
      const agent = makeAgent({ xp: 5, level: 1 })
      const result = addXP(agent, 1)
      expect(result.leveledUp).toBe(false)
    })
  })

  describe('createAgentData', () => {
    it('creates agent with correct defaults', () => {
      const agent = createAgentData('id-1', 'coder', '#00ff00', 'developer', 'active', 0)
      expect(agent.id).toBe('id-1')
      expect(agent.name).toBe('coder')
      expect(agent.color).toBe('#00ff00')
      expect(agent.status).toBe('working')
      expect(agent.xp).toBe(0)
      expect(agent.level).toBe(1)
      expect(agent.focus).toBe(100)
      expect(agent.fatigue).toBe(0)
      expect(agent.mood).toBe(75)
      expect(agent.lastToolXpTime).toBe(0)
    })

    it('sets idle status for inactive members', () => {
      const agent = createAgentData('id-2', 'idle-agent', '#000', 'worker', 'inactive', 0)
      expect(agent.status).toBe('idle')
    })
  })

  describe('computeSpawnPosition', () => {
    it('returns positions on a circle', () => {
      const p0 = computeSpawnPosition(0, 4)
      const p1 = computeSpawnPosition(1, 4)
      // Both should be at SPAWN_RADIUS distance from origin
      const dist0 = Math.sqrt(p0.x ** 2 + p0.z ** 2)
      const dist1 = Math.sqrt(p1.x ** 2 + p1.z ** 2)
      expect(dist0).toBeCloseTo(2, 1)
      expect(dist1).toBeCloseTo(2, 1)
    })
  })

  describe('computeZoneTarget', () => {
    it('returns a position near the zone center', () => {
      const target = computeZoneTarget('library')
      // Library is at (0, -8) with scatter radius 1.5
      expect(target.x).toBeGreaterThanOrEqual(-3)
      expect(target.x).toBeLessThanOrEqual(3)
      expect(target.z).toBeGreaterThanOrEqual(-11)
      expect(target.z).toBeLessThanOrEqual(-5)
    })
  })

  describe('computeWanderTarget', () => {
    it('returns a position near the current position', () => {
      const target = computeWanderTarget(5, 5)
      expect(target.x).toBeGreaterThanOrEqual(5 - 1.5)
      expect(target.x).toBeLessThanOrEqual(5 + 1.5)
      expect(target.z).toBeGreaterThanOrEqual(5 - 1.5)
      expect(target.z).toBeLessThanOrEqual(5 + 1.5)
    })
  })

  describe('checkIdleWander', () => {
    it('returns shouldWander=false when agent is working', () => {
      const agent = makeAgent({ status: 'working', nextWanderTime: 0 })
      const result = checkIdleWander(agent, 0, 0, Date.now())
      expect(result.shouldWander).toBe(false)
      expect(result.target).toBeUndefined()
    })

    it('returns shouldWander=false when agent is idle but not yet due', () => {
      const future = Date.now() + 60000
      const agent = makeAgent({ status: 'idle', nextWanderTime: future })
      const result = checkIdleWander(agent, 0, 0, Date.now())
      expect(result.shouldWander).toBe(false)
    })

    it('returns shouldWander=true with target when idle and past wander time', () => {
      const past = Date.now() - 1000
      const agent = makeAgent({ status: 'idle', nextWanderTime: past })
      const result = checkIdleWander(agent, 5, 5, Date.now())
      expect(result.shouldWander).toBe(true)
      expect(result.target).toBeDefined()
      // Target should be near the current position (within WANDER_RADIUS=1.5)
      expect(result.target!.x).toBeGreaterThanOrEqual(5 - 1.5)
      expect(result.target!.x).toBeLessThanOrEqual(5 + 1.5)
      expect(result.target!.z).toBeGreaterThanOrEqual(5 - 1.5)
      expect(result.target!.z).toBeLessThanOrEqual(5 + 1.5)
    })

    it('updates nextWanderTime on the agent when wandering', () => {
      const past = Date.now() - 1000
      const agent = makeAgent({ status: 'idle', nextWanderTime: past })
      const beforeCall = Date.now()
      checkIdleWander(agent, 0, 0, Date.now())
      // nextWanderTime should be set to a future time (now + 5000..10000ms)
      expect(agent.nextWanderTime).toBeGreaterThanOrEqual(beforeCall + 5000)
      expect(agent.nextWanderTime).toBeLessThanOrEqual(beforeCall + 10000 + 50) // small tolerance
    })
  })

  describe('lerpPosition', () => {
    it('moves toward target', () => {
      const result = lerpPosition(0, 0, 10, 0, 0.1)
      expect(result.x).toBeGreaterThan(0)
      expect(result.z).toBe(0)
      expect(result.distance).toBeGreaterThan(0)
    })

    it('snaps when very close', () => {
      const result = lerpPosition(9.999, 0, 10, 0, 0.1)
      expect(result.x).toBe(10)
      expect(result.z).toBe(0)
      expect(result.distance).toBe(0)
    })

    it('does not overshoot', () => {
      const result = lerpPosition(0, 0, 1, 0, 10)
      // t = min(1, 3.0 * 10) = 1, so should reach target
      expect(result.x).toBe(1)
    })
  })
})
