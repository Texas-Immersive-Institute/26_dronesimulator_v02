import type { DroneModelId } from './types'

export interface DroneModelSpec {
  id: DroneModelId
  /** Physical size in metres, or null when DroneBlocks does not publish it. */
  size: { length: number; width: number; height: number } | null
  sizeSource: string
  propDiameterInches: number
  /** Published flight time in minutes. */
  flightTimeMinutes: number
  flightTimeSource: string
}

// Only figures published by DroneBlocks (read 2026-11-10). Nothing here is estimated.
export const DRONE_MODELS: Record<DroneModelId, DroneModelSpec> = {
  'DEXI-5': {
    id: 'DEXI-5',
    size: { length: 0.368, width: 0.328, height: 0.07 },
    sizeSource:
      '368 × 328 × 70 mm, from the DEXI-5 PX4 Developer Kit product page (its spec section is headed "DroneBlocks DEXI").',
    propDiameterInches: 5.5,
    flightTimeMinutes: 15,
    flightTimeSource: '"~15 min hovering", DroneBlocks DEXI-5 hardware page.'
  },
  'DEXI-3': {
    id: 'DEXI-3',
    size: null,
    sizeSource: 'Not published by DroneBlocks. Measure a real DEXI-3 to fill this in.',
    propDiameterInches: 3,
    flightTimeMinutes: 10,
    flightTimeSource: '"10+ min typical", DroneBlocks DEXI-3 hardware page.'
  }
}
