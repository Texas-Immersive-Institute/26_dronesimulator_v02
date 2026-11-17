import { EDITOR_COLORS, newId } from './defaults'
import { syncTakeoffSpot } from './path'
import { presetPoints, setPresetPoint } from './presets'
import type { Drone, Project, Vec3 } from './types'
import { add } from './vec'

/**
 * A copy of a Drone with the next free number, its whole Path (and Path Preset)
 * shifted 1 m sideways so the two don't sit on top of each other.
 */
export function duplicateDrone(project: Project, source: Drone): Drone {
  const used = new Set(project.show.drones.map((d) => d.number))
  let number = 1
  while (used.has(number)) number++

  const half = project.stage.width / 2 - 0.3
  const dx = source.takeoffSpot[0] + 1 <= half ? 1 : -1
  const shift: Vec3 = [dx, 0, 0]

  const copy: Drone = structuredClone(source)
  copy.id = newId()
  copy.number = number
  copy.name = source.name ? `${source.name} copy` : ''
  copy.editorColor = EDITOR_COLORS[(number - 1) % EDITOR_COLORS.length]
  copy.takeoffSpot = [source.takeoffSpot[0] + dx, source.takeoffSpot[1]]
  for (const w of copy.waypoints) {
    w.id = newId()
    if (w.kind === 'air') w.position = add(w.position, shift)
  }
  syncTakeoffSpot(copy)
  if (copy.preset) {
    for (const pt of presetPoints(copy.preset)) setPresetPoint(copy.preset, pt.id, add(pt.position, shift))
  }
  return copy
}
