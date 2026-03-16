import * as THREE from 'three'
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'
import type {
  FrameContext,
  SpawnBeam,
  ParticleEffect,
  FloatingText,
  ZoneParticleSystem,
} from '../types'

export class EffectsManager {
  private readonly scene: THREE.Scene
  private readonly spawnBeams: SpawnBeam[] = []
  private readonly particleEffects: ParticleEffect[] = []
  private readonly floatingTexts: FloatingText[] = []
  private zoneParticleSystems: ZoneParticleSystem[] = []

  constructor(scene: THREE.Scene) {
    this.scene = scene
  }

  setZoneParticleSystems(systems: ZoneParticleSystem[]): void {
    this.zoneParticleSystems = systems
  }

  createSpawnBeam(x: number, z: number, elapsed: number): void {
    const geo = new THREE.CylinderGeometry(0.4, 0.4, 5, 16, 1, true)
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(x, 2.5, z)
    mesh.scale.y = 0.01
    this.scene.add(mesh)
    this.spawnBeams.push({ mesh, startTime: elapsed, duration: 1 })
  }

  createParticleBurst(
    x: number,
    y: number,
    z: number,
    color: number,
    count: number,
    elapsed: number
  ): void {
    const geo = new THREE.BufferGeometry()
    const positions = new Float32Array(count * 3)
    const velocities = new Float32Array(count * 3)

    for (let i = 0; i < count; i++) {
      positions[i * 3] = x + (Math.random() - 0.5) * 0.5
      positions[i * 3 + 1] = y + 1.5
      positions[i * 3 + 2] = z + (Math.random() - 0.5) * 0.5

      velocities[i * 3] = (Math.random() - 0.5) * 2
      velocities[i * 3 + 1] = Math.random() * 3 + 1
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 2
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const mat = new THREE.PointsMaterial({ size: 0.12, color, transparent: true, opacity: 1 })
    const points = new THREE.Points(geo, mat)
    this.scene.add(points)
    this.particleEffects.push({ points, velocities, startTime: elapsed, duration: 1.5 })
  }

  createFloatingText(
    x: number,
    y: number,
    z: number,
    text: string,
    color: string,
    elapsed: number
  ): void {
    const div = document.createElement('div')
    div.className = 'xp-popup'
    div.textContent = text
    div.style.color = color
    const label = new CSS2DObject(div)
    label.position.set(x, y + 2.5, z)
    this.scene.add(label)
    this.floatingTexts.push({ label, startTime: elapsed, duration: 1.5, startY: label.position.y })
  }

  update(frame: FrameContext): void {
    const { elapsed, delta } = frame

    // Spawn beams
    for (let i = this.spawnBeams.length - 1; i >= 0; i--) {
      const beam = this.spawnBeams[i]!
      const progress = (elapsed - beam.startTime) / beam.duration
      const mat = beam.mesh.material as THREE.MeshBasicMaterial

      if (progress >= 1) {
        this.scene.remove(beam.mesh)
        beam.mesh.geometry.dispose()
        mat.dispose()
        this.spawnBeams.splice(i, 1)
        continue
      }

      if (progress < 0.3) {
        beam.mesh.scale.y = progress / 0.3
      } else {
        beam.mesh.scale.y = 1
        mat.opacity = 0.8 * (1 - (progress - 0.3) / 0.7)
      }
    }

    // Particle effects
    for (let i = this.particleEffects.length - 1; i >= 0; i--) {
      const effect = this.particleEffects[i]!
      const progress = (elapsed - effect.startTime) / effect.duration
      const mat = effect.points.material as THREE.PointsMaterial

      if (progress >= 1) {
        this.scene.remove(effect.points)
        effect.points.geometry.dispose()
        mat.dispose()
        this.particleEffects.splice(i, 1)
        continue
      }

      const posAttr = effect.points.geometry.getAttribute('position') as THREE.BufferAttribute
      const positions = posAttr.array as Float32Array
      const count = positions.length / 3
      for (let j = 0; j < count; j++) {
        positions[j * 3] += effect.velocities[j * 3]! * delta
        positions[j * 3 + 1] += effect.velocities[j * 3 + 1]! * delta
        positions[j * 3 + 2] += effect.velocities[j * 3 + 2]! * delta
        effect.velocities[j * 3 + 1] -= 3 * delta
      }
      posAttr.needsUpdate = true
      mat.opacity = 1 - progress
    }

    // Floating texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i]!
      const progress = (elapsed - ft.startTime) / ft.duration

      if (progress >= 1) {
        this.scene.remove(ft.label)
        this.floatingTexts.splice(i, 1)
        continue
      }

      ft.label.position.y = ft.startY + progress * 1.5
      const el = ft.label.element as HTMLDivElement
      el.style.opacity = String(1 - progress)
    }

    // Zone ambient particles
    for (const zp of this.zoneParticleSystems) {
      const posAttr = zp.points.geometry.getAttribute('position') as THREE.BufferAttribute
      const positions = posAttr.array as Float32Array
      const count = positions.length / 3

      for (let i = 0; i < count; i++) {
        const ix = i * 3
        const iy = i * 3 + 1
        const iz = i * 3 + 2

        switch (zp.behavior) {
          case 'float-up': {
            positions[iy] += delta * 0.3
            positions[ix] += Math.sin(elapsed + i) * delta * 0.1
            if (positions[iy]! > 4) {
              positions[iy] = 0.2
              positions[ix] = zp.zoneX + (Math.random() - 0.5) * 4
              positions[iz] = zp.zoneZ + (Math.random() - 0.5) * 4
            }
            break
          }

          case 'sparks': {
            if (Math.random() < 0.02) {
              positions[ix] = zp.zoneX + (Math.random() - 0.5) * 3
              positions[iy] = Math.random() * 1.5 + 0.3
              positions[iz] = zp.zoneZ + (Math.random() - 0.5) * 3
            }
            positions[iy] -= delta * 0.5
            if (positions[iy]! < 0.1) {
              positions[iy] = Math.random() * 2 + 0.5
            }
            break
          }

          case 'fall-down': {
            positions[iy] -= delta * 0.8
            if (positions[iy]! < 0.1) {
              positions[iy] = 3 + Math.random() * 2
              positions[ix] = zp.zoneX + (Math.random() - 0.5) * 4
              positions[iz] = zp.zoneZ + (Math.random() - 0.5) * 4
            }
            break
          }

          case 'orbit': {
            const angle = elapsed * 0.5 + (i / count) * Math.PI * 2
            const radius = 1.5 + Math.sin(elapsed * 0.3 + i) * 0.5
            positions[ix] = zp.zoneX + Math.cos(angle) * radius
            positions[iz] = zp.zoneZ + Math.sin(angle) * radius
            positions[iy] = 1 + Math.sin(elapsed + i * 0.5) * 0.5
            break
          }

          case 'drift': {
            positions[ix] += Math.sin(elapsed * 0.3 + i * 1.7) * delta * 0.15
            positions[iy] += Math.cos(elapsed * 0.2 + i * 2.3) * delta * 0.1
            positions[iz] += Math.sin(elapsed * 0.25 + i * 1.3) * delta * 0.15
            if (Math.abs(positions[ix]! - zp.zoneX) > 2.5) {
              positions[ix] = zp.zoneX + (Math.random() - 0.5) * 2
            }

            if (positions[iy]! > 3 || positions[iy]! < 0.2) {
              positions[iy] = Math.random() * 2 + 0.3
            }

            if (Math.abs(positions[iz]! - zp.zoneZ) > 2.5) {
              positions[iz] = zp.zoneZ + (Math.random() - 0.5) * 2
            }

            break
          }
        }
      }
      posAttr.needsUpdate = true
    }
  }
}
