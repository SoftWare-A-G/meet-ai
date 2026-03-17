import * as Phaser from 'phaser'
import { GameScene } from './GameScene'

export function createPhaserGame(): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game-container',
    backgroundColor: '#0e1015',
    scene: [GameScene],
    dom: { createContainer: true },
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: window.innerWidth,
      height: window.innerHeight,
    },
    physics: { default: undefined },
  })
}
