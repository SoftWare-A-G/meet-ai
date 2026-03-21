import * as Phaser from 'phaser'
import {
	BOB_AMPLITUDE,
	BUBBLE_DURATION,
	GLOW_PULSE_SPEED,
	ZONES,
	classifyAgent,
} from '../constants'
import type { ContractData } from '../domain/interfaces/IGameState'
import type { ISceneAdapter } from '../domain/interfaces/ISceneAdapter'
import { checkIdleWander, lerpPosition } from '../domain/models/AgentModel'
import { createAgentGraphics } from '../rendering/AgentRenderer'
import { EffectsManager } from '../rendering/EffectsManager'
import type { GameScene } from '../rendering/GameScene'
import { worldToScreen } from '../rendering/IsoProjection'
import { createPhaserGame } from '../rendering/SceneSetup'
import { buildZones } from '../rendering/ZoneBuilder'
import type { AgentData, AgentRenderState, FrameContext, TeamMember } from '../types'

function hexToNumber(hex: string): number {
	return parseInt(hex.replace('#', ''), 16)
}

interface AgentScaleInfo {
	bodyScaleX: number
	bodyScaleY: number
	headSize: number
}

export class PhaserSceneAdapter implements ISceneAdapter {
	private readonly game: Phaser.Game
	private gameScene: GameScene | null = null
	private effects: EffectsManager | null = null
	private readonly agents = new Map<string, AgentRenderState>()
	private readonly agentScales = new Map<string, AgentScaleInfo>()
	private readonly contractScrolls = new Map<string, Phaser.GameObjects.DOMElement>()
	private readonly bubbleOffsets = new Map<string, number>()
	private pendingLoopCallback: (() => void) | null = null

	readonly canvas: HTMLCanvasElement

	constructor() {
		this.game = createPhaserGame()
		this.canvas = this.game.canvas

		// Safety net: if startLoop() can't find the scene (e.g. Phaser
		// deferred scene boot), init on the first game step — by then
		// all scenes are guaranteed to have completed create().
		this.game.events.once('step', () => {
			if (this.gameScene) return
			const scene = this.game.scene.getScene('GameScene') as GameScene | undefined
			if (scene) this.initScene(scene)
		})
	}

	private initScene(scene: GameScene): void {
		this.gameScene = scene
		buildZones(scene)
		this.effects = new EffectsManager(scene)
		if (this.pendingLoopCallback) {
			scene.setUpdateCallback(this.pendingLoopCallback)
			this.pendingLoopCallback = null
		}
	}

	// ── Agent Lifecycle ──

	createAgent(member: TeamMember, spawnIndex: number, totalAgents: number): void {
		if (!this.gameScene) return
		const renderState = createAgentGraphics(this.gameScene, member, spawnIndex, totalAgents)
		this.agents.set(member.teammate_id, renderState)

		const agentClass = classifyAgent(member.name, member.role)
		this.agentScales.set(member.teammate_id, {
			bodyScaleX: agentClass.bodyScale.x,
			bodyScaleY: agentClass.bodyScale.y,
			headSize: agentClass.headSize,
		})
	}

	removeAgent(id: string): void {
		const rs = this.agents.get(id)
		if (!rs) return
		if (rs.bubble) {
			rs.bubble.destroy()
			rs.bubble = null
		}
		if (rs.bubbleTimeout) {
			clearTimeout(rs.bubbleTimeout)
			rs.bubbleTimeout = null
		}
		rs.group.destroy(true)
		this.agents.delete(id)
		this.agentScales.delete(id)
		this.bubbleOffsets.delete(id)
	}

	// ── Agent Visuals ──

	updateAgentColor(id: string, color: string): void {
		const rs = this.agents.get(id)
		if (!rs) return
		const scale = this.agentScales.get(id)
		if (!scale) return
		const hex = hexToNumber(color)

		rs.bodyMesh.clear()
		rs.bodyMesh.fillStyle(hex, 1)
		rs.bodyMesh.fillEllipse(0, 0, 30 * scale.bodyScaleX, 20 * scale.bodyScaleY)

		rs.headMesh.clear()
		rs.headMesh.fillStyle(hex, 1)
		rs.headMesh.fillCircle(0, -15 * scale.bodyScaleY, scale.headSize * 40)
	}

	updateAgentLabel(id: string, labelText: string): void {
		const rs = this.agents.get(id)
		if (!rs) return
		rs.nameLabel.setText(labelText)
	}

	updateAgentLabelColor(id: string, color: string): void {
		const rs = this.agents.get(id)
		if (!rs) return
		rs.nameLabel.setColor(color)
	}

	setAgentGlow(id: string, status: AgentData['status']): void {
		const rs = this.agents.get(id)
		if (!rs) return
		let color: number
		switch (status) {
			case 'working': {
				color = 0x22cc55
				break
			}
			case 'talking': {
				color = 0xeebb33
				break
			}
			case 'error': {
				color = 0xee3333
				break
			}
			default: {
				color = 0x3388ff
			}
		}
		rs.glowMesh.clear()
		rs.glowMesh.fillStyle(color, 0.5)
		rs.glowMesh.fillCircle(0, 5, 14)
	}

	setAgentEmissiveIntensity(id: string, intensity: number): void {
		const rs = this.agents.get(id)
		if (!rs) return
		rs.bodyMesh.setAlpha(0.7 + intensity * 0.3)
	}

	setAgentFatigueDim(id: string, color: string, fatigueScale: number): void {
		const rs = this.agents.get(id)
		if (!rs) return
		const scale = this.agentScales.get(id)
		if (!scale) return

		const r = parseInt(color.slice(1, 3), 16)
		const g = parseInt(color.slice(3, 5), 16)
		const b = parseInt(color.slice(5, 7), 16)
		// eslint-disable-next-line no-bitwise
		const dimmed = ((Math.round(r * fatigueScale) << 16) | (Math.round(g * fatigueScale) << 8) | Math.round(b * fatigueScale))

		rs.bodyMesh.clear()
		rs.bodyMesh.fillStyle(dimmed, 1)
		rs.bodyMesh.fillEllipse(0, 0, 30 * scale.bodyScaleX, 20 * scale.bodyScaleY)
	}

	// ── Agent Movement ──

	setAgentTargetPosition(id: string, x: number, z: number): void {
		const rs = this.agents.get(id)
		if (!rs) return
		rs.targetWorldX = x
		rs.targetWorldZ = z
		const screen = worldToScreen(x, z)
		rs.targetPosition = { x: screen.x, y: screen.y }
	}

	getAgentPosition(id: string): { x: number; z: number } | undefined {
		const rs = this.agents.get(id)
		if (!rs) return undefined
		return { x: rs.worldX, z: rs.worldZ }
	}

	// ── Effects ──

	createParticleBurst(x: number, y: number, z: number, color: number, count: number): void {
		this.effects?.createParticleBurst(x, y, z, color, count)
	}

	createFloatingText(x: number, y: number, z: number, text: string, color: string): void {
		this.effects?.createFloatingText(x, y, z, text, color)
	}

	createSpawnBeam(x: number, z: number): void {
		this.effects?.createSpawnBeam(x, z)
	}

	// ── Dialogue Bubbles ──

	showDialogueBubble(
		id: string,
		text: string,
		agentPositions: Iterable<{ id: string; x: number; z: number }>,
	): void {
		const rs = this.agents.get(id)
		if (!rs || !this.gameScene) return

		if (rs.bubble) {
			rs.bubble.destroy()
			rs.bubble = null
		}
		if (rs.bubbleTimeout) {
			clearTimeout(rs.bubbleTimeout)
			rs.bubbleTimeout = null
		}

		let nearbyBubbles = 0
		for (const other of agentPositions) {
			if (other.id === id) continue
			const otherRs = this.agents.get(other.id)
			if (!otherRs?.bubble) continue
			const dx = other.x - rs.worldX
			const dz = other.z - rs.worldZ
			if (Math.sqrt(dx * dx + dz * dz) < 3) nearbyBubbles++
		}

		const bubbleDiv = document.createElement('div')
		bubbleDiv.className = 'dialogue-bubble'
		bubbleDiv.textContent = text.slice(0, 80)

		const screen = worldToScreen(rs.worldX, rs.worldZ)
		const offsetY = 40 + nearbyBubbles * 25
		const bubble = this.gameScene.add.dom(screen.x, screen.y - offsetY, bubbleDiv)
		bubble.setDepth(3000)
		rs.bubble = bubble
		this.bubbleOffsets.set(id, offsetY)

		rs.bubbleTimeout = setTimeout(() => {
			bubbleDiv.classList.add('fading')
			setTimeout(() => {
				if (rs.bubble === bubble) {
					bubble.destroy()
					rs.bubble = null
					this.bubbleOffsets.delete(id)
				}
			}, 600)
		}, BUBBLE_DURATION - 600)
	}

	// ── Contract Scrolls ──

	createContractScroll(contract: ContractData): void {
		if (!this.gameScene) return
		const zone = ZONES.questBoard
		const { x, y } = worldToScreen(zone.x, zone.z)

		const scrollDiv = document.createElement('div')
		scrollDiv.className = `contract-scroll difficulty-${contract.difficulty}`
		scrollDiv.textContent =
			contract.difficulty === 'hard'
				? '\u{1F4DC}\u{2728}'
				: contract.difficulty === 'easy'
					? '\u{1F4C4}'
					: '\u{1F4DC}'

		const offsetX = (Math.random() - 0.5) * 60
		const offsetY = -(30 + Math.random() * 30)
		const scroll = this.gameScene.add.dom(x + offsetX, y + offsetY, scrollDiv)
		scroll.setDepth(500)
		this.contractScrolls.set(contract.id, scroll)
	}

	removeContractScroll(contractId: string): void {
		const scroll = this.contractScrolls.get(contractId)
		if (scroll) {
			scroll.destroy()
			this.contractScrolls.delete(contractId)
		}
	}

	// ── Per-Frame Update ──

	update(frame: FrameContext, agents: Iterable<AgentData>): void {
		const { elapsed, delta, now } = frame

		for (const agent of agents) {
			const rs = this.agents.get(agent.id)
			if (!rs) continue

			// Idle wander
			const wander = checkIdleWander(agent, rs.worldX, rs.worldZ, now)
			if (wander.shouldWander && wander.target) {
				rs.targetWorldX = wander.target.x
				rs.targetWorldZ = wander.target.z
			}

			// Lerp world position
			const lerped = lerpPosition(
				rs.worldX, rs.worldZ,
				rs.targetWorldX, rs.targetWorldZ,
				delta,
			)
			rs.worldX = lerped.x
			rs.worldZ = lerped.z

			// Convert to screen
			const screen = worldToScreen(rs.worldX, rs.worldZ)

			// Bob animation
			const bobScale = agent.status === 'idle' ? 1 : 0.4
			const bob = Math.sin(elapsed * agent.bobSpeed + agent.bobPhase) * BOB_AMPLITUDE * bobScale

			// Set container position (bob scaled to screen pixels)
			rs.group.setPosition(screen.x, screen.y - bob * 20)

			// Depth sort by screen Y
			rs.group.setDepth(screen.y)

			// Track bubble to follow agent
			if (rs.bubble) {
				const offset = this.bubbleOffsets.get(agent.id) ?? 40
				rs.bubble.setPosition(screen.x, screen.y - bob * 20 - offset)
			}

			// Glow pulse
			if (agent.status === 'working') {
				rs.glowMesh.setAlpha(0.4 + 0.3 * Math.sin(elapsed * GLOW_PULSE_SPEED))
			} else {
				rs.glowMesh.setAlpha(0.5)
			}

			// Activity ring
			if (agent.status === 'working') {
				const zoneColor = this.getNearestZoneColor(rs.worldX, rs.worldZ)
				const ringAlpha = 0.3 + 0.3 * Math.sin(elapsed * 4)
				rs.activityRing.clear()
				rs.activityRing.lineStyle(2, zoneColor, ringAlpha)
				rs.activityRing.strokeEllipse(0, 5, 26, 16)
				const ringScale = 1 + 0.15 * Math.sin(elapsed * 3)
				rs.activityRing.setScale(ringScale)
			} else {
				rs.activityRing.clear()
			}
		}

		this.effects?.update(elapsed)
	}

	// ── Click Detection ──

	getClickedAgentId(clientX: number, clientY: number): string | null {
		if (!this.gameScene) return null
		const cam = this.gameScene.cameras.main
		const rect = this.canvas.getBoundingClientRect()
		const worldPoint = cam.getWorldPoint(clientX - rect.left, clientY - rect.top)

		let closestId: string | null = null
		let closestDist = Infinity
		const threshold = 30

		for (const [id, rs] of this.agents) {
			const dx = worldPoint.x - rs.group.x
			const dy = worldPoint.y - rs.group.y
			const dist = Math.sqrt(dx * dx + dy * dy)
			if (dist < threshold && dist < closestDist) {
				closestDist = dist
				closestId = id
			}
		}

		return closestId
	}

	// ── Scene Lifecycle ──

	startLoop(callback: () => void): void {
		// Eager init: by the time bootstrap.ts calls startLoop(),
		// Phaser.Game has completed and GameScene.create() has fired.
		if (!this.gameScene) {
			const scene = this.game.scene.getScene('GameScene') as GameScene | undefined
			if (scene) this.initScene(scene)
		}
		if (this.gameScene) {
			this.gameScene.setUpdateCallback(callback)
		} else {
			// Scene not available yet — the 'step' listener in the
			// constructor will call initScene() which picks this up.
			this.pendingLoopCallback = callback
		}
	}

	render(): void {
		// No-op — Phaser renders automatically
	}

	resize(width: number, height: number): void {
		this.game.scale.resize(width, height)
	}

	// ── Private Helpers ──

	private getNearestZoneColor(worldX: number, worldZ: number): number {
		let closest: keyof typeof ZONES = 'center'
		let minDist = Infinity
		for (const [name, zone] of Object.entries(ZONES)) {
			const dx = worldX - zone.x
			const dz = worldZ - zone.z
			const dist = dx * dx + dz * dz
			if (dist < minDist) {
				minDist = dist
				closest = name as keyof typeof ZONES
			}
		}
		return hexToNumber(ZONES[closest].color)
	}
}
