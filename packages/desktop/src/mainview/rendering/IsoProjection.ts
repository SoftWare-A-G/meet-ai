export const TILE_WIDTH = 64
export const TILE_HEIGHT = 32
export const HEIGHT_SCALE = 20

export function worldToScreen(worldX: number, worldZ: number): { x: number; y: number } {
  return {
    x: (worldX - worldZ) * (TILE_WIDTH / 2),
    y: (worldX + worldZ) * (TILE_HEIGHT / 2),
  }
}

export function screenToWorld(screenX: number, screenY: number): { x: number; z: number } {
  return {
    x: screenX / TILE_WIDTH + screenY / TILE_HEIGHT,
    z: screenY / TILE_HEIGHT - screenX / TILE_WIDTH,
  }
}

export function heightOffset(worldY: number): number {
  return -worldY * HEIGHT_SCALE
}
