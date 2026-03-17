import * as Phaser from 'phaser'
import { worldToScreen } from './IsoProjection'

const GROUND_HALF = 15
const GRID_STEP = 2
const MIN_ZOOM = 0.3
const MAX_ZOOM = 3
const ZOOM_FACTOR = 0.001

export class GameScene extends Phaser.Scene {
  private updateCallback: (() => void) | null = null

  constructor() {
    super({ key: 'GameScene' })
  }

  preload(): void {
    const canvas = this.textures.createCanvas('pixel', 4, 4)!
    const ctx = canvas.getContext()
    ctx!.fillStyle = '#ffffff'
    ctx!.fillRect(0, 0, 4, 4)
    canvas.refresh()
  }

  create(): void {
    this.drawGround()
    this.drawGrid()
    this.cameras.main.centerOn(0, 0)
    this.setupCameraControls()
  }

  update(_time: number, _delta: number): void {
    if (this.updateCallback) {
      this.updateCallback()
    }
  }

  setUpdateCallback(cb: () => void): void {
    this.updateCallback = cb
  }

  private drawGround(): void {
    const gfx = this.add.graphics()
    const corners = [
      worldToScreen(GROUND_HALF, 0),
      worldToScreen(0, GROUND_HALF),
      worldToScreen(-GROUND_HALF, 0),
      worldToScreen(0, -GROUND_HALF),
    ]
    gfx.fillStyle(0x1a1a2e, 1)
    gfx.beginPath()
    gfx.moveTo(corners[0].x, corners[0].y)
    gfx.lineTo(corners[1].x, corners[1].y)
    gfx.lineTo(corners[2].x, corners[2].y)
    gfx.lineTo(corners[3].x, corners[3].y)
    gfx.closePath()
    gfx.fillPath()
  }

  private drawGrid(): void {
    const gfx = this.add.graphics()
    gfx.lineStyle(1, 0x444466, 0.5)

    for (let i = -GROUND_HALF; i <= GROUND_HALF; i += GRID_STEP) {
      const a = worldToScreen(i, -GROUND_HALF)
      const b = worldToScreen(i, GROUND_HALF)
      gfx.lineBetween(a.x, a.y, b.x, b.y)

      const c = worldToScreen(-GROUND_HALF, i)
      const d = worldToScreen(GROUND_HALF, i)
      gfx.lineBetween(c.x, c.y, d.x, d.y)
    }
  }

  private setupCameraControls(): void {
    const cam = this.cameras.main

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.primaryDown) return
      cam.scrollX -= (pointer.x - pointer.prevPosition.x) / cam.zoom
      cam.scrollY -= (pointer.y - pointer.prevPosition.y) / cam.zoom
    })

    this.input.on(
      'wheel',
      (
        _pointer: Phaser.Input.Pointer,
        _gameObjects: Phaser.GameObjects.GameObject[],
        _deltaX: number,
        deltaY: number
      ) => {
        cam.zoom = Phaser.Math.Clamp(cam.zoom - deltaY * ZOOM_FACTOR, MIN_ZOOM, MAX_ZOOM)
      }
    )
  }
}
