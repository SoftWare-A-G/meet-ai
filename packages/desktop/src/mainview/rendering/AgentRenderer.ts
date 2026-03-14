import * as THREE from 'three'
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'
import { classifyAgent } from '../constants'
import type { AgentRenderState, TeamMember } from '../types'

export function createAgentMesh(member: TeamMember, existingAgentCount: number, scene: THREE.Scene): AgentRenderState {
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
	const ringGeo = new THREE.TorusGeometry(0.65, 0.04, 8, 32)
	const ringMat = new THREE.MeshBasicMaterial({
		color: agentColor,
		transparent: true,
		opacity: 0,
	})
	const activityRing = new THREE.Mesh(ringGeo, ringMat)
	activityRing.rotation.x = -Math.PI / 2
	activityRing.position.y = 0.1
	group.add(activityRing)

	// Name label — stagger Y offset based on agent index to prevent overlap
	const labelYOffset = 2.2 + (existingAgentCount % 3) * 0.3
	const nameDiv = document.createElement('div')
	nameDiv.className = 'agent-label'
	nameDiv.textContent = `${agentClass.title} ${member.name} Lv.1`
	nameDiv.style.setProperty('--agent-color', member.color)
	const nameLabel = new CSS2DObject(nameDiv)
	nameLabel.position.set(0, labelYOffset, 0)
	nameLabel.center.set(0.5, 1)
	group.add(nameLabel)

	scene.add(group)

	return {
		position: new THREE.Vector3(0, 0, 0),
		targetPosition: new THREE.Vector3(0, 0, 0),
		group,
		bodyMesh,
		glowMesh,
		nameLabel,
		bubble: null,
		bubbleTimeout: null,
		activityRing,
		headMesh,
	}
}
