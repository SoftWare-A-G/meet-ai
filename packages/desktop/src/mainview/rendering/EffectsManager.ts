import * as Phaser from 'phaser'
import { worldToScreen, heightOffset } from './IsoProjection'

export class EffectsManager {
  private readonly scene: Phaser.Scene

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  createSpawnBeam(worldX: number, worldZ: number): void {
    const { x: screenX, y: screenY } = worldToScreen(worldX, worldZ)

    const beam = this.scene.add.graphics()
    beam.fillStyle(0xffffff, 0.8)
    beam.fillRect(screenX - 8, screenY - 100, 16, 100)
    beam.setDepth(1000)

    this.scene.tweens.add({
      targets: beam,
      alpha: 0,
      duration: 1000,
      onComplete: () => beam.destroy(),
    })
  }

  createParticleBurst(
    worldX: number,
    worldY: number,
    worldZ: number,
    color: number,
    count: number
  ): void {
    const { x, y } = worldToScreen(worldX, worldZ)
    const screenY = y + heightOffset(worldY)

    // Ensure pixel texture exists
    if (!this.scene.textures.exists('pixel')) {
      const canvas = this.scene.textures.createCanvas('pixel', 2, 2)
      if (canvas) {
        const ctx = canvas.getContext()
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, 2, 2)
        canvas.refresh()
      }
    }

    const emitter = this.scene.add.particles(x, screenY, 'pixel', {
      color: [color],
      speed: { min: 50, max: 150 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.5, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: 1500,
      gravityY: 150,
      quantity: count,
      emitting: false,
    })
    emitter.explode(count)
    emitter.setDepth(1500)

    this.scene.time.delayedCall(1600, () => emitter.destroy())
  }

  createFloatingText(
    worldX: number,
    worldY: number,
    worldZ: number,
    text: string,
    color: string
  ): void {
    const { x, y } = worldToScreen(worldX, worldZ)
    const screenY = y + heightOffset(worldY)

    const textObj = this.scene.add
      .text(x, screenY, text, {
        fontSize: '14px',
        fontFamily: 'Space Grotesk, system-ui',
        color,
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(2000)

    this.scene.tweens.add({
      targets: textObj,
      y: screenY - 50,
      alpha: 0,
      duration: 1500,
      onComplete: () => textObj.destroy(),
    })
  }

  update(_elapsed: number): void {
    // No-op — Phaser emitters handle their own animation.
    // Kept for interface compatibility.
  }
}
