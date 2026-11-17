import { describe, expect, it } from 'vitest'
import { newDrone, newProject } from './defaults'
import { parseProject, serializeProject } from './serialize'

describe('project files', () => {
  it('round-trips a Project', () => {
    const p = newProject()
    p.name = 'Act 1'
    p.show.drones.push(newDrone(p))
    p.show.drones.push(newDrone(p))
    expect(parseProject(serializeProject(p))).toEqual(p)
  })

  it('gives new Drones the lowest free number', () => {
    const p = newProject()
    const d1 = newDrone(p)
    p.show.drones.push(d1)
    p.show.drones.push(newDrone(p))
    p.show.drones.splice(0, 1)
    expect(newDrone(p).number).toBe(1)
  })

  it('fills in Stage settings missing from older files', () => {
    const p = newProject() as unknown as Record<string, unknown>
    const stage = (p.stage as Record<string, unknown>)
    delete stage.audience
    const parsed = parseProject(JSON.stringify(p))
    expect(parsed.stage.audience).toBeDefined()
  })

  it('rejects files that are not Projects', () => {
    expect(() => parseProject('nope')).toThrow(/not valid JSON/)
    expect(() => parseProject('{"formatVersion":2}')).toThrow(/newer/)
    const p = newProject()
    const d = newDrone(p)
    d.waypoints.reverse()
    p.show.drones.push(d)
    expect(() => parseProject(serializeProject(p))).toThrow(/takeoff/)
  })
})
