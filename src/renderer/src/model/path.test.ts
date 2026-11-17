import { describe, expect, it } from 'vitest'
import {
  autoHandles,
  clampHold,
  clampWaypointTime,
  insertWaypointAt,
  positionAt,
  samplePath,
  segmentLength,
  setHandle,
  smoothPath
} from './path'
import type { Vec3, Waypoint } from './types'
import { length } from './vec'

let n = 0
function wp(kind: Waypoint['kind'], time: number, position: Vec3, hold = 0, extra: Partial<Waypoint> = {}): Waypoint {
  return {
    id: `w${n++}`,
    kind,
    time,
    hold,
    position,
    inHandle: [0, 0, 0],
    outHandle: [0, 0, 0],
    segment: 'linear',
    handlesLinked: true,
    ...extra
  }
}

const close = (a: Vec3, b: Vec3, digits = 3): void => {
  a.forEach((v, i) => expect(v).toBeCloseTo(b[i], digits))
}

describe('positionAt', () => {
  const path = [wp('takeoff', 1, [0, 0, 0]), wp('air', 3, [0, 2, 0], 2), wp('landing', 9, [4, 0, 0])]

  it('sits on the Takeoff Spot before takeoff', () => {
    close(positionAt(path, 0), [0, 0, 0])
    close(positionAt(path, 1), [0, 0, 0])
  })

  it('moves at constant speed along a linear Segment', () => {
    close(positionAt(path, 2), [0, 1, 0])
  })

  it('stays put during a Hold', () => {
    close(positionAt(path, 3), [0, 2, 0])
    close(positionAt(path, 4.5), [0, 2, 0])
    close(positionAt(path, 5), [0, 2, 0])
  })

  it('leaves after the Hold and lands at the landing time', () => {
    close(positionAt(path, 7), [2, 1, 0])
    close(positionAt(path, 9), [4, 0, 0])
    close(positionAt(path, 20), [4, 0, 0])
  })

  it('moves at constant speed along a Bezier Segment', () => {
    const a = wp('takeoff', 0, [0, 0, 0], 0, { segment: 'bezier', outHandle: [0, 3, 0] })
    const b = wp('landing', 10, [6, 0, 0], 0, { inHandle: [0, 3, 0] })
    const pts = samplePath([a, b], 200)
    const total = segmentLength(a, b)
    // The point at half time should be half way along the curve's length.
    const half = positionAt([a, b], 5)
    let travelled = 0
    for (let i = 1; i < pts.length; i++) {
      const seg = length([pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]])
      if (pts[i][0] > half[0]) break
      travelled += seg
    }
    expect(travelled / total).toBeCloseTo(0.5, 1)
  })
})

describe('timing limits', () => {
  const path = [wp('takeoff', 0, [0, 0, 0]), wp('air', 3, [0, 2, 0], 2), wp('landing', 9, [0, 0, 0])]

  it('keeps a Waypoint after the previous departure and before the next arrival', () => {
    expect(clampWaypointTime(path, 1, -5)).toBeCloseTo(0.1)
    expect(clampWaypointTime(path, 1, 100)).toBeCloseTo(9 - 2 - 0.1)
    expect(clampWaypointTime(path, 1, 4)).toBe(4)
  })

  it('keeps a Hold short enough to reach the next Waypoint', () => {
    expect(clampHold(path, 1, 50)).toBeCloseTo(9 - 3 - 0.1)
    expect(clampHold(path, 1, -1)).toBe(0)
  })
})

describe('insertWaypointAt', () => {
  it('inserts on the Path at the current position', () => {
    const path = [wp('takeoff', 0, [0, 0, 0]), wp('landing', 10, [10, 0, 0])]
    const i = insertWaypointAt(path, 4, 'new')
    expect(i).toBe(1)
    expect(path).toHaveLength(3)
    close(path[1].position, [4, 0, 0])
  })

  it('keeps a Bezier Segment the same shape when splitting it', () => {
    const a = wp('takeoff', 0, [0, 0, 0], 0, { segment: 'bezier', outHandle: [0, 3, 0] })
    const b = wp('landing', 10, [6, 0, 0], 0, { inHandle: [-1, 3, 0] })
    const before = [3, 5, 8].map((t) => positionAt([a, b], t))
    const path = [a, b]
    insertWaypointAt(path, 4, 'new')
    const after = [3, 5, 8].map((t) => positionAt(path, t))
    before.forEach((p, i) => close(p, after[i], 1))
  })

  it('refuses during a Hold or outside the Path', () => {
    const path = [wp('takeoff', 1, [0, 0, 0]), wp('air', 3, [0, 2, 0], 2), wp('landing', 9, [0, 0, 0])]
    expect(insertWaypointAt(path, 4, 'x')).toBeNull()
    expect(insertWaypointAt(path, 0.5, 'x')).toBeNull()
    expect(insertWaypointAt(path, 12, 'x')).toBeNull()
  })
})

describe('handles', () => {
  it('linked handles stay opposite and keep their own weight', () => {
    const w = wp('air', 0, [0, 0, 0], 0, { inHandle: [-2, 0, 0], outHandle: [1, 0, 0] })
    setHandle(w, 'out', [0, 3, 0])
    close(w.outHandle, [0, 3, 0])
    close(w.inHandle, [0, -2, 0])
  })

  it('smoothPath makes every Segment a Bezier', () => {
    const path = [wp('takeoff', 0, [0, 0, 0]), wp('air', 3, [0, 2, 0]), wp('landing', 9, [3, 0, 0])]
    smoothPath(path)
    expect(path.slice(0, -1).every((w) => w.segment === 'bezier')).toBe(true)
    expect(length(path[1].outHandle)).toBeGreaterThan(0)
  })
})

describe('autoHandles', () => {
  it('gives a fresh curve real handles even when both neighbours are the same spot', () => {
    const path = [wp('takeoff', 0, [0, 0, 0]), wp('air', 3, [0, 1.5, 0]), wp('landing', 8, [0, 0, 0])]
    expect(length(autoHandles(path, 1).outHandle)).toBeGreaterThan(0)
    expect(length(autoHandles(path, 1).inHandle)).toBeGreaterThan(0)
  })
})
