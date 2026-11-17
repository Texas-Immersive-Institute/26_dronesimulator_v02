import { TransformControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { newId } from '../model/defaults'
import { dragTargetAt, insertWaypointAt, nearestWaypointIndex, positionAt, setHandle, syncTakeoffSpot } from '../model/path'
import { applyPreset, presetMatchesPath, presetPoints, setPresetPoint } from '../model/presets'
import { wallFrame } from '../model/stageGeometry'
import type { Drone, PathPreset, Project, Stage, Vec3 } from '../model/types'
import { add, dot, scale, sub } from '../model/vec'
import { formatTime } from '../panels/format'
import { draftDrone, findDrone, findWaypoint, useEditor, type Selection, type StagePart } from '../store/editorStore'
import { markGizmoUsed } from './picking'

/** True while Ctrl (or Cmd on Mac) is held: the gizmo then snaps to 10 cm steps. */
function useSnapKey(): boolean {
  const [held, setHeld] = useState(false)
  useEffect(() => {
    const on = (e: KeyboardEvent): void => setHeld(e.ctrlKey || e.metaKey)
    const off = (): void => setHeld(false)
    window.addEventListener('keydown', on)
    window.addEventListener('keyup', on)
    window.addEventListener('blur', off)
    return () => {
      window.removeEventListener('keydown', on)
      window.removeEventListener('keyup', on)
      window.removeEventListener('blur', off)
    }
  }, [])
  return held
}

interface GizmoProps {
  position: Vec3
  /** Which arrows to show, e.g. 'xz'. */
  axes?: string
  onStart?: () => void
  onMove: (p: Vec3) => void
}

/** A move gizmo. One whole drag is one undo step. */
function Gizmo({ position, axes = 'xyz', onStart, onMove }: GizmoProps): React.JSX.Element {
  const [target, setTarget] = useState<THREE.Mesh | null>(null)
  const snap = useSnapKey()
  return (
    <>
      <mesh ref={setTarget} position={position} visible={false}>
        <sphereGeometry args={[0.05]} />
      </mesh>
      {target && (
        <TransformControls
          object={target}
          mode="translate"
          size={0.8}
          showX={axes.includes('x')}
          showY={axes.includes('y')}
          showZ={axes.includes('z')}
          translationSnap={snap ? 0.1 : null}
          onMouseDown={() => {
            markGizmoUsed()
            const s = useEditor.getState()
            s.setPlaying(false)
            s.beginGesture()
            onStart?.()
          }}
          onMouseUp={() => {
            markGizmoUsed()
            useEditor.getState().endGesture()
          }}
          onObjectChange={() => onMove([target.position.x, target.position.y, target.position.z])}
        />
      )}
    </>
  )
}

const editDrone = (droneId: string, fn: (d: NonNullable<ReturnType<typeof draftDrone>>) => void): void =>
  useEditor.getState().editLive((p) => {
    const d = draftDrone(p, droneId)
    if (d) fn(d)
  })

function WaypointGizmo({ drone, waypointId, handle }: { drone: Drone; waypointId: string; handle: 'in' | 'out' | null }): React.JSX.Element | null {
  const index = drone.waypoints.findIndex((w) => w.id === waypointId)
  const w = drone.waypoints[index]
  if (!w) return null
  // A handle only exists on the side of a Bezier Segment.
  const showIn = index > 0 && drone.waypoints[index - 1].segment === 'bezier'
  const showOut = index < drone.waypoints.length - 1 && w.segment === 'bezier'
  const side = (handle === 'in' && showIn) || (handle === 'out' && showOut) ? handle : null
  const position = side === 'in' ? add(w.position, w.inHandle) : side === 'out' ? add(w.position, w.outHandle) : w.position
  return (
    <Gizmo
      key={`${waypointId}-${side ?? 'point'}`}
      position={position}
      axes={w.kind !== 'air' && side === null ? 'xz' : 'xyz'}
      onMove={(p) =>
        editDrone(drone.id, (d) => {
          const x = d.waypoints.find((v) => v.id === waypointId)
          if (!x) return
          if (side) setHandle(x, side, sub(p, x.position))
          else if (x.kind === 'air') x.position = p
          else {
            d.takeoffSpot = [p[0], p[2]]
            syncTakeoffSpot(d)
          }
        })
      }
    />
  )
}

type DroneDrag =
  | { kind: 'spot' }
  | { kind: 'waypoint'; id: string }
  | { kind: 'preset'; from: Vec3; preset: PathPreset }

/**
 * Drag a Drone where it is at the playhead. On the floor it moves the Takeoff Spot.
 * In the air it moves the Waypoint it is at, or adds one at the playhead. A Drone
 * flying an unedited Path Preset moves the whole pattern instead.
 */
function DroneGizmo({ drone }: { drone: Drone }): React.JSX.Element {
  const time = useEditor((s) => s.time)
  const drag = useRef<DroneDrag>({ kind: 'spot' })
  const position = positionAt(drone.waypoints, time)
  const grounded = dragTargetAt(drone.waypoints, time).kind === 'spot'

  const onStart = (): void => {
    const s = useEditor.getState()
    const d = findDrone(s.project, drone.id)
    if (!d) return
    const t = s.time
    const target = dragTargetAt(d.waypoints, t)
    if (target.kind === 'spot') {
      drag.current = { kind: 'spot' }
    } else if (d.preset && presetMatchesPath(d)) {
      drag.current = { kind: 'preset', from: positionAt(d.waypoints, t), preset: d.preset }
      s.notify('Moving the whole Path Preset. Drag its A / B / centre points to reshape it.')
    } else if (target.kind === 'waypoint') {
      drag.current = { kind: 'waypoint', id: d.waypoints[target.index].id }
    } else {
      const id = newId()
      let added = false
      editDrone(d.id, (dd) => void (added = insertWaypointAt(dd.waypoints, t, id) !== null))
      if (added) {
        drag.current = { kind: 'waypoint', id }
        s.notify(`Added a Waypoint at ${formatTime(t)}.`)
      } else {
        const near = d.waypoints[nearestWaypointIndex(d.waypoints, t)]
        drag.current = near.kind === 'air' ? { kind: 'waypoint', id: near.id } : { kind: 'spot' }
      }
    }
  }

  const onMove = (p: Vec3): void => {
    const g = drag.current
    editDrone(drone.id, (d) => {
      if (g.kind === 'spot') {
        // The takeoff and landing follow the spot; a preset's pattern stays where it is.
        d.takeoffSpot = [p[0], p[2]]
        syncTakeoffSpot(d)
      } else if (g.kind === 'waypoint') {
        const w = d.waypoints.find((x) => x.id === g.id)
        if (w) w.position = p
      } else if (d.preset) {
        const delta = sub(p, g.from)
        for (const pt of presetPoints(g.preset)) setPresetPoint(d.preset, pt.id, add(pt.position, delta))
        applyPreset(d)
      }
    })
  }

  return <Gizmo key={`${drone.id}-${grounded}`} position={position} axes={grounded ? 'xz' : 'xyz'} onStart={onStart} onMove={onMove} />
}

function PresetPointGizmo({ drone, point }: { drone: Drone; point: string }): React.JSX.Element | null {
  const pt = drone.preset && presetPoints(drone.preset).find((x) => x.id === point)
  if (!pt) return null
  return (
    <Gizmo
      key={`${drone.id}-${point}`}
      position={pt.position}
      onMove={(p) =>
        editDrone(drone.id, (d) => {
          if (!d.preset) return
          setPresetPoint(d.preset, pt.id, p)
          applyPreset(d)
        })
      }
    />
  )
}

/** Where a Stage part's gizmo sits and which arrows it shows. */
function stagePartHandle(stage: Stage, part: StagePart): { position: Vec3; axes: string } | null {
  switch (part) {
    case 'net': {
      const net = stage.net
      if (net.placement === 'overhead') return { position: [0, net.height, 0], axes: 'y' }
      const f = wallFrame(stage, net.side)
      return { position: add(add(f.base, scale(f.inward, net.distance)), [0, stage.height / 2, 0]), axes: f.inward[0] !== 0 ? 'x' : 'z' }
    }
    case 'projection': {
      const p = stage.projection
      const f = wallFrame(stage, p.wall)
      return {
        position: add(add(f.base, scale(f.along, p.offset)), [0, p.bottom + p.height / 2, 0]),
        axes: (f.along[0] !== 0 ? 'x' : 'z') + 'y'
      }
    }
    case 'audience':
      return { position: [stage.audience.x, 0, stage.audience.z], axes: 'xz' }
    case 'room':
      return null
  }
}

function StagePartGizmo({ part }: { part: StagePart }): React.JSX.Element | null {
  const stage = useEditor((s) => s.project.stage)
  const handle = stagePartHandle(stage, part)
  if (!handle) return null
  const onMove = (p: Vec3): void =>
    useEditor.getState().editLive((d) => {
      const s = d.stage
      if (part === 'net') {
        if (s.net.placement === 'overhead') s.net.height = Math.min(Math.max(p[1], 0.1), s.height)
        else {
          const f = wallFrame(s, s.net.side)
          const span = f.inward[0] !== 0 ? s.width : s.depth
          s.net.distance = Math.min(Math.max(dot(sub(p, f.base), f.inward), 0), span)
        }
      } else if (part === 'projection') {
        const f = wallFrame(s, s.projection.wall)
        s.projection.offset = dot(sub(p, f.base), f.along)
        s.projection.bottom = Math.max(p[1] - s.projection.height / 2, 0)
      } else if (part === 'audience') {
        s.audience.x = p[0]
        s.audience.z = p[2]
      }
    })
  return <Gizmo key={`${part}-${stage.net.placement}-${stage.net.side}-${stage.projection.wall}`} position={handle.position} axes={handle.axes} onMove={onMove} />
}

/** The move gizmo for whatever is selected. */
export function Gizmos(): React.JSX.Element | null {
  const selection = useEditor((s) => s.selection)
  const project = useEditor((s) => s.project)
  if (selection.kind === 'waypoint') {
    const drone = findDrone(project, selection.droneId)
    return drone ? <WaypointGizmo drone={drone} waypointId={selection.waypointId} handle={selection.handle} /> : null
  }
  if (selection.kind === 'drone') {
    const drone = findDrone(project, selection.droneId)
    if (!drone) return null
    return selection.point ? <PresetPointGizmo drone={drone} point={selection.point} /> : <DroneGizmo drone={drone} />
  }
  if (selection.kind === 'stage' && selection.part) return <StagePartGizmo part={selection.part} />
  return null
}

/** A point to centre the camera on for the current selection. */
export function selectionPosition(project: Project, selection: Selection, time: number): Vec3 {
  const stage = project.stage
  const centre: Vec3 = [0, stage.height / 2, 0]
  switch (selection.kind) {
    case 'waypoint': {
      const f = findWaypoint(project, selection.droneId, selection.waypointId)
      return f ? f.waypoint.position : centre
    }
    case 'drone': {
      const d = findDrone(project, selection.droneId)
      if (!d) return centre
      const pt = selection.point && d.preset ? presetPoints(d.preset).find((x) => x.id === selection.point) : undefined
      return pt ? pt.position : positionAt(d.waypoints, time)
    }
    case 'stage':
      return (selection.part && stagePartHandle(stage, selection.part)?.position) || centre
    case 'project':
      return centre
  }
}

/** Centres the camera on the selection whenever requestFocus() is called. */
export function FocusOnRequest(): null {
  const request = useEditor((s) => s.focusRequest)
  const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3; update(): void } | null
  const camera = useThree((s) => s.camera)
  useEffect(() => {
    if (!request || !controls) return
    const s = useEditor.getState()
    const target = new THREE.Vector3(...selectionPosition(s.project, s.selection, s.time))
    const offset = camera.position.clone().sub(controls.target)
    // In 3D, also move in closer when far away.
    if (camera instanceof THREE.PerspectiveCamera && s.selection.kind !== 'project' && s.selection.kind !== 'stage') {
      offset.setLength(Math.min(offset.length(), 4))
    }
    controls.target.copy(target)
    camera.position.copy(target).add(offset)
    controls.update()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request])
  return null
}
