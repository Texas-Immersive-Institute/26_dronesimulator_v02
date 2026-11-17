// Path Presets: ready-made Paths (hover, back and forth, circle, figure eight) that are
// generated from a few settings. Changing a setting regenerates the Drone's Waypoints.

import { newId } from './defaults'
import { departureTime, samplePath, segmentLength } from './path'
import { wallFrame } from './stageGeometry'
import type { Drone, PathPreset, PathPresetKind, Stage, Vec3, Waypoint } from './types'
import { add, dot, scale, sub } from './vec'

export const PRESET_LABELS: Record<PathPresetKind, string> = {
  hover: 'Hover',
  backAndForth: 'Back and forth',
  circle: 'Circle',
  figureEight: 'Figure eight'
}

export type PresetPointId = 'point' | 'a' | 'b' | 'center'

const POINTS_PER_LAP = 8
const DEG = Math.PI / 180

function wp(kind: Waypoint['kind'], time: number, position: Vec3, hold = 0): Waypoint {
  return {
    id: '',
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

/**
 * Air Waypoints on a closed horizontal curve, sampled evenly in its parameter, with
 * Bezier handles from the curve's tangent so the Path follows it smoothly.
 */
function loopWaypoints(
  center: Vec3,
  laps: number,
  curve: (t: number) => [number, number],
  tangent: (t: number) => [number, number],
  angle: number
): Waypoint[] {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  // Drop floating-point dust (and -0) so saved files stay tidy and round-trip exactly.
  const tidy = (v: number): number => (Math.abs(v) < 1e-12 ? 0 : v)
  const rot = ([x, z]: [number, number]): Vec3 => [tidy(x * cos - z * sin), 0, tidy(x * sin + z * cos)]
  const dt = (2 * Math.PI) / POINTS_PER_LAP
  const count = Math.max(1, Math.round(laps)) * POINTS_PER_LAP
  const out: Waypoint[] = []
  for (let k = 0; k <= count; k++) {
    const t = k * dt
    const w = wp('air', 0, add(center, rot(curve(t))))
    const h = scale(rot(tangent(t)), dt / 3)
    w.outHandle = h
    w.inHandle = [tidy(-h[0]), 0, tidy(-h[2])]
    w.segment = k < count ? 'bezier' : 'linear'
    out.push(w)
  }
  return out
}

/** The air Waypoints of the pattern, with times set relative to arriving at the first one (t = 0). */
function patternWaypoints(preset: PathPreset): Waypoint[] {
  switch (preset.kind) {
    case 'hover':
      return [wp('air', 0, preset.point, Math.max(preset.hold, 0))]
    case 'backAndForth': {
      const legs = Math.max(1, Math.round(preset.legs))
      const hold = Math.max(preset.hold, 0)
      const out: Waypoint[] = []
      for (let i = 0; i <= legs; i++) {
        out.push(wp('air', i * (preset.legTime + hold), i % 2 === 0 ? preset.a : preset.b, hold))
      }
      return out
    }
    case 'circle': {
      const r = preset.radius
      const dir = preset.clockwise ? 1 : -1
      const out = loopWaypoints(
        preset.center,
        preset.laps,
        (t) => [r * Math.cos(dir * t), r * Math.sin(dir * t)],
        (t) => [-r * dir * Math.sin(dir * t), r * dir * Math.cos(dir * t)],
        preset.angle * DEG
      )
      const step = preset.lapTime / POINTS_PER_LAP
      out.forEach((w, i) => (w.time = i * step))
      return out
    }
    case 'figureEight': {
      const a = preset.width / 2
      const out = loopWaypoints(
        preset.center,
        preset.laps,
        (t) => [a * Math.sin(t), (a / 2) * Math.sin(2 * t)],
        (t) => [a * Math.cos(t), a * Math.cos(2 * t)],
        preset.angle * DEG
      )
      // The Drone moves at an even speed: share each lap's time out by Segment length.
      const lengths = out.slice(0, -1).map((w, i) => segmentLength(w, out[i + 1]))
      const lapLength = lengths.slice(0, POINTS_PER_LAP).reduce((s, l) => s + l, 0)
      let t = 0
      out.forEach((w, i) => {
        w.time = t
        if (i < lengths.length) t += lapLength > 0 ? (lengths[i] / lapLength) * preset.lapTime : preset.lapTime / POINTS_PER_LAP
      })
      return out
    }
  }
}

/** The whole Path for a preset: takeoff, the pattern, landing. Waypoint ids are left empty. */
export function generatePresetPath(preset: PathPreset, takeoffSpot: [number, number]): Waypoint[] {
  const ground: Vec3 = [takeoffSpot[0], 0, takeoffSpot[1]]
  const start = Math.max(preset.start, 0)
  const transit = Math.max(preset.transit, 0.2)
  const arrive = start + transit
  const pattern = patternWaypoints(preset)
  pattern.forEach((w) => (w.time += arrive))
  const last = pattern[pattern.length - 1]
  return [wp('takeoff', 0, ground, start), ...pattern, wp('landing', departureTime(last) + transit, ground)]
}

/** Regenerate a Drone's Waypoints from its preset, keeping Waypoint ids where it can. */
export function applyPreset(drone: Drone): void {
  if (!drone.preset) return
  const next = generatePresetPath(drone.preset, drone.takeoffSpot)
  const oldAir = drone.waypoints.filter((w) => w.kind === 'air')
  const takeoff = drone.waypoints.find((w) => w.kind === 'takeoff')
  const landing = drone.waypoints.find((w) => w.kind === 'landing')
  let air = 0
  for (const w of next) {
    if (w.kind === 'takeoff') w.id = takeoff?.id ?? newId()
    else if (w.kind === 'landing') w.id = landing?.id ?? newId()
    else w.id = oldAir[air++]?.id ?? newId()
  }
  drone.waypoints = next
}

const near = (a: number, b: number): boolean => Math.abs(a - b) < 1e-6
const nearVec = (a: Vec3, b: Vec3): boolean => near(a[0], b[0]) && near(a[1], b[1]) && near(a[2], b[2])

/** True when the Drone's Waypoints are still exactly what its preset generates (no hand edits since). */
export function presetMatchesPath(drone: Drone): boolean {
  if (!drone.preset) return false
  const gen = generatePresetPath(drone.preset, drone.takeoffSpot)
  const cur = drone.waypoints
  if (gen.length !== cur.length) return false
  return gen.every((g, i) => {
    const c = cur[i]
    if (g.kind !== c.kind || g.segment !== c.segment || !near(g.time, c.time) || !near(g.hold, c.hold) || !nearVec(g.position, c.position)) return false
    if (g.segment === 'bezier' && !nearVec(g.outHandle, c.outHandle)) return false
    if (i > 0 && gen[i - 1].segment === 'bezier' && !nearVec(g.inHandle, c.inHandle)) return false
    return true
  })
}

/** The points of a preset that can be dragged in the 3D view. */
export function presetPoints(preset: PathPreset): { id: PresetPointId; label: string; position: Vec3 }[] {
  switch (preset.kind) {
    case 'hover':
      return [{ id: 'point', label: 'Hover point', position: preset.point }]
    case 'backAndForth':
      return [
        { id: 'a', label: 'A', position: preset.a },
        { id: 'b', label: 'B', position: preset.b }
      ]
    case 'circle':
    case 'figureEight':
      return [{ id: 'center', label: 'Centre', position: preset.center }]
  }
}

export function setPresetPoint(preset: PathPreset, id: PresetPointId, p: Vec3): void {
  if (preset.kind === 'hover' && id === 'point') preset.point = p
  else if (preset.kind === 'backAndForth' && id === 'a') preset.a = p
  else if (preset.kind === 'backAndForth' && id === 'b') preset.b = p
  else if ((preset.kind === 'circle' || preset.kind === 'figureEight') && id === 'center') preset.center = p
}

const clamp = (v: number, lo: number, hi: number): number => (lo > hi ? (lo + hi) / 2 : Math.min(Math.max(v, lo), hi))

/** Sensible starting settings for a preset, based on where the Drone takes off and the Stage size. */
export function defaultPreset(kind: PathPresetKind, drone: Drone, stage: Stage, from?: PathPreset): PathPreset {
  const [x, z] = drone.takeoffSpot
  const hw = stage.width / 2
  const hd = stage.depth / 2
  const height = clamp(1.5, 0.5, stage.height - 0.5)
  const start = from?.start ?? 0
  const transit = from?.transit ?? 3
  const centerFor = (rx: number, rz: number): Vec3 => [clamp(x, -hw + rx + 0.3, hw - rx - 0.3), height, clamp(z, -hd + rz + 0.3, hd - rz - 0.3)]

  switch (kind) {
    case 'hover':
      return { kind, start, transit, point: [x, height, z], hold: 5 }
    case 'backAndForth': {
      const span = 3
      const bx = x + span <= hw - 0.5 ? x + span : x - span
      return { kind, start, transit, a: [x, height, z], b: [clamp(bx, -hw + 0.5, hw - 0.5), height, z], legTime: 3, hold: 1, legs: 4 }
    }
    case 'circle':
      return { kind, start, transit, center: centerFor(1.5, 1.5), radius: 1.5, lapTime: 8, laps: 2, clockwise: true, angle: 0 }
    case 'figureEight':
      return { kind, start, transit, center: centerFor(1.5, 0.75), width: 3, lapTime: 12, laps: 1, angle: 0 }
  }
}

/**
 * A quick check of where a generated Path goes, so the inspector can warn while you
 * edit. This is not the Violation check, which runs on the simulated Flight.
 */
export function presetWarning(waypoints: Waypoint[], stage: Stage): string | null {
  const hw = stage.width / 2
  const hd = stage.depth / 2
  const points = samplePath(waypoints, 16)
  if (points.some((p) => p[0] < -hw || p[0] > hw || p[2] < -hd || p[2] > hd || p[1] > stage.height || p[1] < 0)) {
    return 'Part of this Path leaves the Stage.'
  }
  const net = stage.net
  if (net.placement === 'overhead') {
    if (points.some((p) => p[1] > net.height)) return 'Part of this Path goes above the overhead Safety Net.'
  } else {
    const f = wallFrame(stage, net.side)
    if (points.some((p) => dot(sub(p, f.base), f.inward) < net.distance)) return 'Part of this Path crosses the Safety Net.'
  }
  return null
}
