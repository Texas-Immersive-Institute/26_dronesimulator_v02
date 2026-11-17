import { describe, expect, it } from 'vitest'
import { newDrone, newProject } from './defaults'
import { duplicateDrone } from './duplicate'
import { dragTargetAt, positionAt } from './path'
import { applyPreset, defaultPreset, generatePresetPath, presetMatchesPath, presetWarning } from './presets'
import { parseProject, serializeProject } from './serialize'
import type { BackAndForthPreset, CirclePreset, Vec3 } from './types'
import { distance } from './vec'

const close = (a: Vec3, b: Vec3, digits = 3): void => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], digits))

const backAndForth: BackAndForthPreset = { kind: 'backAndForth', start: 1, transit: 2, a: [0, 1.5, 0], b: [3, 1.5, 0], legTime: 3, hold: 1, legs: 2 }

describe('Path Presets', () => {
  it('flies back and forth between A and B with Holds at each end', () => {
    const wps = generatePresetPath(backAndForth, [0, 0])
    expect(wps.map((w) => w.kind)).toEqual(['takeoff', 'air', 'air', 'air', 'landing'])
    expect(wps.map((w) => w.time)).toEqual([0, 3, 7, 11, 14])
    expect(wps[0].hold).toBe(1) // waits on the floor until the start time
    close(positionAt(wps, 3.5), [0, 1.5, 0]) // holding at A
    close(positionAt(wps, 5.5), [1.5, 1.5, 0]) // halfway to B
    close(positionAt(wps, 8), [3, 1.5, 0]) // holding at B
    close(positionAt(wps, 20), [0, 0, 0]) // landed back on the spot
  })

  it('keeps a circle on its radius all the way round', () => {
    const circle: CirclePreset = { kind: 'circle', start: 0, transit: 2, center: [1, 2, -1], radius: 1.5, lapTime: 8, laps: 2, clockwise: true, angle: 30 }
    const wps = generatePresetPath(circle, [0, 0])
    expect(wps[wps.length - 1].time).toBeCloseTo(2 + 16 + 2)
    for (let t = 2; t <= 18; t += 0.37) {
      const p = positionAt(wps, t)
      expect(p[1]).toBeCloseTo(2)
      expect(distance(p, [1, 2, -1])).toBeCloseTo(1.5, 2)
    }
  })

  it('regenerates when a setting changes and notices hand edits', () => {
    const p = newProject()
    const d = newDrone(p)
    d.preset = defaultPreset('figureEight', d, p.stage)
    applyPreset(d)
    expect(presetMatchesPath(d)).toBe(true)
    const ids = d.waypoints.map((w) => w.id)

    if (d.preset.kind === 'figureEight') d.preset.laps = 2
    applyPreset(d)
    expect(presetMatchesPath(d)).toBe(true)
    // Existing Waypoint ids are kept so the selection survives a regenerate.
    expect(d.waypoints.slice(0, ids.length - 1).map((w) => w.id)).toEqual(ids.slice(0, -1))

    d.waypoints[3].position = [0, 3, 0]
    expect(presetMatchesPath(d)).toBe(false)
  })

  it('still matches after the Takeoff Spot moves', () => {
    const p = newProject()
    const d = newDrone(p)
    d.preset = defaultPreset('hover', d, p.stage)
    applyPreset(d)
    d.takeoffSpot = [2, 2]
    for (const w of d.waypoints) if (w.kind !== 'air') w.position = [2, 0, 2]
    expect(presetMatchesPath(d)).toBe(true)
  })

  it('warns when a pattern leaves the Stage or crosses the Safety Net', () => {
    const p = newProject() // 12 × 8 m, side net 2 m in from the front wall (z = +4)
    expect(presetWarning(generatePresetPath(backAndForth, [0, 0]), p.stage)).toBeNull()
    expect(presetWarning(generatePresetPath({ ...backAndForth, b: [9, 1.5, 0] }, [0, 0]), p.stage)).toMatch(/leaves the Stage/)
    expect(presetWarning(generatePresetPath({ ...backAndForth, b: [0, 1.5, 3] }, [0, 0]), p.stage)).toMatch(/Safety Net/)
  })

  it('is saved with the Project', () => {
    const p = newProject()
    const d = newDrone(p)
    d.preset = defaultPreset('circle', d, p.stage)
    applyPreset(d)
    p.show.drones.push(d)
    expect(parseProject(serializeProject(p))).toEqual(p)
  })
})

describe('dragging a Drone', () => {
  const p = newProject()
  const d = newDrone(p) // takeoff 0, Waypoint at 3 holding 2 s, landing at 8

  it('moves the Takeoff Spot while on the floor', () => {
    expect(dragTargetAt(d.waypoints, 0).kind).toBe('spot')
    expect(dragTargetAt(d.waypoints, 9).kind).toBe('spot')
  })

  it('moves the Waypoint it is at or holding on', () => {
    expect(dragTargetAt(d.waypoints, 3)).toEqual({ kind: 'waypoint', index: 1 })
    expect(dragTargetAt(d.waypoints, 4.5)).toEqual({ kind: 'waypoint', index: 1 })
  })

  it('adds a Waypoint between Waypoints', () => {
    expect(dragTargetAt(d.waypoints, 1.5).kind).toBe('between')
    expect(dragTargetAt(d.waypoints, 6.5).kind).toBe('between')
  })
})

describe('duplicating a Drone', () => {
  it('copies the Path 1 m to the side with a new number and ids', () => {
    const p = newProject()
    const d = newDrone(p)
    d.preset = defaultPreset('backAndForth', d, p.stage)
    applyPreset(d)
    p.show.drones.push(d)
    const copy = duplicateDrone(p, d)
    expect(copy.number).toBe(2)
    expect(copy.id).not.toBe(d.id)
    expect(copy.waypoints.map((w) => w.id)).not.toContain(d.waypoints[1].id)
    expect(copy.takeoffSpot[0]).toBeCloseTo(d.takeoffSpot[0] + 1)
    close(copy.waypoints[1].position, [d.waypoints[1].position[0] + 1, d.waypoints[1].position[1], d.waypoints[1].position[2]])
    expect(presetMatchesPath(copy)).toBe(true)
  })
})
