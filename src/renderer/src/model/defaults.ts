import type { Drone, Project, Stage, Waypoint } from './types'

/** Soft limit: more Drones are allowed, but the app warns. */
export const DRONE_SOFT_LIMIT = 10

export const EDITOR_COLORS = [
  '#4fc3f7',
  '#ffb74d',
  '#81c784',
  '#f06292',
  '#ba68c8',
  '#fff176',
  '#4db6ac',
  '#ff8a65',
  '#9fa8da',
  '#e0e0e0'
]

export const newId = (): string => crypto.randomUUID()

/** A placeholder Stage to edit into the real venue's measurements. */
export function defaultStage(): Stage {
  return {
    width: 12,
    depth: 8,
    height: 6,
    net: { placement: 'side', side: 'front', distance: 2, height: 5 },
    projection: { wall: 'back', offset: 0, bottom: 1, width: 6, height: 3.4 },
    audience: { x: 0, z: 3, width: 12, depth: 2 }
  }
}

export function newProject(): Project {
  return {
    formatVersion: 1,
    name: 'Untitled Show',
    stage: defaultStage(),
    show: { duration: 60, droneModel: 'DEXI-5', drones: [] }
  }
}

function waypoint(kind: Waypoint['kind'], time: number, position: Waypoint['position'], hold = 0): Waypoint {
  return {
    id: newId(),
    kind,
    time,
    hold,
    position,
    inHandle: [0, 0, 0],
    outHandle: [0, 0, 0],
    segment: 'linear',
    handlesLinked: true
  }
}

/** A new Drone with the lowest free number, a Takeoff Spot in a row and a simple hop. */
export function newDrone(project: Project): Drone {
  const used = new Set(project.show.drones.map((d) => d.number))
  let number = 1
  while (used.has(number)) number++

  const { width, depth } = project.stage
  const x = Math.max(-width / 2 + 0.5, Math.min(width / 2 - 0.5, -4.5 + (number - 1)))
  const z = Math.max(-depth / 2 + 0.5, Math.min(depth / 2 - 0.5, -1))
  const ground: [number, number, number] = [x, 0, z]
  return {
    id: newId(),
    number,
    name: '',
    editorColor: EDITOR_COLORS[(number - 1) % EDITOR_COLORS.length],
    takeoffSpot: [x, z],
    waypoints: [
      waypoint('takeoff', 0, ground),
      waypoint('air', 3, [x, 1.5, z], 2),
      waypoint('landing', 8, ground)
    ]
  }
}

export const droneLabel = (d: Drone): string => (d.name ? `D${d.number} ${d.name}` : `D${d.number}`)
