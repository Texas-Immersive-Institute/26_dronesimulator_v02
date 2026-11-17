import type { Stage, Vec3, Wall } from './types'

export interface WallFrame {
  /** Centre of the wall at floor level. */
  base: Vec3
  /** Unit vector pointing from the wall into the Stage. */
  inward: Vec3
  /** Unit vector along the wall, for horizontal offsets. */
  along: Vec3
  /** Width of the wall. */
  length: number
  /** Y rotation that turns a default (+Z facing) plane to face into the Stage. */
  rotationY: number
}

export function wallFrame(stage: Stage, wall: Wall): WallFrame {
  const w = stage.width / 2
  const d = stage.depth / 2
  switch (wall) {
    case 'front':
      return { base: [0, 0, d], inward: [0, 0, -1], along: [1, 0, 0], length: stage.width, rotationY: Math.PI }
    case 'back':
      return { base: [0, 0, -d], inward: [0, 0, 1], along: [1, 0, 0], length: stage.width, rotationY: 0 }
    case 'left':
      return { base: [-w, 0, 0], inward: [1, 0, 0], along: [0, 0, 1], length: stage.depth, rotationY: Math.PI / 2 }
    case 'right':
      return { base: [w, 0, 0], inward: [-1, 0, 0], along: [0, 0, 1], length: stage.depth, rotationY: -Math.PI / 2 }
  }
}

export const WALL_LABELS: Record<Wall, string> = {
  front: 'Front',
  back: 'Back',
  left: 'Left',
  right: 'Right'
}
