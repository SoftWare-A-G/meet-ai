import * as Phaser from 'phaser'
import { ZONES } from '../constants'
import { worldToScreen } from './IsoProjection'

function hexToNumber(hex: string): number {
  return parseInt(hex.replace('#', ''), 16)
}

function buildStructure(
  graphics: Phaser.GameObjects.Graphics,
  type: string,
  screenX: number,
  screenY: number,
  color: number
): void {
  const dark = Phaser.Display.Color.ValueToColor(color).darken(40).color

  if (type === 'library') {
    // 3 small rectangles (bookshelves)
    for (let i = -1; i <= 1; i++) {
      const h = 20 + Math.random() * 10
      graphics.fillStyle(dark, 0.6)
      graphics.fillRect(screenX + i * 12 - 4, screenY - 30 - h, 8, h)
    }
  } else if (type === 'workshop') {
    // Wider rectangle base + narrower top (anvil shape)
    graphics.fillStyle(dark, 0.7)
    graphics.fillRect(screenX - 15, screenY - 20, 30, 12)
    graphics.fillRect(screenX - 8, screenY - 32, 16, 12)
  } else if (type === 'terminal') {
    // Rectangle with emissive fill (monitor glow)
    graphics.fillStyle(color, 0.3)
    graphics.fillRect(screenX - 12, screenY - 35, 24, 18)
    graphics.lineStyle(1, color, 0.6)
    graphics.strokeRect(screenX - 12, screenY - 35, 24, 18)
  } else if (type === 'questBoard') {
    // Rectangle + two thin posts
    graphics.fillStyle(dark, 0.6)
    graphics.fillRect(screenX - 2, screenY - 20, 4, 20)
    graphics.fillRect(screenX - 14, screenY - 20, 4, 20)
    graphics.fillRect(screenX - 16, screenY - 35, 32, 15)
  }
  // center: no structure
}

type ZoneKey = keyof typeof ZONES

const PARTICLE_CONFIGS: Record<
  ZoneKey,
  (hex: number) => Phaser.Types.GameObjects.Particles.ParticleEmitterConfig
> = {
  library: color => ({
    color: [color],
    alpha: { start: 0.5, end: 0 },
    scale: { start: 0.3, end: 0.1 },
    speed: { min: 10, max: 30 },
    angle: { min: -100, max: -80 },
    lifespan: 3000,
    frequency: 200,
    quantity: 1,
  }),
  workshop: color => ({
    color: [color],
    alpha: { start: 0.7, end: 0 },
    speed: { min: 30, max: 80 },
    angle: { min: -120, max: -60 },
    gravityY: 100,
    lifespan: 800,
    frequency: 300,
    quantity: 1,
  }),
  terminal: color => ({
    color: [color],
    alpha: { start: 0.5, end: 0 },
    speed: { min: 10, max: 25 },
    angle: { min: 80, max: 100 },
    lifespan: 2000,
    frequency: 250,
    quantity: 1,
  }),
  questBoard: color => ({
    color: [color],
    alpha: { start: 0.6, end: 0 },
    speed: { min: 20, max: 40 },
    angle: { min: 0, max: 360 },
    lifespan: 2500,
    frequency: 200,
    quantity: 1,
    emitZone: {
      type: 'edge',
      source: new Phaser.Geom.Circle(0, 0, 50),
      quantity: 12,
    },
  }),
  center: color => ({
    color: [color],
    alpha: { start: 0.3, end: 0 },
    speed: { min: 5, max: 15 },
    angle: { min: 0, max: 360 },
    lifespan: 4000,
    frequency: 500,
    quantity: 1,
  }),
}

export function buildZones(scene: Phaser.Scene): void {
  // Create a 1x1 pixel texture for particles if it doesn't exist
  if (!scene.textures.exists('pixel')) {
    const canvas = scene.textures.createCanvas('pixel', 2, 2)
    if (canvas) {
      const ctx = canvas.getContext()
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, 2, 2)
      canvas.refresh()
    }
  }

  for (const [key, zone] of Object.entries(ZONES)) {
    const zoneKey = key as ZoneKey
    const hexColor = hexToNumber(zone.color)
    const { x: screenX, y: screenY } = worldToScreen(zone.x, zone.z)

    // Ring — isometric ellipse outline
    const ringGraphics = scene.add.graphics()
    ringGraphics.lineStyle(2, hexColor, 0.35)
    ringGraphics.strokeEllipse(screenX, screenY, 140, 70)

    // Disc — filled isometric ellipse
    const discGraphics = scene.add.graphics()
    discGraphics.fillStyle(hexColor, 0.08)
    discGraphics.fillEllipse(screenX, screenY, 140, 70)

    // Label
    scene.add
      .text(screenX, screenY + 45, zone.label, {
        fontSize: '12px',
        fontFamily: 'Space Grotesk, system-ui',
        color: zone.color,
        align: 'center',
      })
      .setOrigin(0.5, 0)
      .setAlpha(0.7)

    // Structures (geometric placeholders)
    const structGraphics = scene.add.graphics()
    buildStructure(structGraphics, zoneKey, screenX, screenY, hexColor)

    // Zone particles
    const config = PARTICLE_CONFIGS[zoneKey](hexColor)
    scene.add.particles(screenX, screenY, 'pixel', config)
  }
}
