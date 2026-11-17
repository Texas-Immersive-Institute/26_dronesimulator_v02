import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber'
import { useEffect } from 'react'
import { droneLabel } from '../model/defaults'
import { presetPoints } from '../model/presets'
import { findDrone, findWaypoint, selectionKey, useEditor, type Selection } from '../store/editorStore'
import { CameraRig } from './CameraRig'
import { DroneView } from './DroneView'
import { FocusOnRequest, Gizmos } from './Gizmos'
import { PathView } from './PathView'
import { bestPick, gizmoRecentlyUsed } from './picking'
import { StageView } from './StageView'

/** Clicks pick the best selectable object under the mouse; clicking nothing selectable deselects. */
function PickRoot({ children }: { children: React.ReactNode }): React.JSX.Element {
  const gl = useThree((s) => s.gl)
  const raycaster = useThree((s) => s.raycaster)
  const { select, setHovered } = useEditor.getState()

  useEffect(() => {
    // Plain lines (grids, room edges) should only count when the mouse is right on them.
    raycaster.params.Line = { threshold: 0.02 }
  }, [raycaster])

  const onClick = (e: ThreeEvent<MouseEvent>): void => {
    e.stopPropagation()
    if (e.delta > 3 || gizmoRecentlyUsed()) return
    const p = bestPick(e.intersections)
    select(p ? p.selection : { kind: 'project' })
  }
  const onMove = (e: ThreeEvent<PointerEvent>): void => {
    const p = bestPick(e.intersections)
    setHovered(p ? selectionKey(p.selection) : null)
    gl.domElement.style.cursor = p ? 'pointer' : ''
  }
  const onOut = (): void => {
    setHovered(null)
    gl.domElement.style.cursor = ''
  }
  return (
    <group onClick={onClick} onPointerMove={onMove} onPointerOut={onOut}>
      {children}
    </group>
  )
}

export function Viewport(): React.JSX.Element {
  const drones = useEditor((s) => s.project.show.drones)
  return (
    <div className="viewport">
      <Canvas
        dpr={[1, 2]}
        gl={{ antialias: true }}
        onPointerMissed={(e) => {
          if (e.button === 0 && !gizmoRecentlyUsed()) useEditor.getState().select({ kind: 'project' })
        }}
      >
        <color attach="background" args={['#15171c']} />
        <ambientLight intensity={0.8} />
        <directionalLight position={[6, 12, 8]} intensity={1.4} />
        <CameraRig />
        <PickRoot>
          <StageView />
          {drones.map((d) => (
            <PathView key={`path-${d.id}`} drone={d} />
          ))}
          {drones.map((d) => (
            <DroneView key={`drone-${d.id}`} drone={d} />
          ))}
        </PickRoot>
        <Gizmos />
        <FocusOnRequest />
      </Canvas>
      <SelectionChip />
      <ViewButtons />
    </div>
  )
}

const STAGE_PART_NAMES = { room: 'Room', net: 'Safety Net', projection: 'Projection', audience: 'Audience Area' } as const

function describe(selection: Selection, project: ReturnType<typeof useEditor.getState>['project']): { name: string; hint: string } | null {
  switch (selection.kind) {
    case 'project':
      return null
    case 'stage':
      return selection.part && selection.part !== 'room'
        ? { name: STAGE_PART_NAMES[selection.part], hint: 'Drag the arrows to move it' }
        : { name: 'Stage', hint: 'Click the net, Projection or Audience Area to move them' }
    case 'drone': {
      const d = findDrone(project, selection.droneId)
      if (!d) return null
      if (selection.point && d.preset) {
        const pt = presetPoints(d.preset).find((x) => x.id === selection.point)
        return { name: `${droneLabel(d)} · preset ${pt?.label ?? ''}`, hint: 'Drag to reshape the preset' }
      }
      return { name: droneLabel(d), hint: 'Drag the arrows to move it at the playhead' }
    }
    case 'waypoint': {
      const f = findWaypoint(project, selection.droneId, selection.waypointId)
      if (!f) return null
      const what = selection.handle ? `${selection.handle} handle` : f.waypoint.kind === 'air' ? `Waypoint ${f.index}` : f.waypoint.kind === 'takeoff' ? 'Takeoff' : 'Landing'
      return { name: `${droneLabel(f.drone)} · ${what}`, hint: 'Drag the arrows to move it' }
    }
  }
}

/** What is selected, and how to move it. */
function SelectionChip(): React.JSX.Element | null {
  const selection = useEditor((s) => s.selection)
  const project = useEditor((s) => s.project)
  const info = describe(selection, project)
  if (!info) return <div className="selection-chip muted">Click a Drone, Waypoint, net or Projection to select it</div>
  return (
    <div className="selection-chip">
      <strong>{info.name}</strong>
      <span className="muted"> · {info.hint} · Ctrl snaps to 10 cm · . frames it · Esc deselects</span>
    </div>
  )
}

function ViewButtons(): React.JSX.Element {
  const view = useEditor((s) => s.view)
  const setView = useEditor((s) => s.setView)
  const requestFocus = useEditor((s) => s.requestFocus)
  const views = [
    ['perspective', '3D', 'Free 3D camera (P or numpad 5)'],
    ['top', 'Top', 'Flat view from above (T or numpad 7)'],
    ['front', 'Front', 'Flat view from the front wall (F or numpad 1)'],
    ['side', 'Side', 'Flat view from the right wall (S or numpad 3)']
  ] as const
  return (
    <div className="view-buttons">
      <button title="Centre the camera on the selection (.)" onClick={requestFocus}>
        Frame
      </button>
      {views.map(([id, label, title]) => (
        <button key={id} className={view === id ? 'active' : ''} title={title} onClick={() => setView(id)}>
          {label}
        </button>
      ))}
    </div>
  )
}
