// Click-to-select in the 3D view. Every selectable object carries `userData.pick`.
// When several overlap under the mouse, the one with the highest priority wins,
// then the nearest. So a Drone behind the see-through Safety Net is still clickable.

import type * as THREE from 'three'
import { selectionKey, useEditor, type Selection } from '../store/editorStore'

export interface Pick {
  selection: Selection
  priority: number
}

export const PRIORITY = {
  handle: 7,
  presetPoint: 6,
  drone: 5,
  waypoint: 4,
  takeoffSpot: 3,
  projection: 2,
  audience: 2,
  net: 1
} as const

/** userData for a selectable object. */
export const pickable = (selection: Selection, priority: number): { pick: Pick } => ({ pick: { selection, priority } })

function pickOf(object: THREE.Object3D | null): Pick | null {
  for (let o = object; o; o = o.parent) {
    const p = o.userData?.pick as Pick | undefined
    if (p) return p
  }
  return null
}

export function bestPick(intersections: THREE.Intersection[]): Pick | null {
  let best: Pick | null = null
  for (const hit of intersections) {
    const p = pickOf(hit.object)
    if (p && (!best || p.priority > best.priority)) best = p
  }
  return best
}

// A click on the move gizmo is also a click on whatever is behind it. Ignore clicks
// that end a gizmo drag so they don't change the selection.
let lastGizmoUse = 0
export const markGizmoUsed = (): void => void (lastGizmoUse = performance.now())
export const gizmoRecentlyUsed = (): boolean => performance.now() - lastGizmoUse < 300

/** Whether the object with this selection is selected or under the mouse. */
export function useHighlight(selection: Selection): { selected: boolean; hovered: boolean } {
  const key = selectionKey(selection)
  const selected = useEditor((s) => selectionKey(s.selection) === key)
  const hovered = useEditor((s) => s.hovered === key)
  return { selected, hovered }
}
