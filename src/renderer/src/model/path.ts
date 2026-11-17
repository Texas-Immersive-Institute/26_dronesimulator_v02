// Path geometry and timing: where a Drone's Path says it should be at a given time.
// This is the intended Path only. The simulated Flight comes in Milestone 2.

import type { Drone, Vec3, Waypoint } from './types'
import { add, distance, length, lerp, normalize, scale, sub } from './vec'

/** Smallest time between leaving one Waypoint and arriving at the next, in seconds. */
export const MIN_SEGMENT_TIME = 0.1

const ARC_SAMPLES = 48

export const departureTime = (w: Waypoint): number => w.time + w.hold

/** The four cubic Bezier control points of the Segment from `a` to `b`. */
export function segmentControls(a: Waypoint, b: Waypoint): [Vec3, Vec3, Vec3, Vec3] {
  if (a.segment === 'linear') {
    return [a.position, lerp(a.position, b.position, 1 / 3), lerp(a.position, b.position, 2 / 3), b.position]
  }
  return [a.position, add(a.position, a.outHandle), add(b.position, b.inHandle), b.position]
}

export function cubic(p: [Vec3, Vec3, Vec3, Vec3], u: number): Vec3 {
  const v = 1 - u
  const b0 = v * v * v
  const b1 = 3 * v * v * u
  const b2 = 3 * v * u * u
  const b3 = u * u * u
  return [
    b0 * p[0][0] + b1 * p[1][0] + b2 * p[2][0] + b3 * p[3][0],
    b0 * p[0][1] + b1 * p[1][1] + b2 * p[2][1] + b3 * p[3][1],
    b0 * p[0][2] + b1 * p[1][2] + b2 * p[2][2] + b3 * p[3][2]
  ]
}

/** Cumulative arc length at evenly spaced curve parameters. */
function arcTable(p: [Vec3, Vec3, Vec3, Vec3]): number[] {
  const table = [0]
  let prev = p[0]
  for (let i = 1; i <= ARC_SAMPLES; i++) {
    const pt = cubic(p, i / ARC_SAMPLES)
    table.push(table[i - 1] + distance(prev, pt))
    prev = pt
  }
  return table
}

export function segmentLength(a: Waypoint, b: Waypoint): number {
  const t = arcTable(segmentControls(a, b))
  return t[t.length - 1]
}

/** Curve parameter at which `fraction` of the Segment's length has been travelled. */
export function paramAtFraction(p: [Vec3, Vec3, Vec3, Vec3], fraction: number): number {
  const table = arcTable(p)
  const total = table[table.length - 1]
  if (total === 0) return fraction
  const target = Math.min(Math.max(fraction, 0), 1) * total
  let lo = 0
  let hi = ARC_SAMPLES
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (table[mid] < target) lo = mid
    else hi = mid
  }
  const span = table[hi] - table[lo]
  const local = span === 0 ? 0 : (target - table[lo]) / span
  return (lo + local) / ARC_SAMPLES
}

/**
 * Where the Path puts the Drone at time `t`. Within a Segment the Drone moves at a
 * constant speed along the curve. It sits still during Holds, before the takeoff and
 * after the landing.
 */
export function positionAt(waypoints: Waypoint[], t: number): Vec3 {
  if (waypoints.length === 0) return [0, 0, 0]
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i]
    const b = waypoints[i + 1]
    const leave = departureTime(a)
    if (t <= leave) return a.position
    if (t < b.time) {
      const p = segmentControls(a, b)
      return cubic(p, paramAtFraction(p, (t - leave) / (b.time - leave)))
    }
  }
  return waypoints[waypoints.length - 1].position
}

/** Points along the whole Path for drawing it as a line. */
export function samplePath(waypoints: Waypoint[], samplesPerSegment = 32): Vec3[] {
  if (waypoints.length === 0) return []
  const points: Vec3[] = [waypoints[0].position]
  for (let i = 0; i < waypoints.length - 1; i++) {
    const p = segmentControls(waypoints[i], waypoints[i + 1])
    const n = waypoints[i].segment === 'linear' ? 1 : samplesPerSegment
    for (let s = 1; s <= n; s++) points.push(cubic(p, s / n))
  }
  return points
}

/** Average speed along the Segment leaving Waypoint `i`, in metres per second. */
export function segmentSpeed(waypoints: Waypoint[], i: number): number {
  const a = waypoints[i]
  const b = waypoints[i + 1]
  if (!b) return 0
  return segmentLength(a, b) / (b.time - departureTime(a))
}

/** Clamp a new arrival time for Waypoint `i` so it stays between its neighbours and their Holds. */
export function clampWaypointTime(waypoints: Waypoint[], i: number, time: number): number {
  const w = waypoints[i]
  const prev = waypoints[i - 1]
  const next = waypoints[i + 1]
  const lo = prev ? departureTime(prev) + MIN_SEGMENT_TIME : 0
  const hi = next ? next.time - w.hold - MIN_SEGMENT_TIME : Number.POSITIVE_INFINITY
  if (lo > hi) return w.time
  return Math.min(Math.max(time, lo), hi)
}

/** Clamp a new Hold for Waypoint `i` so the Drone can still reach the next Waypoint. */
export function clampHold(waypoints: Waypoint[], i: number, hold: number): number {
  const w = waypoints[i]
  const next = waypoints[i + 1]
  const hi = next ? next.time - w.time - MIN_SEGMENT_TIME : Number.POSITIVE_INFINITY
  return Math.min(Math.max(hold, 0), Math.max(hi, 0))
}

/**
 * Insert an air Waypoint at time `t`, on the Path where the Drone would be at that
 * moment, without changing the Path's shape. Returns the index, or null if `t` is
 * before takeoff, after landing, during a Hold or too close to another Waypoint.
 */
export function insertWaypointAt(waypoints: Waypoint[], t: number, id: string): number | null {
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i]
    const b = waypoints[i + 1]
    const leave = departureTime(a)
    if (t < leave + MIN_SEGMENT_TIME || t > b.time - MIN_SEGMENT_TIME) continue

    const p = segmentControls(a, b)
    const u = paramAtFraction(p, (t - leave) / (b.time - leave))
    // Split the Bezier in two (de Casteljau) so the curve keeps its exact shape.
    const p01 = lerp(p[0], p[1], u)
    const p12 = lerp(p[1], p[2], u)
    const p23 = lerp(p[2], p[3], u)
    const p012 = lerp(p01, p12, u)
    const p123 = lerp(p12, p23, u)
    const mid = lerp(p012, p123, u)

    const w: Waypoint = {
      id,
      kind: 'air',
      time: t,
      hold: 0,
      position: mid,
      inHandle: [0, 0, 0],
      outHandle: [0, 0, 0],
      segment: a.segment,
      handlesLinked: true
    }
    if (a.segment === 'bezier') {
      a.outHandle = sub(p01, p[0])
      w.inHandle = sub(p012, mid)
      w.outHandle = sub(p123, mid)
      b.inHandle = sub(p23, p[3])
    }
    waypoints.splice(i + 1, 0, w)
    return i + 1
  }
  return null
}

/** Handles that make a smooth curve through Waypoint `i` and its neighbours. */
export function autoHandles(waypoints: Waypoint[], i: number): { inHandle: Vec3; outHandle: Vec3 } {
  const p = waypoints[i].position
  const prev = waypoints[i - 1]?.position
  const next = waypoints[i + 1]?.position
  const dir = prev && next ? normalize(sub(next, prev)) : null
  // With both neighbours (and not on top of each other), keep the curve smooth through this point.
  if (prev && next && dir && length(dir) > 0) {
    return {
      inHandle: scale(dir, -distance(p, prev) / 3),
      outHandle: scale(dir, distance(p, next) / 3)
    }
  }
  return {
    inHandle: prev ? scale(sub(prev, p), 1 / 3) : [0, 0, 0],
    outHandle: next ? scale(sub(next, p), 1 / 3) : [0, 0, 0]
  }
}

/** Turn every Segment of the Path into a smooth Bezier curve. */
export function smoothPath(waypoints: Waypoint[]): void {
  const handles = waypoints.map((_, i) => autoHandles(waypoints, i))
  waypoints.forEach((w, i) => {
    w.inHandle = handles[i].inHandle
    w.outHandle = handles[i].outHandle
    w.handlesLinked = true
    if (i < waypoints.length - 1) w.segment = 'bezier'
  })
}

/**
 * Set one handle of a Waypoint. If its handles are linked, the other handle turns to
 * point the opposite way and keeps its own length (weight).
 */
export function setHandle(w: Waypoint, which: 'in' | 'out', value: Vec3): void {
  if (which === 'in') w.inHandle = value
  else w.outHandle = value
  if (!w.handlesLinked) return
  const dir = normalize(value)
  if (which === 'in') w.outHandle = scale(dir, -length(w.outHandle))
  else w.inHandle = scale(dir, -length(w.inHandle))
}

/** Change a handle's length (its weight). A zero-length handle is pointed at the neighbouring Waypoint. */
export function setHandleWeight(waypoints: Waypoint[], i: number, which: 'in' | 'out', weight: number): void {
  const w = waypoints[i]
  const current = which === 'in' ? w.inHandle : w.outHandle
  let dir = normalize(current)
  if (length(dir) === 0) {
    const neighbour = waypoints[which === 'in' ? i - 1 : i + 1]
    if (!neighbour) return
    dir = normalize(sub(neighbour.position, w.position))
  }
  const value = scale(dir, Math.max(weight, 0))
  if (which === 'in') w.inHandle = value
  else w.outHandle = value
}

/** Keep the takeoff and landing Waypoints on the Drone's Takeoff Spot. */
export function syncTakeoffSpot(drone: Drone): void {
  const [x, z] = drone.takeoffSpot
  for (const w of drone.waypoints) {
    if (w.kind !== 'air') w.position = [x, 0, z]
  }
}

/** The time the last Drone lands, or 0 with no Drones. */
export function lastLandingTime(drones: Drone[]): number {
  let t = 0
  for (const d of drones) {
    const last = d.waypoints[d.waypoints.length - 1]
    if (last) t = Math.max(t, last.time)
  }
  return t
}

/** What dragging a Drone in the 3D view at time `t` moves. */
export type DragTarget = { kind: 'spot' } | { kind: 'waypoint'; index: number } | { kind: 'between' }

/**
 * On the floor (before takeoff or after landing) a drag moves the Takeoff Spot. At an
 * air Waypoint or during its Hold it moves that Waypoint. Anywhere else the caller adds
 * a Waypoint at `t` (like auto-keying in an animation tool).
 */
export function dragTargetAt(waypoints: Waypoint[], t: number, tolerance = 0.05): DragTarget {
  const first = waypoints[0]
  const last = waypoints[waypoints.length - 1]
  if (!first || t <= departureTime(first) + tolerance || t >= last.time - tolerance) return { kind: 'spot' }
  for (let i = 1; i < waypoints.length - 1; i++) {
    const w = waypoints[i]
    if (t >= w.time - tolerance && t <= departureTime(w) + tolerance) return { kind: 'waypoint', index: i }
  }
  return { kind: 'between' }
}

/** Index of the Waypoint whose arrival time is closest to `t`. */
export function nearestWaypointIndex(waypoints: Waypoint[], t: number): number {
  let best = 0
  waypoints.forEach((w, i) => {
    if (Math.abs(w.time - t) < Math.abs(waypoints[best].time - t)) best = i
  })
  return best
}
