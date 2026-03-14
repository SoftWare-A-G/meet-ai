import * as THREE from 'three'
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { SceneContext } from '../types'

export function createScene(): SceneContext {
	const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null
	if (!canvas) {
		throw new Error('#game-canvas element not found — DOM may not be ready')
	}

	// WebGL renderer
	const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false })
	renderer.setPixelRatio(window.devicePixelRatio)
	renderer.setSize(window.innerWidth, window.innerHeight)
	renderer.setClearColor(0x0e1015)
	renderer.shadowMap.enabled = true
	renderer.shadowMap.type = THREE.PCFSoftShadowMap

	// CSS2D renderer for HTML overlays
	const cssRenderer = new CSS2DRenderer()
	cssRenderer.setSize(window.innerWidth, window.innerHeight)
	cssRenderer.domElement.id = 'ui-overlay'
	const existingOverlay = document.getElementById('ui-overlay')
	if (existingOverlay) existingOverlay.replaceWith(cssRenderer.domElement)
	else document.body.appendChild(cssRenderer.domElement)

	// Scene + fog
	const scene = new THREE.Scene()
	scene.fog = new THREE.FogExp2(0x0e1015, 0.018)

	// Camera
	const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100)
	camera.position.set(0, 18, 16)
	camera.lookAt(0, 0, 0)

	// Orbit controls
	const controls = new OrbitControls(camera, cssRenderer.domElement)
	controls.enableDamping = true
	controls.dampingFactor = 0.08
	controls.maxPolarAngle = Math.PI / 2.2
	controls.minDistance = 8
	controls.maxDistance = 35
	controls.target.set(0, 0, 0)

	// Lights
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

	return { renderer, cssRenderer, scene, camera, controls, canvas }
}
