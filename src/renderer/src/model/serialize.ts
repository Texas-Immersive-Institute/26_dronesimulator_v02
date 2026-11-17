import { defaultStage } from './defaults'
import type { Drone, PathPreset, Project, Waypoint } from './types'

export function serializeProject(project: Project): string {
  return JSON.stringify(project, null, 2)
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isVec3 = (v: unknown): v is [number, number, number] => Array.isArray(v) && v.length === 3 && v.every(isNum)

function checkWaypoint(w: Waypoint, where: string): void {
  if (!['takeoff', 'air', 'landing'].includes(w?.kind)) throw new Error(`${where}: unknown Waypoint kind.`)
  if (!isNum(w.time) || !isNum(w.hold) || !isVec3(w.position)) throw new Error(`${where}: bad time, Hold or position.`)
  if (!isVec3(w.inHandle) || !isVec3(w.outHandle)) throw new Error(`${where}: bad Bezier handles.`)
  if (w.segment !== 'linear' && w.segment !== 'bezier') throw new Error(`${where}: unknown Segment type.`)
}

const PRESET_KINDS = ['hover', 'backAndForth', 'circle', 'figureEight']

function isPreset(p: PathPreset): boolean {
  if (!p || !PRESET_KINDS.includes(p.kind) || !isNum(p.start) || !isNum(p.transit)) return false
  switch (p.kind) {
    case 'hover':
      return isVec3(p.point) && isNum(p.hold)
    case 'backAndForth':
      return isVec3(p.a) && isVec3(p.b) && isNum(p.legTime) && isNum(p.hold) && isNum(p.legs)
    case 'circle':
      return isVec3(p.center) && isNum(p.radius) && isNum(p.lapTime) && isNum(p.laps) && isNum(p.angle) && typeof p.clockwise === 'boolean'
    case 'figureEight':
      return isVec3(p.center) && isNum(p.width) && isNum(p.lapTime) && isNum(p.laps) && isNum(p.angle)
  }
}

function checkDrone(d: Drone, i: number): void {
  const where = `Drone ${i + 1}`
  if (!Array.isArray(d?.waypoints) || d.waypoints.length < 2) throw new Error(`${where}: needs a takeoff and a landing.`)
  d.waypoints.forEach((w, j) => checkWaypoint(w, `${where}, Waypoint ${j + 1}`))
  if (d.waypoints[0].kind !== 'takeoff' || d.waypoints[d.waypoints.length - 1].kind !== 'landing') {
    throw new Error(`${where}: the Path must start with a takeoff and end with a landing.`)
  }
  for (let j = 1; j < d.waypoints.length; j++) {
    if (d.waypoints[j].time < d.waypoints[j - 1].time) throw new Error(`${where}: Waypoints are out of time order.`)
  }
}

/** Parse a project.json, filling in any Stage settings missing from older files. Throws a readable Error. */
export function parseProject(json: string): Project {
  let raw: Project
  try {
    raw = JSON.parse(json)
  } catch {
    throw new Error('The project file is not valid JSON.')
  }
  if (raw?.formatVersion !== 1) throw new Error('This project file was made by a newer or unknown version of the app.')
  if (!raw.show || !Array.isArray(raw.show.drones)) throw new Error('The project file has no Show.')
  if (raw.show.droneModel !== 'DEXI-5' && raw.show.droneModel !== 'DEXI-3') throw new Error('Unknown Drone Model.')
  raw.show.drones.forEach(checkDrone)

  const base = defaultStage()
  const stage = raw.stage ?? base
  return {
    formatVersion: 1,
    name: typeof raw.name === 'string' ? raw.name : 'Untitled Show',
    stage: {
      ...base,
      ...stage,
      net: { ...base.net, ...stage.net },
      projection: { ...base.projection, ...stage.projection },
      audience: { ...base.audience, ...stage.audience }
    },
    show: {
      duration: isNum(raw.show.duration) ? raw.show.duration : 60,
      droneModel: raw.show.droneModel,
      drones: raw.show.drones.map((d) => {
        const drone: Drone = {
          ...d,
          waypoints: d.waypoints.map((w) => ({ ...w, handlesLinked: w.handlesLinked ?? true }))
        }
        // A preset that doesn't look right is dropped; the Waypoints it made are kept.
        if (drone.preset !== undefined && !isPreset(drone.preset)) delete drone.preset
        return drone
      })
    }
  }
}
