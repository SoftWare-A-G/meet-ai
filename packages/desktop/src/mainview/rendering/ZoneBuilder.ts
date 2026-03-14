import * as THREE from 'three'
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'
import { ZONES } from '../constants'
import type { ZoneParticleSystem } from '../types'

export function buildZoneMarkers(scene: THREE.Scene): void {
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
}

function addZoneStructure(scene: THREE.Scene, x: number, z: number, color: string, type: string): void {
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

export function buildZoneStructures(scene: THREE.Scene): void {
	addZoneStructure(scene, ZONES.library.x, ZONES.library.z, ZONES.library.color, 'library')
	addZoneStructure(scene, ZONES.workshop.x, ZONES.workshop.z, ZONES.workshop.color, 'workshop')
	addZoneStructure(scene, ZONES.terminal.x, ZONES.terminal.z, ZONES.terminal.color, 'terminal')
	addZoneStructure(scene, ZONES.questBoard.x, ZONES.questBoard.z, ZONES.questBoard.color, 'questBoard')
}

export function initZoneParticles(scene: THREE.Scene): ZoneParticleSystem[] {
	const systems: ZoneParticleSystem[] = []
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

		systems.push({
			points,
			behavior: config.behavior,
			zoneX: zone.x,
			zoneZ: zone.z,
		})
	}

	return systems
}
