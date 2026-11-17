import { Html, Line } from '@react-three/drei'
import { useMemo } from 'react'
import { samplePath } from '../model/path'
import { presetPoints } from '../model/presets'
import type { Drone, Waypoint } from '../model/types'
import { add } from '../model/vec'
import { useEditor } from '../store/editorStore'
import { pickable, PRIORITY, useHighlight } from './picking'

type HandleSide = 'in' | 'out'

function HandleView({ drone, waypoint, side }: { drone: Drone; waypoint: Waypoint; side: HandleSide }): React.JSX.Element {
  const pick = pickable({ kind: 'waypoint', droneId: drone.id, waypointId: waypoint.id, handle: side }, PRIORITY.handle)
  const { selected, hovered } = useHighlight(pick.pick.selection)
  const offset = side === 'in' ? waypoint.inHandle : waypoint.outHandle
  const end = add(waypoint.position, offset)
  const size = hovered || selected ? 0.09 : 0.07
  return (
    <>
      <Line points={[waypoint.position, end]} color="#ffffff" lineWidth={1} dashed dashSize={0.06} gapSize={0.04} />
      <mesh position={end} userData={pick}>
        <boxGeometry args={[size, size, size]} />
        <meshBasicMaterial color={selected ? '#ffffff' : '#c8ced8'} />
      </mesh>
    </>
  )
}

function WaypointDot({ drone, waypoint }: { drone: Drone; waypoint: Waypoint }): React.JSX.Element {
  const pick = pickable({ kind: 'waypoint', droneId: drone.id, waypointId: waypoint.id, handle: null }, PRIORITY.waypoint)
  const { hovered } = useHighlight(pick.pick.selection)
  const selected = useEditor((s) => s.selection.kind === 'waypoint' && s.selection.waypointId === waypoint.id)
  return (
    <mesh position={waypoint.position} userData={pick}>
      <sphereGeometry args={[selected ? 0.09 : hovered ? 0.08 : 0.06, 16, 12]} />
      <meshBasicMaterial color={selected || hovered ? '#ffffff' : drone.editorColor} />
    </mesh>
  )
}

/** The draggable points of a Drone's Path Preset (A, B, centre…), shown while the Drone is selected. */
function PresetPointsView({ drone }: { drone: Drone }): React.JSX.Element | null {
  const selectedPoint = useEditor((s) => (s.selection.kind === 'drone' && s.selection.droneId === drone.id ? (s.selection.point ?? null) : null))
  const hovered = useEditor((s) => s.hovered)
  if (!drone.preset) return null
  return (
    <>
      {presetPoints(drone.preset).map((pt) => {
        const pick = pickable({ kind: 'drone', droneId: drone.id, point: pt.id }, PRIORITY.presetPoint)
        const active = selectedPoint === pt.id
        const hot = hovered === `drone:${drone.id}:${pt.id}`
        return (
          <group key={pt.id} position={pt.position}>
            <mesh userData={pick} rotation={[Math.PI / 4, Math.PI / 4, 0]}>
              <octahedronGeometry args={[active || hot ? 0.13 : 0.11]} />
              <meshBasicMaterial color={active ? '#ffffff' : drone.editorColor} wireframe={!active} />
            </mesh>
            <Html position={[0, -0.2, 0]} center zIndexRange={[25, 0]} style={{ pointerEvents: 'none' }}>
              <div className="scene-label scene-label--preset" style={{ borderColor: drone.editorColor }}>
                {pt.label}
              </div>
            </Html>
          </group>
        )
      })}
    </>
  )
}

export function PathView({ drone }: { drone: Drone }): React.JSX.Element {
  const selection = useEditor((s) => s.selection)
  const points = useMemo(() => samplePath(drone.waypoints), [drone.waypoints])

  const droneSelected = (selection.kind === 'drone' || selection.kind === 'waypoint') && selection.droneId === drone.id
  const selWaypointIndex = selection.kind === 'waypoint' && selection.droneId === drone.id ? drone.waypoints.findIndex((w) => w.id === selection.waypointId) : -1
  const selWaypoint = selWaypointIndex >= 0 ? drone.waypoints[selWaypointIndex] : null

  const takeoff = drone.waypoints[0]
  const [sx, sz] = drone.takeoffSpot
  const showIn = selWaypoint && selWaypointIndex > 0 && drone.waypoints[selWaypointIndex - 1].segment === 'bezier'
  const showOut = selWaypoint && selWaypointIndex < drone.waypoints.length - 1 && selWaypoint.segment === 'bezier'
  const spotPick = takeoff ? pickable({ kind: 'waypoint', droneId: drone.id, waypointId: takeoff.id, handle: null }, PRIORITY.takeoffSpot) : undefined
  const spot = useHighlight(spotPick?.pick.selection ?? { kind: 'project' })

  return (
    <group>
      {points.length > 1 && (
        <Line points={points} color={drone.editorColor} lineWidth={droneSelected ? 3 : 1.5} transparent opacity={droneSelected ? 1 : 0.7} />
      )}

      {/* Takeoff Spot: clicking it selects the takeoff Waypoint, which moves the spot. */}
      <group position={[sx, 0.005, sz]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} userData={spotPick}>
          <ringGeometry args={[0.18, spot.hovered || spot.selected ? 0.27 : 0.24, 32]} />
          <meshBasicMaterial color={spot.selected ? '#ffffff' : drone.editorColor} />
        </mesh>
      </group>

      {drone.waypoints.map((w) => (w.kind === 'air' ? <WaypointDot key={w.id} drone={drone} waypoint={w} /> : null))}

      {selWaypoint && showIn && <HandleView drone={drone} waypoint={selWaypoint} side="in" />}
      {selWaypoint && showOut && <HandleView drone={drone} waypoint={selWaypoint} side="out" />}
      {droneSelected && <PresetPointsView drone={drone} />}
    </group>
  )
}
