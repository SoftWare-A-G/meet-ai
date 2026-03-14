import Electrobun, { Electroview } from 'electrobun/view'
import * as THREE from 'three'
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

// ─── Error Overlay ───

function showErrorOverlay(error: unknown) {
	const existing = document.getElementById('error-overlay')
	if (existing) existing.remove()

	const message = error instanceof Error ? error.stack ?? error.message : String(error)

	const overlay = document.createElement('div')
	overlay.id = 'error-overlay'
	overlay.className = 'error-overlay'

	const title = document.createElement('div')
	title.className = 'error-overlay-title'
	title.textContent = 'Something went wrong'
	overlay.appendChild(title)

	const pre = document.createElement('pre')
	pre.className = 'error-overlay-stack'
	pre.textContent = message
	overlay.appendChild(pre)

	const hint = document.createElement('div')
	hint.className = 'error-overlay-hint'
	hint.textContent = 'Check the console for more details. Reload to retry.'
	overlay.appendChild(hint)

	document.body.appendChild(overlay)
}

window.onerror = (_msg, _src, _line, _col, error) => {
	showErrorOverlay(error ?? _msg)
}

window.onunhandledrejection = (event: PromiseRejectionEvent) => {
	showErrorOverlay(event.reason)
}

// ─── Types ───

interface TeamMember {
	teammate_id: string
	name: string
	color: string
	role: string
	model?: string
	status: 'active' | 'inactive'
	joinedAt?: string
}

interface StoredTask {
	id: string
	subject: string
	description?: string
	status: string
	assignee?: string
}

interface AgentState {
	id: string
	name: string
	color: string
	role: string
	status: 'idle' | 'working' | 'talking' | 'error'
	position: THREE.Vector3
	targetPosition: THREE.Vector3
	group: THREE.Group
	bodyMesh: THREE.Mesh
	glowMesh: THREE.Mesh
	nameLabel: CSS2DObject
	bubble: CSS2DObject | null
	bubbleTimeout: ReturnType<typeof setTimeout> | null
	bobPhase: number
	bobSpeed: number
	lastActivity: number
	spawnIndex: number
	nextWanderTime: number
	xp: number
	level: number
	activityRing: THREE.Mesh
	// Guild management stats
	focus: number      // 0-100: how sharp the agent is (decreases with work, recovers when idle)
	fatigue: number    // 0-100: exhaustion level (increases with work, decreases when idle)
	mood: number       // 0-100: happiness (increases on task completion, decreases on errors/long work)
	tasksCompleted: number
	messagesCount: number
	toolUses: number
	boosted: boolean   // player applied boost
	boostEndTime: number
}

interface SpawnBeam {
	mesh: THREE.Mesh
	startTime: number
	duration: number
}

interface ParticleEffect {
	points: THREE.Points
	velocities: Float32Array
	startTime: number
	duration: number
}

interface FloatingText {
	label: CSS2DObject
	startTime: number
	duration: number
	startY: number
}

interface ZoneParticleSystem {
	points: THREE.Points
	behavior: string
	zoneX: number
	zoneZ: number
}

interface Contract {
	id: string
	title: string
	assignee?: string
	status: 'posted' | 'claimed' | 'active' | 'completed' | 'failed'
	difficulty: 'easy' | 'normal' | 'hard'
	reward: number
	scrollObject?: CSS2DObject
}

interface EventLogEntry {
	time: number
	agent: string
	text: string
	type: 'tool' | 'message' | 'task' | 'error'
}

// ─── Constants ───

const ZONES = {
	center:     { x:  0, z:  0, color: '#555566', label: 'Spawn' },
	library:    { x:  0, z: -8, color: '#3b82f6', label: 'Library' },
	workshop:   { x:  8, z:  0, color: '#f59e0b', label: 'Workshop' },
	terminal:   { x:  0, z:  8, color: '#22c55e', label: 'Terminal' },
	questBoard: { x: -8, z:  0, color: '#a855f7', label: 'Quest Board' },
} as const

// ─── Agent Classes ───
// Derive a character class from agent name/role for visual differentiation

type AgentClass = {
	title: string
	bodyScale: { x: number; y: number; z: number }
	headSize: number
	emissiveIntensity: number
	metalness: number
	roughness: number
}

const AGENT_CLASSES: Record<string, AgentClass> = {
	commander: { title: '⚔️ Commander', bodyScale: { x: 1.15, y: 1.1, z: 1.15 }, headSize: 0.22, emissiveIntensity: 0.25, metalness: 0.5, roughness: 0.3 },
	scholar:   { title: '📚 Scholar',   bodyScale: { x: 0.9, y: 1.0, z: 0.9 },   headSize: 0.25, emissiveIntensity: 0.2,  metalness: 0.1, roughness: 0.6 },
	artificer: { title: '⚒️ Artificer', bodyScale: { x: 1.1, y: 0.95, z: 1.1 },  headSize: 0.2,  emissiveIntensity: 0.3,  metalness: 0.4, roughness: 0.3 },
	sentinel:  { title: '🛡️ Sentinel',  bodyScale: { x: 1.2, y: 1.05, z: 1.2 },  headSize: 0.2,  emissiveIntensity: 0.15, metalness: 0.6, roughness: 0.2 },
	oracle:    { title: '🔮 Oracle',    bodyScale: { x: 0.85, y: 1.15, z: 0.85 }, headSize: 0.24, emissiveIntensity: 0.35, metalness: 0.2, roughness: 0.5 },
	default:   { title: '👤 Agent',     bodyScale: { x: 1.0, y: 1.0, z: 1.0 },   headSize: 0.2,  emissiveIntensity: 0.15, metalness: 0.2, roughness: 0.4 },
}

function classifyAgent(name: string, role: string): AgentClass {
	const n = name.toLowerCase()
	const r = role.toLowerCase()

	// Commander: team-lead, lead, planner, orchestrator
	if (n.includes('lead') || n.includes('planner') || r.includes('lead') || r.includes('orchestrat'))
		return AGENT_CLASSES.commander

	// Scholar: researcher, research, reader
	if (n.includes('research') || r.includes('research') || n.includes('reader'))
		return AGENT_CLASSES.scholar

	// Artificer: codex, coder, builder, fix, migration
	if (n.includes('codex') || n.includes('coder') || n.includes('fix') || n.includes('builder') || n.includes('migration'))
		return AGENT_CLASSES.artificer

	// Sentinel: reviewer, verify, audit, guard
	if (n.includes('review') || n.includes('verify') || n.includes('audit') || n.includes('sentinel'))
		return AGENT_CLASSES.sentinel

	// Oracle: pi, oracle, advisor
	if (n === 'pi' || n.includes('oracle') || r.includes('oracle'))
		return AGENT_CLASSES.oracle

	return AGENT_CLASSES.default
}

const LERP_SPEED = 3.0
const BOB_AMPLITUDE = 0.06
const BOB_FREQUENCY = 2.0
const GLOW_PULSE_SPEED = 3.5
const BUBBLE_DURATION = 5000
const IDLE_TIMEOUT = 30000
const WANDER_INTERVAL_MIN = 5000
const WANDER_INTERVAL_MAX = 10000
const WANDER_RADIUS = 1.5
const IDLE_SPIN_SPEED = 0.3
const SPAWN_RADIUS = 2.0
const ZONE_SCATTER_RADIUS = 1.5

const FATIGUE_TOOL_COST = 2
const FATIGUE_RECOVERY_RATE = 1.5
const FOCUS_GAIN_PER_USE = 10
const FOCUS_MAX = 100
const MAX_EVENT_LOG = 15
const SPECIALTY_MAP: Record<string, { name: string; icon: string }> = {
	library: { name: 'Lorekeeper', icon: '\u{1F4D6}' },
	workshop: { name: 'Craftsman', icon: '\u{1F527}' },
	terminal: { name: 'Operator', icon: '\u{1F4BB}' },
	questBoard: { name: 'Quartermaster', icon: '\u{1F4DC}' },
}
const GUILD_THRESHOLDS = [
	{ level: 12, name: 'Legendary Guild' },
	{ level: 8, name: 'Master Guild' },
	{ level: 5, name: 'Journeyman Guild' },
	{ level: 3, name: 'Apprentice Guild' },
	{ level: 1, name: 'Unknown Guild' },
]
const DIFFICULTY_REWARDS: Record<string, number> = { easy: 10, normal: 20, hard: 40 }

// ─── Game State ───

const agents = new Map<string, AgentState>()
const tasks = new Map<string, StoredTask>()
const spawnBeams: SpawnBeam[] = []
const particleEffects: ParticleEffect[] = []
const floatingTexts: FloatingText[] = []
const zoneParticleSystems: ZoneParticleSystem[] = []
let roomName = ''
const contracts = new Map<string, Contract>()
const eventLog: EventLogEntry[] = []
const agentZoneUsage = new Map<string, Record<string, number>>()
const agentLastZone = new Map<string, string>()
let eventLogVisible = false

// ─── Three.js Scene ───

try {

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null
if (!canvas) {
	throw new Error('#game-canvas element not found — DOM may not be ready')
}

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false })
renderer.setPixelRatio(window.devicePixelRatio)
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setClearColor(0x0e1015)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap

const cssRenderer = new CSS2DRenderer()
cssRenderer.setSize(window.innerWidth, window.innerHeight)
cssRenderer.domElement.id = 'ui-overlay'
const existingOverlay = document.getElementById('ui-overlay')
if (existingOverlay) existingOverlay.replaceWith(cssRenderer.domElement)
else document.body.appendChild(cssRenderer.domElement)

const scene = new THREE.Scene()
scene.fog = new THREE.FogExp2(0x0e1015, 0.018)

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100)
camera.position.set(0, 18, 16)
camera.lookAt(0, 0, 0)

const controls = new OrbitControls(camera, cssRenderer.domElement)
controls.enableDamping = true
controls.dampingFactor = 0.08
controls.maxPolarAngle = Math.PI / 2.2
controls.minDistance = 8
controls.maxDistance = 35
controls.target.set(0, 0, 0)

// ─── Lights ───

const ambientLight = new THREE.AmbientLight(0x8899bb, 0.5)
scene.add(ambientLight)

const dirLight = new THREE.DirectionalLight(0xffffff, 0.7)
dirLight.position.set(8, 15, 10)
dirLight.castShadow = true
dirLight.shadow.mapSize.width = 1024
dirLight.shadow.mapSize.height = 1024
dirLight.shadow.camera.near = 0.5
dirLight.shadow.camera.far = 40
dirLight.shadow.camera.left = -16
dirLight.shadow.camera.right = 16
dirLight.shadow.camera.top = 16
dirLight.shadow.camera.bottom = -16
scene.add(dirLight)

// ─── World ───

// Ground plane
const groundGeo = new THREE.PlaneGeometry(30, 30)
const groundMat = new THREE.MeshStandardMaterial({
	color: 0x1a1c24,
	roughness: 0.9,
	metalness: 0.1,
})
const ground = new THREE.Mesh(groundGeo, groundMat)
ground.rotation.x = -Math.PI / 2
ground.receiveShadow = true
scene.add(ground)

// Grid overlay
const gridHelper = new THREE.GridHelper(30, 30, 0x222430, 0x191b22)
gridHelper.position.y = 0.01
scene.add(gridHelper)

// Zone markers
for (const [_key, zone] of Object.entries(ZONES)) {
	const zoneColor = new THREE.Color(zone.color)

	// Outer ring
	const ringGeo = new THREE.RingGeometry(2.2, 2.5, 32)
	const ringMat = new THREE.MeshBasicMaterial({
		color: zoneColor,
		transparent: true,
		opacity: 0.35,
		side: THREE.DoubleSide,
	})
	const ring = new THREE.Mesh(ringGeo, ringMat)
	ring.rotation.x = -Math.PI / 2
	ring.position.set(zone.x, 0.02, zone.z)
	scene.add(ring)

	// Inner disc (subtle glow)
	const discGeo = new THREE.CircleGeometry(2.2, 32)
	const discMat = new THREE.MeshBasicMaterial({
		color: zoneColor,
		transparent: true,
		opacity: 0.08,
		side: THREE.DoubleSide,
	})
	const disc = new THREE.Mesh(discGeo, discMat)
	disc.rotation.x = -Math.PI / 2
	disc.position.set(zone.x, 0.015, zone.z)
	scene.add(disc)

	// Point light at zone
	const pointLight = new THREE.PointLight(zoneColor, 0.6, 8)
	pointLight.position.set(zone.x, 1.5, zone.z)
	scene.add(pointLight)

	// Zone label (CSS2D)
	const labelDiv = document.createElement('div')
	labelDiv.className = 'zone-label'
	labelDiv.textContent = zone.label
	labelDiv.style.setProperty('--zone-color', zone.color)
	const label = new CSS2DObject(labelDiv)
	label.position.set(zone.x, 0.1, zone.z)
	label.center.set(0.5, -0.5)
	scene.add(label)
}

// ─── Zone Structures — simple 3D props to make zones feel like places ───

function addZoneStructure(x: number, z: number, color: string, type: string) {
	const c = new THREE.Color(color)
	const darkC = c.clone().multiplyScalar(0.5)

	if (type === 'library') {
		// Bookshelf — tall thin boxes
		for (let i = -1; i <= 1; i++) {
			const h = 1.2 + Math.random() * 0.6
			const shelfGeo = new THREE.BoxGeometry(0.3, h, 0.5)
			const shelfMat = new THREE.MeshStandardMaterial({ color: darkC, roughness: 0.8 })
			const shelf = new THREE.Mesh(shelfGeo, shelfMat)
			shelf.position.set(x + i * 0.5, h / 2, z - 2.8)
			shelf.castShadow = true
			scene.add(shelf)
		}
	} else if (type === 'workshop') {
		// Anvil — box + smaller box on top
		const baseGeo = new THREE.BoxGeometry(1.0, 0.5, 0.6)
		const baseMat = new THREE.MeshStandardMaterial({ color: darkC, roughness: 0.3, metalness: 0.7 })
		const base = new THREE.Mesh(baseGeo, baseMat)
		base.position.set(x + 2.8, 0.25, z)
		base.castShadow = true
		scene.add(base)
		const topGeo = new THREE.BoxGeometry(1.2, 0.2, 0.8)
		const top = new THREE.Mesh(topGeo, baseMat)
		top.position.set(x + 2.8, 0.6, z)
		top.castShadow = true
		scene.add(top)
	} else if (type === 'terminal') {
		// Monitor — thin box + stand
		const screenGeo = new THREE.BoxGeometry(1.0, 0.7, 0.05)
		const screenMat = new THREE.MeshStandardMaterial({ color: 0x112211, emissive: c, emissiveIntensity: 0.4, roughness: 0.1 })
		const screen = new THREE.Mesh(screenGeo, screenMat)
		screen.position.set(x, 1.0, z + 2.8)
		screen.castShadow = true
		scene.add(screen)
		const standGeo = new THREE.CylinderGeometry(0.05, 0.15, 0.6, 8)
		const standMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.5 })
		const stand = new THREE.Mesh(standGeo, standMat)
		stand.position.set(x, 0.3, z + 2.8)
		scene.add(stand)
	} else if (type === 'questBoard') {
		// Quest board — flat rectangle + posts
		const boardGeo = new THREE.BoxGeometry(1.2, 0.9, 0.08)
		const boardMat = new THREE.MeshStandardMaterial({ color: 0x3d2b1f, roughness: 0.9 })
		const board = new THREE.Mesh(boardGeo, boardMat)
		board.position.set(x - 2.8, 0.9, z)
		board.castShadow = true
		scene.add(board)
		// Posts
		for (const offset of [-0.5, 0.5]) {
			const postGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.5, 6)
			const postMat = new THREE.MeshStandardMaterial({ color: 0x2a1f14 })
			const post = new THREE.Mesh(postGeo, postMat)
			post.position.set(x - 2.8 + offset, 0.45, z)
			scene.add(post)
		}
	}
}

addZoneStructure(ZONES.library.x, ZONES.library.z, ZONES.library.color, 'library')
addZoneStructure(ZONES.workshop.x, ZONES.workshop.z, ZONES.workshop.color, 'workshop')
addZoneStructure(ZONES.terminal.x, ZONES.terminal.z, ZONES.terminal.color, 'terminal')
addZoneStructure(ZONES.questBoard.x, ZONES.questBoard.z, ZONES.questBoard.color, 'questBoard')

// ─── Room Title UI ───

const roomTitleEl = document.createElement('div')
roomTitleEl.className = 'room-title'
roomTitleEl.textContent = 'Connecting...'
document.body.appendChild(roomTitleEl)

const agentCountEl = document.createElement('div')
agentCountEl.className = 'agent-count'
agentCountEl.textContent = '0 agents'
document.body.appendChild(agentCountEl)

// ─── HUD Panel ───

function createHudRow(labelText: string, valueId: string): HTMLDivElement {
	const row = document.createElement('div')
	row.className = 'hud-row'
	const label = document.createElement('span')
	label.className = 'hud-label'
	label.textContent = labelText
	const value = document.createElement('span')
	value.className = 'hud-value'
	value.id = valueId
	value.textContent = labelText === 'Team XP' ? '0' : labelText === 'Quests' ? '0 / 0' : '\u2014'
	row.appendChild(label)
	row.appendChild(value)
	return row
}

const hudPanel = document.createElement('div')
hudPanel.className = 'hud-panel'
const hudTitle = document.createElement('div')
hudTitle.className = 'hud-title'
hudTitle.textContent = 'Guild Stats'
hudPanel.appendChild(hudTitle)
hudPanel.appendChild(createHudRow('Team XP', 'hud-team-xp'))
hudPanel.appendChild(createHudRow('MVP', 'hud-mvp'))
hudPanel.appendChild(createHudRow('Quests', 'hud-tasks'))
hudPanel.appendChild(createHudRow('Guild Lv', 'hud-guild-lv'))
hudPanel.appendChild(createHudRow('Reputation', 'hud-reputation'))
document.body.appendChild(hudPanel)

const hudTeamXP = document.getElementById('hud-team-xp')!
const hudMVP = document.getElementById('hud-mvp')!
const hudTasks = document.getElementById('hud-tasks')!
const hudGuildLv = document.getElementById('hud-guild-lv')!
const hudReputation = document.getElementById('hud-reputation')!

function updateHUD() {
	let totalXP = 0
	let mvpName = '\u2014'
	let mvpXP = 0
	for (const agent of agents.values()) {
		totalXP += agent.xp
		if (agent.xp > mvpXP) {
			mvpXP = agent.xp
			mvpName = agent.name
		}
	}
	const activeTasks = [...tasks.values()].filter(t => t.status !== 'completed').length
	const completedTasks = [...tasks.values()].filter(t => t.status === 'completed').length
	const guildLv = getGuildLevel(totalXP)
	const reputation = getGuildReputation(guildLv)

	hudTeamXP.textContent = String(totalXP)
	hudMVP.textContent = mvpXP > 0 ? `${mvpName} (${mvpXP})` : '\u2014'
	hudTasks.textContent = `${activeTasks} active / ${completedTasks} done`
	hudGuildLv.textContent = String(guildLv)
	hudReputation.textContent = reputation
}

// ─── Guild Reputation ───

function getGuildLevel(totalXP: number): number {
	return Math.floor(Math.sqrt(totalXP / 50)) + 1
}

function getGuildReputation(guildLevel: number): string {
	for (const t of GUILD_THRESHOLDS) {
		if (guildLevel >= t.level) return t.name
	}
	return 'Unknown Guild'
}

// ─── Specialty System ───

function getAgentSpecialty(agentId: string): { name: string; icon: string } {
	const usage = agentZoneUsage.get(agentId)
	if (!usage) return { name: 'Wanderer', icon: '\u{1F6B6}' }
	let maxZone = ''
	let maxCount = 0
	for (const [zone, count] of Object.entries(usage)) {
		if (count > maxCount) { maxCount = count; maxZone = zone }
	}
	if (maxZone && maxCount > 3) {
		const spec = SPECIALTY_MAP[maxZone]
		if (spec) return spec
	}
	return { name: 'Wanderer', icon: '\u{1F6B6}' }
}

function getMoodLabel(agent: AgentState): string {
	if (agent.fatigue > 80) return 'exhausted'
	if (agent.focus > 70) return 'focused'
	if (agent.fatigue > 50 || agent.mood < 30) return 'stressed'
	return 'calm'
}

function getMoodEmoji(label: string): string {
	const map: Record<string, string> = { calm: '\u{1F60C}', focused: '\u{1F525}', stressed: '\u{1F612}', exhausted: '\u{1F634}' }
	return map[label] || '\u{1F60C}'
}

function recordZoneUse(agentId: string, zoneName: string) {
	let usage = agentZoneUsage.get(agentId)
	if (!usage) { usage = {}; agentZoneUsage.set(agentId, usage) }
	usage[zoneName] = (usage[zoneName] || 0) + 1
}

function updateAgentLabel(agent: AgentState) {
	const cls = classifyAgent(agent.name, agent.role)
	const spec = getAgentSpecialty(agent.id)
	const labelEl = agent.nameLabel.element as HTMLDivElement
	labelEl.textContent = `${cls.title} ${agent.name} Lv.${agent.level} ${spec.name}`
}

// ─── Contract System ───

function detectDifficulty(text: string): 'easy' | 'normal' | 'hard' {
	const lower = text.toLowerCase()
	if (['implement', 'rewrite', 'architecture', 'system', 'redesign'].some(k => lower.includes(k))) return 'hard'
	if (['refactor', 'update', 'add', 'create', 'migrate'].some(k => lower.includes(k))) return 'normal'
	if (['fix', 'typo', 'rename', 'bump', 'tweak'].some(k => lower.includes(k))) return 'easy'
	return 'normal'
}

function taskToContract(task: StoredTask): Contract {
	const existing = contracts.get(task.id)
	const text = `${task.subject} ${task.description || ''}`
	const difficulty = existing?.difficulty || detectDifficulty(text)
	let status: Contract['status'] = 'posted'
	if (task.status === 'completed') status = 'completed'
	else if (task.assignee) status = 'active'
	return {
		id: task.id,
		title: task.subject,
		assignee: task.assignee,
		status,
		difficulty,
		reward: DIFFICULTY_REWARDS[difficulty],
		scrollObject: existing?.scrollObject,
	}
}

function createContractScroll(contract: Contract) {
	const zone = ZONES.questBoard
	const scrollDiv = document.createElement('div')
	scrollDiv.className = `contract-scroll difficulty-${contract.difficulty}`
	scrollDiv.textContent = contract.difficulty === 'hard' ? '\u{1F4DC}\u{2728}' : contract.difficulty === 'easy' ? '\u{1F4C4}' : '\u{1F4DC}'
	const label = new CSS2DObject(scrollDiv)
	label.position.set(zone.x + (Math.random() - 0.5) * 2, 2 + Math.random(), zone.z + (Math.random() - 0.5) * 2)
	scene.add(label)
	contract.scrollObject = label
}

function removeContractScroll(contract: Contract) {
	if (contract.scrollObject) {
		scene.remove(contract.scrollObject)
		contract.scrollObject = undefined
	}
}

// ─── Event Log ───

const eventLogPanel = document.createElement('div')
eventLogPanel.className = 'event-log collapsed'
const eventLogTitle = document.createElement('div')
eventLogTitle.className = 'event-log-title'
eventLogTitle.textContent = 'Event Log [L]'
eventLogPanel.appendChild(eventLogTitle)
const eventLogEntries = document.createElement('div')
eventLogEntries.className = 'event-log-entries'
eventLogPanel.appendChild(eventLogEntries)
document.body.appendChild(eventLogPanel)

function addEvent(agentName: string, text: string, type: EventLogEntry['type']) {
	eventLog.push({ time: Date.now(), agent: agentName, text, type })
	if (eventLog.length > MAX_EVENT_LOG) eventLog.shift()
	renderEventLog()
}

function renderEventLog() {
	const colorMap: Record<string, string> = { tool: '#3b82f6', message: '#eab308', task: '#22c55e', error: '#ef4444' }
	while (eventLogEntries.firstChild) eventLogEntries.removeChild(eventLogEntries.firstChild)
	for (const e of eventLog) {
		const d = new Date(e.time)
		const ts = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
		const div = document.createElement('div')
		div.className = 'event-entry'
		div.style.color = colorMap[e.type] || '#888'
		div.textContent = `[${ts}] ${e.agent}: ${e.text}`
		eventLogEntries.appendChild(div)
	}
	eventLogEntries.scrollTop = eventLogEntries.scrollHeight
}

// ─── Zone Ambient Particles ───

function initZoneParticles() {
	const configs: Record<string, { count: number; color: number; behavior: string }> = {
		library:    { count: 15, color: 0x6699ff, behavior: 'float-up' },
		workshop:   { count: 12, color: 0xff8833, behavior: 'sparks' },
		terminal:   { count: 15, color: 0x33ff66, behavior: 'fall-down' },
		questBoard: { count: 12, color: 0xaa66ff, behavior: 'orbit' },
		center:     { count: 10, color: 0xffffff, behavior: 'drift' },
	}

	for (const [zoneName, config] of Object.entries(configs)) {
		const zone = ZONES[zoneName as keyof typeof ZONES]
		const geo = new THREE.BufferGeometry()
		const positions = new Float32Array(config.count * 3)

		for (let i = 0; i < config.count; i++) {
			positions[i * 3] = zone.x + (Math.random() - 0.5) * 4
			positions[i * 3 + 1] = Math.random() * 3 + 0.2
			positions[i * 3 + 2] = zone.z + (Math.random() - 0.5) * 4
		}

		geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
		const mat = new THREE.PointsMaterial({
			size: config.behavior === 'sparks' ? 0.1 : 0.06,
			color: config.color,
			transparent: true,
			opacity: 0.5,
		})
		const points = new THREE.Points(geo, mat)
		scene.add(points)

		zoneParticleSystems.push({
			points,
			behavior: config.behavior,
			zoneX: zone.x,
			zoneZ: zone.z,
		})
	}
}

initZoneParticles()

// ─── XP & Leveling ───

function getLevel(xp: number): number {
	return Math.floor(Math.sqrt(xp / 10)) + 1
}

function addXP(agent: AgentState, amount: number) {
	const oldLevel = agent.level
	agent.xp += amount
	agent.level = getLevel(agent.xp)

	// Update name label with level + specialty
	updateAgentLabel(agent)

	if (agent.level > oldLevel) {
		// Level up: golden glow + particle burst + floating text
		const bodyMat = agent.bodyMesh.material as THREE.MeshStandardMaterial
		bodyMat.emissiveIntensity = 1.0
		createParticleBurst(agent.group.position, 0xffd700, 30)
		createFloatingText(agent.group.position, `Level ${agent.level}!`, '#ffd700')
		setTimeout(() => { bodyMat.emissiveIntensity = 0.15 }, 1000)
	}

	updateHUD()
}

// ─── Spawn Beam ───

function createSpawnBeam(position: THREE.Vector3) {
	const geo = new THREE.CylinderGeometry(0.4, 0.4, 5, 16, 1, true)
	const mat = new THREE.MeshBasicMaterial({
		color: 0xffffff,
		transparent: true,
		opacity: 0.8,
		side: THREE.DoubleSide,
	})
	const mesh = new THREE.Mesh(geo, mat)
	mesh.position.set(position.x, 2.5, position.z)
	mesh.scale.y = 0.01
	scene.add(mesh)
	spawnBeams.push({ mesh, startTime: elapsedTime, duration: 1.0 })
}

// ─── Particle Burst ───

function createParticleBurst(position: THREE.Vector3, color = 0xffdd00, count = 20) {
	const geo = new THREE.BufferGeometry()
	const positions = new Float32Array(count * 3)
	const velocities = new Float32Array(count * 3)

	for (let i = 0; i < count; i++) {
		positions[i * 3] = position.x + (Math.random() - 0.5) * 0.5
		positions[i * 3 + 1] = (position.y || 0) + 1.5
		positions[i * 3 + 2] = position.z + (Math.random() - 0.5) * 0.5

		velocities[i * 3] = (Math.random() - 0.5) * 2
		velocities[i * 3 + 1] = Math.random() * 3 + 1
		velocities[i * 3 + 2] = (Math.random() - 0.5) * 2
	}

	geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
	const mat = new THREE.PointsMaterial({ size: 0.12, color, transparent: true, opacity: 1.0 })
	const points = new THREE.Points(geo, mat)
	scene.add(points)
	particleEffects.push({ points, velocities, startTime: elapsedTime, duration: 1.5 })
}

// ─── Floating Text ───

function createFloatingText(position: THREE.Vector3, text: string, color = '#ffd700') {
	const div = document.createElement('div')
	div.className = 'xp-popup'
	div.textContent = text
	div.style.color = color
	const label = new CSS2DObject(div)
	label.position.set(position.x, (position.y || 0) + 2.5, position.z)
	scene.add(label)
	floatingTexts.push({ label, startTime: elapsedTime, duration: 1.5, startY: label.position.y })
}

// ─── Activity Ring ───

function createActivityRing(agentColor: THREE.Color): THREE.Mesh {
	const geo = new THREE.TorusGeometry(0.65, 0.04, 8, 32)
	const mat = new THREE.MeshBasicMaterial({
		color: agentColor,
		transparent: true,
		opacity: 0,
	})
	const ring = new THREE.Mesh(geo, mat)
	ring.rotation.x = -Math.PI / 2
	ring.position.y = 0.1
	return ring
}

// ─── Get Nearest Zone Color ───

function getNearestZoneColor(agent: AgentState): string {
	let closest: keyof typeof ZONES = 'center'
	let minDist = Infinity
	for (const [name, zone] of Object.entries(ZONES)) {
		const dx = agent.position.x - zone.x
		const dz = agent.position.z - zone.z
		const dist = dx * dx + dz * dz
		if (dist < minDist) {
			minDist = dist
			closest = name as keyof typeof ZONES
		}
	}
	return ZONES[closest].color
}

// ─── Agent Helpers ───

function createAgentCharacter(member: TeamMember): AgentState {
	const group = new THREE.Group()
	const agentColor = new THREE.Color(member.color)
	const agentClass = classifyAgent(member.name, member.role)

	// Body — capsule scaled by class
	const bodyGeo = new THREE.CapsuleGeometry(0.45, 0.8, 8, 16)
	const bodyMat = new THREE.MeshStandardMaterial({
		color: agentColor,
		roughness: agentClass.roughness,
		metalness: agentClass.metalness,
		emissive: agentColor,
		emissiveIntensity: agentClass.emissiveIntensity,
	})
	const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat)
	bodyMesh.position.y = 1.1
	bodyMesh.scale.set(agentClass.bodyScale.x, agentClass.bodyScale.y, agentClass.bodyScale.z)
	bodyMesh.castShadow = true
	group.add(bodyMesh)

	// Head — sphere on top of body, sized by class
	const headGeo = new THREE.SphereGeometry(agentClass.headSize, 12, 8)
	const headMat = new THREE.MeshStandardMaterial({
		color: agentColor,
		roughness: agentClass.roughness * 0.8,
		metalness: agentClass.metalness + 0.1,
		emissive: agentColor,
		emissiveIntensity: agentClass.emissiveIntensity * 1.5,
	})
	const headMesh = new THREE.Mesh(headGeo, headMat)
	headMesh.position.y = 1.85 * agentClass.bodyScale.y
	headMesh.castShadow = true
	group.add(headMesh)

	// Status glow sphere at feet
	const glowGeo = new THREE.SphereGeometry(0.35, 12, 8)
	const glowMat = new THREE.MeshBasicMaterial({
		color: 0x3388ff,
		transparent: true,
		opacity: 0.5,
	})
	const glowMesh = new THREE.Mesh(glowGeo, glowMat)
	glowMesh.position.y = 0.15
	group.add(glowMesh)

	// Activity ring
	const activityRing = createActivityRing(agentColor)
	group.add(activityRing)

	// Name label — stagger Y offset based on agent index to prevent overlap
	const index = agents.size
	const labelYOffset = 2.2 + (index % 3) * 0.3
	const nameDiv = document.createElement('div')
	nameDiv.className = 'agent-label'
	nameDiv.textContent = `${agentClass.title} ${member.name} Lv.1`
	nameDiv.style.setProperty('--agent-color', member.color)
	const nameLabel = new CSS2DObject(nameDiv)
	nameLabel.position.set(0, labelYOffset, 0)
	nameLabel.center.set(0.5, 1)
	group.add(nameLabel)

	// Distribute spawn positions in a circle around center
	const totalAgents = agents.size + 1
	const angle = (index / Math.max(totalAgents, 1)) * Math.PI * 2
	const spawnX = Math.cos(angle) * SPAWN_RADIUS
	const spawnZ = Math.sin(angle) * SPAWN_RADIUS
	group.position.set(spawnX, 0, spawnZ)
	scene.add(group)

	return {
		id: member.teammate_id,
		name: member.name,
		color: member.color,
		role: member.role,
		status: member.status === 'active' ? 'working' : 'idle',
		position: new THREE.Vector3(spawnX, 0, spawnZ),
		targetPosition: new THREE.Vector3(spawnX, 0, spawnZ),
		group,
		bodyMesh,
		glowMesh,
		nameLabel,
		bubble: null,
		bubbleTimeout: null,
		bobPhase: Math.random() * Math.PI * 2,
		bobSpeed: BOB_FREQUENCY * (0.8 + Math.random() * 0.4),
		lastActivity: Date.now(),
		spawnIndex: index,
		nextWanderTime: Date.now() + WANDER_INTERVAL_MIN + Math.random() * (WANDER_INTERVAL_MAX - WANDER_INTERVAL_MIN),
		xp: 0,
		level: 1,
		activityRing,
		focus: 100,
		fatigue: 0,
		mood: 75,
		tasksCompleted: 0,
		messagesCount: 0,
		toolUses: 0,
		boosted: false,
		boostEndTime: 0,
	}
}

function setAgentGlow(agent: AgentState) {
	const mat = agent.glowMesh.material as THREE.MeshBasicMaterial
	switch (agent.status) {
		case 'working':
			mat.color.setHex(0x22cc55)
			break
		case 'talking':
			mat.color.setHex(0xeebb33)
			break
		case 'error':
			mat.color.setHex(0xee3333)
			break
		default:
			mat.color.setHex(0x3388ff)
	}
}

function showDialogueBubble(agent: AgentState, text: string) {
	// Remove existing bubble
	if (agent.bubble) {
		agent.group.remove(agent.bubble)
		agent.bubble = null
	}
	if (agent.bubbleTimeout) {
		clearTimeout(agent.bubbleTimeout)
		agent.bubbleTimeout = null
	}

	// Count nearby active bubbles to stack vertically
	let nearbyBubbles = 0
	for (const other of agents.values()) {
		if (other.id === agent.id || !other.bubble) continue
		const dx = other.position.x - agent.position.x
		const dz = other.position.z - agent.position.z
		if (Math.sqrt(dx * dx + dz * dz) < 3) nearbyBubbles++
	}

	const bubbleDiv = document.createElement('div')
	bubbleDiv.className = 'dialogue-bubble'
	bubbleDiv.textContent = text.slice(0, 80)
	const bubble = new CSS2DObject(bubbleDiv)
	const bubbleY = 2.8 + nearbyBubbles * 1.2
	bubble.position.set(0, bubbleY, 0)
	bubble.center.set(0.5, 1)
	agent.group.add(bubble)
	agent.bubble = bubble

	// Start fade after 4s, remove at 5s
	agent.bubbleTimeout = setTimeout(() => {
		bubbleDiv.classList.add('fading')
		setTimeout(() => {
			if (agent.bubble === bubble) {
				agent.group.remove(bubble)
				agent.bubble = null
			}
		}, 600)
	}, BUBBLE_DURATION - 600)
}

function moveAgentToZone(agent: AgentState, zoneName: keyof typeof ZONES) {
	const zone = ZONES[zoneName]
	agent.targetPosition.set(
		zone.x + (Math.random() - 0.5) * ZONE_SCATTER_RADIUS * 2,
		0,
		zone.z + (Math.random() - 0.5) * ZONE_SCATTER_RADIUS * 2,
	)
}

function updateAgentCount() {
	const active = [...agents.values()].filter(a => a.status !== 'idle').length
	const total = agents.size
	agentCountEl.textContent = `${active} active / ${total} agents`
}

// ─── RPC ───

type GameRPC = {
	bun: {
		requests: {}
		messages: {
			'meetai:team_info': { type: 'team_info'; team_name: string; members: TeamMember[] }
			'meetai:message': { type: 'message'; sender: string; content: string; color?: string; sender_type: string; seq?: number }
			'meetai:tasks_info': { type: 'tasks_info'; tasks: StoredTask[] }
			'meetai:log': { type: 'log'; sender: string; content: string }
			'meetai:commands_info': { type: 'commands_info'; commands: Array<{ name: string; type: string; description: string }> }
		}
	}
	webview: {
		requests: {}
		messages: {}
	}
}

function handleTeamInfo(data: { team_name: string; members: TeamMember[] }) {
	roomName = data.team_name
	roomTitleEl.textContent = roomName

	for (const member of data.members) {
		const existing = agents.get(member.teammate_id)
		if (existing) {
			existing.name = member.name
			existing.color = member.color
			existing.role = member.role
			existing.status = member.status === 'active' ? 'working' : 'idle'
			existing.lastActivity = Date.now()
			const bodyMat = existing.bodyMesh.material as THREE.MeshStandardMaterial
			const newColor = new THREE.Color(member.color)
			bodyMat.color.copy(newColor)
			bodyMat.emissive.copy(newColor)
			updateAgentLabel(existing)
			;(existing.nameLabel.element as HTMLDivElement).style.setProperty('--agent-color', member.color)
			setAgentGlow(existing)
		} else {
			const agent = createAgentCharacter(member)
			agents.set(member.teammate_id, agent)
			setAgentGlow(agent)
			addEvent(member.name, 'joined the guild', 'task')
			// Spawn beam for new agents
			createSpawnBeam(agent.group.position)
		}
	}
	// Rebalance spawn positions — redistribute idle agents in a circle
	const idleAgents = [...agents.values()].filter(a => a.status === 'idle')
	if (idleAgents.length > 1) {
		idleAgents.forEach((agent, i) => {
			const angle = (i / idleAgents.length) * Math.PI * 2
			agent.targetPosition.set(
				Math.cos(angle) * SPAWN_RADIUS,
				0,
				Math.sin(angle) * SPAWN_RADIUS,
			)
		})
	}

	updateAgentCount()
	updateHUD()
}

function handleMessage(data: { sender: string; content: string }) {
	for (const agent of agents.values()) {
		if (agent.name === data.sender) {
			agent.status = 'talking'
			agent.lastActivity = Date.now()
			setAgentGlow(agent)
			showDialogueBubble(agent, data.content)
			addXP(agent, 3)
			agent.messagesCount++
			agent.mood = Math.min(100, agent.mood + 2)
			addEvent(agent.name, data.content.slice(0, 50), 'message')
			break
		}
	}
}

function handleLog(data: { sender: string; content: string }) {
	for (const agent of agents.values()) {
		if (agent.name === data.sender) {
			agent.status = 'working'
			agent.lastActivity = Date.now()
			setAgentGlow(agent)

			// Dedup XP: only award if >2s since last tool XP for this agent
			const now = Date.now()
			const lastXp = (agent as any)._lastToolXpTime || 0
			if (now - lastXp > 2000) {
				addXP(agent, 5)
				agent.toolUses++
				;(agent as any)._lastToolXpTime = now
			}

			agent.fatigue = Math.min(100, agent.fatigue + FATIGUE_TOOL_COST)

			const tool = (data.content.match(/^(\w+)/)?.[1] ?? '').toLowerCase()
			let zoneName: keyof typeof ZONES | '' = ''

			if (['read', 'grep', 'glob'].some(t => tool.includes(t))) {
				zoneName = 'library'
			} else if (['edit', 'write'].some(t => tool.includes(t))) {
				zoneName = 'workshop'
			} else if (tool.includes('bash')) {
				zoneName = 'terminal'
			}

			if (zoneName) {
				moveAgentToZone(agent, zoneName)
				recordZoneUse(agent.id, zoneName)
				// Focus: consecutive uses in same zone
				const lastZone = agentLastZone.get(agent.id)
				if (zoneName === lastZone) {
					agent.focus = Math.min(FOCUS_MAX, agent.focus + FOCUS_GAIN_PER_USE)
				} else {
					agent.focus = 0
				}
				agentLastZone.set(agent.id, zoneName)
			}

			addEvent(agent.name, data.content.slice(0, 50), 'tool')
			break
		}
	}
}

function handleTasks(data: { tasks: StoredTask[] }) {
	for (const task of data.tasks) {
		const existingTask = tasks.get(task.id)
		const existingContract = contracts.get(task.id)
		const contract = taskToContract(task)
		const justCompleted = existingTask && existingTask.status !== 'completed' && task.status === 'completed'

		// New contract without assignee — show scroll at Quest Board
		if (!existingContract && !task.assignee) {
			createContractScroll(contract)
			addEvent('Guild', `New contract: ${task.subject}`, 'task')
		}

		// Contract just claimed (was posted, now has assignee)
		if (existingContract?.status === 'posted' && task.assignee) {
			removeContractScroll(contract)
			for (const agent of agents.values()) {
				if (agent.name === task.assignee || agent.id === task.assignee) {
					createFloatingText(agent.group.position, 'Contract Claimed!', '#a855f7')
					addEvent(agent.name, `Claimed: ${task.subject}`, 'task')
					break
				}
			}
		}

		contracts.set(task.id, contract)
		tasks.set(task.id, task)

		if (!task.assignee) continue

		for (const agent of agents.values()) {
			if (agent.name !== task.assignee && agent.id !== task.assignee) continue

			if (justCompleted) {
				agent.status = 'idle'
				setAgentGlow(agent)
				moveAgentToZone(agent, 'center')
				removeContractScroll(contract)
				const reward = contract.reward
				addXP(agent, reward)
				agent.tasksCompleted++
				agent.mood = Math.min(100, agent.mood + 10)
				agent.fatigue = Math.max(0, agent.fatigue - 5)
				createParticleBurst(agent.group.position, 0xffdd00, 25)
				createFloatingText(agent.group.position, `+${reward} XP (${contract.difficulty})`, '#ffd700')
				contract.status = 'completed'
				addEvent(agent.name, `Completed: ${task.subject} (+${reward}XP)`, 'task')
			} else {
				moveAgentToZone(agent, 'questBoard')
			}
		}
	}
	updateHUD()
}

const rpc = Electroview.defineRPC<GameRPC>({
	maxRequestTime: 10000,
	handlers: {
		requests: {},
		messages: {
			'*': (messageName: string, payload: unknown) => {
				console.log('[rpc:webview] Received:', messageName)
				const data = payload as Record<string, unknown>
				switch (messageName) {
					case 'meetai:team_info':
						handleTeamInfo(data as Parameters<typeof handleTeamInfo>[0])
						break
					case 'meetai:message':
						handleMessage(data as Parameters<typeof handleMessage>[0])
						break
					case 'meetai:log':
						handleLog(data as Parameters<typeof handleLog>[0])
						break
					case 'meetai:tasks_info':
						handleTasks(data as Parameters<typeof handleTasks>[0])
						break
				}
			},
		},
	},
})

// Initialize Electrobun webview with RPC
console.log('[rpc:webview] Initializing Electroview + RPC…')
try {
	new Electrobun.Electroview({ rpc })
	console.log('[rpc:webview] Electroview ready, handler registered')
} catch (err) {
	console.error('[rpc:webview] Electroview init failed:', err)
}

// ─── Agent Selection & Panel ───

let selectedAgentId: string | null = null
let agentPanel: HTMLDivElement | null = null

function showAgentPanel(agent: AgentState) {
	if (agentPanel) agentPanel.remove()

	const cls = classifyAgent(agent.name, agent.role)
	const spec = getAgentSpecialty(agent.id)
	const moodLabel = getMoodLabel(agent)
	const moodIcon = getMoodEmoji(moodLabel)

	const panel = document.createElement('div')
	panel.className = 'agent-panel'

	// Build panel with safe DOM methods
	const classDiv = document.createElement('div')
	classDiv.className = 'agent-panel-class'
	classDiv.textContent = cls.title
	panel.appendChild(classDiv)

	const nameDiv = document.createElement('div')
	nameDiv.className = 'agent-panel-name'
	nameDiv.style.color = agent.color
	nameDiv.textContent = `${agent.name} Lv.${agent.level}`
	panel.appendChild(nameDiv)

	const specDiv = document.createElement('div')
	specDiv.className = 'agent-panel-specialty'
	specDiv.textContent = `${spec.icon} ${spec.name} ${moodIcon} ${moodLabel}`
	panel.appendChild(specDiv)

	// Stat bars (using template — all values are agent-controlled numbers, safe)
	const barsDiv = document.createElement('div')
	barsDiv.className = 'agent-panel-bars'
	for (const [label, value, color] of [['Focus', agent.focus, '#3b82f6'], ['Fatigue', agent.fatigue, '#f59e0b'], ['Mood', agent.mood, '#22c55e']] as [string, number, string][]) {
		const bar = document.createElement('div')
		bar.className = 'stat-bar-container'
		const lbl = document.createElement('span')
		lbl.className = 'stat-bar-label'
		lbl.textContent = label
		const track = document.createElement('div')
		track.className = 'stat-bar-track'
		const fill = document.createElement('div')
		fill.className = 'stat-bar-fill'
		fill.style.width = `${value}%`
		fill.style.background = color
		track.appendChild(fill)
		const val = document.createElement('span')
		val.className = 'stat-bar-value'
		val.textContent = String(Math.round(value))
		bar.appendChild(lbl)
		bar.appendChild(track)
		bar.appendChild(val)
		barsDiv.appendChild(bar)
	}
	panel.appendChild(barsDiv)

	// Stats grid
	const statsDiv = document.createElement('div')
	statsDiv.className = 'agent-panel-stats'
	for (const [sLabel, sValue] of [['Quests', agent.tasksCompleted], ['Tools', agent.toolUses], ['Msgs', agent.messagesCount], ['XP', agent.xp]] as [string, number][]) {
		const stat = document.createElement('div')
		stat.className = 'agent-panel-stat'
		const sv = document.createElement('div')
		sv.className = 'agent-panel-stat-value'
		sv.textContent = String(sValue)
		const sl = document.createElement('div')
		sl.className = 'agent-panel-stat-label'
		sl.textContent = sLabel
		stat.appendChild(sv)
		stat.appendChild(sl)
		statsDiv.appendChild(stat)
	}
	panel.appendChild(statsDiv)

	// Action buttons
	const actionsDiv = document.createElement('div')
	actionsDiv.className = 'agent-panel-actions'
	for (const [action, text] of [['boost', 'Boost'], ['recover', 'Recover'], ['reroute', 'Reroute']]) {
		const btn = document.createElement('button')
		btn.className = `agent-panel-btn ${action}`
		btn.dataset.action = action
		btn.textContent = text
		actionsDiv.appendChild(btn)
	}
	panel.appendChild(actionsDiv)
	document.body.appendChild(panel)
	agentPanel = panel

	// Action handlers
	panel.querySelectorAll('.agent-panel-btn').forEach(btn => {
		btn.addEventListener('click', (e) => {
			const action = (e.currentTarget as HTMLElement).dataset.action
			if (action === 'boost') boostAgent(agent)
			else if (action === 'recover') recoverAgent(agent)
			else if (action === 'reroute') rerouteAgent(agent)
		})
	})
}

function updateAgentPanel() {
	if (!selectedAgentId || !agentPanel) return
	const agent = agents.get(selectedAgentId)
	if (!agent) { agentPanel.remove(); agentPanel = null; return }
	showAgentPanel(agent)
}

function boostAgent(agent: AgentState) {
	agent.boosted = true
	agent.boostEndTime = Date.now() + 15000 // 15s boost
	agent.focus = Math.min(100, agent.focus + 30)
	const bodyMat = agent.bodyMesh.material as THREE.MeshStandardMaterial
	bodyMat.emissiveIntensity = 0.6
	createParticleBurst(agent.group.position, 0xffd700, 15)
	createFloatingText(agent.group.position, '⚡ Boosted!', '#ffd700')
}

function recoverAgent(agent: AgentState) {
	agent.fatigue = Math.max(0, agent.fatigue - 30)
	agent.mood = Math.min(100, agent.mood + 15)
	agent.focus = Math.min(100, agent.focus + 15)
	createParticleBurst(agent.group.position, 0x22c55e, 15)
	createFloatingText(agent.group.position, '💚 Recovered!', '#22c55e')
}

function rerouteAgent(agent: AgentState) {
	const zoneNames: (keyof typeof ZONES)[] = ['library', 'workshop', 'terminal', 'questBoard', 'center']
	const random = zoneNames[Math.floor(Math.random() * zoneNames.length)]!
	moveAgentToZone(agent, random)
	createFloatingText(agent.group.position, `🔀 → ${ZONES[random].label}`, '#3b82f6')
}

// Click detection — raycast to find clicked agent
const raycaster = new THREE.Raycaster()
const mouseVec = new THREE.Vector2()

canvas.addEventListener('click', (event) => {
	mouseVec.x = (event.clientX / window.innerWidth) * 2 - 1
	mouseVec.y = -(event.clientY / window.innerHeight) * 2 + 1
	raycaster.setFromCamera(mouseVec, camera)

	let closestAgent: AgentState | null = null
	let closestDist = Infinity

	for (const agent of agents.values()) {
		const intersects = raycaster.intersectObject(agent.bodyMesh)
		if (intersects.length > 0 && intersects[0]!.distance < closestDist) {
			closestDist = intersects[0]!.distance
			closestAgent = agent
		}
	}

	if (closestAgent) {
		selectedAgentId = closestAgent.id
		showAgentPanel(closestAgent)
	} else {
		selectedAgentId = null
		if (agentPanel) { agentPanel.remove(); agentPanel = null }
	}
})

// ─── Keyboard Shortcuts ───

window.addEventListener('keydown', (e: KeyboardEvent) => {
	if (e.key === 'l' || e.key === 'L') {
		eventLogVisible = !eventLogVisible
		eventLogPanel.classList.toggle('collapsed', !eventLogVisible)
	}
})

// ─── Resize ───

window.addEventListener('resize', () => {
	camera.aspect = window.innerWidth / window.innerHeight
	camera.updateProjectionMatrix()
	renderer.setSize(window.innerWidth, window.innerHeight)
	cssRenderer.setSize(window.innerWidth, window.innerHeight)
})

// ─── Game Loop ───

let lastFrameTime = performance.now()
let elapsedTime = 0

renderer.setAnimationLoop(() => {
	const now_ms = performance.now()
	const delta = Math.min((now_ms - lastFrameTime) / 1000, 0.05)
	lastFrameTime = now_ms
	elapsedTime += delta
	const elapsed = elapsedTime
	const now = Date.now()

	// ── Update agents ──
	for (const agent of agents.values()) {
		// Idle timeout — 30s without activity → return to center
		if (agent.status !== 'idle' && now - agent.lastActivity > IDLE_TIMEOUT) {
			agent.status = 'idle'
			setAgentGlow(agent)
			moveAgentToZone(agent, 'center')
		}

		// ── Stats decay/recovery (per frame, scaled by delta) ──
		if (agent.status === 'working') {
			agent.fatigue = Math.min(100, agent.fatigue + delta * 1.5)
			agent.focus = Math.max(0, agent.focus - delta * 0.8)
			if (agent.fatigue > 80) agent.mood = Math.max(0, agent.mood - delta * 0.5)
		} else if (agent.status === 'idle') {
			agent.fatigue = Math.max(0, agent.fatigue - delta * 3.0)
			agent.focus = Math.min(100, agent.focus + delta * 2.0)
			agent.mood = Math.min(100, agent.mood + delta * 0.3)
		}

		// Boost expires
		if (agent.boosted && now > agent.boostEndTime) {
			agent.boosted = false
			const bodyMat = agent.bodyMesh.material as THREE.MeshStandardMaterial
			bodyMat.emissiveIntensity = classifyAgent(agent.name, agent.role).emissiveIntensity
		}

		// Visual: dim agent when fatigued
		const bodyMat = agent.bodyMesh.material as THREE.MeshStandardMaterial
		const fatigueScale = 1.0 - (agent.fatigue / 100) * 0.4
		bodyMat.color.setStyle(agent.color)
		bodyMat.color.multiplyScalar(fatigueScale)

		// Idle wandering — drift to a random nearby position every 5-10s
		if (agent.status === 'idle' && now > agent.nextWanderTime) {
			agent.targetPosition.set(
				agent.position.x + (Math.random() - 0.5) * WANDER_RADIUS * 2,
				0,
				agent.position.z + (Math.random() - 0.5) * WANDER_RADIUS * 2,
			)
			agent.nextWanderTime = now + WANDER_INTERVAL_MIN + Math.random() * (WANDER_INTERVAL_MAX - WANDER_INTERVAL_MIN)
		}

		// Smooth movement toward target
		const dx = agent.targetPosition.x - agent.position.x
		const dz = agent.targetPosition.z - agent.position.z
		const dist = Math.sqrt(dx * dx + dz * dz)

		if (dist > 0.01) {
			const t = Math.min(1, LERP_SPEED * delta)
			agent.position.x += dx * t
			agent.position.z += dz * t
		} else {
			agent.position.x = agent.targetPosition.x
			agent.position.z = agent.targetPosition.z
		}

		// Y-axis bobbing — per-agent speed variation
		const bobScale = agent.status === 'idle' ? 1.0 : 0.4
		const bobY = Math.sin(elapsed * agent.bobSpeed + agent.bobPhase) * BOB_AMPLITUDE * bobScale

		agent.group.position.set(agent.position.x, bobY, agent.position.z)

		// Gentle Y-axis spin when idle
		if (agent.status === 'idle') {
			agent.bodyMesh.rotation.y += IDLE_SPIN_SPEED * delta
		} else {
			// Face direction of movement when moving
			if (dist > 0.05) {
				const targetAngle = Math.atan2(dx, dz)
				const currentAngle = agent.bodyMesh.rotation.y
				agent.bodyMesh.rotation.y += (targetAngle - currentAngle) * Math.min(1, 4 * delta)
			}
		}

		// Glow pulse for working agents
		const glowMat = agent.glowMesh.material as THREE.MeshBasicMaterial
		if (agent.status === 'working') {
			glowMat.opacity = 0.4 + 0.3 * Math.sin(elapsed * GLOW_PULSE_SPEED)
		} else {
			glowMat.opacity = 0.5
		}

		// Activity ring — visible and pulsing when working
		const ringMat = agent.activityRing.material as THREE.MeshBasicMaterial
		if (agent.status === 'working') {
			const zoneColor = getNearestZoneColor(agent)
			ringMat.color.set(zoneColor)
			ringMat.opacity = 0.3 + 0.3 * Math.sin(elapsed * 4)
			const ringScale = 1.0 + 0.15 * Math.sin(elapsed * 3)
			agent.activityRing.scale.set(ringScale, ringScale, 1)
		} else {
			ringMat.opacity = 0
		}
	}

	// ── Spawn beams ──
	for (let i = spawnBeams.length - 1; i >= 0; i--) {
		const beam = spawnBeams[i]
		const progress = (elapsed - beam.startTime) / beam.duration
		const mat = beam.mesh.material as THREE.MeshBasicMaterial

		if (progress >= 1) {
			scene.remove(beam.mesh)
			beam.mesh.geometry.dispose()
			mat.dispose()
			spawnBeams.splice(i, 1)
			continue
		}

		if (progress < 0.3) {
			// Scale up phase
			beam.mesh.scale.y = progress / 0.3
		} else {
			// Fade out phase
			beam.mesh.scale.y = 1
			mat.opacity = 0.8 * (1 - (progress - 0.3) / 0.7)
		}
	}

	// ── Particle effects ──
	for (let i = particleEffects.length - 1; i >= 0; i--) {
		const effect = particleEffects[i]
		const progress = (elapsed - effect.startTime) / effect.duration
		const mat = effect.points.material as THREE.PointsMaterial

		if (progress >= 1) {
			scene.remove(effect.points)
			effect.points.geometry.dispose()
			mat.dispose()
			particleEffects.splice(i, 1)
			continue
		}

		// Update particle positions with velocity + gravity
		const posAttr = effect.points.geometry.getAttribute('position') as THREE.BufferAttribute
		const positions = posAttr.array as Float32Array
		const count = positions.length / 3
		for (let j = 0; j < count; j++) {
			positions[j * 3] += effect.velocities[j * 3] * delta
			positions[j * 3 + 1] += effect.velocities[j * 3 + 1] * delta
			positions[j * 3 + 2] += effect.velocities[j * 3 + 2] * delta
			effect.velocities[j * 3 + 1] -= 3 * delta
		}
		posAttr.needsUpdate = true
		mat.opacity = 1 - progress
	}

	// ── Floating texts ──
	for (let i = floatingTexts.length - 1; i >= 0; i--) {
		const ft = floatingTexts[i]
		const progress = (elapsed - ft.startTime) / ft.duration

		if (progress >= 1) {
			scene.remove(ft.label)
			floatingTexts.splice(i, 1)
			continue
		}

		ft.label.position.y = ft.startY + progress * 1.5
		const el = ft.label.element as HTMLDivElement
		el.style.opacity = String(1 - progress)
	}

	// ── Zone ambient particles ──
	for (const zp of zoneParticleSystems) {
		const posAttr = zp.points.geometry.getAttribute('position') as THREE.BufferAttribute
		const positions = posAttr.array as Float32Array
		const count = positions.length / 3

		for (let i = 0; i < count; i++) {
			const ix = i * 3
			const iy = i * 3 + 1
			const iz = i * 3 + 2

			switch (zp.behavior) {
				case 'float-up':
					positions[iy] += delta * 0.3
					positions[ix] += Math.sin(elapsed + i) * delta * 0.1
					if (positions[iy] > 4) {
						positions[iy] = 0.2
						positions[ix] = zp.zoneX + (Math.random() - 0.5) * 4
						positions[iz] = zp.zoneZ + (Math.random() - 0.5) * 4
					}
					break

				case 'sparks':
					if (Math.random() < 0.02) {
						positions[ix] = zp.zoneX + (Math.random() - 0.5) * 3
						positions[iy] = Math.random() * 1.5 + 0.3
						positions[iz] = zp.zoneZ + (Math.random() - 0.5) * 3
					}
					positions[iy] -= delta * 0.5
					if (positions[iy] < 0.1) {
						positions[iy] = Math.random() * 2 + 0.5
					}
					break

				case 'fall-down':
					positions[iy] -= delta * 0.8
					if (positions[iy] < 0.1) {
						positions[iy] = 3 + Math.random() * 2
						positions[ix] = zp.zoneX + (Math.random() - 0.5) * 4
						positions[iz] = zp.zoneZ + (Math.random() - 0.5) * 4
					}
					break

				case 'orbit': {
					const angle = elapsed * 0.5 + (i / count) * Math.PI * 2
					const radius = 1.5 + Math.sin(elapsed * 0.3 + i) * 0.5
					positions[ix] = zp.zoneX + Math.cos(angle) * radius
					positions[iz] = zp.zoneZ + Math.sin(angle) * radius
					positions[iy] = 1 + Math.sin(elapsed + i * 0.5) * 0.5
					break
				}

				case 'drift':
					positions[ix] += Math.sin(elapsed * 0.3 + i * 1.7) * delta * 0.15
					positions[iy] += Math.cos(elapsed * 0.2 + i * 2.3) * delta * 0.1
					positions[iz] += Math.sin(elapsed * 0.25 + i * 1.3) * delta * 0.15
					if (Math.abs(positions[ix] - zp.zoneX) > 2.5) positions[ix] = zp.zoneX + (Math.random() - 0.5) * 2
					if (positions[iy] > 3 || positions[iy] < 0.2) positions[iy] = Math.random() * 2 + 0.3
					if (Math.abs(positions[iz] - zp.zoneZ) > 2.5) positions[iz] = zp.zoneZ + (Math.random() - 0.5) * 2
					break
			}
		}
		posAttr.needsUpdate = true
	}

	// Refresh agent panel every ~0.5s
	if (selectedAgentId && Math.floor(elapsed * 2) !== Math.floor((elapsed - delta) * 2)) {
		updateAgentPanel()
	}

	controls.update()
	renderer.render(scene, camera)
	cssRenderer.render(scene, camera)
})

} catch (err) {
	showErrorOverlay(err)
}
